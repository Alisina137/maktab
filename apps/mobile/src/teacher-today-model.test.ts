import assert from "node:assert/strict";
import test from "node:test";
import {teacherAssignmentForPeriod, teacherDayTimeline, kabulTeacherClock} from "./teacher-today-model.js";
import type {TeacherTodayPayload, TeacherAcademicsPayload} from "./api.js";

const lesson = (id:string,startsAt:string,endsAt:string,classId="C1",subjectId="S1")=>({
  id,startsAt,endsAt,classId,subjectId,className:"Class One",classCode:"1A",subjectName:"Math"
});
const today:TeacherTodayPayload={
  date:"2026-10-17",weekday:"SATURDAY",teacher:{userId:"u1",fullName:"Teacher One",employeeCode:"T1"},
  schedule:[lesson("second","10:00","10:45"),lesson("first","08:00","08:45")],
  supervisedClasses:[]
};
const clock=(h:number,m=0)=>new Date(Date.UTC(2026,9,17,h-4,m-30));
test("Phase 2: Kabul-local clock differs from UTC at half-hour offset",()=>{
  assert.deepEqual(kabulTeacherClock(clock(8)),{date:"2026-10-17",minutes:480});
  assert.equal(kabulTeacherClock(new Date("invalid")),null);
});
test("Phase 2: before, during, between, after and inclusive boundary semantics",()=>{
  const before=teacherDayTimeline(today,clock(7,59));
  assert.equal(before.stage,"BEFORE");assert.equal(before.next?.id,"first");assert.equal(before.remaining,2);
  const current=teacherDayTimeline(today,clock(8));
  assert.equal(current.stage,"CURRENT");assert.equal(current.current?.id,"first");assert.equal(current.next?.id,"second");
  assert.equal(current.completed,0);assert.equal(current.remaining,2);
  const between=teacherDayTimeline(today,clock(8,45));
  assert.equal(between.stage,"BETWEEN");assert.equal(between.current,null);assert.equal(between.completed,1);
  assert.equal(between.next?.id,"second");
  const last=teacherDayTimeline(today,clock(10,45));
  assert.equal(last.stage,"DONE");assert.equal(last.completed,2);assert.equal(last.remaining,0);
});
test("Phase 2: refuse stale school day and malformed periods",()=>{
  assert.equal(teacherDayTimeline(today,new Date("2026-10-16T12:00:00Z")).stage,"UNAVAILABLE");
  assert.equal(teacherDayTimeline(null,clock(9)).stage,"UNAVAILABLE");
  assert.equal(teacherDayTimeline({...today,schedule:[]},clock(9)).stage,"EMPTY");
  assert.equal(teacherDayTimeline({...today,schedule:[lesson("bad","25:00","26:00")]},clock(9)).total,0);
});
test("Phase 2: direct lesson route always matches both class and subject",()=>{
  const academics:TeacherAcademicsPayload={assignmentDetails:[
    {assignmentId:"wrong",classId:"C1",subjectId:"S2",academicYearId:"Y",className:"One",classCode:"1A",subjectName:"Other"},
    {assignmentId:"correct",classId:"C1",subjectId:"S1",academicYearId:"Y",className:"One",classCode:"1A",subjectName:"Math"}
  ],schedule:[]};
  assert.equal(teacherAssignmentForPeriod(today.schedule[0]!,academics)?.assignmentId,"correct");
  assert.equal(teacherAssignmentForPeriod(lesson("missing","08:00","08:45","C2"),academics),null);
});
