"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminErrorText, adminText, type AdminLocale } from "./admin-i18n";
import { formatAdminHijriDateTime } from "./admin-hijri-date-picker";

type HealthResponse = {
  report: {
    evaluatedAt: string; timeZone: "Asia/Kabul";
    api: "responding"; database: "query_succeeded";
    notificationQueue: { pending: number; stalePending: number; failed: number;
      status: "attention" | "no_backlog" };
    support: { unresolved: number; unresolvedCritical: number;
      status: "attention" | "no_critical_tickets" };
    imports: { failedLast7Days: number; status: "attention" | "no_recent_failures" };
    unverified: Array<"scheduler" | "push_delivery" | "backups" | "uptime_history">;
  };
  subscription: {
    status: string; level: "healthy" | "info" | "warning" | "critical";
    code: string; platformReviewNeeded: boolean; operationalWritesBlocked: boolean;
    daysUntilExpiry: number | null;
  };
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function PilotServiceHealthPanel({ accessToken, locale }: {
  accessToken: string; locale: AdminLocale;
}) {
  const t = (value: string) => adminText(locale, value);
  const number = (value: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : locale).format(value);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setError("");
    void (async () => {
      try {
        const response = await fetch(API_URL + "/v1/admin/pilot/service-health", {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal, cache: "no-store"
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.message ?? "Service health report could not be loaded.");
        if (!controller.signal.aborted) setData(body as HealthResponse);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(adminErrorText(locale, cause, "Service health report could not be loaded."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accessToken, locale, revision]);

  return (
    <section className="pilot-service" aria-labelledby="pilot-service-title">
      <header className="admin-section-header">
        <div>
          <span className="eyebrow">{t("Pilot operations monitoring")}</span>
          <h3 id="pilot-service-title">{t("Service health & assistance")}</h3>
          <p>{t("Live school-scoped records and a one-time API/database query; not an uptime or external delivery guarantee.")}</p>
        </div>
        <button type="button" className="admin-secondary" disabled={loading}
          onClick={() => setRevision((v) => v + 1)}>{t("Refresh status")}</button>
      </header>
      {loading ? <div role="status" className="admin-panel">{t("Checking service health…")}</div> : null}
      {error ? (
        <div className="admin-error pilot-service-error" role="alert">
          <strong>{t("Unable to verify service health")}</strong>
          <span>{error}</span>
          <span>{t("A failed request is not a confirmed outage. Check your connection and retry.")}</span>
          <button className="admin-secondary" type="button" onClick={() => setRevision((v) => v + 1)}>{t("Retry")}</button>
        </div>
      ) : null}
      {data ? (
        <>
          <p className="pilot-security-note">
            {t("Last checked")}: <time dateTime={data.report.evaluatedAt}>
              {locale === "en"
                ? new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium", timeStyle: "short", hour12: true,
                    timeZone: "Asia/Kabul"
                  }).format(new Date(data.report.evaluatedAt))
                : formatAdminHijriDateTime(locale, data.report.evaluatedAt, "Asia/Kabul")}
            </time> · {t("Reporting timezone: Asia/Kabul")}
          </p>
          <div className="pilot-service-grid">
            <article className="admin-panel pilot-service-card">
              <span className="eyebrow">{t("API and database")}</span>
              <h4>{t("Responding to this request")}</h4>
              <span className="pilot-badge pilot-badge-ok">{t("Query succeeded")}</span>
              <p>{t("This only confirms the current authenticated API request and one successful database query.")}</p>
            </article>
            <article className="admin-panel pilot-service-card">
              <span className="eyebrow">{t("Notification queue")}</span>
              <h4>{t(data.report.notificationQueue.status === "attention" ? "Queue requires attention" : "No failed or stale pending notifications recorded")}</h4>
              <span className={"pilot-badge " + (data.report.notificationQueue.status === "attention" ? "pilot-badge-warning" : "pilot-badge-ok")}>
                {t(data.report.notificationQueue.status === "attention" ? "Attention" : "No backlog alert")}
              </span>
              <dl>
                <div><dt>{t("Pending")}</dt><dd>{number(data.report.notificationQueue.pending)}</dd></div>
                <div><dt>{t("Pending over one hour")}</dt><dd>{number(data.report.notificationQueue.stalePending)}</dd></div>
                <div><dt>{t("Failed")}</dt><dd>{number(data.report.notificationQueue.failed)}</dd></div>
              </dl>
              <p>{t("Queue records do not prove push delivery or background worker availability.")}</p>
            </article>
            <article className="admin-panel pilot-service-card">
              <span className="eyebrow">{t("Support workload")}</span>
              <h4>{t(data.report.support.status === "attention" ? "Unresolved critical tickets" : "No unresolved critical tickets")}</h4>
              <span className={"pilot-badge " + (data.report.support.status === "attention" ? "pilot-badge-danger" : "pilot-badge-ok")}>
                {t(data.report.support.status === "attention" ? "Attention" : "No critical tickets")}
              </span>
              <dl>
                <div><dt>{t("Unresolved tickets")}</dt><dd>{number(data.report.support.unresolved)}</dd></div>
                <div><dt>{t("Unresolved critical")}</dt><dd>{number(data.report.support.unresolvedCritical)}</dd></div>
              </dl>
              <Link className="pilot-inline-link" href="/admin/pilot/launch#pilot-support-form">{t("Open support center")}</Link>
            </article>
            <article className="admin-panel pilot-service-card">
              <span className="eyebrow">{t("Import outcomes")}</span>
              <h4>{t("Failed imports in the last 7 days")}</h4>
              <strong className="pilot-service-number">{number(data.report.imports.failedLast7Days)}</strong>
              <span className={"pilot-badge " + (data.report.imports.status === "attention" ? "pilot-badge-warning" : "pilot-badge-ok")}>
                {t(data.report.imports.status === "attention" ? "Attention" : "No recent failures")}
              </span>
              <p>{t("Counts failed import batches, not intentionally rejected validation previews.")}</p>
              <Link className="pilot-inline-link" href="/admin/pilot/onboarding">{t("Review import history")}</Link>
            </article>
          </div>

          <article className="admin-panel pilot-service-billing">
            <div>
              <span className="eyebrow">{t("Subscription assistance")}</span>
              <h3>{t("Recorded subscription status")}: {t(data.subscription.status)}</h3>
              <p>{t("Billing, renewal, reactivation and pricing changes require platform review.")}</p>
              {data.subscription.platformReviewNeeded ? (
                <p role="status" className="pilot-security-note">
                  {t("Recorded subscription dates and lifecycle state may be out of sync; request a platform review.")}
                </p>
              ) : null}
              {data.subscription.operationalWritesBlocked ? (
                <p role="status" className="pilot-security-note">{t("School operational changes are blocked by the recorded subscription status.")}</p>
              ) : null}
            </div>
            <div className="pilot-service-actions">
              <Link className="admin-secondary" href="/admin/pilot/subscription">{t("View subscription")}</Link>
              <Link className="admin-primary" href="/admin/pilot/launch?support=billing#pilot-support-form">{t("Request billing help")}</Link>
            </div>
          </article>
          <div className="admin-panel pilot-service-caveat" role="note">
            <strong>{t("Not independently monitored")}</strong>
            <p>{t("Scheduler execution, external push delivery, backup restoration and historical uptime are unverified here. Zero alerts must never be treated as proof these services are healthy.")}</p>
            <Link className="pilot-inline-link" href="/admin/pilot/launch?support=technical#pilot-support-form">
              {t("Report a technical issue")}
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
}
