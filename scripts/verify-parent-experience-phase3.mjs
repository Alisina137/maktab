import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const app = read("apps/mobile/App.tsx");
const screen = read("apps/mobile/src/parent-attendance.tsx");
const model = read("apps/mobile/src/parent-attendance-model.ts");
const api = read("apps/mobile/src/api.ts");
const route = read("apps/api/src/attendance/routes.ts");
const db = read("packages/database/src/attendance-store.ts");
const locale = read("packages/localization/src/index.ts");
const doc = read("docs/PARENT-EXPERIENCE-PHASES.md");

for (const required of [
  "ParentAttendanceContent", 'parentTab === "ATTENDANCE"', "onSensitiveError",
  "retryParentResource", "selectedChild.student.id", "parentToday"
]) assert.ok(app.includes(required), "Parent Attendance tab must remain child-scoped: " + required);

for (const required of [
  "accessToken, studentId, month.from, month.to",
  "return () => { active = false; }", "onSensitiveErrorRef.current",
  "accessibilityLabel", "adjacentAttendanceMonth", "attendanceMonth", "summarizeAttendance",
  "setRetry", "selectedMark.note", "formatLocalizedDate", "getDirection",
  "accessibilityState", "isFuture"
]) assert.ok(screen.includes(required), "Attendance component missing: " + required);

for (const required of [
  "calendar: locale === \"en\" ? \"gregory\" : \"persian\"",
  "PRESENT + counts.LATE", "eligible = recorded - counts.EXCUSED",
  "if (!latestByDay.has(row.date))", "for (let i = 0; i < 31; i++)"
]) assert.ok(model.includes(required), "Attendance month/stat safety missing: " + required);

assert.ok(api.includes("from?: string, to?: string"), "Monthly range must use authorized parent API");
assert.ok(route.includes('"/v1/parent/children/:studentId/attendance"'));
assert.ok(route.includes("await requireParent(request, reply, accounts)"));
assert.ok(db.includes("eq(students.parentUserId, parentUserId)"), "Enforce parent-child relationship in DB");
assert.ok(db.includes("eq(students.schoolId, schoolId)"), "Enforce tenant isolation");
assert.ok(db.includes("gte(dailyAttendances.date, effectiveFrom)"));
assert.ok(db.includes("lte(dailyAttendances.date, effectiveTo)"));
for (const key of [
  "parent.attendanceCalendar", "parent.attendanceCalendarHelp", "parent.attendancePrevious",
  "parent.attendanceNext", "parent.attendanceFuture", "parent.attendanceLoadError",
  "parent.attendanceSummary", "parent.attendanceRate", "parent.attendanceRateHelp",
  "parent.attendanceRecorded", "parent.attendanceMonthEmpty", "parent.attendanceDayDetail",
  "parent.attendanceNoNote", "parent.attendanceUnrecorded"
]) assert.equal(locale.split(JSON.stringify(key) + ":").length, 4,
  "Missing one or more English/Dari/Pashto translations for " + key);
assert.ok(doc.includes("## Phase 3") && doc.includes("denominator"));
console.log("Parent Phase 3 attendance calendar, recorded-only statistics, access control, RTL, and localization guards passed.");
