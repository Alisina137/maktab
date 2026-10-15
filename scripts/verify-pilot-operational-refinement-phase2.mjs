import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

const sql = read("packages/database/src/pilot-readiness-operational.ts");
const store = read("packages/database/src/pilot-store.ts");
const api = read("apps/api/src/pilot/routes.ts");
const ui = read("apps/web/app/admin/pilot-operational-readiness-panel.tsx");
const parent = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const dbTests = read("packages/database/src/pilot-readiness-advanced.test.ts");
const apiTests = read("apps/api/src/app.test.ts");

for (const key of ["teacher_overlap", "class_overlap", "assignment_gap", "invalid_period"]) {
  assert.ok(sql.includes('"' + key + '"'), "Missing operational metric: " + key);
  assert.ok(ui.includes(key), "UI must show metric: " + key);
  assert.ok(api.includes(key), "Server must explicitly allowlist metric: " + key);
}
assert.ok(sql.includes("tt.school_id = ${schoolId}::uuid"),
  "Timetable population must filter school on server");
assert.ok(sql.includes("ay.school_id = tt.school_id AND ay.status = 'ACTIVE'"),
  "Do not include archived or other-school academic years");
assert.ok(sql.includes("c.academic_year_id = tt.academic_year_id"),
  "Class/year relationships must match");
assert.ok(sql.includes("peer.academic_year_id = me.academic_year_id"),
  "Conflicts must not cross academic years");
assert.ok(sql.includes("me.starts_at < peer.ends_at AND peer.starts_at < me.ends_at"),
  "Only actual intersecting periods are conflicts; adjacent periods allowed");
assert.ok(sql.includes("u.role = 'TEACHER' AND u.status = 'ACTIVE'"),
  "Periods must have matching ACTIVE teacher assignments");
assert.ok(sql.includes("starts_at ~") && sql.includes("starts_at < ends_at") &&
  sql.includes("weekday <> 'FRIDAY'"), "Validate time format, ordering and allowed teaching days");
assert.ok(sql.includes("COUNT(*) FILTER") && sql.includes("LIMIT ${options.limit + 1} OFFSET ${options.offset}"),
  "Counts must use SQL aggregation and issue drilldowns must be bounded");
assert.ok(sql.includes("evaluatedPeriods > 0"), "Empty timetable must not be marked ready");
assert.ok(store.includes("getOperationalReadiness(schoolId)") &&
  store.includes("listOperationalIssues(schoolId, metric, options)"),
  "Store must wire both new methods");
assert.ok(api.includes('"/v1/admin/pilot/readiness/operational"') &&
  api.includes('"/v1/admin/pilot/readiness/operational/issues"') &&
  api.includes("operationalIssueQuerySchema") && api.includes("requireSchoolAdmin(request, reply, accounts)"),
  "Pilot operational endpoints must remain authenticated school admin only");
assert.ok(ui.includes('cache: "no-store"') && ui.includes("new AbortController()") &&
  ui.includes("return () => abort.abort()"),
  "Operational UI must protect against stale school/session requests");
assert.ok(ui.includes('aria-expanded={selected === metric.key}') &&
  ui.includes("setIssueRevision") && ui.includes("setOffset"),
  "Issue drilldowns must be accessible, paginated and independently retryable");
assert.ok(parent.includes("<PilotOperationalReadinessPanel") &&
  parent.includes('section === "readiness" ? ('),
  "Operational checks must appear within School Readiness");
assert.ok(css.includes(".pilot-operational-grid") && css.includes(".pilot-operational-card") &&
  css.includes("@media (max-width: 780px)"), "Operational cards must be responsive");
assert.ok(dbTests.includes("Pilot Operations refinement Phase 2") &&
  dbTests.includes("teacher_overlap") && dbTests.includes("invalid_period"),
  "Database tests must exercise clashes and invalid timetables");
assert.ok(apiTests.includes("Operational readiness is scoped to the authenticated school") &&
  apiTests.includes("operationalIssueQuerySchema") === false,
  "Endpoint tests must validate auth and invalid queries without direct server implementation bypass");
for (const key of ["Operational validation", "Timetable integrity", "Teacher double-bookings",
  "Overlapping class periods", "Periods without matching active teacher assignments",
  "Invalid times or Friday periods", "Operational checks could not be loaded."]) {
  const fa = i18n.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
  const ps = i18n.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
  assert.ok(fa?.includes(JSON.stringify(key) + ":") && ps?.includes(JSON.stringify(key) + ":"),
    "Missing Dari/Pashto translation: " + key);
}
console.log("Pilot Operations refinement Phase 2 tenant/readiness/conflict/UI/i18n guards passed.");
