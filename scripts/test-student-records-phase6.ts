import assert from "node:assert/strict";
import test from "node:test";
import type {ParentAttendanceDay,FeeInvoiceViewPayload} from "../apps/mobile/src/api.js";
import {
  studentVisibleAttendance,studentAttendanceSummary,
  studentAttendanceWeekdays,studentCalendarOffset,studentVisibleFees,
  studentFeeSummary,studentFilterFees,studentFeeFilters,studentSortedPayments
} from "../apps/mobile/src/student-records-model.js";
const day=(date:string,status:ParentAttendanceDay["status"]):ParentAttendanceDay=>({
 attendanceId:date,date,status,note:null,classId:"class",className:"Class 10"});
const invoice=(id:string,studentId:string,status:FeeInvoiceViewPayload["invoice"]["status"],
 amount=100,paid=20):FeeInvoiceViewPayload=>({
 invoice:{id,studentId,status,dueDate:"2026-10-15",amount,currency:"AFN",
   description:"Tuition",issuedAt:"2026-10-01"},studentName:"Student",studentCode:"S1",
 paid,outstanding:Math.max(0,amount-paid),payments:[
   {id:"p-"+id,invoiceId:id,kind:"PAYMENT",amount:paid,method:"CASH",
     transactionReference:"private",reversalOfPaymentId:null,reversalReason:null,
     recordedAt:"2026-10-14T10:00:00Z"}
 ]
});
test("Student Phase 6 attendance shows only recorded school days, not empty or future days",()=>{
 const days=[day("2026-10-16","PRESENT"),day("2026-10-15","LATE"),
   day("2026-10-14","ABSENT"),day("2026-10-13","EXCUSED"),
   day("2026-10-18","ABSENT"),day("2026-10-15","ABSENT"),day("invalid","ABSENT")];
 const visible=studentVisibleAttendance(days,"2026-10-01","2026-10-31","2026-10-17");
 assert.equal(visible.length,4);
 assert.deepEqual(visible.map(x=>x.date),["2026-10-16","2026-10-15","2026-10-14","2026-10-13"]);
 const summary=studentAttendanceSummary(days,"2026-10-01","2026-10-31","2026-10-17");
 assert.equal(summary.counts.PRESENT,1);assert.equal(summary.counts.ABSENT,1);
 assert.equal(summary.counts.LATE,1);assert.equal(summary.counts.EXCUSED,1);
 assert.equal(summary.recorded,4);assert.equal(summary.eligible,3);
 assert.equal(summary.rate,67);
 assert.equal(studentAttendanceSummary([],"2026-10-01","2026-10-31","2026-10-17").rate,null);
});
test("Student Phase 6 calendar uses Solar Hijri week start and English Monday",()=>{
 assert.equal(studentAttendanceWeekdays("fa-AF").length,7);
 assert.equal(studentAttendanceWeekdays("en").length,7);
 assert.notEqual(studentAttendanceWeekdays("en")[0],studentAttendanceWeekdays("fa-AF")[0]);
 assert.equal(studentCalendarOffset("2026-10-17","fa-AF"),0);
 assert.equal(studentCalendarOffset("2026-10-19","en"),0);
 assert.equal(studentCalendarOffset("2026-10-17","en"),5);
});
test("Student Phase 6 fees exclude other pupils, cancelled invoices and drafts",()=>{
 const all=[
   invoice("own","s1","ISSUED",120,20),
   invoice("paid","s1","PAID",50,50),
   invoice("draft","s1","DRAFT",1000,0),
   invoice("cancelled","s1","CANCELLED",200,0),
   invoice("other","s2","OVERDUE",900,0)
 ];
 const visible=studentVisibleFees(all,"s1");
 assert.deepEqual(visible.map(x=>x.invoice.id),["own","paid"]);
 const totals=studentFeeSummary(visible);
 assert.deepEqual(totals,{total:170,paid:70,outstanding:100,due:1,invoices:2});
 assert.deepEqual(studentFeeFilters,["ALL","DUE","PAID"]);
 assert.deepEqual(studentFilterFees(visible,"DUE").map(x=>x.invoice.id),["own"]);
 assert.deepEqual(studentFilterFees(visible,"PAID").map(x=>x.invoice.id),["paid"]);
 assert.deepEqual(studentVisibleFees(all,"otherStudent"),[]);
});
test("Student Phase 6 payment history is immutable and ordered latest first",()=>{
 const row=invoice("own","s1","ISSUED");
 row.payments.push({...row.payments[0]!,id:"later",recordedAt:"2026-10-17T05:00:00Z"});
 const snapshot=row.payments.map(x=>x.id);
 assert.deepEqual(studentSortedPayments(row).map(x=>x.id),["later","p-own"]);
 assert.deepEqual(row.payments.map(x=>x.id),snapshot);
});
