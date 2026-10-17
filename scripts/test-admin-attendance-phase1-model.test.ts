import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTENDANCE_TABS, attendanceRate, studentAttendancePreviews
} from "../apps/web/app/admin/attendance-workspace-model.ts";

test("attendance navigation preserves six core sections and the staff request queue", () => {
  const ids = ATTENDANCE_TABS.map(tab => tab.id);
  assert.deepEqual(ids.slice(0, 6),
    ["OVERVIEW","REGISTERS","STUDENTS","FOLLOWUPS","REPORTS","AUDIT"]);
  assert.deepEqual(ids.slice(6), ["STAFF_REQUESTS"]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(ATTENDANCE_TABS.map(tab => tab.label)).size, ids.length);
  assert.ok(ATTENDANCE_TABS.every(tab => !/phase/i.test(tab.label)));
});

test("recorded attendance percentage includes late and excludes excused/unmarked days", () => {
  assert.equal(attendanceRate({present:9,late:1,absent:2}),83.3);
  assert.equal(attendanceRate({present:0,late:0,absent:0}),null);
  assert.equal(attendanceRate({present:0,late:1,absent:0}),100);
});

test("student preview groups only marked records and does not assume missing attendance", () => {
  const rows = [
    {studentId:"s1",studentName:"A",studentCode:"01",className:"Grade 1",
      date:"2026-10-15",status:"ABSENT" as const},
    {studentId:"s1",studentName:"A",studentCode:"01",className:"Grade 1",
      date:"2026-10-14",status:"PRESENT" as const},
    {studentId:"s2",studentName:"B",studentCode:"02",className:"Grade 1",
      date:"2026-10-15",status:"EXCUSED" as const}
  ];
  const result = studentAttendancePreviews(rows);
  assert.equal(result.length,2);
  assert.deepEqual(result.map(row => ({
    id:row.studentId,recorded:row.recorded,absent:row.absent,
    excused:row.excused,late:row.late
  })),[
    {id:"s1",recorded:2,absent:1,excused:0,late:0},
    {id:"s2",recorded:1,absent:0,excused:1,late:0}
  ]);
  assert.deepEqual(studentAttendancePreviews([]),[]);
});
