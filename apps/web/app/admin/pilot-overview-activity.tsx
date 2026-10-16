"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminErrorText, adminText, type AdminLocale } from "./admin-i18n";
import { formatPilotTimestamp } from "./pilot-timestamp";

type Activity = {
  id: string;
  action: string;
  actorUsername: string | null;
  createdAt: string;
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Read-only, allowlisted school audit preview. Failure never blocks the overview. */
export function PilotOverviewActivity({ accessToken, locale }: {
  accessToken: string;
  locale: AdminLocale;
}) {
  const t = (label: string) => adminText(locale, label);
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setError("");
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/v1/admin/pilot/audit?limit=6&offset=0`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.message ?? "Could not load recent activity.");
        if (!controller.signal.aborted) {
          setItems(Array.isArray(body?.logs) ? body.logs : []);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(adminErrorText(locale, cause, "Could not load recent activity."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accessToken, locale, revision]);

  return (
    <section className="admin-panel pilot-recent-activity" aria-labelledby="pilot-recent-title">
      <div className="admin-section-header">
        <div>
          <h3 id="pilot-recent-title">{t("Recent school activity")}</h3>
          <p>{t("Latest recorded administrative events for this school.")}</p>
        </div>
        <Link className="pilot-inline-link" href="/admin/pilot/audit">{t("View audit history")}</Link>
      </div>
      {loading ? <p role="status">{t("Loading recent activity…")}</p> : null}
      {error ? (
        <div className="pilot-activity-error" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-secondary" onClick={() => setRevision((value) => value + 1)}>
            {t("Retry")}
          </button>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? <p>{t("No recorded activity yet.")}</p> : null}
      {!loading && !error && items.length > 0 ? (
        <ol className="pilot-activity-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{t(item.action.replace(/[._]/g, " "))}</strong>
                <span>{t("Performed by")}: {item.actorUsername ?? t("System")}</span>
              </div>
              <time dateTime={item.createdAt}>{formatPilotTimestamp(locale, item.createdAt)}</time>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="pilot-security-note">{t("Activity shows allowed audit metadata only; no passwords or private record changes.")}</p>
    </section>
  );
}
