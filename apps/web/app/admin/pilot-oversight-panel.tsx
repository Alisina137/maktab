"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import { formatPilotTimestamp } from "./pilot-timestamp";
import {
  parseOversightPage, parseOversightRelease, summarizeOversightPage,
  oversightReviewActions, type OversightPage, type OversightRelease
} from "./pilot-oversight-triage-model";

type Window = "7d" | "30d" | "90d";
type Kind = "ALL" | "SUPPORT" | "EVIDENCE" | "DECISION" | "IMPORT" | "EXPORT";
type Event = OversightPage["events"][number];
type Page = OversightPage;
type Release = OversightRelease;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const periods: Array<{ value: Window; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" }
];
const kinds: Array<{ value: Kind; label: string }> = [
  { value: "ALL", label: "All events" },
  { value: "SUPPORT", label: "Support activity" },
  { value: "EVIDENCE", label: "Evidence reviews" },
  { value: "DECISION", label: "Pilot decisions" },
  { value: "IMPORT", label: "Data imports" },
  { value: "EXPORT", label: "Data exports" }
];
const actions: Record<string, string> = {
  SUPPORT_OPENED: "Support ticket opened", SUPPORT_IN_PROGRESS: "Support work started",
  SUPPORT_RESOLVED: "Support ticket resolved", SUPPORT_CLOSED: "Support ticket closed",
  SUPPORT_REPLIED: "Support message recorded",
  EVIDENCE_SUBMITTED: "Launch evidence submitted", EVIDENCE_REVIEWED: "Launch evidence reviewed",
  PILOT_APPROVED: "Pilot approval recorded", PILOT_NOT_APPROVED: "Pilot not approved",
  IMPORT_COMPLETED: "School data import completed", IMPORT_REJECTED: "Data import rejected",
  IMPORT_FAILED: "School data import failed", AUDIT_EXPORTED: "Audit history exported",
  SCHOOL_DATA_EXPORTED: "School data exported"
};
const kindLinks: Record<Event["kind"], string> = {
  SUPPORT: "/admin/pilot/launch#pilot-support-form",
  EVIDENCE: "/admin/pilot/launch", DECISION: "/admin/pilot/launch",
  IMPORT: "/admin/pilot/onboarding", EXPORT: "/admin/pilot/audit"
};

async function request<T>(accessToken: string, path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(API_URL + path, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal, cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? "Oversight data could not be loaded.");
  return body as T;
}

export function PilotOversightPanel({ accessToken, locale }: {
  accessToken: string; locale: AdminLocale;
}) {
  const t = (english: string) => adminText(locale, english);
  const [window, setWindow] = useState<Window>("30d");
  const [kind, setKind] = useState<Kind>("ALL");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [onlyReview, setOnlyReview] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const [timelineError, setTimelineError] = useState("");
  const [timelineBusy, setTimelineBusy] = useState(true);
  const [release, setRelease] = useState<Release | null>(null);
  const [releaseError, setReleaseError] = useState("");
  const [releaseBusy, setReleaseBusy] = useState(true);
  const formatTime = (value: string) => formatPilotTimestamp(locale, value);
  const number = (value: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : locale).format(value);
  const pageSummary = page ? summarizeOversightPage(page) : null;
  const visibleEvents = page?.events.filter(entry => !onlyReview || oversightReviewActions.has(entry.action)) ?? [];

  // Timeline failures must not prevent independent release oversight data from displaying.
  useEffect(() => {
    const controller = new AbortController();
    setTimelineBusy(true); setTimelineError(""); setPage(null);
    const query = new URLSearchParams({ window, kind, offset: String(offset), limit: "15" });
    void request<unknown>(accessToken, "/v1/admin/pilot/oversight?" + query.toString(), controller.signal)
      .then((value) => {
        const verified = parseOversightPage(value, { window, kind, limit: 15, offset });
        if (!controller.signal.aborted) setPage(verified);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setTimelineError(adminErrorText(locale, cause, "Oversight timeline could not be loaded."));
      })
      .finally(() => { if (!controller.signal.aborted) setTimelineBusy(false); });
    return () => controller.abort();
  }, [accessToken, locale, window, kind, offset, revision]);

  useEffect(() => {
    const controller = new AbortController();
    setRelease(null); setReleaseError(""); setReleaseBusy(true);
    void request<unknown>(accessToken, "/v1/admin/pilot/release-readiness", controller.signal)
      .then((value) => {
        const verified = parseOversightRelease(value);
        if (!controller.signal.aborted) setRelease(verified);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setReleaseError(adminErrorText(locale, cause, "Release oversight could not be loaded."));
      })
      .finally(() => { if (!controller.signal.aborted) setReleaseBusy(false); });
    return () => controller.abort();
  }, [accessToken, locale, revision]);

  return (
    <section className="pilot-oversight" aria-labelledby="pilot-oversight-heading">
      <header className="admin-section-header">
        <div>
          <span className="eyebrow">{t("Operational accountability")}</span>
          <h3 id="pilot-oversight-heading">{t("Operational auditability & release oversight")}</h3>
          <p>{t("Review recorded pilot operations without accessing private ticket notes, import files or evidence references.")}</p>
        </div>
        <button type="button" className="admin-secondary" disabled={timelineBusy || releaseBusy}
          onClick={() => setRevision((value) => value + 1)}>{t("Refresh")}</button>
      </header>

      <article className="admin-panel pilot-oversight-release">
        <div className="admin-section-header">
          <div>
            <h3>{t("Production release gate")}</h3>
            <p>{t("Pilot approval is not independent authorization for a production release.")}</p>
          </div>
          <span className="pilot-badge pilot-badge-danger">{t("PRODUCTION NO-GO")}</span>
        </div>
        {releaseBusy ? <p role="status">{t("Checking release oversight…")}</p> : null}
        {releaseError ? (
          <div className="admin-error" role="alert">{releaseError}
            <button type="button" className="admin-secondary" onClick={() => setRevision((v) => v + 1)}>
              {t("Retry")}
            </button>
          </div>
        ) : null}
        {release ? (
          <>
            <div className="pilot-oversight-gates">
              <div>
                <span>{t("School setup")}</span>
                <strong>{t(release.setupReady ? "Configured" : "Not verified")}</strong>
              </div>
              <div>
                <span>{t("Pilot approval")}</span>
                <strong>{t(release.effectivePilotApproval ? "Approved for pilot" : "Not approved")}</strong>
              </div>
              <div>
                <span>{t("Verified evidence")}</span>
                <strong>{adminFormat(locale, "{done} of {total} verified", {
                  done: release.evidenceVerified, total: release.evidenceRequired
                })}</strong>
              </div>
              <div>
                <span>{t("Unresolved critical tickets")}</span>
                <strong>{number(release.openCriticalTickets)}</strong>
              </div>
            </div>
            <p className="pilot-security-note">{adminFormat(locale, "{count} external release gates remain unverified.", {
              count: release.missingExternalGates.length
            })}</p>
            <p className="pilot-security-note">{t("Release checks are never automatically approved from dashboard data. Independent Step 20 evidence and operator sign-off are required.")}</p>
          </>
        ) : null}
        <Link className="pilot-inline-link" href="/admin/pilot/launch">{t("Review release acceptance and launch evidence")}</Link>
      </article>

      <section className="admin-panel pilot-oversight-timeline" aria-labelledby="pilot-oversight-timeline-title">
        <div className="admin-section-header">
          <div>
            <h3 id="pilot-oversight-timeline-title">{t("Operational event history")}</h3>
            <p>{t("Newest recorded support, evidence, decisions, imports and exports for this school.")}</p>
          </div>
          <Link href="/admin/pilot/audit" className="pilot-inline-link">{t("Open full audit history")}</Link>
        </div>
        <div className="pilot-oversight-filters">
          <label>{t("Reporting period")}
            <select value={window} disabled={timelineBusy} onChange={(event) => {
              setWindow(event.target.value as Window); setOffset(0);
            }}>
              {periods.map((period) => <option key={period.value} value={period.value}>{t(period.label)}</option>)}
            </select>
          </label>
          <label>{t("Event category")}
            <select value={kind} disabled={timelineBusy} onChange={(event) => {
              setKind(event.target.value as Kind); setOffset(0);
            }}>
              {kinds.map((category) => <option key={category.value} value={category.value}>
                {t(category.label)}
              </option>)}
            </select>
          </label>
        </div>
        <div className="pilot-oversight-review-controls">
          <label>
            <input type="checkbox" checked={onlyReview}
              onChange={(event) => setOnlyReview(event.target.checked)} />
            <span>{t("Show notable records on this page only")}</span>
          </label>
          <p>{t("A notable event is not proof of an unresolved incident. Open Support for current ticket status.")}</p>
        </div>
        {timelineBusy ? <p role="status">{t("Loading operational events…")}</p> : null}
        {timelineError ? (
          <div className="admin-error" role="alert">{timelineError}
            <button type="button" className="admin-secondary" onClick={() => setRevision((n) => n + 1)}>
              {t("Retry")}
            </button>
          </div>
        ) : null}
        {page && pageSummary ? (
          <div className="pilot-oversight-page-metrics">
            {([
              ["Recorded on this page", pageSummary.events],
              ["Notable on this page", pageSummary.needsReview],
              ["Support events on this page", pageSummary.support],
              ["Import events on this page", pageSummary.imports],
              ["Evidence and decisions on this page", pageSummary.evidenceAndDecisions],
              ["Export events on this page", pageSummary.exports]
            ] as const).map(([label, value]) => (
              <div key={label} className="pilot-oversight-page-metric">
                <span>{t(label)}</span><strong>{number(value)}</strong>
              </div>
            ))}
          </div>
        ) : null}
        {page && pageSummary ? (
          <p className="pilot-security-note">
            {adminFormat(locale, "Showing events {start}–{end} from the loaded page.", {
              start: number(pageSummary.start), end: number(pageSummary.end)
            })}
            {" "}{t("These are page counts, not totals for the reporting period.")}
          </p>
        ) : null}
        {page && page.events.length === 0 ? (
          <p>{t("No matching operational events were recorded in this reporting period.")}</p>
        ) : null}
        {page && page.events.length > 0 && visibleEvents.length === 0 ? (
          <p className="pilot-security-note">{t("No notable records on this page. Other pages may contain them.")}</p>
        ) : null}
        {page && visibleEvents.length > 0 ? (
          <ol className="pilot-oversight-list">
            {visibleEvents.map((entry) => (
              <li key={entry.kind + entry.id}
                className={oversightReviewActions.has(entry.action) ?
                  "pilot-oversight-row pilot-oversight-row-review" : "pilot-oversight-row"}>
                <div className="pilot-oversight-event">
                  <span className="pilot-badge">{t(kinds.find((item) => item.value === entry.kind)?.label ?? entry.kind)}</span>
                  <strong>{t(actions[entry.action] ?? "Operational event recorded")}</strong>
                  {oversightReviewActions.has(entry.action) ? (
                    <span className="pilot-badge pilot-badge-warning">{t("Review recorded event")}</span>
                  ) : null}
                  <Link className="pilot-inline-link" href={kindLinks[entry.kind]}>{t("Open section")}</Link>
                </div>
                <time dateTime={entry.occurredAt}>{formatTime(entry.occurredAt)}</time>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="pilot-oversight-pagination">
          <button type="button" className="admin-secondary" disabled={timelineBusy || offset === 0}
            onClick={() => setOffset((n) => Math.max(0, n - (page?.limit ?? 15)))}>{t("Newer")}</button>
          <span aria-live="polite">{adminFormat(locale, "Page {count}", {
            count: number(Math.floor(offset / 15) + 1)
          })}</span>
          <button type="button" className="admin-secondary" disabled={timelineBusy || !page?.hasMore}
            onClick={() => setOffset((n) => n + (page?.limit ?? 15))}>{t("Older")}</button>
        </div>
        <p className="pilot-security-note">{t("The timeline omits actor identities, evidence documents, ticket messages and import contents. Evidence events use an append-only audit log; this timeline does not replace the full audit history or external release evidence.")}</p>
      </section>
    </section>
  );
}
