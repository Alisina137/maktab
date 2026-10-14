"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { AdminLocale } from "./admin-i18n";
import { adminFormat } from "./admin-i18n";

export function AdminAccountBulkConfirm({
  action, names, busy, locale, t, onCancel, onConfirm
}: {
  action: "suspend" | "reactivate";
  names: string[];
  busy: boolean;
  locale: AdminLocale;
  t: (english: string) => string;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const close = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); onCancel(); }
      if (event.key !== "Tab" || !card.current) return;
      const els = Array.from(card.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled),textarea:not(:disabled)'
      )).filter((el) => el.getClientRects().length > 0);
      const first = els[0], last = els[els.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [onCancel]);

  const invalidReason = reason.trim().length > 0 && reason.trim().length < 3;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy && !invalidReason && names.length > 0) onConfirm(action === "suspend" ? reason.trim() || undefined : undefined);
  }
  return createPortal(
    <div className="admin-account-confirm-layer" dir={locale === "en" ? "ltr" : "rtl"}>
      <div className="admin-account-confirm-backdrop" aria-hidden="true" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="account-bulk-title"
        aria-describedby="account-bulk-description" className="admin-account-confirm-card" ref={card}>
        <div className="admin-account-confirm-icon" aria-hidden="true">!</div>
        <h2 id="account-bulk-title">{t(action === "suspend" ? "Confirm bulk suspension" : "Confirm bulk reactivation")}</h2>
        <p id="account-bulk-description">
          {adminFormat(locale, "This will update {count} selected accounts. Changes are all-or-nothing.", { count: names.length })}
          {" "}
          {t("Existing sessions will be revoked. Users must sign in again.")}
        </p>
        <div className="account-bulk-preview" role="region" aria-label={t("Selected accounts")}>
          {names.map((name) => <span dir="auto" key={name}>{name}</span>)}
        </div>
        <form className="admin-account-confirm-form" onSubmit={submit}>
          {action === "suspend" ? <label>
            {t("Suspension reason (optional)")}
            <textarea rows={3} value={reason} maxLength={500}
              aria-invalid={invalidReason}
              onChange={(event) => setReason(event.target.value)} />
            <span className={invalidReason ? "admin-account-confirm-error" : "admin-field-hint"}>
              {t(invalidReason
                ? "If provided, the reason must be at least three characters."
                : "Reason is recorded in account history; do not include secrets.")}
            </span>
          </label> : null}
          <div className="admin-account-confirm-actions">
            <button ref={close} type="button" className="admin-secondary" disabled={busy} onClick={onCancel}>
              {t("Cancel")}
            </button>
            <button type="submit" disabled={busy || invalidReason || names.length === 0}
              className={action === "suspend" ? "admin-account-confirm-danger" : "admin-primary"}>
              {t(busy ? "Working…" : action === "suspend" ? "Suspend selected" : "Reactivate selected")}
            </button>
          </div>
        </form>
      </div>
    </div>, document.body
  );
}
