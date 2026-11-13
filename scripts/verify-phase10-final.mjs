import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PHASE10_AUTOMATED_CHECKS, PHASE10_LIVE_JOURNEYS } from "./final-audit-phase10.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const ci = read(".github/workflows/ci.yml");
const restore = read("scripts/restore-database.mjs").replace(/\r\n/g, "\n");
const restorePolicy = read("scripts/restore-target-policy.mjs");
const api = read("apps/api/src/app.test.ts");
const docs = read("docs/FINAL-AUDIT-PHASE10.md");

assert.equal(PHASE10_AUTOMATED_CHECKS.length, 10);
assert.deepEqual(PHASE10_AUTOMATED_CHECKS.map(p => p.phase),
  [1,2,3,4,5,6,7,8,9,10]);
assert.equal(PHASE10_LIVE_JOURNEYS.length, 20);
assert.equal(new Set(PHASE10_LIVE_JOURNEYS.map(row => row.id)).size, 20);
for (const p of PHASE10_AUTOMATED_CHECKS) {
  assert.ok(pkg.scripts[p.check], "Missing command: " + p.check);
  assert.ok(pkg.scripts.verify.includes("pnpm " + p.check),
    "Root verification omitted " + p.check);
  assert.ok(ci.split("pnpm " + p.check).length - 1 >= 2,
    "Both Linux and Windows CI must execute " + p.check);
}
assert.ok(api.includes('test("Final Audit Phase 10: live API route security and readiness smoke"'),
  "Final cross-role in-process smoke integration test is missing");
for (const requirement of [
  "validateRestoreTarget(process.env)",
  "await pipeline(encryptedStream(), decrypt(), new Writable(",
  'await stat(inputPath)',
  '"--single-transaction"'
]) assert.ok(restore.includes(requirement),
  "Destructive restore lost a critical safety guard: " + requirement);
assert.ok(restore.indexOf("await pipeline(encryptedStream(), decrypt(), new Writable(")
  < restore.indexOf('spawn(\n    "pg_restore"'),
"Encrypted backup must be authenticated BEFORE launching pg_restore");
assert.ok(restorePolicy.includes("CONFIRM_RESTORE_DATABASE") &&
  restorePolicy.includes("RESTORE_DATABASE_URL") &&
  restorePolicy.includes('env.RESTORE_TARGET !== "staging"'),
  "Restore must explicitly require a separate staging target");
for (const phase of PHASE10_AUTOMATED_CHECKS) {
  assert.ok(read("docs/FINAL-AUDIT-PHASE" + phase.phase + ".md").length > 250,
    "Missing audited Phase " + phase.phase + " source findings/report");
}
assert.ok(docs.includes("NO-GO") && docs.includes("20"),
  "Final audit must clearly state pending external evidence and 20 live journeys");
console.log("Phase 10 source gate verified: 10 phases, 20 live journeys, multi-OS checks, API smoke, authenticated backup and production NO-GO.");
