"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import { formatPilotTimestamp } from "./pilot-timestamp";

type Window = "7d" | "30d" | "90d";
type Kind = "ALL" | "SUPPORT" | "EVIDENCE" | "DECISION" | "IMPORT" | "EXPORT";
type Event = { id: string; kind: Exclude<Kind, "ALL">; action: string; occurredAt: string };
type Page = { events: Event[]; limit: number; offset: number; hasMore: boolean;
  window: Window; kind: Kind; startAt: string; endAt: string; timeZone: "Asia/Kabul" };
type Release = { productionDecision: "NO_GO"; setupReady: boolean;
  effectivePilotApproval: boolean; evidenceVerified: number; evidenceRequired: number;
  openCriticalTickets: number; missingExternalGates: string[] };

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
  const [page, setPage] = useState<Page | null>(null);
  const [timelineError, setTimelineError] = useState("");
  const [timelineBusy, setTimelineBusy] = useState(true);
  const [release, setRelease] = useState<Release | null>(null);
  const [releaseError, setReleaseError] = useState("");
  const [releaseBusy, setReleaseBusy] = useState(true);
  const formatTime = (value: string) => formatPilotTimestamp(locale, value);
  const number = (value: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : locale).format(value);

  // Timeline failures must not prevent independent release oversight data from displaying.
  useEffect(() => {
    const controller = new AbortController();
    setTimelineBusy(true); setTimelineError(""); setPage(null);
    const query = new URLSearchParams({ window, kind, offset: String(offset), limit: "15" });
    void request<Page>(accessToken, "/v1/admin/pilot/oversight?" + query.toString(), controller.signal)
      .then((value) => { if (!controller.signal.aborted) setPage(value); })
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
    void request<Release>(accessToken, "/v1/admin/pilot/release-readiness", controller.signal)
      .then((value) => { if (!controller.signal.aborted) setRelease(value); })
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
        {timelineBusy ? <p role="status">{t("Loading operational events…")}</p> : null}
        {timelineError ? (
          <div className="admin-error" role="alert">{timelineError}
            <button type="button" className="admin-secondary" onClick={() => setRevision((n) => n + 1)}>
              {t("Retry")}
            </button>
          </div>
        ) : null}
        {page && page.events.length === 0 ? (
          <p>{t("No matching operational events were recorded in this reporting period.")}</p>
        ) : null}
        {page && page.events.length > 0 ? (
          <ol className="pilot-oversight-list">
            {page.events.map((entry) => (
              <li key={entry.kind + entry.id} className="pilot-oversight-row">
                <div className="pilot-oversight-event">
                  <span className="pilot-badge">{t(kinds.find((item) => item.value === entry.kind)?.label ?? entry.kind)}</span>
                  <strong>{t(actions[entry.action] ?? "Operational event recorded")}</strong>
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
