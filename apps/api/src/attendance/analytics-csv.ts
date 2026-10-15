import type {
  AttendanceAnalyticsClass, AttendanceAnalyticsDay, AttendanceAnalyticsStudent
} from "@maktablink/database";

export type AttendanceExportKind = "classes" | "days" | "students";

/** Always quote cells and neutralize formulas even if preceded by whitespace. */
export function safeAttendanceCsvCell(input:string|number|null|undefined):string {
  const value=String(input??"");
  const protectedValue=/^[\s\uFEFF\u200B-\u200D]*[=+@-]/u.test(value) ? "'"+value : value;
  return '"'+protectedValue.replaceAll('"','""')+'"';
}
function csv(rows:Array<Array<string|number|null|undefined>>):string {
  return "\uFEFF"+rows.map(row=>row.map(safeAttendanceCsvCell).join(",")).join("\r\n")+"\r\n";
}
function formatRate(rate:number|null):string {return rate===null?"":String(rate);}
const common=["Present","Absent","Late","Excused","Recorded marks","Attendance rate (%)"];
function metrics(r:{present:number;absent:number;late:number;excused:number;recorded:number;rate:number|null}) {
  return [r.present,r.absent,r.late,r.excused,r.recorded,formatRate(r.rate)];
}
export function formatAttendanceAnalyticsCsv(
  kind:AttendanceExportKind,records:AttendanceAnalyticsClass[]|AttendanceAnalyticsDay[]|AttendanceAnalyticsStudent[]
):string {
  if(kind==="classes"){
    const data=records as AttendanceAnalyticsClass[];
    return csv([["Class code","Class name",...common,"Submitted registers"],
      ...data.map(r=>[r.classCode,r.className,...metrics(r),r.submittedRegisters])]);
  }
  if(kind==="days"){
    const data=records as AttendanceAnalyticsDay[];
    return csv([["Date (ISO)",...common,"Submitted registers"],
      ...data.map(r=>[r.date,...metrics(r),r.submittedRegisters])]);
  }
  const data=records as AttendanceAnalyticsStudent[];
  return csv([["Student code","Student name","Class code","Class name",...common],
    ...data.map(r=>[r.studentCode,r.studentName,r.classCode,r.className,...metrics(r)])]);
}
