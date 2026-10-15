import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import { academicYears, classSections, dailyAttendances, studentAttendances, students } from "./schema.js";
import { AttendanceHistoryNotFoundError } from "./attendance-history-store.js";
import { AttendanceCalendarValidationError, validCalendarDay } from "./attendance-monitoring-store.js";

export type AttendanceAnalyticsFilters = {
  academicYearId: string;
  from: string; to: string; classId?: string;
};
export type AttendanceAnalyticsCounts = {
  present:number; absent:number; late:number; excused:number;
  recorded:number; rate:number|null;
};
export type AttendanceAnalyticsClass = AttendanceAnalyticsCounts & {
  classId:string; className:string; classCode:string; submittedRegisters:number;
};
export type AttendanceAnalyticsDay = AttendanceAnalyticsCounts & {
  date:string; submittedRegisters:number;
};
export type AttendanceAnalyticsStudent = AttendanceAnalyticsCounts & {
  studentId:string; studentName:string; studentCode:string;
  classId:string; className:string; classCode:string;
};
export type AttendanceAnalyticsResponse = {
  academicYearId:string; from:string; to:string;
  summary: AttendanceAnalyticsCounts & { submittedRegisters:number; daysWithRegisters:number };
  classes:AttendanceAnalyticsClass[]; days:AttendanceAnalyticsDay[];
};
export interface AttendanceAnalyticsStore {
  getAdminAttendanceAnalytics(schoolId:string, filters:AttendanceAnalyticsFilters):
    Promise<AttendanceAnalyticsResponse>;
  getAdminAttendanceAnalyticsStudents(schoolId:string,filters:AttendanceAnalyticsFilters,
    limit:number,offset:number):Promise<{
      total:number;limit:number;offset:number;rows:AttendanceAnalyticsStudent[];
    }>;
}

/** Attendances are based on submitted marks; Excused is excluded from the rate. */
export function attendanceAnalyticsRate(present:number,late:number,absent:number):number|null {
  const denominator=present+late+absent;
  return denominator>0?Math.round(((present+late)/denominator)*1000)/10:null;
}
type Four = {present:number;absent:number;late:number;excused:number};
function totals(row:Four):AttendanceAnalyticsCounts {
  const present=Number(row.present),absent=Number(row.absent);
  const late=Number(row.late),excused=Number(row.excused);
  return {present,absent,late,excused,recorded:present+absent+late+excused,
    rate:attendanceAnalyticsRate(present,late,absent)};
}
const counts = {
  present: sql<number>`cast(sum(case when ${studentAttendances.status} = 'PRESENT' then 1 else 0 end) as integer)`,
  absent: sql<number>`cast(sum(case when ${studentAttendances.status} = 'ABSENT' then 1 else 0 end) as integer)`,
  late: sql<number>`cast(sum(case when ${studentAttendances.status} = 'LATE' then 1 else 0 end) as integer)`,
  excused: sql<number>`cast(sum(case when ${studentAttendances.status} = 'EXCUSED' then 1 else 0 end) as integer)`
};
export function createAttendanceAnalyticsStore(db:FoundationDatabase):AttendanceAnalyticsStore {
  async function validateScope(schoolId:string, filters:AttendanceAnalyticsFilters){
    if(!validCalendarDay(filters.from)||!validCalendarDay(filters.to)||filters.from>filters.to)
      throw new AttendanceCalendarValidationError("Choose valid report dates in chronological order.");
    const length=(Date.parse(filters.to+"T12:00:00Z")-Date.parse(filters.from+"T12:00:00Z"))/86400000;
    if(length>61)throw new AttendanceCalendarValidationError("Reports are limited to 62 calendar days.");
    const [year]=await db.select({id:academicYears.id}).from(academicYears)
      .where(and(eq(academicYears.id,filters.academicYearId),eq(academicYears.schoolId,schoolId))).limit(1);
    if(!year)throw new AttendanceHistoryNotFoundError("Academic year not found.");
    if(filters.classId){
      const [klass]=await db.select({id:classSections.id}).from(classSections).where(and(
        eq(classSections.id,filters.classId),eq(classSections.schoolId,schoolId),
        eq(classSections.academicYearId,filters.academicYearId))).limit(1);
      if(!klass)throw new AttendanceHistoryNotFoundError("Class not found in this academic year.");
    }
  }
  function markFilters(schoolId:string, filters:AttendanceAnalyticsFilters){
    return and(eq(studentAttendances.schoolId,schoolId),
      eq(dailyAttendances.schoolId,schoolId),
      eq(dailyAttendances.academicYearId,filters.academicYearId),
      gte(dailyAttendances.date,filters.from),lte(dailyAttendances.date,filters.to),
      ...(filters.classId?[eq(dailyAttendances.classId,filters.classId)]:[]));
  }
  function registerFilters(schoolId:string,filters:AttendanceAnalyticsFilters){
    return and(eq(dailyAttendances.schoolId,schoolId),
      eq(dailyAttendances.academicYearId,filters.academicYearId),
      gte(dailyAttendances.date,filters.from),lte(dailyAttendances.date,filters.to),
      ...(filters.classId?[eq(dailyAttendances.classId,filters.classId)]:[]));
  }
  function marks(){
    return db.select({
      date:dailyAttendances.date,classId:classSections.id,
      className:classSections.name,classCode:classSections.code,...counts
    }).from(studentAttendances).innerJoin(dailyAttendances,and(
      eq(dailyAttendances.id,studentAttendances.attendanceId),
      eq(dailyAttendances.schoolId,studentAttendances.schoolId)))
      .innerJoin(classSections,and(
        eq(classSections.id,dailyAttendances.classId),
        eq(classSections.schoolId,dailyAttendances.schoolId),
        eq(classSections.academicYearId,dailyAttendances.academicYearId)));
  }
  function groupedStudents(schoolId:string,filters:AttendanceAnalyticsFilters){
    return db.select({
      studentId:students.id,studentName:students.fullName,studentCode:students.studentCode,
      classId:classSections.id,className:classSections.name,classCode:classSections.code,
      ...counts
    }).from(studentAttendances)
      .innerJoin(dailyAttendances,and(
        eq(dailyAttendances.id,studentAttendances.attendanceId),
        eq(dailyAttendances.schoolId,studentAttendances.schoolId)))
      .innerJoin(students,and(
        eq(students.id,studentAttendances.studentId),
        eq(students.schoolId,studentAttendances.schoolId)))
      .innerJoin(classSections,and(
        eq(classSections.id,dailyAttendances.classId),
        eq(classSections.schoolId,dailyAttendances.schoolId),
        eq(classSections.academicYearId,dailyAttendances.academicYearId)))
      .where(markFilters(schoolId,filters))
      .groupBy(students.id,students.fullName,students.studentCode,
        classSections.id,classSections.name,classSections.code);
  }
  return {
    async getAdminAttendanceAnalytics(schoolId,filters){
      await validateScope(schoolId,filters);
      const [schoolClasses,classMarks,dayMarks,registers]=await Promise.all([
        db.select({id:classSections.id,name:classSections.name,code:classSections.code})
          .from(classSections).where(and(eq(classSections.schoolId,schoolId),
            eq(classSections.academicYearId,filters.academicYearId),
            ...(filters.classId?[eq(classSections.id,filters.classId)]:[])))
          .orderBy(asc(classSections.name),asc(classSections.code)),
        marks().where(markFilters(schoolId,filters))
          .groupBy(classSections.id,classSections.name,classSections.code,dailyAttendances.date)
          .orderBy(asc(dailyAttendances.date)),
        marks().where(markFilters(schoolId,filters))
          .groupBy(dailyAttendances.date,classSections.id,classSections.name,classSections.code)
          .orderBy(asc(dailyAttendances.date)),
        db.select({date:dailyAttendances.date,classId:dailyAttendances.classId,
          total:count()}).from(dailyAttendances).where(registerFilters(schoolId,filters))
          .groupBy(dailyAttendances.date,dailyAttendances.classId)
      ]);
      // Each group is one class/day. Never count missing/unsubmitted marks as
      // absences. Registers with zero student marks are still recorded registers.
      const classMap=new Map(schoolClasses.map(item=>[item.id,{
        classId:item.id,className:item.name,classCode:item.code,
        present:0,absent:0,late:0,excused:0,recorded:0,rate:null as number|null,
        submittedRegisters:0
      }]));
      const dateMap=new Map<string,AttendanceAnalyticsDay>();
      for(const r of registers){
        const klass=classMap.get(r.classId);if(klass)klass.submittedRegisters+=Number(r.total);
        const day=dateMap.get(r.date)??{
          date:r.date,present:0,absent:0,late:0,excused:0,recorded:0,rate:null,submittedRegisters:0
        };
        day.submittedRegisters+=Number(r.total);
        dateMap.set(r.date,day);
      }
      // Per-class/day groups ensure moved students are attributed to the
      // *register's class*, not their current class enrollment.
      for(const r of classMarks){
        const klass=classMap.get(r.classId);if(!klass)continue;
        const c=totals(r);klass.present+=c.present;klass.absent+=c.absent;
        klass.late+=c.late;klass.excused+=c.excused;klass.recorded+=c.recorded;
      }
      for(const r of dayMarks){
        const day=dateMap.get(r.date)??{
          date:r.date,present:0,absent:0,late:0,excused:0,recorded:0,rate:null,submittedRegisters:0
        };
        const c=totals(r);day.present+=c.present;day.absent+=c.absent;
        day.late+=c.late;day.excused+=c.excused;day.recorded+=c.recorded;
        dateMap.set(r.date,day);
      }
      const classes=[...classMap.values()].map(c=>({
        ...c,rate:attendanceAnalyticsRate(c.present,c.late,c.absent)
      }));
      const days=[...dateMap.values()].map(d=>({
        ...d,rate:attendanceAnalyticsRate(d.present,d.late,d.absent)
      })).sort((a,b)=>a.date.localeCompare(b.date));
      const summary=classes.reduce((sum,c)=>({
        ...sum,present:sum.present+c.present,absent:sum.absent+c.absent,
        late:sum.late+c.late,excused:sum.excused+c.excused,
        recorded:sum.recorded+c.recorded,
        submittedRegisters:sum.submittedRegisters+c.submittedRegisters
      }),{present:0,absent:0,late:0,excused:0,recorded:0,rate:null as number|null,
        submittedRegisters:0,daysWithRegisters:days.length});
      summary.rate=attendanceAnalyticsRate(summary.present,summary.late,summary.absent);
      return {academicYearId:filters.academicYearId,from:filters.from,to:filters.to,
        summary,classes,days};
    },
    async getAdminAttendanceAnalyticsStudents(schoolId,filters,limit,offset){
      await validateScope(schoolId,filters);
      if(!Number.isInteger(limit)||limit<1||limit>2001||
         !Number.isInteger(offset)||offset<0||offset>100000)
        throw new AttendanceCalendarValidationError("Invalid analytics pagination.");
      const grouped=groupedStudents(schoolId,filters).as("student_attendance_totals");
      const [countRows,rows]=await Promise.all([
        db.select({total:count()}).from(grouped),
        db.select().from(grouped)
          .orderBy(desc(grouped.absent),desc(grouped.late),asc(grouped.studentName),
            asc(grouped.studentId),asc(grouped.classId)).limit(limit).offset(offset)
      ]);
      return {total:Number(countRows[0]?.total??0),limit,offset,
        rows:rows.map(r=>({
          studentId:r.studentId,studentName:r.studentName,studentCode:r.studentCode,
          classId:r.classId,className:r.className,classCode:r.classCode,
          ...totals(r)
        }))};
    }
  };
}
