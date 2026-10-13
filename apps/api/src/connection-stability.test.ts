import assert from "node:assert/strict";
import test from "node:test";
import {
  NETWORK_WARNING_GRACE_MS, NETWORK_RECOVERY_CHECK_INTERVAL_MS,
  recoveryProbeStreak, recoveryIsStable, showRecoveryNotice
} from "../../mobile/src/connection-stability.js";

test("ngrok transient failures have a quiet grace window", () => {
  assert.ok(NETWORK_WARNING_GRACE_MS >= 5000);
  assert.ok(NETWORK_RECOVERY_CHECK_INTERVAL_MS >= 3500);
});

test("single healthy ngrok check is not sufficient to announce auto-recovery", () => {
  let consecutive = recoveryProbeStreak(0, true);
  assert.equal(recoveryIsStable(consecutive, false), false);
  consecutive = recoveryProbeStreak(consecutive, false);
  assert.equal(consecutive, 0);
  consecutive = recoveryProbeStreak(consecutive, true);
  assert.equal(recoveryIsStable(consecutive, false), false);
  consecutive = recoveryProbeStreak(consecutive, true);
  assert.equal(recoveryIsStable(consecutive, false), true);
  assert.equal(recoveryIsStable(0, true), true);
});

test("short network interruptions recover silently but prolonged outages retain confirmation", () => {
  assert.equal(showRecoveryNotice(false, 1200, 10_000), false);
  assert.equal(showRecoveryNotice(false, 1200, 32_000), true);
  assert.equal(showRecoveryNotice(false, null, 100_000), false);
  assert.equal(showRecoveryNotice(true, null, 100_000), true);
});
