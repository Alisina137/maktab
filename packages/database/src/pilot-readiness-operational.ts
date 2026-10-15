import { sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";

// School-scope and current active academic years are enforced in the SQL, not by the UI.
// Counts represent affected timetable periods, NOT independent collision pairs.
export const operationalReadinessKeys = [
  "teacher_overlap", "class_overlap", "assignment_gap", "invalid_period"
] as const;
export type OperationalReadinessKey = (typeof operationalReadinessKeys)[number];
export type OperationalReadinessMetric = {
  key: OperationalReadinessKey;
  severity: "critical" | "warning";
  status: "critical" | "warning" | "complete" | "not_applicable";
  total: number; complete: number; missing: number; percentage: number | null;
};
export type OperationalReadiness = {
  ready: boolean;
  scope: "active_year_timetable";
  evaluatedPeriods: number;
  critical: number; warnings: number;
  metrics: OperationalReadinessMetric[];
};
export type OperationalIssues = {
  metric: OperationalReadinessKey;
  rows: Array<{ id: string; label: string }>;
  offset: number; limit: number; hasMore: boolean;
};
const definitions: ReadonlyArray<{ key: OperationalReadinessKey; severity: "critical" | "warning" }> = [
  { key: "teacher_overlap", severity: "critical" },
  { key: "class_overlap", severity: "critical" },
  { key: "assignment_gap", severity: "warning" },
  { key: "invalid_period", severity: "warning" }
];

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return (result as { rows?: Record<string, unknown>[] }).rows ?? [];
}

function currentSchedule(schoolId: string) {
  return sql`WITH
    current_periods AS (
      SELECT tt.id::text AS id, tt.school_id, tt.academic_year_id,
        tt.class_id, tt.teacher_user_id, tt.subject_id, tt.weekday,
        tt.starts_at, tt.ends_at,
        CONCAT(c.code, ' · ', c.name, ' · ', tt.weekday, ' ',
          tt.starts_at, '–', tt.ends_at) AS label
      FROM timetable_periods tt
      JOIN academic_years ay ON ay.id = tt.academic_year_id
        AND ay.school_id = tt.school_id AND ay.status = 'ACTIVE'
      JOIN class_sections c ON c.id = tt.class_id
        AND c.school_id = tt.school_id AND c.academic_year_id = tt.academic_year_id
      WHERE tt.school_id = ${schoolId}::uuid
    ),
    valid_periods AS (
      SELECT * FROM current_periods
      WHERE weekday <> 'FRIDAY'
        AND starts_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND ends_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND starts_at < ends_at
    ),
    period_flags AS (
      SELECT p.id, p.label,
        NOT EXISTS (
          SELECT 1 FROM valid_periods v WHERE v.id = p.id
        ) AS invalid_period,
        NOT EXISTS (
          SELECT 1 FROM teacher_assignments ta
          JOIN users u ON u.id = ta.teacher_user_id AND u.school_id = ta.school_id
          WHERE ta.school_id = ${schoolId}::uuid
            AND ta.academic_year_id = p.academic_year_id
            AND ta.class_id = p.class_id
            AND ta.subject_id = p.subject_id
            AND ta.teacher_user_id = p.teacher_user_id
            AND u.role = 'TEACHER' AND u.status = 'ACTIVE'
        ) AS assignment_gap,
        EXISTS (
          SELECT 1 FROM valid_periods me
          JOIN valid_periods peer ON peer.school_id = me.school_id
            AND peer.academic_year_id = me.academic_year_id
            AND peer.weekday = me.weekday AND peer.id <> me.id
          WHERE me.id = p.id AND peer.class_id = me.class_id
            AND me.starts_at < peer.ends_at AND peer.starts_at < me.ends_at
        ) AS class_overlap,
        EXISTS (
          SELECT 1 FROM valid_periods me
          JOIN valid_periods peer ON peer.school_id = me.school_id
            AND peer.academic_year_id = me.academic_year_id
            AND peer.weekday = me.weekday AND peer.id <> me.id
          WHERE me.id = p.id AND peer.teacher_user_id = me.teacher_user_id
            AND me.starts_at < peer.ends_at AND peer.starts_at < me.ends_at
        ) AS teacher_overlap
      FROM current_periods p
    )`;
}

export async function getOperationalReadiness(
  db: FoundationDatabase, schoolId: string
): Promise<OperationalReadiness> {
  // Only developer-owned identifiers from definitions are ever interpolated.
  const summaries = definitions.map(({ key }) => sql`
    SELECT ${key}::text AS key, COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ${sql.raw(key)})::int AS affected
    FROM period_flags
  `);
  const rows = rowsOf(await db.execute(sql`
    ${currentSchedule(schoolId)},
    summaries AS (${sql.join(summaries, sql` UNION ALL `)})
    SELECT key, total, affected FROM summaries
  `));
  const result = new Map(rows.map((row) => [
    String(row.key), { total: Number(row.total), affected: Number(row.affected) }
  ]));
  const metrics = definitions.map(({ key, severity }): OperationalReadinessMetric => {
    const { total, affected } = result.get(key) ?? { total: 0, affected: 0 };
    return {
      key, severity, total, complete: total - affected, missing: affected,
      percentage: total ? Math.round((total - affected) / total * 100) : null,
      status: total === 0 ? "not_applicable" : affected > 0 ? severity : "complete"
    };
  });
  const evaluatedPeriods = metrics[0]?.total ?? 0;
  return {
    ready: evaluatedPeriods > 0 && metrics.every((metric) => metric.missing === 0),
    scope: "active_year_timetable", evaluatedPeriods,
    critical: metrics.filter((metric) => metric.status === "critical").length,
    warnings: metrics.filter((metric) => metric.status === "warning").length,
    metrics
  };
}

export async function listOperationalIssues(
  db: FoundationDatabase, schoolId: string, metric: OperationalReadinessKey,
  options: { limit: number; offset: number }
): Promise<OperationalIssues> {
  if (!definitions.some((definition) => definition.key === metric)) {
    throw new Error("Unknown operational readiness metric.");
  }
  // Metric is a validated, developer-owned SQL identifier. Never use user input as SQL.
  const rows = rowsOf(await db.execute(sql`
    ${currentSchedule(schoolId)}
    SELECT id, label FROM period_flags WHERE ${sql.raw(metric)}
    ORDER BY label, id
    LIMIT ${options.limit + 1} OFFSET ${options.offset}
  `));
  return {
    metric, rows: rows.slice(0, options.limit).map((row) => ({
      id: String(row.id), label: String(row.label)
    })),
    offset: options.offset, limit: options.limit, hasMore: rows.length > options.limit
  };
}
