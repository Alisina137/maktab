import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const model = read("apps/web/app/admin/pilot-service-health-model.ts");
const ui = read("apps/web/app/admin/pilot-service-health-panel.tsx");
const store = read("packages/database/src/pilot-service-health-store.ts");
const route = read("apps/api/src/pilot/routes.ts");
const tests = read("apps/web/app/admin/pilot-service-health-model.test.ts");
const storeTests = read("packages/database/src/pilot-service-health-store.test.ts");
const styles = read("apps/web/app/globals.css");
const locales = read("apps/web/app/admin/admin-i18n.ts");
for (const token of [
  "parseServiceHealthResponse", "serviceFollowUps", "stalePending > pending",
  "unresolvedCritical > unresolved", "Independent service checks are not verified.",
  "operationalWritesBlocked !== blocked", "pending > queue.stalePending"
]) assert.ok(model.includes(token), "Service triage invariant missing: " + token);
for (const token of [
  "parseServiceHealthResponse(body)", "serviceFollowUps(data)",
  'cache: "no-store"', "new AbortController()", "controller.abort()",
  'showUnverified', 'aria-labelledby="pilot-service-triage-title"',
  'href={item.href}', "pilot-service-triage-stats"
]) assert.ok(ui.includes(token), "Service UI missing safeguard: " + token);
assert.ok(ui.includes("Zero alerts must never be treated as proof"));
assert.ok(!ui.includes('method: "POST"') && !ui.includes('method: "PATCH"'),
  "Service health must remain read only.");
for (const token of [
  'n.school_id = ${schoolId}::uuid', 't.school_id = ${schoolId}::uuid',
  'b.school_id = ${schoolId}::uuid',
  "Incomplete service health aggregate.", "Contradictory service health aggregate.",
  'Number.isSafeInteger(value)', "unverified: [\"scheduler\", \"push_delivery\", \"backups\", \"uptime_history\"]"
]) assert.ok(store.includes(token), "Aggregate safety rule missing: " + token);
assert.ok(route.includes('"/v1/admin/pilot/service-health"') &&
  route.includes("requireSchoolAdmin(request, reply, accounts)") &&
  route.includes("pilot.getServiceHealth(context.user.schoolId)"));
assert.ok(tests.includes("Phase 5 malformed service counts"));
assert.ok(storeTests.includes("Phase 5 service report rejects missing and invalid aggregates"));
assert.ok(styles.includes(".pilot-service-triage-list") &&
  styles.includes(".pilot-service-triage-unverified"));
const fa = locales.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locales.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of [
  "Priority service checks", "Recommended service follow-ups",
  "Review failed notification records", "Independent infrastructure checks are outstanding"
]) assert.ok(fa?.includes(JSON.stringify(key)+":") && ps?.includes(JSON.stringify(key)+":"),
  "Missing locale: "+key);
console.log("Pilot Operations improvements Phase 5 service and monitoring guards passed.");
