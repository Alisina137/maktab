import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const src = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const root = read("apps/web/app/admin/(workspace)/pilot/page.tsx");
const launchUi = read("apps/web/app/admin/pilot-launch-support-panel.tsx");
const launchRoutes = read("apps/api/src/pilot/launch-routes.ts");
const nested = read("apps/web/app/admin/(workspace)/pilot/[section]/page.tsx");
const workspace = read("apps/web/app/admin/admin-workspace.tsx");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");

for (const [section, href] of [
  ["overview", "/admin/pilot"],
  ["readiness", "/admin/pilot/readiness"],
  ["onboarding", "/admin/pilot/onboarding"],
  ["subscription", "/admin/pilot/subscription"],
  ["audit", "/admin/pilot/audit"],
  ["launch", "/admin/pilot/launch"]
]) {
  assert.ok(src.includes('section: "' + section + '"') && src.includes('href: "' + href + '"'),
    "Missing route-backed section: " + section);
}
assert.ok(root.includes('section="overview"'), "Default Pilot Operations section must be Overview");
assert.ok(nested.includes("isPilotSection(section)") && nested.includes("useParams"), "Dynamic route must validate sections");
assert.ok(workspace.includes('item.href === "/admin/pilot" && pathname.startsWith("/admin/pilot/")'),
  "Main navigation must highlight Pilot Operations child routes");
assert.ok(src.includes('aria-current={section === item.section ? "page" : undefined}') &&
  src.includes("scrollIntoView({ block: \"nearest\", inline: \"nearest\" })"),
  "Active tab must be semantically selected and scrolled into view");
assert.ok(src.includes("requestVersion.current") && src.includes("version !== requestVersion.current"),
  "Stale requests must not overwrite selected session data");
assert.ok((src.includes("readiness.checks.filter((check) => check.passed).length") || src.includes("currentReadiness.checks.filter((check) => check.passed).length")) &&
  src.includes('aria-label={t("Onboarding progress")}'),
  "Automated progress must derive from actual server readiness data");
assert.ok(src.includes("pendingChecks.slice(0, 4)") && src.includes("CHECK_DESTINATIONS[check.key]"),
  "Missing readiness checks must be actionable");
for (const existingEndpoint of [
  "/v1/admin/subscription",
  "/v1/admin/pilot/readiness",
  "/v1/admin/pilot/audit?",
  "/v1/admin/pilot/export",
  "/v1/admin/pilot/import-template/"
]) assert.ok(src.includes(existingEndpoint), "Lost existing endpoint " + existingEndpoint);
assert.ok(!src.includes("/v1/platform/"), "Platform provisioning controls must not enter school-admin web");
assert.ok((src.includes('subscription.status === "PAST_DUE"') || src.includes('currentSubscription.status === "PAST_DUE"')) && (src.includes('subscription.status === "GRACE"') || src.includes('currentSubscription.status === "GRACE"')),
  "Billing attention statuses must be distinct from service availability");
assert.ok(src.includes("PilotLaunchSupportPanel") &&
  launchUi.includes('decision?.status === "APPROVED"') &&
  launchUi.includes("Evidence submissions are requests for operator review") &&
  launchRoutes.includes('"/v1/platform/pilot/schools/:schoolId/launch/decision"'),
  "Phase 6 must present actual operator decisions and never treat submissions as approval");
assert.ok(css.includes(".pilot-section-nav") && css.includes(".pilot-section-link[aria-current=\"page\"]") &&
  css.includes(".pilot-section-link:focus-visible") &&
  css.includes("@media (max-width: 620px)") &&
  css.includes("@media (prefers-reduced-motion: reduce)"),
  "Responsive/keyboard/reduced-motion pilot styles are required");
const fa = i18n.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = i18n.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of [
  "Overview", "School readiness", "Data onboarding", "Audit & exports",
  "Launch & support", "Core setup ready", "Not verified",
  "Review missing checks", "Quick actions", "Subscription details",
  "Pilot operations sections", "Unknown pilot operations section."
]) {
  const expected = JSON.stringify(key) + ":";
  assert.ok(fa?.includes(expected) && ps?.includes(expected),
    "Missing translated Pilot Operations label: " + key);
}
console.log("Pilot Operations Phase 1 route, readiness, tenant safety, RTL, mobile and locale guards passed.");
