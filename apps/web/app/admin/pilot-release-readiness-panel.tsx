"use client";

import { useEffect, useState } from "react";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";

type ReleaseCheck = { id: string; name: string; status: "UNVERIFIED" | "NO_GO" };
type ReleaseResult = {
  productionDecision: "NO_GO";
  policy: string;
  setupReady: boolean;
  recordedPilotApproval: boolean;
  effectivePilotApproval: boolean;
  evidenceVerified: number;
  evidenceRequired: number;
  openCriticalTickets: number;
  checks: ReleaseCheck[];
  missingExternalGates: string[];
  summary: string;
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function PilotReleaseReadinessPanel({
  accessToken, locale
}: { accessToken: string; locale: AdminLocale }) {
  const t = (text: string) => adminText(locale, text);
  const [result, setResult] = useState<ReleaseResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError(""); setLoading(true);
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/v1/admin/pilot/release-readiness`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal, cache: "no-store"
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message ?? "Release readiness could not be loaded.");
        if (!controller.signal.aborted) setResult(data as ReleaseResult);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(adminErrorText(locale, cause, "Release readiness could not be loaded."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accessToken, locale, refresh]);

  return (
    <section className="admin-panel pilot-phase7" aria-labelledby="pilot-phase7-title">
      <div className="admin-section-header">
        <div>
          <span className="eyebrow">{t("Step 20 · Release acceptance")}</span>
          <h3 id="pilot-phase7-title">{t("Production release readiness")}</h3>
          <p>{t("Pilot onboarding and operator pilot approval do not establish permission to launch production.")}</p>
        </div>
        <span className="pilot-badge pilot-badge-danger">{t("PRODUCTION NO-GO")}</span>
      </div>
      {loading ? <p role="status">{t("Loading independent release checks…")}</p> : null}
      {error ? (
        <div className="admin-error" role="alert">
          {error}
          <button type="button" className="admin-secondary"
            onClick={() => setRefresh((value) => value + 1)}>{t("Retry")}</button>
        </div>
      ) : null}
      {result ? (
        <>
          <div className="pilot-phase7-gates">
            <div>
              <strong>{t("Automated school configuration")}</strong>
              <span className={"pilot-badge "+(result.setupReady?"pilot-badge-ok":"pilot-badge-warning")}>
                {t(result.setupReady?"Configured":"Not verified")}
              </span>
            </div>
            <div>
              <strong>{t("Current platform pilot approval")}</strong>
              <span className={"pilot-badge "+(result.effectivePilotApproval?"pilot-badge-ok":"pilot-badge-warning")}>
                {t(result.effectivePilotApproval?"Approved for pilot":"Not approved")}
              </span>
            </div>
            <div>
              <strong>{t("Independent live deployment acceptance")}</strong>
              <span className="pilot-badge pilot-badge-danger">{t("Not verified")}</span>
            </div>
          </div>
          <p className="pilot-security-note" role="status">
            {t("Production remains NO-GO until actual devices, deployed database, restore drill, live push and scheduler, CI at the exact deployment SHA and operator sign-off are independently verified.")}
          </p>
          <p>{adminFormat(locale, "{count} external release gates remain unverified", {
            count: result.missingExternalGates.length
          })}</p>
          <details className="pilot-phase7-checks">
            <summary>{t("View all 20 release acceptance steps")}</summary>
            <div role="list" className="pilot-phase7-list">
              {result.checks.map((check) => (
                <div role="listitem" className="pilot-phase7-row" key={check.id}>
                  <span><strong>{check.id}</strong> <span>{t(check.name)}</span></span>
                  <span className={"pilot-badge "+(check.status==="NO_GO"?"pilot-badge-danger":"pilot-badge-warning")}>
                    {t(check.status==="NO_GO"?"NO-GO":"Manual verification required")}
                  </span>
                </div>
              ))}
            </div>
          </details>
          <p className="pilot-security-note">{t("Release checks are not automatically marked complete. Operators must follow the Step 20 acceptance runbook and retain dated evidence outside the application.")}</p>
          <button type="button" className="admin-secondary"
            onClick={() => setRefresh((value) => value + 1)}>{t("Refresh release readiness")}</button>
        </>
      ) : null}
    </section>
  );
}
