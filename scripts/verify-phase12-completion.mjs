#!/usr/bin/env node
// Phase 12 all-step source gate. Green CI is necessary, but not actual
// deployed staging, Android or independent operator acceptance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const ci = read(".github/workflows/ci.yml");
const docs = read("docs/PHASE12-FUNCTIONAL-JOURNEYS.md");
const runbook = read("docs/PHASE12-RELEASE-ACCEPTANCE.md");
for (let step=1; step<=6; step++) {
  const cmd = "verify:phase12:step"+step;
  assert.ok(pkg.scripts[cmd], "Phase 12 step command missing: "+cmd);
  assert.ok(pkg.scripts.verify.includes("pnpm "+cmd), "Root pnpm verify omitted "+cmd);
  assert.ok(ci.split("run: pnpm "+cmd).length-1 >= 2,
    "Linux and Windows CI must both run "+cmd);
  assert.ok(docs.includes("12."+step), "Phase 12 task undocumented: "+step);
}
for (const name of ["phase12-release-candidate.mjs", "test-phase12-release-candidate.mjs",
  "verify-phase12-step5-experience.mjs"]) {
  assert.ok(read("scripts/"+name).length>1000, "Missing release gate implementation: "+name);
}
const cli = read("scripts/phase12-release-candidate.mjs");
assert.ok(cli.includes("productionDecision: \"NO_GO\""), "Candidate must never authorize GO.");
assert.ok(cli.includes("probeStagingApi"), "Candidate must test deployed GET endpoints.");
assert.ok(cli.includes("assessLedger"), "Candidate must integrate Phase 11 evidence review.");
assert.ok(runbook.includes("NO-GO") && runbook.includes("NOT VERIFIED") &&
  runbook.includes("Android"), "Runbook must disclose missing physical acceptance.");
console.log("Phase 12 final source gate: all 6 steps in pnpm/2-OS CI, staging-only no-GO evidence.");
