/** Pilot Improvements Phase 7: read-only, fail-closed subscription status.
 * Reproduce the existing platform health classification to detect contradictory
 * API data, without granting account/billing mutation rights or approval.
 */
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE" | "SUSPENDED" | "CANCELLED";
export type HealthCode = "CANCELLED" | "SUSPENDED" | "GRACE_ENDED" | "GRACE_PERIOD" | "PAST_DUE" |
  "EXPIRED_PENDING_UPDATE" | "EXPIRES_SOON" | "EXPIRING" | "NO_EXPIRY" | "ON_TRACK";
export type HealthLevel = "healthy" | "info" | "warning" | "critical";
export type SubscriptionHealth = {
  status: SubscriptionStatus; evaluatedOn: string; code: HealthCode; level: HealthLevel;
  operationalWritesBlocked: boolean; expiryDate: string | null; graceEndDate: string | null;
  daysUntilExpiry: number | null; daysUntilGraceEnd: number | null;
  nextReminderDays: number | null; platformReviewNeeded: boolean;
};
export type SubscriptionAction = {
  key: string; title: string; detail: string; href: string;
  severity: "critical" | "warning" | "review";
};
export type SubscriptionCheckpoint = { days: 30 | 14 | 7 | 1; state: "future" | "reached" | "past" | "unknown" };
const statuses = ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED"] as const;
const thresholds = [30, 14, 7, 1] as const;
const actionBilling = "/admin/pilot/launch?support=billing#pilot-support-form";
function record(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new Error("Invalid subscription health response.");
  return x as Record<string, unknown>;
}
function civilDate(x: unknown): string | null {
  if (x === null) return null;
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
      !Number.isFinite(Date.parse(x + "T00:00:00Z")) ||
      new Date(x + "T00:00:00Z").toISOString().slice(0,10) !== x)
    throw new Error("Invalid subscription calendar date.");
  return x;
}
function calendarDistance(first: string, second: string): number {
  return Math.round((Date.parse(second + "T00:00:00Z") -
    Date.parse(first + "T00:00:00Z")) / 86_400_000);
}
function boundedDay(raw: unknown): number | null {
  if (raw === null) return null;
  if (!Number.isSafeInteger(raw) || Math.abs(raw as number) > 365_250)
    throw new Error("Invalid subscription countdown.");
  return raw as number;
}
function classify(status: SubscriptionStatus, expiry: number | null, grace: number | null):
  { code: HealthCode; level: HealthLevel; review: boolean } {
  if (status === "CANCELLED") return { code:"CANCELLED", level:"critical", review:false };
  if (status === "SUSPENDED") return { code:"SUSPENDED", level:"critical", review:false };
  if (status === "GRACE" && grace !== null && grace < 0)
    return { code:"GRACE_ENDED", level:"critical", review:true };
  if (status === "GRACE") return { code:"GRACE_PERIOD", level:"critical", review:false };
  if (status === "PAST_DUE") return { code:"PAST_DUE", level:"critical", review:false };
  if (expiry !== null && expiry < 0)
    return { code:"EXPIRED_PENDING_UPDATE", level:"critical", review:true };
  if (expiry !== null && expiry <= 7)
    return { code:"EXPIRES_SOON", level:"warning", review:false };
  if (expiry !== null && expiry <= 30)
    return { code:"EXPIRING", level:"info", review:false };
  if (expiry === null) return { code:"NO_EXPIRY", level:"info", review:false };
  return { code:"ON_TRACK", level:"healthy", review:false };
}
export function parseSubscriptionHealth(input: unknown): SubscriptionHealth {
  const obj = record(input);
  const r = record(obj.health);
  if (!statuses.includes(r.status as SubscriptionStatus) ||
      typeof r.operationalWritesBlocked !== "boolean" ||
      typeof r.platformReviewNeeded !== "boolean") {
    throw new Error("Unknown subscription access status.");
  }
  const status = r.status as SubscriptionStatus;
  const evaluatedOn = civilDate(r.evaluatedOn);
  if (!evaluatedOn) throw new Error("Missing subscription evaluation date.");
  const expiryDate = civilDate(r.expiryDate), graceEndDate = civilDate(r.graceEndDate);
  const expiry = boundedDay(r.daysUntilExpiry), grace = boundedDay(r.daysUntilGraceEnd);
  if (expiry !== (expiryDate ? calendarDistance(evaluatedOn, expiryDate) : null) ||
      grace !== (graceEndDate ? calendarDistance(evaluatedOn, graceEndDate) : null)) {
    throw new Error("Contradictory subscription dates.");
  }
  const expected = classify(status, expiry, grace);
  const blocked = status === "SUSPENDED" || status === "CANCELLED";
  const threshold = expiry === null || expiry < 0 || blocked ? null :
    thresholds.find(d => d <= expiry) ?? null;
  if (r.code !== expected.code || r.level !== expected.level ||
      r.platformReviewNeeded !== expected.review ||
      r.operationalWritesBlocked !== blocked || r.nextReminderDays !== threshold)
    throw new Error("Contradictory subscription health.");
  return {
    status, evaluatedOn, code:expected.code, level:expected.level,
    operationalWritesBlocked:blocked, expiryDate, graceEndDate,
    daysUntilExpiry:expiry, daysUntilGraceEnd:grace,
    nextReminderDays: threshold, platformReviewNeeded:expected.review
  };
}
/** Checkpoints describe the schedule's calendar thresholds only, NOT actual
 * reminder creation, delivery, receipt, or success.
 */
export function subscriptionCheckpoints(health: SubscriptionHealth): SubscriptionCheckpoint[] {
  return thresholds.map(days => ({
    days, state: health.daysUntilExpiry === null ? "unknown" :
      health.daysUntilExpiry > days ? "future" :
      health.daysUntilExpiry === days ? "reached" : "past"
  }));
}
export function subscriptionNextActions(health: SubscriptionHealth): SubscriptionAction[] {
  const actions: SubscriptionAction[] = [];
  if (health.operationalWritesBlocked) actions.push({
    key:"access", title:"Review school access restrictions",
    detail:"School operational changes are blocked by the recorded subscription state.",
    severity:"critical", href:actionBilling
  });
  if (health.platformReviewNeeded) actions.push({
    key:"reconcile", title:"Request platform reconciliation",
    detail:"Recorded subscription dates and lifecycle state may not agree.",
    severity:"critical", href:actionBilling
  });
  if (["GRACE_PERIOD","PAST_DUE","GRACE_ENDED","EXPIRES_SOON","EXPIRING"].includes(health.code))
    actions.push({
      key:"renew", title:"Discuss subscription renewal",
      detail:"Review renewal terms and deadlines with platform support. No payment is submitted here.",
      severity:health.level === "critical" ? "critical" : "warning",
      href:actionBilling
    });
  if (health.code === "NO_EXPIRY") actions.push({
    key:"terms", title:"Confirm subscription expiry terms",
    detail:"No expiry date is recorded. Ask platform support to verify the agreed plan.",
    severity:"review", href:actionBilling
  });
  actions.push({
    key:"accounts", title:"Review school accounts",
    detail:"Manage school users and permissions in the existing account workspace.",
    severity:"review", href:"/admin/accounts"
  });
  actions.push({
    key:"audit", title:"Review administrative audit history",
    detail:"Inspect school-scoped records of administrative actions and changes.",
    severity:"review", href:"/admin/pilot/audit"
  });
  return actions;
}
