"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminLoader, AdminSkeleton } from "./admin-loader";
import { formatAdminHijriDate, formatAdminHijriDateTime } from "./admin-hijri-date-picker";
import { useAdminWorkspace } from "./admin-workspace";
import { adminErrorText, adminFormat, adminText } from "./admin-i18n";

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

export const PILOT_TABS = [
  { section: "overview", label: "Overview", href: "/admin/pilot" },
  { section: "readiness", label: "School readiness", href: "/admin/pilot/readiness" },
  { section: "onboarding", label: "Data onboarding", href: "/admin/pilot/onboarding" },
  { section: "subscription", label: "Subscription", href: "/admin/pilot/subscription" },
  { section: "audit", label: "Audit & exports", href: "/admin/pilot/audit" },
  { section: "launch", label: "Launch & support", href: "/admin/pilot/launch" },
] as const;

export type PilotSection = (typeof PILOT_TABS)[number]["section"];

export function isPilotSection(value: string): value is PilotSection {
  return PILOT_TABS.some((item) => item.section === value);
}

const CHECK_DESTINATIONS: Record<string, string> = {
  "school-active": "/admin/pilot/subscription",
  subscription: "/admin/pilot/subscription",
  admin: "/admin/accounts",
  "academic-year": "/admin/academics/years",
  classes: "/admin/academics/classes",
  subjects: "/admin/academics/subjects",
  teachers: "/admin/academics/teachers",
  assignments: "/admin/academics/assignments",
  families: "/admin/families"
};

export function PilotReadinessPanel({ accessToken, section = "overview" }: { accessToken: string; section?: PilotSection }) {
  const { locale } = useAdminWorkspace();
  const pilotNavRef = useRef<HTMLElement | null>(null);
  const requestVersion = useRef(0);
  const t = (english: string) => adminText(locale, english);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const { error, notice, setError, setNotice } = useTransientAdminFeedback();

  useEffect(() => {
    const active = pilotNavRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [section, busy]);

  useEffect(() => {
    setSubscription(null);
    setReadiness(null);
    setAudit([]);
    setAuditOffset(0);
    setAuditHasMore(false);
    void load(0);
    return () => { requestVersion.current += 1; };
  }, [accessToken, section]);

  async function load(offset = auditOffset) {
    const version = ++requestVersion.current;
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
      if (version !== requestVersion.current) return;
      setSubscription(subscriptionResult.subscription);
      setReadiness(readinessResult);
      setAudit(auditResult.logs);
      setAuditOffset(offset);
      setAuditHasMore(auditResult.hasMore);
    } catch (cause) {
      if (version === requestVersion.current) setError(adminErrorText(locale, cause, "Could not load pilot readiness."));
    } finally {
      if (version === requestVersion.current) setBusy(false);
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
      setError(adminErrorText(locale, cause, "Download failed."));
    } finally {
      setBusy(false);
    }
  }

  if ((!subscription || !readiness) && !error) {
    return (
      <section className="admin-panel pilot-section admin-loading-card">
        <AdminLoader label={t("Loading…")} />
        <AdminSkeleton rows={5} />
      </section>
    );
  }

  if (!subscription || !readiness) {
    return (
      <section className="admin-panel pilot-section admin-loading-card">
        <div className="admin-error" role="alert">{error}</div>
        <button className="admin-secondary" type="button" onClick={() => void load()}>
          {t("Retry")}
        </button>
      </section>
    );
  }

  const writeBlocked =
    subscription?.status === "SUSPENDED" || subscription?.status === "CANCELLED";
  const passedChecks = readiness.checks.filter((check) => check.passed).length;
  const totalChecks = readiness.checks.length;
  const pendingChecks = readiness.checks.filter((check) => !check.passed);
  const progressPercent = totalChecks ? Math.round((passedChecks / totalChecks) * 100) : 0;
  const billingAttention = subscription.status === "PAST_DUE" || subscription.status === "GRACE";

  return (
    <section className="pilot-section admin-page-enter" aria-labelledby="pilot-readiness-title">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Phase 8 · Pilot Readiness")}</span>
          <h2 id="pilot-readiness-title">{t("Pilot operations")}</h2>
          <p>
            {t("Review onboarding checks, subscription access, audit history, safe school export, and import templates.")}
          </p>
        </div>
        <button className="admin-secondary" type="button" onClick={() => void load()} disabled={busy}>{t("Refresh")}</button>
      </div>


      <nav className="pilot-section-nav" aria-label={t("Pilot operations sections")} ref={pilotNavRef}>
        {PILOT_TABS.map((item) => (
          <Link key={item.section} href={item.href}
            aria-current={section === item.section ? "page" : undefined}
            className={section === item.section ? "pilot-section-link pilot-section-link-active" : "pilot-section-link"}>
            {t(item.label)}
          </Link>
        ))}
      </nav>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}


      {section === "overview" ? (
        <article className="admin-panel pilot-overview-hero">
          <div className="pilot-overview-copy">
            <span className="eyebrow">{t("Automated school setup")}</span>
            <h3>{t(readiness.ready ? "Core setup ready" : "Setup in progress")}</h3>
            <p>{t("These checks confirm basic school configuration, not approval for a live launch.")}</p>
            <div className="pilot-overview-pills">
              <span className="pilot-badge pilot-badge-ok">{adminFormat(locale, "{count} passed", { count: passedChecks })}</span>
              <span className="pilot-badge pilot-badge-warning">{adminFormat(locale, "{count} needing attention", { count: pendingChecks.length })}</span>
            </div>
            <Link className="admin-primary" href="/admin/pilot/readiness">{t("Review missing checks")}</Link>
          </div>
          <div className="pilot-overview-score" aria-label={t("Setup progress")}>
            <strong>{progressPercent}%</strong>
            <span>{t("Core setup checks")}</span>
            <progress className="pilot-onboarding-meter" value={passedChecks} max={Math.max(totalChecks, 1)} aria-label={t("Onboarding progress")} />
          </div>
        </article>
      ) : null}

      {subscription && (section === "overview" || section === "subscription") ? (
        <article className="admin-panel pilot-subscription">
          <div>
            <span className="eyebrow">{t("School subscription")}</span>
            <h3>{subscription.planCode}</h3>
            <p>
              <strong>{t(subscription.status)}</strong> · {t(subscription.billingCycle)} · {subscription.priceAfn.toLocaleString()} AFN
            </p>
            <p>
              {subscription.expiresOn
                ? adminFormat(locale, "Expires {date}", { date: formatAdminHijriDate(locale, subscription.expiresOn) })
                : t("No expiry date set")}
              {subscription.graceEndsOn
                ? ` · ${adminFormat(locale, "Grace ends {date}", { date: formatAdminHijriDate(locale, subscription.graceEndsOn) })}`
                : ""}
            </p>
          </div>
          <span className={writeBlocked ? "pilot-badge pilot-badge-danger" : billingAttention ? "pilot-badge pilot-badge-warning" : "pilot-badge pilot-badge-ok"}>
            {t(writeBlocked ? "Operational writes disabled" : billingAttention ? "Billing attention needed" : "Operational access enabled")}
          </span>
        </article>
      ) : null}

      {readiness && (section === "overview" || section === "readiness") ? (
        <>
          <div className="academic-summary-grid pilot-summary-grid" aria-label={t("Pilot data summary")}>
            <Summary label={t("Students")} value={readiness.counts.students} />
            <Summary label={t("Parents")} value={readiness.counts.parents} />
            <Summary label={t("Teachers")} value={readiness.counts.teachers} />
            <Summary label={t("Classes")} value={readiness.counts.classes} />
            <Summary label={t("Subjects")} value={readiness.counts.subjects} />
            <Summary label={t("Assignments")} value={readiness.counts.teacherAssignments} />
          </div>

          {section === "readiness" ? (
          <article className="admin-panel pilot-onboarding-card" aria-labelledby="pilot-onboarding-title">
            <div className="admin-section-header pilot-onboarding-header">
              <div>
                <span className="eyebrow">{t("Phase 8 · Pilot Readiness")}</span>
                <h3 id="pilot-onboarding-title">{t("Onboarding checklist")}</h3>
                <p>{t(readiness.ready ? "Core pilot setup is ready." : "Complete the remaining checks before pilot launch.")}</p>
              </div>
              <span className={readiness.ready ? "pilot-badge pilot-badge-ok" : "pilot-badge pilot-badge-warning"}>
                {t(readiness.ready ? "Core setup ready" : "Needs setup")}
              </span>
            </div>
            <div className="pilot-onboarding-progress">
              <div className="pilot-onboarding-progress-copy">
                <span>{t("Setup progress")}</span>
                <strong>{adminFormat(locale, "{done} of {total} checks complete", { done: passedChecks, total: totalChecks })}</strong>
              </div>
              <progress
                className="pilot-onboarding-meter"
                value={passedChecks}
                max={Math.max(totalChecks, 1)}
                aria-label={t("Onboarding progress")}
              />
            </div>
            <div className="pilot-check-list">
              {readiness.checks.map((check) => (
                <div className={`pilot-check ${check.passed ? "pilot-check-passed" : "pilot-check-pending"}`} key={check.key}>
                  <span className="pilot-check-icon" aria-hidden="true">{check.passed ? "✓" : "!"}</span>
                  <div className="pilot-check-copy">
                    <strong>{pilotCheckLabel(check.key, t)}</strong>
                    <p>{pilotCheckDetail(check.key, readiness, subscription, locale, t)}</p>
                    {!check.passed && CHECK_DESTINATIONS[check.key] ? (
                      <Link className="pilot-inline-link" href={CHECK_DESTINATIONS[check.key]}>{t("Open section")}</Link>
                    ) : null}
                  </div>
                  <span className="pilot-check-state">{t(check.passed ? "Passed" : "Not passed")}</span>
                </div>
              ))}
            </div>
          </article>
          ) : null}
        </>
      ) : null}


      {section === "overview" ? (
        <>
          <div className="pilot-overview-bottom">
            <article className="admin-panel">
              <h3>{t("Needs attention")}</h3>
              <p className="admin-copy">{t("Resolve incomplete core checks in their existing modules.")}</p>
              {pendingChecks.length ? (
                <div className="pilot-issue-list">
                  {pendingChecks.slice(0, 4).map((check) => (
                    <div className="pilot-issue-row" key={check.key}>
                      <span className="pilot-issue-dot" aria-hidden="true">!</span>
                      <strong>{pilotCheckLabel(check.key, t)}</strong>
                      <Link href={CHECK_DESTINATIONS[check.key] ?? "/admin/pilot/readiness"}>{t("Review")}</Link>
                    </div>
                  ))}
                </div>
              ) : <p className="admin-copy">{t("No missing core setup checks.")}</p>}
              {pendingChecks.length > 4 ? <Link className="pilot-inline-link" href="/admin/pilot/readiness">{t("View all checks")}</Link> : null}
            </article>
            <article className="admin-panel pilot-launch-note">
              <h3>{t("Launch approval")}</h3>
              <span className="pilot-badge pilot-badge-warning">{t("Not verified")}</span>
              <p>{t("Live deployment, device tests, backup recovery, and operator approval require separate verification.")}</p>
              <Link className="pilot-inline-link" href="/admin/pilot/launch">{t("View launch requirements")}</Link>
            </article>
          </div>
          <h3 className="pilot-section-heading">{t("Quick actions")}</h3>
          <div className="pilot-quick-grid">
            {([
              ["Manage accounts", "/admin/accounts", "◫"],
              ["Configure academics", "/admin/academics", "▤"],
              ["Import families", "/admin/families", "⇧"],
              ["Configure timetable", "/admin/academics/timetable", "▦"],
              ["Audit & exports", "/admin/pilot/audit", "≡"],
              ["Subscription", "/admin/pilot/subscription", "◇"]
            ] as const).map(([label, href, icon]) => (
              <Link key={href} className="pilot-quick-link" href={href}>
                <span aria-hidden="true" className="pilot-quick-icon">{icon}</span>
                <strong>{t(label)}</strong><span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {section === "onboarding" ? (
        <>
          <div className="pilot-section-heading">
            <h3>{t("Data onboarding")}</h3>
            <p>{t("Follow the setup order, then use the existing validated import workflow in Families.")}</p>
          </div>
          <div className="pilot-steps">
            {([
              ["Academic year", "/admin/academics/years"],
              ["Classes and subjects", "/admin/academics"],
              ["School accounts", "/admin/accounts"],
              ["Teaching assignments", "/admin/academics/assignments"],
              ["Negaran and timetable", "/admin/academics/negaran"],
              ["Families and students", "/admin/families"]
            ] as const).map(([label, href], index) => (
              <article className="admin-panel pilot-step-card" key={href}>
                <span className="pilot-step-number">{index + 1}</span>
                <div><h3>{t(label)}</h3><Link className="pilot-inline-link" href={href}>{t("Open section")}</Link></div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {section === "subscription" ? (
        <article className="admin-panel">
          <h3>{t("Subscription details")}</h3>
          <p className="admin-copy">{t("Subscription changes are controlled by platform administrators.")}</p>
          <dl className="pilot-detail-grid">
            <div><dt>{t("Plan")}</dt><dd>{subscription.planCode}</dd></div>
            <div><dt>{t("Status")}</dt><dd>{t(subscription.status)}</dd></div>
            <div><dt>{t("Billing cycle")}</dt><dd>{t(subscription.billingCycle)}</dd></div>
            <div><dt>{t("Price")}</dt><dd>{subscription.priceAfn.toLocaleString()} AFN</dd></div>
            <div><dt>{t("Setup fee")}</dt><dd>{subscription.setupFeeAfn.toLocaleString()} AFN</dd></div>
            <div><dt>{t("Start date")}</dt><dd>{subscription.startsOn ? formatAdminHijriDate(locale, subscription.startsOn) : "—"}</dd></div>
            <div><dt>{t("Expiry date")}</dt><dd>{subscription.expiresOn ? formatAdminHijriDate(locale, subscription.expiresOn) : "—"}</dd></div>
            <div><dt>{t("Grace period ends")}</dt><dd>{subscription.graceEndsOn ? formatAdminHijriDate(locale, subscription.graceEndsOn) : "—"}</dd></div>
          </dl>
          <p className="pilot-security-note">{t("Contact platform support to review or change your school's subscription.")}</p>
        </article>
      ) : null}

      {section === "launch" ? (
        <article className="admin-panel pilot-launch-note">
          <span className="eyebrow">{t("Pilot launch review")}</span>
          <h3>{t("Launch approval")}</h3>
          <span className="pilot-badge pilot-badge-warning">{t("Not verified")}</span>
          <p>{t("Core setup checks are not a production launch approval. Complete the live release acceptance steps before launch.")}</p>
          <Link className="pilot-inline-link" href="/admin/pilot/readiness">{t("View readiness")}</Link>
          <h3>{t("Manual verification still required")}</h3>
          <div className="pilot-manual-list">
            {[
              "Real administrator, teacher, parent, and student journeys",
              "Live database connectivity and migration verification",
              "Encrypted backup and restore rehearsal",
              "Push delivery, scheduled jobs, and monitoring",
              "Device accessibility and Dari/Pashto RTL review"
            ].map((item) => <div key={item}><span>{t(item)}</span><span className="pilot-badge pilot-badge-warning">{t("Not verified")}</span></div>)}
          </div>
          <p className="pilot-security-note">{t("No approval or support ticket is created from this page.")}</p>
        </article>
      ) : null}

      {(section === "audit" || section === "onboarding") ? (
      <div className="admin-grid pilot-tools-grid">
        {section === "audit" ? (
        <article className="admin-panel">
          <h3>{t("School data export")}</h3>
          <p className="admin-copy">
            {t("Download a school-scoped JSON export. Password hashes and authentication sessions are excluded.")}
          </p>
          <button
            className="admin-primary"
            type="button"
            disabled={busy}
            onClick={() => void download("/v1/admin/pilot/export", "maktablink-school-export.json", t("School export downloaded."))}
          >{t("Download core export")}</button>
          <p className="pilot-security-note">{t("Exports may contain private school and family information. Store the file securely.")}</p>
        </article>
        ) : null}

        {section === "onboarding" ? (
        <article className="admin-panel">
          <h3>{t("Import templates")}</h3>
          <Link className="pilot-inline-link" href="/admin/families">{t("Start import in Families")}</Link>
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
                    adminFormat(locale, "{entity} template downloaded.", { entity: t(`${entity.toLowerCase()} CSV`) })
                  )
                }
              >
                {t(`${entity.toLowerCase()} CSV`)}
              </button>
            ))}
          </div>
        </article>
        ) : null}
      </div>
      ) : null}

      {section === "audit" ? (
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
              <time dateTime={item.createdAt}>{formatAdminHijriDateTime(locale, item.createdAt)}</time>
            </div>
          ))}
          {audit.length === 0 ? <p className="admin-copy">{t("No audit events on this page.")}</p> : null}
        </div>
      </article>
      ) : null}
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


function pilotCheckLabel(key: string, t: (english: string) => string) {
  const labels: Record<string, string> = {
    "school-active": "School active",
    "subscription": "Subscription",
    "admin": "Administrator account",
    "academic-year": "Active academic year",
    "classes": "Classes ready",
    "subjects": "Subjects ready",
    "teachers": "Teacher profiles",
    "assignments": "Teacher assignments ready",
    "families": "Families ready",
    "school": "School"
  };
  return t(labels[key] ?? key);
}

function pilotCheckDetail(
  key: string,
  readiness: Readiness,
  subscription: Subscription,
  locale: "fa-AF" | "ps-AF" | "en",
  t: (english: string) => string
) {
  switch (key) {
    case "school-active":
      return t("School is active.");
    case "subscription":
      return adminFormat(locale, "Subscription status: {status}.", { status: t(subscription.status) });
    case "admin":
      return adminFormat(locale, "{count} school administrator account(s).", { count: readiness.counts.admins });
    case "academic-year":
      return adminFormat(locale, "{count} active academic year(s).", { count: readiness.counts.activeAcademicYears });
    case "classes":
      return adminFormat(locale, "{count} class(es).", { count: readiness.counts.classes });
    case "subjects":
      return adminFormat(locale, "{count} subject(s).", { count: readiness.counts.subjects });
    case "teachers":
      return adminFormat(locale, "{count} teacher profile(s).", { count: readiness.counts.teachers });
    case "assignments":
      return adminFormat(locale, "{count} teacher assignment(s).", { count: readiness.counts.teacherAssignments });
    case "families":
      return adminFormat(locale, "{parents} parent(s), {students} student(s).", {
        parents: readiness.counts.parents,
        students: readiness.counts.students
      });
    case "school":
      return t("School not found.");
    default:
      return t("Core pilot setup");
  }
}
