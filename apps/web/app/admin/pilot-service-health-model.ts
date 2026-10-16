/** Phase 5: school-only, point-in-time service evidence.
 * Never interpret unknown data or zero alerts as proof of uptime, delivery or backups.
 */
export type ServiceStatus = "attention" | "no_backlog";
export type ServiceReport = {
  evaluatedAt: string;
  timeZone: "Asia/Kabul";
  api: "responding";
  database: "query_succeeded";
  notificationQueue: {
    pending: number; stalePending: number; failed: number; status: ServiceStatus;
  };
  support: {
    unresolved: number; unresolvedCritical: number;
    status: "attention" | "no_critical_tickets";
  };
  imports: { failedLast7Days: number; status: "attention" | "no_recent_failures" };
  unverified: Array<"scheduler" | "push_delivery" | "backups" | "uptime_history">;
};
export type ServiceSubscription = {
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE" | "SUSPENDED" | "CANCELLED";
  level: "healthy" | "info" | "warning" | "critical";
  code: string; platformReviewNeeded: boolean; operationalWritesBlocked: boolean;
  daysUntilExpiry: number | null;
};
export type ServiceHealthResponse = { report: ServiceReport; subscription: ServiceSubscription };
export type ServiceAction = {
  key: string; level: "critical" | "warning" | "unverified";
  title: string; detail: string; href: string; count?: number;
};
function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid service health response.");
  return raw as Record<string, unknown>;
}
function natural(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error("Invalid service health count.");
  return value as number;
}
const requiredUnknown = ["scheduler", "push_delivery", "backups", "uptime_history"] as const;
export function parseServiceHealthResponse(raw: unknown): ServiceHealthResponse {
  const obj = record(raw);
  const report = record(obj.report);
  const stamp = report.evaluatedAt;
  if (typeof stamp !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(stamp) ||
      !Number.isFinite(Date.parse(stamp)) ||
      report.timeZone !== "Asia/Kabul" || report.api !== "responding" ||
      report.database !== "query_succeeded")
    throw new Error("Invalid service health evidence.");
  if (!Array.isArray(report.unverified) || report.unverified.length !== requiredUnknown.length ||
      new Set(report.unverified).size !== requiredUnknown.length ||
      !requiredUnknown.every(key => report.unverified.includes(key)))
    throw new Error("Independent service checks are not verified.");
  const queue = record(report.notificationQueue);
  const pending = natural(queue.pending);
  const stalePending = natural(queue.stalePending);
  const failed = natural(queue.failed);
  if (stalePending > pending ||
      queue.status !== (stalePending > 0 || failed > 0 ? "attention" : "no_backlog"))
    throw new Error("Inconsistent notification queue health.");
  const support = record(report.support);
  const unresolved = natural(support.unresolved);
  const unresolvedCritical = natural(support.unresolvedCritical);
  if (unresolvedCritical > unresolved ||
      support.status !== (unresolvedCritical > 0 ? "attention" : "no_critical_tickets"))
    throw new Error("Inconsistent support health.");
  const imports = record(report.imports);
  const failedLast7Days = natural(imports.failedLast7Days);
  if (imports.status !== (failedLast7Days > 0 ? "attention" : "no_recent_failures"))
    throw new Error("Inconsistent import health.");
  const subscription = record(obj.subscription);
  if (!["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED"].includes(String(subscription.status)) ||
      !["healthy", "info", "warning", "critical"].includes(String(subscription.level)) ||
      typeof subscription.code !== "string" || !subscription.code ||
      typeof subscription.platformReviewNeeded !== "boolean" ||
      typeof subscription.operationalWritesBlocked !== "boolean" ||
      (subscription.daysUntilExpiry !== null &&
        (!Number.isSafeInteger(subscription.daysUntilExpiry) || Math.abs(subscription.daysUntilExpiry as number) > 1_000_000)))
    throw new Error("Invalid subscription health.");
  const blocked = subscription.status === "SUSPENDED" || subscription.status === "CANCELLED";
  if (subscription.operationalWritesBlocked !== blocked)
    throw new Error("Contradictory subscription restrictions.");
  return {
    report: {
      evaluatedAt: stamp, timeZone: "Asia/Kabul", api: "responding",
      database: "query_succeeded",
      notificationQueue: { pending, stalePending, failed, status: queue.status as ServiceStatus },
      support: { unresolved, unresolvedCritical, status: support.status as ServiceReport["support"]["status"] },
      imports: { failedLast7Days, status: imports.status as ServiceReport["imports"]["status"] },
      unverified: [...requiredUnknown]
    },
    subscription: {
      status: subscription.status as ServiceSubscription["status"],
      level: subscription.level as ServiceSubscription["level"],
      code: subscription.code,
      platformReviewNeeded: subscription.platformReviewNeeded,
      operationalWritesBlocked: subscription.operationalWritesBlocked,
      daysUntilExpiry: subscription.daysUntilExpiry as number | null
    }
  };
}
/** These are independent *observations*, not unique users or outages.
 * Even with no alerts, independent infrastructure checks remain unverified.
 */
export function serviceFollowUps(data: ServiceHealthResponse): ServiceAction[] {
  const actions: ServiceAction[] = [];
  const queue = data.report.notificationQueue;
  const support = data.report.support;
  const imports = data.report.imports;
  const billing = data.subscription;
  if (support.unresolvedCritical > 0) actions.push({
    key: "critical-support", level: "critical", title: "Critical support tickets need attention",
    detail: "Unresolved critical support tickets recorded for this school.",
    count: support.unresolvedCritical, href: "/admin/pilot/launch#pilot-support-form"
  });
  if (billing.operationalWritesBlocked) actions.push({
    key: "subscription-blocked", level: "critical", title: "School writes are restricted",
    detail: "The recorded subscription status blocks operational changes.",
    href: "/admin/pilot/subscription"
  });
  if (queue.failed > 0) actions.push({
    key: "failed-notifications", level: "warning", title: "Review failed notification records",
    detail: "Failed queue records require investigation; push delivery remains unverified.",
    count: queue.failed, href: "/admin/pilot/launch?support=technical#pilot-support-form"
  });
  if (queue.stalePending > 0) actions.push({
    key: "stale-notifications", level: "warning", title: "Review notifications waiting over one hour",
    detail: "Older pending records may need a scheduler or delivery check.",
    count: queue.stalePending, href: "/admin/pilot/launch?support=technical#pilot-support-form"
  });
  if (imports.failedLast7Days > 0) actions.push({
    key: "failed-imports", level: "warning", title: "Investigate failed imports",
    detail: "Failed import batches recorded in the last seven days.",
    count: imports.failedLast7Days, href: "/admin/pilot/onboarding"
  });
  if (billing.platformReviewNeeded) actions.push({
    key: "subscription-review", level: "warning", title: "Request subscription reconciliation",
    detail: "The recorded subscription and its dates require platform review.",
    href: "/admin/pilot/launch?support=billing#pilot-support-form"
  });
  if (queue.pending > queue.stalePending && queue.stalePending === 0 && queue.failed === 0) {
    // Pending alone is not a failure: no false warning or outage claim.
  }
  actions.push({
    key: "independent-verification", level: "unverified",
    title: "Independent infrastructure checks are outstanding",
    detail: "Scheduler, push delivery, backup restore and historical uptime were not verified by this report.",
    href: "/admin/pilot/launch"
  });
  return actions;
}
