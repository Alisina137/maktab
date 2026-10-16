import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const db = read("packages/database/src/pilot-oversight-store.ts");
const store = read("packages/database/src/pilot-store.ts");
const exports = read("packages/database/src/index.ts");
const api = read("apps/api/src/pilot/routes.ts");
const ui = read("apps/web/app/admin/pilot-oversight-panel.tsx");
const pilot = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const navigation = read("apps/web/app/admin/pilot-operations-navigation.tsx");
const release = read("packages/database/src/pilot-release-readiness.ts");
const layout = read("apps/web/app/admin/admin-workspace.tsx");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const test = read("apps/api/src/app.test.ts");
const dates = read("packages/database/src/pilot-oversight-store.test.ts");

assert.ok(db.includes('["7d", "30d", "90d"]') && db.includes('timeZone: "Asia/Kabul"') &&
  db.includes('T00:00:00+04:30') && dates.includes("Kabul civil midnight"),
  "Bounded time filters must honor Kabul midnight with regression tests");
for(const entity of ["pilot_support_updates s","pilot_launch_decision_history d",
  "family_import_batches b","audit_logs a"]) {
  assert.ok(db.includes(entity), "Missing independently recorded operational event " + entity);
}
for(const predicate of ["s.school_id = ${schoolId}::uuid", "d.school_id = ${schoolId}::uuid",
  "b.school_id = ${schoolId}::uuid", "a.school_id = ${schoolId}::uuid"]) {
  assert.ok(db.includes(predicate), "Tenant isolation is missing: " + predicate);
}
assert.ok(db.includes("'pilot.evidence_submitted'") &&
  db.includes("'pilot.evidence_reviewed'") &&
  db.includes("'pilot.audit_exported'") &&
  db.includes("'pilot.exported'") &&
  db.includes("'PILOT_APPROVED'") &&
  db.includes("'PILOT_NOT_APPROVED'"), "Allowlisted audit action mapping is required");
assert.ok(db.includes("ORDER BY occurred_at DESC, kind ASC, id DESC") &&
  db.includes("LIMIT ${limit + 1} OFFSET ${offset}") &&
  db.includes("Math.min(30, Math.max(1") &&
  db.includes("Math.min(50_000, Math.max(0"), "Timeline must be stable, limited and paginated");
for(const secret of ["operator_label", "operatorLabel", "e.reference", "password_hash",
  "review_note", "s.note", "t.description", "b.reason", "a.metadata", "access_token"]) {
  assert.ok(!db.includes(secret), "Timeline must not expose private field: " + secret);
}
assert.ok(store.includes("listOversightEvents(schoolId, options)") &&
  exports.includes('export * from "./pilot-oversight-store.js";'),
  "Store API must expose school-scoped oversight");
assert.ok(api.includes('"/v1/admin/pilot/oversight"') &&
  api.includes("requireSchoolAdmin(request, reply, accounts)") &&
  api.includes("oversightQuerySchema.parse(request.query)") &&
  api.includes("pilot.listOversightEvents(context.user.schoolId, options)") &&
  api.includes('reply.header("cache-control", "no-store")'),
  "Oversight API must be strictly filtered, authenticated, scoped and noncached");
assert.ok(api.includes('.max(30)') && api.includes('.max(50_000)') &&
  api.includes('z.enum(["ALL", "SUPPORT", "EVIDENCE", "DECISION", "IMPORT", "EXPORT"])'),
  "Only known kinds, limits and offsets may be accepted");
assert.ok(navigation.includes('section: "oversight"') &&
  navigation.includes('href: "/admin/pilot/oversight"') &&
  pilot.includes('<PilotOversightPanel') &&
  pilot.includes('section === "oversight"') &&
  pilot.includes('section === "adoption" || section === "service" || section === "oversight"'),
  "Ops tab must render independently of unrelated dashboard load failures");
assert.ok(release.includes('productionDecision: "NO_GO"') &&
  ui.includes('PRODUCTION NO-GO') &&
  ui.includes("Independent Step 20 evidence and operator sign-off are required.") &&
  !ui.includes("approveProduction"), "UI must not infer or mutate production approval");
assert.ok(ui.includes("new AbortController()") && ui.includes("controller.abort()") &&
  ui.includes('cache: "no-store"') &&
  ui.includes('Authorization: `Bearer ${accessToken}`') &&
  ui.includes('value={window}') && ui.includes('value={kind}') &&
  ui.includes("setOffset(0)") && ui.includes("setRevision"),
  "Navigation, filters and retry must be safe and accessible");
assert.ok(ui.includes('/v1/admin/pilot/release-readiness') &&
  ui.includes('/v1/admin/pilot/oversight?') &&
  ui.includes("Pilot approval is not independent authorization") &&
  ui.includes("private ticket notes") &&
  ui.includes("timeline does not replace the full audit history"),
  "Release readiness and audit timeline must remain distinct");
assert.ok(css.includes(".pilot-oversight-gates") &&
  css.includes(".pilot-oversight-list") &&
  css.includes("@media (max-width: 600px)") &&
  layout.includes('"/admin/pilot/oversight"'),
  "Responsive layout and route metadata required");
assert.ok(test.includes("Pilot refinement Phase 6 oversight timeline enforces school") &&
  test.includes('url: endpoint + "?window=30d&kind=IMPORT"') &&
  test.includes('url: endpoint + "?window=7d&kind=EVIDENCE"') &&
  test.includes("secondPage.events") &&
  test.includes('productionDecision, "NO_GO"'),
  "Integration tests must cover paging, cross-school isolation, filters and NO-GO");
const fa = i18n.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = i18n.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Operations oversight", "Operational event history", "Last 90 days",
  "Evidence reviews", "Pilot decisions", "Operational event recorded", "Production release gate"]) {
  const needle = JSON.stringify(key) + ":";
  assert.ok(fa?.includes(needle) && ps?.includes(needle), "Missing Dari/Pashto copy: " + key);
}
console.log("Pilot Phase 6 operational oversight school scope, time filters, privacy, UI and release gate guards passed.");
