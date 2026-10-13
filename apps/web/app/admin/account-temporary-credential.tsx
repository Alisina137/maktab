"use client";

import { useEffect, useRef, useState } from "react";

export type TemporaryAccountCredential = {
  username: string;
  password: string;
};

export function AccountTemporaryCredentialPanel({
  credential,
  t,
  onClose,
  onCopyError
}: {
  credential: TemporaryAccountCredential;
  t: (value: string) => string;
  onClose: () => void;
  onCopyError: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<"username" | "password" | null>(null);
  const focusRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    focusRef.current?.focus();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy(field: "username" | "password") {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(field === "username" ? credential.username : credential.password);
      if (timer.current) clearTimeout(timer.current);
      setCopiedField(field);
      timer.current = setTimeout(() => setCopiedField(null), 2_800);
    } catch {
      onCopyError();
    }
  }

  return (
    <section
      className="credential-card credential-card-premium account-credential-panel"
      aria-labelledby="account-credential-title"
      tabIndex={-1}
      ref={focusRef}
    >
      <div className="credential-heading account-credential-heading">
        <span className="credential-icon" aria-hidden="true">✓</span>
        <div>
          <strong id="account-credential-title">{t("Temporary credential created")}</strong>
          <p>{t("This temporary password is shown only once. Copy it securely before closing this panel.")}</p>
        </div>
        <button className="admin-secondary account-credential-close" type="button" onClick={onClose}>
          {t("Close")}
        </button>
      </div>
      <div className="credential-values account-credential-values">
        <div className="account-credential-field">
          <span>{t("Username")}</span>
          <code dir="ltr">{credential.username}</code>
          <button className="admin-secondary" type="button" onClick={() => void copy("username")}>
            {t("Copy username")}
          </button>
        </div>
        <div className="account-credential-field">
          <span>{t("Temporary password")}</span>
          <code id="account-temporary-password" dir="ltr" aria-label={t(revealed ? "Temporary password visible" : "Temporary password hidden")}>
            {revealed ? credential.password : "••••••••••••"}
          </code>
          <div className="account-credential-controls">
            <button className="admin-secondary" type="button" aria-pressed={revealed} aria-controls="account-temporary-password" onClick={() => setRevealed((value) => !value)}>
              {t(revealed ? "Hide password" : "Show password")}
            </button>
            <button className="admin-secondary" type="button" onClick={() => void copy("password")}>
              {t("Copy password")}
            </button>
          </div>
        </div>
      </div>
      <p className="account-credential-warning">{t("The user must change this password on first login. The clipboard may retain copied passwords.")}</p>
      {copiedField ? (
        <p className="account-credential-copied" role="status">
          {t(copiedField === "username" ? "Username copied." : "Password copied. Share it securely.")}
        </p>
      ) : null}
    </section>
  );
}
