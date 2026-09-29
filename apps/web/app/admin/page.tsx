"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  adminApi,
  friendlyAdminError,
  loadAdminSession,
  saveAdminSession,
  type AdminToastState,
  type School,
  type Session
} from "./admin-client";
import {
  ADMIN_DEFAULT_LOCALE,
  adminDirection,
  adminLocaleOptions,
  adminText,
  readAdminLocale,
  saveAdminLocale,
  type AdminLocale
} from "./admin-i18n";

export default function AdminLoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<AdminLocale>(ADMIN_DEFAULT_LOCALE);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = (english: string) => adminText(locale, english);
  const selectedSchool = schools.find((school) => school.id === schoolId) ?? null;

  useEffect(() => {
    const preferred = readAdminLocale();
    setLocale(preferred);
    if (loadAdminSession()) {
      router.replace("/admin/accounts");
      return;
    }

    void adminApi<{ schools: School[] }>("/v1/public/schools")
      .then((result) => {
        setSchools(result.schools);
        setSchoolId(result.schools[0]?.id ?? "");
      })
      .catch((cause) =>
        showToast({
          kind: "error",
          title: t("School"),
          message: friendlyAdminError(cause, "Could not load schools. Please try again.")
        })
      );
  }, [router]);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : locale === "ps-AF" ? "ps" : "fa";
    document.documentElement.dir = adminDirection(locale);
  }, [locale]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
  }, []);

  function changeLocale(next: AdminLocale) {
    setLocale(next);
    saveAdminLocale(next);
  }

  function dismissToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setToastLeaving(true);
    exitTimer.current = setTimeout(() => {
      setToast(null);
      setToastLeaving(false);
    }, 220);
  }

  function showToast(next: AdminToastState) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setToastLeaving(false);
    setToast(next);
    if (next.kind === "success") {
      toastTimer.current = setTimeout(() => dismissToast(), 5000);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!selectedSchool) return;
    setBusy(true);
    try {
      const result = await adminApi<Session>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          schoolId,
          expectedRole: "SCHOOL_ADMIN",
          username,
          password
        })
      });
      setPassword("");
      if (result.mustChangePassword) {
        setSession(result);
        return;
      }
      saveAdminSession({ session: result, school: selectedSchool });
      router.push("/admin/accounts");
    } catch (cause) {
      showToast({
        kind: "error",
        title: t("Administrator access"),
        message: friendlyAdminError(cause, "Please check your school, username, and password, then try again.")
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeTemporaryPassword(event: FormEvent) {
    event.preventDefault();
    if (!session || !selectedSchool) return;
    setBusy(true);
    try {
      const result = await adminApi<Session>("/v1/auth/change-temporary-password", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ newPassword })
      });
      saveAdminSession({ session: result, school: selectedSchool });
      router.push("/admin/accounts");
    } catch (cause) {
      showToast({
        kind: "error",
        title: t("Choose a new password"),
        message: friendlyAdminError(cause, "Please review the new password and try again.")
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell admin-shell-premium admin-auth-shell" dir={adminDirection(locale)}>
      <section className="admin-auth-hero">
        <div className="admin-auth-brand">
          <span className="admin-brand-mark" aria-hidden="true">M</span>
          <div>
            <strong>MaktabLink</strong>
            <span>{t("School Administration")}</span>
          </div>
        </div>

        <div className="admin-login-language">
          <label>
            <span>{t("Language")}</span>
            <select value={locale} onChange={(event) => changeLocale(event.target.value as AdminLocale)}>
              {adminLocaleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-auth-copy">
          <span className="admin-kicker">{t(session ? "One-time setup" : "Private school workspace")}</span>
          <h1>{t(session ? "Create your private administrator password." : "Run the school day from one calm, secure workspace.")}</h1>
          <p>
            {t(
              session
                ? "The temporary credential has served its purpose. Your permanent password is stored only as a secure hash."
                : "Accounts, academics, families, attendance, learning, communication, fees, and pilot operations stay organized in one school-scoped dashboard."
            )}
          </p>
        </div>

        <div className="admin-auth-feature-grid" aria-label="Administration capabilities">
          <div><strong>{t("Tenant-safe")}</strong><span>{t("School-scoped access and data")}</span></div>
          <div><strong>{t("Role-based")}</strong><span>{t("Admin, staff, teacher, parent, student")}</span></div>
          <div><strong>{t("Audit-ready")}</strong><span>{t("Sensitive changes remain reviewable")}</span></div>
        </div>
      </section>

      <section className="admin-panel admin-login-panel admin-login-premium">
        {session ? (
          <>
            <div className="admin-login-heading">
              <span className="admin-kicker">{t("Secure your account")}</span>
              <h2>{t("Choose a new password")}</h2>
              <p>{t("Use at least 10 characters with letters and numbers.")}</p>
            </div>
            <form className="admin-form admin-form-premium" onSubmit={changeTemporaryPassword}>
              <label>
                {t("New password")}
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  minLength={10}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="admin-primary admin-primary-large" type="submit" disabled={busy}>
                {t(busy ? "Saving…" : "Save private password")}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="admin-login-heading">
              <span className="admin-kicker">{t("Administrator access")}</span>
              <h2>{t("Welcome back")}</h2>
              <p>{t("Select your school and sign in with the administrator credentials issued during provisioning.")}</p>
            </div>

            <form className="admin-form admin-form-premium" onSubmit={login}>
              <label>
                {t("School")}
                <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)} required>
                  <option value="">{t("Select a school")}</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name} · {school.code}</option>
                  ))}
                </select>
              </label>

              {selectedSchool ? (
                <div className="admin-login-school">
                  <SchoolAvatar school={selectedSchool} />
                  <div>
                    <strong>{selectedSchool.name}</strong>
                    <span>{selectedSchool.province} · {selectedSchool.code}</span>
                  </div>
                </div>
              ) : null}

              <label>
                {t("Username")}
                <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
              </label>
              <label>
                {t("Password")}
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("Enter your password")}
                  required
                />
              </label>
              <button className="admin-primary admin-primary-large" type="submit" disabled={busy || !schoolId}>
                {t(busy ? "Signing in…" : "Sign in to dashboard")}
              </button>
            </form>
            <p className="admin-login-footnote">{t("Access is restricted to your selected school and authenticated role.")}</p>
          </>
        )}
      </section>

      {toast ? <AdminToast toast={toast} leaving={toastLeaving} onDismiss={dismissToast} /> : null}
    </main>
  );
}

function SchoolAvatar({ school }: { school: School }) {
  const [failed, setFailed] = useState(false);
  if (school.imageUrl && !failed) {
    return <img className="admin-school-avatar admin-school-avatar-compact" src={school.imageUrl} alt="" onError={() => setFailed(true)} />;
  }
  return <span className="admin-school-avatar admin-school-avatar-compact admin-school-avatar-fallback">{school.name.slice(0, 1).toUpperCase()}</span>;
}

function AdminToast({
  toast,
  leaving,
  onDismiss
}: {
  toast: AdminToastState;
  leaving: boolean;
  onDismiss: () => void;
}) {
  return (
    <div className={`admin-toast admin-toast-${toast.kind} ${leaving ? "admin-toast-leaving" : ""}`} role={toast.kind === "error" ? "alert" : "status"}>
      <span className="admin-toast-icon" aria-hidden="true">{toast.kind === "success" ? "✓" : "!"}</span>
      <div><strong>{toast.title}</strong><p>{toast.message}</p></div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message">×</button>
    </div>
  );
}
