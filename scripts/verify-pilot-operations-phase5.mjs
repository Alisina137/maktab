import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const health = read("packages/database/src/subscription-health.ts");
const store = read("packages/database/src/store.ts");
const route = read("apps/api/src/pilot/routes.ts");
const ui = read("apps/web/app/admin/pilot-subscription-health.tsx");
const workspace = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const tests = read("packages/database/src/subscription-health.test.ts");

assert.ok(health.includes('timeZone: "Asia/Kabul"') && health.includes("dayDistance") &&
  health.includes("operationalWritesBlocked") && health.includes("platformReviewNeeded"),
  "Use Afghanistan civil dates and recorded platform status");
for (const state of ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED"]) {
  assert.ok(tests.includes(`"${state}"`), "Status tests must cover " + state);
}
assert.ok(route.includes('"/v1/admin/pilot/subscription/health"') &&
  route.includes("requireSchoolAdmin(request, reply, accounts)") &&
  route.includes('reply.header("cache-control", "no-store")') &&
  route.includes("evaluateSubscriptionHealth(context.subscription)"),
  "Health endpoint must be read-only, authenticated and school-scoped");
assert.ok(store.includes('deepLink: "/admin/pilot/subscription"') &&
  store.includes("return kabulCivilDate()") &&
  store.includes("subscription-expiry:") &&
  store.includes("onConflictDoNothing()"),
  "Existing scheduler should remain deduplicated, Kabul-aware and navigable");
assert.ok(ui.includes("AbortController") && ui.includes("controller.signal.aborted") &&
  ui.includes('cache: "no-store"') && ui.includes("PilotSubscriptionHealthPanel") &&
  ui.includes("No support request or payment is submitted from this page.") &&
  !ui.includes('method: "POST"') && !ui.includes('method: "PATCH"'),
  "Health panel must be cancellable and not provide unauthorised billing writes");
assert.ok(workspace.includes("PilotSubscriptionHealthPanel") && workspace.includes('compact={section === "overview"}'),
  "Overview and subscription section should both use actual health data");
assert.ok(css.includes(".pilot-billing-metrics") && css.includes("@media(max-width:900px)"),
  "Health must adapt to tablet and phone");
const fa = i18n.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = i18n.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Subscription health","Expiry countdown","Subscription expires soon",
  "Grace period has ended","Expiry notifications","Renewal and support"]) {
  const needle = JSON.stringify(key) + ":";
  assert.ok(fa?.includes(needle) && ps?.includes(needle), "Missing Dari/Pashto key: "+key);
}
console.log("Pilot Operations Phase 5 health, privacy, read-only permissions, RTL and reminders gate passed.");
