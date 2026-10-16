import assert from "node:assert/strict";
import test from "node:test";
import {
  TEACHER_SCHOOL_WEEKDAYS, TEACHER_ALL_WEEKDAYS, teacherKabulWeekday,
  teacherPeriodsForDay, teacherSchedulePeriodState, teacherShiftWeekday
} from "../apps/mobile/src/teacher-schedule-model.js";
import type { TeacherAcademicsPayload, TeacherTodayPayload } from "../apps/mobile/src/api.js";

const period = (id:string,startsAt:string,endsAt:string,weekday:
 TeacherAcademicsPayload["schedule"][number]["weekday"]="SATURDAY",
 classId="class-one",subjectId="math")=>({
  id,weekday,startsAt,endsAt,classId,subjectId,
  className:"First Class",classCode:"1A",subjectName:"Math"
});
const classPeriod=period("current","09:00","09:45");
const weekdaySchedule:TeacherAcademicsPayload={
  assignmentDetails:[{assignmentId:"math-class-one",academicYearId:"year",
    classId:"class-one",className:"First Class",classCode:"1A",subjectId:"math",subjectName:"Math"}],
  schedule:[period("afternoon","13:00","13:45"),classPeriod,
    period("another-day","11:00","11:45","MONDAY")]
};
const saturday:TeacherTodayPayload={
  date:"2026-10-17",weekday:"SATURDAY",
  teacher:{userId:"teacher-one",fullName:"Teacher",employeeCode:"T1"},
  schedule:[classPeriod,period("afternoon","13:00","13:45")],supervisedClasses:[]
};
const atKabul=(hour:number,minute=0)=>
 new Date(Date.UTC(2026,9,17,hour-4,minute-30));

test("Teacher Phase 3: Kabul weekday independent of phone timezone and DST",()=>{
  assert.equal(teacherKabulWeekday(atKabul(9)),"SATURDAY");
  assert.equal(teacherKabulWeekday(new Date("2026-10-16T20:00:00Z")),"SATURDAY");
  assert.equal(teacherKabulWeekday(new Date("invalid")),null);
  assert.equal(teacherKabulWeekday(new Date("2026-10-16T12:00:00Z")),"FRIDAY");
});
test("Teacher Phase 3: six standard teaching days, Friday reachable in Day view",()=>{
  assert.deepEqual([...TEACHER_SCHOOL_WEEKDAYS],[
    "SATURDAY","SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY"
  ]);
  assert.equal(TEACHER_ALL_WEEKDAYS.length,7);
  assert.equal(teacherShiftWeekday("SATURDAY",-1),"FRIDAY");
  assert.equal(teacherShiftWeekday("FRIDAY",1),"SATURDAY");
  assert.equal(teacherShiftWeekday("MONDAY",1),"TUESDAY");
});
test("Teacher Phase 3: day filtering sorts by start time without mutating payload",()=>{
  const old=weekdaySchedule.schedule.slice();
  const result=teacherPeriodsForDay(weekdaySchedule,"SATURDAY");
  assert.deepEqual(result.map(item=>item.id),["current","afternoon"]);
  assert.deepEqual(weekdaySchedule.schedule,old);
  assert.equal(teacherPeriodsForDay(weekdaySchedule,"FRIDAY").length,0);
  assert.equal(teacherPeriodsForDay(null,"SATURDAY").length,0);
});
test("Teacher Phase 3: only today's server-confirmed periods receive live statuses",()=>{
  assert.equal(teacherSchedulePeriodState(classPeriod,saturday,atKabul(8,59)),"UPCOMING");
  assert.equal(teacherSchedulePeriodState(classPeriod,saturday,atKabul(9)),"CURRENT");
  assert.equal(teacherSchedulePeriodState(classPeriod,saturday,atKabul(9,44)),"CURRENT");
  assert.equal(teacherSchedulePeriodState(classPeriod,saturday,atKabul(9,45)),"FINISHED");
  assert.equal(teacherSchedulePeriodState(classPeriod,null,atKabul(9)),null);
  assert.equal(teacherSchedulePeriodState(classPeriod,saturday,new Date("2026-10-18T04:30:00Z")),null);
  // A weekly period absent from today's server schedule could have changed;
  // do not assume it is running or finished.
  const cancelled=period("not-today","09:00","09:45","SATURDAY","class-two");
  assert.equal(teacherSchedulePeriodState(cancelled,saturday,atKabul(9)),null);
  const replaced=period("changed-time","10:00","10:45");
  assert.equal(teacherSchedulePeriodState(replaced,saturday,atKabul(10)),null);
  const wrongSubject=period("other-subject","09:00","09:45","SATURDAY","class-one","science");
  assert.equal(teacherSchedulePeriodState(wrongSubject,saturday,atKabul(9)),null);
  const invalid=period("invalid","25:00","26:00");
  assert.equal(teacherSchedulePeriodState(invalid,{...saturday,schedule:[invalid]},atKabul(9)),null);
});
