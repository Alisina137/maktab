"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  adminApi,
  clearAdminSession,
  friendlyAdminError,
  loadAdminSession,
  saveAdminSession,
  type AdminToastState,
  type Session,
  type StoredAdminSession
} from "./admin-client";
import { ADMIN_ERROR_DURATION_MS, ADMIN_SUCCESS_DURATION_MS } from "./admin-feedback";
import { AdminLoader } from "./admin-loader";
import {
  ADMIN_DEFAULT_LOCALE,
  adminDirection,
  adminLocaleOptions,
  adminText,
  readAdminLocale,
  saveAdminLocale,
  type AdminLocale
} from "./admin-i18n";

type AdminWorkspaceContextValue = {
  stored: StoredAdminSession;
  locale: AdminLocale;
  t: (english: string) => string;
  setLocale: (locale: AdminLocale) => void;
  showToast: (toast: AdminToastState) => void;
  updateSession: (session: Session) => void;
};

const AdminWorkspaceContext = createContext<AdminWorkspaceContextValue | null>(null);

const navItems = [
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/pilot", label: "Pilot operations" },
  { href: "/admin/communication", label: "Communication & fees" },
  { href: "/admin/learning", label: "Learning" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/families", label: "Families" },
  { href: "/admin/academics", label: "Academics" },
  { href: "/admin/profile", label: "Profile" }
] as const;

const pageCopy: Record<string, { title: string; description: string }> = {
  "/admin/accounts": {
    title: "School accounts",
    description: "Create school staff identities, review account status, reset temporary credentials, and manage access."
  },
  "/admin/pilot": {
    title: "Pilot operations",
    description: "Review readiness, subscription access, school exports, import templates, and audit activity."
  },
  "/admin/communication": {
    title: "Communication & fees",
    description: "Manage school announcements, fee invoices, payments, reminders, and reversals."
  },
  "/admin/learning": {
    title: "Learning",
    description: "Manage exams, result publication, grade corrections, and learning workflows."
  },
  "/admin/attendance": {
    title: "Attendance",
    description: "Review class attendance records and school-level attendance activity."
  },
  "/admin/families": {
    title: "Families",
    description: "Manage parents, students, credentials, relationships, and bulk onboarding."
  },
  "/admin/academics": {
    title: "Academics",
    description: "Manage academic years, grades, classes, subjects, teachers, assignments, Negaran, and timetable."
  },
  "/admin/profile": {
    title: "Administrator profile",
    description: "Edit the profile information shown for your administrator account."
  }
};

export function AdminWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [stored, setStored] = useState<StoredAdminSession | null>(null);
  const [locale, setLocaleState] = useState<AdminLocale>(ADMIN_DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = useMemo(() => (english: string) => adminText(locale, english), [locale]);

  useEffect(() => {
    const session = loadAdminSession();
    const preferredLocale = readAdminLocale();
    setLocaleState(preferredLocale);

    if (!session) {
      router.replace("/admin");
      setReady(true);
      return;
    }

    setStored(session);
    setReady(true);
  }, [router]);

  useEffect(() => {
    const direction = adminDirection(locale);
    document.documentElement.lang = locale === "en" ? "en" : locale === "ps-AF" ? "ps" : "fa";
    document.documentElement.dir = direction;
  }, [locale]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

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
    toastTimer.current = setTimeout(
      () => dismissToast(),
      next.kind === "success" ? ADMIN_SUCCESS_DURATION_MS : ADMIN_ERROR_DURATION_MS
    );
  }

  function updateSession(session: Session) {
    if (!stored) return;
    const next = { ...stored, session };
    setStored(next);
    saveAdminSession(next);
  }

  function changeLocale(next: AdminLocale) {
    setLocaleState(next);
    saveAdminLocale(next);
  }

  async function signOut() {
    if (stored) {
      try {
        await adminApi("/v1/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: stored.session.refreshToken })
        });
      } catch (cause) {
        showToast({
          kind: "error",
          title: t("Sign out"),
          message: friendlyAdminError(cause, "The local admin session will still be cleared.", locale)
        });
      }
    }

    clearAdminSession();
    router.replace("/admin");
  }

  if (!ready || !stored) {
    return (
      <main className="admin-shell admin-shell-premium admin-route-loading" dir={adminDirection(locale)}>
        <section className="admin-panel admin-route-loading-panel">
          <AdminLoader label={t("Loading…")} />
        </section>
      </main>
    );
  }

  const copy = pageCopy[pathname] ?? pageCopy["/admin/accounts"]!;

  return (
    <AdminWorkspaceContext.Provider value={{ stored, locale, t, setLocale: changeLocale, showToast, updateSession }}>
      <main className="admin-shell admin-shell-premium admin-workspace" dir={adminDirection(locale)}>
        <header className="admin-premium-header">
          <div className="admin-premium-brand-row">
            <div className="admin-auth-brand admin-auth-brand-dark">
              <span className="admin-brand-mark" aria-hidden="true">M</span>
              <div>
                <strong>MaktabLink</strong>
                <span>{t("School Administration")}</span>
              </div>
            </div>

            <div className="admin-header-actions admin-header-actions-premium">
              <label className="admin-language-control">
                <span>{t("Language")}</span>
                <select value={locale} onChange={(event) => changeLocale(event.target.value as AdminLocale)}>
                  {adminLocaleOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <Link className="admin-profile-link" href="/admin/profile">
                {t("Profile")}
              </Link>
              <button className="admin-secondary" onClick={() => void signOut()}>{t("Sign out")}</button>
            </div>
          </div>

          <div className="admin-school-hero admin-school-hero-route">
            <div className="admin-school-identity">
              <SchoolAvatar school={stored.school} />
              <div>
                <span className="admin-kicker">{t("School workspace")}</span>
                <h1>{stored.school.name}</h1>
                <p>{stored.school.province} · {stored.school.city} · {t("School code")} {stored.school.code}</p>
              </div>
            </div>
            <div className="admin-session-pill">
              <span className="admin-live-dot" aria-hidden="true" />
              {t("Signed in as")} {stored.session.user.username}
            </div>
          </div>
        </header>

        <nav className="admin-route-nav" aria-label="Administration sections">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "admin-route-nav-link admin-route-nav-link-active" : "admin-route-nav-link"}
                aria-current={active ? "page" : undefined}
              >
                {t(item.label)}
              </Link>
            );
          })}
        </nav>

        <section className="admin-route-heading">
          <span className="admin-kicker">{t("School Administration")}</span>
          <h2>{t(copy.title)}</h2>
          <p>{t(copy.description)}</p>
        </section>

        <section className="admin-route-content">{children}</section>

        {toast ? (
          <AdminToast toast={toast} leaving={toastLeaving} onDismiss={dismissToast} />
        ) : null}
      </main>
    </AdminWorkspaceContext.Provider>
  );
}

export function useAdminWorkspace() {
  const value = useContext(AdminWorkspaceContext);
  if (!value) throw new Error("useAdminWorkspace must be used inside AdminWorkspaceShell.");
  return value;
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
    <div
      className={`admin-toast admin-toast-${toast.kind} ${leaving ? "admin-toast-leaving" : ""}`}
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <span className="admin-toast-icon" aria-hidden="true">{toast.kind === "success" ? "✓" : "!"}</span>
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message">×</button>
    </div>
  );
}

function SchoolAvatar({ school }: { school: StoredAdminSession["school"] }) {
  const [failed, setFailed] = useState(false);

  if (school.imageUrl && !failed) {
    return <img className="admin-school-avatar" src={school.imageUrl} alt="" onError={() => setFailed(true)} />;
  }

  return (
    <span className="admin-school-avatar admin-school-avatar-fallback" aria-hidden="true">
      {school.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
