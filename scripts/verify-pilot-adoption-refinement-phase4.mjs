import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const db = read("packages/database/src/pilot-adoption-store.ts");
const store = read("packages/database/src/pilot-store.ts");
const exports = read("packages/database/src/index.ts");
const api = read("apps/api/src/pilot/routes.ts");
const page = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const navigation = read("apps/web/app/admin/pilot-operations-navigation.tsx");
const ui = read("apps/web/app/admin/pilot-adoption-panel.tsx");
const workspace = read("apps/web/app/admin/admin-workspace.tsx");
const styles = read("apps/web/app/globals.css");
const locale = read("apps/web/app/admin/admin-i18n.ts");
const dbTests = read("packages/database/src/pilot-readiness-advanced.test.ts");
const apiTests = read("apps/api/src/app.test.ts");
assert.ok(db.includes('["today", "7d", "30d"]') && db.includes('timeZone: "Asia/Kabul"'),
  "Usage periods must be bounded to 1, 7 and 30 Kabul civil days");
assert.ok(db.includes("getPilotAdoptionReport") && db.includes("FROM users u WHERE u.school_id = ${schoolId}::uuid"),
  "Account activity must be aggregated in SQL within the authorized school");
assert.ok(db.includes("u.status = 'ACTIVE'") &&
  db.includes("y.status = 'ACTIVE'") && db.includes("s.status = 'ACTIVE'"),
  "Only active school roles and current-year student population count as eligible");
assert.ok(db.includes("u.last_login_at") && db.includes("last_login_at BETWEEN"),
  "Recent sign-ins must originate from real last-login records");
assert.ok(db.includes("must_change_password") && db.includes("activatedPercent"),
  "Account onboarding must distinguish activation from sign-in");
for (const source of ["homework_submissions", "homeworks", "daily_attendances",
  "student_attendances", "announcements"]) {
  assert.ok(db.includes(source), "Missing actual educational event source: " + source);
}
assert.ok(db.includes("firstDay") && db.includes("submitted_at <=") &&
  db.includes("publish_at BETWEEN"),
  "Class-day dates and publication timestamps must obey the selected window");
assert.ok(db.includes("eligible ? Math.round") &&
  db.includes("signedInPercent: eligible ?") && db.includes("null"),
  "Zero eligible accounts must not produce fake completion percentages");
assert.ok(store.includes("getAdoptionReport(schoolId, window)") &&
  exports.includes('export * from "./pilot-adoption-store.js";'),
  "PilotStore must expose the adoption model");
assert.ok(api.includes('"/v1/admin/pilot/adoption"') &&
  api.includes("adoptionQuerySchema.parse(request.query)") &&
  api.includes("requireSchoolAdmin(request, reply, accounts)") &&
  api.includes("pilot.getAdoptionReport(context.user.schoolId, window)") &&
  api.includes('reply.header("cache-control", "no-store")'),
  "Authenticated school-scoped route must validate periods and be uncached");
assert.ok(navigation.includes('section: "adoption"') &&
  navigation.includes('href: "/admin/pilot/adoption"') &&
  page.includes('<PilotAdoptionPanel') &&
  page.includes('if (section === "adoption" || section === "service" || section === "oversight") {'),
  "Route-backed tab must be independent of other readiness API calls");
assert.ok(ui.includes('Authorization: `Bearer ${accessToken}`') &&
  ui.includes('new AbortController()') && ui.includes('return () => abort.abort()') &&
  ui.includes('cache: "no-store"'), "Usage UI must protect against stale sessions");
assert.ok(ui.includes('aria-pressed={window === item.value}') &&
  ui.includes("setRevision") && ui.includes("signedInPercent === null"),
  "Usage filters require keyboard state, retry and honest missing-data labels");
assert.ok(ui.includes("last login only") &&
  ui.includes("not completion or participation rates."),
  "Sign-ins and event records must not be misrepresented as DAU or learning success");
assert.ok(workspace.includes('"/admin/pilot/adoption"') &&
  styles.includes(".pilot-adoption-role-grid") &&
  styles.includes(".pilot-adoption-event-grid"),
  "Adoption requires route copy and responsive dashboard");
assert.ok(dbTests.includes("Pilot refinement Phase 4:") &&
  dbTests.includes("otherAdoption") && dbTests.includes("thirtyDays") &&
  apiTests.includes("Pilot refinement Phase 4 usage reporting is school-scoped"),
  "API and database integration tests must cover tenant and time-window isolation");
const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Usage & adoption", "Reporting period", "Last 7 days",
  "Homework published", "Sign-in coverage", "Educational activity records"]) {
  assert.ok(fa?.includes(JSON.stringify(key)+":") && ps?.includes(JSON.stringify(key)+":"),
    "Missing Dari/Pashto translation " + key);
}
console.log("Pilot Phase 4 usage and adoption security, time, UX, locale and test guards passed.");
