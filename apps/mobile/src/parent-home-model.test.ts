import test from "node:test";
import assert from "node:assert/strict";
import { buildParentHomeView, kabulCivilDay, weekdayForSchoolDate } from "./parent-home-model.js";
import type { FeeInvoiceViewPayload, LearnerAcademicPayload } from "./api.js";

const base = () => ({
  classId: "class-a", todayDate: "2026-10-14",
  todayAttendance: "PRESENT" as const, timetable: [],
  learning: { homework:[], results:[] } as unknown as LearnerAcademicPayload,
  announcements:[],fees:[] as FeeInvoiceViewPayload[],notifications:[],
  available:{attendance:true,timetable:true,learning:true,announcements:true,fees:true,notifications:true}
});
test("Kabul civil day respects UTC midnight and invalid civil dates",()=>{
  assert.equal(kabulCivilDay("2026-10-13T21:00:00Z"),"2026-10-14");
  assert.equal(kabulCivilDay("2026-10-13T18:00:00Z"),"2026-10-13");
  assert.equal(weekdayForSchoolDate("2026-10-14"),"WEDNESDAY");
  assert.equal(weekdayForSchoolDate("2026-02-30"),null);
});
test("Unavailable and unrecorded attendance is never claimed as absence",()=>{
  const a=base(),b=base();
  a.todayAttendance="PRESENT";a.available.attendance=false;
  assert.equal(buildParentHomeView(a).alerts.some(x=>x.kind==="attendance"),false);
  b.todayAttendance="PRESENT";
  assert.equal(buildParentHomeView(b).alerts.length,0);
});
test("Actual absent and late records create action-targeted alerts",()=>{
  const a=base(),b=base();
  a.todayAttendance="ABSENT" as never;
  b.todayAttendance="LATE" as never;
  assert.equal(buildParentHomeView(a).alerts[0]?.destination,"ATTENDANCE");
  assert.equal(buildParentHomeView(a).alerts[0]?.tone,"danger");
  assert.equal(buildParentHomeView(b).alerts[0]?.label,"parent.alertLate");
});
test("Only published upcoming homework generates due-today alert, sorted by Kabul dates",()=>{
  const a=base();
  a.learning.homework=[
    {homework:{id:"later",status:"PUBLISHED",dueAt:"2026-10-17T10:00:00Z"},subjectName:"Maths"},
    {homework:{id:"today",status:"PUBLISHED",dueAt:"2026-10-13T21:00:00Z"},subjectName:"English"},
    {homework:{id:"draft",status:"DRAFT",dueAt:"2026-10-14T01:00:00Z"},subjectName:"Science"}
  ] as LearnerAcademicPayload["homework"];
  const view=buildParentHomeView(a);
  assert.equal(view.homework?.homework.id,"today");
  assert.equal(view.alerts[0]?.label,"parent.alertHomeworkToday");
  a.available.learning=false;
  assert.equal(buildParentHomeView(a).alerts.length,0);
});
test("Fees require confirmed outstanding non-draft invoices and do not mask absence",()=>{
  const a=base();
  a.fees=[{
    invoice:{id:"1",studentId:"child",amount:1000,currency:"AFN",
      description:"October",dueDate:"2026-10-11",status:"OVERDUE",issuedAt:null},
    outstanding:1000,paid:0,payments:[],studentName:"Child",studentCode:"X"
  }];
  const v=buildParentHomeView(a);
  assert.equal(v.alerts[0]?.label,"parent.alertFeeOverdue");
  a.fees[0]!.invoice.status="CANCELLED";
  assert.equal(buildParentHomeView(a).alerts.length,0);
});
