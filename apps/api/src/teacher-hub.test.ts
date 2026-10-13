import test from "node:test";
import assert from "node:assert/strict";
import { nextTeacherPeriod, teacherTaskCounts, teacherTime12 } from "../../mobile/src/teacher-hub-data.js";
import type { TeacherTodayPayload, TeacherLearningPayload } from "../../mobile/src/api.js";

test("Teacher dashboard uses actual draft, active exam and pending Negaran status counts", () => {
  const today = {
    date: "2026-10-13", supervisedClasses: [
      { attendanceStatus: "PENDING" }, { attendanceStatus: "SUBMITTED" }, { attendanceStatus: "PENDING" }
    ]
  } as TeacherTodayPayload;
  const learning = {
    homeworks: [{ status: "DRAFT" }, { status: "PUBLISHED" }, { status: "DRAFT" }],
    examSubjects: [{ exam: { status: "IN_PROGRESS" } }, { exam: { status: "SCHEDULED" } }]
  } as TeacherLearningPayload;
  assert.deepEqual(teacherTaskCounts(today, learning), {
    pendingAttendance: 2, homeworkDrafts: 2, openGradeSheets: 1
  });
  assert.deepEqual(teacherTaskCounts(null, null), {
    pendingAttendance: 0, homeworkDrafts: 0, openGradeSheets: 0
  });
});

test("Teacher next period sorts actual school-day periods and ignores stale dates", () => {
  const today = {
    date: "2026-10-13",
    schedule: [
      { id: "late", startsAt: "11:30", className: "7A" },
      { id: "past", startsAt: "08:00", className: "7B" },
      { id: "next", startsAt: "09:45", className: "7A" }
    ]
  } as TeacherTodayPayload;
  assert.equal(nextTeacherPeriod(today, new Date("2026-10-13T04:15:00.000Z"))?.id, "next");
  assert.equal(nextTeacherPeriod(today, new Date("2026-10-13T08:00:00.000Z")), null);
  assert.equal(nextTeacherPeriod(today, new Date("2026-10-14T04:15:00.000Z")), null);
});

test("Teacher timetable formats midnight, noon and afternoon in 12-hour time", () => {
  assert.equal(teacherTime12("00:00"), "12:00 AM");
  assert.equal(teacherTime12("09:45"), "09:45 AM");
  assert.equal(teacherTime12("12:00"), "12:00 PM");
  assert.equal(teacherTime12("18:30"), "06:30 PM");
  assert.equal(teacherTime12("25:80"), "25:80");
});
