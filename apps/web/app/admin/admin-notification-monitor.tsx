"use client";
import { useEffect, useRef, useState } from "react";
import { adminApi } from "./admin-client";
import { adminErrorText, adminText, type AdminLocale } from "./admin-i18n";
import { formatAdminHijriDateTime } from "./admin-hijri-date-picker";

type DeliveryStatus = "PENDING" | "SENT" | "FAILED" | "CANCELLED";
type DeliveryOverview = {
  counts: { queued: number; providerAccepted: number; failed: number; cancelled: number; read: number; unread: number };
  scheduler: { lastAttemptAt: string | null; lastSuccessAt: string | null; lastError: string | null };
  schoolTimezone: string;
  recent: Array<{ id: string; title: string; type: string; createdAt: string; readAt: string | null;
    deliveryStatus: DeliveryStatus; providerAcceptedDevices: number; failedDevices: number; lastAttemptAt: string | null }>;
};

export function AdminNotificationMonitor({ accessToken, locale }: { accessToken: string; locale: AdminLocale }) {
  const t = (label: string) => adminText(locale, label);
  const [data, setData] = useState<DeliveryOverview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [retryId, setRetryId] = useState<string | null>(null);
  const generation = useRef(0);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  useEffect(() => {
    const current = ++generation.current;
    const token = accessToken;
    setData(null); setStatus("loading"); setError("");
    void adminApi<DeliveryOverview>("/v1/admin/notifications/delivery", {
      headers: { Authorization: `Bearer ${token}` }
    }).then(result => {
      if (current !== generation.current || tokenRef.current !== token) return;
      setData(result); setStatus("ready");
    }).catch(cause => {
      if (current !== generation.current || tokenRef.current !== token) return;
      setError(adminErrorText(locale, cause, "Could not load delivery status.")); setStatus("error");
    });
    return () => { generation.current += 1; };
  }, [accessToken, locale, refresh]);

  const formatDate = (value: string | null) =>
    value && data ? formatAdminHijriDateTime(locale, value, data.schoolTimezone) : "—";
  const stale = data?.scheduler.lastSuccessAt
    ? Date.now() - new Date(data.scheduler.lastSuccessAt).getTime() > 36 * 3_600_000
    : false;

  async function retry(id: string) {
    if (!window.confirm(t("Retry this failed notification in the scheduler queue? Previously accepted device messages will not be resent."))) return;
    const token = accessToken;
    setRetryId(id); setFeedback(""); setError("");
    try {
      await adminApi<{ queued: boolean }>(`/v1/admin/notifications/${encodeURIComponent(id)}/retry`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      if (tokenRef.current !== token) return;
      setFeedback(t("Notification requeued for the next scheduled run."));
      setRefresh(value => value + 1);
    } catch (cause) {
      if (tokenRef.current !== token) return;
      setError(adminErrorText(locale, cause, "Could not retry notification."));
    } finally {
      if (tokenRef.current === token) setRetryId(null);
    }
  }

  return (
    <details className="admin-panel admin-delivery-monitor">
      <summary>{t("Notification delivery monitor")}</summary>
      <div className="admin-delivery-content">
        <div><button type="button" className="admin-secondary" onClick={() => setRefresh(value => value + 1)}>
          {t("Refresh delivery status")}
        </button></div>
        {status === "loading" ? <p role="status">{t("Loading…")}</p> : null}
        {error ? <p className="admin-error" role="alert">{error}</p> : null}
        {feedback ? <p className="admin-success" role="status">{feedback}</p> : null}
        {status === "ready" && data ? (
          <>
            <div className="admin-delivery-metrics">
              {([
                ["Queued in-app", data.counts.queued],
                ["Provider accepted", data.counts.providerAccepted],
                ["Failed push", data.counts.failed],
                ["Recipient read", data.counts.read],
                ["Recipient unread", data.counts.unread]
              ] as const).map(([label,value]) => (
                <div key={label}><span>{t(label)}</span><strong>{value.toLocaleString(locale)}</strong></div>
              ))}
            </div>
            <small>{t("Provider accepted does not prove device delivery or recipient reading.")}</small>
            <div>
              <h4>{t("Scheduler materialization")}</h4>
              <p>{t("Last successful materialization")}: {formatDate(data.scheduler.lastSuccessAt)}</p>
              <p>{t("Last scheduler attempt")}: {formatDate(data.scheduler.lastAttemptAt)}</p>
              {!data.scheduler.lastAttemptAt ? (
                <p role="status">{t("No recorded run — verify deployment cron.")}</p>
              ) : null}
              {data.scheduler.lastError ? (
                <p className="admin-error" role="alert">{t("Materialization failed on the last attempt.")}</p>
              ) : null}
              {stale ? <p role="status">{t("Scheduler status is older than 36 hours; verify deployment cron.")}</p> : null}
            </div>
            {data.recent.length === 0 ? <p>{t("No notifications in the latest records.")}</p> : (
              <ul className="admin-delivery-list" aria-label={t("Notification delivery")}>
                {data.recent.map(row => (
                  <li key={row.id}>
                    <div><strong>{row.title}</strong><small>{t("Notification type")}: {row.type}</small>
                      <small>{formatDate(row.createdAt)}</small>
                      <small>{t("Push queue state")}: {t(row.deliveryStatus === "PENDING" ? "Queued in-app" : row.deliveryStatus === "SENT" ? "Provider accepted" : row.deliveryStatus === "FAILED" ? "Failed push" : "Cancelled")}</small>
                      <small>{t("Provider accepted devices")}: {row.providerAcceptedDevices} · {t("Failed devices")}: {row.failedDevices}</small>
                    </div>
                    {row.deliveryStatus === "FAILED" ? (
                      <button type="button" className="admin-secondary" disabled={retryId !== null}
                        onClick={() => void retry(row.id)}>{t("Retry failed notification")}</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
