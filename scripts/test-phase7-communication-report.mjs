import assert from "node:assert/strict";
import test from "node:test";
import { PHASE7_COMMUNICATION_GATES, communicationPhase7Report } from "./phase7-communication-report.mjs";

test("Phase 7 manual report always remains NO-GO and requires 15 independent external checks", () => {
  const targetSha = "a".repeat(40);
  const report = communicationPhase7Report(targetSha);
  assert.equal(report.testedCommit, targetSha);
  assert.equal(report.productionDecision, "NO_GO");
  assert.equal(report.manualGates.length, 15);
  assert.deepEqual(report.manualGates.map(item => item.name), [...PHASE7_COMMUNICATION_GATES]);
  assert.deepEqual(report.manualGates.map(item => item.id),
    Array.from({ length: 15 }, (_, i) => `C7-${String(i + 1).padStart(2, "0")}`));
  assert.ok(report.manualGates.every(gate => gate.status === "NOT_RUN"));
  assert.ok(report.automatedBuildIsNotDeviceProof);
});
