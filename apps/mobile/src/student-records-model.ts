import type {AttendanceStatus,ParentAttendanceDay,FeeInvoiceViewPayload} from "./api";
import {summarizeAttendance,validIsoDay} from "./parent-attendance-model";

export type StudentRecordsTab="ATTENDANCE"|"FEES";
export type StudentFeeFilter="ALL"|"DUE"|"PAID";
export const studentFeeFilters:readonly StudentFeeFilter[]=["ALL","DUE","PAID"];

export function studentVisibleAttendance(days:readonly ParentAttendanceDay[],
  from:string,to:string,today:string):ParentAttendanceDay[]{
  const seen=new Set<string>();
  return [...days].filter(day=>{
    if(!validIsoDay(day.date)||day.date<from||day.date>to||day.date>today||
      seen.has(day.date)||!["PRESENT","ABSENT","LATE","EXCUSED"].includes(day.status))return false;
    seen.add(day.date);return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));
}
export function studentAttendanceSummary(days:readonly ParentAttendanceDay[],
  from:string,to:string,today:string) {
  return summarizeAttendance(studentVisibleAttendance(days,from,to,today),from,to);
}
export function studentAttendanceWeekdays(locale:"en"|"fa-AF"|"ps-AF"):string[]{
  const start=locale==="en"?19:17; // 2026-10-19 Monday / October 17 Saturday
  return Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(
    locale==="en"?"en-US":locale,{weekday:"short",timeZone:"UTC"}
  ).format(new Date(Date.UTC(2026,9,start+i,12))));
}
export function studentCalendarOffset(monthFrom:string,locale:"en"|"fa-AF"|"ps-AF"):number{
  const day=new Date(monthFrom+"T12:00:00Z").getUTCDay();
  return locale==="en"?(day+6)%7:(day+1)%7;
}
export function studentVisibleFees(all:readonly FeeInvoiceViewPayload[],studentId:string):
  FeeInvoiceViewPayload[]{
  // Only one's own issued invoices, never school drafts, cancelled or another student.
  return all.filter(row=>row.invoice.studentId===studentId&&
    row.invoice.status!=="DRAFT"&&row.invoice.status!=="CANCELLED")
    .sort((a,b)=>b.invoice.dueDate.localeCompare(a.invoice.dueDate)||
      a.invoice.id.localeCompare(b.invoice.id));
}
export function studentFeeSummary(rows:readonly FeeInvoiceViewPayload[]){
  const total=rows.reduce((sum,row)=>sum+row.invoice.amount,0);
  const paid=rows.reduce((sum,row)=>sum+row.paid,0);
  const outstanding=rows.reduce((sum,row)=>sum+row.outstanding,0);
  return {total,paid,outstanding,
    due:rows.filter(row=>row.outstanding>0).length,
    invoices:rows.length};
}
export function studentFilterFees(rows:readonly FeeInvoiceViewPayload[],
  filter:StudentFeeFilter):FeeInvoiceViewPayload[] {
  return rows.filter(row=>filter==="ALL"||
    filter==="DUE"&&row.outstanding>0||
    filter==="PAID"&&row.invoice.status==="PAID");
}
export function studentSortedPayments(row:FeeInvoiceViewPayload) {
  return [...row.payments].sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)||
    b.id.localeCompare(a.id));
}
export const studentAttendanceStatus:readonly AttendanceStatus[]=[
  "PRESENT","ABSENT","LATE","EXCUSED"
];
