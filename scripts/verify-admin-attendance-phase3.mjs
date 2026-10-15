import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("apps/web/app/admin/attendance-panel.tsx");
const student=read("apps/web/app/admin/admin-attendance-students.tsx");
const register=read("apps/web/app/admin/admin-attendance-class-register.tsx");
const calendar=read("apps/web/app/admin/attendance-calendar-model.ts");
const monitoring=read("apps/web/app/admin/admin-attendance-monitoring.tsx");
const store=read("packages/database/src/attendance-history-store.ts");
const base=read("packages/database/src/attendance-store.ts");
const index=read("packages/database/src/index.ts");
const routes=read("apps/api/src/attendance/routes.ts");
const css=read("apps/web/app/globals.css");
const i18n=read("apps/web/app/admin/admin-i18n.ts");
const tests=read("apps/api/src/app.test.ts");
for(const x of [
  'AdminAttendanceStudents','AdminAttendanceClassRegister',
  'setSelectedRegisterClass(classId)','onOpenClass',
  'selectedRegisterClass && appliedFilters?.from === appliedFilters?.to'
])assert.ok(panel.includes(x),"Attendance panel integration missing: "+x);
for(const x of [
  'onOpenClass?: (classId: string, date: string) => void',
  'onOpenClass(row.classId,row.date)'
])assert.ok(monitoring.includes(x),"Class monitor drilldown missing: "+x);
for(const x of [
  'new AbortController()','controller.signal.aborted',
  '/v1/admin/attendance/students?',
  '/history?', 'attendanceCalendarMonth(anchor,locale)',
  'attendanceAdjacentMonth','aria-pressed={selected===row.studentId}',
  'setPage(v=>v+1)','history.summary.rate',
  'cell.iso>history.today','Not recorded',
  'history.closures','role="grid"'
])assert.ok(student.includes(x),"Safe student directory/calendar missing: "+x);
for(const x of [
  'new AbortController()','controller.abort()',
  '/register?', 'data.record', 'status:null',
  'No register was submitted for this date',
  'This roster includes currently assigned students and historical marks',
  'statusFilter','attendance-class-student'
])assert.ok(register.includes(x),"Class roster access or missing-mark UI: "+x);
for(const x of [
  'getAdminStudentAttendanceDirectory','getAdminStudentAttendanceHistory',
  'getAdminClassAttendanceRegister',
  'eq(students.schoolId,schoolId)','eq(students.academicYearId,academicYearId)',
  'eq(studentAttendances.studentId,studentId)',
  'eq(dailyAttendances.academicYearId,academicYearId)',
  'ensureClass(schoolId,academicYearId,classId)',
  '.limit(limit).offset(offset)','safeRange(from,to,62)',
  'AttendanceHistoryNotFoundError',
  'status:null','attendanceClosures'
])assert.ok(store.includes(x),"Unprotected or unbounded attendance detail store: "+x);
assert.ok(base.includes('...createAttendanceHistoryStore(db,schoolToday)'));
assert.ok(index.includes('export * from "./attendance-history-store.js"'));
for(const x of [
  '"/v1/admin/attendance/students"',
  '"/v1/admin/attendance/students/:studentId/history"',
  '"/v1/admin/attendance/classes/:classId/register"',
  'adminStudentDirectoryQuerySchema','adminStudentHistoryQuerySchema',
  'adminClassRegisterQuerySchema',
  'attendance.getAdminClassAttendanceRegister(',
  'attendance.getAdminStudentAttendanceHistory(',
  'requireSchoolAdmin(request, reply, accounts)'
])assert.ok(routes.includes(x),"Missing school admin route or validation: "+x);
assert.ok(tests.includes("Admin Attendance Phase 3 integration"));
for(const x of ['.attendance-calendar-grid','.attendance-students-layout',
  '.attendance-class-student','.attendance-calendar-day-absent',
  '@media(max-width:620px)'])
  assert.ok(css.includes(x),"Missing responsive calendar CSS: "+x);
for(const key of ['Student attendance directory','Monthly attendance calendar',
  'Not recorded','Class attendance register','Student attendance profile',
  'Attendance rate'])assert.equal(i18n.split(JSON.stringify(key)+":").length,3,
    "Missing Dari/Pashto attendance translations: "+key);
assert.ok(calendar.includes('calendar:locale==="en"?"gregory":"persian"'));
console.log("Admin Attendance Phase 3 private history, class register and localized calendars static guards passed.");
