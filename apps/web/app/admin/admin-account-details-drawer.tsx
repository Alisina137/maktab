"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { adminApi, friendlyAdminError, type User } from "./admin-client";
import { formatAdminHijriDate, formatAdminHijriDateTime } from "./admin-hijri-date-picker";
import type { AdminLocale } from "./admin-i18n";
import {
  accountFamilyDetails,
  accountTeacherDetails,
  accountLabel,
  type AccountAcademicOverview,
  type AccountFamilyOverview
} from "./account-details-data";

type UserAction = "reset-password" | "suspend" | "reactivate";

type Props = {
  user: User;
  currentAdminId: string;
  accessToken: string;
  families: AccountFamilyOverview | null;
  locale: AdminLocale;
  t: (value: string) => string;
  busy: boolean;
  onAction: (user: User, action: UserAction) => void;
  onClose: () => void;
};

function formatAccountDate(locale: AdminLocale, value: string | null | undefined, dateOnly = false) {
  if (!value) return null;
  const parsed = dateOnly ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (locale === "en") {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric", month: "short", day: "numeric",
      ...(dateOnly ? { timeZone: "UTC" } : { hour: "2-digit", minute: "2-digit" })
    }).format(parsed);
  }
  return dateOnly ? formatAdminHijriDate(locale, value) : formatAdminHijriDateTime(locale, value);
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="account-detail-fact">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

export function AdminAccountDetailsDrawer({
  user, currentAdminId, accessToken, families, locale, t, busy, onAction, onClose
}: Props) {
  const [academic, setAcademic] = useState<AccountAcademicOverview | null>(null);
  const [academicError, setAcademicError] = useState("");
  const [academicLoading, setAcademicLoading] = useState(user.role === "TEACHER");
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const name = accountLabel(user);
  const isSelf = user.id === currentAdminId;

  const family = accountFamilyDetails(user.id, families);
  const teacher = accountTeacherDetails(user.id, academic);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (user.role !== "TEACHER") return;
    let cancelled = false;
    setAcademic(null);
    setAcademicError("");
    setAcademicLoading(true);
    void adminApi<AccountAcademicOverview>("/v1/admin/academics", {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then((result) => {
      if (!cancelled) setAcademic(result);
    }).catch((error) => {
      if (!cancelled) setAcademicError(friendlyAdminError(error, "Could not load teacher assignments.", locale));
    }).finally(() => {
      if (!cancelled) setAcademicLoading(false);
    });
    return () => { cancelled = true; };
  }, [accessToken, user.id, user.role, locale]);

  const badge = (value: string) => <span className="account-detail-badge">{t(value)}</span>;

  return createPortal(
    <div className="account-detail-layer">
      <div className="account-detail-backdrop" aria-hidden="true" onClick={onClose} />
      <aside
        className="account-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-detail-title"
        aria-describedby="account-detail-description"
        ref={dialogRef}
        dir={locale === "en" ? "ltr" : "rtl"}
      >
        <header className="account-detail-header">
          <div className="account-detail-heading">
            <span className="eyebrow">{t("Account details")}</span>
            <h2 id="account-detail-title">{name}</h2>
            <p id="account-detail-description">{t("Review the account and its linked school records.")}</p>
          </div>
          <button ref={closeRef} type="button" className="admin-secondary account-detail-close" onClick={onClose}>
            {t("Close")}
          </button>
        </header>

        <div className="account-detail-body">
          <div className="account-detail-identity">
            <span className={`admin-user-avatar admin-user-avatar-${user.role.toLowerCase()}`} aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <div className="account-detail-identity-copy">
              <strong>{name}</strong>
              <span dir="ltr">@{user.username}</span>
            </div>
            <span className={`admin-status-badge admin-status-${user.status.toLowerCase()}`}>{t(
              user.status === "ACTIVE" ? "Active" : user.status === "INVITED" ? "Invited" : user.status === "SUSPENDED" ? "Suspended" : "Archived"
            )}</span>
          </div>

          <section className="account-detail-section">
            <h3>{t("Account information")}</h3>
            <dl className="account-detail-facts">
              <Fact label={t("Role")} value={t(
                user.role === "SCHOOL_ADMIN" ? "School admin" : user.role === "SCHOOL_STAFF" ? "School staff" :
                user.role === "TEACHER" ? "Teacher" : user.role === "PARENT" ? "Parent" : "Student"
              )} />
              <Fact label={t("Username")} value={user.username} />
              <Fact label={t("Phone")} value={user.profile?.phone} />
              <Fact label={t("Created on")} value={formatAccountDate(locale, user.createdAt)} />
              <Fact label={t("Last login")} value={formatAccountDate(locale, user.lastLoginAt)} />
              <Fact label={t("Account status")} value={t(user.status === "ACTIVE" ? "Active" : user.status === "INVITED" ? "Invited" : user.status === "SUSPENDED" ? "Suspended" : "Archived")} />
              <Fact label={t("Password setup")} value={t(user.mustChangePassword ? "Password change required" : "Completed")} />
            </dl>
          </section>

          {user.role === "PARENT" ? (
            <section className="account-detail-section">
              <h3>{t("Linked children")}</h3>
              {family.children.length ? (
                <div className="account-detail-records">
                  {family.children.map((row) => (
                    <div className="account-detail-record" key={row.student.id}>
                      <strong>{row.student.fullName}</strong>
                      <span>{t("Student code")}: <bdi dir="ltr">{row.student.studentCode}</bdi></span>
                      <span>{row.classSection.name} · {row.academicYear.name}</span>
                      {badge(row.student.status === "ACTIVE" ? "Active" : "Withdrawn")}
                    </div>
                  ))}
                </div>
              ) : <p className="admin-copy">{t("No linked students are recorded.")}</p>}
              <Link className="admin-secondary account-detail-link" href="/admin/families">{t("Manage families")}</Link>
            </section>
          ) : null}

          {user.role === "STUDENT" ? (
            <section className="account-detail-section">
              <h3>{t("Student record")}</h3>
              {family.student ? (
                <dl className="account-detail-facts">
                  <Fact label={t("Full name")} value={family.student.student.fullName} />
                  <Fact label={t("Student code")} value={family.student.student.studentCode} />
                  <Fact label={t("Class")} value={family.student.classSection.name} />
                  <Fact label={t("Academic years")} value={family.student.academicYear.name} />
                  <Fact label={t("Parent")} value={family.parent?.profile.fullName} />
                  <Fact label={t("Parent username")} value={family.parent?.user.username} />
                </dl>
              ) : <p className="admin-copy">{t("No linked student record was found.")}</p>}
              <Link className="admin-secondary account-detail-link" href="/admin/families">{t("Manage families")}</Link>
            </section>
          ) : null}

          {user.role === "TEACHER" ? (
            <section className="account-detail-section">
              <h3>{t("Teacher profile and assignments")}</h3>
              {academicLoading ? <p className="admin-copy" role="status">{t("Loading…")}</p> : null}
              {academicError ? <p className="admin-error" role="alert">{academicError}</p> : null}
              {!academicLoading && !academicError ? (
                <>
                  {teacher.profile ? (
                    <dl className="account-detail-facts">
                      <Fact label={t("Full name")} value={teacher.profile.fullName} />
                      <Fact label={t("Employee code")} value={teacher.profile.employeeCode} />
                      <Fact label={t("Phone")} value={teacher.profile.phone} />
                    </dl>
                  ) : <p className="admin-copy">{t("Teacher profile not yet created.")}</p>}
                  <h4>{t("Teacher assignments")} ({teacher.assignments.length})</h4>
                  {teacher.assignments.length ? (
                    <div className="account-detail-records">
                      {teacher.assignments.map((row, index) => (
                        <div className="account-detail-record" key={index}>
                          <strong>{row.subject}</strong>
                          <span>{row.className}</span>
                          <span>{row.year}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="admin-copy">{t("No teacher assignments recorded.")}</p>}
                  <h4>{t("Negaran assignments")} ({teacher.supervision.length})</h4>
                  {teacher.supervision.length ? (
                    <div className="account-detail-records">
                      {teacher.supervision.map((row, index) => (
                        <div className="account-detail-record" key={index}>
                          <strong>{row.className}</strong>
                          <span>{row.year}</span>
                          <span>{formatAccountDate(locale, row.startDate, true)} — {row.endDate ? formatAccountDate(locale, row.endDate, true) : t("Ongoing")}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="admin-copy">{t("No Negaran assignments recorded.")}</p>}
                </>
              ) : null}
              <Link className="admin-secondary account-detail-link" href="/admin/academics/teachers">{t("Manage teacher profile")}</Link>
              <Link className="admin-secondary account-detail-link" href="/admin/academics/assignments">{t("Manage teacher assignments")}</Link>
            </section>
          ) : null}

          {user.role === "SCHOOL_ADMIN" || user.role === "SCHOOL_STAFF" ? (
            <section className="account-detail-section">
              <h3>{t("Staff access")}</h3>
              <p className="admin-copy">{t("Staff and administrator access is managed through school accounts.")}</p>
              {isSelf && user.role === "SCHOOL_ADMIN" ? (
                <Link className="admin-secondary account-detail-link" href="/admin/profile">{t("Edit my administrator profile")}</Link>
              ) : null}
            </section>
          ) : null}

          <section className="account-detail-section account-detail-actions-section">
            <h3>{t("Account actions")}</h3>
            <div className="account-detail-actions">
              <button
                type="button" className="admin-secondary" disabled={busy || isSelf || user.status === "ARCHIVED"}
                onClick={() => onAction(user, "reset-password")}
              >{t("Reset password")}</button>
              {user.status === "SUSPENDED" ? (
                <button type="button" className="admin-secondary" disabled={busy} onClick={() => onAction(user, "reactivate")}>
                  {t("Reactivate")}
                </button>
              ) : (
                <button
                  type="button" className="admin-secondary" disabled={busy || isSelf || user.status === "ARCHIVED"}
                  onClick={() => onAction(user, "suspend")}
                >{t("Suspend")}</button>
              )}
            </div>
            {isSelf ? <p className="admin-field-hint">{t("Use Profile to change your own password.")}</p> : null}
          </section>
        </div>
      </aside>
    </div>,
    document.body
  );
}
