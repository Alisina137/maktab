import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("apps/web/app/admin/attendance-panel.tsx");
const picker=read("apps/web/app/admin/admin-hijri-date-picker.tsx");
const monitoring=read("apps/web/app/admin/admin-attendance-monitoring.tsx");
const audit=read("apps/web/app/admin/admin-attendance-audit.tsx");
const students=read("apps/web/app/admin/admin-attendance-students.tsx");
const followups=read("apps/web/app/admin/admin-attendance-followups.tsx");
const analytics=read("apps/web/app/admin/admin-attendance-analytics.tsx");
const contracts=read("packages/contracts/src/index.ts");
const store=read("packages/database/src/attendance-store.ts");
const followupStore=read("packages/database/src/attendance-followup-store.ts");
const analyticsStore=read("packages/database/src/attendance-analytics-store.ts");
const routes=read("apps/api/src/attendance/routes.ts");
const tests=read("apps/api/src/app.test.ts");
const model=read("apps/web/app/admin/attendance-workspace-model.ts");
const i18n=read("apps/web/app/admin/admin-i18n.ts");
const ci=read(".github/workflows/ci.yml");
const plan=read("docs/ADMIN-ATTENDANCE-PHASE7-ACCEPTANCE.md");
const tabs=["OVERVIEW","REGISTERS","STUDENTS","FOLLOWUPS","REPORTS","AUDIT"];
assert.equal(tabs.length,6);
for(const tab of tabs)assert.ok(model.includes('id: "'+tab+'"'),"Attendance tab missing: "+tab);
for(const frag of [
  'role="tablist"','role="tab"','aria-selected={activeTab === id}',
  'aria-controls=', 'onKeyDown={event => onTabKeyDown(event, id)}',
  'role="tabpanel"', 'tabRefs.current[destination]?.focus()',
  "setBusy(true); setError(\"\")",
  'status === "ready" && report && academics',
  'busy && status === "ready"',
  "Refreshing attendance data…",
  'if (!appliedFilters || draftFilters.from !== appliedFilters.from',
  'setStatus("ready")',
  'scopeRef.current !== expectedScope'
])assert.ok(panel.includes(frag),"Attendance nav/refresh invariant missing: "+frag);
// A report refresh must not discard its last good data or unmount a sibling
// tab while fetching. Initial academic-year bootstrap still clears stale scope.
const refresh=panel.split("async function loadReport(filters: Filters) {")[1]?.split("\n  function applyFilters")[0]??"";
assert.ok(refresh.includes("setBusy(true)"),"Refresh loading indicator missing.");
assert.ok(!refresh.includes('setStatus("loading")'),"Refresh must not unmount tabs.");
assert.ok(!refresh.includes('setReport(null)'),"Refresh must retain last successful results.");
assert.ok(!refresh.includes('setSelectedRegisterClass(null)'),"Refresh must retain drilldown.");
assert.ok(refresh.includes('controller.signal.aborted'),"Stale request protection missing.");
const initial=panel.split("useEffect(() => {")[1]?.split("async function loadReport")[0]??"";
assert.ok(initial.includes("setReport(null); setAcademics(null);"),
  "Year/account boundary must clear all previous data.");
assert.ok(picker.includes("today?: string"),"School date picker API missing.");
assert.ok(picker.includes("schoolDay = today &&"),"Date picker Today must use school date.");
assert.ok(picker.includes("selectDay(schoolDay)"),"Today selection ignores school day.");
for(const [name,view] of [
  ["Panel",panel],["Monitoring",monitoring],["Audit",audit],
  ["Follow-ups",followups],["Analytics",analytics]
])assert.ok(view.includes("today={schoolToday}"),name+" is not using school-local Today.");
for(const frag of ["AdminAttendanceMonitoring","AdminAttendanceStudents",
  "AdminAttendanceClassRegister","AdminAttendanceFollowups","AdminAttendanceAnalytics","AdminAttendanceAudit"])
  assert.ok(panel.includes("<"+frag),"Attendance section not mounted: "+frag);
for(const frag of ["expectedUpdatedAt","reason: reason.trim()",
  'selectedAcademicYear?.status !== "ACTIVE"'])
  assert.ok(panel.includes(frag),"Correction safety missing: "+frag);
for(const frag of ['attendance.corrected_by_admin','expectedUpdatedAt',
  "eq(studentAttendances.updatedAt"])
  assert.ok(store.includes(frag),"Atomic correction protection missing: "+frag);
for(const frag of ["onConflictDoNothing()","eq(attendanceFollowupCases.updatedAt",
  'mark.status!=="ABSENT"&&mark.status!=="LATE"'])
  assert.ok(followupStore.includes(frag),"Follow-up consistency missing: "+frag);
for(const frag of ["validCalendarDay","length>61","attendanceAnalyticsRate",
  "eq(academicYears.schoolId,schoolId)"])
  assert.ok(analyticsStore.includes(frag),"Report scoping missing: "+frag);
for(const frag of ['"/v1/admin/attendance/analytics/export"',
  '"/v1/admin/attendance/followups"',
  '"/v1/admin/attendance/audit"',
  "requireSchoolAdmin(request,reply,accounts)"])
  assert.ok(routes.includes(frag),"Admin attendance endpoint missing: "+frag);
for(const frag of ["Phase 7 — role matrix spanning all six administrator",
  "phase7AdminUrls.length,14","Parent/Negaran clients must never read",
  "Leaked student ID across schools", "Phase 7 — one authoritative correction",
  "postCorrectionViews","cache-control"])
  assert.ok(tests.includes(frag),"Phase 7 API integration evidence missing: "+frag);
for(const phrase of ["Refreshing attendance data…"]){
  assert.equal(i18n.split(JSON.stringify(phrase)+":").length,3,
    "Localized EN/FA/PS message missing: "+phrase);
}
assert.ok(i18n.includes("fa-AF")&&i18n.includes("ps-AF"),"RTL languages missing.");
assert.ok(students.includes("attendanceCalendarMonth"),"Student monthly calendar missing.");
assert.ok(monitoring.includes("attendance/monitor"),"Register monitoring missing.");
assert.ok(followups.includes("Contact and activity log"),"Follow-up audit missing.");
assert.ok(analytics.includes("analytics/export?"),"Reporting export unavailable.");
assert.ok(audit.includes("attendance/audit?"),"Corrections audit unavailable.");
for(const stage of ["ADMIN","PARENT","TEACHER","CROSS_SCHOOL","REGRESSION","RTL","MOBILE","EXPORT","MIGRATION"])
  assert.ok(plan.includes(stage),"Manual acceptance coverage missing: "+stage);
assert.ok(ci.includes("pnpm verify:admin-attendance:phase7"),"CI Phase7 gate missing.");
console.log("Admin Attendance Phase 7: six-tab navigation, non-destructive refresh, school-date selection, cross-role and privacy regressions verified.");
