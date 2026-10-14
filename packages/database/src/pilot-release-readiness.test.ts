import assert from "node:assert/strict";
import test from "node:test";
import {
  RELEASE_ACCEPTANCE_CHECKS, RELEASE_EXTERNAL_GATES, evaluateSchoolReleaseReadiness
} from "./pilot-release-readiness.js";

test("Phase 7 never misrepresents automated/pilot readiness as a production release", () => {
  const failed = evaluateSchoolReleaseReadiness({
    setupReady: false, recordedPilotApproval: false,
    evidenceVerified: 0, evidenceRequired: 5, openCriticalTickets: 0
  });
  assert.equal(failed.productionDecision, "NO_GO");
  assert.equal(failed.effectivePilotApproval, false);
  assert.equal(failed.checks.length, 20);
  assert.equal(failed.checks[19]?.id, "20.20");
  assert.ok(failed.checks.every((row) => row.status === "UNVERIFIED" || row.status === "NO_GO"));

  const pilotApproved = evaluateSchoolReleaseReadiness({
    setupReady: true, recordedPilotApproval: true,
    evidenceVerified: 5, evidenceRequired: 5, openCriticalTickets: 0
  });
  assert.equal(pilotApproved.productionDecision, "NO_GO");
  assert.equal(pilotApproved.effectivePilotApproval, true);
  assert.equal(pilotApproved.policy, "MANUAL_RELEASE_ACCEPTANCE_REQUIRED");
  assert.deepEqual(pilotApproved.missingExternalGates, RELEASE_EXTERNAL_GATES);
  assert.equal(RELEASE_ACCEPTANCE_CHECKS.length, 19);

  for (const variant of [
    { setupReady: false, evidenceVerified: 5, openCriticalTickets: 0 },
    { setupReady: true, evidenceVerified: 4, openCriticalTickets: 0 },
    { setupReady: true, evidenceVerified: 5, openCriticalTickets: 1 }
  ]) {
    const result = evaluateSchoolReleaseReadiness({
      ...variant, recordedPilotApproval: true, evidenceRequired: 5
    });
    assert.equal(result.effectivePilotApproval, false);
    assert.equal(result.productionDecision, "NO_GO");
  }
});
