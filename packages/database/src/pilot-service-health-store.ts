import { sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";

// A point-in-time, tenant-scoped operations snapshot. This is NOT an
// infrastructure uptime/SLA report, a scheduler check, or push delivery proof.
export interface PilotServiceHealthReport {
  evaluatedAt: string;
  timeZone: "Asia/Kabul";
  api: "responding";
  database: "query_succeeded";
  notificationQueue: {
    pending: number;
    stalePending: number;
    failed: number;
    status: "attention" | "no_backlog";
  };
  support: {
    unresolved: number;
    unresolvedCritical: number;
    status: "attention" | "no_critical_tickets";
  };
  imports: {
    failedLast7Days: number;
    status: "attention" | "no_recent_failures";
  };
  unverified: Array<"scheduler" | "push_delivery" | "backups" | "uptime_history">;
}

export async function getPilotServiceHealthReport(
  db: FoundationDatabase, schoolId: string, now = new Date()
): Promise<PilotServiceHealthReport> {
  const evaluatedAt = now.toISOString();
  const staleBefore = new Date(now.getTime() - 60 * 60_000).toISOString();
  const sevenDaysBefore = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  // No user-supplied SQL predicates; scope each independent aggregate to the
  // authenticated school. Return no delivery payloads, tokens, or ticket text.
  const result = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM notifications n
        WHERE n.school_id = ${schoolId}::uuid AND n.delivery_status = 'PENDING')
        AS notifications_pending,
      (SELECT count(*)::int FROM notifications n
        WHERE n.school_id = ${schoolId}::uuid AND n.delivery_status = 'PENDING'
          AND n.created_at < ${staleBefore}::timestamptz)
        AS notifications_stale,
      (SELECT count(*)::int FROM notifications n
        WHERE n.school_id = ${schoolId}::uuid AND n.delivery_status = 'FAILED')
        AS notifications_failed,
      (SELECT count(*)::int FROM pilot_support_tickets t
        WHERE t.school_id = ${schoolId}::uuid
          AND t.status NOT IN ('RESOLVED', 'CLOSED'))
        AS support_unresolved,
      (SELECT count(*)::int FROM pilot_support_tickets t
        WHERE t.school_id = ${schoolId}::uuid AND t.priority = 'CRITICAL'
          AND t.status NOT IN ('RESOLVED', 'CLOSED'))
        AS support_critical,
      (SELECT count(*)::int FROM family_import_batches b
        WHERE b.school_id = ${schoolId}::uuid AND b.status = 'FAILED'
          AND b.created_at >= ${sevenDaysBefore}::timestamptz
          AND b.created_at <= ${evaluatedAt}::timestamptz)
        AS imports_failed
  `);
  const rows: Array<Record<string, unknown>> = Array.isArray(result)
    ? result as Array<Record<string, unknown>>
    : (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error("Service health aggregate returned no record.");
  // An incomplete or malformed aggregate is UNKNOWN, never a healthy zero.
  // PostgreSQL can return integer aggregates as numbers or decimal strings.
  const number = (name: string): number => {
    const raw = row[name];
    if (typeof raw !== "number" && (typeof raw !== "string" || !/^(0|[1-9][0-9]*)$/.test(raw))) {
      throw new Error("Incomplete service health aggregate.");
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("Invalid service health aggregate.");
    }
    return value;
  };
  const pending = number("notifications_pending");
  const stalePending = number("notifications_stale");
  const failed = number("notifications_failed");
  const unresolved = number("support_unresolved");
  const unresolvedCritical = number("support_critical");
  const failedLast7Days = number("imports_failed");
  if (stalePending > pending || unresolvedCritical > unresolved) {
    throw new Error("Contradictory service health aggregate.");
  }
  return {
    evaluatedAt, timeZone: "Asia/Kabul",
    api: "responding", database: "query_succeeded",
    notificationQueue: {
      pending, stalePending, failed,
      status: stalePending > 0 || failed > 0 ? "attention" : "no_backlog"
    },
    support: {
      unresolved, unresolvedCritical,
      status: unresolvedCritical > 0 ? "attention" : "no_critical_tickets"
    },
    imports: {
      failedLast7Days,
      status: failedLast7Days > 0 ? "attention" : "no_recent_failures"
    },
    unverified: ["scheduler", "push_delivery", "backups", "uptime_history"]
  };
}
