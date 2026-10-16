import assert from "node:assert/strict";
import test from "node:test";
import { buildPilotPhase8Report, PHASE8_MANUAL_GATES } from "./pilot-phase8-acceptance-report.mjs";

const sha = "1".repeat(40);
const other = "2".repeat(40);
const now = new Date("2026-10-16T00:00:00Z");

test("Phase 8: verified exact-SHA CI may report a test pass but NEVER production GO", () => {
  const report = buildPilotPhase8Report({
    sha, githubSha: sha, isGitHubActions: true, ciJobStatus: "success", now
  });
  assert.equal(report.commitSha, sha);
  assert.equal(report.generatedAt, "2026-10-16T00:00:00.000Z");
  assert.equal(report.ci.exactCommit, true);
  assert.equal(report.ci.automatedChecks, "CI_REPORTED_PASS");
  assert.equal(report.phase8Review, "REQUIRES_MANUAL_ACCEPTANCE");
  assert.equal(report.productionDecision, "NO_GO");
  assert.equal(report.manualGates.length, PHASE8_MANUAL_GATES.length);
  assert.equal(report.manualGates.every((gate) => gate.status === "UNVERIFIED"), true);
});

test("Phase 8: CI failure, cancellation, local run and mismatched SHA all fail closed", () => {
  for (const input of [
    { githubSha: other, isGitHubActions: true, ciJobStatus: "success" },
    { githubSha: sha, isGitHubActions: true, ciJobStatus: "failure" },
    { githubSha: sha, isGitHubActions: true, ciJobStatus: "cancelled" },
    { githubSha: sha, isGitHubActions: false, ciJobStatus: "success" },
    { githubSha: "invalid", isGitHubActions: true, ciJobStatus: "success" },
    { githubSha: sha, isGitHubActions: true, ciJobStatus: "unknown" }
  ]) {
    const report = buildPilotPhase8Report({ sha, ...input, now });
    assert.equal(report.ci.automatedChecks, "NOT_VERIFIED", JSON.stringify(input));
    assert.equal(report.productionDecision, "NO_GO");
    assert.equal(report.phase8Review, "REQUIRES_MANUAL_ACCEPTANCE");
    assert.equal(report.manualGates.every((gate) => gate.status === "UNVERIFIED"), true);
  }
});

test("Phase 8: incomplete or fake SHA is rejected", () => {
  for (const bad of ["", "1234567", "g".repeat(40), "A".repeat(40)]) {
    assert.throws(() => buildPilotPhase8Report({ sha: bad }), /SHA/);
  }
});
