import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const nav = read("apps/web/app/admin/pilot-operations-navigation.tsx");
const panel = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const pulse = read("apps/web/app/admin/pilot-operations-pulse.tsx");
const pulseModel = read("apps/web/app/admin/pilot-operations-pulse-model.ts");
const pulseTests = read("apps/web/app/admin/pilot-operations-pulse-model.test.ts");
const adoption = read("apps/web/app/admin/pilot-adoption-panel.tsx");
const service = read("apps/web/app/admin/pilot-service-health-panel.tsx");
const oversight = read("apps/web/app/admin/pilot-oversight-panel.tsx");
const support = read("apps/web/app/admin/pilot-launch-support-panel.tsx");
const release = read("packages/database/src/pilot-release-readiness.ts");
const routes = read("apps/api/src/pilot/routes.ts");
const launchRoutes = read("apps/api/src/pilot/launch-routes.ts");
const timelineDb = read("packages/database/src/pilot-oversight-store.ts");
const adoptionDb = read("packages/database/src/pilot-adoption-store.ts");
const healthDb = read("packages/database/src/pilot-service-health-store.ts");
const apiTests = read("apps/api/src/app.test.ts");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const acceptance = read("scripts/pilot-phase8-acceptance-report.mjs");
const acceptanceTests = read("scripts/test-pilot-phase8-acceptance-report.mjs");
const ci = read(".github/workflows/ci.yml");

// Navigation regression: all 9 sections share a canonical registry, grouped,
// keyboard-operable and direct-route compatible.
const entries = [...nav.matchAll(/\{ section: "([a-z]+)", label: "([^"]+)", href: "([^"]+)", group: "(START|MONITOR|MANAGE)" \}/g)]
  .map(([, section, label, href, group]) => ({ section, label, href, group }));
assert.equal(entries.length, 9, "Pilot operations must retain all nine tabs");
assert.equal(new Set(entries.map((entry) => entry.href)).size, 9, "No duplicate section links");
assert.equal(entries[0].section, "overview", "Overview must remain the first default tab");
assert.ok(nav.includes('aria-current={section === tab.section ? "page" : undefined}') &&
  nav.includes('router.push(selected.href)') &&
  !nav.includes("scrollIntoView(") &&
  nav.includes("nav.scrollBy(") &&
  panel.includes('export { PILOT_TABS, isPilotSection } from "./pilot-operations-navigation"'),
  "Focus/route semantics must be accessible without causing page vertical jumps");
assert.ok(css.includes(".pilot-nav-mobile") && css.includes(".pilot-pulse-grid") &&
  css.includes("@media (max-width: 760px)") &&
  css.includes("@media (max-width: 620px)"),
  "Responsive grid and mobile navigation styling required");

// API access, paging, no-cache and tenant boundaries.
for (const p of ["/v1/admin/pilot/adoption", "/v1/admin/pilot/service-health",
  "/v1/admin/pilot/oversight", "/v1/admin/pilot/audit"]) {
  assert.ok(routes.includes('"' + p + '"'), "Lost pilot API: " + p);
}
assert.ok(routes.includes("requireSchoolAdmin(request, reply, accounts)") &&
  routes.includes("context.user.schoolId") &&
  routes.includes('reply.header("cache-control", "no-store")'),
  "Reporting must be authenticated, school scoped, and uncached");
assert.ok(timelineDb.includes('s.school_id = ${schoolId}::uuid') &&
  timelineDb.includes('d.school_id = ${schoolId}::uuid') &&
  timelineDb.includes('b.school_id = ${schoolId}::uuid') &&
  timelineDb.includes('a.school_id = ${schoolId}::uuid') &&
  timelineDb.includes("ORDER BY occurred_at DESC, kind ASC, id DESC"),
  "Timeline must preserve tenant scope and stable pagination");
assert.ok(adoptionDb.includes('timeZone: "Asia/Kabul"') &&
  healthDb.includes('unverified: ["scheduler", "push_delivery", "backups", "uptime_history"]'),
  "Time and service evidence limitations must remain explicit");

// Defensive response parsing prevents a partial outage/malformed payload
// becoming a false zero percentage, green service indicator or GO status.
for (const expr of ["Number.isSafeInteger(input)", "signedIn > eligible",
  "new Set<string>()", "row.productionDecision !== \"NO_GO\"",
  "pulseAlertCount", "pulseSignInCoverage"]) {
  assert.ok(pulseModel.includes(expr), "Missing fail-closed response validation: " + expr);
}
assert.ok(pulse.includes("Promise.allSettled(") &&
  pulse.includes("parsePulseAdoption") &&
  pulse.includes("parsePulseService") &&
  pulse.includes("parsePulseRelease") &&
  pulse.includes("controller.abort()") &&
  pulse.includes('loading || alerts === null ? "—"'),
  "Overview partial failures must retain valid cards and unknown states");
assert.ok(pulseTests.includes("Phase 8:") &&
  pulseTests.includes("assert.throws") &&
  pulseTests.includes("production status never becomes GO"),
  "Executable corrupted-payload tests must be retained");

// Launch permission and release invariants: never auto-approve production.
assert.ok(release.includes('productionDecision: "NO_GO"') &&
  release.includes("MANUAL_RELEASE_ACCEPTANCE_REQUIRED") &&
  launchRoutes.includes('"/v1/admin/pilot/release-readiness"') &&
  launchRoutes.includes("requireSchoolAdmin") &&
  support.includes("PilotReleaseReadinessPanel") &&
  overviewPermissionless(pulse),
  "Dashboard and support actions must not mutate or fabricate release approval");
function overviewPermissionless(src) {
  return !src.includes('method: "POST"') &&
    !src.includes('method: "PATCH"') &&
    !src.includes("/v1/platform/");
}
assert.ok(service.includes("A failed request is not a confirmed outage.") &&
  oversight.includes("Production release gate") &&
  adoption.includes("Sign-in coverage uses each account's last login only"),
  "Unknown/outage signals and sign-in limitations must not be overstated");
assert.ok(acceptance.includes('productionDecision: "NO_GO"') &&
  acceptance.includes('phase8Review: "REQUIRES_MANUAL_ACCEPTANCE"') &&
  acceptance.includes('ciJobStatus === "success"') &&
  acceptance.includes("githubSha === sha") &&
  acceptanceTests.includes('ciJobStatus: "cancelled"') &&
  acceptanceTests.includes("manualGates.every"),
  "Exact-SHA acceptance evidence must fail closed in CI and locally");

// Coverage: existing PGlite endpoints across Phases 4–7 and Phase 8 model QA.
for (const label of [
  "Pilot refinement Phase 4 usage reporting",
  "Pilot refinement Phase 5 school service checks",
  "Pilot refinement Phase 6 oversight timeline",
  "Pilot Phase 6 launch evidence",
  "Pilot Phase 6 school support tickets",
  "Pilot Phase 7 release acceptance"
]) assert.ok(apiTests.includes(label), "Missing prior integration scenario: " + label);
for (let i = 2; i <= 8; i++) {
  assert.ok(pkg.scripts["verify:pilot:phase" + i], "Missing phase " + i + " verifier");
}
assert.ok(pkg.scripts["verify:pilot"] && pkg.scripts["verify:pilot:phase8"].includes(
  "pilot-operations-pulse-model.test.ts"), "Phase8 must execute model unit tests");
assert.ok(ci.includes("pnpm verify:pilot:phase8") &&
  ci.includes("pilot-phase8-acceptance-report.mjs") &&
  ci.includes("phase8-pilot-acceptance-no-go"),
  "CI must exercise Phase8 and save independent manual acceptance artifact");

// Dari/Pashto UX regression: all six languages? The product has three
// supported languages, and every tab must expose its localized labels.
const fa = i18n.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = i18n.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const entry of entries) {
  const needle = JSON.stringify(entry.label) + ":";
  assert.ok(fa?.includes(needle) && ps?.includes(needle),
    "Missing Dari/Pashto navigation label: " + entry.label);
}
console.log("Phase 8: Pilot Operations security, nine-tab navigation, payload fail-closed, prior integration, locale and release safeguards passed.");
