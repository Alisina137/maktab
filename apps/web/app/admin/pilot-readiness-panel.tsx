"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminLoader, AdminSkeleton } from "./admin-loader";
import { PilotSubscriptionHealthPanel } from "./pilot-subscription-health";
import { PilotLaunchSupportPanel } from "./pilot-launch-support-panel";
import { AdminHijriDatePicker, formatAdminHijriDate, formatAdminHijriDateTime } from "./admin-hijri-date-picker";
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


type CoverageMetric = {
  key: "teaching" | "timetable" | "negaran" | "class_students" |
    "family_links" | "student_logins" | "teacher_logins";
  category: "academics" | "attendance" | "families";
  severity: "critical" | "warning";
  status: "complete" | "critical" | "warning" | "not_applicable";
  total: number; complete: number; missing: number; percentage: number | null;
};

type AdvancedReadiness = {
  ready: boolean;
  coreReady: boolean;
  warnings: number;
  critical: number;
  metrics: CoverageMetric[];
};

type CoverageIssues = {
  metric: CoverageMetric["key"];
  rows: Array<{ id: string; label: string }>;
  offset: number; limit: number; hasMore: boolean;
};

const coverageCategories = [
  { key: "academics", label: "Academic coverage" },
  { key: "attendance", label: "Attendance coverage" },
  { key: "families", label: "Families & account coverage" }
] as const;

const coverageLabels: Record<CoverageMetric["key"], string> = {
  teaching: "Classes with active teacher assignments",
  timetable: "Classes with matching timetable periods",
  negaran: "Classes with a current Negaran",
  class_students: "Classes with enrolled students",
  family_links: "Students with accessible parents and matching classes",
  student_logins: "Students with activated logins",
  teacher_logins: "Teachers with completed first login"
};

const coverageDestinations: Record<CoverageMetric["key"], string> = {
  teaching: "/admin/academics/assignments",
  timetable: "/admin/academics/timetable",
  negaran: "/admin/academics/negaran",
  class_students: "/admin/families",
  family_links: "/admin/families",
  student_logins: "/admin/accounts",
  teacher_logins: "/admin/accounts"
};


type ImportHistoryRow = {
  id: string;
  entityType: "PARENT" | "STUDENT" | "TEACHER";
  rowCount: number;
  importedCount: number;
  rejectedCount: number;
  status: "COMPLETED" | "REJECTED" | "FAILED";
  reason: string | null;
  createdAt: string;
  actorUsername: string | null;
};
type ImportHistoryPage = {
  rows: ImportHistoryRow[];
  offset: number;
  limit: number;
  hasMore: boolean;
};

type AuditLog = {
  id: string;
  action: string;
  category: string;
  actorUsername: string | null;
  entityType: string;
  targetLabel: string | null;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
};
type AuditFilters = {
  category: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  actorUserId: string;
};
const EMPTY_AUDIT_FILTERS: AuditFilters = {
  category: "all", search: "", dateFrom: "", dateTo: "", actorUserId: ""
};
const AUDIT_CATEGORIES = [
  "all", "accounts", "academics", "attendance", "learning", "communication", "fees", "operations"
] as const;
function auditTitle(action: string): string {
  const known: Record<string, string> = {
    "user.suspended": "Account suspended",
    "user.reactivated": "Account reactivated",
    "user.password_reset": "Account password reset",
    "pilot.exported": "School data exported",
    "pilot.audit_exported": "Audit history exported",
    "families.import_committed": "Family import completed",
    "student.attendance_corrected": "Attendance corrected"
  };
  return known[action] ?? action.replace(/[._]/g, " ").replace(/^./, (char) => char.toUpperCase());
}
function auditQuery(filters: AuditFilters, offset: number, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.actorUserId.trim()) params.set("actorUserId", filters.actorUserId.trim());
  return params.toString();
}

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
  const issueRequestVersion = useRef(0);
  const importHistoryRequestVersion = useRef(0);
  const t = (english: string) => adminText(locale, english);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [auditDraftFilters, setAuditDraftFilters] = useState<AuditFilters>({ ...EMPTY_AUDIT_FILTERS });
  const [auditAppliedFilters, setAuditAppliedFilters] = useState<AuditFilters>({ ...EMPTY_AUDIT_FILTERS });
  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryPage | null>(null);
  const [importHistoryBusy, setImportHistoryBusy] = useState(false);
  const [importHistoryError, setImportHistoryError] = useState("");
  const [importEntityFilter, setImportEntityFilter] = useState("");
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedReadiness | null>(null);
  const [advancedBusy, setAdvancedBusy] = useState(false);
  const [advancedError, setAdvancedError] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<CoverageMetric["key"] | null>(null);
  const [issues, setIssues] = useState<CoverageIssues | null>(null);
  const [issuesBusy, setIssuesBusy] = useState(false);
  const [issuesError, setIssuesError] = useState("");
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
    setSelectedAudit(null);
    setAuditOffset(0);
    setAuditHasMore(false);
    setAuditLoaded(false);
    setAdvanced(null);
    setAdvancedError("");
    setSelectedMetric(null);
    setIssues(null);
    issueRequestVersion.current += 1;
    void load(0);
    return () => { requestVersion.current += 1; };
  }, [accessToken, section]);

  useEffect(() => {
    setImportHistory(null);
    setImportHistoryError("");
    setImportEntityFilter("");
    if (section === "onboarding") void loadImportHistory(0, "");
    return () => { importHistoryRequestVersion.current += 1; };
  }, [accessToken, section]);

  async function loadImportHistory(offset: number, entityType = importEntityFilter) {
    const version = ++importHistoryRequestVersion.current;
    setImportHistoryBusy(true);
    setImportHistoryError("");
    try {
      const query = new URLSearchParams({ limit: "20", offset: String(offset) });
      if (entityType) query.set("entityType", entityType);
      const page = await request<ImportHistoryPage>(accessToken,
        "/v1/admin/families/import/history?" + query.toString());
      if (version === importHistoryRequestVersion.current) setImportHistory(page);
    } catch (cause) {
      if (version === importHistoryRequestVersion.current) {
        setImportHistoryError(adminErrorText(locale, cause, "Could not load import history."));
      }
    } finally {
      if (version === importHistoryRequestVersion.current) setImportHistoryBusy(false);
    }
  }

  async function load(offset = auditOffset, filters: AuditFilters = auditAppliedFilters) {
    const version = ++requestVersion.current;
    setBusy(true);
    setError("");
    const wantsCoverage = section === "overview" || section === "readiness" || section === "onboarding" || section === "launch";
    setAdvancedBusy(wantsCoverage);
    if (wantsCoverage) {
      setAdvancedError("");
      setAdvanced(null);
    }
    try {
      // Audit failure cannot hide subscription/readiness and vice versa.
      if (section === "audit") {
        const auditResult = await request<{ logs: AuditLog[]; hasMore: boolean }>(
          accessToken, "/v1/admin/pilot/audit?" + auditQuery(filters, offset)
        );
        if (version !== requestVersion.current) return;
        setAudit(auditResult.logs);
        setSelectedAudit(null);
        setAuditOffset(offset);
        setAuditHasMore(auditResult.hasMore);
        setAuditLoaded(true);
      } else {
        const [subscriptionResult, readinessResult] = await Promise.all([
          request<{ subscription: Subscription }>(accessToken, "/v1/admin/subscription"),
          request<Readiness>(accessToken, "/v1/admin/pilot/readiness")
        ]);
        if (version !== requestVersion.current) return;
        setSubscription(subscriptionResult.subscription);
        setReadiness(readinessResult);
        if (wantsCoverage) {
          // A failed advisory coverage request must not hide working core setup data.
          void request<AdvancedReadiness>(accessToken, "/v1/admin/pilot/readiness/advanced")
            .then((result) => {
              if (version === requestVersion.current) setAdvanced(result);
            })
            .catch((cause) => {
              if (version === requestVersion.current) {
                setAdvanced(null);
                setAdvancedError(adminErrorText(locale, cause, "Advanced coverage could not be loaded."));
              }
            })
            .finally(() => {
              if (version === requestVersion.current) setAdvancedBusy(false);
            });
        }
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(adminErrorText(locale, cause, "Could not load pilot readiness."));
        setAdvancedBusy(false);
      }
    } finally {
      if (version === requestVersion.current) {
        setBusy(false);
        if (!wantsCoverage) setAdvancedBusy(false);
      }
    }
  }

  function applyAuditFilters() {
    setAuditAppliedFilters({ ...auditDraftFilters });
    void load(0, auditDraftFilters);
  }

  function resetAuditFilters() {
    const cleared = { ...EMPTY_AUDIT_FILTERS };
    setAuditDraftFilters(cleared);
    setAuditAppliedFilters(cleared);
    void load(0, cleared);
  }

  async function downloadSensitive(path: string, filename: string, message: string) {
    if (!window.confirm(t("This export contains sensitive school records. Download only to a trusted device and store it securely. Continue?"))) return;
    await download(path, filename, message);
  }

  async function openIssues(metric: CoverageMetric["key"], offset = 0) {
    if (metric === selectedMetric && offset === 0 && issues?.offset === 0) {
      setSelectedMetric(null);
      setIssues(null);
      issueRequestVersion.current += 1;
      return;
    }
    const version = ++issueRequestVersion.current;
    setSelectedMetric(metric);
    setIssues(null);
    setIssuesError("");
    setIssuesBusy(true);
    try {
      const result = await request<CoverageIssues>(
        accessToken,
        "/v1/admin/pilot/readiness/issues?metric=" + encodeURIComponent(metric) +
          "&limit=10&offset=" + offset
      );
      if (version === issueRequestVersion.current) setIssues(result);
    } catch (cause) {
      if (version === issueRequestVersion.current) {
        setIssuesError(adminErrorText(locale, cause, "Could not load missing records."));
      }
    } finally {
      if (version === issueRequestVersion.current) setIssuesBusy(false);
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

  const coreMissing = section !== "audit" && (!subscription || !readiness);
  const auditMissing = section === "audit" && !auditLoaded;
  if ((coreMissing || auditMissing) && !error) {
    return (
      <section className="admin-panel pilot-section admin-loading-card">
        <AdminLoader label={t("Loading…")} />
        <AdminSkeleton rows={5} />
      </section>
    );
  }

  if (coreMissing || auditMissing) {
    return (
      <section className="admin-panel pilot-section admin-loading-card">
        <div className="admin-error" role="alert">{error}</div>
        <button className="admin-secondary" type="button" onClick={() => void load()}>
          {t("Retry")}
        </button>
      </section>
    );
  }

  // Audit-only render does not require the two core responses.
  const fallbackSubscription: Subscription = { planCode: "", status: "TRIAL", billingCycle: "ANNUAL",
    priceAfn: 0, setupFeeAfn: 0, startsOn: null, expiresOn: null, graceEndsOn: null };
  const fallbackReadiness: Readiness = { ready: false,
    counts: { admins: 0, teachers: 0, parents: 0, students: 0,
      activeAcademicYears: 0, classes: 0, subjects: 0, teacherAssignments: 0 },
    checks: [] };
  const currentSubscription = subscription ?? fallbackSubscription;
  const currentReadiness = readiness ?? fallbackReadiness;
  const effectiveSetupReady = Boolean(advanced?.ready);
  const writeBlocked =
    subscription?.status === "SUSPENDED" || subscription?.status === "CANCELLED";
  const passedChecks = currentReadiness.checks.filter((check) => check.passed).length;
  const totalChecks = currentReadiness.checks.length;
  const pendingChecks = currentReadiness.checks.filter((check) => !check.passed);
  const progressPercent = totalChecks ? Math.round((passedChecks / totalChecks) * 100) : 0;
  const billingAttention = currentSubscription.status === "PAST_DUE" || currentSubscription.status === "GRACE";

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

      {(section === "overview" || section === "readiness") && advancedBusy ? (
        <div className="admin-panel" role="status">
          <AdminLoader label={t("Checking configuration coverage…")} />
        </div>
      ) : null}
      {(section === "overview" || section === "readiness") && advancedError ? (
        <div className="admin-error" role="alert">{advancedError}
          <button className="admin-secondary" type="button" onClick={() => void load()}>{t("Retry")}</button>
        </div>
      ) : null}
      {section === "overview" && advanced ? (
        <div className="pilot-coverage-mini" aria-label={t("Coverage results")}>
          <span className="pilot-badge pilot-badge-danger">
            {adminFormat(locale, "{count} critical gaps", { count: advanced.critical })}
          </span>
          <span className="pilot-badge pilot-badge-warning">
            {adminFormat(locale, "{count} warnings", { count: advanced.warnings })}
          </span>
          <Link className="pilot-inline-link" href="/admin/pilot/readiness">{t("Review coverage")}</Link>
        </div>
      ) : null}
      {section === "readiness" && advanced ? (
        <section className="pilot-coverage-section" aria-labelledby="pilot-coverage-title">
          <div className="pilot-section-heading">
            <h3 id="pilot-coverage-title">{t("Configuration coverage")}</h3>
            <p>{t("Coverage applies only to active academic years. Critical gaps prevent automated setup readiness; warnings do not.")}</p>
            <span className={advanced.ready ? "pilot-badge pilot-badge-ok" : "pilot-badge pilot-badge-warning"}>
              {t(advanced.ready ? "Automated setup ready" : "Setup needs attention")}
            </span>
          </div>
          {coverageCategories.map((category) => (
            <article key={category.key} className="admin-panel pilot-coverage-category">
              <h3>{t(category.label)}</h3>
              <div className="pilot-coverage-grid">
                {advanced.metrics.filter((metric) => metric.category === category.key).map((metric) => (
                  <div className="pilot-coverage-card" key={metric.key}>
                    <div className="pilot-coverage-top">
                      <strong>{t(coverageLabels[metric.key])}</strong>
                      <span className={"pilot-badge " + (
                        metric.status === "critical" ? "pilot-badge-danger" :
                          metric.status === "warning" ? "pilot-badge-warning" : "pilot-badge-ok"
                      )}>
                        {t(metric.status === "not_applicable" ? "Not applicable" :
                          metric.status === "complete" ? "Complete" :
                            metric.status === "critical" ? "Critical" : "Warning")}
                      </span>
                    </div>
                    <p>{metric.percentage === null
                      ? t("No eligible records in the active academic year.")
                      : adminFormat(locale, "{complete} of {total} covered ({percentage}%)", {
                          complete: metric.complete, total: metric.total, percentage: metric.percentage
                        })}</p>
                    <progress value={metric.complete} max={Math.max(metric.total, 1)}
                      aria-label={t(coverageLabels[metric.key])} />
                    {metric.missing > 0 ? (
                      <div className="pilot-coverage-actions">
                        <button className="admin-secondary" type="button" disabled={issuesBusy}
                          aria-expanded={selectedMetric === metric.key}
                          onClick={() => void openIssues(metric.key)}>
                          {adminFormat(locale, "Review {count} missing", { count: metric.missing })}
                        </button>
                        <Link className="pilot-inline-link" href={coverageDestinations[metric.key]}>{t("Open section")}</Link>
                      </div>
                    ) : null}
                    {selectedMetric === metric.key ? (
                      <div className="pilot-coverage-issues">
                        {issuesBusy ? <p role="status">{t("Loading missing records…")}</p> : null}
                        {issuesError ? <p role="alert">{issuesError}</p> : null}
                        {issues?.metric === metric.key ? (
                          <>
                            <ul>{issues.rows.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
                            <div className="pilot-coverage-paging">
                              <button type="button" className="admin-secondary"
                                disabled={issues.offset === 0 || issuesBusy}
                                onClick={() => void openIssues(metric.key, Math.max(0, issues.offset - issues.limit))}>{t("Newer")}</button>
                              <button type="button" className="admin-secondary"
                                disabled={!issues.hasMore || issuesBusy}
                                onClick={() => void openIssues(metric.key, issues.offset + issues.limit)}>{t("Older")}</button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
          <p className="pilot-security-note">{t("Completing these checks does not verify live database health, backups, push delivery, or launch approval.")}</p>
        </section>
      ) : null}



      {section === "overview" && readiness ? (
        <article className="admin-panel pilot-overview-hero">
          <div className="pilot-overview-copy">
            <span className="eyebrow">{t("Automated school setup")}</span>
            <h3>{t(advancedBusy ? "Checking configuration coverage…" :
              effectiveSetupReady ? "Core setup ready" : "Setup in progress")}</h3>
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

      {subscription && (section === "overview" || section === "subscription") ? (
        <PilotSubscriptionHealthPanel key={accessToken} accessToken={accessToken}
          locale={locale} compact={section === "overview"} />
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
              <span className={effectiveSetupReady ? "pilot-badge pilot-badge-ok" : "pilot-badge pilot-badge-warning"}>
                {t(advancedBusy ? "Checking configuration coverage…" : effectiveSetupReady ? "Automated setup ready" : "Needs setup")}
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
                    <p>{pilotCheckDetail(check.key, currentReadiness, currentSubscription, locale, t)}</p>
                    {!check.passed && CHECK_DESTINATIONS[check.key] ? (
                      <Link className="pilot-inline-link" href={CHECK_DESTINATIONS[check.key] ?? "/admin/pilot/readiness"}>{t("Open section")}</Link>
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


      {section === "overview" && readiness ? (
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

      {section === "onboarding" && readiness ? (
        <>
          <div className="pilot-section-heading">
            <h3>{t("Data onboarding")}</h3>
            <p>{t("Follow the setup order, then use the existing validated import workflow in Families.")}</p>
          </div>
          <div className="pilot-steps">
            {([
              ["Academic year", "/admin/academics/years", readiness.counts.activeAcademicYears === 1],
              ["Classes and subjects", "/admin/academics", readiness.counts.classes > 0 && readiness.counts.subjects > 0],
              ["School accounts", "/admin/accounts", readiness.counts.teachers > 0],
              ["Teaching assignments", "/admin/academics/assignments", advanced?.metrics.find((m) => m.key === "teaching")?.status === "complete"],
              ["Negaran and timetable", "/admin/academics/negaran", advanced?.metrics.find((m) => m.key === "negaran")?.status === "complete" &&
                advanced?.metrics.find((m) => m.key === "timetable")?.status === "complete"],
              ["Families and students", "/admin/families", readiness.counts.students > 0 &&
                advanced?.metrics.find((m) => m.key === "family_links")?.status === "complete"]
            ] as const).map(([label, href, done], index) => (
              <article className="admin-panel pilot-step-card" key={href}>
                <span className="pilot-step-number" aria-hidden="true">{index + 1}</span>
                <div className="pilot-step-content">
                  <h3>{t(label)}</h3>
                  <span className={done ? "pilot-badge pilot-badge-ok" : "pilot-badge pilot-badge-warning"}>
                    {t(done ? "Configured" : advancedBusy ? "Checking configuration coverage…" : "Review setup")}
                  </span>
                  <Link className="pilot-inline-link" href={href}>{t("Open section")}</Link>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {section === "onboarding" ? (
        <article className="admin-panel pilot-import-history">
          <div className="admin-section-header">
            <div>
              <h3>{t("Import history")}</h3>
              <p>{t("Completed imports and rejected validation attempts. Temporary passwords and uploaded files are never stored here.")}</p>
            </div>
            <button className="admin-secondary" type="button"
              disabled={importHistoryBusy}
              onClick={() => void loadImportHistory(0)}>{t("Refresh")}</button>
          </div>
          <div className="pilot-import-filters">
            <label>
              {t("Import type")}
              <select value={importEntityFilter} disabled={importHistoryBusy}
                onChange={(event) => {
                  const next = event.target.value;
                  setImportEntityFilter(next);
                  void loadImportHistory(0, next);
                }}>
                <option value="">{t("All types")}</option>
                <option value="PARENT">{t("Parents")}</option>
                <option value="STUDENT">{t("Students")}</option>
                <option value="TEACHER">{t("Teachers")}</option>
              </select>
            </label>
          </div>
          {importHistoryBusy ? <p role="status">{t("Loading import history…")}</p> : null}
          {importHistoryError ? (
            <div className="admin-error" role="alert">
              {importHistoryError}
              <button className="admin-secondary" type="button"
                onClick={() => void loadImportHistory(importHistory?.offset ?? 0)}>{t("Retry")}</button>
            </div>
          ) : null}
          {importHistory ? (
            <>
              <div className="pilot-import-list">
                {importHistory.rows.map((item) => (
                  <div className="pilot-import-row" key={item.id}>
                    <div className="pilot-import-meta">
                      <strong>{t(item.entityType === "PARENT" ? "Parents" : item.entityType === "TEACHER" ? "Teachers" : "Students")}</strong>
                      <span>{formatAdminHijriDateTime(locale, item.createdAt)}</span>
                      <span>{item.actorUsername ?? t("Unknown administrator")}</span>
                    </div>
                    <div className="pilot-import-summary">
                      <span className={item.status === "COMPLETED" ? "pilot-badge pilot-badge-ok" : "pilot-badge pilot-badge-warning"}>
                        {t(item.status === "COMPLETED" ? "Completed" : item.status === "REJECTED" ? "Rejected" : "Failed")}
                      </span>
                      <span>{adminFormat(locale, "{count} rows submitted", { count: item.rowCount })}</span>
                      <span>{adminFormat(locale, "{count} imported", { count: item.importedCount })}</span>
                      {item.rejectedCount > 0 ? (
                        <span>{adminFormat(locale, "{count} rejected", { count: item.rejectedCount })}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!importHistory.rows.length ? <p className="admin-copy">{t("No import history found.")}</p> : null}
              </div>
              <div className="admin-actions pilot-import-pagination">
                <button className="admin-secondary" type="button"
                  disabled={importHistoryBusy || importHistory.offset === 0}
                  onClick={() => void loadImportHistory(Math.max(0, importHistory.offset - importHistory.limit))}>{t("Newer")}</button>
                <button className="admin-secondary" type="button"
                  disabled={importHistoryBusy || !importHistory.hasMore}
                  onClick={() => void loadImportHistory(importHistory.offset + importHistory.limit)}>{t("Older")}</button>
              </div>
            </>
          ) : null}
          <p className="pilot-security-note">{t("If a previous import succeeded but its response was lost, retry using the same request key. Accounts will not be created twice; reset passwords individually when credentials were not received.")}</p>
        </article>
      ) : null}

      {section === "subscription" && subscription ? (
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

      {section === "launch" && readiness ? (
        <PilotLaunchSupportPanel key={accessToken} accessToken={accessToken} locale={locale}
          setupReady={Boolean(advanced?.ready)} />
      ) : null}

      {(section === "audit" || section === "onboarding") && !coreMissing && !auditMissing ? (
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
            onClick={() => void downloadSensitive("/v1/admin/pilot/export", "maktablink-school-export.json", t("School export downloaded."))}
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

      {section === "audit" && auditLoaded ? (
        <>
          <article className="admin-panel pilot-audit-filters">
            <div className="admin-section-header">
              <div>
                <h3>{t("Audit filters")}</h3>
                <p>{t("Find school activity by category, action, actor or Solar Hijri date range.")}</p>
              </div>
            </div>
            <div className="pilot-audit-form">
              <label>{t("Category")}
                <select value={auditDraftFilters.category}
                  onChange={(event) => setAuditDraftFilters((previous) => ({ ...previous, category: event.target.value }))}>
                  {AUDIT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{t(category === "all" ? "All categories" : category)}</option>
                  ))}
                </select>
              </label>
              <label>{t("Search actions or usernames")}
                <input value={auditDraftFilters.search} maxLength={100} placeholder={t("Search audit history")}
                  onChange={(event) => setAuditDraftFilters((previous) => ({ ...previous, search: event.target.value }))} />
              </label>
              <label>{t("Actor user ID (optional)")}
                <input value={auditDraftFilters.actorUserId} maxLength={36} placeholder={t("Filter by administrator ID")}
                  onChange={(event) => setAuditDraftFilters((previous) => ({ ...previous, actorUserId: event.target.value }))} />
              </label>
              <div className="pilot-audit-date-label">
                <span>{t("Start date")}</span>
                <AdminHijriDatePicker locale={locale} value={auditDraftFilters.dateFrom}
                  onChange={(date) => setAuditDraftFilters((previous) => ({ ...previous, dateFrom: date }))} />
              </div>
              <div className="pilot-audit-date-label">
                <span>{t("End date")}</span>
                <AdminHijriDatePicker locale={locale} value={auditDraftFilters.dateTo}
                  onChange={(date) => setAuditDraftFilters((previous) => ({ ...previous, dateTo: date }))} />
              </div>
            </div>
            <div className="admin-actions">
              <button className="admin-primary" type="button" disabled={busy}
                onClick={applyAuditFilters}>{t("Apply filters")}</button>
              <button className="admin-secondary" type="button" disabled={busy}
                onClick={resetAuditFilters}>{t("Clear filters")}</button>
              <button className="admin-secondary" type="button" disabled={busy}
                onClick={() => void downloadSensitive(
                  "/v1/admin/pilot/audit/export?" + auditQuery(auditAppliedFilters, 0),
                  "maktablink-audit-history.csv", t("Audit history exported.")
                )}>{t("Export filtered audit CSV")}</button>
            </div>
            <p className="pilot-security-note">{t("CSV audit export includes up to 500 matching events, omits credentials and is recorded in the audit history.")}</p>
          </article>

          <article className="admin-panel">
            <div className="admin-section-header">
              <div>
                <h3>{t("Audit review")}</h3>
                <p>{t("Only safe audit details from the current school are visible.")}</p>
              </div>
              <div className="admin-actions">
                <button className="admin-secondary" type="button" disabled={busy || auditOffset === 0}
                  onClick={() => void load(Math.max(0, auditOffset - 20))}>{t("Newer")}</button>
                <button className="admin-secondary" type="button" disabled={busy || !auditHasMore}
                  onClick={() => void load(auditOffset + 20)}>{t("Older")}</button>
              </div>
            </div>
            <div className="pilot-audit-list">
              {audit.map((item) => (
                <div className="pilot-audit-row pilot-audit-row-readable" key={item.id}>
                  <div>
                    <strong>{t(auditTitle(item.action))}</strong>
                    <span>{t("Performed by")}: {item.actorUsername ?? t("System")}</span>
                    <span>{t("Affected record")}: {item.targetLabel ?? t(item.entityType)}</span>
                  </div>
                  <div className="pilot-audit-row-end">
                    <time dateTime={item.createdAt}>{formatAdminHijriDateTime(locale, item.createdAt)}</time>
                    <button className="admin-secondary" type="button"
                      aria-expanded={selectedAudit?.id === item.id}
                      onClick={() => setSelectedAudit(item)}>{t("View details")}</button>
                  </div>
                </div>
              ))}
              {audit.length === 0 ? <p className="admin-copy">{t("No audit events on this page.")}</p> : null}
            </div>
          </article>
          {selectedAudit ? (
            <div className="pilot-audit-drawer-overlay" role="presentation"
              onClick={() => setSelectedAudit(null)}>
              <section className="pilot-audit-drawer" role="dialog" aria-modal="true"
                aria-labelledby="pilot-audit-detail-title"
                onKeyDown={(event) => { if (event.key === "Escape") setSelectedAudit(null); }}
                onClick={(event) => event.stopPropagation()}>
                <div className="admin-section-header">
                  <h3 id="pilot-audit-detail-title">{t("Activity details")}</h3>
                  <button className="admin-secondary" type="button" onClick={() => setSelectedAudit(null)}
                    autoFocus>{t("Close")}</button>
                </div>
                <dl className="pilot-detail-grid">
                  <div><dt>{t("Action")}</dt><dd>{t(auditTitle(selectedAudit.action))}</dd></div>
                  <div><dt>{t("Category")}</dt><dd>{t(selectedAudit.category)}</dd></div>
                  <div><dt>{t("Performed by")}</dt><dd>{selectedAudit.actorUsername ?? t("System")}</dd></div>
                  <div><dt>{t("Affected record")}</dt><dd>{selectedAudit.targetLabel ?? t(selectedAudit.entityType)}</dd></div>
                  <div><dt>{t("Date")}</dt><dd>{formatAdminHijriDateTime(locale, selectedAudit.createdAt)}</dd></div>
                  {Object.entries(selectedAudit.metadata).map(([key, value]) => (
                    <div key={key}><dt>{t(key)}</dt><dd>{String(value)}</dd></div>
                  ))}
                </dl>
                <p className="pilot-security-note">{t("Sensitive metadata, passwords, tokens and raw record changes are not available in this view.")}</p>
              </section>
            </div>
          ) : null}
        </>
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
