import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const panel = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const navigation = read("apps/web/app/admin/pilot-operations-navigation.tsx");
const activity = read("apps/web/app/admin/pilot-overview-activity.tsx");
const styles = read("apps/web/app/globals.css");
const locale = read("apps/web/app/admin/admin-i18n.ts");

assert.match(panel, /Promise\.allSettled\(\[/, "Subscription/readiness failures must be isolated");
assert.match(panel, /setSubscription\(subscriptionResult\.value\.subscription\)/,
  "Subscription cards must use the server response");
assert.match(panel, /setReadiness\(readinessResult\.value\)/,
  "School counts must use the server response");
assert.match(panel, /section === "launch" \? \(/,
  "Support must render independently of readiness API");
assert.doesNotMatch(panel, /section === "launch" && readiness/,
  "Support must not depend on readiness succeeding");
assert.match(panel, /<PilotOperationsNavigation section=\{section\} locale=\{locale\}/,
  "Tab navigation must remain mounted");
assert.match(navigation, /aria-current=\{section === tab\.section/,
  "Current route must remain selected");
assert.match(navigation, /pilot-section-nav/, "Grouped desktop navigation required");
assert.match(navigation, /pilot-nav-mobile/, "Mobile switcher required");

const statKeys = ["Students", "Teachers", "Parents", "Classes", "Subjects",
  "Assignments", "Academic years", "Core setup checks"];
for (const key of statKeys) {
  assert.ok(panel.includes('label: "' + key + '"'), "Missing real dashboard metric: " + key);
}
assert.match(panel, /pilot-dashboard-stat/, "Statistics must navigate to their underlying modules");
assert.match(panel, /advanced\?\.metrics\.filter\(\(metric\) => metric\.missing > 0\)/,
  "Advanced school gaps must come from server metrics");
assert.match(panel, /coverageDestinations\[metric\.key\]/,
  "Advanced gaps must deep link to corrective actions");
assert.match(panel, /CHECK_DESTINATIONS\[check\.key\]/,
  "Core gaps must retain corrective actions");
assert.match(panel, /subscription\.status === "PAST_DUE"/,
  "Subscription warnings must use actual subscription state");
assert.match(panel, /advancedError \? "Setup status unavailable"/,
  "Advanced request failures must not display false setup readiness");
assert.match(panel, /No current configuration or subscription warnings\./,
  "All-clear is conditional on receiving advanced and subscription data");

assert.match(activity, /\/v1\/admin\/pilot\/audit\?limit=6&offset=0/,
  "Recent activities must use the authenticated school-scoped audit endpoint");
assert.match(activity, /Authorization: `Bearer \$\{accessToken\}`/,
  "Audit preview must authenticate");
assert.match(activity, /cache: "no-store"/, "Activity must not be cached across schools");
assert.match(activity, /new AbortController\(\)/, "Activity must abort stale session requests");
assert.match(activity, /return \(\) => controller\.abort\(\)/,
  "Activity must clean up requests on session switch");
assert.match(activity, /adminErrorText/, "Activity failures must provide a recoverable error");
assert.match(activity, /setRevision/, "Activity errors must be retryable");
assert.ok(!activity.includes("/v1/platform/"), "Never expose platform controls to school admins");

for (const key of ["Recent school activity", "View details", "Resolve",
  "Setup status unavailable", "Advanced coverage unavailable; no all-clear can be confirmed."]) {
  const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
  const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
  assert.ok(fa?.includes(JSON.stringify(key) + ":") && ps?.includes(JSON.stringify(key) + ":"),
    "Missing Dari/Pashto translation: " + key);
}
for(const cls of [".pilot-dashboard-stats", ".pilot-dashboard-stat:focus-visible",
  ".pilot-activity-list", ".pilot-retry-alert"]) {
  assert.ok(styles.includes(cls), "Missing accessible overview style: " + cls);
}
assert.match(styles, /@media \(max-width: 560px\)/, "Small screens need responsive cards");
console.log("Pilot Operations overview refinement Phase 1 source/tenant/RTL guards passed.");
