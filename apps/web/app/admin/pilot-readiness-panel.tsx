"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useState } from "react";
import { useAdminWorkspace } from "./admin-workspace";
import { adminText } from "./admin-i18n";

type Subscription = {
  planCode: string;
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE" | "SUSPENDED" | "CANCELLED";
  billingCycle: "MONTHLY" | "ANNUAL";
  priceAfn: number;
  setupFeeAfn: number;
  startsOn: string | null;
  expiresOn: string | null;
  graceEndsOn: string | null;
};

type Readiness = {
  ready: boolean;
  counts: {
    admins: number;
    teachers: number;
    parents: number;
    students: number;
    activeAcademicYears: number;
    classes: number;
    subjects: number;
    teacherAssignments: number;
  };
  checks: Array<{ key: string; passed: boolean; detail: string }>;
};

type AuditLog = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
}

async function downloadAuthenticated(accessToken: string, path: string, fallbackName: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const text = await response.text();
    let message = "Download failed.";
    try {
      message = JSON.parse(text)?.message ?? message;
    } catch {
      // Keep the generic download error.
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = match?.[1] ?? fallbackName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function PilotReadinessPanel({ accessToken }: { accessToken: string }) {
  const { locale } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const { error, notice, setError, setNotice } = useTransientAdminFeedback();

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function load(offset = auditOffset) {
    setBusy(true);
    setError("");
    try {
      const [subscriptionResult, readinessResult, auditResult] = await Promise.all([
        request<{ subscription: Subscription }>(accessToken, "/v1/admin/subscription"),
        request<Readiness>(accessToken, "/v1/admin/pilot/readiness"),
        request<{ logs: AuditLog[]; hasMore: boolean }>(
          accessToken,
          `/v1/admin/audit?limit=20&offset=${offset}`
        )
      ]);
      setSubscription(subscriptionResult.subscription);
      setReadiness(readinessResult);
      setAudit(auditResult.logs);
      setAuditOffset(offset);
      setAuditHasMore(auditResult.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load pilot readiness.");
    } finally {
      setBusy(false);
    }
  }

  async function download(path: string, name: string, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await downloadAuthenticated(accessToken, path, name);
      setNotice(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  const writeBlocked =
    subscription?.status === "SUSPENDED" || subscription?.status === "CANCELLED";

  return (
    <section className="pilot-section" aria-labelledby="pilot-readiness-title">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Phase 8 · Pilot Readiness")}</span>
          <h2 id="pilot-readiness-title">{t("Pilot operations")}</h2>
          <p>
            Review onboarding checks, subscription access, audit history, safe school export, and import templates.
          </p>
        </div>
        <button className="admin-secondary" type="button" onClick={() => void load()} disabled={busy}>{t("Refresh")}</button>
      </div>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      {subscription ? (
        <article className="admin-panel pilot-subscription">
          <div>
            <span className="eyebrow">{t("School subscription")}</span>
            <h3>{subscription.planCode}</h3>
            <p>
              <strong>{subscription.status}</strong> · {subscription.billingCycle} · {subscription.priceAfn.toLocaleString()} AFN
            </p>
            <p>
              {subscription.expiresOn ? `Expires ${subscription.expiresOn}` : "No expiry date set"}
              {subscription.graceEndsOn ? ` · Grace ends ${subscription.graceEndsOn}` : ""}
            </p>
          </div>
          <span className={writeBlocked ? "pilot-badge pilot-badge-danger" : "pilot-badge pilot-badge-ok"}>
            {writeBlocked ? "Operational writes disabled" : "Operational access enabled"}
          </span>
        </article>
      ) : null}

      {readiness ? (
        <>
          <div className="academic-summary-grid pilot-summary-grid" aria-label="Pilot data summary">
            <Summary label={t("Students")} value={readiness.counts.students} />
            <Summary label={t("Parents")} value={readiness.counts.parents} />
            <Summary label={t("Teachers")} value={readiness.counts.teachers} />
            <Summary label={t("Classes")} value={readiness.counts.classes} />
            <Summary label={t("Subjects")} value={readiness.counts.subjects} />
            <Summary label={t("Assignments")} value={readiness.counts.teacherAssignments} />
          </div>

          <article className="admin-panel">
            <div className="admin-section-header">
              <div>
                <h3>{t("Onboarding checklist")}</h3>
                <p>{readiness.ready ? "Core pilot setup is ready." : "Complete the remaining checks before pilot launch."}</p>
              </div>
              <span className={readiness.ready ? "pilot-badge pilot-badge-ok" : "pilot-badge pilot-badge-warning"}>
                {readiness.ready ? "Ready" : "Needs setup"}
              </span>
            </div>
            <div className="pilot-check-list">
              {readiness.checks.map((check) => (
                <div className="pilot-check" key={check.key}>
                  <span aria-hidden="true">{check.passed ? "✓" : "!"}</span>
                  <div>
                    <strong>{check.key.replaceAll("-", " ")}</strong>
                    <p>{check.detail}</p>
                  </div>
                  <span className="sr-only">{check.passed ? "Passed" : "Not passed"}</span>
                </div>
              ))}
            </div>
          </article>
        </>
      ) : null}

      <div className="admin-grid">
        <article className="admin-panel">
          <h3>{t("School data export")}</h3>
          <p className="admin-copy">
            Download a school-scoped JSON export. Password hashes and authentication sessions are excluded.
          </p>
          <button
            className="admin-primary"
            type="button"
            disabled={busy}
            onClick={() => void download("/v1/admin/pilot/export", "maktablink-school-export.json", "School export downloaded.")}
          >{t("Download core export")}</button>
        </article>

        <article className="admin-panel">
          <h3>{t("Import templates")}</h3>
          <p className="admin-copy">{t("Use the exact pilot CSV headers before upload and validation.")}</p>
          <div className="admin-actions pilot-template-actions">
            {(["PARENT", "STUDENT", "TEACHER"] as const).map((entity) => (
              <button
                key={entity}
                className="admin-secondary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void download(
                    `/v1/admin/pilot/import-template/${entity}`,
                    `maktablink-${entity.toLowerCase()}-import.csv`,
                    `${entity.toLowerCase()} template downloaded.`
                  )
                }
              >
                {entity.toLowerCase()} CSV
              </button>
            ))}
          </div>
        </article>
      </div>

      <article className="admin-panel">
        <div className="admin-section-header">
          <div>
            <h3>{t("Audit review")}</h3>
            <p>{t("Sensitive changes are recorded here for school review.")}</p>
          </div>
          <div className="admin-actions">
            <button
              type="button"
              className="admin-secondary"
              disabled={busy || auditOffset === 0}
              onClick={() => void load(Math.max(0, auditOffset - 20))}
            >{t("Newer")}</button>
            <button
              type="button"
              className="admin-secondary"
              disabled={busy || !auditHasMore}
              onClick={() => void load(auditOffset + 20)}
            >{t("Older")}</button>
          </div>
        </div>

        <div className="pilot-audit-list">
          {audit.map((item) => (
            <div className="pilot-audit-row" key={item.id}>
              <div>
                <strong>{item.action}</strong>
                <span>{item.entityType}{item.entityId ? ` · ${item.entityId}` : ""}</span>
              </div>
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
            </div>
          ))}
          {audit.length === 0 ? <p className="admin-copy">{t("No audit events on this page.")}</p> : null}
        </div>
      </article>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="academic-summary">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
