import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("apps/web/app/admin/attendance-panel.tsx");
const model=read("apps/web/app/admin/attendance-workspace-model.ts");
const css=read("apps/web/app/globals.css");
const i18n=read("apps/web/app/admin/admin-i18n.ts");
const api=read("apps/api/src/attendance/routes.ts");
const store=read("packages/database/src/attendance-store.ts");
const tests=read("apps/api/src/app.test.ts");
const page=read("apps/web/app/admin/(workspace)/attendance/page.tsx");

for(const tab of ["OVERVIEW","REGISTERS","STUDENTS","FOLLOWUPS","REPORTS","AUDIT"])
  assert.ok(model.includes('id: "'+tab+'"'),"Missing Attendance tab: "+tab);
assert.ok(page.includes("<AttendancePanel"));
for(const fragment of [
  'role="tablist" aria-label={t("Attendance sections")}',
  'role="tab"','aria-selected={activeTab === id}','aria-controls=',
  'role="tabpanel"','tabRefs.current[destination]?.focus()',
  'event.key === "ArrowRight"','event.key === "ArrowLeft"',
  'event.key === "Home"','event.key === "End"',
  'setActiveTab("REGISTERS")','setActiveTab("FOLLOWUPS")',
  'new AbortController()','controller.signal.aborted',
  'loadSequence.current !== run','scopeRef.current !== expectedScope',
  'loadController.current?.abort()', 'controller.abort()',
  'request<AttendanceReport>(accessToken, reportUrl(year)',
  'const today = initialReport.to',
  'setSchoolToday(today)',
  'setDraftFilters({ from: today, to: today, classId: "" })',
  'selectedAcademicYear?.status !== "ACTIVE"',
  'setActionBusy(false)',
  'AdminAttendanceStudents',
  'attendanceRate(report.summary)',
  'readOnly={historicalReadOnly} onCorrect={correct}',
  'onClick={() => void onCorrect(row, status, note)}',
  'href="/admin/pilot/audit"',
  'Daily submission monitoring follows the timetable and declared school closures.'
]) assert.ok(panel.includes(fragment),"Missing Attendance UI/state safeguard: "+fragment);
assert.ok(!panel.includes("Phase 5 · Attendance"),"No implementation phase labels in admin Attendance.");
assert.ok(!panel.includes("function localDate"),"Attendance must never default to device-local date.");
for(const fragment of [
  '"/v1/admin/attendance/report"',
  'requireSchoolAdmin(request, reply, accounts)',
  'attendance.getSchoolToday(context.user.schoolId)',
  'attendance.correctAttendance('
]) assert.ok(api.includes(fragment),"Existing admin attendance API must remain secure: "+fragment);
assert.ok(store.includes('getAdminReport(schoolId, from, to, classId, academicYearId)'));
assert.ok(store.includes('eq(dailyAttendances.schoolId, schoolId)'));
assert.ok(store.includes('year.status !== "ACTIVE"'));
assert.ok(store.includes('action: "attendance.corrected_by_admin"'));
for(const fragment of [
  '.attendance-workspace-tabs','.attendance-overview-grid',
  '.attendance-preview-list','.attendance-readonly-note',
  '@media (max-width: 620px)','@media (prefers-reduced-motion: reduce)'
]) assert.ok(css.includes(fragment),"Missing accessible responsive Attendance styling: "+fragment);
for(const value of [
  "Daily attendance management","Attendance sections","Daily registers","Follow-ups",
  "Audit trail","School-local date","Attendance filters",
  "Recorded attendance rate","Unsubmitted classes (calendar not verified)"
]) assert.equal(i18n.split(JSON.stringify(value)+":").length,3,
  "Missing attendance phrase in both Dari and Pashto dictionaries: "+value);
assert.ok(tests.includes("Admin Attendance Phase 1: school-derived date defaults"));
console.log("Admin Attendance Phase 1 navigation, scoped date, safe filtering, RTL and corrections invariants passed.");
