import assert from "node:assert/strict";
import test from "node:test";
import { safeAttendanceCsvCell, formatAttendanceAnalyticsCsv } from "../apps/api/src/attendance/analytics-csv.ts";
import { attendanceAnalyticsRate } from "../packages/database/src/attendance-analytics-store.ts";

test("attendance rate never treats excused or unsubmitted dates as absences",()=>{
  assert.equal(attendanceAnalyticsRate(0,0,0),null);
  assert.equal(attendanceAnalyticsRate(0,0,1),0);
  assert.equal(attendanceAnalyticsRate(1,0,0),100);
  assert.equal(attendanceAnalyticsRate(4,1,5),50);
  assert.equal(attendanceAnalyticsRate(1,1,1),66.7);
});
test("attendance CSV neutralizes formula injection, Unicode and embedded newlines",()=>{
  for(const value of ["=HYPERLINK(1,2)","+CMD","-cmd","@attack",
    " \t=SUM(1,2)","\n@evil","\uFEFF=SUM(1,2)","\u200B+EVIL"]){
    assert.ok(safeAttendanceCsvCell(value).includes("'"+value),
      "Formula injection safe for "+JSON.stringify(value));
  }
  assert.equal(safeAttendanceCsvCell('Math, "Unit 4"'),'"Math, ""Unit 4"""');
  const data=[{classId:"class",className:"=2+2",classCode:'7,A"\nB',
    present:1,absent:0,late:1,excused:2,recorded:4,rate:100,submittedRegisters:1}];
  const result=formatAttendanceAnalyticsCsv("classes",data);
  assert.ok(result.startsWith("\uFEFF"));
  assert.ok(result.endsWith("\r\n"));
  assert.ok(result.includes('"\'=2+2"'));
  assert.ok(result.includes('"7,A""\nB"'));
  assert.ok(result.includes('"100"'));
  const empty=formatAttendanceAnalyticsCsv("students",[]);
  assert.ok(empty.includes('"Student code","Student name"'));
  assert.ok(!empty.includes("openingNote")&&!empty.includes("contactDetails"));
});
