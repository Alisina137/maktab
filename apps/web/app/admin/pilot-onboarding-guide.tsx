"use client";

import Link from "next/link";
import { adminFormat, adminText, type AdminLocale } from "./admin-i18n";

type CoreReadiness = {
  checks: Array<{ key: string; passed: boolean }>;
  counts: {
    activeAcademicYears: number; classes: number; subjects: number;
    teachers: number; parents: number; students: number;
  };
};
type Coverage = {
  key: string; total: number; complete: number; missing: number;
  status: "critical" | "warning" | "complete" | "not_applicable";
  severity: "critical" | "warning";
  percentage: number | null;
};
type AdvancedReadiness = { metrics: Coverage[]; ready: boolean };
type Step = { key: string; label: string; href: string; state: "complete" | "pending" | "unknown" };
type Quality = { key: string; label: string; href: string; severity: "critical" | "warning" };

const qualityChecks: Quality[] = [
  { key: "family_links", label: "Student family and class relationships", href: "/admin/families", severity: "critical" },
  { key: "teaching", label: "Classes missing active teacher assignments", href: "/admin/academics/assignments", severity: "critical" },
  { key: "student_logins", label: "Students without activated logins", href: "/admin/accounts", severity: "warning" },
  { key: "teacher_logins", label: "Teachers without first login", href: "/admin/accounts", severity: "warning" },
  { key: "class_students", label: "Classes without enrolled students", href: "/admin/families", severity: "warning" },
  { key: "timetable", label: "Classes without matching timetable periods", href: "/admin/academics/timetable", severity: "warning" },
  { key: "negaran", label: "Classes missing a current Negaran", href: "/admin/academics/negaran", severity: "warning" }
];

export function PilotOnboardingGuide({ readiness, advanced, advancedLoading, locale }: {
  readiness: CoreReadiness;
  advanced: AdvancedReadiness | null;
  advancedLoading: boolean;
  locale: AdminLocale;
}) {
  const t = (value: string) => adminText(locale, value);
  const core = (key: string) => readiness.checks.find((check) => check.key === key)?.passed === true;
  const coverage = (key: string) => advanced?.metrics.find((item) => item.key === key);
  const stateFromCoverage = (key: string): Step["state"] => {
    const metric = coverage(key);
    if (!metric) return "unknown";
    return metric.total > 0 && metric.missing === 0 ? "complete" : "pending";
  };
  const status = (passed: boolean): Step["state"] => passed ? "complete" : "pending";
  const steps: Step[] = [
    { key: "school", label: "School and subscription", href: "/admin/pilot/subscription",
      state: status(core("school-active") && core("subscription")) },
    { key: "year", label: "Activate one academic year", href: "/admin/academics/years",
      state: status(readiness.counts.activeAcademicYears === 1) },
    { key: "classes", label: "Create grades, classes and subjects", href: "/admin/academics",
      state: status(readiness.counts.classes > 0 && readiness.counts.subjects > 0) },
    { key: "teachers", label: "Create teacher accounts", href: "/admin/accounts",
      state: status(readiness.counts.teachers > 0) },
    { key: "assignments", label: "Assign teachers to active classes", href: "/admin/academics/assignments",
      state: stateFromCoverage("teaching") },
    { key: "parents", label: "Create or import parent accounts", href: "/admin/families",
      state: status(readiness.counts.parents > 0) },
    { key: "students", label: "Create or import student records", href: "/admin/families",
      state: advanced ? status((coverage("student_logins")?.total ?? 0) > 0) : "unknown" },
    { key: "family_links", label: "Verify student and parent relationships", href: "/admin/families",
      state: stateFromCoverage("family_links") },
    { key: "timetable", label: "Configure class timetables", href: "/admin/academics/timetable",
      state: stateFromCoverage("timetable") },
    { key: "negaran", label: "Assign a current Negaran to each class", href: "/admin/academics/negaran",
      state: stateFromCoverage("negaran") }
  ];
  const completed = steps.filter((step) => step.state === "complete").length;
  const unknown = steps.some((step) => step.state === "unknown");
  const next = steps.find((step) => step.state === "pending");
  const issues = qualityChecks.map((definition) => ({ ...definition, metric: coverage(definition.key) }));
  const knownIssues = issues.filter((issue) => (issue.metric?.missing ?? 0) > 0);

  return (
    <>
      <section className="admin-panel pilot-guide" aria-labelledby="pilot-guide-title">
        <div className="admin-section-header">
          <div>
            <span className="eyebrow">{t("Guided setup")}</span>
            <h3 id="pilot-guide-title">{t("School onboarding checklist")}</h3>
            <p>{t("Follow these steps in order. Progress comes from current school data, not manual checkboxes.")}</p>
          </div>
          <span className="pilot-badge">{adminFormat(locale, "{done} of {total} steps verified", {
            done: completed, total: steps.length
          })}</span>
        </div>
        <progress value={completed} max={steps.length} aria-label={t("School onboarding checklist")} />
        {unknown || advancedLoading ? (
          <p className="pilot-security-note" role="status">{t("Coverage is still loading or unavailable; some setup steps cannot yet be verified.")}</p>
        ) : null}
        {next ? (
          <div className="pilot-guide-next">
            <span className="pilot-badge pilot-badge-warning">{t("Recommended next action")}</span>
            <strong>{t(next.label)}</strong>
            <Link className="admin-primary" href={next.href}>{t("Continue setup")}</Link>
          </div>
        ) : !unknown && !advancedLoading ? (
          <p className="pilot-security-note">{t("Configuration steps are complete. Production release still needs independent approval.")}</p>
        ) : null}
        <div className="pilot-guide-list">
          {steps.map((step, index) => (
            <div className="pilot-guide-step" key={step.key}>
              <span className="pilot-step-number" aria-hidden="true">{index + 1}</span>
              <div>
                <strong>{t(step.label)}</strong>
                <span className={"pilot-badge " + (step.state === "complete" ? "pilot-badge-ok" : "pilot-badge-warning")}>
                  {t(step.state === "complete" ? "Configured" : step.state === "unknown" ? "Not verified" : "Review setup")}
                </span>
              </div>
              <Link href={step.href} className="pilot-inline-link">{t("Open section")}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel pilot-data-quality" aria-labelledby="pilot-quality-title">
        <div className="admin-section-header">
          <div>
            <span className="eyebrow">{t("Data quality")}</span>
            <h3 id="pilot-quality-title">{t("Enrollment and account quality")}</h3>
            <p>{t("Actual active-year coverage checks reveal incomplete records after import. Open School Readiness to inspect affected records.")}</p>
          </div>
          <Link href="/admin/pilot/readiness" className="pilot-inline-link">{t("Inspect affected records")}</Link>
        </div>
        {!advanced ? (
          <p role="status" className="pilot-security-note">{t(advancedLoading
            ? "Checking configuration coverage…" : "Data quality is unavailable; no all-clear can be confirmed.")}</p>
        ) : (
          <>
            <div className="pilot-quality-grid">
              {issues.map((item) => (
                <article className="pilot-quality-card" key={item.key}>
                  <div className="pilot-coverage-top">
                    <strong>{t(item.label)}</strong>
                    <span className={"pilot-badge " + (item.metric?.status === "critical" ? "pilot-badge-danger" :
                      item.metric?.status === "warning" ? "pilot-badge-warning" : "pilot-badge-ok")}>
                      {t(!item.metric || item.metric.status === "not_applicable" ? "Not applicable" :
                        item.metric.status === "complete" ? "Passed" : item.metric.severity === "critical" ? "Critical" : "Warning")}
                    </span>
                  </div>
                  <p>{item.metric?.total ? adminFormat(locale, "{count} of {total} records need review", {
                    count: item.metric.missing, total: item.metric.total
                  }) : t("No eligible records in the active academic year.")}</p>
                  <Link className="pilot-inline-link" href={item.href}>{t("Resolve")}</Link>
                </article>
              ))}
            </div>
            {knownIssues.length === 0 && issues.every((item) => (item.metric?.total ?? 0) > 0) ? (
              <p className="pilot-security-note">{t("No outstanding issues in these seven data-quality checks.")}</p>
            ) : null}
            <p className="pilot-security-note">{t("A clean report covers these checks only. It does not verify actual attendance, delivery or production launch.")}</p>
          </>
        )}
      </section>
    </>
  );
}
