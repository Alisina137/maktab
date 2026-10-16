"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import { validateOperationalSummary } from "./pilot-operational-readiness-model";

type MetricKey = "teacher_overlap" | "class_overlap" | "assignment_gap" | "invalid_period";
type Metric = {
  key: MetricKey; severity: "critical" | "warning";
  status: "critical" | "warning" | "complete" | "not_applicable";
  total: number; complete: number; missing: number; percentage: number | null;
};
type Operational = {
  ready: boolean;
  evaluatedPeriods: number;
  scope: "active_year_timetable";
  critical: number; warnings: number; metrics: Metric[];
};
type IssuePage = {
  metric: MetricKey; rows: Array<{ id: string; label: string }>;
  limit: number; offset: number; hasMore: boolean;
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const labels: Record<MetricKey, string> = {
  teacher_overlap: "Teacher double-bookings",
  class_overlap: "Overlapping class periods",
  assignment_gap: "Periods without matching active teacher assignments",
  invalid_period: "Invalid times or Friday periods"
};
const destinations: Record<MetricKey, string> = {
  teacher_overlap: "/admin/academics/timetable",
  class_overlap: "/admin/academics/timetable",
  assignment_gap: "/admin/academics/assignments",
  invalid_period: "/admin/academics/timetable"
};

async function request<T>(token: string, path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(API_URL + path, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store", signal
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.message ?? "Operational checks could not be loaded.");
  return json as T;
}

export function PilotOperationalReadinessPanel({ accessToken, locale, compact = false }: {
  accessToken: string; locale: AdminLocale; compact?: boolean;
}) {
  const t = (value: string) => adminText(locale, value);
  const [summary, setSummary] = useState<Operational | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<MetricKey | null>(null);
  const [offset, setOffset] = useState(0);
  const [issues, setIssues] = useState<IssuePage | null>(null);
  const [issueRevision, setIssueRevision] = useState(0);
  const [issuesBusy, setIssuesBusy] = useState(false);
  const [issuesError, setIssuesError] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    setSummary(null); setError(""); setLoading(true);
    setSelected(null); setIssues(null); setOffset(0);
    void request<Operational>(accessToken, "/v1/admin/pilot/readiness/operational", abort.signal)
      .then((data) => { if (!abort.signal.aborted) setSummary(validateOperationalSummary(data)); })
      .catch((cause) => { if (!abort.signal.aborted) setError(
        adminErrorText(locale, cause, "Operational checks could not be loaded.")
      ); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [accessToken, locale, revision]);

  useEffect(() => {
    if (!selected) { setIssues(null); setIssuesBusy(false); setIssuesError(""); return; }
    const abort = new AbortController();
    setIssues(null); setIssuesError(""); setIssuesBusy(true);
    const query = new URLSearchParams({ metric: selected, limit: "10", offset: String(offset) });
    void request<IssuePage>(accessToken, "/v1/admin/pilot/readiness/operational/issues?" + query, abort.signal)
      .then((data) => { if (!abort.signal.aborted) setIssues(data); })
      .catch((cause) => { if (!abort.signal.aborted) setIssuesError(
        adminErrorText(locale, cause, "Could not load affected timetable periods.")
      ); })
      .finally(() => { if (!abort.signal.aborted) setIssuesBusy(false); });
    return () => abort.abort();
  }, [accessToken, locale, selected, offset, issueRevision]);

  if (compact) {
    return (
      <section className="pilot-operational-compact admin-panel" aria-label={t("Timetable integrity")}>
        <div>
          <strong>{t("Timetable integrity")}</strong>
          {loading ? <p role="status">{t("Checking timetable integrity…")}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {summary ? (
            <p>{summary.evaluatedPeriods === 0 ?
              t("No active-year periods exist; readiness cannot be confirmed. Configure the timetable first.") :
              summary.ready ? t("Timetable checks passed") :
              adminFormat(locale, "{critical} critical checks and {warnings} warnings.", {
                critical: summary.critical, warnings: summary.warnings
              })}</p>
          ) : null}
        </div>
        <Link className="pilot-inline-link" href="/admin/pilot/readiness">
          {t("Review timetable")}
        </Link>
      </section>
    );
  }

  return (
    <section className="pilot-operational admin-panel" aria-labelledby="pilot-operational-title">
      <div className="admin-section-header">
        <div>
          <span className="eyebrow">{t("Operational validation")}</span>
          <h3 id="pilot-operational-title">{t("Timetable integrity")}</h3>
          <p>{t("Checks current active-year timetable periods for conflicts, invalid hours and broken teacher assignments.")}</p>
        </div>
        {summary ? (
          <span className={"pilot-badge " +
            (summary.ready ? "pilot-badge-ok" : "pilot-badge-warning")}>
            {t(summary.ready ? "Timetable checks passed" : "Timetable needs review")}
          </span>
        ) : null}
      </div>
      {loading ? <p role="status">{t("Checking timetable integrity…")}</p> : null}
      {error ? (
        <div className="pilot-retry-alert admin-error" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-secondary" onClick={() => setRevision((v) => v + 1)}>
            {t("Retry")}
          </button>
        </div>
      ) : null}
      {summary ? (
        <>
          <p className="pilot-operational-count">{adminFormat(locale, "{count} timetable periods inspected in the active academic year.", {
            count: summary.evaluatedPeriods
          })}</p>
          {summary.evaluatedPeriods === 0 ? (
            <p className="pilot-security-note">{t("No active-year periods exist; readiness cannot be confirmed. Configure the timetable first.")}</p>
          ) : null}
          <div className="pilot-operational-grid">
            {summary.metrics.map((metric) => (
              <article key={metric.key} className="pilot-operational-card">
                <div className="pilot-coverage-top">
                  <strong>{t(labels[metric.key])}</strong>
                  <span className={"pilot-badge " + (
                    metric.status === "critical" ? "pilot-badge-danger" :
                    metric.status === "warning" ? "pilot-badge-warning" : "pilot-badge-ok"
                  )}>{t(metric.status === "not_applicable" ? "Not applicable" :
                    metric.status === "complete" ? "Passed" :
                    metric.status === "critical" ? "Critical" : "Warning")}</span>
                </div>
                <p>{metric.total === 0 ? t("No eligible records in the active academic year.") :
                  adminFormat(locale, "{count} affected periods of {total}", {
                    count: metric.missing, total: metric.total
                  })}</p>
                <progress max={Math.max(metric.total, 1)} value={metric.complete}
                  aria-label={t(labels[metric.key])} />
                <div className="pilot-coverage-actions">
                  {metric.missing > 0 ? (
                    <button type="button" className="admin-secondary"
                      aria-expanded={selected === metric.key}
                      onClick={() => {
                        setOffset(0);
                        setSelected(selected === metric.key ? null : metric.key);
                      }}>{adminFormat(locale, "Review {count} affected", { count: metric.missing })}</button>
                  ) : null}
                  <Link className="pilot-inline-link" href={destinations[metric.key]}>
                    {t("Open section")}
                  </Link>
                </div>
                {selected === metric.key ? (
                  <div className="pilot-coverage-issues">
                    {issuesBusy ? <p role="status">{t("Loading affected periods…")}</p> : null}
                    {issuesError ? (
                      <div role="alert" className="pilot-activity-error">
                        <span>{issuesError}</span>
                        <button type="button" className="admin-secondary"
                          onClick={() => setIssueRevision((v) => v + 1)}>{t("Retry")}</button>
                      </div>
                    ) : null}
                    {issues?.metric === metric.key ? (
                      <>
                        <ul>{issues.rows.map((row) => <li key={row.id} dir="auto">{row.label}</li>)}</ul>
                        <div className="pilot-coverage-paging">
                          <button className="admin-secondary" type="button"
                            disabled={issues.offset === 0 || issuesBusy}
                            onClick={() => setOffset(Math.max(0, offset - issues.limit))}>{t("Newer")}</button>
                          <button className="admin-secondary" type="button"
                            disabled={!issues.hasMore || issuesBusy}
                            onClick={() => setOffset(offset + issues.limit)}>{t("Older")}</button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <p className="pilot-security-note">{t("Timetable validation is advisory configuration evidence, not verification of live teaching, attendance, backups or production release.")}</p>
        </>
      ) : null}
    </section>
  );
}
