import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../"+file, import.meta.url), "utf8");
const model = read("packages/database/src/pilot-release-readiness.ts");
const routes = read("apps/api/src/pilot/launch-routes.ts");
const api = read("apps/api/src/app.test.ts");
const ui = read("apps/web/app/admin/pilot-release-readiness-panel.tsx");
const launch = read("apps/web/app/admin/pilot-launch-support-panel.tsx");
const css = read("apps/web/app/globals.css");
const locale = read("apps/web/app/admin/admin-i18n.ts");
const report = read("scripts/phase7-release-report.mjs");
const reportTests = read("scripts/test-phase7-release-report.mjs");
const ci = read(".github/workflows/ci.yml");
const pkg = JSON.parse(read("package.json"));
const step20 = read("docs/TEST-20-FULL-REGRESSION.md");
const doc = read("docs/PHASE7-RELEASE-ACCEPTANCE.md");

for (let i = 1; i <= 20; i++) {
  assert.ok(model.includes('"20.'+i+'"'), "Step 20."+i+" not present in release matrix");
  assert.ok(step20.includes("| 20."+i+" |"), "Step 20."+i+" missing from master regression guide");
}
assert.ok(model.includes('productionDecision: "NO_GO"') &&
  model.includes("MANUAL_RELEASE_ACCEPTANCE_REQUIRED") &&
  model.includes("RELEASE_EXTERNAL_GATES") &&
  model.includes("effectivePilotApproval"),
  "A school/pilot must never imply a production release");
assert.ok(routes.includes('"/v1/admin/pilot/release-readiness"') &&
  routes.includes("requireSchoolAdmin(request, reply, accounts)") &&
  routes.includes('reply.header("cache-control", "no-store")') &&
  routes.includes("evaluateSchoolReleaseReadiness"),
  "Read-only release status must be school-admin-authenticated and uncacheable");
assert.ok(api.includes('test("Pilot Phase 7 release acceptance') &&
  api.includes('productionDecision,"NO_GO"') &&
  api.includes('foreign = await app.inject') &&
  api.includes('suspended = await app.inject'),
  "Phase 7 API tenant/authorization/suspension test must not be dropped");
assert.ok(ui.includes("AbortController") && ui.includes('cache: "no-store"') &&
  ui.includes("20 release acceptance steps") &&
  ui.includes("productionDecision") &&
  launch.includes("PilotReleaseReadinessPanel") &&
  launch.includes("currentLoad === loadVersion.current"),
  "No fake UI release green; stale session loads must be guarded");
assert.ok(css.includes(".pilot-phase7-gates") &&
  css.includes("@media(max-width:900px)") &&
  css.includes(".pilot-phase7-checks summary:focus-visible"),
  "Release acceptance RTL, responsive and keyboard affordances required");
const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Production release readiness", "PRODUCTION NO-GO",
  "Manual verification required", "View all 20 release acceptance steps",
  "Final independent production release decision"]) {
  const translated = JSON.stringify(key)+":";
  assert.ok(fa?.includes(translated) && ps?.includes(translated),
    "Missing English/Dari/Pashto release copy: "+key);
}
assert.ok(report.includes("git\", [\"rev-parse\", \"HEAD\"]") &&
  report.includes("productionDecision: \"NO_GO\"") &&
  report.includes("READY_FOR_INDEPENDENT_RELEASE_REVIEW") &&
  report.includes('manifest.releaseSha !== sha') &&
  reportTests.includes("No manifest is a machine-readable NO-GO"),
  "Offline operator evidence should be exact-SHA bound and fail closed");
assert.ok(doc.includes("NO-GO") && doc.includes("REVIEW_REQUIRED") === false &&
  doc.includes("pnpm verify:pilot:phase7"), "Phase 7 operator acceptance docs missing");
assert.ok(ci.includes("Phase 7 release and cross-role acceptance guard") &&
  ci.includes("upload-artifact@v4") &&
  ci.includes("maktablink-step20-no-go.json") &&
  ci.includes("pnpm verify:pilot:phase7") &&
  pkg.scripts.verify.includes("verify:pilot:phase7"),
  "CI must create exact-commit NO-GO evidence artifact and execute regression");
console.log("Pilot Operations Phase 7 release honesty, auth, tenant regression, RTL/locale, CLI and CI source guard passed.");
