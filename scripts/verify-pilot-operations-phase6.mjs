import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../"+p, import.meta.url),"utf8");
const sql = read("packages/database/drizzle/0021_pilot_launch_support.sql");
const schema = read("packages/database/src/schema.ts");
const store = read("packages/database/src/pilot-launch-store.ts");
const routes = read("apps/api/src/pilot/launch-routes.ts");
const platform = read("apps/api/src/platform/routes.ts");
const web = read("apps/web/app/admin/pilot-launch-support-panel.tsx");
const panel = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const tests = read("apps/api/src/app.test.ts");

for (const table of ["pilot_launch_evidence","pilot_support_tickets","pilot_support_updates",
  "pilot_launch_decisions","pilot_launch_decision_history"]) {
  assert.ok(sql.includes(`"${table}"`) && schema.includes(`"${table}"`), "Missing durable table: "+table);
}
assert.ok(sql.includes("pilot_launch_evidence_school_category_unique") &&
  sql.includes("REFERENCES") && sql.includes("CHECK") &&
  sql.includes("pilot_support_updates_ticket_time_idx"),
  "Migration must enforce stable categories, valid states and foreign keys");
assert.ok(store.includes("await lockSchool(tx, schoolId)") &&
  store.includes('tx.select({ id: schools.id })') &&
  store.includes('.for("update")') &&
  store.includes("invalidateLaunch") &&
  store.includes("PILOT_EVIDENCE_CATEGORIES.some") &&
  store.includes("Unresolved critical support tickets prevent approval.") &&
  store.includes("setupReady"), "Approval must fail closed and serialize tenant operations");
assert.ok(routes.includes('"/v1/admin/pilot/launch"') &&
  routes.includes('"/v1/admin/pilot/launch/evidence"') &&
  routes.includes('"/v1/admin/pilot/support"') &&
  routes.includes("requireSchoolAdmin") &&
  routes.includes('"/v1/platform/pilot/schools/:schoolId/launch/decision"') &&
  routes.includes("allowSecurityWriteWhenSubscriptionBlocked") &&
  platform.includes("registerPlatformPilotWorkflowRoutes(app, launch, pilot)") &&
  platform.includes("x-platform-provisioning-key"),
  "School and platform route privileges must stay separate");
assert.ok(web.includes("AbortController") && web.includes("sessionVersion") &&
  web.includes("Create support ticket") && web.includes("Submit for platform review") &&
  !web.includes('"/v1/platform/') && panel.includes("PilotLaunchSupportPanel") &&
  panel.includes('section === "launch"'),
  "School UI must be readable, abort stale requests and never expose platform actions");
assert.ok(css.includes("@media(max-width:600px)") && css.includes(".pilot-workflow-checks"),
  "Responsive UI styles missing");
const fa = i18n.split("const fa: Record<string, string> = {")[1].split("const ps: Record<string, string> = {")[0];
const ps = i18n.split("const ps: Record<string, string> = {")[1].split("export function adminText(")[0];
for (const key of ["Launch evidence and support","Support tickets","Submit for platform review",
  "Platform launch decision","Device accessibility and RTL evidence","No support tickets yet."]) {
  const literal=JSON.stringify(key)+":";
  assert.ok(fa.includes(literal) && ps.includes(literal), "Missing Dari/Pashto: "+key);
}
assert.ok(tests.includes("Pilot Phase 6 launch evidence") && tests.includes("Pilot Phase 6 school support tickets"),
  "Phase 6 endpoint regressions must be in API suite");
console.log("Pilot Phase 6 contract, permissions, migrations, localization and regression guards passed.");
