import assert from "node:assert/strict";
import test from "node:test";
import { createLedger, recordObservation } from "./phase11-pilot.mjs";
import { assessPhase12Candidate, validateCandidateEnv } from "./phase12-release-candidate.mjs";

const sha = "a".repeat(40);
const other = "b".repeat(40);
const now = new Date("2026-11-13T09:00:00.000Z");
const base = {
  sourceSha: sha, deployedSha: sha, now, worktreeClean: true,
  apiBuild: "api-build-001", webBuild: "web-build-001",
  mobileBuild: "android-build-001"
};
const probes = [
  { path: "/health", check: "anonymous", status: 200, pass: true },
  { path: "/ready", check: "anonymous", status: 200, pass: true },
  { path: "/metrics", check: "anonymous", status: 401, pass: true },
  { path: "/v1/admin/academics", check: "anonymous", status: 401, pass: true }
];
const probe = { environment: "staging", result: "PROBE_PASS_NOT_LIVE_E2E", results: probes };

test("Step 12.6 cannot certify production from healthy staging and incomplete Phase 11", () => {
  const ledger = createLedger({ sha, deploymentIdentifier: "candidate-build-001", now });
  const report = assessPhase12Candidate({ ...base, ledger, probe });
  assert.equal(report.productionDecision, "NO_GO");
  assert.equal(report.readiness, "INCOMPLETE");
  assert.equal(report.liveJourneysRecordedPass, 0);
  assert.equal(report.externalGatesRecordedPass, 0);
  assert.equal(report.integrationMatrix.length, 5);
  assert.ok(report.blockers.some(item => item.includes("Phase 11")));
});

test("Step 12.6 rejects mismatched source/deployed builds and private-metrics disclosure", () => {
  const ledger = createLedger({ sha, deploymentIdentifier: "candidate-build-001", now });
  const mismatched = assessPhase12Candidate({ ...base, ledger, probe, deployedSha: other });
  assert.ok(mismatched.blockers.some(item => item.includes("differs")));
  const unsafe = { ...probe, results: probes.map(item =>
    item.path === "/metrics" ? { ...item, status: 200 } : item) };
  const report = assessPhase12Candidate({ ...base, ledger, probe: unsafe });
  assert.ok(report.blockers.some(item => item.includes("exposed")));
  assert.equal(report.productionDecision, "NO_GO");
  const dirty = assessPhase12Candidate({ ...base, ledger, probe, worktreeClean: false });
  assert.equal(dirty.readiness, "INCOMPLETE");
  assert.ok(dirty.blockers.some(item => item.includes("not clean")));
});

test("Step 12.6 complete operator records only qualify for independent review", () => {
  let ledger = createLedger({ sha, deploymentIdentifier: "candidate-build-001", now });
  const observation = {
    actor: "Staging Tester", reviewer: "Other Reviewer",
    device: "Android 15 Chrome 142", observedAt: "2026-11-13T08:00:00Z",
    status: "PASS", reference: "vault:phase12/independent-test"
  };
  for (const id of Object.keys(ledger.journeys)) {
    ledger = recordObservation(ledger, { ...observation, kind: "journey", id }, now);
  }
  for (const id of Object.keys(ledger.gates)) {
    ledger = recordObservation(ledger, { ...observation, kind: "gate", id }, now);
  }
  const report = assessPhase12Candidate({ ...base, ledger, probe });
  assert.equal(report.readiness, "READY_FOR_INDEPENDENT_OPERATOR_REVIEW");
  assert.equal(report.liveJourneysRecordedPass, 20);
  assert.equal(report.externalGatesRecordedPass, 11);
  assert.equal(report.productionDecision, "NO_GO");
  const failing = assessPhase12Candidate({
    ...base, ledger, probe: { ...probe, result: "PROBE_FAIL" }
  });
  assert.equal(failing.readiness, "INCOMPLETE");
});

test("Step 12.6 staging host and exact-build guard prevents production use", () => {
  const env = {
    PHASE11_CONFIRM_STAGING: "YES",
    STAGING_API_URL: "https://staging.example.org/",
    CONFIRM_STAGING_HOST: "staging.example.org",
    PRODUCTION_API_URL: "https://production.example.org/",
    PHASE12_DEPLOYED_SHA: sha,
    PHASE12_API_BUILD: "api-build-001",
    PHASE12_WEB_BUILD: "web-build-001",
    PHASE12_MOBILE_BUILD: "android-build-001"
  };
  assert.equal(validateCandidateEnv(env).sha, sha);
  for (const patch of [
    { PHASE11_CONFIRM_STAGING: "NO" },
    { PHASE12_DEPLOYED_SHA: other.slice(1) },
    { PHASE12_API_BUILD: "x" },
    { PRODUCTION_API_URL: "https://staging.example.org/" },
    { STAGING_API_URL: "http://staging.example.org/" }
  ]) assert.throws(() => validateCandidateEnv({ ...env, ...patch }));
});
