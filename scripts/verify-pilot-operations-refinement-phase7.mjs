import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const nav = read("apps/web/app/admin/pilot-operations-navigation.tsx");
const panel = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const overview = read("apps/web/app/admin/pilot-operations-pulse.tsx");
const overviewActivity = read("apps/web/app/admin/pilot-overview-activity.tsx");
const adoption = read("apps/web/app/admin/pilot-adoption-panel.tsx");
const service = read("apps/web/app/admin/pilot-service-health-panel.tsx");
const oversight = read("apps/web/app/admin/pilot-oversight-panel.tsx");
const launch = read("apps/web/app/admin/pilot-launch-support-panel.tsx");
const timestamp = read("apps/web/app/admin/pilot-timestamp.ts");
const api = read("apps/api/src/pilot/routes.ts");
const releaseModel = read("packages/database/src/pilot-release-readiness.ts");
const styles = read("apps/web/app/globals.css");
const locale = read("apps/web/app/admin/admin-i18n.ts");
const packageJson = JSON.parse(read("package.json"));
const phase4 = read("scripts/verify-pilot-adoption-refinement-phase4.mjs");
const phase5 = read("scripts/verify-pilot-service-refinement-phase5.mjs");
const phase6 = read("scripts/verify-pilot-oversight-refinement-phase6.mjs");

// One canonical route registry. Every existing deep link must remain reachable.
const routes = [...nav.matchAll(/\{ section: "([a-z]+)", label: "([^"]+)", href: "([^"]+)", group: "(START|MONITOR|MANAGE)" \}/g)]
  .map(([, section, label, href, group]) => ({ section, label, href, group }));
assert.equal(routes.length, 9, "All nine pre-existing Pilot Operations routes must be preserved");
assert.equal(new Set(routes.map((x) => x.section)).size, 9, "Duplicate sections");
assert.equal(new Set(routes.map((x) => x.href)).size, 9, "Duplicate destinations");
assert.deepEqual(routes.map((r) => r.section),
  ["overview","readiness","onboarding","adoption","service","oversight","subscription","audit","launch"]);
assert.deepEqual(routes.map((r) => r.group),
  ["START","START","START","MONITOR","MONITOR","MONITOR","MANAGE","MANAGE","MANAGE"]);
assert.equal(routes[0]?.href, "/admin/pilot", "Overview remains the first default route");
assert.ok(nav.includes("export function isPilotSection") && nav.includes("export type PilotSection"),
  "Link validation and type narrowing must use the canonical source");
assert.ok(nav.includes('aria-current={section === tab.section ? "page" : undefined}') &&
  nav.includes('role="group"') &&
  nav.includes('aria-label={t(group.label)}') &&
  nav.includes('value={section}') &&
  nav.includes('selected.href') &&
  nav.includes('router.push(selected.href)'),
  "Groups, current-tab semantics and the mobile jump control must be keyboard-accessible");
assert.ok(nav.includes("nav.scrollBy(") &&
  !nav.includes("scrollIntoView(") &&
  nav.includes("getBoundingClientRect()"),
  "Switching to another tab must only horizontally scroll the tab strip");
assert.ok(panel.includes('export { PILOT_TABS, isPilotSection } from "./pilot-operations-navigation"') &&
  panel.includes("<PilotOperationsNavigation section={section} locale={locale} />") &&
  !panel.includes('export const PILOT_TABS = ['),
  "There must be no duplicate Pilot route registry");
assert.ok(panel.includes('section === "overview"') &&
  panel.includes("<PilotOperationsPulse key={accessToken}") &&
  panel.includes("<PilotAdoptionPanel") &&
  panel.includes("<PilotServiceHealthPanel") &&
  panel.includes("<PilotOversightPanel") &&
  panel.includes("<PilotLaunchSupportPanel"),
  "Existing per-tab panels must not be lost in consolidation");
assert.ok(!panel.includes("pilotNavRef") &&
  !panel.includes("scrollIntoView") &&
  panel.includes('(["overview", "readiness", "onboarding", "subscription", "audit"] as PilotSection[])'),
  "The old nav jump and no-op global refresh on independent routes must be removed");

// The three overview summaries fetch independently and never substitute fake zeros.
for (const url of ["/v1/admin/pilot/adoption?window=7d",
  "/v1/admin/pilot/service-health", "/v1/admin/pilot/release-readiness"]) {
  assert.ok(overview.includes(url), "Missing existing read-only source: " + url);
}
assert.ok(overview.includes("Promise.allSettled(") &&
  overview.includes('cache: "no-store"') &&
  overview.includes('Authorization: `Bearer ${token}`') &&
  overview.includes("controller.abort()") &&
  overview.includes("controller.signal.aborted") &&
  overview.includes("setRevision") &&
  overview.includes('failed: results.filter((result) => result.status === "rejected").length'),
  "Pulse requires independent retryable requests and stale-session protection");
assert.ok(overview.includes('pulseAlertCount(snapshot?.service ?? null)') &&
  overview.includes('loading || alerts === null ? "—"') &&
  overview.includes("Values are not assumed to be zero.") &&
  overview.includes('snapshot?.release?.productionDecision === "NO_GO"'),
  "Unavailable data must never become a healthy zero or production GO");
assert.ok(releaseModel.includes('productionDecision: "NO_GO"') &&
  !overview.includes('method: "POST"') && !overview.includes('method: "PATCH"'),
  "Overview must be read-only and production acceptance remains independent");

assert.ok(timestamp.includes('timeZone: "Asia/Kabul"') &&
  timestamp.includes("hour12: true") &&
  timestamp.includes('locale !== "en"') &&
  timestamp.includes('formatAdminHijriDateTime(locale, input, "Asia/Kabul")'),
  "All Pilot Operations timestamps must use a Gregorian English / Solar Hijri RTL Kabul time rule");
for (const [name, source] of [
  ["overview activity",overviewActivity],["school audit and imports",panel],
  ["support workflow",launch],["operations timeline",oversight],["service health",service]
]) {
  assert.ok(source.includes('formatPilotTimestamp(locale,'),
    "Use the shared Kabul formatter in " + name);
}
assert.ok(!overviewActivity.includes("formatAdminHijriDateTime(") &&
  !launch.includes("formatAdminHijriDateTime(") &&
  !oversight.includes("formatAdminHijriDateTime(") &&
  !service.includes("formatAdminHijriDateTime("),
  "Do not show Persian/Gregorian or timezone-inconsistent timestamps per tab");
assert.ok(adoption.includes('cache: "no-store"') &&
  api.includes('"/v1/admin/pilot/service-health"') &&
  api.includes('"/v1/admin/pilot/oversight"') &&
  api.includes('"/v1/admin/pilot/adoption"'),
  "Existing authenticated school reporting endpoints must remain");

assert.ok(styles.includes(".pilot-nav-group") &&
  styles.includes(".pilot-nav-mobile") &&
  styles.includes("@media (max-width: 760px)") &&
  styles.includes(".pilot-pulse-grid") &&
  styles.includes("@media (max-width: 620px)"),
  "Both mobile navigation and overview pulse must remain responsive");
const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const item of ["Get started","Monitor","Manage","Pilot operations section",
  "At a glance","Recorded operational alerts","Independent production gate",
  "Refresh summaries", "Release evidence cannot be inferred from missing data."]) {
  const key = JSON.stringify(item) + ":";
  assert.ok(fa?.includes(key) && ps?.includes(key), "Missing Dari/Pashto phrase: " + item);
}
for (const [phase, script] of [[4,phase4],[5,phase5],[6,phase6]]) {
  assert.ok(script.includes("pilot-operations-navigation.tsx") &&
    script.includes("navigation.includes("), "Old phase " + phase + " verification must follow the canonical registry");
}
assert.ok(packageJson.scripts["verify:pilot:phase7"]?.includes("verify-pilot-operations-phase7.mjs") &&
  packageJson.scripts["verify:pilot:phase7"]?.includes("verify-pilot-operations-refinement-phase7.mjs"),
  "Original independent release gate + Phase 7 refinement checks must both be executed");
console.log("Pilot Operations Phase 7 navigation, UX, timezone, privacy, resilience and release NO-GO guards passed.");
