import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike, ne } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import { academicYears, classSections, gradeLevels, parentProfiles, registrationRequests,
  studentClassHistory, students, users, type RegistrationRequest } from "./schema.js";

export type RegistrationStatus = RegistrationRequest["status"];
export type RegistrationDetails = {
  fullName: string; studentCode: string; parentName: string;
  academicYearId: string; gradeLevelId: string;
  documents: { identityChecked: boolean; consentChecked: boolean; priorRecordChecked: boolean };
  notes: string;
};
export class RegistrationError extends Error {
  constructor(public readonly statusCode: 400 | 404 | 409, message: string) { super(message); }
}
export interface RegistrationStore {
  getOptions(schoolId: string): Promise<{
    years: Array<{id:string;name:string;status:string}>;
    grades: Array<{id:string;name:string}>;
    classes: Array<{id:string;name:string;academicYearId:string;gradeLevelId:string}>;
    parents: Array<{userId:string;fullName:string}>;
  }>;
  list(schoolId: string, status?: RegistrationStatus): Promise<RegistrationRequest[]>;
  create(schoolId: string, createdBy: string, input: RegistrationDetails): Promise<RegistrationRequest>;
  update(schoolId: string, id: string, createdBy: string, input: RegistrationDetails): Promise<RegistrationRequest>;
  submit(schoolId: string, id: string, createdBy: string): Promise<RegistrationRequest>;
  startReview(schoolId: string, id: string, adminId: string): Promise<RegistrationRequest>;
  decide(schoolId: string, id: string, adminId: string,
    decision: { action:"APPROVE"; parentUserId:string; classId:string; note:string } |
              { action:"REJECT"; note:string }): Promise<RegistrationRequest>;
}
export function createRegistrationStore(db: FoundationDatabase): RegistrationStore {
  async function validate(schoolId:string, input:RegistrationDetails) {
    const [year] = await db.select().from(academicYears)
      .where(and(eq(academicYears.id,input.academicYearId),eq(academicYears.schoolId,schoolId))).limit(1);
    if (!year || !["ACTIVE","DRAFT"].includes(year.status))
      throw new RegistrationError(400,"Select an available academic year.");
    const [grade] = await db.select().from(gradeLevels)
      .where(and(eq(gradeLevels.id,input.gradeLevelId),eq(gradeLevels.schoolId,schoolId))).limit(1);
    if (!grade) throw new RegistrationError(400,"Select a grade within this school.");
    const existing=await db.select({id:students.id}).from(students)
      .where(and(eq(students.schoolId,schoolId),ilike(students.studentCode,input.studentCode))).limit(1);
    if(existing.length) throw new RegistrationError(409,"This student code is already registered.");
  }
  async function checked<T>(operation:()=>Promise<T>):Promise<T> {
    try { return await operation(); }
    catch(error) {
      if (error && typeof error==="object" && "code" in error && error.code==="23505")
        throw new RegistrationError(409,"An open registration or student already uses this code.");
      throw error;
    }
  }
  return {
    async getOptions(schoolId) {
      const [years,grades,classes,parents]=await Promise.all([
        db.select({id:academicYears.id,name:academicYears.name,status:academicYears.status})
          .from(academicYears).where(eq(academicYears.schoolId,schoolId)).orderBy(desc(academicYears.createdAt)),
        db.select({id:gradeLevels.id,name:gradeLevels.name})
          .from(gradeLevels).where(eq(gradeLevels.schoolId,schoolId)).orderBy(asc(gradeLevels.sortOrder)),
        db.select({id:classSections.id,name:classSections.name,
          academicYearId:classSections.academicYearId,gradeLevelId:classSections.gradeLevelId})
          .from(classSections).where(eq(classSections.schoolId,schoolId)).orderBy(asc(classSections.name)),
        db.select({userId:parentProfiles.userId,fullName:parentProfiles.fullName})
          .from(parentProfiles).innerJoin(users,
            and(eq(users.id,parentProfiles.userId),eq(users.schoolId,schoolId),eq(users.role,"PARENT")))
          .where(and(eq(parentProfiles.schoolId,schoolId),ne(users.status,"SUSPENDED"),
            ne(users.status,"ARCHIVED"))).orderBy(asc(parentProfiles.fullName))
      ]);
      return {years,grades,classes,parents};
    },
    async list(schoolId,status) {
      return db.select().from(registrationRequests)
        .where(and(eq(registrationRequests.schoolId,schoolId),
          ...(status?[eq(registrationRequests.status,status)]:[])))
        .orderBy(desc(registrationRequests.updatedAt)).limit(100);
    },
    async create(schoolId,createdBy,input) {
      await validate(schoolId,input);
      return checked(async()=>{
        const [row]=await db.insert(registrationRequests).values({
          id:randomUUID(),schoolId,createdBy,...input
        }).returning();
        if(!row)throw new Error("Registration insert failed.");
        return row;
      });
    },
    async update(schoolId,id,createdBy,input) {
      await validate(schoolId,input);
      return checked(async()=>{
        const [row]=await db.update(registrationRequests).set({...input,updatedAt:new Date()})
          .where(and(eq(registrationRequests.id,id),eq(registrationRequests.schoolId,schoolId),
            eq(registrationRequests.createdBy,createdBy),eq(registrationRequests.status,"DRAFT")))
          .returning();
        if(!row)throw new RegistrationError(409,"Only your draft registrations can be edited.");
        return row;
      });
    },
    async submit(schoolId,id,createdBy) {
      return db.transaction(async tx=>{
        const [draft]=await tx.select().from(registrationRequests).where(and(
          eq(registrationRequests.id,id),eq(registrationRequests.schoolId,schoolId),
          eq(registrationRequests.createdBy,createdBy),eq(registrationRequests.status,"DRAFT"))).limit(1);
        if(!draft)throw new RegistrationError(409,"Only your draft can be submitted.");
        if(!draft.documents.identityChecked || !draft.documents.consentChecked)
          throw new RegistrationError(400,"Confirm identity and guardian consent before submitting.");
        const dup=await tx.select({id:students.id}).from(students)
          .where(and(eq(students.schoolId,schoolId),ilike(students.studentCode,draft.studentCode))).limit(1);
        if(dup.length)throw new RegistrationError(409,"Student code is already in use.");
        const [row]=await tx.update(registrationRequests)
          .set({status:"SUBMITTED",submittedAt:new Date(),updatedAt:new Date()})
          .where(and(eq(registrationRequests.id,id),eq(registrationRequests.schoolId,schoolId),
            eq(registrationRequests.createdBy,createdBy),eq(registrationRequests.status,"DRAFT"))).returning();
        if(!row)throw new RegistrationError(409,"Registration has already changed.");
        return row;
      });
    },
    async startReview(schoolId,id,adminId) {
      const [row]=await db.update(registrationRequests)
        .set({status:"UNDER_REVIEW",reviewedBy:adminId,updatedAt:new Date()})
        .where(and(eq(registrationRequests.id,id),eq(registrationRequests.schoolId,schoolId),
          eq(registrationRequests.status,"SUBMITTED"))).returning();
      if(!row)throw new RegistrationError(409,"Only submitted requests can be reviewed.");
      return row;
    },
    async decide(schoolId,id,adminId,decision) {
      return checked(()=>db.transaction(async tx=>{
        // Conditional transition first: concurrent decisions cannot enroll the same request twice.
        const [row]=await tx.update(registrationRequests).set({
          status:decision.action==="APPROVE"?"APPROVED":"REJECTED",
          reviewedBy:adminId,reviewNote:decision.note,decidedAt:new Date(),updatedAt:new Date()
        }).where(and(eq(registrationRequests.schoolId,schoolId),eq(registrationRequests.id,id),
          eq(registrationRequests.status,"UNDER_REVIEW"))).returning();
        if(!row)throw new RegistrationError(409,"The request is not under review or has already been decided.");
        if(decision.action==="REJECT")return row;
        const [parent]=await tx.select({id:parentProfiles.userId}).from(parentProfiles)
          .innerJoin(users,and(eq(users.id,parentProfiles.userId),
            eq(users.schoolId,schoolId),eq(users.role,"PARENT"),ne(users.status,"SUSPENDED"),
            ne(users.status,"ARCHIVED")))
          .where(and(eq(parentProfiles.userId,decision.parentUserId),
            eq(parentProfiles.schoolId,schoolId))).limit(1);
        if(!parent)throw new RegistrationError(400,"Select an available parent from this school.");
        const [klass]=await tx.select().from(classSections)
          .where(and(eq(classSections.id,decision.classId),eq(classSections.schoolId,schoolId),
            eq(classSections.academicYearId,row.academicYearId),
            eq(classSections.gradeLevelId,row.gradeLevelId))).limit(1);
        if(!klass)throw new RegistrationError(400,"Select a class for this academic year and grade.");
        const [year]=await tx.select({status:academicYears.status}).from(academicYears)
          .where(and(eq(academicYears.id,row.academicYearId),eq(academicYears.schoolId,schoolId))).limit(1);
        if(year?.status!=="ACTIVE")throw new RegistrationError(409,"Academic year must be active to enroll.");
        const already=await tx.select({id:students.id}).from(students)
          .where(and(eq(students.schoolId,schoolId),ilike(students.fullName,row.fullName),
            eq(students.parentUserId,parent.id),eq(students.academicYearId,row.academicYearId))).limit(1);
        if(already.length)throw new RegistrationError(409,"This student is already linked to the parent in this year.");
        const [student]=await tx.insert(students).values({
          id:randomUUID(),schoolId,studentCode:row.studentCode,fullName:row.fullName,
          parentUserId:parent.id,academicYearId:row.academicYearId,classId:klass.id
        }).returning();
        if(!student)throw new Error("Could not enroll student.");
        await tx.insert(studentClassHistory).values({
          id:randomUUID(),schoolId,studentId:student.id,
          academicYearId:row.academicYearId,classId:klass.id
        });
        const [completed]=await tx.update(registrationRequests)
          .set({approvedStudentId:student.id}).where(eq(registrationRequests.id,row.id)).returning();
        if(!completed)throw new Error("Could not finalize registration.");
        return completed;
      }));
    }
  };
}
