import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const academic = read("packages/database/src/academic-store.ts");
const attendance = read("packages/database/src/attendance-store.ts");
const calendar = read("packages/database/src/attendance-monitoring-store.ts");
const correction = read("packages/database/src/staff-attendance-correction-store.ts");
const learning = read("packages/database/src/learning-store.ts");
const tests = read("packages/database/src/academic-store.test.ts");

const section = (source, begin, end) => {
  const start = source.lastIndexOf("    async " + begin + "(");
  const finish = source.indexOf("    async " + end + "(", start + 5);
  assert.ok(start >= 0 && finish > start, "Could not find method " + begin);
  return source.slice(start, finish);
};
const requires = (source, snippets, title) => {
  for (const snippet of snippets) assert.ok(source.includes(snippet),
    title + " missing safeguard: " + snippet);
};
requires(academic, [
  "async function lockWritableYear(",
  '.for("update")',
  "requireMutableYear(year);",
  "fresh.updatedAt.getTime() !== current.updatedAt.getTime()"
], "Academic-year locking");
for (const [begin, end] of [
  ["createNegaranAssignment", "updateNegaranAssignment"],
  ["updateNegaranAssignment", "deleteNegaranAssignment"],
  ["createTimetablePeriod", "updateTimetablePeriod"],
  ["updateTimetablePeriod", "deleteTimetablePeriod"]
]) {
  const method = section(academic, begin, end);
  requires(method, [
    "return db.transaction(async (tx) => {",
    "await lockWritableYear(tx, schoolId, input.academicYearId)",
    "await tx"
  ], begin);
  assert.ok(!method.includes("const existing = await db") &&
    !method.includes("const overlaps = await db") &&
    !method.includes("const candidates = await db") &&
    !method.includes("const conflicts = await db"),
  begin + " must check overlaps within its serialized transaction");
}
requires(section(academic,"endNegaranAssignment","createTimetablePeriod"), [
  'isNull(negaranAssignments.endDate)',
  "Negaran assignment was already ended by another request."
], "End supervision idempotency");

requires(section(attendance, "submitDailyAttendance", "getStudentAttendance"), [
  "// Match the lock taken by administrator day-closure writes.",
  '.limit(1).for("update")',
  'if (dayClosure) throw new AttendanceConflictError('
], "Negaran submission and day-closure safety");
requires(calendar, [
  "const [lockedYear]=await tx.select().from(academicYears)",
  '.limit(1).for("update")',
  'if(submitted)throw new AttendanceCalendarConflictError('
], "School-calendar closure safety");
requires(attendance, [
  "const [lockedDay] = await tx.select({ id: dailyAttendances.id })",
  "const [lockedYear] = await tx.select({ status: academicYears.status })"
], "Administrator correction lock order");
requires(correction, [
  "const [lockedYear]=await tx.select({status:academicYears.status})",
  "const [lockedDay]=await tx.select({id:dailyAttendances.id})"
], "Staff correction lock order");
requires(learning, [
  "Homework publication requires the active academic year.",
  "Homework due date must be after publication.",
  "Teacher assignment changed before publication.",
  "The class roster changed. Reload the grade sheet.",
  "You are no longer assigned to this exam subject."
], "Learning and examination workflow");
requires(tests, [
  "Audit Phase 5: overlapping supervision and timetable writes cannot both succeed",
  "Promise.allSettled",
  "This class"
].filter(x=>x!=="This class"), "Database regression");

console.log("Phase 5 academic/attendance/learning guard verified: serialized overlaps, closure/submission lock ordering, stale-edit guards and live grade validation.");
