import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReleaseManifest, GATES } from "./phase7-release-report.mjs";

const sha = "f".repeat(40);
const now = new Date("2026-10-14T10:00:00.000Z");
const complete = () => ({
  releaseSha: sha,
  environment: "production",
  schoolId: "123e4567-e89b-42d3-a456-426614174000",
  deploymentIdentifier: "prod-2026-10-14-abc",
  operator: "Independent operator",
  checks: Object.fromEntries(Object.keys(GATES).map((gate) => [gate, {
    result: "PASS", reference: "vault:proof-"+gate,
    observedAt: "2026-10-14T09:00:00Z"
  }]))
});
test("No manifest is a machine-readable NO-GO, not a blank implied pass", () => {
  const result = evaluateReleaseManifest(null, sha, true, now);
  assert.equal(result.productionDecision, "NO_GO");
  assert.equal(result.evidenceState, "INCOMPLETE");
  assert.equal(result.checks.length, 11);
  assert.ok(result.checks.every((row) => row.result === "NOT_RUN"));
});
test("A stale SHA, failed gate, and missing evidence prevent acceptance", () => {
  const wrong = complete();
  wrong.releaseSha = "e".repeat(40);
  wrong.checks.live_push_scheduler.result = "FAIL";
  wrong.checks.rtl_accessibility.reference = "";
  const result = evaluateReleaseManifest(wrong, sha, true, now);
  assert.equal(result.evidenceState, "INCOMPLETE");
  assert.ok(result.blockers.some((b) => b.includes("exactly match")));
  assert.ok(result.blockers.some((b) => b.includes("live_push_scheduler")));
  assert.ok(result.blockers.some((b) => b.includes("rtl_accessibility")));
});
test("All recorded PASS evidence is still only ready for independent review, never automatic GO", () => {
  const result = evaluateReleaseManifest(complete(), sha, true, now);
  assert.equal(result.evidenceState, "READY_FOR_INDEPENDENT_RELEASE_REVIEW");
  assert.equal(result.productionDecision, "NO_GO");
  assert.equal(result.blockers.length, 0);
  const dirty = evaluateReleaseManifest(complete(), sha, false, now);
  assert.equal(dirty.evidenceState, "INCOMPLETE");
  const staging = complete();
  staging.environment = "staging";
  assert.ok(evaluateReleaseManifest(staging, sha, true, now).blockers.some((b) =>
    b.includes("environment=production")));
});
test("A dated artifact beyond the 30-day validity window is not treated as recent", () => {
  const stale = complete();
  stale.checks.exact_commit_ci.observedAt = "2026-09-01T00:00:00Z";
  assert.equal(evaluateReleaseManifest(stale, sha, true, now).evidenceState, "INCOMPLETE");
});

test("Sensitive credential-shaped evidence references are rejected and redacted in reports", () => {
  const unsafe = complete();
  unsafe.checks.exact_commit_ci.reference = "https://operator.example.org/report?token=SECRET";
  const report = evaluateReleaseManifest(unsafe, sha, true, now);
  assert.equal(report.evidenceState, "INCOMPLETE");
  assert.equal(report.checks.find((row) => row.id === "exact_commit_ci")?.evidenceReference, null);
  assert.ok(!JSON.stringify(report).includes("SECRET"));
});
