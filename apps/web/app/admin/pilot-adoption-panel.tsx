"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import {
  parseAdoptionReport, adoptionSummary, type AdoptionReport
} from "./pilot-adoption-model";

type Window = "today" | "7d" | "30d";
type Report = AdoptionReport;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const WINDOWS: Array<{ value: Window; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" }
];
const ACTIVITIES: Array<{ key: keyof Report["activities"]; label: string; href: string }> = [
  { key: "attendanceClassDays", label: "Attendance class-days submitted", href: "/admin/attendance" },
  { key: "attendanceStudentMarks", label: "Student attendance marks", href: "/admin/attendance" },
  { key: "homeworkPublished", label: "Homework published", href: "/admin/learning" },
  { key: "homeworkSubmissions", label: "Homework submissions", href: "/admin/learning" },
  { key: "announcementsPublished", label: "Announcements published", href: "/admin/communication" }
];

export function PilotAdoptionPanel({ accessToken, locale }: {
  accessToken: string; locale: AdminLocale;
}) {
  const t = (word: string) => adminText(locale, word);
  const [window, setWindow] = useState<Window>("7d");
  const [data, setData] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const number = (n: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : locale).format(n);
  const summary = data ? adoptionSummary(data) : null;
  const roleLabel = (role: "TEACHER" | "PARENT" | "STUDENT") =>
    t(role === "TEACHER" ? "Teachers" : role === "PARENT" ? "Parents" : "Students");

  useEffect(() => {
    const abort = new AbortController();
    setData(null); setBusy(true); setError("");
    void (async () => {
      try {
        const response = await fetch(API_URL + "/v1/admin/pilot/adoption?window=" + window, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: abort.signal, cache: "no-store"
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message ?? "Usage report could not be loaded.");
        const verified = parseAdoptionReport(payload, window);
        if (!abort.signal.aborted) setData(verified);
      } catch (cause) {
        if (!abort.signal.aborted) setError(adminErrorText(locale, cause, "Usage report could not be loaded."));
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    })();
    return () => abort.abort();
  }, [accessToken, locale, window, revision]);

  return (
    <section className="pilot-adoption" aria-labelledby="pilot-adoption-heading">
      <div className="admin-section-header">
        <div>
          <span className="eyebrow">{t("Operational engagement")}</span>
          <h3 id="pilot-adoption-heading">{t("Usage & adoption")}</h3>
          <p>{t("School activity aggregated from existing login and academic records.")}</p>
        </div>
        <div className="pilot-adoption-toolbar" role="group" aria-label={t("Reporting period")}>
          {WINDOWS.map((item) => (
            <button type="button" key={item.value} className={item.value === window ? "admin-primary" : "admin-secondary"}
              aria-pressed={window === item.value} onClick={() => setWindow(item.value)}>
              {t(item.label)}
            </button>
          ))}
          <button type="button" className="admin-secondary" disabled={busy}
            onClick={() => setRevision((n) => n + 1)}>{t("Refresh report")}</button>
        </div>
      </div>
      {busy ? <div className="admin-panel" role="status">{t("Loading usage data…")}</div> : null}
      {error ? (
        <div className="admin-error pilot-retry-alert" role="alert">
          <span>{error}</span>
          <button className="admin-secondary" type="button" onClick={() => setRevision((n) => n + 1)}>{t("Retry")}</button>
        </div>
      ) : null}
      {data ? (
        <>
          <p className="pilot-security-note">{t("Reporting timezone: Kabul. Figures cover this school only.")}</p>
          {summary ? (
            <section className="admin-panel pilot-adoption-coverage" aria-label={t("Account adoption overview")}>
              <div className="admin-section-header">
                <div>
                  <h3>{t("Account adoption overview")}</h3>
                  <p>{t("Current eligible accounts and their recorded latest-login and activation status.")}</p>
                </div>
              </div>
              <div className="pilot-adoption-overview-grid">
                <div><span>{t("Eligible accounts")}</span><strong>{number(summary.eligible)}</strong></div>
                <div><span>{t("Activated accounts")}</span>
                  <strong>{summary.activatedPercent === null ? "—" : number(summary.activatedPercent) + "%"}</strong>
                  <small>{number(summary.activated)} / {number(summary.eligible)}</small></div>
                <div><span>{t("Recorded recent sign-ins")}</span>
                  <strong>{summary.signedInPercent === null ? "—" : number(summary.signedInPercent) + "%"}</strong>
                  <small>{number(summary.signedIn)} / {number(summary.eligible)}</small></div>
              </div>
              {summary.eligible === 0 ? (
                <p className="pilot-security-note">{t("No eligible accounts. Coverage cannot be assessed.")}</p>
              ) : null}
            </section>
          ) : null}
          <div className="pilot-adoption-role-grid">
            {data.roles.map((role) => (
              <article className="admin-panel pilot-adoption-role" key={role.role}>
                <h4>{roleLabel(role.role)}</h4>
                <strong>{role.signedInPercent === null ? "—" : number(role.signedInPercent) + "%"}</strong>
                <p>{adminFormat(locale, "{signedIn} of {eligible} signed in during the period", {
                  signedIn: number(role.signedIn), eligible: number(role.eligible)
                })}</p>
                <progress max={Math.max(1, role.eligible)} value={role.signedIn}
                  aria-label={t("Sign-in coverage")} />
                <p>{adminFormat(locale, "{activated} of {eligible} completed initial password change", {
                  activated: number(role.activated), eligible: number(role.eligible)
                })}</p>
                <div className="pilot-adoption-activation">
                  <span>{t("Account activation")}</span>
                  <strong>{role.activatedPercent === null ? "—" : number(role.activatedPercent) + "%"}</strong>
                </div>
                <progress max={Math.max(1, role.eligible)} value={role.activated}
                  aria-label={t("Account activation")} />
                {role.eligible === 0 ? <span className="pilot-security-note">{t("No eligible accounts for this role.")}</span> : null}
              </article>
            ))}
          </div>
          {summary ? (
            <section className="admin-panel pilot-adoption-followups" aria-labelledby="pilot-adoption-followups-heading">
              <div className="admin-section-header">
                <div>
                  <h3 id="pilot-adoption-followups-heading">{t("Recommended adoption follow-ups")}</h3>
                  <p>{t("Account actions derived from current school records, not evidence of daily activity.")}</p>
                </div>
              </div>
              {summary.followUps.length ? (
                <ul className="pilot-adoption-followup-list">
                  {summary.followUps.map((item) => (
                    <li className="pilot-adoption-followup" key={item.key}>
                      <div>
                        <strong>{roleLabel(item.role)} · {t(item.kind === "empty" ?
                          "No eligible accounts" : item.kind === "activation" ?
                          "Activation needed" : "Review latest-login coverage")}</strong>
                        <p>{item.kind === "empty" ?
                          t("No active eligible accounts were found for this role.") :
                          item.kind === "activation" ?
                            adminFormat(locale, "{count} of {total} eligible accounts have not completed activation.", {
                              count: number(item.count), total: number(item.total)
                            }) :
                            adminFormat(locale, "{count} of {total} eligible accounts have no latest login within this period. This does not prove inactivity.", {
                              count: number(item.count), total: number(item.total)
                            })}</p>
                      </div>
                      <Link href={item.href} className="pilot-inline-link">
                        {t("Open section")} <span aria-hidden="true">↗</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pilot-security-note">
                  {t("No account coverage gaps in the recorded aggregates. This does not prove participation or learning outcomes.")}
                </p>
              )}
            </section>
          ) : null}
          <div className="admin-panel pilot-adoption-events">
            <div className="admin-section-header">
              <div>
                <h3>{t("Educational activity records")}</h3>
                <p>{t("Event counts for the active academic year; not completion or participation rates.")}</p>
              </div>
            </div>
            <div className="pilot-adoption-event-grid">
              {ACTIVITIES.map((activity) => (
                <Link className="pilot-adoption-event" href={activity.href} key={activity.key}>
                  <span>{t(activity.label)}</span>
                  <strong>{number(data.activities[activity.key])}</strong>
                  <span>{t("Open section")}</span>
                </Link>
              ))}
            </div>
          </div>
          <p className="pilot-security-note">{t("Sign-in coverage uses each account's last login only; users who signed in and then again outside the period are not counted. It is not daily active usage, reading time, or learning success. Attendance figures count recorded class-days and marks, not the rate of expected attendance.")}</p>
        </>
      ) : null}
    </section>
  );
}
