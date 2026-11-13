import assert from "node:assert/strict";
import test from "node:test";
import { validateCanaryOptions, buildCanaryAssessment, sampleStagingCanary } from "./phase12-canary.mjs";

const sha = "a".repeat(40);
const now = new Date("2026-11-13T09:00:00Z");
const options = { sha, deploymentIdentifier: "staging-build-001", now };
const goodResults = () => [
  { path: "/health", check: "anonymous", pass: true, status: 200 },
  { path: "/ready", check: "anonymous", pass: true, status: 200 },
  { path: "/metrics", check: "anonymous", pass: true, status: 401 },
  { path: "/v1/admin/academics", check: "anonymous", pass: true, status: 401 }
];
const sample = (time, overrides = {}) => ({
  environment: "staging", result: "PROBE_PASS_NOT_LIVE_E2E",
  observedAt: time, results: goodResults(), ...overrides
});

test("Phase 12 requires bounded samples and controls excessive probing", () => {
  assert.deepEqual(validateCanaryOptions({ count: 2, intervalMs: 0 }), { count: 2, intervalMs: 0 });
  for (const count of [0, 1, 13, 2.5, NaN]) {
    assert.throws(() => validateCanaryOptions({ count, intervalMs: 1000 }));
  }
  for (const intervalMs of [-1, 30001, 1.2, NaN]) {
    assert.throws(() => validateCanaryOptions({ count: 2, intervalMs }));
  }
});

test("Two healthy staging samples remain production NO_GO", () => {
  const report = buildCanaryAssessment([
    sample("2026-11-13T08:58:00Z"), sample("2026-11-13T08:59:00Z")
  ], options);
  assert.equal(report.canaryState, "STAGING_OBSERVATION_PASS");
  assert.equal(report.productionDecision, "NO_GO");
  assert.equal(report.successfulSamples, 2);
  assert.equal(report.failedSamples, 0);
  assert.ok(!JSON.stringify(report).includes("authorization"));
});

test("Readiness outage, metrics leak and unauthorized API access always halt", () => {
  const samples = [sample("2026-11-13T08:58:00Z"), sample("2026-11-13T08:59:00Z")];
  for (const path of ["/ready", "/metrics", "/v1/admin/academics"]) {
    const broken = structuredClone(samples);
    const target = broken[1].results.find(r => r.path === path);
    target.status = 200;
    target.pass = true; // even if a buggy probe claims success, privacy leakage must be caught.
    if (path === "/ready") {
      target.pass = false;
      target.status = 503;
    }
    const report = buildCanaryAssessment(broken, options);
    if (path === "/ready" || path === "/metrics" || path.startsWith("/v1/")) {
      assert.equal(report.canaryState, "HALT_AND_INVESTIGATE");
      assert.equal(report.failedSamples, 1);
    }
  }
});

test("Canary rejects production/malformed samples and nonmatching build identities", () => {
  const observations = [sample("2026-11-13T08:58:00Z"), sample("2026-11-13T08:59:00Z")];
  for (const patch of [
    { environment: "production" },
    { results: [] },
    { observedAt: "2027-01-01T00:00:00Z" },
    { results: [{ path: "/foo?token=secret", check: "anonymous", status: 200, pass: true }] }
  ]) {
    const bad = structuredClone(observations);
    Object.assign(bad[1], patch);
    assert.throws(() => buildCanaryAssessment(bad, options));
  }
  assert.throws(() => buildCanaryAssessment(observations, { ...options, sha: "invalid" }));
  assert.throws(() => buildCanaryAssessment(observations, { ...options, deploymentIdentifier: "x" }));
  assert.throws(() => buildCanaryAssessment(observations, { ...options, environment: "production" }));
});

test("Phase 12 fetches only from the explicitly confirmed isolated staging API", async () => {
  const env = {
    PHASE11_CONFIRM_STAGING: "YES",
    STAGING_API_URL: "https://stage.example.org/",
    CONFIRM_STAGING_HOST: "stage.example.org",
    PRODUCTION_API_URL: "https://prod.example.org/"
  };
  let called = 0, waited = 0;
  const rows = await sampleStagingCanary(env, {
    count: 3, intervalMs: 100,
    probe: async () => {
      called++;
      return { environment: "staging", result: "PROBE_PASS_NOT_LIVE_E2E", results: goodResults() };
    },
    wait: async ms => { waited += ms; },
    clock: () => now
  });
  assert.equal(called, 3);
  assert.equal(waited, 200);
  assert.equal(buildCanaryAssessment(rows, options).successfulSamples, 3);
  await assert.rejects(() => sampleStagingCanary({
    ...env, STAGING_API_URL: "https://prod.example.org/",
    CONFIRM_STAGING_HOST: "prod.example.org"
  }, { count: 2, intervalMs: 0, probe: () => { throw new Error("Must not run"); } }));
});

test("Network failures count as an incident rather than being relabeled healthy", () => {
  const broken = sample("2026-11-13T08:59:00Z", {
    result: "PROBE_FAIL",
    results: [{ path: "/health", check: "anonymous", status: "NETWORK_ERROR", pass: false },
      { path: "/ready", check: "anonymous", status: "NETWORK_ERROR", pass: false },
      { path: "/metrics", check: "anonymous", status: "NETWORK_ERROR", pass: false }]
  });
  const report = buildCanaryAssessment([sample("2026-11-13T08:58:00Z"), broken], options);
  assert.equal(report.canaryState, "HALT_AND_INVESTIGATE");
  assert.equal(report.longestConsecutiveFailures, 1);
});
