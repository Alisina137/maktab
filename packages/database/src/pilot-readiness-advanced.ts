import { sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";

// All metrics are school scoped. Counts are calculated in PostgreSQL.
// These are configuration checks, not production-launch approvals.
export const pilotCoverageKeys = [
  "teaching", "timetable", "negaran", "class_students",
  "family_links", "student_logins", "teacher_logins"
] as const;
export type PilotCoverageKey = (typeof pilotCoverageKeys)[number];
export type PilotCoverageCategory = "academics" | "attendance" | "families";
export type PilotCoverageSeverity = "critical" | "warning";
export type PilotCoverageStatus = "complete" | "critical" | "warning" | "not_applicable";
export type PilotCoverageMetric = {
  key: PilotCoverageKey; category: PilotCoverageCategory; severity: PilotCoverageSeverity;
  status: PilotCoverageStatus; total: number; complete: number; missing: number;
  percentage: number | null;
};
export type AdvancedPilotReadiness = {
  ready: boolean; coreReady: boolean; warnings: number; critical: number;
  metrics: PilotCoverageMetric[];
};
export type PilotCoverageIssue = { id: string; label: string };
export type PilotCoverageIssues = {
  metric: PilotCoverageKey; rows: PilotCoverageIssue[];
  offset: number; limit: number; hasMore: boolean;
};

function kabulDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return [part("year"), part("month"), part("day")].join("-");
}

// EXISTS prevents double-counting multiple teachers, timetable periods, or guardians.
function scopedCoverage(schoolId: string, today: string) {
  return sql`WITH
    class_coverage AS (
      SELECT c.id::text AS id, CONCAT(c.code, ' · ', c.name) AS label,
        EXISTS (
          SELECT 1 FROM teacher_assignments ta
          JOIN users tu ON tu.id = ta.teacher_user_id AND tu.school_id = ta.school_id
          WHERE ta.school_id = ${schoolId}::uuid AND ta.academic_year_id = c.academic_year_id
            AND ta.class_id = c.id AND tu.role = 'TEACHER' AND tu.status = 'ACTIVE'
        ) AS teaching,
        EXISTS (
          SELECT 1 FROM timetable_periods tt
          JOIN users tu ON tu.id = tt.teacher_user_id AND tu.school_id = tt.school_id
          JOIN teacher_assignments ta ON ta.school_id = tt.school_id
            AND ta.academic_year_id = tt.academic_year_id AND ta.class_id = tt.class_id
            AND ta.subject_id = tt.subject_id AND ta.teacher_user_id = tt.teacher_user_id
          WHERE tt.school_id = ${schoolId}::uuid AND tt.academic_year_id = c.academic_year_id
            AND tt.class_id = c.id AND tt.weekday <> 'FRIDAY'
            AND tu.role = 'TEACHER' AND tu.status = 'ACTIVE'
        ) AS timetable,
        EXISTS (
          SELECT 1 FROM negaran_assignments na
          JOIN users tu ON tu.id = na.teacher_user_id AND tu.school_id = na.school_id
          WHERE na.school_id = ${schoolId}::uuid AND na.academic_year_id = c.academic_year_id
            AND na.class_id = c.id AND na.start_date <= ${today}::date
            AND (na.end_date IS NULL OR na.end_date >= ${today}::date)
            AND tu.role = 'TEACHER' AND tu.status = 'ACTIVE'
        ) AS negaran,
        EXISTS (
          SELECT 1 FROM students s WHERE s.school_id = ${schoolId}::uuid
            AND s.academic_year_id = c.academic_year_id AND s.class_id = c.id AND s.status = 'ACTIVE'
        ) AS class_students
      FROM class_sections c
      JOIN academic_years y ON y.id = c.academic_year_id AND y.school_id = c.school_id AND y.status = 'ACTIVE'
      WHERE c.school_id = ${schoolId}::uuid
    ),
    student_coverage AS (
      SELECT s.id::text AS id, CONCAT(s.student_code, ' · ', s.full_name) AS label,
        (
          EXISTS (
            SELECT 1 FROM parent_profiles pp
            JOIN users pu ON pu.id = pp.user_id AND pu.school_id = pp.school_id
            WHERE pp.school_id = ${schoolId}::uuid AND pp.user_id = s.parent_user_id
              AND pu.role = 'PARENT' AND pu.status = 'ACTIVE'
          ) AND EXISTS (
            SELECT 1 FROM class_sections c
            WHERE c.school_id = ${schoolId}::uuid AND c.id = s.class_id
              AND c.academic_year_id = s.academic_year_id
          )
        ) AS family_links,
        EXISTS (
          SELECT 1 FROM users su
          WHERE su.school_id = ${schoolId}::uuid AND su.id = s.user_id
            AND su.role = 'STUDENT' AND su.status = 'ACTIVE' AND NOT su.must_change_password
        ) AS student_logins
      FROM students s
      JOIN academic_years y ON y.id = s.academic_year_id AND y.school_id = s.school_id AND y.status = 'ACTIVE'
      WHERE s.school_id = ${schoolId}::uuid AND s.status = 'ACTIVE'
    ),
    teacher_coverage AS (
      SELECT tp.user_id::text AS id, tp.full_name AS label,
        NOT u.must_change_password AS teacher_logins
      FROM teacher_profiles tp
      JOIN users u ON u.id = tp.user_id AND u.school_id = tp.school_id
      WHERE tp.school_id = ${schoolId}::uuid AND u.role = 'TEACHER' AND u.status = 'ACTIVE'
    )`;
}

const definitions: ReadonlyArray<{
  key: PilotCoverageKey; category: PilotCoverageCategory; severity: PilotCoverageSeverity;
  source: "class_coverage" | "student_coverage" | "teacher_coverage";
}> = [
  { key: "teaching", category: "academics", severity: "critical", source: "class_coverage" },
  { key: "timetable", category: "academics", severity: "warning", source: "class_coverage" },
  { key: "class_students", category: "academics", severity: "warning", source: "class_coverage" },
  { key: "negaran", category: "attendance", severity: "warning", source: "class_coverage" },
  { key: "family_links", category: "families", severity: "critical", source: "student_coverage" },
  { key: "student_logins", category: "families", severity: "warning", source: "student_coverage" },
  { key: "teacher_logins", category: "families", severity: "warning", source: "teacher_coverage" }
];

function rowsOf(value: unknown): Record<string, unknown>[] {
  const wrapped = value as { rows?: Record<string, unknown>[] };
  return Array.isArray(value) ? value as Record<string, unknown>[] : wrapped.rows ?? [];
}

export async function getAdvancedPilotReadiness(
  db: FoundationDatabase, schoolId: string, coreReady: boolean
): Promise<AdvancedPilotReadiness> {
  // SQL identifiers derive only from developer-owned definitions, never from user input.
  const summaries = definitions.map((item) => sql`
    SELECT ${item.key}::text AS key, COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ${sql.raw(item.key)})::int AS complete
    FROM ${sql.raw(item.source)}
  `);
  const rows = rowsOf(await db.execute(sql`
    ${scopedCoverage(schoolId, kabulDate())},
    counts AS (${sql.join(summaries, sql` UNION ALL `)})
    SELECT key, total, complete FROM counts
  `));
  const found = new Map(rows.map((row) => [
    String(row.key), { total: Number(row.total), complete: Number(row.complete) }
  ]));
  const metrics: PilotCoverageMetric[] = definitions.map(({ key, category, severity }) => {
    const count = found.get(key) ?? { total: 0, complete: 0 };
    const missing = count.total - count.complete;
    return {
      key, category, severity,
      status: count.total === 0 ? "not_applicable" : missing === 0 ? "complete" : severity,
      total: count.total, complete: count.complete, missing,
      percentage: count.total ? Math.round(count.complete / count.total * 100) : null
    };
  });
  const criticalReady = metrics.filter((item) => item.severity === "critical")
    .every((item) => item.total > 0 && item.missing === 0);
  return {
    ready: coreReady && criticalReady, coreReady,
    warnings: metrics.filter((item) => item.status === "warning").length,
    critical: metrics.filter((item) => item.status === "critical").length,
    metrics
  };
}

export async function listPilotReadinessIssues(
  db: FoundationDatabase, schoolId: string, metric: PilotCoverageKey, options: { limit: number; offset: number }
): Promise<PilotCoverageIssues> {
  const definition = definitions.find((item) => item.key === metric);
  if (!definition) throw new Error("Unknown pilot coverage metric.");
  const rows = rowsOf(await db.execute(sql`
    ${scopedCoverage(schoolId, kabulDate())}
    SELECT id, label FROM ${sql.raw(definition.source)}
    WHERE NOT ${sql.raw(metric)}
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
