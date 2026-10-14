"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { User } from "./admin-client";
import type { AdminLocale } from "./admin-i18n";

export type AccountSecurityAction = "reset-password" | "suspend" | "reactivate";
export type AccountPendingAction = { user: User; action: AccountSecurityAction };

export function AdminAccountActionConfirm({
  pending, busy, locale, t, onCancel, onConfirm
}: {
  pending: AccountPendingAction;
  busy: boolean;
  locale: AdminLocale;
  t: (english: string) => string;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const title = pending.action === "reset-password"
    ? "Confirm password reset"
    : pending.action === "suspend" ? "Confirm suspension" : "Confirm reactivation";
  const details = pending.action === "reset-password"
    ? "The current password will stop working. All sessions will be signed out and a new one-time password will be generated."
    : pending.action === "suspend"
      ? "Access will be blocked and all existing sessions revoked. The user must sign in again when the account is reactivated."
      : "This account can sign in again after reactivation. Existing sessions will remain invalid.";
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onCancel();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),textarea:not([disabled]),input:not([disabled])'
      )).filter((el) => el.getClientRects().length > 0);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [onCancel, busy]);

  const reasonInvalid = reason.trim().length > 0 && reason.trim().length < 3;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || reasonInvalid) return;
    onConfirm(pending.action === "suspend" ? reason.trim() || undefined : undefined);
  }

  return createPortal(
    <div className="admin-account-confirm-layer" dir={locale === "en" ? "ltr" : "rtl"}>
      <div className="admin-account-confirm-backdrop" aria-hidden="true" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="admin-account-confirm-title"
        aria-describedby="admin-account-confirm-description" className="admin-account-confirm-card" ref={dialogRef}>
        <div className="admin-account-confirm-icon" aria-hidden="true">!</div>
        <h2 id="admin-account-confirm-title">{t(title)}</h2>
        <p className="admin-account-confirm-subject">{pending.user.profile?.fullName || pending.user.username} · <bdi dir="ltr">@{pending.user.username}</bdi></p>
        <p id="admin-account-confirm-description">{t(details)}</p>
        <form onSubmit={submit} className="admin-account-confirm-form">
          {pending.action === "suspend" ? (
            <label>
              {t("Suspension reason (optional)")}
              <textarea maxLength={500} rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={t("Enter a short reason for the audit history")} aria-invalid={reasonInvalid}
                aria-describedby="admin-account-reason-hint" />
              <span id="admin-account-reason-hint" className={reasonInvalid ? "admin-account-confirm-error" : "admin-field-hint"}>
                {t(reasonInvalid ? "If provided, the reason must be at least three characters." : "Reason is recorded in account history; do not include secrets.")}
              </span>
            </label>
          ) : null}
          <div className="admin-account-confirm-actions">
            <button type="button" className="admin-secondary" ref={closeRef} disabled={busy} onClick={onCancel}>
              {t("Cancel")}
            </button>
            <button type="submit" className={pending.action === "suspend" ? "admin-account-confirm-danger" : "admin-primary"}
              disabled={busy || reasonInvalid}>
              {t(busy ? "Working…" : pending.action === "reset-password" ? "Reset password" : pending.action === "suspend" ? "Suspend account" : "Reactivate")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
