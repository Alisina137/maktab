import type { Subscription } from "./schema.js";

export type SubscriptionHealthLevel = "healthy" | "info" | "warning" | "critical";
export type SubscriptionHealthCode =
  | "CANCELLED" | "SUSPENDED" | "GRACE_ENDED" | "GRACE_PERIOD" | "PAST_DUE"
  | "EXPIRED_PENDING_UPDATE" | "EXPIRES_SOON" | "EXPIRING" | "NO_EXPIRY" | "ON_TRACK";

export interface SubscriptionHealth {
  status: Subscription["status"];
  evaluatedOn: string;
  code: SubscriptionHealthCode;
  level: SubscriptionHealthLevel;
  operationalWritesBlocked: boolean;
  expiryDate: string | null;
  graceEndDate: string | null;
  daysUntilExpiry: number | null;
  daysUntilGraceEnd: number | null;
  nextReminderDays: number | null;
  platformReviewNeeded: boolean;
}

export function kabulCivilDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const value = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dayDistance(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Math.round((endMs - startMs) / 86_400_000);
}

const reminderDays = [30, 14, 7, 1] as const;

// Advisory only: the platform scheduler owns all state changes and reminder delivery.
export function evaluateSubscriptionHealth(
  subscription: Pick<Subscription, "status" | "expiresOn" | "graceEndsOn">,
  evaluatedOn: string = kabulCivilDate()
): SubscriptionHealth {
  const daysUntilExpiry = subscription.expiresOn
    ? dayDistance(evaluatedOn, subscription.expiresOn) : null;
  const daysUntilGraceEnd = subscription.graceEndsOn
    ? dayDistance(evaluatedOn, subscription.graceEndsOn) : null;
  const operationalWritesBlocked =
    subscription.status === "SUSPENDED" || subscription.status === "CANCELLED";
  const nextReminderDays = daysUntilExpiry === null || daysUntilExpiry < 0 ||
    operationalWritesBlocked ? null :
      [...reminderDays].reverse().find((day) => day <= daysUntilExpiry) ?? null;

  let code: SubscriptionHealthCode = "ON_TRACK";
  let level: SubscriptionHealthLevel = "healthy";
  let platformReviewNeeded = false;

  if (subscription.status === "CANCELLED") {
    code = "CANCELLED"; level = "critical";
  } else if (subscription.status === "SUSPENDED") {
    code = "SUSPENDED"; level = "critical";
  } else if (subscription.status === "GRACE" && daysUntilGraceEnd !== null && daysUntilGraceEnd < 0) {
    code = "GRACE_ENDED"; level = "critical"; platformReviewNeeded = true;
  } else if (subscription.status === "GRACE") {
    code = "GRACE_PERIOD"; level = "critical";
  } else if (subscription.status === "PAST_DUE") {
    code = "PAST_DUE"; level = "critical";
  } else if (daysUntilExpiry !== null && daysUntilExpiry < 0) {
    // Do not incorrectly claim writes are blocked while scheduler reconciliation is pending.
    code = "EXPIRED_PENDING_UPDATE"; level = "critical"; platformReviewNeeded = true;
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 7) {
    code = "EXPIRES_SOON"; level = "warning";
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 30) {
    code = "EXPIRING"; level = "info";
  } else if (daysUntilExpiry === null) {
    code = "NO_EXPIRY"; level = "info";
  }

  return {
    status: subscription.status, evaluatedOn, code, level, operationalWritesBlocked,
    expiryDate: subscription.expiresOn, graceEndDate: subscription.graceEndsOn,
    daysUntilExpiry, daysUntilGraceEnd, nextReminderDays, platformReviewNeeded
  };
}
