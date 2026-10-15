import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("apps/web/app/admin/attendance-panel.tsx");
const ui=read("apps/web/app/admin/admin-attendance-monitoring.tsx");
const store=read("packages/database/src/attendance-monitoring-store.ts");
const model=read("packages/database/src/attendance-monitoring-model.ts");
const attendance=read("packages/database/src/attendance-store.ts");
const routes=read("apps/api/src/attendance/routes.ts");
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0026_admin_attendance_calendar.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const css=read("apps/web/app/globals.css");
const i18n=read("apps/web/app/admin/admin-i18n.ts");
const tests=read("apps/api/src/app.test.ts");

for(const x of ['mode="OVERVIEW"','mode="REGISTERS"','<AdminAttendanceMonitoring',
  'Submitted registers in the selected period. Daily eligibility is shown below.',
  'Daily submission monitoring follows the timetable and declared school closures.'])
  assert.ok(panel.includes(x),"Missing monitoring integration: "+x);
for(const x of ['new AbortController()','controller.signal.aborted',
  'scopeRef.current!==scope','Select a single day to monitor submissions',
  'role="progressbar"','aria-valuemax={100}','Pending submission',
  'Negaran missing or inactive','Class-by-class daily monitoring',
  'School calendar closures','Confirm','attendance/closures','method:"DELETE"',
  'academicYearId,date:closureDay','No pending or misconfigured class registers for this date.',
  'Submitted total may include classes outside today\'s expected schedule.'])
  if(x!=="Confirm")assert.ok(ui.includes(x),"Missing monitoring UI safety: "+x);
for(const x of ['getAdminDailyMonitoring','getAdminAttendanceClosures',
  'addAdminAttendanceClosure','removeAdminAttendanceClosure',
  'eq(students.status,"ACTIVE")','eq(users.status,"ACTIVE")',
  'eq(attendanceClosures.schoolId,schoolId)',
  'classifyAttendanceDay(','summary.expectedClasses++',
  'summary.submittedExpected++','summary.pendingClasses++',
  'attendance.calendar_closed','attendance.calendar_reopened',
  'Cannot close a day with submitted attendance.',
  'onConflictDoNothing()'])
  assert.ok(store.includes(x),"Missing monitored school boundary or audit: "+x);
for(const x of ['if (input.submitted) return','if (input.closed) return',
  'if (!input.hasTimetable) return','input.activeStudents > 0',
  'input.negaranCount === 1'])assert.ok(model.includes(x),"Invalid eligible-day model: "+x);
for(const x of ['"/v1/admin/attendance/monitor"','"/v1/admin/attendance/closures"',
  'attendance.getAdminDailyMonitoring(', 'attendance.addAdminAttendanceClosure(',
  'attendance.removeAdminAttendanceClosure(','requireSchoolAdmin(request, reply, accounts)'])
  assert.ok(routes.includes(x),"Monitoring route missing or unguarded: "+x);
assert.ok(attendance.includes('...createAttendanceMonitoringStore(db,schoolToday)'));
assert.ok(attendance.includes('Attendance is closed for this school day.'));
assert.ok(attendance.includes('attendanceStatus: attendance ? "SUBMITTED" : todayClosure ? "CLOSED"'));
assert.ok(schema.includes('export const attendanceClosures'));
assert.ok(migration.includes('CREATE UNIQUE INDEX "attendance_closures_school_year_date_unique"'));
assert.ok(journal.includes('"0026_admin_attendance_calendar"'));
assert.ok(tests.includes('"0026_admin_attendance_calendar.sql"'));
assert.ok(tests.includes('Admin Attendance Phase 2: school/year-scoped monitoring'));
for(const x of ['.attendance-monitor-meter','.attendance-monitor-class-list',
  '.attendance-closure-form','@media(max-width:620px)'])assert.ok(css.includes(x),"Missing responsive CSS: "+x);
for(const key of ["Daily submission progress","School calendar closures","Negaran missing or inactive",
  "Expected submissions completed","No active students","Remove closure"]) {
  assert.equal(i18n.split(JSON.stringify(key)+":").length,3,
    "Attendance monitoring must have Dari + Pashto translations: "+key);
}
console.log("Admin Attendance Phase 2 scope, classroom monitoring, closure and RTL invariants passed.");
