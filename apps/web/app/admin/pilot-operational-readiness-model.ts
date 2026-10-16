/** Fail closed for unexpected operational-timetable summaries.
 * A malformed response cannot display a false "Timetable checks passed".
 */
export const operationalMetricKeys = [
  "teacher_overlap", "class_overlap", "assignment_gap", "invalid_period"
] as const;
export type OperationalKey = (typeof operationalMetricKeys)[number];
export type OperationalMetric = {
  key: OperationalKey; severity: "critical" | "warning";
  status: "critical" | "warning" | "complete" | "not_applicable";
  total: number; complete: number; missing: number; percentage: number | null;
};
export type ValidatedOperational = {
  ready: boolean; evaluatedPeriods: number; scope: "active_year_timetable";
  critical: number; warnings: number; metrics: OperationalMetric[];
};
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid timetable summary.");
  return input as Record<string, unknown>;
}
function natural(input: unknown): number {
  if (!Number.isSafeInteger(input) || (input as number) < 0)
    throw new Error("Invalid timetable count.");
  return input as number;
}
export function validateOperationalSummary(input: unknown): ValidatedOperational {
  const result = record(input);
  if (result.scope !== "active_year_timetable" ||
      typeof result.ready !== "boolean" ||
      !Array.isArray(result.metrics) || result.metrics.length !== operationalMetricKeys.length)
    throw new Error("Incomplete timetable summary.");
  const evaluatedPeriods = natural(result.evaluatedPeriods);
  const seen = new Set<string>();
  const metrics: OperationalMetric[] = result.metrics.map(raw => {
    const item = record(raw);
    const key = item.key;
    if (typeof key !== "string" ||
        !operationalMetricKeys.some(allowed => allowed === key) ||
        seen.has(key)) throw new Error("Unexpected timetable metric.");
    seen.add(key);
    const critical = key === "teacher_overlap" || key === "class_overlap";
    const severity = critical ? "critical" : "warning";
    const total = natural(item.total), missing = natural(item.missing);
    const complete = natural(item.complete);
    if (item.severity !== severity || total !== evaluatedPeriods || complete + missing !== total)
      throw new Error("Contradictory timetable count.");
    const status = total === 0 ? "not_applicable" :
      missing ? severity : "complete";
    if (item.status !== status ||
        item.percentage !== (total ? Math.round(complete / total * 100) : null))
      throw new Error("Contradictory timetable metric.");
    return { key: key as OperationalKey, severity, total, complete, missing,
      percentage: item.percentage as number | null, status };
  });
  const critical = metrics.filter(metric => metric.status === "critical").length;
  const warnings = metrics.filter(metric => metric.status === "warning").length;
  const ready = evaluatedPeriods > 0 && metrics.every(metric => metric.missing === 0);
  if (natural(result.critical) !== critical || natural(result.warnings) !== warnings ||
      result.ready !== ready) throw new Error("Contradictory timetable readiness.");
  return { ready, scope: "active_year_timetable", evaluatedPeriods, critical, warnings, metrics };
}
