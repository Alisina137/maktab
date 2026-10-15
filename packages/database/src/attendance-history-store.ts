import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears, attendanceClosures, classSections, dailyAttendances,
  negaranAssignments, studentAttendances, students, teacherProfiles, users
} from "./schema.js";
import { AttendanceCalendarValidationError, validCalendarDay } from "./attendance-monitoring-store.js";
import type { AttendanceStatus } from "@maktablink/contracts";

export class AttendanceHistoryNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "AttendanceHistoryNotFoundError"; }
}
export type AdminAttendanceStudentRow = {
  studentId: string; studentName: string; studentCode: string;
  classId: string; className: string; classCode: string; status: "ACTIVE" | "WITHDRAWN";
  present: number; absent: number; late: number; excused: number; recorded: number;
};
export type AdminAttendanceDirectory = {
  academicYearId: string; total: number; limit: number; offset: number;
  rows: AdminAttendanceStudentRow[];
};
export type AdminAttendanceStudentHistory = {
  academicYearId: string; student: {
    id: string; name: string; code: string; classId: string;
    className: string; classCode: string; enrollmentStatus: "ACTIVE" | "WITHDRAWN";
  };
  from: string; to: string; today: string;
  summary: { present: number; absent: number; late: number; excused: number; recorded: number; rate: number | null };
  days: Array<{
    date: string; status: AttendanceStatus; note: string | null;
    classId: string; className: string; submittedAt: string; updatedAt: string;
  }>;
  closures: Array<{ date: string; reason: string }>;
};
export type AdminAttendanceClassRegister = {
  date: string; today: string; academicYearId: string;
  classSection: { id: string; name: string; code: string };
  record: { id: string; status: "SUBMITTED" | "CORRECTED"; submittedAt: string } | null;
  negaranName: string | null;
  students: Array<{
    id: string; name: string; code: string; enrollmentStatus: "ACTIVE" | "WITHDRAWN";
    status: AttendanceStatus | null; note: string | null; updatedAt: string | null;
  }>;
};

export interface AttendanceHistoryStore {
  getAdminStudentAttendanceDirectory(schoolId: string, options: {
    academicYearId: string; classId?: string; search?: string; limit: number; offset: number;
  }): Promise<AdminAttendanceDirectory>;
  getAdminStudentAttendanceHistory(schoolId: string, options: {
    academicYearId: string; studentId: string; from: string; to: string;
  }): Promise<AdminAttendanceStudentHistory>;
  getAdminClassAttendanceRegister(schoolId: string, options: {
    academicYearId: string; classId: string; date: string;
  }): Promise<AdminAttendanceClassRegister>;
}

function percent(present: number, late: number, absent: number) {
  const eligible=present+late+absent;
  return eligible ? Math.round(((present+late)/eligible)*1000)/10 : null;
}
function safeRange(from:string,to:string,maxDays:number) {
  if(!validCalendarDay(from)||!validCalendarDay(to)||from>to)
    throw new AttendanceCalendarValidationError("Provide a valid attendance date range.");
  const days=Math.round((Date.parse(to+"T12:00:00Z")-Date.parse(from+"T12:00:00Z"))/86_400_000)+1;
  if(days>maxDays)throw new AttendanceCalendarValidationError(`Select at most ${maxDays} days at a time.`);
}
export function createAttendanceHistoryStore(
  db: FoundationDatabase,
  schoolToday: (schoolId:string)=>Promise<string>
): AttendanceHistoryStore {
  async function ensureYear(schoolId:string,yearId:string) {
    const [year]=await db.select({id:academicYears.id}).from(academicYears).where(and(
      eq(academicYears.schoolId,schoolId),eq(academicYears.id,yearId))).limit(1);
    if(!year)throw new AttendanceHistoryNotFoundError("Academic year not found.");
  }
  async function ensureClass(schoolId:string,yearId:string,classId:string) {
    const [classSection]=await db.select({id:classSections.id,name:classSections.name,code:classSections.code})
      .from(classSections).where(and(eq(classSections.schoolId,schoolId),
        eq(classSections.academicYearId,yearId),eq(classSections.id,classId))).limit(1);
    if(!classSection)throw new AttendanceHistoryNotFoundError("Class not found in the selected academic year.");
    return classSection;
  }

  return {
    async getAdminStudentAttendanceDirectory(schoolId,{academicYearId,classId,search,limit,offset}) {
      await ensureYear(schoolId,academicYearId);
      if(classId)await ensureClass(schoolId,academicYearId,classId);
      if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(offset)||offset<0)
        throw new AttendanceCalendarValidationError("Invalid directory pagination.");
      const cleaned=(search??"").trim();
      if(cleaned.length>100)throw new AttendanceCalendarValidationError("Search must be at most 100 characters.");
      const escaped=cleaned.replace(/[\\%_]/g,match=>"\\"+match);
      const conditions=[
        eq(students.schoolId,schoolId),eq(students.academicYearId,academicYearId),
        ...(classId?[eq(students.classId,classId)]:[]),
        ...(cleaned?[or(ilike(students.fullName,`%${escaped}%`),
          ilike(students.studentCode,`%${escaped}%`))!]:[])
      ];
      const countFor=(state: AttendanceStatus) => sql<number>`(
        SELECT cast(count(*) as integer)
        FROM student_attendances sa JOIN daily_attendances da
          ON da.id = sa.attendance_id AND da.school_id = sa.school_id
        WHERE sa.school_id = ${schoolId} AND sa.student_id = ${students.id}
          AND da.academic_year_id = ${academicYearId} AND sa.status = ${state}
      )`;
      const [totalRows,rows]=await Promise.all([
        db.select({total:count()}).from(students).where(and(...conditions)),
        db.select({
          studentId:students.id,studentName:students.fullName,studentCode:students.studentCode,
          classId:classSections.id,className:classSections.name,classCode:classSections.code,
          status:students.status,
          present:countFor("PRESENT"),absent:countFor("ABSENT"),
          late:countFor("LATE"),excused:countFor("EXCUSED")
        }).from(students).innerJoin(classSections,and(
          eq(classSections.id,students.classId),eq(classSections.schoolId,students.schoolId),
          eq(classSections.academicYearId,students.academicYearId)))
          .where(and(...conditions)).orderBy(asc(students.fullName),asc(students.id))
          .limit(limit).offset(offset)
      ]);
      return {academicYearId,total:totalRows[0]?.total??0,limit,offset,
        rows:rows.map(item=>({...item,recorded:item.present+item.absent+item.late+item.excused}))};
    },

    async getAdminStudentAttendanceHistory(schoolId,{academicYearId,studentId,from,to}) {
      safeRange(from,to,62);
      await ensureYear(schoolId,academicYearId);
      const [student]=await db.select({
        id:students.id,name:students.fullName,code:students.studentCode,
        classId:students.classId,className:classSections.name,classCode:classSections.code,
        enrollmentStatus:students.status
      }).from(students).innerJoin(classSections,and(eq(classSections.id,students.classId),
        eq(classSections.schoolId,students.schoolId),
        eq(classSections.academicYearId,students.academicYearId)))
        .where(and(eq(students.schoolId,schoolId),eq(students.academicYearId,academicYearId),
          eq(students.id,studentId))).limit(1);
      if(!student)throw new AttendanceHistoryNotFoundError("Student not found in this academic year.");
      const [records,closures,today]=await Promise.all([
        db.select({
          date:dailyAttendances.date,status:studentAttendances.status,
          note:studentAttendances.note,classId:dailyAttendances.classId,
          className:classSections.name,submittedAt:dailyAttendances.submittedAt,
          updatedAt:studentAttendances.updatedAt
        }).from(studentAttendances)
          .innerJoin(dailyAttendances,and(eq(dailyAttendances.id,studentAttendances.attendanceId),
            eq(dailyAttendances.schoolId,studentAttendances.schoolId),
            eq(dailyAttendances.academicYearId,academicYearId)))
          .innerJoin(classSections,and(eq(classSections.id,dailyAttendances.classId),
            eq(classSections.schoolId,dailyAttendances.schoolId),
            eq(classSections.academicYearId,academicYearId)))
          .where(and(eq(studentAttendances.schoolId,schoolId),
            eq(studentAttendances.studentId,studentId),
            gte(dailyAttendances.date,from),lte(dailyAttendances.date,to)))
          .orderBy(desc(dailyAttendances.date)),
        db.select({date:attendanceClosures.date,reason:attendanceClosures.reason})
          .from(attendanceClosures).where(and(eq(attendanceClosures.schoolId,schoolId),
            eq(attendanceClosures.academicYearId,academicYearId),
            gte(attendanceClosures.date,from),lte(attendanceClosures.date,to)))
          .orderBy(asc(attendanceClosures.date)),
        schoolToday(schoolId)
      ]);
      const summary={present:0,absent:0,late:0,excused:0,recorded:records.length,rate:null as number|null};
      for(const record of records) {
        if(record.status==="PRESENT")summary.present++;
        else if(record.status==="ABSENT")summary.absent++;
        else if(record.status==="LATE")summary.late++;
        else if(record.status==="EXCUSED")summary.excused++;
      }
      summary.rate=percent(summary.present,summary.late,summary.absent);
      return {academicYearId,student,from,to,today,summary,
        closures,
        days:records.map(row=>({...row,
          submittedAt:row.submittedAt.toISOString(),updatedAt:row.updatedAt.toISOString()}))};
    },

    async getAdminClassAttendanceRegister(schoolId,{academicYearId,classId,date}) {
      if(!validCalendarDay(date))throw new AttendanceCalendarValidationError("Choose a real calendar date.");
      await ensureYear(schoolId,academicYearId);
      const classSection=await ensureClass(schoolId,academicYearId,classId);
      const [record]=await db.select({
        id:dailyAttendances.id,status:dailyAttendances.status,submittedAt:dailyAttendances.submittedAt
      }).from(dailyAttendances).where(and(eq(dailyAttendances.schoolId,schoolId),
        eq(dailyAttendances.academicYearId,academicYearId),
        eq(dailyAttendances.classId,classId),eq(dailyAttendances.date,date))).limit(1);
      const [roster,marked,assignments,today]=await Promise.all([
        db.select({id:students.id,name:students.fullName,code:students.studentCode,
          enrollmentStatus:students.status}).from(students).where(and(
          eq(students.schoolId,schoolId),eq(students.academicYearId,academicYearId),
          eq(students.classId,classId))).orderBy(asc(students.fullName)),
        record?db.select({id:students.id,name:students.fullName,code:students.studentCode,
          enrollmentStatus:students.status,status:studentAttendances.status,
          note:studentAttendances.note,updatedAt:studentAttendances.updatedAt})
          .from(studentAttendances).innerJoin(students,and(eq(students.id,studentAttendances.studentId),
            eq(students.schoolId,studentAttendances.schoolId)))
          .where(and(eq(studentAttendances.schoolId,schoolId),
            eq(studentAttendances.attendanceId,record.id))):Promise.resolve([]),
        db.select({name:teacherProfiles.fullName}).from(negaranAssignments)
          .innerJoin(teacherProfiles,and(eq(teacherProfiles.userId,negaranAssignments.teacherUserId),
            eq(teacherProfiles.schoolId,negaranAssignments.schoolId)))
          .innerJoin(users,and(eq(users.id,negaranAssignments.teacherUserId),
            eq(users.schoolId,negaranAssignments.schoolId),eq(users.status,"ACTIVE")))
          .where(and(eq(negaranAssignments.schoolId,schoolId),
            eq(negaranAssignments.academicYearId,academicYearId),
            eq(negaranAssignments.classId,classId),
            lte(negaranAssignments.startDate,date),
            or(sql`${negaranAssignments.endDate} is null`,gte(negaranAssignments.endDate,date)))),
        schoolToday(schoolId)
      ]);
      const byId=new Map(marked.map(item=>[item.id,item]));
      // Include historical marks for students who have since moved classes,
      // and current enrollment without inventing Present/Absent states.
      const combined=new Map<string,AdminAttendanceClassRegister["students"][number]>();
      for(const item of roster)combined.set(item.id,{
        id:item.id,name:item.name,code:item.code,enrollmentStatus:item.enrollmentStatus,
        status:null,note:null,updatedAt:null
      });
      for(const item of marked)combined.set(item.id,{
        id:item.id,name:item.name,code:item.code,enrollmentStatus:item.enrollmentStatus,
        status:item.status,note:item.note,updatedAt:item.updatedAt.toISOString()
      });
      void byId;
      return {
        date,today,academicYearId,classSection,
        record:record?{...record,submittedAt:record.submittedAt.toISOString()}:null,
        negaranName:assignments.length===1?assignments[0]!.name:null,
        students:[...combined.values()].sort((a,b)=>a.name.localeCompare(b.name))
      };
    }
  };
}
