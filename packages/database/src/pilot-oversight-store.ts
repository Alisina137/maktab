import { sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";

// This is a bounded, allowlisted operational timeline, never a general-purpose
// audit search. Notes, actor IDs, support bodies and evidence references are omitted.
export const oversightWindows = ["7d", "30d", "90d"] as const;
export const oversightKinds = ["ALL", "SUPPORT", "EVIDENCE", "DECISION", "IMPORT", "EXPORT"] as const;
export type OversightWindow = (typeof oversightWindows)[number];
export type OversightKind = (typeof oversightKinds)[number];
export type OversightEvent = {
  id: string; kind: Exclude<OversightKind, "ALL">;
  action: string; occurredAt: string;
};
export type OversightPage = {
  events: OversightEvent[];
  window: OversightWindow; kind: OversightKind;
  offset: number; limit: number; hasMore: boolean;
  startAt: string; endAt: string; timeZone: "Asia/Kabul";
};
export type OversightQuery = {
  window: OversightWindow; kind: OversightKind; limit: number; offset: number;
};

export function oversightWindowBounds(window: OversightWindow, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kabul"
  }).formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  const localDay = [part("year"), part("month"), part("day")].join("-");
  const localStart = new Date(localDay + "T00:00:00+04:30");
  const days = window === "7d" ? 7 : window === "30d" ? 30 : 90;
  return {
    startAt: new Date(localStart.getTime() - (days - 1) * 86_400_000).toISOString(),
    endAt: now.toISOString()
  };
}

export async function listPilotOversightEvents(
  db: FoundationDatabase, schoolId: string, query: OversightQuery, now = new Date()
): Promise<OversightPage> {
  const { startAt, endAt } = oversightWindowBounds(query.window, now);
  // Server limit and offset are independently validated, not trusted from
  // the raw URL. This guard also covers internal callers.
  const limit = Math.min(30, Math.max(1, Math.trunc(query.limit)));
  const offset = Math.min(50_000, Math.max(0, Math.trunc(query.offset)));
  const result = await db.execute(sql`
    WITH events AS (
      SELECT s.id, 'SUPPORT'::text AS kind,
        CASE
          WHEN s.status_after = 'OPEN' THEN 'SUPPORT_OPENED'
          WHEN s.status_after = 'IN_PROGRESS' THEN 'SUPPORT_IN_PROGRESS'
          WHEN s.status_after = 'RESOLVED' THEN 'SUPPORT_RESOLVED'
          WHEN s.status_after = 'CLOSED' THEN 'SUPPORT_CLOSED'
          ELSE 'SUPPORT_REPLIED'
        END AS action, s.created_at AS occurred_at
      FROM pilot_support_updates s
      WHERE s.school_id = ${schoolId}::uuid

      UNION ALL

      SELECT a.id, 'EVIDENCE'::text,
        CASE WHEN a.action = 'pilot.evidence_submitted' THEN 'EVIDENCE_SUBMITTED'
          ELSE 'EVIDENCE_REVIEWED' END, a.created_at
      FROM audit_logs a
      WHERE a.school_id = ${schoolId}::uuid
        AND a.action IN ('pilot.evidence_submitted', 'pilot.evidence_reviewed')

      UNION ALL

      SELECT d.id, 'DECISION'::text,
        CASE WHEN d.status = 'APPROVED' THEN 'PILOT_APPROVED'
          ELSE 'PILOT_NOT_APPROVED' END, d.created_at
      FROM pilot_launch_decision_history d
      WHERE d.school_id = ${schoolId}::uuid

      UNION ALL

      SELECT b.id, 'IMPORT'::text,
        CASE
          WHEN b.status = 'COMPLETED' THEN 'IMPORT_COMPLETED'
          WHEN b.status = 'REJECTED' THEN 'IMPORT_REJECTED'
          ELSE 'IMPORT_FAILED'
        END, b.created_at
      FROM family_import_batches b
      WHERE b.school_id = ${schoolId}::uuid

      UNION ALL

      SELECT a.id, 'EXPORT'::text,
        CASE WHEN a.action = 'pilot.audit_exported'
          THEN 'AUDIT_EXPORTED' ELSE 'SCHOOL_DATA_EXPORTED' END, a.created_at
      FROM audit_logs a
      WHERE a.school_id = ${schoolId}::uuid
        AND a.action IN ('pilot.audit_exported', 'pilot.exported')
    )
    SELECT id, kind, action, occurred_at
    FROM events
    WHERE occurred_at >= ${startAt}::timestamptz
      AND occurred_at <= ${endAt}::timestamptz
      AND (${query.kind}::text = 'ALL' OR kind = ${query.kind}::text)
    ORDER BY occurred_at DESC, kind ASC, id DESC
    LIMIT ${limit + 1} OFFSET ${offset}
  `);
  const rows: Array<Record<string, unknown>> = Array.isArray(result)
    ? result as Array<Record<string, unknown>>
    : (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const events: OversightEvent[] = rows.slice(0, limit).map((row) => ({
    id: String(row.id),
    kind: row.kind as OversightEvent["kind"],
    action: String(row.action),
    occurredAt: row.occurred_at instanceof Date
      ? row.occurred_at.toISOString() : new Date(String(row.occurred_at)).toISOString()
  }));
  return { events, window: query.window, kind: query.kind, offset, limit,
    hasMore: rows.length > limit, startAt, endAt, timeZone: "Asia/Kabul" };
}
