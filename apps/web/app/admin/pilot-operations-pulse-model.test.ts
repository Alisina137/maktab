import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePulseAdoption, parsePulseService, parsePulseRelease,
  pulseAlertCount, pulseSignInCoverage
} from "./pilot-operations-pulse-model.js";

const teachers = { role: "TEACHER", eligible: 5, signedIn: 3 };
const parents = { role: "PARENT", eligible: 10, signedIn: 2 };
const students = { role: "STUDENT", eligible: 15, signedIn: 7 };
const roles = [teachers, parents, students];

test("Phase 8: adoption uses complete eligible cohorts, rejects fabricated percentages", () => {
  const adoption = parsePulseAdoption({ roles });
  assert.deepEqual(pulseSignInCoverage(adoption), { signedIn: 12, eligible: 30 });
  const empty = parsePulseAdoption({ roles: roles.map((r) => ({ ...r, eligible: 0, signedIn: 0 })) });
  assert.equal(pulseSignInCoverage(empty), null, "0 eligible accounts is unknown");
  assert.equal(pulseSignInCoverage(null), null, "API failure is unknown");
  for (const bad of [
    null, {}, { roles: [] }, { roles: [teachers, parents] },
    { roles: [teachers, parents, parents] },
    { roles: [teachers, parents, { ...students, signedIn: 16 }] },
    { roles: [teachers, parents, { ...students, signedIn: -1 }] },
    { roles: [teachers, parents, { ...students, signedIn: "7" }] },
    { roles: [teachers, parents, { ...students, signedIn: 7.1 }] }
  ]) {
    assert.throws(() => parsePulseAdoption(bad), "Invalid records cannot produce a healthy metric");
  }
});

test("Phase 8: service alerts count actual recorded signals, never coerce unavailable inputs to zero", () => {
  const valid = parsePulseService({
    report: {
      notificationQueue: { stalePending: 4, failed: 2 },
      support: { unresolvedCritical: 1 },
      imports: { failedLast7Days: 3 }
    }
  });
  assert.equal(pulseAlertCount(valid), 10);
  assert.equal(pulseAlertCount(null), null);
  assert.equal(pulseAlertCount(parsePulseService({
    report: { notificationQueue: { stalePending: 0, failed: 0 },
      support: { unresolvedCritical: 0 }, imports: { failedLast7Days: 0 } }
  })), 0, "Real zero is allowed when a complete report is received");
  for (const bad of [
    {}, { report: {} }, { report: { notificationQueue: {}, support: {}, imports: {} } },
    { report: { notificationQueue: { stalePending: -1, failed: 0 },
      support: { unresolvedCritical: 0 }, imports: { failedLast7Days: 0 } } },
    { report: { notificationQueue: { stalePending: 1, failed: "2" },
      support: { unresolvedCritical: 0 }, imports: { failedLast7Days: 0 } } }
  ]) assert.throws(() => parsePulseService(bad));
});

test("Phase 8: production status never becomes GO through malformed or unverified API output", () => {
  const safe = parsePulseRelease({
    productionDecision: "NO_GO", missingExternalGates: ["backup_restore", "operator_signoff"]
  });
  assert.equal(safe.productionDecision, "NO_GO");
  for (const bad of [
    null, {}, { productionDecision: "GO", missingExternalGates: [] },
    { productionDecision: "APPROVED", missingExternalGates: [] },
    { productionDecision: "NO_GO", missingExternalGates: null },
    { productionDecision: "NO_GO", missingExternalGates: [false] }
  ]) assert.throws(() => parsePulseRelease(bad));
});
