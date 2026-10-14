import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSubscriptionHealth, kabulCivilDate } from "./subscription-health.js";

const health = (status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE" | "SUSPENDED" | "CANCELLED",
  expiresOn: string | null, graceEndsOn: string | null = null, today = "2026-10-14") =>
  evaluateSubscriptionHealth({ status, expiresOn, graceEndsOn }, today);

test("Health uses Kabul civil date across UTC midnight", () => {
  assert.equal(kabulCivilDate(new Date("2026-10-14T19:29:00Z")), "2026-10-14");
  assert.equal(kabulCivilDate(new Date("2026-10-14T19:30:00Z")), "2026-10-15");
});

test("Healthy, 30-day info, 7-day warning, today, and expired states use calendar days", () => {
  assert.deepEqual([health("ACTIVE", "2026-12-14").code, health("ACTIVE", "2026-12-14").level],
    ["ON_TRACK", "healthy"]);
  assert.equal(health("ACTIVE", "2026-10-14").daysUntilExpiry, 0);
  assert.equal(health("TRIAL", "2026-10-21").code, "EXPIRES_SOON");
  assert.equal(health("ACTIVE", "2026-11-10").code, "EXPIRING");
  assert.equal(health("ACTIVE", "2026-10-13").code, "EXPIRED_PENDING_UPDATE");
  assert.equal(health("ACTIVE", "2026-10-13").platformReviewNeeded, true);
  assert.equal(health("ACTIVE", null).code, "NO_EXPIRY");
  assert.equal(health("ACTIVE", null).daysUntilExpiry, null);
});

test("Real recorded subscription state controls operational access, not guessed dates", () => {
  assert.equal(health("ACTIVE", "2026-10-13").operationalWritesBlocked, false);
  assert.equal(health("PAST_DUE", "2026-10-13").code, "PAST_DUE");
  assert.equal(health("PAST_DUE", "2026-10-13").operationalWritesBlocked, false);
  assert.equal(health("GRACE", "2026-10-13", "2026-10-16").code, "GRACE_PERIOD");
  assert.equal(health("GRACE", "2026-10-13", "2026-10-16").daysUntilGraceEnd, 2);
  assert.equal(health("GRACE", "2026-10-13", "2026-10-13").code, "GRACE_ENDED");
  for (const status of ["SUSPENDED", "CANCELLED"] as const) {
    assert.equal(health(status, "2026-10-13").operationalWritesBlocked, true);
    assert.equal(health(status, "2026-10-13").level, "critical");
  }
});

test("The next notification threshold follows the 30/14/7/1 day scheduler; delivery is not promised", () => {
  assert.equal(health("ACTIVE", "2026-12-14").nextReminderDays, 30);
  assert.equal(health("ACTIVE", "2026-11-03").nextReminderDays, 14);
  assert.equal(health("ACTIVE", "2026-10-20").nextReminderDays, 1);
  assert.equal(health("ACTIVE", "2026-10-15").nextReminderDays, 1);
  assert.equal(health("ACTIVE", "2026-10-14").nextReminderDays, null);
  assert.equal(health("SUSPENDED", "2026-10-20").nextReminderDays, null);
});
