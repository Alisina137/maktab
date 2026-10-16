import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { AttendanceStatus } from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import { isUniqueConstraintViolation } from "./db-errors.js";
import { academicYears, auditLogs, classSections, dailyAttendances,
  staffAttendanceCorrectionRequests, studentAttendances, students } from "./schema.js";
import { syncStaffCorrectionAlert } from "./staff-attendance-alert.js";

export type StaffAttendanceCorrection = typeof staffAttendanceCorrectionRequests.$inferSelect;
export class StaffAttendanceCorrectionError extends Error {
  constructor(public readonly statusCode:400|404|409, message:string){ super(message); }
}
export interface StaffAttendanceCorrectionStore {
  list(schoolId:string, createdBy?:string):Promise<Array<StaffAttendanceCorrection & {
    studentName:string;studentCode:string;className:string;date:string;
  }>>;
  create(schoolId:string, createdBy:string, input:{
    attendanceId:string;studentId:string;requestedStatus:AttendanceStatus;
    expectedUpdatedAt:string;reason:string;
  }):Promise<StaffAttendanceCorrection>;
  decide(schoolId:string,id:string,adminId:string,input:{
    action:"APPROVE"|"REJECT";note:string;
  }):Promise<StaffAttendanceCorrection>;
}
export function createStaffAttendanceCorrectionStore(db:FoundationDatabase):StaffAttendanceCorrectionStore {
  const conflict=(msg:string)=>new StaffAttendanceCorrectionError(409,msg);
  async function mark(schoolId:string,attendanceId:string,studentId:string,
    reader:Pick<FoundationDatabase,"select">=db) {
    const [row]=await reader.select({
      attendance:dailyAttendances,entry:studentAttendances,student:students
    }).from(studentAttendances).innerJoin(dailyAttendances,and(
      eq(dailyAttendances.id,studentAttendances.attendanceId),
      eq(dailyAttendances.schoolId,studentAttendances.schoolId)))
      .innerJoin(students,and(eq(students.id,studentAttendances.studentId),
        eq(students.schoolId,studentAttendances.schoolId)))
      .where(and(eq(studentAttendances.schoolId,schoolId),
        eq(studentAttendances.attendanceId,attendanceId),eq(studentAttendances.studentId,studentId)))
      .limit(1);
    if(!row)throw new StaffAttendanceCorrectionError(404,"Attendance mark not found.");
    const [year]=await reader.select({status:academicYears.status}).from(academicYears)
      .where(and(eq(academicYears.id,row.attendance.academicYearId),
        eq(academicYears.schoolId,schoolId))).limit(1);
    if(year?.status!=="ACTIVE")throw conflict("Historical attendance is read-only.");
    return row;
  }
  return {
    async list(schoolId,createdBy) {
      return db.select({
        id:staffAttendanceCorrectionRequests.id,
        schoolId:staffAttendanceCorrectionRequests.schoolId,
        attendanceId:staffAttendanceCorrectionRequests.attendanceId,
        studentId:staffAttendanceCorrectionRequests.studentId,
        createdBy:staffAttendanceCorrectionRequests.createdBy,
        originalStatus:staffAttendanceCorrectionRequests.originalStatus,
        requestedStatus:staffAttendanceCorrectionRequests.requestedStatus,
        expectedUpdatedAt:staffAttendanceCorrectionRequests.expectedUpdatedAt,
        reason:staffAttendanceCorrectionRequests.reason,
        status:staffAttendanceCorrectionRequests.status,
        reviewedBy:staffAttendanceCorrectionRequests.reviewedBy,
        reviewNote:staffAttendanceCorrectionRequests.reviewNote,
        createdAt:staffAttendanceCorrectionRequests.createdAt,
        decidedAt:staffAttendanceCorrectionRequests.decidedAt,
        studentName:students.fullName,studentCode:students.studentCode,
        className:classSections.name,date:dailyAttendances.date
      }).from(staffAttendanceCorrectionRequests)
      .innerJoin(dailyAttendances,and(
        eq(dailyAttendances.id,staffAttendanceCorrectionRequests.attendanceId),
        eq(dailyAttendances.schoolId,schoolId)))
      .innerJoin(students,and(eq(students.id,staffAttendanceCorrectionRequests.studentId),
        eq(students.schoolId,schoolId)))
      .innerJoin(classSections,and(eq(classSections.id,dailyAttendances.classId),
        eq(classSections.schoolId,schoolId)))
      .where(and(eq(staffAttendanceCorrectionRequests.schoolId,schoolId),
        ...(createdBy?[eq(staffAttendanceCorrectionRequests.createdBy,createdBy)]:[])))
      .orderBy(desc(staffAttendanceCorrectionRequests.createdAt)).limit(100);
    },
    async create(schoolId,createdBy,input) {
      const current=await mark(schoolId,input.attendanceId,input.studentId);
      if(current.entry.updatedAt.getTime()!==new Date(input.expectedUpdatedAt).getTime())
        throw conflict("Attendance changed. Refresh and try again.");
      if(current.entry.status===input.requestedStatus)
        throw new StaffAttendanceCorrectionError(400,"Choose a different attendance status.");
      try {
        const [row]=await db.insert(staffAttendanceCorrectionRequests).values({
          id:randomUUID(),schoolId,createdBy,attendanceId:input.attendanceId,
          studentId:input.studentId,originalStatus:current.entry.status,
          requestedStatus:input.requestedStatus,expectedUpdatedAt:current.entry.updatedAt,
          reason:input.reason
        }).returning();
        if(!row)throw Error("Could not create attendance correction request.");
        return row;
      }catch(error){
        if(isUniqueConstraintViolation(error))throw conflict("A pending correction already exists.");
        throw error;
      }
    },
    async decide(schoolId,id,adminId,input){
      return db.transaction(async tx=>{
        const [request]=await tx.update(staffAttendanceCorrectionRequests).set({
          status:input.action==="APPROVE"?"APPROVED":"REJECTED",
          reviewedBy:adminId,reviewNote:input.note,decidedAt:new Date()
        }).where(and(eq(staffAttendanceCorrectionRequests.id,id),
          eq(staffAttendanceCorrectionRequests.schoolId,schoolId),
          eq(staffAttendanceCorrectionRequests.status,"PENDING"))).returning();
        if(!request)throw conflict("Request is no longer pending.");
        if(input.action==="APPROVE"){
          const current=await mark(schoolId,request.attendanceId,request.studentId,
            tx as unknown as Pick<FoundationDatabase,"select">);
          if(current.entry.updatedAt.getTime()!==request.expectedUpdatedAt.getTime() ||
             current.entry.status!==request.originalStatus)
            throw conflict("Attendance has changed. Reject this request and request a new correction.");
          const [entry]=await tx.update(studentAttendances).set({
            status:request.requestedStatus,
            updatedAt:new Date(Math.max(Date.now(),current.entry.updatedAt.getTime()+1))
          }).where(and(eq(studentAttendances.id,current.entry.id),
            eq(studentAttendances.schoolId,schoolId),
            eq(studentAttendances.updatedAt,current.entry.updatedAt))).returning();
          if(!entry)throw conflict("Attendance changed during review.");
          const [attendance]=await tx.update(dailyAttendances).set({
            status:"CORRECTED",updatedBy:adminId,updatedAt:new Date()
          }).where(and(eq(dailyAttendances.id,request.attendanceId),
            eq(dailyAttendances.schoolId,schoolId))).returning();
          if(!attendance)throw conflict("Daily register not found.");
          await syncStaffCorrectionAlert(tx,schoolId,attendance,current.student,entry.status);
          await tx.insert(auditLogs).values({
            id:randomUUID(),schoolId,actorUserId:adminId,
            action:"attendance.corrected_by_admin",entityType:"daily_attendance",
            entityId:attendance.id,metadata:{requestId:request.id,requestedBy:request.createdBy,
              studentId:request.studentId,previousStatus:current.entry.status,
              status:entry.status,reason:request.reason,originalNote:current.entry.note,
              previousUpdatedAt:current.entry.updatedAt.toISOString(),
              updatedAt:entry.updatedAt.toISOString()}
          });
        }else{
          await tx.insert(auditLogs).values({id:randomUUID(),schoolId,actorUserId:adminId,
            action:"attendance.staff_correction_rejected",entityType:"daily_attendance",
            entityId:request.attendanceId,
            metadata:{requestId:request.id,studentId:request.studentId}});
        }
        return request;
      });
    }
  };
}
