import assert from "node:assert/strict";
import test from "node:test";
import { buildFinalAuditReport, PHASE10_AUTOMATED_CHECKS, PHASE10_LIVE_JOURNEYS } from "./final-audit-phase10.mjs";
import { GATES } from "./phase7-release-report.mjs";

const sha = "a".repeat(40);
const now = new Date("2026-11-13T08:00:00.000Z");
const scripts = Object.fromEntries(PHASE10_AUTOMATED_CHECKS.map(row => [row.check, "node scripts/example.mjs"]));
scripts.verify = PHASE10_AUTOMATED_CHECKS.map(row => "pnpm " + row.check).join(" && ");
const ciWorkflow = PHASE10_AUTOMATED_CHECKS.map(row => "run: pnpm " + row.check).join("\n")
  + "\n" + PHASE10_AUTOMATED_CHECKS.map(row => "run: pnpm " + row.check).join("\n");
const baseline = { sha, now, scripts, ciWorkflow };
const completeEvidence = () => ({
  releaseSha: sha,
  environment: "production",
  schoolId: "123e4567-e89b-42d3-a456-426614174000",
  deploymentIdentifier: "phase10-staging-build-20261113",
  operator: "Independent release reviewer",
  checks: Object.fromEntries(Object.keys(GATES).map(key => [key, {
    result: "PASS", reference: "vault:phase10-review-" + key, observedAt: "2026-11-13T07:00:00Z"
  }]))
});

test("Phase 10 release matrix never interprets source checks or green CI as physical-device acceptance", () => {
  const report = buildFinalAuditReport(baseline);
  assert.equal(report.checkedOutSha, sha);
  assert.equal(report.productionDecision, "NO_GO");
  assert.equal(report.automatedCoverage.state, "CONFIGURED_NOT_PROVEN_BY_REPORT");
  assert.equal(report.automatedCoverage.phases.length, 10);
  assert.deepEqual(report.automatedCoverage.phases.map(p => p.phase),
    [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(report.liveJourneys.length, 20);
  assert.equal(report.liveJourneys.every(row => row.status === "UNVERIFIED"), true);
  assert.equal(report.externalEvidence.checks.length, 11);
  assert.ok(report.blockers.length > 0);
  assert.equal(new Set(report.liveJourneys.map(x => x.id)).size, 20);
});

test("Phase 10 rejects a dropped automated test command or missing Windows CI coverage", () => {
  const missing = { ...scripts };
  delete missing["verify:accounts:phase6"];
  const result = buildFinalAuditReport({ ...baseline, scripts: missing });
  assert.equal(result.automatedCoverage.state, "INCOMPLETE");
  assert.ok(result.blockers.some(s => s.includes("verify:accounts:phase6")));

  const linuxOnly = PHASE10_AUTOMATED_CHECKS.map(row => "run: pnpm " + row.check).join("\n");
  const notCrossPlatform = buildFinalAuditReport({ ...baseline, ciWorkflow: linuxOnly });
  assert.equal(notCrossPlatform.automatedCoverage.state, "INCOMPLETE");
  assert.ok(notCrossPlatform.blockers.some(s => s.includes("Linux/Windows CI")));
});

test("Even a fully PASS operator-supplied manifest must never grant production release", () => {
  const ready = buildFinalAuditReport({ ...baseline, manifest: completeEvidence() });
  assert.equal(ready.productionDecision, "NO_GO");
  assert.equal(ready.externalEvidence.state, "READY_FOR_INDEPENDENT_RELEASE_REVIEW");
  assert.equal(ready.evidenceState, "READY_FOR_INDEPENDENT_RELEASE_REVIEW");
  assert.ok(ready.liveJourneys.every(x => x.status === "UNVERIFIED"));

  const dirty = buildFinalAuditReport({ ...baseline, isClean: false, manifest: completeEvidence() });
  assert.equal(dirty.evidenceState, "INCOMPLETE");
  assert.equal(dirty.productionDecision, "NO_GO");

  const otherSha = completeEvidence();
  otherSha.releaseSha = "b".repeat(40);
  const wrong = buildFinalAuditReport({ ...baseline, manifest: otherSha });
  assert.equal(wrong.evidenceState, "INCOMPLETE");
  assert.ok(wrong.blockers.some(x => x.includes("does not exactly match")));
});

test("Phase 10 blocks unsafe evidence references and rejects invalid commit IDs", () => {
  const unsafe = completeEvidence();
  unsafe.checks.rollback_incident_runbook.reference = "https://review.example?token=SENSITIVE_VALUE";
  const report = buildFinalAuditReport({ ...baseline, manifest: unsafe });
  assert.equal(report.productionDecision, "NO_GO");
  assert.ok(!JSON.stringify(report).includes("SENSITIVE_VALUE"));
  for (const bad of ["", "zz".repeat(20), "A".repeat(40), "short", null]) {
    assert.throws(() => buildFinalAuditReport({ ...baseline, sha: bad }), /SHA/);
  }
  assert.equal(PHASE10_LIVE_JOURNEYS.filter(x => x.id === "staff_portal").length, 1);
  assert.equal(PHASE10_LIVE_JOURNEYS.filter(x => x.id === "two_school_isolation").length, 1);
});
