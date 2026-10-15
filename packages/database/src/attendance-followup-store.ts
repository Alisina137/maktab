import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears, attendanceFollowupActivities, attendanceFollowupCases, auditLogs,
  classSections, dailyAttendances, studentAttendances, students, users
} from "./schema.js";
import { validCalendarDay } from "./attendance-monitoring-store.js";

export type FollowupState = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
export type FollowupActivityType = "NOTE" | "CALL" | "MEETING" | "MESSAGE";
export type FollowupQuery = {
  academicYearId: string; from?: string; to?: string; classId?: string;
  search?: string; status?: FollowupState; limit: number; offset: number;
};
export type FollowupCandidate = {
  attendanceId: string; studentId: string; studentAttendanceId: string;
  studentName: string; studentCode: string; classId: string; className: string;
  date: string; status: "ABSENT" | "LATE"; existingCaseId: string | null;
};
export type FollowupCaseRow = {
  id: string; academicYearId: string; studentId: string; studentName: string; studentCode: string;
  classId: string; className: string; attendanceId: string; date: string;
  sourceStatus: string; currentStatus: string; status: FollowupState;
  assignedToUserId: string | null; dueOn: string | null; openingNote: string;
  resolutionNote: string | null; updatedAt: string; createdAt: string;
};
export class FollowupNotFoundError extends Error {
  constructor(message = "Follow-up not found.") { super(message); this.name = "FollowupNotFoundError"; }
}
export class FollowupConflictError extends Error {
  constructor(message: string) { super(message); this.name = "FollowupConflictError"; }
}
export class FollowupValidationError extends Error {
  constructor(message: string) { super(message); this.name = "FollowupValidationError"; }
}

export interface AttendanceFollowupStore {
  getFollowupAssignees(schoolId: string): Promise<Array<{id:string;username:string}>>;
  getFollowupCandidates(schoolId: string, options: FollowupQuery):
    Promise<{total:number;limit:number;offset:number;rows:FollowupCandidate[]}>;
  listFollowupCases(schoolId: string, options: FollowupQuery):
    Promise<{total:number;limit:number;offset:number;summary:Record<FollowupState,number>;rows:FollowupCaseRow[]}>;
  createFollowupCase(schoolId: string, actorId: string, input: {
    academicYearId: string; attendanceId: string; studentId: string;
    assignedToUserId?: string | null; dueOn?: string | null; openingNote: string;
  }): Promise<{id:string}>;
  updateFollowupCase(schoolId: string, actorId: string, caseId: string, input: {
    expectedUpdatedAt: string; status?: FollowupState; assignedToUserId?: string | null;
    dueOn?: string | null; note: string;
  }): Promise<{id:string;updatedAt:string}>;
  recordFollowupActivity(schoolId:string,actorId:string,caseId:string,input: {
    kind:FollowupActivityType; details:string;
  }): Promise<{id:string}>;
  listFollowupActivities(schoolId:string,caseId:string,limit:number,offset:number):
    Promise<{total:number;rows:Array<{id:string;kind:string;details:string;actorName:string;createdAt:string}>}>;
}

function validDateRange(from?: string,to?: string) {
  if ((from && !validCalendarDay(from)) || (to && !validCalendarDay(to)) || (from && to && from>to))
    throw new FollowupValidationError("Choose a valid date range.");
  if(from && to && (Date.parse(to+"T12:00:00Z")-Date.parse(from+"T12:00:00Z"))/86400000 > 61)
    throw new FollowupValidationError("Select at most 62 days for follow-up filters.");
}
function validatePage(limit:number,offset:number) {
  if (!Number.isInteger(limit) || limit<1 || limit>50 || !Number.isInteger(offset) || offset<0 || offset>100000)
    throw new FollowupValidationError("Invalid follow-up page.");
}
function escapedSearch(search?:string) {
  const value=(search??"").trim();
  if(value.length>100)throw new FollowupValidationError("Search must be at most 100 characters.");
  return value.replace(/[\\%_]/g,match=>"\\"+match);
}

export function createAttendanceFollowupStore(db:FoundationDatabase):AttendanceFollowupStore {
  async function ensureYear(schoolId:string,yearId:string,write=false) {
    const [year]=await db.select({status:academicYears.status}).from(academicYears)
      .where(and(eq(academicYears.schoolId,schoolId),eq(academicYears.id,yearId))).limit(1);
    if(!year)throw new FollowupNotFoundError("Academic year not found.");
    if(write && year.status!=="ACTIVE")
      throw new FollowupConflictError("Follow-ups in historical academic years are read-only.");
  }
  async function ensureAssignee(schoolId:string,id:string|null|undefined) {
    if(id===null || id===undefined)return;
    const [user]=await db.select({id:users.id}).from(users).where(and(
      eq(users.schoolId,schoolId),eq(users.id,id),eq(users.status,"ACTIVE"),
      or(eq(users.role,"SCHOOL_ADMIN"),eq(users.role,"SCHOOL_STAFF"))
    )).limit(1);
    if(!user)throw new FollowupValidationError("Select an active administrator or staff member from this school.");
  }
  async function ensureCase(schoolId:string,caseId:string,write=false) {
    const [record]=await db.select().from(attendanceFollowupCases).where(and(
      eq(attendanceFollowupCases.schoolId,schoolId),eq(attendanceFollowupCases.id,caseId)
    )).limit(1);
    if(!record)throw new FollowupNotFoundError();
    await ensureYear(schoolId,record.academicYearId,write);
    return record;
  }
  async function log(tx: Parameters<Parameters<FoundationDatabase["transaction"]>[0]>[0],
    schoolId:string,actorId:string,caseId:string,kind:
      "OPENED"|"NOTE"|"CALL"|"MEETING"|"MESSAGE"|"STATUS_CHANGE"|"ASSIGNMENT",
    details:string) {
    const activityId=randomUUID();
    await tx.insert(attendanceFollowupActivities).values({
      id:activityId,schoolId,caseId,actorUserId:actorId,kind,details
    });
    await tx.insert(auditLogs).values({
      id:randomUUID(),schoolId,actorUserId:actorId,
      action:"attendance.followup_"+kind.toLowerCase(),entityType:"attendance_followup",entityId:caseId,
      // Private family contact details and activity notes are not copied into general school audit.
      metadata:{caseId,kind}
    });
    return activityId;
  }

  return {
    async getFollowupAssignees(schoolId) {
      return db.select({id:users.id,username:users.username}).from(users).where(and(
        eq(users.schoolId,schoolId),eq(users.status,"ACTIVE"),
        or(eq(users.role,"SCHOOL_ADMIN"),eq(users.role,"SCHOOL_STAFF"))
      )).orderBy(asc(users.username)).limit(200);
    },
    async getFollowupCandidates(schoolId,options) {
      await ensureYear(schoolId,options.academicYearId);
      validDateRange(options.from,options.to);validatePage(options.limit,options.offset);
      const search=escapedSearch(options.search);
      const filters=[
        eq(studentAttendances.schoolId,schoolId),eq(dailyAttendances.schoolId,schoolId),
        eq(dailyAttendances.academicYearId,options.academicYearId),
        or(eq(studentAttendances.status,"ABSENT"),eq(studentAttendances.status,"LATE"))!,
        ...(options.from?[gte(dailyAttendances.date,options.from)]:[]),
        ...(options.to?[lte(dailyAttendances.date,options.to)]:[]),
        ...(options.classId?[eq(dailyAttendances.classId,options.classId)]:[]),
        ...(search?[or(ilike(students.fullName,`%${search}%`),ilike(students.studentCode,`%${search}%`))!]:[])
      ];
      const selection=()=>db.select({
        attendanceId:dailyAttendances.id,studentId:students.id,
        studentAttendanceId:studentAttendances.id,studentName:students.fullName,
        studentCode:students.studentCode,classId:classSections.id,
        className:classSections.name,date:dailyAttendances.date,
        status:studentAttendances.status,existingCaseId:attendanceFollowupCases.id
      }).from(studentAttendances)
        .innerJoin(dailyAttendances,and(eq(dailyAttendances.id,studentAttendances.attendanceId),
          eq(dailyAttendances.schoolId,schoolId)))
        .innerJoin(students,and(eq(students.id,studentAttendances.studentId),eq(students.schoolId,schoolId)))
        .innerJoin(classSections,and(eq(classSections.id,dailyAttendances.classId),eq(classSections.schoolId,schoolId)))
        .leftJoin(attendanceFollowupCases,and(
          eq(attendanceFollowupCases.studentAttendanceId,studentAttendances.id),
          eq(attendanceFollowupCases.schoolId,schoolId)));
      const [totals,rows]=await Promise.all([
        db.select({total:count()}).from(studentAttendances)
          .innerJoin(dailyAttendances,and(eq(dailyAttendances.id,studentAttendances.attendanceId),
            eq(dailyAttendances.schoolId,schoolId)))
          .innerJoin(students,and(eq(students.id,studentAttendances.studentId),eq(students.schoolId,schoolId)))
          .where(and(...filters)),
        selection().where(and(...filters)).orderBy(desc(dailyAttendances.date),asc(students.fullName),
          asc(studentAttendances.id)).limit(options.limit).offset(options.offset)
      ]);
      return {total:Number(totals[0]?.total??0),limit:options.limit,offset:options.offset,
        rows:rows.map(row=>({...row,status:row.status as "ABSENT"|"LATE"}))};
    },
    async listFollowupCases(schoolId,options) {
      await ensureYear(schoolId,options.academicYearId);
      validDateRange(options.from,options.to);validatePage(options.limit,options.offset);
      const search=escapedSearch(options.search);
      const base=[
        eq(attendanceFollowupCases.schoolId,schoolId),
        eq(attendanceFollowupCases.academicYearId,options.academicYearId),
        eq(studentAttendances.schoolId,schoolId),eq(dailyAttendances.schoolId,schoolId),
        ...(options.from?[gte(dailyAttendances.date,options.from)]:[]),
        ...(options.to?[lte(dailyAttendances.date,options.to)]:[]),
        ...(options.classId?[eq(dailyAttendances.classId,options.classId)]:[]),
        ...(search?[or(ilike(students.fullName,`%${search}%`),ilike(students.studentCode,`%${search}%`))!]:[])
      ];
      const joined=()=>db.select({
        caseRow:attendanceFollowupCases,id:attendanceFollowupCases.id,
        studentId:students.id,studentName:students.fullName,studentCode:students.studentCode,
        classId:classSections.id,className:classSections.name,
        attendanceId:dailyAttendances.id,date:dailyAttendances.date,currentStatus:studentAttendances.status
      }).from(attendanceFollowupCases)
        .innerJoin(studentAttendances,and(
          eq(studentAttendances.id,attendanceFollowupCases.studentAttendanceId),
          eq(studentAttendances.schoolId,schoolId)))
        .innerJoin(dailyAttendances,and(eq(dailyAttendances.id,studentAttendances.attendanceId),
          eq(dailyAttendances.schoolId,schoolId)))
        .innerJoin(students,and(eq(students.id,studentAttendances.studentId),eq(students.schoolId,schoolId)))
        .innerJoin(classSections,and(eq(classSections.id,dailyAttendances.classId),eq(classSections.schoolId,schoolId)));
      // Count each status at the database; never materialize an entire
      // school's private cases merely to show dashboard summaries.
      const aggregation=()=>db.select({
        state:attendanceFollowupCases.status,
        total:count()
      }).from(attendanceFollowupCases)
        .innerJoin(studentAttendances,and(
          eq(studentAttendances.id,attendanceFollowupCases.studentAttendanceId),
          eq(studentAttendances.schoolId,schoolId)))
        .innerJoin(dailyAttendances,and(
          eq(dailyAttendances.id,studentAttendances.attendanceId),
          eq(dailyAttendances.schoolId,schoolId)))
        .innerJoin(students,and(
          eq(students.id,studentAttendances.studentId),
          eq(students.schoolId,schoolId)));
      const statusWhere=options.status?eq(attendanceFollowupCases.status,options.status):undefined;
      const [grouped,matching,rows]=await Promise.all([
        aggregation().where(and(...base)).groupBy(attendanceFollowupCases.status),
        db.select({total:count()}).from(attendanceFollowupCases)
          .innerJoin(studentAttendances,and(
            eq(studentAttendances.id,attendanceFollowupCases.studentAttendanceId),
            eq(studentAttendances.schoolId,schoolId)))
          .innerJoin(dailyAttendances,and(
            eq(dailyAttendances.id,studentAttendances.attendanceId),
            eq(dailyAttendances.schoolId,schoolId)))
          .innerJoin(students,and(
            eq(students.id,studentAttendances.studentId),eq(students.schoolId,schoolId)))
          .where(and(...base,statusWhere)),
        joined().where(and(...base,statusWhere))
          .orderBy(desc(attendanceFollowupCases.createdAt),desc(attendanceFollowupCases.id))
          .limit(options.limit).offset(options.offset)
      ]);
      const summary:Record<FollowupState,number>={OPEN:0,IN_PROGRESS:0,RESOLVED:0,DISMISSED:0};
      for(const item of grouped)summary[item.state]=Number(item.total);
      return {total:Number(matching[0]?.total??0),limit:options.limit,offset:options.offset,summary,
        rows:rows.map(({caseRow,studentId,
          studentName,studentCode,classId,className,attendanceId,date,currentStatus})=>({
          id:caseRow.id,academicYearId:caseRow.academicYearId,studentId,studentName,studentCode,
          classId,className,attendanceId,date,sourceStatus:caseRow.sourceStatus,currentStatus,
          status:caseRow.status,assignedToUserId:caseRow.assignedToUserId,dueOn:caseRow.dueOn,
          openingNote:caseRow.openingNote,resolutionNote:caseRow.resolutionNote,
          updatedAt:caseRow.updatedAt.toISOString(),createdAt:caseRow.createdAt.toISOString()
        }))};
    },
    async createFollowupCase(schoolId,actorId,input) {
      await ensureYear(schoolId,input.academicYearId,true);
      await ensureAssignee(schoolId,input.assignedToUserId);
      if(input.dueOn && !validCalendarDay(input.dueOn))throw new FollowupValidationError("Invalid due date.");
      const [mark]=await db.select({id:studentAttendances.id,status:studentAttendances.status})
        .from(studentAttendances)
        .innerJoin(dailyAttendances,and(eq(dailyAttendances.id,studentAttendances.attendanceId),
          eq(dailyAttendances.schoolId,schoolId)))
        .where(and(
          eq(studentAttendances.schoolId,schoolId),
          eq(studentAttendances.attendanceId,input.attendanceId),
          eq(studentAttendances.studentId,input.studentId),
          eq(dailyAttendances.academicYearId,input.academicYearId)
        )).limit(1);
      if(!mark)throw new FollowupNotFoundError("Submitted student attendance mark not found.");
      if(mark.status!=="ABSENT"&&mark.status!=="LATE")
        throw new FollowupConflictError("Only recorded ABSENT or LATE marks can start a follow-up.");
      return db.transaction(async tx=>{
        const id=randomUUID();
        const [created]=await tx.insert(attendanceFollowupCases).values({
          id,schoolId,academicYearId:input.academicYearId,studentAttendanceId:mark.id,
          sourceStatus:mark.status,openingNote:input.openingNote,
          createdBy:actorId,updatedBy:actorId,
          assignedToUserId:input.assignedToUserId??null,dueOn:input.dueOn??null
        }).onConflictDoNothing().returning({id:attendanceFollowupCases.id});
        if(!created)throw new FollowupConflictError("A follow-up already exists for this attendance mark.");
        await log(tx,schoolId,actorId,id,"OPENED","Follow-up opened for recorded "+mark.status+".");
        return {id};
      });
    },
    async updateFollowupCase(schoolId,actorId,caseId,input) {
      const record=await ensureCase(schoolId,caseId,true);
      if(input.assignedToUserId!==undefined)await ensureAssignee(schoolId,input.assignedToUserId);
      if(input.dueOn && !validCalendarDay(input.dueOn))throw new FollowupValidationError("Invalid due date.");
      if(input.status===record.status && input.assignedToUserId===undefined && input.dueOn===undefined)
        throw new FollowupValidationError("No follow-up changes were requested.");
      const stamp=new Date(input.expectedUpdatedAt);
      if(!Number.isFinite(stamp.getTime()) || stamp.toISOString()!==record.updatedAt.toISOString())
        throw new FollowupConflictError("Follow-up changed. Refresh before saving.");
      const nextStatus=input.status??record.status;
      return db.transaction(async tx=>{
        const updatedAt=new Date(Math.max(Date.now(),record.updatedAt.getTime()+1));
        const [updated]=await tx.update(attendanceFollowupCases).set({
          status:nextStatus,
          assignedToUserId:input.assignedToUserId===undefined?record.assignedToUserId:input.assignedToUserId,
          dueOn:input.dueOn===undefined?record.dueOn:input.dueOn,
          resolutionNote:nextStatus==="RESOLVED"||nextStatus==="DISMISSED"?input.note:null,
          updatedBy:actorId,updatedAt
        }).where(and(eq(attendanceFollowupCases.schoolId,schoolId),
          eq(attendanceFollowupCases.id,caseId),
          eq(attendanceFollowupCases.updatedAt,record.updatedAt))).returning({id:attendanceFollowupCases.id});
        if(!updated)throw new FollowupConflictError("Follow-up changed during save. Refresh and retry.");
        await log(tx,schoolId,actorId,caseId,
          input.status && input.status!==record.status?"STATUS_CHANGE":"ASSIGNMENT",input.note);
        return {id:caseId,updatedAt:updatedAt.toISOString()};
      });
    },
    async recordFollowupActivity(schoolId,actorId,caseId,input) {
      const record=await ensureCase(schoolId,caseId,true);
      if(record.status==="RESOLVED"||record.status==="DISMISSED")
        throw new FollowupConflictError("Reopen a closed follow-up before recording further activity.");
      return db.transaction(async tx=>{
        const id=await log(tx,schoolId,actorId,caseId,input.kind,input.details);
        return {id};
      });
    },
    async listFollowupActivities(schoolId,caseId,limit,offset) {
      validatePage(limit,offset);
      await ensureCase(schoolId,caseId);
      const [total,rows]=await Promise.all([
        db.select({total:count()}).from(attendanceFollowupActivities).where(and(
          eq(attendanceFollowupActivities.schoolId,schoolId),
          eq(attendanceFollowupActivities.caseId,caseId))),
        db.select({id:attendanceFollowupActivities.id,kind:attendanceFollowupActivities.kind,
          details:attendanceFollowupActivities.details,actorName:users.username,
          createdAt:attendanceFollowupActivities.createdAt}).from(attendanceFollowupActivities)
          .innerJoin(users,and(eq(users.id,attendanceFollowupActivities.actorUserId),
            eq(users.schoolId,schoolId)))
          .where(and(eq(attendanceFollowupActivities.schoolId,schoolId),
            eq(attendanceFollowupActivities.caseId,caseId)))
          .orderBy(desc(attendanceFollowupActivities.createdAt),desc(attendanceFollowupActivities.id))
          .limit(limit).offset(offset)
      ]);
      return {total:Number(total[0]?.total??0),
        rows:rows.map(r=>({...r,createdAt:r.createdAt.toISOString()}))};
    }
  };
}
