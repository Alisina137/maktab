import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const navigation = read("apps/web/app/admin/pilot-operations-navigation.tsx");
const workspace = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const releaseView = read("apps/web/app/admin/pilot-release-readiness-panel.tsx");
const releaseModel = read("apps/web/app/admin/pilot-release-readiness-model.ts");
const releaseTests = read("apps/web/app/admin/pilot-release-readiness-model.test.ts");
const priorReport = read("scripts/pilot-phase8-acceptance-report.mjs");
const priorTests = read("scripts/test-pilot-phase8-acceptance-report.mjs");
const docs = read("docs/PILOT-IMPROVEMENTS-PHASE8-RELEASE-REVIEW.md");
const ci = read(".github/workflows/ci.yml");
const api = read("apps/api/src/pilot/routes.ts");
const launchApi = read("apps/api/src/pilot/launch-routes.ts");
const locale = read("apps/web/app/admin/admin-i18n.ts");
const prior = [
  ["readiness","apps/web/app/admin/pilot-readiness-priority-model.ts"],
  ["onboarding","apps/web/app/admin/pilot-import-history-model.ts"],
  ["adoption","apps/web/app/admin/pilot-adoption-model.ts"],
  ["service","apps/web/app/admin/pilot-service-health-model.ts"],
  ["oversight","apps/web/app/admin/pilot-oversight-triage-model.ts"],
  ["subscription","apps/web/app/admin/pilot-subscription-guidance-model.ts"]
];
const sections=["overview","readiness","onboarding","adoption","service",
  "oversight","subscription","audit","launch"];
const entries = [...navigation.matchAll(/\{ section: "([a-z]+)", label: "([^"]+)", href: "([^"]+)", group: "(START|MONITOR|MANAGE)" \}/g)];
assert.deepEqual(entries.map(e=>e[1]),sections,
  "Every Pilot Operations route must be present exactly once and in the expected order.");
assert.deepEqual(entries.map(e=>e[3]),
  ["/admin/pilot",...sections.slice(1).map(s=>"/admin/pilot/"+s)]);
assert.equal(new Set(entries.map(e=>e[3])).size,9);
assert.deepEqual(entries.map(e=>e[4]),
  ["START","START","START","MONITOR","MONITOR","MONITOR","MANAGE","MANAGE","MANAGE"]);
assert.ok(navigation.includes('aria-current={section === tab.section ? "page" : undefined}') &&
  navigation.includes("router.push(selected.href)") &&
  workspace.includes("<PilotOperationsNavigation section={section} locale={locale} />"));
for (const [section,path] of prior) {
  assert.ok(read(path).length > 200, "Improvement model missing for "+section);
  assert.ok(pkg.scripts["verify:pilot:improvements:phase"+(prior.indexOf(
    prior.find(item=>item[0]===section)) +2)], "Missing prior improvements verifier");
}
for (const p of ["PilotAdoptionPanel","PilotServiceHealthPanel",
  "PilotOversightPanel","PilotSubscriptionHealthPanel","PilotLaunchSupportPanel"]) {
  assert.ok(workspace.includes("<"+p), "Pilot panel must remain attached: "+p);
}
assert.ok(workspace.includes('section === "audit"') &&
  workspace.includes('section === "onboarding"'));
for(const path of ["/v1/admin/pilot/adoption","/v1/admin/pilot/service-health",
  "/v1/admin/pilot/oversight","/v1/admin/pilot/audit",
  "/v1/admin/pilot/subscription/health"]) {
  assert.ok(api.includes('"'+path+'"'),"School scoped API missing: "+path);
}
assert.ok(launchApi.includes('"/v1/admin/pilot/release-readiness"') &&
  launchApi.includes("requireSchoolAdmin"));
assert.ok(releaseView.includes("parsePilotReleaseResult(data)") &&
  releaseView.includes("pilotReleaseSummary(result)") &&
  releaseView.includes('cache: "no-store"') &&
  releaseView.includes("new AbortController()") &&
  releaseView.includes("controller.abort()") &&
  !releaseView.includes('method: "POST"'), "Final release view must be validated and read-only");
for (const token of [
  'productionDecision !== "NO_GO"', "MANUAL_RELEASE_ACCEPTANCE_REQUIRED",
  "Incomplete independent release gates.", "Incomplete Step 20 release checklist.",
  "Contradictory pilot approval.", "evidenceVerified > evidenceRequired",
  "c.status !== (i === 19 ? \"NO_GO\" : \"UNVERIFIED\")"
]) assert.ok(releaseModel.includes(token), "Final release must fail closed: "+token);
assert.ok(releaseTests.includes("full Step 20 response normalizes to NO-GO") &&
  releaseTests.includes("forged GO, missing gates"));
for(const section of sections) {
  assert.ok(priorReport.includes('id: "'+section+'"'),
    "Manual acceptance report must include unverified "+section);
  assert.ok(docs.toLowerCase().includes(section),"Manual checklist missing "+section);
}
assert.ok(priorReport.includes("sectionChecks: PHASE8_SECTION_CHECKS.map") &&
  priorReport.includes('status: "UNVERIFIED"') &&
  priorReport.includes('productionDecision: "NO_GO"') &&
  priorReport.includes('phase8Review: "REQUIRES_MANUAL_ACCEPTANCE"'));
assert.ok(priorTests.includes("sectionChecks.every") &&
  priorTests.includes("independently unverified"));
for(let phase=2;phase<=7;phase++){
  assert.ok(pkg.scripts["verify:pilot:phase8"].includes("verify:pilot:improvements:phase"+phase),
    "Consolidated acceptance must run improvements phase "+phase);
}
assert.ok(pkg.scripts["verify:pilot:phase8"].includes("verify:pilot:improvements:phase8"));
assert.ok(pkg.scripts["verify:pilot:improvements:phase8"].includes("pilot-release-readiness-model.test.ts"));
assert.ok(ci.includes("pnpm verify:pilot:phase8") &&
  ci.includes("pnpm verify:pilot:improvements:phase8") &&
  ci.includes("phase8-pilot-acceptance-no-go"), "Both Linux and Windows CI must guard Phase 8");
const fa=locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps=locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const e of entries) {
  const key=JSON.stringify(e[2])+":";
  assert.ok(fa?.includes(key)&&ps?.includes(key),
    "All nine route labels must exist in Dari and Pashto: "+e[2]);
}
assert.ok(docs.includes("NO_GO") && docs.includes("backup") &&
  docs.includes("exact SHA") && docs.includes("cross-school"),
  "Human field verification instructions must stay explicit");
console.log("Pilot improvements Phase 8 nine-tab integration, full release evidence, i18n and manual acceptance guards passed.");
