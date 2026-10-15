import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears, attendanceClosures, auditLogs, classSections, dailyAttendances,
  negaranAssignments, studentAttendances, students, teacherProfiles, timetablePeriods, users
} from "./schema.js";
import {
  classifyAttendanceDay, type AttendanceClosure, type AttendanceMonitoringResponse
} from "./attendance-monitoring-model.js";

export interface AttendanceMonitoringStore {
  getAdminDailyMonitoring(schoolId: string, academicYearId: string, date: string, classId?: string):
    Promise<AttendanceMonitoringResponse>;
  getAdminAttendanceClosures(schoolId: string, academicYearId: string): Promise<AttendanceClosure[]>;
  addAdminAttendanceClosure(schoolId: string, actorId: string, input: {
    academicYearId: string; date: string; reason: string;
  }): Promise<AttendanceClosure>;
  removeAdminAttendanceClosure(schoolId: string, actorId: string, closureId: string):
    Promise<boolean>;
}

export class AttendanceCalendarValidationError extends Error {
  constructor(message: string) { super(message); this.name = "AttendanceCalendarValidationError"; }
}
export class AttendanceCalendarConflictError extends Error {
  constructor(message: string) { super(message); this.name = "AttendanceCalendarConflictError"; }
}

const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"] as const;

export function validCalendarDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(day+"T12:00:00Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0,10) === day;
}

export function createAttendanceMonitoringStore(
  db: FoundationDatabase,
  schoolToday: (schoolId: string) => Promise<string>
): AttendanceMonitoringStore {
  async function yearForSchool(schoolId: string, academicYearId: string) {
    const [year] = await db.select().from(academicYears)
      .where(and(eq(academicYears.schoolId,schoolId),eq(academicYears.id,academicYearId))).limit(1);
    if (!year) throw new AttendanceCalendarValidationError("Academic year does not belong to this school.");
    return year;
  }

  return {
    async getAdminDailyMonitoring(schoolId, academicYearId, date, classId) {
      if (!validCalendarDay(date)) throw new AttendanceCalendarValidationError("Choose a real calendar date.");
      const year = await yearForSchool(schoolId, academicYearId);
      const today = await schoolToday(schoolId);
      const weekday = days[new Date(date+"T12:00:00Z").getUTCDay()]!;
      const [classes, closureRows, timetable, negaran, roster, attendances, marks] = await Promise.all([
        db.select({ id: classSections.id, name: classSections.name, code: classSections.code })
          .from(classSections).where(and(
            eq(classSections.schoolId,schoolId),eq(classSections.academicYearId,academicYearId),
            ...(classId ? [eq(classSections.id,classId)] : [])
          )).orderBy(asc(classSections.name),asc(classSections.code)),
        db.select({id:attendanceClosures.id,reason:attendanceClosures.reason})
          .from(attendanceClosures).where(and(
            eq(attendanceClosures.schoolId,schoolId),eq(attendanceClosures.academicYearId,academicYearId),
            eq(attendanceClosures.date,date))).limit(1),
        db.select({classId:timetablePeriods.classId}).from(timetablePeriods)
          .where(and(eq(timetablePeriods.schoolId,schoolId),
            eq(timetablePeriods.academicYearId,academicYearId),eq(timetablePeriods.weekday,weekday))),
        db.select({classId:negaranAssignments.classId,teacherName:teacherProfiles.fullName})
          .from(negaranAssignments)
          .innerJoin(teacherProfiles,and(eq(teacherProfiles.schoolId,negaranAssignments.schoolId),
            eq(teacherProfiles.userId,negaranAssignments.teacherUserId)))
          .innerJoin(users,and(eq(users.id,negaranAssignments.teacherUserId),
            eq(users.schoolId,negaranAssignments.schoolId),eq(users.status,"ACTIVE")))
          .where(and(eq(negaranAssignments.schoolId,schoolId),
            eq(negaranAssignments.academicYearId,academicYearId),
            lte(negaranAssignments.startDate,date),
            or(isNull(negaranAssignments.endDate),gte(negaranAssignments.endDate,date)))),
        db.select({classId:students.classId,n:sql<number>`cast(count(*) as integer)`})
          .from(students).where(and(eq(students.schoolId,schoolId),
            eq(students.academicYearId,academicYearId),eq(students.status,"ACTIVE")))
          .groupBy(students.classId),
        db.select({id:dailyAttendances.id,classId:dailyAttendances.classId,
          status:dailyAttendances.status,submittedAt:dailyAttendances.submittedAt})
          .from(dailyAttendances).where(and(eq(dailyAttendances.schoolId,schoolId),
            eq(dailyAttendances.academicYearId,academicYearId),eq(dailyAttendances.date,date))),
        db.select({classId:dailyAttendances.classId,status:studentAttendances.status})
          .from(dailyAttendances)
          .innerJoin(studentAttendances,and(eq(studentAttendances.attendanceId,dailyAttendances.id),
            eq(studentAttendances.schoolId,dailyAttendances.schoolId)))
          .where(and(eq(dailyAttendances.schoolId,schoolId),
            eq(dailyAttendances.academicYearId,academicYearId),eq(dailyAttendances.date,date)))
      ]);
      const scheduled = new Set(timetable.map(row=>row.classId));
      const rosterByClass = new Map(roster.map(row=>[row.classId,row.n]));
      const negaranByClass = new Map<string,string[]>();
      for(const item of negaran) {
        const names=negaranByClass.get(item.classId)??[];
        names.push(item.teacherName);
        negaranByClass.set(item.classId,names);
      }
      const submittedByClass = new Map(attendances.map(row=>[row.classId,row]));
      const marksByClass = new Map<string,{present:number;absent:number;late:number;excused:number}>();
      for(const item of marks) {
        let counts = marksByClass.get(item.classId);
        if (!counts) { counts={present:0,absent:0,late:0,excused:0}; marksByClass.set(item.classId,counts); }
        if (item.status === "PRESENT") counts.present++;
        else if (item.status === "ABSENT") counts.absent++;
        else if (item.status === "LATE") counts.late++;
        else if (item.status === "EXCUSED") counts.excused++;
      }
      const closure=closureRows[0]??null;
      const summary={
        totalClasses:classes.length,scheduledClasses:0,expectedClasses:0,
        submittedExpected:0,pendingClasses:0,configurationIssues:0,submittedTotal:0,
        present:0,absent:0,late:0,excused:0
      };
      const results=classes.map(row=>{
        const existing=submittedByClass.get(row.id);
        const teachers=negaranByClass.get(row.id)??[];
        const hasTimetable=scheduled.has(row.id);
        const {state,expected}=classifyAttendanceDay({
          date,today,yearStart:year.startDate,yearEnd:year.endDate,
          closed:!!closure,hasTimetable,activeStudents:rosterByClass.get(row.id)??0,
          negaranCount:teachers.length,submitted:!!existing
        });
        const counts=marksByClass.get(row.id)??{present:0,absent:0,late:0,excused:0};
        if(hasTimetable)summary.scheduledClasses++;
        if(expected){summary.expectedClasses++;if(existing)summary.submittedExpected++;else summary.pendingClasses++;}
        if(state==="NO_NEGARAN"||state==="MULTIPLE_NEGARAN"||state==="NO_STUDENTS")
          summary.configurationIssues++;
        if(existing)summary.submittedTotal++;
        summary.present+=counts.present;summary.absent+=counts.absent;
        summary.late+=counts.late;summary.excused+=counts.excused;
        return {
          classId:row.id,className:row.name,classCode:row.code,date,scheduled:hasTimetable,
          activeStudents:rosterByClass.get(row.id)??0,
          negaranName:teachers.length===1?teachers[0]!:null,
          negaranCount:teachers.length,submittedAt:existing?.submittedAt.toISOString()??null,
          recordStatus:existing?.status??null,state,expected,...counts
        };
      });
      return {
        date,today,weekday,academicYearId,yearStatus:year.status,
        closure:closure?{id:closure.id,reason:closure.reason}:null,
        summary,classes:results
      };
    },
    async getAdminAttendanceClosures(schoolId, academicYearId) {
      await yearForSchool(schoolId,academicYearId);
      return db.select({id:attendanceClosures.id,academicYearId:attendanceClosures.academicYearId,
        date:attendanceClosures.date,reason:attendanceClosures.reason})
        .from(attendanceClosures).where(and(eq(attendanceClosures.schoolId,schoolId),
          eq(attendanceClosures.academicYearId,academicYearId))).orderBy(asc(attendanceClosures.date));
    },
    async addAdminAttendanceClosure(schoolId,actorId,input) {
      if(!validCalendarDay(input.date)||!input.reason.trim()||input.reason.trim().length>160)
        throw new AttendanceCalendarValidationError("Provide a real date and a closure reason (1–160 characters).");
      const year=await yearForSchool(schoolId,input.academicYearId);
      if(year.status!=="DRAFT"&&year.status!=="ACTIVE")
        throw new AttendanceCalendarConflictError("Closed or archived academic years cannot be changed.");
      if(input.date<year.startDate||input.date>year.endDate)
        throw new AttendanceCalendarValidationError("Closure date must fall within the academic year.");
      return db.transaction(async tx=>{
        const [existing]=await tx.select({id:attendanceClosures.id})
          .from(attendanceClosures).where(and(eq(attendanceClosures.schoolId,schoolId),
          eq(attendanceClosures.academicYearId,input.academicYearId),
          eq(attendanceClosures.date,input.date))).limit(1);
        if(existing) throw new AttendanceCalendarConflictError("A closure is already recorded for this day.");
        const [submitted]=await tx.select({id:dailyAttendances.id}).from(dailyAttendances)
          .where(and(eq(dailyAttendances.schoolId,schoolId),
            eq(dailyAttendances.academicYearId,input.academicYearId),
            eq(dailyAttendances.date,input.date))).limit(1);
        if(submitted)throw new AttendanceCalendarConflictError("Cannot close a day with submitted attendance.");
        const [closure]=await tx.insert(attendanceClosures).values({
          id:randomUUID(),schoolId,academicYearId:input.academicYearId,
          date:input.date,reason:input.reason.trim()
        }).onConflictDoNothing().returning();
        if(!closure)throw new AttendanceCalendarConflictError("A closure is already recorded for this day.");
        await tx.insert(auditLogs).values({id:randomUUID(),schoolId,actorUserId:actorId,
          action:"attendance.calendar_closed",entityType:"attendance_closure",
          entityId:closure.id,metadata:{academicYearId:input.academicYearId,date:input.date}});
        return {id:closure.id,academicYearId:closure.academicYearId,date:closure.date,reason:closure.reason};
      });
    },
    async removeAdminAttendanceClosure(schoolId,actorId,closureId) {
      return db.transaction(async tx=>{
        const [closure]=await tx.select().from(attendanceClosures)
          .where(and(eq(attendanceClosures.schoolId,schoolId),
            eq(attendanceClosures.id,closureId))).limit(1);
        if(!closure)return false;
        const [year]=await tx.select({status:academicYears.status})
          .from(academicYears).where(and(eq(academicYears.schoolId,schoolId),
            eq(academicYears.id,closure.academicYearId))).limit(1);
        if(!year||!(year.status==="DRAFT"||year.status==="ACTIVE"))
          throw new AttendanceCalendarConflictError("Closed or archived academic years cannot be changed.");
        await tx.delete(attendanceClosures)
          .where(and(eq(attendanceClosures.schoolId,schoolId),eq(attendanceClosures.id,closureId)));
        await tx.insert(auditLogs).values({id:randomUUID(),schoolId,actorUserId:actorId,
          action:"attendance.calendar_reopened",entityType:"attendance_closure",
          entityId:closure.id,metadata:{academicYearId:closure.academicYearId,date:closure.date}});
        return true;
      });
    }
  };
}
