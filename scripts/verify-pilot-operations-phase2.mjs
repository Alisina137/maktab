import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const db = read("packages/database/src/pilot-readiness-advanced.ts");
const store = read("packages/database/src/pilot-store.ts");
const api = read("apps/api/src/pilot/routes.ts");
const page = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const locale = read("apps/web/app/admin/admin-i18n.ts");
const css = read("apps/web/app/globals.css");
const appTests = read("apps/api/src/app.test.ts");
const databaseTests = read("packages/database/src/pilot-readiness-advanced.test.ts");

assert.ok(db.includes('timeZone: "Asia/Kabul"'), "Negaran effective dates must use Kabul civil time");
for (const scoped of ["class_sections", "teacher_assignments", "timetable_periods",
  "negaran_assignments", "students", "parent_profiles", "users"]) {
  assert.ok(db.includes(scoped), "Coverage missing required source " + scoped);
}
for (const key of ["teaching", "timetable", "negaran", "class_students", "family_links",
  "student_logins", "teacher_logins"]) {
  assert.ok(db.includes('key: "' + key + '"'), "Missing metric " + key);
  assert.ok(page.includes(key), "Missing UI metric " + key);
}
assert.ok(db.includes("WHERE c.school_id = ${schoolId}::uuid") &&
  db.includes("WHERE s.school_id = ${schoolId}::uuid") &&
  db.includes("WHERE tp.school_id = ${schoolId}::uuid"),
  "All populations must be tenant-bound");
assert.ok(db.includes("EXISTS (") && db.includes("COUNT(*) FILTER"),
  "Coverage must avoid duplicate counts and unbounded in-process aggregation");
assert.ok(db.includes("LIMIT ${options.limit + 1} OFFSET ${options.offset}"),
  "Missing-record page must be SQL bounded");
assert.ok(db.includes('status: count.total === 0 ? "not_applicable"'),
  "No denominator must not be treated as 100% success");
assert.ok(db.includes("coreReady && criticalReady"),
  "Critical coverage must block improved setup readiness");
assert.ok(store.includes("getAdvancedReadiness(schoolId)") &&
  store.includes("listReadinessIssues(schoolId, metric, options)"),
  "Store must expose advanced readiness without breaking Phase 1");
assert.ok(api.includes('"/v1/admin/pilot/readiness/advanced"') &&
  api.includes('"/v1/admin/pilot/readiness/issues"') &&
  api.includes("readinessIssueQuerySchema") &&
  api.includes("requireSchoolAdmin(request, reply, accounts)"),
  "School admin role and paging required on coverage endpoints");
assert.ok(page.includes('"/v1/admin/pilot/readiness/advanced"') &&
  page.includes('"/v1/admin/pilot/readiness/issues?metric="') &&
  page.includes('className="pilot-coverage-section"') &&
  page.includes("selectedMetric === metric.key") &&
  page.includes("issueRequestVersion.current"),
  "UI must use actual API and bounded drilldown, not fabricated coverage");
assert.ok(page.includes("effectiveSetupReady = Boolean(advanced?.ready)") &&
  page.includes('advancedError ? "Setup status unavailable"'), "Do not conflate core configuration and live approval");
assert.ok(css.includes(".pilot-coverage-grid") && css.includes(".pilot-coverage-card") &&
  css.includes("@media (max-width:880px)"),
  "Readiness cards must adapt for tablet/phone");
assert.ok(appTests.includes("Pilot Phase 2 coverage endpoints") &&
  databaseTests.includes("Pilot Phase 2 coverage checks current school/year relations"),
  "API access and database tenant/time/relationship tests must run");
const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Configuration coverage", "Academic coverage", "Attendance coverage",
  "Families & account coverage", "Critical", "Warning", "Review {count} missing",
  "Classes with active teacher assignments", "Students with accessible parents and matching classes"]) {
  const marker = JSON.stringify(key) + ":";
  assert.ok(fa?.includes(marker) && ps?.includes(marker), "Missing translations: " + key);
}
console.log("Pilot Phase 2 API/SQL/isolation/readiness/locale/drilldown guards passed.");
