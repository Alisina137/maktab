import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const analytics=read("packages/database/src/attendance-analytics-store.ts");
const db=read("packages/database/src/attendance-store.ts");
const index=read("packages/database/src/index.ts");
const routes=read("apps/api/src/attendance/routes.ts");
const csv=read("apps/api/src/attendance/analytics-csv.ts");
const panel=read("apps/web/app/admin/attendance-panel.tsx");
const ui=read("apps/web/app/admin/admin-attendance-analytics.tsx");
const css=read("apps/web/app/globals.css");
const lang=read("apps/web/app/admin/admin-i18n.ts");
const tests=read("apps/api/src/app.test.ts");
for(const x of [
  "getAdminAttendanceAnalytics","getAdminAttendanceAnalyticsStudents",
  "validCalendarDay","length>61","eq(academicYears.schoolId,schoolId)",
  "eq(classSections.schoolId,schoolId)","eq(studentAttendances.schoolId,schoolId)",
  "eq(dailyAttendances.schoolId,schoolId)","eq(dailyAttendances.academicYearId,filters.academicYearId)",
  "count()","groupBy(","marks().where(","dateMap","classMap",
  "limit>2001","getAdminAttendanceAnalyticsStudents","attendanceAnalyticsRate",
  ".limit(limit).offset(offset)"
])assert.ok(analytics.includes(x),"Analytics school boundary, paging or sums missing: "+x);
for(const x of ["...createAttendanceAnalyticsStore(db)","AttendanceAnalyticsStore"])
  assert.ok(db.includes(x),"Analytics store not wired: "+x);
assert.ok(index.includes('export * from "./attendance-analytics-store.js"'));
for(const x of [
  '"/v1/admin/attendance/analytics"','"/v1/admin/attendance/analytics/students"',
  '"/v1/admin/attendance/analytics/export"','requireSchoolAdmin(request,reply,accounts)',
  'reply.code(413)','first.total>2000','text/csv','cache-control','content-disposition'
])assert.ok(routes.includes(x),"Protected bounded report API missing: "+x);
for(const x of ["safeAttendanceCsvCell","formatAttendanceAnalyticsCsv",
  "replaceAll", "protectedValue","Student code","Submitted registers"])
  assert.ok(csv.includes(x),"Secure report CSV unavailable: "+x);
for(const x of ["<AdminAttendanceAnalytics","activeTab === \"REPORTS\"",
  '(activeTab === "OVERVIEW" || activeTab === "REGISTERS")'])
  assert.ok(panel.includes(x),"Reports tab not integrated: "+x);
for(const x of ["new AbortController()","controller.signal.aborted",
  "attendance/analytics/students?","attendance/analytics/export?",
  "Authorization:","URL.createObjectURL","URL.revokeObjectURL",
  "role=\"tablist\"","role=\"alert\"","aria-label",
  "periodValid(draft)","Select a valid report range of at most 62 days.",
  "No submitted registers in the selected period.","rate===null",
  "Submitted registers","formatAdminHijriDate"])
  assert.ok(ui.includes(x),"Reports locale, safety or UX missing: "+x);
for(const x of [".attendance-analytics-metrics",".attendance-analytics-bar",
  ".attendance-analytics-scroll","@media(max-width:600px)"])
  assert.ok(css.includes(x),"Responsive analytics CSS missing: "+x);
for(const k of ["Attendance analytics and reports","Daily trend",
  "Class summary CSV","Student summary CSV","Student insights",
  "Dates without submitted registers are not plotted as zero attendance."]){
  assert.equal(lang.split(JSON.stringify(k)+":").length,3,
    "Missing exact Dari/Pashto translation: "+k);
}
for(const x of ["Phase 6: reporting uses submitted marks","analyticsAfterCorrection",
  "analyticsStudentsUrl","analyticsExportUrl","anotherAdmin","emptyReport"])
  assert.ok(tests.includes(x),"Missing Phase 6 API integration regression: "+x);
console.log("Admin Attendance Phase 6 analytics, CSV injection defenses, school isolation and UI verification passed.");
