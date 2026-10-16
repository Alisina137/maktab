"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import {
  parsePulseAdoption, parsePulseService, parsePulseRelease,
  pulseSignInCoverage, pulseAlertCount, pilotPulseActions,
  type PilotPulseAdoption, type PilotPulseService, type PilotPulseRelease,
  type PilotPulseSnapshot, type PilotPulseAction
} from "./pilot-operations-pulse-model";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
async function read<T>(token: string, path: string, signal: AbortSignal,
  validate: (body: unknown) => T): Promise<T> {
  const response = await fetch(API_URL + path, {
    headers: { Authorization: `Bearer ${token}` },
    signal, cache: "no-store"
  });
  if (!response.ok) throw new Error("Unavailable");
  return validate(await response.json() as unknown);
}

/** Independent snapshots: a failure does not turn missing data into healthy zeros. */
export function PilotOperationsPulse({ accessToken, locale }: {
  accessToken: string; locale: AdminLocale;
}) {
  const t = (label: string) => adminText(locale, label);
  const number = (n: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : locale).format(n);
  const [snapshot, setSnapshot] = useState<PilotPulseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(null); setLoading(true);
    void Promise.allSettled([
      read<PilotPulseAdoption>(accessToken, "/v1/admin/pilot/adoption?window=7d",
        controller.signal, parsePulseAdoption),
      read<PilotPulseService>(accessToken, "/v1/admin/pilot/service-health",
        controller.signal, parsePulseService),
      read<PilotPulseRelease>(accessToken, "/v1/admin/pilot/release-readiness",
        controller.signal, parsePulseRelease)
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

  const coverage = pulseSignInCoverage(snapshot?.adoption ?? null);
  const alerts = pulseAlertCount(snapshot?.service ?? null);
  const actions = pilotPulseActions(snapshot);
  const labels: Record<PilotPulseAction["kind"], { title: string; detail: string }> = {
    SERVICE_ALERTS: { title: "Review recorded service alerts",
      detail: "{count} recorded warning observations need review. Categories may overlap." },
    SERVICE_UNAVAILABLE: { title: "Service health is unverified",
      detail: "The service report is unavailable. Missing evidence is not a healthy result." },
    SIGN_IN_GAP: { title: "Review sign-in coverage",
      detail: "{signedIn} of {eligible} eligible accounts have a latest login within 7 days." },
    ADOPTION_NO_COHORT: { title: "Prepare eligible accounts",
      detail: "No eligible accounts were found for usage coverage. Review data onboarding." },
    ADOPTION_UNAVAILABLE: { title: "Usage data is unverified",
      detail: "Recent sign-in coverage is unavailable. Unknown is not zero usage." },
    MANUAL_RELEASE: { title: "Independent release checks are required",
      detail: "Production remains NO-GO until independent release evidence is verified." },
    RELEASE_UNAVAILABLE: { title: "Release evidence is unverified",
      detail: "Release status could not be verified. Never assume production approval." }
  };

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
            coverage ? number(coverage.signedIn) + " / " + number(coverage.eligible) : "—"}</strong>
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
      {!loading && snapshot ? (
        <section className="pilot-action-center" aria-labelledby="pilot-action-center-title">
          <div className="pilot-action-center-heading">
            <div><h3 id="pilot-action-center-title">{t("Recommended next checks")}</h3>
              <p>{t("Read-only follow-ups based on school data, not production approval.")}</p></div>
          </div>
          <ul className="pilot-action-list">
            {actions.map((action) => (
              <li key={action.kind} className={`pilot-action pilot-action-${action.severity}`}>
                <div><strong>{t(labels[action.kind].title)}</strong>
                  <p>{adminFormat(locale, labels[action.kind].detail, {
                    count: action.count ?? 0, signedIn: action.signedIn ?? 0, eligible: action.eligible ?? 0
                  })}</p></div>
                <Link href={action.href} className="pilot-action-link">
                  {t("Open section")} <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
