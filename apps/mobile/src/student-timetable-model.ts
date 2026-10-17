import { localizeDigits, type SupportedLocale } from "@maktablink/localization";
import type { StudentTimetablePayload } from "./api";
import { studentSchoolClock, type StudentPeriod } from "./student-home-model";

export type StudentTimetableView = "TODAY" | "WEEK" | "TEACHERS";
export type StudentSchoolWeekday = StudentPeriod["period"]["weekday"];
export type StudentTimetablePeriodState = "CURRENT" | "UPCOMING" | "FINISHED";
export interface StudentTeacherDirectoryEntry {
  teacherUserId:string;
  teacherName:string;
  subjects:Array<{subjectId:string;subjectName:string;subjectCode:string}>;
  weeklyPeriods:number;
}

export const studentSchoolWeekdays = (locale:SupportedLocale):StudentSchoolWeekday[] =>
  locale==="en"
    ? ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","SATURDAY","SUNDAY"]
    : ["SATURDAY","SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY"];

export function studentClassMinutes(value:string):number|null {
  const match=/^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if(!match)return null;
  const hours=Number(match[1]),minutes=Number(match[2]);
  return hours<24&&minutes<60?hours*60+minutes:null;
}

export function studentTime12(value:string,locale:SupportedLocale):string {
  const minute=studentClassMinutes(value);
  if(minute===null)return localizeDigits(value,locale);
  const hours=Math.floor(minute/60);
  const hh=String(hours%12||12).padStart(2,"0");
  const mm=String(minute%60).padStart(2,"0");
  return `${localizeDigits(`${hh}:${mm}`,locale)} ${hours<12?"AM":"PM"}`;
}

export function studentTimeRange12(start:string,end:string,locale:SupportedLocale):string {
  return `${studentTime12(start,locale)} – ${studentTime12(end,locale)}`;
}

/** Never mutate data from the scoped /v1/student/timetable endpoint. */
export function studentPeriodsForDay(
  timetable:StudentTimetablePayload|null,weekday:StudentSchoolWeekday
):StudentPeriod[] {
  if(!timetable)return [];
  return timetable.periods.filter(item=>item.period.weekday===weekday)
    .sort((a,b)=>
      (studentClassMinutes(a.period.startsAt)??Infinity)-
        (studentClassMinutes(b.period.startsAt)??Infinity)||
      a.period.id.localeCompare(b.period.id));
}

/** Current/finished state is meaningful only for today's timetable in Kabul. */
export function studentTimetablePeriodState(
  item:StudentPeriod,now:Date=new Date()
):StudentTimetablePeriodState {
  const clock=studentSchoolClock(now);
  const start=studentClassMinutes(item.period.startsAt);
  const end=studentClassMinutes(item.period.endsAt);
  if(!clock||clock.weekday!==item.period.weekday||start===null||end===null||end<=start) {
    return "UPCOMING";
  }
  if(clock.minutes>=end)return "FINISHED";
  return clock.minutes>=start?"CURRENT":"UPCOMING";
}

export function studentTeacherDirectory(
  timetable:StudentTimetablePayload|null
):StudentTeacherDirectoryEntry[] {
  if(!timetable)return [];
  const teacherMap=new Map<string,{
    teacherName:string;weeklyPeriods:number;
    subjects:Map<string,{subjectId:string;subjectName:string;subjectCode:string}>
  }>();
  for(const row of timetable.periods){
    const teacherId=row.period.teacherUserId;
    if(!teacherId||!row.teacherName?.trim())continue;
    const teacher=teacherMap.get(teacherId)??{
      teacherName:row.teacherName.trim(),weeklyPeriods:0,
      subjects:new Map<string,{subjectId:string;subjectName:string;subjectCode:string}>()
    };
    teacher.weeklyPeriods++;
    if(!teacher.subjects.has(row.period.subjectId)){
      teacher.subjects.set(row.period.subjectId,{
        subjectId:row.period.subjectId,
        subjectName:row.subjectName,
        subjectCode:row.subjectCode
      });
    }
    teacherMap.set(teacherId,teacher);
  }
  return [...teacherMap].map(([teacherUserId,teacher])=>({
    teacherUserId,teacherName:teacher.teacherName,weeklyPeriods:teacher.weeklyPeriods,
    subjects:[...teacher.subjects.values()].sort((a,b)=>
      a.subjectName.localeCompare(b.subjectName)||a.subjectId.localeCompare(b.subjectId))
  })).sort((a,b)=>a.teacherName.localeCompare(b.teacherName)||
    a.teacherUserId.localeCompare(b.teacherUserId));
}
