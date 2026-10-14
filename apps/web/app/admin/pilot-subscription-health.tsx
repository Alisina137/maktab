"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAdminHijriDate } from "./admin-hijri-date-picker";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";

type HealthCode = "CANCELLED" | "SUSPENDED" | "GRACE_ENDED" | "GRACE_PERIOD" | "PAST_DUE" |
  "EXPIRED_PENDING_UPDATE" | "EXPIRES_SOON" | "EXPIRING" | "NO_EXPIRY" | "ON_TRACK";

type SubscriptionHealth = {
  status: string;
  evaluatedOn: string;
  code: HealthCode;
  level: "healthy" | "info" | "warning" | "critical";
  operationalWritesBlocked: boolean;
  expiryDate: string | null;
  graceEndDate: string | null;
  daysUntilExpiry: number | null;
  daysUntilGraceEnd: number | null;
  nextReminderDays: number | null;
  platformReviewNeeded: boolean;
};

const codeLabels: Record<HealthCode, string> = {
  CANCELLED: "Subscription cancelled",
  SUSPENDED: "Subscription suspended",
  GRACE_ENDED: "Grace period has ended",
  GRACE_PERIOD: "Subscription in grace period",
  PAST_DUE: "Subscription past due",
  EXPIRED_PENDING_UPDATE: "Expiry passed; platform status update pending",
  EXPIRES_SOON: "Subscription expires soon",
  EXPIRING: "Subscription renewal approaching",
  NO_EXPIRY: "No expiry date configured",
  ON_TRACK: "Subscription on track"
};

const codeGuidance: Record<HealthCode, string> = {
  CANCELLED: "The platform marks this subscription as cancelled. Contact platform support for next steps.",
  SUSPENDED: "School operational changes are disabled. Contact platform support to review reactivation.",
  GRACE_ENDED: "The recorded grace period is over; platform status may not yet reflect the latest transition. Contact support.",
  GRACE_PERIOD: "The subscription is in its grace period. Arrange renewal with platform support before the deadline.",
  PAST_DUE: "The platform has marked this subscription past due. Contact support to review renewal and deadlines.",
  EXPIRED_PENDING_UPDATE: "The expiry date passed but the recorded subscription status has not changed yet. Contact support if this persists.",
  EXPIRES_SOON: "Your subscription expires soon. Contact platform support to discuss renewal before the deadline.",
  EXPIRING: "Review the upcoming expiry date and contact support early if renewal is needed.",
  NO_EXPIRY: "No expiry date is set for this subscription. Ask platform support to confirm the agreed terms.",
  ON_TRACK: "No immediate subscription expiry action is indicated by the current platform record."
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function PilotSubscriptionHealthPanel({
  accessToken, locale, compact = false
}: { accessToken: string; locale: AdminLocale; compact?: boolean }) {
  const [health, setHealth] = useState<SubscriptionHealth | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const t = (value: string) => adminText(locale, value);

  useEffect(() => {
    const controller = new AbortController();
    setHealth(null);
    setError("");
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/v1/admin/pilot/subscription/health`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
          cache: "no-store"
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message ?? "Subscription status could not be loaded.");
        }
        const data = (await response.json()) as { health: SubscriptionHealth };
        if (!controller.signal.aborted) setHealth(data.health);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(adminErrorText(locale, cause, "Subscription status could not be loaded."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accessToken, locale, refresh]);

  if (loading) {
    return <div className="admin-panel pilot-billing-pulse" role="status">{t("Checking subscription health…")}</div>;
  }

  if (error || !health) {
    return (
      <div className="admin-panel pilot-billing-error" role="alert">
        <span>{error || t("Subscription status could not be loaded.")}</span>
        <button type="button" className="admin-secondary" onClick={() => setRefresh((count) => count + 1)}>
          {t("Retry")}
        </button>
      </div>
    );
  }

  const badge = health.level === "critical" ? "pilot-badge-danger" :
    health.level === "warning" ? "pilot-badge-warning" :
      health.level === "healthy" ? "pilot-badge-ok" : "pilot-badge-warning";
  const expiring = health.daysUntilExpiry !== null && health.daysUntilExpiry >= 0;
  const expiryPassed = health.daysUntilExpiry !== null && health.daysUntilExpiry < 0;
  const graceRemaining = health.daysUntilGraceEnd !== null && health.daysUntilGraceEnd >= 0;

  if (compact) {
    return (
      <aside className={"admin-panel pilot-billing-summary pilot-billing-" + health.level}
        aria-label={t("Subscription health")}>
        <div>
          <span className="eyebrow">{t("Subscription health")}</span>
          <h3>{t(codeLabels[health.code])}</h3>
          <p>{t(codeGuidance[health.code])}</p>
        </div>
        <div className="pilot-billing-summary-action">
          <span className={"pilot-badge " + badge}>{t(health.level === "healthy" ? "Healthy" :
            health.level === "critical" ? "Critical" : health.level === "warning" ? "Warning" : "Notice")}</span>
          <Link className="pilot-inline-link" href="/admin/pilot/subscription">{t("View subscription")}</Link>
        </div>
      </aside>
    );
  }

  return (
    <section className="pilot-billing-details" aria-labelledby="pilot-billing-health-title">
      <div className={"admin-panel pilot-billing-banner pilot-billing-" + health.level}>
        <div>
          <span className="eyebrow">{t("Subscription health")}</span>
          <h3 id="pilot-billing-health-title">{t(codeLabels[health.code])}</h3>
          <p>{t(codeGuidance[health.code])}</p>
        </div>
        <span className={"pilot-badge " + badge}>
          {t(health.level === "healthy" ? "Healthy" :
            health.level === "critical" ? "Critical" : health.level === "warning" ? "Warning" : "Notice")}
        </span>
      </div>

      <div className="pilot-billing-metrics">
        <div className="admin-panel">
          <span>{t("Operational access")}</span>
          <strong>{t(health.operationalWritesBlocked ? "Changes blocked" : "Changes currently permitted")}</strong>
          <p>{t("Only the platform can change subscription status. The displayed access state is based on the recorded status.")}</p>
        </div>
        <div className="admin-panel">
          <span>{t("Expiry countdown")}</span>
          <strong>{health.daysUntilExpiry === null ? "—" :
            expiring ? adminFormat(locale, "{count} days remaining", { count: health.daysUntilExpiry! }) :
              adminFormat(locale, "{count} days past expiry", { count: Math.abs(health.daysUntilExpiry!) })}</strong>
          <p>{health.expiryDate ? formatAdminHijriDate(locale, health.expiryDate) : t("No expiry date set")}</p>
        </div>
        <div className="admin-panel">
          <span>{t("Grace period")}</span>
          <strong>{health.graceEndDate ?
            graceRemaining ? adminFormat(locale, "{count} days remaining", { count: health.daysUntilGraceEnd! }) :
              adminFormat(locale, "{count} days past deadline", { count: Math.abs(health.daysUntilGraceEnd!) }) :
                t("Not specified")}</strong>
          <p>{health.graceEndDate ? formatAdminHijriDate(locale, health.graceEndDate) : t("No grace date provided")}</p>
        </div>
      </div>

      <div className="admin-panel pilot-billing-reminders">
        <h3>{t("Expiry notifications")}</h3>
        <p>{t("The platform scheduler creates one notification at 30, 14, 7 and 1 day before expiry. Notifications depend on the scheduler running; this page cannot guarantee delivery.")}</p>
        {health.nextReminderDays !== null ? (
          <p className="pilot-billing-reminder-tag">
            {adminFormat(locale, "Next scheduled threshold: {count} days before expiry", { count: health.nextReminderDays })}
          </p>
        ) : (
          <p className="pilot-security-note">{t("No remaining pre-expiry reminder threshold is shown for the current record.")}</p>
        )}
        {health.platformReviewNeeded ? (
          <div className="pilot-billing-review" role="status">
            {t("The recorded dates and lifecycle status may be out of sync. A platform administrator should review this school.")}
          </div>
        ) : null}
      </div>

      <div className="admin-panel pilot-billing-support">
        <h3>{t("Renewal and support")}</h3>
        <p>{t("School administrators can review the plan and deadlines here, but cannot update pricing, make a payment, renew, or reactivate a subscription.")}</p>
        <p>{t("Use your existing platform support channel to discuss renewal or access issues. No support request or payment is submitted from this page.")}</p>
        <button className="admin-secondary" type="button" onClick={() => setRefresh((count) => count + 1)}>
          {t("Refresh status")}
        </button>
        <p className="pilot-security-note">
          {t("Subscription dates are calculated using the Afghanistan local calendar date; dates are displayed in Solar Hijri.")}
        </p>
      </div>
    </section>
  );
}
