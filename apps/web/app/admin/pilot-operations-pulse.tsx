"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFormat, adminText, type AdminLocale } from "./admin-i18n";

type Adoption = {
  roles: Array<{ role: string; eligible: number; signedIn: number }>;
};
type Service = {
  report: {
    notificationQueue: { stalePending: number; failed: number };
    support: { unresolvedCritical: number };
    imports: { failedLast7Days: number };
  };
};
type Release = {
  productionDecision: "NO_GO"; missingExternalGates: string[];
  effectivePilotApproval: boolean;
};
type Snapshot = {
  adoption: Adoption | null; service: Service | null; release: Release | null;
  failed: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
async function read<T>(token: string, path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(API_URL + path, {
    headers: { Authorization: `Bearer ${token}` },
    signal, cache: "no-store"
  });
  if (!response.ok) throw new Error("Unavailable");
  return response.json() as Promise<T>;
}

/** Independent snapshots: a failure does not turn missing data into healthy zeros. */
export function PilotOperationsPulse({ accessToken, locale }: {
  accessToken: string; locale: AdminLocale;
}) {
  const t = (label: string) => adminText(locale, label);
  const number = (n: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : locale).format(n);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(null); setLoading(true);
    void Promise.allSettled([
      read<Adoption>(accessToken, "/v1/admin/pilot/adoption?window=7d", controller.signal),
      read<Service>(accessToken, "/v1/admin/pilot/service-health", controller.signal),
      read<Release>(accessToken, "/v1/admin/pilot/release-readiness", controller.signal)
    ]).then(([adoption, service, release]) => {
      if (controller.signal.aborted) return;
      const results = [adoption, service, release];
      setSnapshot({
        adoption: adoption.status === "fulfilled" ? adoption.value : null,
        service: service.status === "fulfilled" ? service.value : null,
        release: release.status === "fulfilled" ? release.value : null,
        failed: results.filter((result) => result.status === "rejected").length
      });
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [accessToken, revision]);

  const roles = snapshot?.adoption?.roles ?? [];
  const eligible = roles.reduce((sum, role) => sum + role.eligible, 0);
  const signedIn = roles.reduce((sum, role) => sum + role.signedIn, 0);
  const health = snapshot?.service?.report;
  const alerts = health ? health.notificationQueue.stalePending +
    health.notificationQueue.failed + health.support.unresolvedCritical +
    health.imports.failedLast7Days : null;

  return (
    <section className="pilot-pulse" aria-labelledby="pilot-pulse-title">
      <div className="admin-section-header">
        <div>
          <span className="eyebrow">{t("School operations snapshot")}</span>
          <h3 id="pilot-pulse-title">{t("At a glance")}</h3>
          <p>{t("Three independent, read-only summaries from your school's current records.")}</p>
        </div>
        <button className="admin-secondary" type="button"
          onClick={() => setRevision((value) => value + 1)} disabled={loading}>
          {t("Refresh summaries")}
        </button>
      </div>
      {loading ? <p className="pilot-security-note" role="status">{t("Loading pilot summaries…")}</p> : null}
      {!loading && snapshot?.failed ? (
        <p role="status" className="pilot-security-note">
          {adminFormat(locale, "{count} summaries are unavailable. Values are not assumed to be zero.", {
            count: snapshot.failed
          })}
        </p>
      ) : null}
      <div className="pilot-pulse-grid">
        <Link href="/admin/pilot/adoption" className="pilot-pulse-card">
          <span>{t("Recorded sign-ins in 7 days")}</span>
          <strong>{loading || !snapshot?.adoption ? "—" :
            eligible > 0 ? number(signedIn) + " / " + number(eligible) : "—"}</strong>
          <small>{t("Latest-login approximation, not daily active use.")}</small>
          <span className="pilot-pulse-card-action">{t("Usage & adoption")} ↗</span>
        </Link>
        <Link href="/admin/pilot/service" className="pilot-pulse-card">
          <span>{t("Recorded operational alerts")}</span>
          <strong>{loading || alerts === null ? "—" : number(alerts)}</strong>
          <small>{t("Failed notifications, stale queue, critical tickets and failed imports. No alerts does not prove uptime.")}</small>
          <span className="pilot-pulse-card-action">{t("Service health")} ↗</span>
        </Link>
        <Link href="/admin/pilot/oversight" className="pilot-pulse-card">
          <span>{t("Independent production gate")}</span>
          <strong>{!loading && snapshot?.release?.productionDecision === "NO_GO" ?
            t("PRODUCTION NO-GO") : t("Not verified")}</strong>
          <small>{snapshot?.release
            ? adminFormat(locale, "{count} external gates still require independent verification.", {
              count: snapshot.release.missingExternalGates.length
            })
            : t("Release evidence cannot be inferred from missing data.")}</small>
          <span className="pilot-pulse-card-action">{t("Operations oversight")} ↗</span>
        </Link>
      </div>
    </section>
  );
}
