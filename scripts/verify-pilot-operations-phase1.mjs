import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const src = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const navigation = read("apps/web/app/admin/pilot-operations-navigation.tsx");
const sidebar = read("apps/web/app/admin/admin-sidebar-sections.ts");
const styles = read("apps/web/app/admin/pilot-workspace.css");
const root = read("apps/web/app/admin/(workspace)/pilot/page.tsx");
const launchUi = read("apps/web/app/admin/pilot-launch-support-panel.tsx");
const launchRoutes = read("apps/api/src/pilot/launch-routes.ts");
const nested = read("apps/web/app/admin/(workspace)/pilot/[section]/page.tsx");
const workspace = read("apps/web/app/admin/admin-workspace.tsx");
const dashboardFrame = read("apps/web/app/admin/admin-dashboard-frame.tsx");
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
  assert.ok(navigation.includes('section: "' + section + '"') && navigation.includes('href: "' + href + '"'),
    "Missing route-backed section: " + section);
}
assert.ok(root.includes('section="overview"'), "Default Pilot Operations section must be Overview");
assert.ok(nested.includes("isPilotSection(section)") && nested.includes("useParams"), "Dynamic route must validate sections");
assert.ok(workspace.includes('{ href: "/admin/pilot", label: "Pilot operations" }') &&
  dashboardFrame.includes("activeRoute(currentPath, item.href)") &&
  dashboardFrame.includes('pathname.startsWith(href + "/")') &&
  dashboardFrame.includes("ml-admin-side-link-active"),
  "Main navigation must highlight Pilot Operations and nested child routes");
assert.ok(sidebar.includes('"/admin/pilot": PILOT_TABS.map') &&
  sidebar.includes("sidebarItemIsActive") &&
  dashboardFrame.includes('aria-current={selected ? "page" : undefined}') &&
  src.includes('className="pilot-section pilot-workspace admin-page-enter"') &&
  src.includes('id="pilot-workspace-heading"') &&
  !src.includes("<PilotOperationsNavigation") &&
  !navigation.includes("PilotOperationsNavigation"),
  "Pilot sections must use the single accessible sidebar navigation, not a second page tab bar");
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
assert.ok(styles.includes(".pilot-workspace-toolbar") &&
  styles.includes(".pilot-workspace-refresh:focus-visible") &&
  styles.includes(".pilot-subscription-facts") &&
  styles.includes("@media (max-width: 650px)") &&
  styles.includes("@media (prefers-reduced-motion: reduce)") &&
  css.includes("@media (max-width: 620px)"),
  "Sidebar-only pilot workspace must remain responsive, structured and keyboard-accessible");
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
