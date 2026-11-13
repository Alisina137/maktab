"use client";

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
import { AdminDashboardFrame } from "./admin-dashboard-frame";
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
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/academics", label: "Academics" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/families", label: "Families" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/learning", label: "Learning" },
  { href: "/admin/communication", label: "Communication & fees" },
  { href: "/admin/staff-work", label: "Staff work" },
  { href: "/admin/pilot", label: "Pilot operations" },
  { href: "/admin/profile", label: "Profile" }
] as const;

// Loading states describe the current workspace, not implementation phases.
const adminLoadingTextByRoute: Record<string, string> = {
  "/admin/dashboard": "Loading academics data…",
  "/admin/accounts": "Loading accounts data…",
  "/admin/staff-work": "Loading staff work…",
  "/admin/pilot": "Loading pilot operations data…",
  "/admin/pilot/adoption": "Loading usage & adoption data…",
  "/admin/pilot/service": "Loading service health data…",
  "/admin/pilot/oversight": "Loading operations oversight data…",
  "/admin/communication": "Loading communication & fees data…",
  "/admin/learning": "Loading learning data…",
  "/admin/attendance": "Loading attendance data…",
  "/admin/families": "Loading families data…",
  "/admin/registrations": "Loading registration requests…",
  "/admin/academics": "Loading academics data…",
  "/admin/profile": "Loading administrator profile data…"
};

function loadingTextForAdminRoute(pathname: string): string {
  // Match the most specific route first; /admin/pilot must not mask
  // /admin/pilot/oversight, /service, /adoption, etc.
  const section = Object.keys(adminLoadingTextByRoute)
    .sort((left, right) => right.length - left.length)
    .find(route => pathname === route || pathname.startsWith(`${route}/`));
  return section ? adminLoadingTextByRoute[section]! : "Loading accounts data…";
}

const yearScopedRoutes = new Set([
  "/admin/dashboard",
  "/admin/academics",
  "/admin/families",
  "/admin/attendance",
  "/admin/learning",
  "/admin/academics/classes",
  "/admin/academics/assignments",
  "/admin/academics/negaran",
  "/admin/academics/timetable",
  "/admin/academics/curriculum"
]);

const pageCopy: Record<string, { title: string; description: string }> = {
  "/admin/dashboard": {
    title: "School Dashboard",
    description: "An overview of your school's academic structure, teaching team and daily timetable."
  },
  "/admin/staff-work": {
    title: "Staff tasks & communication review",
    description: "Assign staff tasks and review staff-written communication drafts before publication."
  },
  "/admin/accounts": {
    title: "School accounts",
    description: "Create school staff identities, review account status, reset temporary credentials, and manage access."
  },
  "/admin/pilot": {
    title: "Pilot operations",
    description: "Review readiness, subscription access, school exports, import templates, and audit activity."
  },
  "/admin/pilot/readiness": { title: "Pilot operations", description: "Review readiness, subscription access, school exports, import templates, and audit activity." },
  "/admin/pilot/adoption": { title: "Pilot operations", description: "Review readiness, subscription access, school exports, import templates, and audit activity." },
  "/admin/pilot/service": { title: "Pilot operations", description: "Review readiness, subscription access, school exports, import templates, and audit activity." },
  "/admin/pilot/oversight": { title: "Pilot operations", description: "Review readiness, subscription access, school exports, import templates, and audit activity." },
  "/admin/pilot/onboarding": { title: "Pilot operations", description: "Review readiness, subscription access, school exports, import templates, and audit activity." },
  "/admin/pilot/subscription": { title: "Pilot operations", description: "Review readiness, subscription access, school exports, import templates, and audit activity." },
  "/admin/pilot/audit": { title: "Pilot operations", description: "Review readiness, subscription access, school exports, import templates, and audit activity." },
  "/admin/pilot/launch": { title: "Pilot operations", description: "Review readiness, subscription access, school exports, import templates, and audit activity." },
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
  "/admin/registrations": {
    title: "Enrollment approvals",
    description: "Review student registration requests and approve valid family and class placement."
  },
  "/admin/families": {
    title: "Families",
    description: "Manage parents, students, credentials, relationships, and bulk onboarding."
  },
  "/admin/academics": {
    title: "Academic Management",
    description: "Manage academic structure, classes, teachers, subjects and timetables for your school."
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
  "/admin/academics/curriculum": {
    title: "Curriculum units",
    description: "Define official subject chapters for the active school year. Teachers track their assigned progress."
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
  const sessionRefreshInFlight = useRef<Promise<StoredAdminSession | null> | null>(null);

  const t = useMemo(() => (english: string) => adminText(locale, english), [locale]);

  useEffect(() => {
    let cancelled = false;
    const session = loadAdminSession();
    const preferredLocale = readAdminLocale();
    setLocaleState(preferredLocale);

    if (!session) {
      router.replace("/admin");
      setReady(true);
      return;
    }

    const accessExpiresAt = session.session.accessExpiresAt
      ? Date.parse(session.session.accessExpiresAt)
      : Number.NaN;
    const shouldRefresh =
      !Number.isFinite(accessExpiresAt) || accessExpiresAt <= Date.now() + 90_000;

    if (!shouldRefresh) {
      setStored(session);
      setReady(true);
      return;
    }

    void refreshStoredSession(session).then((next) => {
      if (cancelled) return;
      if (next) setStored(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!stored) return;

    const checkAndRefresh = () => {
      const accessExpiresAt = stored.session.accessExpiresAt
        ? Date.parse(stored.session.accessExpiresAt)
        : Number.NaN;
      if (!Number.isFinite(accessExpiresAt) || accessExpiresAt <= Date.now() + 120_000) {
        void refreshStoredSession(stored);
      }
    };

    const interval = window.setInterval(checkAndRefresh, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkAndRefresh();
    };

    window.addEventListener("focus", checkAndRefresh);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkAndRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [stored?.session.refreshToken, stored?.session.accessExpiresAt]);

  useEffect(() => {
    if (!stored) return;
    void refreshAcademicYears();
    void refreshAdminProfile();
  }, [stored?.school.id, stored?.session.accessToken]);

  useEffect(() => {
    const root = document.documentElement;
    const previousLang = root.lang;
    const previousDir = root.dir;
    const direction = adminDirection(locale);
    root.lang = locale === "en" ? "en" : locale === "ps-AF" ? "ps" : "fa";
    root.dir = direction;
    // The Next.js root <html> survives client-side route changes. Restore
    // its previous values so a later English landing/staff page does not
    // inherit a stale RTL setting from this school-admin workspace.
    return () => {
      root.lang = previousLang;
      root.dir = previousDir;
    };
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

  async function refreshStoredSession(
    current: StoredAdminSession
  ): Promise<StoredAdminSession | null> {
    if (sessionRefreshInFlight.current) return sessionRefreshInFlight.current;

    const operation = (async () => {
      try {
        const session = await adminApi<Session>("/v1/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken: current.session.refreshToken })
        });
        const next = { ...current, session };
        saveAdminSession(next);
        setStored(next);
        return next;
      } catch (cause) {
        if (cause instanceof Error && "code" in cause) {
          const code = (cause as { code?: unknown }).code;
          if (code === "refresh_invalid" || code === "session_invalid" || code === "unauthorized") {
            clearAdminSession();
            setStored(null);
            router.replace("/admin");
            return null;
          }
        }
        return current;
      } finally {
        sessionRefreshInFlight.current = null;
      }
    })();

    sessionRefreshInFlight.current = operation;
    return operation;
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
        // The explicit year selection should survive refresh and page reload,
        // but must never bleed into another school's workspace.
        let previous = "";
        try { previous = window.sessionStorage.getItem(`maktablink.admin.academic-year:${stored.school.id}`) ?? ""; }
        catch { /* Private browsing may disallow web storage. */ }
        if (data.academicYears.some((year) => year.id === previous)) return previous;
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
    try { window.sessionStorage.setItem(`maktablink.admin.academic-year:${stored?.school.id}`, yearId); }
    catch { /* Continue with the in-memory selection. */ }
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
          <AdminLoader label={t(loadingTextForAdminRoute(pathname))} />
        </section>
      </main>
    );
  }

  const copy = pageCopy[pathname] ??
    (pathname.startsWith("/admin/learning/exams/") ? pageCopy["/admin/learning"] : undefined) ??
    pageCopy["/admin/accounts"]!;
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
      <AdminDashboardFrame pathname={pathname} title={copy.title}
        description={copy.description}
        yearScoped={yearScopedRoutes.has(pathname) || pathname.startsWith("/admin/learning/exams/")}
        navItems={navItems}>
        {children}
        {toast ? <AdminToast toast={toast} leaving={toastLeaving} onDismiss={dismissToast} /> : null}
      </AdminDashboardFrame>
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
