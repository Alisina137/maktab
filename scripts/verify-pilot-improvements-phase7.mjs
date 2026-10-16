import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const model = read("apps/web/app/admin/pilot-subscription-guidance-model.ts");
const tests = read("apps/web/app/admin/pilot-subscription-guidance-model.test.ts");
const ui = read("apps/web/app/admin/pilot-subscription-health.tsx");
const steps = read("apps/web/app/admin/pilot-subscription-next-steps.tsx");
const page = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const api = read("apps/api/src/pilot/routes.ts");
const base = read("packages/database/src/subscription-health.ts");
const css = read("apps/web/app/globals.css");
const locale = read("apps/web/app/admin/admin-i18n.ts");

for (const key of ["parseSubscriptionHealth", "subscriptionCheckpoints",
  "subscriptionNextActions", "Contradictory subscription dates.",
  "Contradictory subscription health.", "expiry !==",
  "operationalWritesBlocked !== blocked", "nextReminderDays !== threshold"])
  assert.ok(model.includes(key), "Subscription protection missing: "+key);
for (const key of ["CANCELLED","SUSPENDED","GRACE_ENDED","GRACE_PERIOD",
  "PAST_DUE","EXPIRED_PENDING_UPDATE","EXPIRES_SOON","EXPIRING","NO_EXPIRY","ON_TRACK"])
  assert.ok(model.includes(key), "Lifecycle state missing: "+key);
assert.ok(ui.includes("parseSubscriptionHealth(data)") &&
  ui.includes("new AbortController()") &&
  ui.includes('cache: "no-store"') &&
  ui.includes('Authorization: `Bearer ${accessToken}`') &&
  ui.includes("controller.abort()"));
assert.ok(ui.includes("<PilotSubscriptionNextSteps health={health} locale={locale}"));
assert.ok(page.includes('(section === "subscription" || (section === "overview" && subscription))'),
  "Independent health must be visible if plan details are unavailable.");
assert.ok(steps.includes("subscriptionCheckpoints(health)") &&
  steps.includes("subscriptionNextActions(health)") &&
  steps.includes("No support ticket, payment, or renewal is submitted automatically."));
assert.ok(!steps.includes('method: "POST"') && !steps.includes('method: "PATCH"'));
assert.ok(!ui.includes('method: "POST"') && !ui.includes('method: "PATCH"'));
assert.ok(api.includes('"/v1/admin/pilot/subscription/health"') &&
  api.includes("requireSchoolAdmin(request, reply, accounts)") &&
  api.includes("evaluateSubscriptionHealth(context.subscription)") &&
  api.includes('reply.header("cache-control", "no-store")'));
assert.ok(base.includes("return {") && base.includes("operationalWritesBlocked"));
assert.ok(css.includes(".pilot-subscription-threshold-grid") &&
  css.includes(".pilot-subscription-action-critical"));
assert.ok(tests.includes("Phase 7: forged health records and invalid dates fail closed"));
assert.ok(tests.includes("Phase 7: every recorded subscription state remains consistent"));
const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for(const key of ["Subscription and administration next steps",
  "Expiry reminder checkpoints", "Review school accounts", "Review administrative audit history"]) {
  assert.ok(fa?.includes(JSON.stringify(key)+":") && ps?.includes(JSON.stringify(key)+":"),
    "Missing Phase 7 Dari/Pashto copy: "+key);
}
console.log("Pilot Operations improvement Phase 7 subscription validation, safe support and locale guards passed.");
