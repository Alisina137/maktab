"use client";
import type { AdminLocale } from "../admin/admin-i18n";
import { adminText } from "../admin/admin-i18n";

type StaffHomeProps = {
  locale: AdminLocale;
  school: { name: string; code: string };
  displayName: string;
  position: string | null;
  department: string | null;
  permissions: string[];
  onDirectory: () => void;
  onRegistrations: () => void;
  onSettings: () => void;
};
const PLANNED: Record<string,string> = {
  ATTENDANCE_REVIEW: "Attendance review",
  FEES_VIEW: "Fee records",
  FEES_COLLECT: "Payment collection",
  TASKS_VIEW: "Assigned tasks",
  COMMUNICATION_DRAFT: "Communication drafts",
  REPORTS_VIEW: "Operational reports"
};
/** Informational home only: assigned future permissions must never imply an
 * operational feature, existing record count or completed task. */
export function StaffHomePanel({locale, school, displayName, position, department,
  permissions, onDirectory, onRegistrations, onSettings}: StaffHomeProps) {
  const t = (label:string) => adminText(locale,label);
  const canDirectory = permissions.includes("DIRECTORY_VIEW");
  const canRegister = permissions.includes("ENROLLMENT_REQUESTS");
  const planned = permissions.filter(p => p in PLANNED);
  return <section className="staff-home" aria-labelledby="staff-home-heading">
    <div className="staff-home-heading">
      <div>
        <span className="eyebrow">{t("Staff Home")}</span>
        <h2 id="staff-home-heading">{t("My daily workspace")}</h2>
        <p>{t("Your available work is based on permissions assigned by the school administrator.")}</p>
      </div>
    </div>
    <div className="staff-home-cards">
      <article className="staff-home-card">
        <span>{t("My school")}</span>
        <strong>{school.name}</strong>
        <small>{school.code}</small>
      </article>
      <article className="staff-home-card">
        <span>{t("My position")}</span>
        <strong>{position ? t(position.replaceAll("_"," ").toLowerCase()) : t("Not assigned")}</strong>
        <small>{department || t("No department assigned")}</small>
      </article>
      <article className="staff-home-card">
        <span>{t("Available workspace")}</span>
        <strong>{canRegister ? t("Registration requests") : canDirectory ? t("School directory") : t("No active modules")}</strong>
        <small>{t("Only enabled workflows appear as actions.")}</small>
      </article>
    </div>
    <div className="staff-home-columns">
      <article className="admin-panel staff-home-section">
        <h3>{t("Quick actions")}</h3>
        <p>{t("Hello, {name}").replace("{name}",displayName)}.</p>
        <div className="staff-home-actions">
          {canDirectory ? <button className="admin-primary" type="button"
            onClick={onDirectory}>{t("Search school directory")}</button> : null}
          {canRegister?<button className="admin-primary" type="button"
            onClick={onRegistrations}>{t("New registration")}</button>:null}
          <button className="admin-secondary" type="button"
            onClick={onSettings}>{t("My profile & security")}</button>
        </div>
      </article>
      <article className="admin-panel staff-home-section">
        <h3>{t("Assigned responsibilities")}</h3>
        {planned.length ? <ul className="staff-home-responsibilities">
          {planned.map(p=><li key={p}><span>{t(PLANNED[p]!)}</span>
            <span className="pilot-badge">{t("Coming in a later phase")}</span></li>)}
        </ul> : <p>{t("No additional workflows are available yet.")}</p>}
        <p className="pilot-security-note">
          {t("A granted permission is not an active module until the workflow is implemented and verified.")}
        </p>
      </article>
    </div>
  </section>;
}
