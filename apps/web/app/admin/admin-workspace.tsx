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

export type AdminAcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
};

export type AdminHeaderProfile = {
  fullName: string;
  imageUrl: string | null;
};

type AdminWorkspaceContextValue = {
  stored: StoredAdminSession;
  locale: AdminLocale;
  t: (english: string) => string;
  setLocale: (locale: AdminLocale) => void;
  showToast: (toast: AdminToastState) => void;
  updateSession: (session: Session) => void;
  adminProfile: AdminHeaderProfile;
  refreshAdminProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  academicYears: AdminAcademicYear[];
  selectedAcademicYearId: string;
  selectedAcademicYear: AdminAcademicYear | null;
  setSelectedAcademicYearId: (yearId: string) => void;
  refreshAcademicYears: () => Promise<void>;
};

const AdminWorkspaceContext = createContext<AdminWorkspaceContextValue | null>(null);

const navItems = [
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/pilot", label: "Pilot operations" },
  { href: "/admin/communication", label: "Communication & fees" },
  { href: "/admin/learning", label: "Learning" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/families", label: "Families" },
  { href: "/admin/academics", label: "Academics" }
] as const;

const yearScopedRoutes = new Set([
  "/admin/academics",
  "/admin/families",
  "/admin/attendance",
  "/admin/learning",
  "/admin/academics/classes",
  "/admin/academics/assignments",
  "/admin/academics/negaran",
  "/admin/academics/timetable"
]);

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
  "/admin/academics/years": {
    title: "Academic years",
    description: "Create academic years and manage lifecycle, archive, unarchive, and safe deletion."
  },
  "/admin/academics/grades": {
    title: "Grade levels",
    description: "Create, edit, and safely delete reusable grade definitions."
  },
  "/admin/academics/subjects": {
    title: "Subjects",
    description: "Create, edit, and safely delete the school subject catalog."
  },
  "/admin/academics/classes": {
    title: "Classes",
    description: "Create and manage class sections for the selected academic year."
  },
  "/admin/academics/teachers": {
    title: "Teacher profiles",
    description: "Create and maintain academic profiles attached to teacher accounts."
  },
  "/admin/academics/assignments": {
    title: "Teacher assignments",
    description: "Manage teacher, subject, and class assignments for the selected academic year."
  },
  "/admin/academics/negaran": {
    title: "Negaran assignments",
    description: "Manage class-supervisor assignments and their date history."
  },
  "/admin/academics/timetable": {
    title: "Timetable periods",
    description: "Create and maintain timetable periods and weekly teacher/class views."
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
  const [adminProfile, setAdminProfile] = useState<AdminHeaderProfile>({
    fullName: "",
    imageUrl: null
  });
  const [academicYears, setAcademicYears] = useState<AdminAcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearIdState] = useState("");
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
    if (!stored) return;
    void refreshAcademicYears();
    void refreshAdminProfile();
  }, [stored?.school.id]);

  useEffect(() => {
    const direction = adminDirection(locale);
    document.documentElement.lang = locale === "en" ? "en" : locale === "ps-AF" ? "ps" : "fa";
    document.documentElement.dir = direction;
  }, [locale]);

  useEffect(() => {
    if (!ready || !stored) return;

    const root = document.querySelector<HTMLElement>(".admin-workspace");
    if (!root) return;
    const workspaceRoot = root;

    const pendingButtons = new Set<HTMLButtonElement>();
    const fallbackTimers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();

    function clearPending(button: HTMLButtonElement) {
      const timer = fallbackTimers.get(button);
      if (timer) clearTimeout(timer);
      fallbackTimers.delete(button);
      pendingButtons.delete(button);
      delete button.dataset.adminPending;
      button.removeAttribute("aria-busy");
    }

    function markPending(button: HTMLButtonElement) {
      if (button.disabled || button.dataset.adminNoLoading === "true") return;

      const existingTimer = fallbackTimers.get(button);
      if (existingTimer) clearTimeout(existingTimer);

      button.dataset.adminPending = "true";
      button.setAttribute("aria-busy", "true");
      pendingButtons.add(button);

      // Most admin actions disable their trigger immediately after setting busy=true.
      // If a clicked control turns out to be synchronous (Edit, tabs, etc.), remove
      // the marker before any loading treatment becomes visible.
      fallbackTimers.set(
        button,
        setTimeout(() => {
          if (!button.disabled) clearPending(button);
        }, 160)
      );
    }

    function buttonFromTarget(target: EventTarget | null) {
      return target instanceof Element ? target.closest<HTMLButtonElement>("button") : null;
    }

    function handleClick(event: MouseEvent) {
      const button = buttonFromTarget(event.target);
      if (!button || !workspaceRoot.contains(button)) return;
      markPending(button);
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !workspaceRoot.contains(form)) return;

      const submitter = event.submitter;
      if (submitter instanceof HTMLButtonElement) {
        markPending(submitter);
        return;
      }

      const fallback = form.querySelector<HTMLButtonElement>('button[type="submit"]:not(:disabled)');
      if (fallback) markPending(fallback);
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "attributes" || mutation.attributeName !== "disabled") continue;
        const button = mutation.target;
        if (!(button instanceof HTMLButtonElement) || !pendingButtons.has(button)) continue;
        if (!button.disabled) clearPending(button);
      }

      for (const button of pendingButtons) {
        if (!button.isConnected) clearPending(button);
      }
    });

    workspaceRoot.addEventListener("click", handleClick, true);
    workspaceRoot.addEventListener("submit", handleSubmit, true);
    observer.observe(workspaceRoot, {
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
      childList: true
    });

    return () => {
      workspaceRoot.removeEventListener("click", handleClick, true);
      workspaceRoot.removeEventListener("submit", handleSubmit, true);
      observer.disconnect();
      for (const timer of fallbackTimers.values()) clearTimeout(timer);
      for (const button of pendingButtons) {
        delete button.dataset.adminPending;
        button.removeAttribute("aria-busy");
      }
      pendingButtons.clear();
      fallbackTimers.clear();
    };
  }, [ready, stored?.school.id]);

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

  async function refreshAdminProfile() {
    if (!stored) return;
    try {
      const data = await adminApi<{ profile: AdminHeaderProfile }>("/v1/admin/profile", {
        headers: { Authorization: `Bearer ${stored.session.accessToken}` }
      });
      setAdminProfile({
        fullName: data.profile.fullName?.trim() || stored.session.user.username,
        imageUrl: data.profile.imageUrl ?? null
      });
    } catch {
      setAdminProfile({
        fullName: stored.session.user.username,
        imageUrl: null
      });
    }
  }

  async function refreshAcademicYears() {
    if (!stored) return;
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${stored.session.accessToken}`);
    try {
      const data = await adminApi<{ academicYears: AdminAcademicYear[] }>("/v1/admin/academics", { headers });
      setAcademicYears(data.academicYears);
      setSelectedAcademicYearIdState((current) => {
        if (current && data.academicYears.some((year) => year.id === current)) return current;
        return (
          data.academicYears.find((year) => year.status === "ACTIVE")?.id ??
          [...data.academicYears].reverse().find((year) => year.status !== "ARCHIVED")?.id ??
          data.academicYears.at(-1)?.id ??
          ""
        );
      });
    } catch {
      setAcademicYears([]);
      setSelectedAcademicYearIdState("");
    }
  }

  function setSelectedAcademicYearId(yearId: string) {
    if (!academicYears.some((year) => year.id === yearId)) return;
    setSelectedAcademicYearIdState(yearId);
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
  const selectedAcademicYear =
    academicYears.find((year) => year.id === selectedAcademicYearId) ?? null;

  return (
    <AdminWorkspaceContext.Provider value={{
      stored,
      locale,
      t,
      setLocale: changeLocale,
      showToast,
      updateSession,
      adminProfile: {
        fullName: adminProfile.fullName || stored.session.user.username,
        imageUrl: adminProfile.imageUrl
      },
      refreshAdminProfile,
      signOut,
      academicYears,
      selectedAcademicYearId,
      selectedAcademicYear,
      setSelectedAcademicYearId,
      refreshAcademicYears
    }}>
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
              <div className="admin-header-language-control">
                <select
                  aria-label={t("Language")}
                  value={locale}
                  onChange={(event) => changeLocale(event.target.value as AdminLocale)}
                >
                  {adminLocaleOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <Link
                className="admin-header-profile-link"
                href="/admin/profile"
                aria-label={t("Administrator profile")}
              >
                <AdminHeaderAvatar
                  fullName={adminProfile.fullName || stored.session.user.username}
                  imageUrl={adminProfile.imageUrl}
                />
                <span>{firstName(adminProfile.fullName || stored.session.user.username)}</span>
              </Link>
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
            const active =
              pathname === item.href ||
              (item.href === "/admin/academics" && pathname.startsWith("/admin/academics/"));
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
          <div>
            <span className="admin-kicker">{t("School Administration")}</span>
            <h2>{t(copy.title)}</h2>
            <p>{t(copy.description)}</p>
          </div>
          {yearScopedRoutes.has(pathname) && academicYears.length > 0 ? (
            <label className="admin-language-control admin-year-context-control">
              <span>{t("Academic year context")}</span>
              <select
                value={selectedAcademicYearId}
                onChange={(event) => setSelectedAcademicYearId(event.target.value)}
              >
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name} · {t(year.status)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function AdminHeaderAvatar({
  fullName,
  imageUrl
}: {
  fullName: string;
  imageUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (imageUrl && !failed) {
    return (
      <img
        className="admin-header-profile-avatar"
        src={imageUrl}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="admin-header-profile-avatar admin-header-profile-avatar-fallback" aria-hidden="true">
      {fullName.slice(0, 1).toUpperCase()}
    </span>
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
