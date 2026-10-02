import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  getDirection,
  supportedLocales,
  translate,
  type SupportedLocale,
  type TranslationKey
} from "@maktablink/localization";
import {
  ApiRequestError,
  api,
  isNetworkApiError,
  setPreferCachedReads,
  setSessionRefreshHandler,
  type AdminContactPayload,
  type AnnouncementPayload,
  type AttendanceSheetPayload,
  type AttendanceStatus,
  type FeeInvoiceViewPayload,
  type LearnerAcademicPayload,
  type ParentAttendanceDay,
  type ParentHomePayload,
  type ParentNotification,
  type ParentTimetablePeriod,
  type SchoolOption,
  type SessionPayload,
  type TeacherTodayPayload
} from "./src/api";
import { AdminContactCard } from "./src/admin-contact-card";
import { CommunicationPanel } from "./src/communication-ui";
import { LearnerLearningPanel, TeacherLearningPanel } from "./src/learning-ui";
import { ParentDashboardPanel } from "./src/parent-dashboard";
import {
  ParentAnnouncementsContent,
  ParentBottomNavigation,
  ParentHomeworkContent,
  ParentMoreAcademicContent,
  type ParentTab
} from "./src/parent-navigation";
import { deactivatePushForSession, registerPushForSession } from "./src/push";
import { appErrorFromCause, type AppErrorKind } from "./src/error-message";
import {
  setReadCacheFallbackListener,
  setReadCacheScope
} from "./src/read-cache";
import {
  clearStoredSession,
  loadPreferredParentChild,
  loadStoredSession,
  savePreferredParentChild,
  saveStoredSession
} from "./src/session";

type MobileRole = "PARENT" | "TEACHER" | "STUDENT";
type Screen = "role" | "school" | "login" | "change-password" | "home" | "teacher-attendance";

const roleKey: Record<MobileRole, "role.parent" | "role.teacher" | "role.student"> = {
  PARENT: "role.parent",
  TEACHER: "role.teacher",
  STUDENT: "role.student"
};

const roleHintKey: Record<MobileRole, "role.parentHint" | "role.teacherHint" | "role.studentHint"> = {
  PARENT: "role.parentHint",
  TEACHER: "role.teacherHint",
  STUDENT: "role.studentHint"
};

const loginGreetingKey: Record<
  MobileRole,
  "login.greetingParent" | "login.greetingTeacher" | "login.greetingStudent"
> = {
  PARENT: "login.greetingParent",
  TEACHER: "login.greetingTeacher",
  STUDENT: "login.greetingStudent"
};

const roleIcon: Record<MobileRole, keyof typeof Ionicons.glyphMap> = {
  PARENT: "people-outline",
  TEACHER: "school-outline",
  STUDENT: "book-outline"
};

const attendanceStatuses: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

const languageLabel: Record<SupportedLocale, string> = {
  "fa-AF": "دری",
  "ps-AF": "پښتو",
  en: "English"
};

const attendanceKey: Record<AttendanceStatus, TranslationKey> = {
  PRESENT: "attendance.present",
  ABSENT: "attendance.absent",
  LATE: "attendance.late",
  EXCUSED: "attendance.excused"
};

function passwordValidationError(value: string): TranslationKey | null {
  if (value.length < 8) return "passwordChange.tooShort";
  if (!/[A-Za-z]/.test(value)) return "passwordChange.missingLetter";
  if (!/[0-9]/.test(value)) return "passwordChange.missingNumber";
  if (!/[^A-Za-z0-9\s]/.test(value)) return "passwordChange.missingSpecial";
  return null;
}

function screenForSession(next: SessionPayload): Screen {
  if (next.user.status === "SUSPENDED") return "home";
  return next.mustChangePassword ? "change-password" : "home";
}


function AppContent() {
  const [locale, setLocale] = useState<SupportedLocale>("fa-AF");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("role");
  const [role, setRole] = useState<MobileRole | null>(null);
  const [school, setSchool] = useState<SchoolOption | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [parentHome, setParentHome] = useState<ParentHomePayload | null>(null);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [parentTab, setParentTab] = useState<ParentTab>("HOME");
  const [parentAttendance, setParentAttendance] = useState<ParentAttendanceDay[]>([]);
  const [parentToday, setParentToday] = useState("");
  const [parentTimetable, setParentTimetable] = useState<ParentTimetablePeriod[]>([]);
  const [parentTimetableReady, setParentTimetableReady] = useState(false);
  const [parentLearning, setParentLearning] = useState<LearnerAcademicPayload | null>(null);
  const [parentAnnouncements, setParentAnnouncements] = useState<AnnouncementPayload[]>([]);
  const [parentFees, setParentFees] = useState<FeeInvoiceViewPayload[]>([]);
  const [parentCommunicationReady, setParentCommunicationReady] = useState(false);
  const [parentNotifications, setParentNotifications] = useState<ParentNotification[]>([]);
  const [teacherToday, setTeacherToday] = useState<TeacherTodayPayload | null>(null);
  const [adminContact, setAdminContact] = useState<AdminContactPayload | null>(null);
  const [attendanceSheet, setAttendanceSheet] = useState<AttendanceSheetPayload | null>(null);
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, AttendanceStatus>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [errorKind, setErrorKind] = useState<AppErrorKind | null>(null);
  const [errorMinimized, setErrorMinimized] = useState(false);
  const [retryingConnection, setRetryingConnection] = useState(false);
  const [errorExitRequested, setErrorExitRequested] = useState(false);
  const [connectionRecovered, setConnectionRecovered] = useState(false);
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const errorKeyRef = useRef<TranslationKey | null>(null);
  const errorKindRef = useRef<AppErrorKind | null>(null);
  const schoolSearchRequestId = useRef(0);
  const parentChildLoadRequestId = useRef(0);
  const selectedChildIdRef = useRef("");
  const sessionRef = useRef<SessionPayload | null>(null);
  const schoolRef = useRef<SchoolOption | null>(null);
  const sessionRefreshPromiseRef = useRef<Promise<SessionPayload | null> | null>(null);
  const onboardingScrollRef = useRef<ScrollView>(null);
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslate = useRef(new Animated.Value(0)).current;
  const childOpacity = useRef(new Animated.Value(1)).current;
  const childScale = useRef(new Animated.Value(1)).current;

  const passwordChecks = [
    { key: "passwordChange.ruleLength" as TranslationKey, passed: newPassword.length >= 8 },
    { key: "passwordChange.ruleLetter" as TranslationKey, passed: /[A-Za-z]/.test(newPassword) },
    { key: "passwordChange.ruleNumber" as TranslationKey, passed: /[0-9]/.test(newPassword) },
    { key: "passwordChange.ruleSpecial" as TranslationKey, passed: /[^A-Za-z0-9\s]/.test(newPassword) }
  ];

  const direction = getDirection(locale);
  const textDirection = useMemo(
    () => ({
      textAlign: direction === "rtl" ? ("right" as const) : ("left" as const),
      writingDirection: direction
    }),
    [direction]
  );

  useEffect(() => {
    void restore();
  }, []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    selectedChildIdRef.current = selectedChildId;
  }, [selectedChildId]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    schoolRef.current = school;
  }, [school]);

  useEffect(() => {
    if (session?.user.role === "PARENT") {
      setParentTab("HOME");
    }
  }, [session?.user.id]);

  async function refreshActiveSession(): Promise<SessionPayload | null> {
    if (sessionRefreshPromiseRef.current) return sessionRefreshPromiseRef.current;

    const activeSession = sessionRef.current;
    const activeSchool = schoolRef.current;
    if (!activeSession || !activeSchool) return null;

    const promise = (async () => {
      try {
        const refreshed = await api.refresh(activeSession.refreshToken);

        // Ignore a refresh result if the user logged out or changed accounts while it was in flight.
        if (
          sessionRef.current?.user.id !== activeSession.user.id ||
          schoolRef.current?.id !== activeSchool.id
        ) {
          return null;
        }

        sessionRef.current = refreshed;
        setSession(refreshed);
        setReadCacheScope(`${activeSchool.id}:${refreshed.user.id}`);
        setPreferCachedReads(false);
        await saveStoredSession({ auth: refreshed, school: activeSchool });

        if (errorKeyRef.current === "common.sessionExpired") {
          setAppError(null);
        }

        return refreshed;
      } catch (cause) {
        if (isNetworkApiError(cause)) {
          setPreferCachedReads(true);
          return null;
        }

        if (
          cause instanceof ApiRequestError &&
          cause.code === "school_service_unavailable"
        ) {
          await moveToServiceUnavailableLogin();
          return null;
        }

        if (
          cause instanceof ApiRequestError &&
          (cause.code === "refresh_invalid" || cause.code === "session_invalid")
        ) {
          await clearStoredSession();
          setReadCacheScope(null);
          setPreferCachedReads(false);
          sessionRef.current = null;
          setSession(null);
          clearOperationalHomeData();
          setSchool(activeSchool);
          schoolRef.current = activeSchool;
          setScreen("login");
          setAppError("common.sessionExpired");
          return null;
        }

        return null;
      } finally {
        sessionRefreshPromiseRef.current = null;
      }
    })();

    sessionRefreshPromiseRef.current = promise;
    return promise;
  }

  useEffect(() => {
    setSessionRefreshHandler(async () => {
      const refreshed = await refreshActiveSession();
      return refreshed?.accessToken ?? null;
    });
    return () => setSessionRefreshHandler(null);
  }, [school?.id, session?.user.id]);

  useEffect(() => {
    const activeSession = session;
    if (!activeSession || !school) return;

    const refreshAt = new Date(activeSession.accessExpiresAt).getTime() - 60_000;
    const delay = Math.max(0, refreshAt - Date.now());
    const timeout = setTimeout(() => {
      void refreshActiveSession();
    }, delay);

    return () => clearTimeout(timeout);
  }, [session?.accessExpiresAt, session?.user.id, school?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const activeSession = sessionRef.current;
      if (!activeSession) return;

      const expiresAt = new Date(activeSession.accessExpiresAt).getTime();
      if (expiresAt - Date.now() <= 60_000) {
        void refreshActiveSession();
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setReadCacheFallbackListener(() => {
      if (session?.user.status === "SUSPENDED") {
        setPreferCachedReads(false);
        setNotice(null);
        setAppError("auth.accountSuspended");
        return;
      }

      setPreferCachedReads(true);
      setNotice(null);
      setAppError("common.apiUnavailable", "network");
    });
    return () => setReadCacheFallbackListener(null);
  }, [locale, session?.user.status]);

  useEffect(() => {
    setReadCacheScope(
      session && school ? `${school.id}:${session.user.id}` : null
    );
  }, [session?.user.id, school?.id]);

  useEffect(() => {
    if (screen !== "school") {
      schoolSearchRequestId.current += 1;
      setSchoolsLoading(false);
      return;
    }

    const delay = query.trim() ? 250 : 0;
    const timeout = setTimeout(() => {
      void loadSchools(query);
    }, delay);

    return () => {
      clearTimeout(timeout);
      schoolSearchRequestId.current += 1;
    };
  }, [screen, query]);

  useEffect(() => {
    screenOpacity.stopAnimation();
    screenTranslate.stopAnimation();

    if (reduceMotion) {
      screenOpacity.setValue(1);
      screenTranslate.setValue(0);
      return;
    }
    screenOpacity.setValue(0);
    screenTranslate.setValue(14);
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(screenTranslate, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [screen, reduceMotion, screenOpacity, screenTranslate]);

  useEffect(() => {
    if (reduceMotion) {
      childOpacity.setValue(1);
      childScale.setValue(1);
      return;
    }
    childOpacity.setValue(0);
    childScale.setValue(0.985);
    Animated.parallel([
      Animated.timing(childOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(childScale, {
        toValue: 1,
        damping: 16,
        stiffness: 180,
        mass: 0.7,
        useNativeDriver: true
      })
    ]).start();
  }, [selectedChildId, reduceMotion, childOpacity, childScale]);

  useEffect(() => {
    if (screen !== "home" || !session) return;
    void loadAdminContact(session.accessToken);
    if (session.user.status === "SUSPENDED" || session.mustChangePassword) return;
    if (session.user.role === "PARENT") {
      void loadParentHome(session.accessToken);
      void loadParentNotifications(session.accessToken);
    }
    if (session.user.role === "TEACHER") void loadTeacherToday(session.accessToken);
  }, [
    screen,
    session?.accessToken,
    session?.user.role,
    session?.user.status,
    session?.mustChangePassword,
    reconnectEpoch
  ]);

  useEffect(() => {
    const requestId = ++parentChildLoadRequestId.current;
    if (
      screen === "home" &&
      session?.user.role === "PARENT" &&
      session.user.status !== "SUSPENDED" &&
      selectedChildId
    ) {
      setParentAttendance([]);
      setParentToday("");
      setParentTimetable([]);
      setParentTimetableReady(false);
      setParentLearning(null);
      setParentAnnouncements([]);
      setParentFees([]);
      setParentCommunicationReady(false);
      void loadParentAttendance(session.accessToken, selectedChildId, requestId);
      void loadParentTimetable(session.accessToken, selectedChildId, requestId);
      void loadParentLearningData(session.accessToken, selectedChildId, requestId);
      void loadParentCommunicationData(session.accessToken, selectedChildId, requestId);
    }
  }, [screen, session?.accessToken, session?.user.role, selectedChildId, reconnectEpoch]);

  useEffect(() => {
    if (!session || session.mustChangePassword || session.user.status === "SUSPENDED") return;
    void registerPushForSession(session.accessToken);
  }, [session?.accessToken, session?.mustChangePassword, session?.user.status]);

  useEffect(() => {
    if (!session || !school || screen === "role" || screen === "school" || screen === "login") return;

    const activeSession = session;
    const activeSchool = school;
    let checking = false;

    async function syncStatus() {
      if (checking) return;
      checking = true;
      try {
        const me = await api.me(activeSession.accessToken);
        const latestSession = sessionRef.current;
        if (!latestSession || latestSession.user.id !== activeSession.user.id) return;

        const wasSuspended = latestSession.user.status === "SUSPENDED";
        const isSuspended = me.user.status === "SUSPENDED";
        const next: SessionPayload = {
          ...latestSession,
          user: me.user,
          mustChangePassword: me.mustChangePassword
        };

        if (
          me.user.status !== latestSession.user.status ||
          me.mustChangePassword !== latestSession.mustChangePassword
        ) {
          sessionRef.current = next;
          setSession(next);
          await saveStoredSession({ auth: next, school: activeSchool });
        }

        if (isSuspended) {
          setScreen("home");
          setParentHome(null);
          setSelectedChildId("");
          setParentAttendance([]);
          setParentTimetable([]);
          setParentTimetableReady(false);
          setParentLearning(null);
          setParentAnnouncements([]);
          setParentFees([]);
          setParentCommunicationReady(false);
          setParentNotifications([]);
          setTeacherToday(null);
          setAttendanceSheet(null);
          setAttendanceDraft({});
          void loadAdminContact(latestSession.accessToken);
          if (!wasSuspended) setAppError("auth.accountSuspended");
        } else if (wasSuspended) {
          setAppError(null);
          setScreen(screenForSession(next));
          setReconnectEpoch((current) => current + 1);
        }
      } catch (cause) {
        if (
          cause instanceof ApiRequestError &&
          cause.code === "session_invalid"
        ) {
          await refreshActiveSession();
          return;
        }
        if (cause instanceof ApiRequestError && cause.code === "account_suspended") {
          setSession((current) =>
            current
              ? { ...current, user: { ...current.user, status: "SUSPENDED" } }
              : current
          );
          setScreen("home");
          setAppError("auth.accountSuspended");
          void loadAdminContact(activeSession.accessToken);
        } else if (
          cause instanceof ApiRequestError &&
          cause.code === "school_service_unavailable"
        ) {
          await moveToServiceUnavailableLogin();
        }
      } finally {
        checking = false;
      }
    }

    void syncStatus();
    const interval = setInterval(syncStatus, 3000);
    return () => clearInterval(interval);
  }, [
    screen,
    school?.id,
    session?.accessToken,
    session?.user.status,
    session?.mustChangePassword
  ]);

  useEffect(() => {
    if (errorKind !== "network" || retryingConnection || errorExitRequested) return;
    let checking = false;
    const interval = setInterval(() => {
      if (checking) return;
      checking = true;
      void retryServiceConnection(false).finally(() => {
        checking = false;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [errorKind, retryingConnection, errorExitRequested, locale, screen, session?.accessToken, session?.user.role, selectedChildId, query]);

  function setAppError(key: TranslationKey | null, kind: AppErrorKind = "general") {
    const nextKind = key ? kind : null;
    errorKeyRef.current = key;
    errorKindRef.current = nextKind;
    setErrorKey(key);
    setErrorKind(nextKind);
    if (key) {
      setConnectionRecovered(false);
      setErrorExitRequested(false);
      setErrorMinimized(false);
    }
  }

  function clearOperationalHomeData() {
    setParentHome(null);
    setSelectedChildId("");
    setParentAttendance([]);
    setParentToday("");
    setParentTimetable([]);
    setParentTimetableReady(false);
    setParentLearning(null);
    setParentAnnouncements([]);
    setParentFees([]);
    setParentCommunicationReady(false);
    setParentNotifications([]);
    setTeacherToday(null);
    setAdminContact(null);
    setAttendanceSheet(null);
    setAttendanceDraft({});
    setNotice(null);
  }

  async function moveToServiceUnavailableLogin() {
    await clearStoredSession();
    setReadCacheScope(null);
    setPreferCachedReads(false);
    sessionRef.current = null;
    sessionRefreshPromiseRef.current = null;
    setSession(null);
    clearOperationalHomeData();
    setScreen("login");
    setAppError("common.serviceUnavailable");
  }

  function showCause(cause: unknown, fallback: TranslationKey = "common.requestFailed") {
    if (cause instanceof ApiRequestError && cause.code === "account_suspended") {
      const current = session;
      if (current) {
        const suspended: SessionPayload = {
          ...current,
          user: { ...current.user, status: "SUSPENDED" }
        };
        setSession(suspended);
        if (school) void saveStoredSession({ auth: suspended, school });
        void loadAdminContact(current.accessToken);
      }
      setPreferCachedReads(false);
      setScreen("home");
      setAppError("auth.accountSuspended");
      return;
    }

    const failure = appErrorFromCause(cause, fallback);
    if (failure.kind === "network") setPreferCachedReads(true);
    setAppError(failure.key, failure.kind);
  }

  function finishConnectionRecovery() {
    setPreferCachedReads(false);
    errorKeyRef.current = null;
    errorKindRef.current = null;
    setErrorKey(null);
    setErrorKind(null);
    setErrorMinimized(false);
    setErrorExitRequested(false);
    setConnectionRecovered(true);

    if (screen === "school") {
      void loadSchools(query);
    }
  }

  async function retryServiceConnection(manual = true) {
    if (manual) {
      setRetryingConnection(true);
      setErrorMinimized(false);
    }

    try {
      await api.health();

      if (session?.accessToken) {
        try {
          const me = await api.me(session.accessToken);
          if (me.user.status === "SUSPENDED") {
            const next: SessionPayload = {
              ...session,
              user: me.user,
              mustChangePassword: me.mustChangePassword
            };
            setSession(next);
            if (school) await saveStoredSession({ auth: next, school });
            setScreen("home");
            setParentHome(null);
            setSelectedChildId("");
            setParentAttendance([]);
            setParentTimetable([]);
            setParentTimetableReady(false);
            setParentLearning(null);
            setParentAnnouncements([]);
            setParentFees([]);
            setParentCommunicationReady(false);
            setParentNotifications([]);
            setTeacherToday(null);
            setAttendanceSheet(null);
            setAttendanceDraft({});
            setPreferCachedReads(false);
            setAppError("auth.accountSuspended");
            void loadAdminContact(session.accessToken);
            return true;
          }
        } catch (cause) {
          if (cause instanceof ApiRequestError && cause.code === "session_invalid") {
            const refreshed = await refreshActiveSession();
            if (!refreshed) return false;
            setReconnectEpoch((current) => current + 1);
            if (errorKindRef.current === "network") setErrorExitRequested(true);
            return true;
          }
          if (cause instanceof ApiRequestError && cause.code === "account_suspended") {
            setPreferCachedReads(false);
            setAppError("auth.accountSuspended");
            return true;
          }
          if (
            cause instanceof ApiRequestError &&
            cause.code === "school_service_unavailable"
          ) {
            await moveToServiceUnavailableLogin();
            return true;
          }
          if (isNetworkApiError(cause)) throw cause;
        }
      }

      setReconnectEpoch((current) => current + 1);

      // A health check that started for a network error must not dismiss a
      // newer account-state or validation popup that appeared while it ran.
      if (errorKindRef.current !== "network") return true;

      setErrorExitRequested(true);
      return true;
    } catch {
      setPreferCachedReads(true);
      if (manual) {
        setAppError("common.apiStillUnavailable", "network");
      }
      return false;
    } finally {
      if (manual) setRetryingConnection(false);
    }
  }

  async function restore() {
    try {
      const stored = await loadStoredSession();
      if (!stored) return;

      setSchool(stored.school);
      setReadCacheScope(`${stored.school.id}:${stored.auth.user.id}`);
      setPreferCachedReads(true);

      const userRole = stored.auth.user.role;
      if (userRole === "PARENT" || userRole === "TEACHER" || userRole === "STUDENT") {
        setRole(userRole);
      }

      // Render the stored session immediately. Cached GET data can now populate
      // the home screen without waiting for a dead API tunnel to time out.
      sessionRef.current = stored.auth;
      schoolRef.current = stored.school;
      setSession(stored.auth);
      setScreen(screenForSession(stored.auth));
      setBusy(false);

      try {
        await api.health(1_500);
      } catch {
        setNotice(null);
        setAppError("common.apiUnavailable", "network");
        return;
      }

      setPreferCachedReads(false);

      try {
        const me = await api.me(stored.auth.accessToken);
        const restored = {
          ...stored.auth,
          user: me.user,
          mustChangePassword: me.mustChangePassword
        };
        sessionRef.current = restored;
        setSession(restored);
        await saveStoredSession({ auth: restored, school: stored.school });
        setScreen(screenForSession(restored));
        setReconnectEpoch((current) => current + 1);
        return;
      } catch (cause) {
        if (isNetworkApiError(cause)) {
          setPreferCachedReads(true);
          setNotice(null);
          setAppError("common.apiUnavailable", "network");
          return;
        }
        if (cause instanceof ApiRequestError && cause.code === "school_service_unavailable") {
          await moveToServiceUnavailableLogin();
          return;
        }
      }

      try {
        const refreshed = await api.refresh(stored.auth.refreshToken);
        await saveStoredSession({ auth: refreshed, school: stored.school });
        sessionRef.current = refreshed;
        setSession(refreshed);
        setScreen(screenForSession(refreshed));
        setReconnectEpoch((current) => current + 1);
      } catch (cause) {
        if (isNetworkApiError(cause)) {
          setPreferCachedReads(true);
          setSession(stored.auth);
          setNotice(null);
          setAppError("common.apiUnavailable", "network");
          setScreen(screenForSession(stored.auth));
          return;
        }
        if (cause instanceof ApiRequestError && cause.code === "school_service_unavailable") {
          await moveToServiceUnavailableLogin();
          return;
        }

        await clearStoredSession();
        setReadCacheScope(null);
        setPreferCachedReads(false);
        sessionRef.current = null;
        setSession(null);
        setSchool(stored.school);
        setScreen("login");
        setAppError("common.sessionExpired");
      }
    } catch {
      await clearStoredSession();
      setReadCacheScope(null);
      setPreferCachedReads(false);
    } finally {
      setBusy(false);
    }
  }

  async function loadSchools(searchQuery = query) {
    const requestId = ++schoolSearchRequestId.current;
    setSchoolsLoading(true);
    setAppError(null);

    try {
      const result = await api.schools(searchQuery);
      if (requestId !== schoolSearchRequestId.current) return;
      setSchools(result.schools);
    } catch (cause) {
      if (requestId !== schoolSearchRequestId.current) return;
      showCause(cause);
    } finally {
      if (requestId === schoolSearchRequestId.current) {
        setSchoolsLoading(false);
      }
    }
  }

  function revealOnboardingInput(area: "school" | "login") {
    setTimeout(() => {
      if (area === "login") {
        onboardingScrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      onboardingScrollRef.current?.scrollTo({ y: 150, animated: true });
    }, 120);
  }

  async function loadParentHome(accessToken: string) {
    setBusy(true);
    setAppError(null);
    try {
      const result = await api.parentHome(accessToken);

      let rememberedChildId: string | null = null;
      if (school && session?.user.role === "PARENT") {
        try {
          rememberedChildId = await loadPreferredParentChild(school.id, session.user.id);
        } catch {
          // Child preference is convenience state; Parent Home must still work if device storage is unavailable.
        }
      }
      const currentChildId = selectedChildIdRef.current;
      const nextChildId = result.children.some((item) => item.student.id === currentChildId)
        ? currentChildId
        : rememberedChildId && result.children.some((item) => item.student.id === rememberedChildId)
          ? rememberedChildId
          : result.children[0]?.student.id ?? "";

      selectedChildIdRef.current = nextChildId;
      setParentHome(result);
      setSelectedChildId(nextChildId);

      if (nextChildId && school && session?.user.role === "PARENT") {
        void savePreferredParentChild(school.id, session.user.id, nextChildId).catch(() => {
          // The current selection still works even if preference persistence fails.
        });
      }
    } catch (cause) {
      showCause(cause);
    } finally {
      setBusy(false);
    }
  }

  function selectParentChild(studentId: string) {
    if (selectedChildIdRef.current === studentId) return;
    selectedChildIdRef.current = studentId;
    parentChildLoadRequestId.current += 1;
    setNotice(null);
    setSelectedChildId(studentId);
    if (school && session?.user.role === "PARENT") {
      void savePreferredParentChild(school.id, session.user.id, studentId).catch(() => {
        // Do not block switching when secure preference storage is unavailable.
      });
    }
  }

  async function loadParentAttendance(
    accessToken: string,
    studentId: string,
    requestId: number
  ) {
    try {
      const result = await api.parentAttendance(accessToken, studentId);
      if (requestId !== parentChildLoadRequestId.current) return;
      setParentToday(result.today);
      setParentAttendance(result.days);
    } catch (cause) {
      if (requestId === parentChildLoadRequestId.current) showCause(cause);
    }
  }

  async function loadParentTimetable(
    accessToken: string,
    studentId: string,
    requestId: number
  ) {
    try {
      const result = await api.parentTimetable(accessToken, studentId);
      if (requestId !== parentChildLoadRequestId.current) return;
      setParentTimetable(result.periods);
      setParentTimetableReady(true);
    } catch (cause) {
      if (requestId === parentChildLoadRequestId.current) showCause(cause);
    }
  }

  async function loadParentLearningData(
    accessToken: string,
    studentId: string,
    requestId: number
  ) {
    try {
      const result = await api.parentLearning(accessToken, studentId);
      if (requestId !== parentChildLoadRequestId.current) return;
      setParentLearning(result);
    } catch (cause) {
      if (requestId === parentChildLoadRequestId.current) showCause(cause);
    }
  }

  async function loadParentCommunicationData(
    accessToken: string,
    studentId: string,
    requestId: number
  ) {
    try {
      const [announcementResult, feeResult] = await Promise.all([
        api.announcements(accessToken),
        api.parentFees(accessToken, studentId)
      ]);
      if (requestId !== parentChildLoadRequestId.current) return;
      setParentAnnouncements(announcementResult.announcements);
      setParentFees(feeResult.invoices);
      setParentCommunicationReady(true);
    } catch (cause) {
      if (requestId === parentChildLoadRequestId.current) showCause(cause);
    }
  }

  async function loadParentNotifications(accessToken: string) {
    try {
      const result = await api.parentNotifications(accessToken);
      setParentNotifications(result.notifications);
    } catch (cause) {
      showCause(cause);
    }
  }

  async function loadAdminContact(accessToken: string) {
    try {
      const result = await api.adminContact(accessToken);
      setAdminContact(result.contact);
    } catch {
      // Contact information is supplementary; other home data should remain usable.
    }
  }

  async function loadTeacherToday(accessToken: string) {
    setBusy(true);
    setAppError(null);
    try {
      setTeacherToday(await api.teacherToday(accessToken));
    } catch (cause) {
      showCause(cause);
    } finally {
      setBusy(false);
    }
  }

  async function openAttendance(classId: string, date: string) {
    if (!session) return;
    setBusy(true);
    setAppError(null);
    setNotice(null);
    try {
      const sheet = await api.teacherAttendance(session.accessToken, classId, date);
      setAttendanceSheet(sheet);
      setAttendanceDraft(
        Object.fromEntries(
          sheet.students
            .filter((item) => item.status)
            .map((item) => [item.student.id, item.status as AttendanceStatus])
        )
      );
      setScreen("teacher-attendance");
    } catch (cause) {
      showCause(cause);
    } finally {
      setBusy(false);
    }
  }

  async function submitAttendance() {
    if (!session || !attendanceSheet) return;
    const entries = attendanceSheet.students.map((item) => ({
      studentId: item.student.id,
      status: attendanceDraft[item.student.id]
    }));
    if (entries.some((entry) => !entry.status)) {
      setAppError("attendance.markEveryone");
      return;
    }

    setBusy(true);
    setAppError(null);
    setNotice(null);
    try {
      const result = await api.submitDailyAttendance(session.accessToken, {
        classId: attendanceSheet.classSection.id,
        date: attendanceSheet.date,
        entries: entries as Array<{ studentId: string; status: AttendanceStatus }>
      });
      setAttendanceSheet(result.sheet);
      setNotice(result.changed ? translate(locale, "attendance.saved") : translate(locale, "attendance.noChanges"));
      await loadTeacherToday(session.accessToken);
    } catch (cause) {
      showCause(cause);
    } finally {
      setBusy(false);
    }
  }

  async function readNotification(notificationId: string) {
    if (!session) return;
    try {
      const result = await api.markNotificationRead(session.accessToken, notificationId);
      setParentNotifications((current) =>
        current.map((item) => (item.id === notificationId ? result.notification : item))
      );
    } catch {
      // Keep the alert available and retry naturally on the next refresh.
    }
  }

  async function signIn() {
    if (!school || !role) return;
    setBusy(true);
    setAppError(null);
    try {
      const next = await api.login({
        schoolId: school.id,
        expectedRole: role,
        username,
        password
      });
      sessionRef.current = next;
      schoolRef.current = school;
      setSession(next);
      setReadCacheScope(`${school.id}:${next.user.id}`);
      await saveStoredSession({ auth: next, school });
      setPassword("");
      setScreen(screenForSession(next));
      if (next.user.status === "SUSPENDED") {
        setAppError("auth.accountSuspended");
        void loadAdminContact(next.accessToken);
      }
    } catch (cause) {
      showCause(cause, "auth.loginFailed");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (!session) return;

    const validationError = passwordValidationError(newPassword);
    if (validationError) {
      setAppError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setAppError("passwordChange.mismatch");
      return;
    }

    setBusy(true);
    setAppError(null);
    try {
      const next = await api.changeTemporaryPassword(session.accessToken, newPassword);
      sessionRef.current = next;
      setSession(next);
      if (school) {
        setReadCacheScope(`${school.id}:${next.user.id}`);
        await saveStoredSession({ auth: next, school });
      }
      setNewPassword("");
      setConfirmPassword("");
      setScreen("home");
    } catch (cause) {
      showCause(cause, "passwordChange.failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      if (sessionRef.current?.accessToken) {
        await deactivatePushForSession(sessionRef.current.accessToken);
      }
      const refreshToken = sessionRef.current?.refreshToken;
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // Local logout still succeeds if the network is unavailable.
    } finally {
      await clearStoredSession();
      setReadCacheScope(null);
      setPreferCachedReads(false);
      sessionRef.current = null;
      sessionRefreshPromiseRef.current = null;
      setSessionRefreshHandler(null);
      setSession(null);
      setParentHome(null);
      setSelectedChildId("");
      setParentAttendance([]);
      setParentToday("");
      setParentTimetable([]);
      setParentTimetableReady(false);
      setParentLearning(null);
      setParentAnnouncements([]);
      setParentFees([]);
      setParentCommunicationReady(false);
      setParentNotifications([]);
      setTeacherToday(null);
      setAdminContact(null);
      setAttendanceSheet(null);
      setAttendanceDraft({});
      setNotice(null);
      setSchool(null);
      setRole(null);
      setUsername("");
      setScreen("role");
      setBusy(false);
    }
  }

  function chooseRole(value: MobileRole) {
    setRole(value);
    setAppError(null);
    setScreen("school");
  }

  const selectedChild =
    parentHome?.children.find((item) => item.student.id === selectedChildId) ?? null;
  const showParentNavigation =
    screen === "home" &&
    session?.user.role === "PARENT" &&
    session.user.status !== "SUSPENDED";

  function selectParentTab(tab: ParentTab) {
    if (parentTab === tab) return;
    setParentTab(tab);
    setNotice(null);
    setTimeout(() => {
      onboardingScrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
    }, 0);
  }

  const attendanceMarkedCount = attendanceSheet
    ? attendanceSheet.students.filter((item) => attendanceDraft[item.student.id]).length
    : 0;

  if (busy && screen === "role") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={[styles.muted, textDirection]}>{translate(locale, "common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundAccentTop} />
      <View pointerEvents="none" style={styles.backgroundAccentBottom} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
      <ScrollView
        ref={onboardingScrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setLanguageMenuOpen(false)}
        contentContainerStyle={[styles.content, showParentNavigation && styles.contentWithParentNav]}
      >
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="school-outline" size={21} color="#fff" />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brand}>{translate(locale, "app.name")}</Text>
              <Text style={styles.brandCaption}>{translate(locale, "onboarding.caption")}</Text>
            </View>
          </View>

          <View style={styles.languageSelectWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Language: ${languageLabel[locale]}`}
              accessibilityState={{ expanded: languageMenuOpen }}
              onPress={() => setLanguageMenuOpen((current) => !current)}
              style={({ pressed }) => [
                styles.languageSelect,
                languageMenuOpen && styles.languageSelectOpen,
                pressed && styles.pressed
              ]}
            >
              <Ionicons name="language-outline" size={17} color={tokens.color.brandStrong} />
              <Text style={styles.languageSelectText}>{languageLabel[locale]}</Text>
              <Ionicons
                name={languageMenuOpen ? "chevron-up-outline" : "chevron-down-outline"}
                size={16}
                color={tokens.color.textMuted}
              />
            </Pressable>

            {languageMenuOpen ? (
              <View style={styles.languageMenu}>
                {supportedLocales.map((item) => {
                  const active = item === locale;
                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={languageLabel[item]}
                      onPress={() => {
                        setLocale(item);
                        setLanguageMenuOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.languageOption,
                        active && styles.languageOptionActive,
                        pressed && styles.pressed
                      ]}
                    >
                      <Text style={[styles.languageOptionText, active && styles.languageOptionTextActive]}>
                        {languageLabel[item]}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark-outline" size={17} color={tokens.color.brandStrong} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        <OnboardingProgress screen={screen} />

        <Animated.View
          style={[
            styles.screenMotion,
            {
              opacity: screenOpacity,
              transform: [{ translateY: screenTranslate }]
            }
          ]}
        >

        {screen === "role" && (
          <View style={[styles.section, styles.onboardingCard]}>
            <View style={styles.heroIcon}>
              <Ionicons name="sparkles-outline" size={24} color={tokens.color.brandStrong} />
            </View>
            <Text style={[styles.title, textDirection]}>{translate(locale, "auth.chooseRole")}</Text>
            <Text style={[styles.subtitle, textDirection]}>{translate(locale, "auth.chooseRoleHint")}</Text>
            <View style={styles.stack}>
              {(["PARENT", "TEACHER", "STUDENT"] as MobileRole[]).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`${translate(locale, roleKey[item])}. ${translate(locale, roleHintKey[item])}`}
                  onPress={() => chooseRole(item)}
                  style={({ pressed }) => [
                    styles.roleCard,
                    direction === "rtl" && styles.roleCardRtl,
                    pressed && styles.cardPressed
                  ]}
                >
                  <View style={[styles.roleCardMain, direction === "rtl" && styles.roleCardMainRtl]}>
                    <View style={styles.roleIconShell}>
                      <Ionicons name={roleIcon[item]} size={23} color={tokens.color.brandStrong} />
                    </View>
                    <View style={styles.roleCopy}>
                      <Text style={[styles.roleTitle, textDirection]}>{translate(locale, roleKey[item])}</Text>
                      <Text style={[styles.roleHint, textDirection]}>{translate(locale, roleHintKey[item])}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={direction === "rtl" ? "chevron-back" : "chevron-forward"}
                    size={20}
                    color={tokens.color.textMuted}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {screen === "school" && (
          <View style={[styles.section, styles.onboardingCard]}>
            <BackButton
              locale={locale}
              onPress={() => {
                schoolSearchRequestId.current += 1;
                setSchoolsLoading(false);
                setScreen("role");
              }}
            />
            <View style={styles.heroIcon}>
              <Ionicons name="business-outline" size={24} color={tokens.color.brandStrong} />
            </View>
            <Text style={[styles.title, textDirection]}>{translate(locale, "school.choose")}</Text>
            <Text style={[styles.subtitle, textDirection]}>{translate(locale, "school.chooseHint")}</Text>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel={translate(locale, "school.search")}
                value={query}
                onChangeText={setQuery}
                onFocus={() => revealOnboardingInput("school")}
                onSubmitEditing={() => void loadSchools(query)}
                placeholder={translate(locale, "school.searchHint")}
                returnKeyType="search"
                style={[styles.input, styles.searchInput, textDirection]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate(locale, "school.search")}
                style={({ pressed }) => [styles.smallPrimaryButton, pressed && styles.buttonPressed]}
                onPress={() => void loadSchools(query)}
              >
                <Ionicons name="search-outline" size={21} color="#fff" />
              </Pressable>
            </View>
            {schoolsLoading ? <ActivityIndicator /> : null}
            <View style={styles.stack}>
              {schools.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.city}, ${item.code}`}
                  style={({ pressed }) => [
                    styles.schoolCard,
                    direction === "rtl" && styles.schoolCardRtl,
                    pressed && styles.cardPressed
                  ]}
                  onPress={() => {
                    setSchool(item);
                    setScreen("login");
                  }}
                >
                  <SchoolAvatar school={item} />
                  <View style={styles.schoolCopy}>
                    <Text style={[styles.schoolName, textDirection]}>{item.name}</Text>
                    <Text style={[styles.muted, textDirection]}>{item.city} · {item.province} · {item.code}</Text>
                  </View>
                  <Ionicons
                    name={direction === "rtl" ? "chevron-back" : "chevron-forward"}
                    size={18}
                    color={tokens.color.textMuted}
                  />
                </Pressable>
              ))}
              {!schoolsLoading && schools.length === 0 ? (
                <Text style={[styles.muted, textDirection]}>{translate(locale, "school.noResults")}</Text>
              ) : null}
            </View>
          </View>
        )}

        {screen === "login" && school && role && (
          <View style={[styles.section, styles.onboardingCard]}>
            <BackButton locale={locale} onPress={() => setScreen("school")} />
            <View style={styles.schoolPill}>
              <Ionicons name="business-outline" size={15} color={tokens.color.brandStrong} />
              <Text style={styles.schoolPillText}>{school.name}</Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="lock-closed-outline" size={24} color={tokens.color.brandStrong} />
            </View>
            <Text style={[styles.title, textDirection]}>{translate(locale, "login.title")}</Text>
            <Text style={[styles.subtitle, textDirection]}>
              {translate(locale, loginGreetingKey[role])}
            </Text>
            <TextInput
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              onFocus={() => revealOnboardingInput("login")}
              placeholder={translate(locale, "field.username")}
              style={[styles.input, textDirection]}
            />
            <View style={[styles.passwordField, direction === "rtl" && styles.passwordFieldRtl]}>
              <TextInput
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={setPassword}
                onFocus={() => revealOnboardingInput("login")}
                placeholder={translate(locale, "field.password")}
                style={[styles.passwordInput, textDirection]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate(locale, passwordVisible ? "action.hidePassword" : "action.showPassword")}
                style={styles.passwordToggle}
                hitSlop={8}
                onPress={() => setPasswordVisible((current) => !current)}
              >
                <Ionicons
                  name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={tokens.color.textMuted}
                />
              </Pressable>
            </View>
            <PrimaryButton disabled={busy || !username || !password} label={translate(locale, "auth.signIn")} onPress={() => void signIn()} />
          </View>
        )}

        {screen === "change-password" && session && (
          <View style={[styles.section, styles.onboardingCard]}>
            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark-outline" size={24} color={tokens.color.brandStrong} />
            </View>
            <Text style={[styles.title, textDirection]}>{translate(locale, "passwordChange.title")}</Text>
            <Text style={[styles.subtitle, textDirection]}>{translate(locale, "passwordChange.hint")}</Text>

            <View style={styles.passwordRulesCard}>
              <Text style={[styles.passwordRulesTitle, textDirection]}>
                {translate(locale, "passwordChange.rulesTitle")}
              </Text>
              <View style={styles.passwordRulesList}>
                {passwordChecks.map((rule) => (
                  <View
                    key={rule.key}
                    style={[styles.passwordRuleRow, direction === "rtl" && styles.passwordRuleRowRtl]}
                  >
                    <Ionicons
                      name={rule.passed ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={rule.passed ? tokens.color.success : tokens.color.textMuted}
                    />
                    <Text
                      style={[
                        styles.passwordRuleText,
                        rule.passed && styles.passwordRuleTextPassed,
                        textDirection
                      ]}
                    >
                      {translate(locale, rule.key)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.passwordField, direction === "rtl" && styles.passwordFieldRtl]}>
              <TextInput
                secureTextEntry={!newPasswordVisible}
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  if (errorKey?.startsWith("passwordChange.")) setAppError(null);
                }}
                placeholder={translate(locale, "field.newPassword")}
                style={[styles.passwordInput, textDirection]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate(locale, newPasswordVisible ? "action.hidePassword" : "action.showPassword")}
                style={styles.passwordToggle}
                hitSlop={8}
                onPress={() => setNewPasswordVisible((current) => !current)}
              >
                <Ionicons
                  name={newPasswordVisible ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={tokens.color.textMuted}
                />
              </Pressable>
            </View>
            <View style={[styles.passwordField, direction === "rtl" && styles.passwordFieldRtl]}>
              <TextInput
                secureTextEntry={!confirmPasswordVisible}
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  if (errorKey?.startsWith("passwordChange.")) setAppError(null);
                }}
                placeholder={translate(locale, "field.confirmPassword")}
                style={[styles.passwordInput, textDirection]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate(locale, confirmPasswordVisible ? "action.hidePassword" : "action.showPassword")}
                style={styles.passwordToggle}
                hitSlop={8}
                onPress={() => setConfirmPasswordVisible((current) => !current)}
              >
                <Ionicons
                  name={confirmPasswordVisible ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={tokens.color.textMuted}
                />
              </Pressable>
            </View>
            <PrimaryButton
              disabled={busy || !newPassword || !confirmPassword}
              label={translate(locale, "action.save")}
              onPress={() => void changePassword()}
            />
          </View>
        )}

        {screen === "home" && session?.user.status === "SUSPENDED" && (
          <View style={styles.section}>
            <View style={styles.suspendedCard}>
              <View style={styles.suspendedIcon}>
                <Ionicons name="lock-closed-outline" size={26} color={tokens.color.warning} />
              </View>
              <Text style={[styles.title, textDirection]}>{translate(locale, "suspension.title")}</Text>
              <Text style={[styles.subtitle, textDirection]}>{translate(locale, "auth.accountSuspended")}</Text>
              <Text style={[styles.suspendedHint, textDirection]}>{translate(locale, "suspension.contactHint")}</Text>
            </View>

            <AdminContactCard contact={adminContact} locale={locale} />

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={() => void logout()}
            >
              <Text style={styles.secondaryButtonText}>{translate(locale, "auth.logout")}</Text>
            </Pressable>
          </View>
        )}

        {screen === "home" && session?.user.role === "PARENT" && session.user.status !== "SUSPENDED" && (
          <View style={styles.section}>
            {parentTab === "HOME" ? (
              <>
                <View style={[styles.parentHeroCard, direction === "rtl" && styles.rowRtl]}>
                  <View style={styles.parentHeroIcon}>
                    <Ionicons name="people-outline" size={24} color={tokens.color.brandStrong} />
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={[styles.parentHeroEyebrow, textDirection]}>
                      {translate(locale, "parent.homeTitle")}
                    </Text>
                    <Text style={[styles.parentHeroName, textDirection]}>
                      {parentHome?.parent.fullName ?? session.user.username}
                    </Text>
                    <Text style={[styles.parentHeroMeta, textDirection]}>
                      {school?.name}{parentHome ? ` · ${session.user.username}` : ""}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.parentIntro, textDirection]}>
                  {translate(locale, "parent.homeSubtitle")}
                </Text>

                {parentHome ? (
                  <>
                    {parentHome.children.length > 0 ? (
                      <>
                        {parentHome.children.length > 1 ? (
                          <>
                            <View style={[styles.parentSectionHeading, direction === "rtl" && styles.rowRtl]}>
                              <View style={styles.parentSectionIcon}>
                                <Ionicons name="swap-horizontal-outline" size={17} color={tokens.color.brandStrong} />
                              </View>
                              <Text style={[styles.sectionLabel, styles.flexCopy, textDirection]}>
                                {translate(locale, "parent.switchChild")}
                              </Text>
                            </View>
                            <View style={[styles.childSelector, direction === "rtl" && styles.childSelectorRtl]}>
                              {parentHome.children.map((item) => {
                                const active = item.student.id === selectedChild?.student.id;
                                return (
                                  <Pressable
                                    key={item.student.id}
                                    onPress={() => selectParentChild(item.student.id)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    style={[styles.childChip, active && styles.childChipActive]}
                                  >
                                    <View style={[styles.childChipDot, active && styles.childChipDotActive]}>
                                      <Text style={[styles.childChipDotText, active && styles.childChipDotTextActive]}>
                                        {item.student.fullName.slice(0, 1)}
                                      </Text>
                                    </View>
                                    <Text style={active ? styles.childChipTextActive : styles.childChipText}>
                                      {item.student.fullName}
                                    </Text>
                                    {active ? (
                                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                    ) : null}
                                  </Pressable>
                                );
                              })}
                            </View>
                          </>
                        ) : null}

                        {selectedChild ? (
                          <Animated.View
                            style={[
                              styles.childCard,
                              {
                                opacity: childOpacity,
                                transform: [{ scale: childScale }]
                              }
                            ]}
                          >
                            <View style={[styles.childIdentityRow, direction === "rtl" && styles.rowRtl]}>
                              <View style={styles.childBadge}>
                                <Text style={styles.childBadgeText}>{selectedChild.student.fullName.slice(0, 1)}</Text>
                              </View>
                              <View style={styles.flexCopy}>
                                <Text style={[styles.childName, textDirection]}>{selectedChild.student.fullName}</Text>
                                <Text style={[styles.childIdentityMeta, textDirection]}>
                                  {selectedChild.classSection.name} · {selectedChild.classSection.code}
                                </Text>
                              </View>
                            </View>
                            <View style={[styles.childMetaGrid, direction === "rtl" && styles.childMetaGridRtl]}>
                              <View style={styles.childMetaCell}>
                                <Text style={[styles.childDetailLabel, textDirection]}>{translate(locale, "parent.studentCode")}</Text>
                                <Text style={[styles.childDetailValue, textDirection]} numberOfLines={1}>{selectedChild.student.studentCode}</Text>
                              </View>
                              <View style={styles.childMetaCell}>
                                <Text style={[styles.childDetailLabel, textDirection]}>{translate(locale, "parent.class")}</Text>
                                <Text style={[styles.childDetailValue, textDirection]} numberOfLines={2}>{selectedChild.classSection.code}</Text>
                              </View>
                              <View style={styles.childMetaCell}>
                                <Text style={[styles.childDetailLabel, textDirection]}>{translate(locale, "parent.academicYear")}</Text>
                                <Text style={[styles.childDetailValue, textDirection]} numberOfLines={2}>{selectedChild.academicYear.name}</Text>
                              </View>
                            </View>
                          </Animated.View>
                        ) : null}
                      </>
                    ) : (
                      <View style={styles.emptyCard}>
                        <Text style={[styles.subtitle, textDirection]}>{translate(locale, "parent.noChildren")}</Text>
                      </View>
                    )}
                  </>
                ) : null}

                {selectedChild ? (
                  <>
                    <ParentDashboardPanel
                      key={`parent-dashboard-${reconnectEpoch}-${selectedChild.student.id}`}
                      classId={selectedChild.student.classId}
                      todayDate={parentToday}
                      todayAttendance={
                        parentAttendance.find((item) => item.date === parentToday)?.status ?? null
                      }
                      timetable={parentTimetable}
                      timetableReady={parentTimetableReady}
                      learning={parentLearning}
                      announcements={parentAnnouncements}
                      fees={parentFees}
                      communicationReady={parentCommunicationReady}
                      locale={locale}
                      textDirection={textDirection}
                    />

                    <View style={styles.parentSectionCard}>
                      <View style={[styles.parentSectionHeading, direction === "rtl" && styles.rowRtl]}>
                        <View style={styles.parentSectionIcon}>
                          <Ionicons name="calendar-outline" size={17} color={tokens.color.brandStrong} />
                        </View>
                        <Text style={[styles.sectionLabel, styles.flexCopy, textDirection]}>
                          {translate(locale, "attendance.recent")}
                        </Text>
                      </View>
                      {parentAttendance.slice(0, 7).map((day) => (
                        <View key={day.attendanceId} style={[styles.historyRow, direction === "rtl" && styles.rowRtl]}>
                          <Text style={[styles.historyDate, textDirection]}>{day.date}</Text>
                          <AttendanceBadge locale={locale} status={day.status} />
                        </View>
                      ))}
                      {parentAttendance.length === 0 ? (
                        <View style={styles.parentEmptyState}>
                          <Ionicons name="calendar-clear-outline" size={22} color={tokens.color.textMuted} />
                          <Text style={[styles.muted, styles.flexCopy, textDirection]}>{translate(locale, "attendance.noHistory")}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.parentSectionCard}>
                      <View style={[styles.parentSectionHeading, direction === "rtl" && styles.rowRtl]}>
                        <View style={styles.parentSectionIcon}>
                          <Ionicons name="notifications-outline" size={17} color={tokens.color.brandStrong} />
                        </View>
                        <Text style={[styles.sectionLabel, styles.flexCopy, textDirection]}>
                          {translate(locale, "notifications.title")}
                        </Text>
                      </View>
                      {parentNotifications.slice(0, 5).map((notification) => (
                        <Pressable
                          key={notification.id}
                          onPress={() => void readNotification(notification.id)}
                          style={[
                            styles.notificationRow,
                            direction === "rtl" && styles.rowRtl,
                            !notification.readAt && styles.notificationUnread
                          ]}
                        >
                          <View style={styles.notificationDotWrap}>
                            {!notification.readAt ? <View style={styles.notificationDot} /> : null}
                          </View>
                          <View style={styles.flexCopy}>
                            <Text style={[styles.notificationTitle, textDirection]}>
                              {notification.type === "ATTENDANCE_ABSENT"
                                ? translate(locale, "notifications.absent")
                                : notification.type === "ATTENDANCE_LATE"
                                  ? translate(locale, "notifications.late")
                                  : notification.type === "HOMEWORK_PUBLISHED"
                                    ? translate(locale, "notifications.homework")
                                    : notification.type === "RESULTS_PUBLISHED"
                                      ? translate(locale, "notifications.results")
                                      : notification.title}
                            </Text>
                            <Text style={[styles.muted, textDirection]}>
                              {String(notification.metadata.date ?? notification.metadata.dueAt ?? notification.message ?? "")}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                      {parentNotifications.length === 0 ? (
                        <View style={styles.parentEmptyState}>
                          <Ionicons name="notifications-off-outline" size={22} color={tokens.color.textMuted} />
                          <Text style={[styles.muted, styles.flexCopy, textDirection]}>{translate(locale, "notifications.empty")}</Text>
                        </View>
                      ) : null}
                    </View>
                  </>
                ) : null}
              </>
            ) : null}

            {parentTab === "HOMEWORK" ? (
              <>
                <View style={[styles.parentPageHeading, direction === "rtl" && styles.rowRtl]}>
                  <View style={styles.parentPageHeadingIcon}>
                    <Ionicons name="document-text-outline" size={22} color={tokens.color.brandStrong} />
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={[styles.parentPageTitle, textDirection]}>{translate(locale, "parent.navHomework")}</Text>
                    {selectedChild ? (
                      <Text style={[styles.parentPageContext, textDirection]}>
                        {selectedChild.student.fullName} · {selectedChild.classSection.name}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {selectedChild ? (
                  <>
                    <ParentHomeworkContent
                      learning={parentLearning}
                      locale={locale}
                      textDirection={textDirection}
                    />
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={[styles.subtitle, textDirection]}>{translate(locale, "parent.noChildren")}</Text>
                  </View>
                )}
              </>
            ) : null}

            {parentTab === "ANNOUNCEMENTS" ? (
              <>
                <View style={[styles.parentPageHeading, direction === "rtl" && styles.rowRtl]}>
                  <View style={styles.parentPageHeadingIcon}>
                    <Ionicons name="megaphone-outline" size={22} color={tokens.color.brandStrong} />
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={[styles.parentPageTitle, textDirection]}>{translate(locale, "parent.navAnnouncements")}</Text>
                    {selectedChild ? (
                      <Text style={[styles.parentPageContext, textDirection]}>
                        {selectedChild.student.fullName} · {selectedChild.classSection.name}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {selectedChild ? (
                  <>
                    <ParentAnnouncementsContent
                      announcements={parentAnnouncements}
                      classId={selectedChild.student.classId}
                      ready={parentCommunicationReady}
                      locale={locale}
                      textDirection={textDirection}
                    />
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={[styles.subtitle, textDirection]}>{translate(locale, "parent.noChildren")}</Text>
                  </View>
                )}
              </>
            ) : null}

            {parentTab === "MORE" ? (
              <>
                <View style={[styles.parentPageHeading, direction === "rtl" && styles.rowRtl]}>
                  <View style={styles.parentPageHeadingIcon}>
                    <Ionicons name="grid-outline" size={22} color={tokens.color.brandStrong} />
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={[styles.parentPageTitle, textDirection]}>{translate(locale, "parent.moreTitle")}</Text>
                    {selectedChild ? (
                      <Text style={[styles.parentPageContext, textDirection]}>
                        {selectedChild.student.fullName} · {selectedChild.classSection.name}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {selectedChild ? (
                  <>
                    <ParentMoreAcademicContent
                      learning={parentLearning}
                      fees={parentFees}
                      communicationReady={parentCommunicationReady}
                      locale={locale}
                      textDirection={textDirection}
                    />
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={[styles.subtitle, textDirection]}>{translate(locale, "parent.noChildren")}</Text>
                  </View>
                )}

                <AdminContactCard contact={adminContact} locale={locale} />

                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  onPress={() => void logout()}
                >
                  <Text style={styles.secondaryButtonText}>{translate(locale, "auth.logout")}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}

        {screen === "home" && session?.user.role === "TEACHER" && session.user.status !== "SUSPENDED" && (
          <View style={styles.section}>
            <View style={[styles.teacherHero, direction === "rtl" && styles.rowRtl]}>
              <View style={styles.heroIcon}>
                <Ionicons name="today-outline" size={24} color={tokens.color.brandStrong} />
              </View>
              <View style={styles.flexCopy}>
                <Text style={[styles.title, textDirection]}>{translate(locale, "teacher.todayTitle")}</Text>
                <Text style={[styles.subtitle, textDirection]}>
                  {teacherToday?.date ?? ""} · {teacherToday?.teacher.fullName ?? session.user.username}
                </Text>
              </View>
            </View>

            <View style={styles.phaseCard}>
              <Text style={[styles.sectionLabel, textDirection]}>{translate(locale, "teacher.supervisedClass")}</Text>
              {teacherToday?.supervisedClasses.map((item) => (
                <Pressable
                  key={item.assignmentId}
                  onPress={() => void openAttendance(item.classId, teacherToday.date)}
                  style={({ pressed }) => [
                    styles.supervisedCard,
                    direction === "rtl" && styles.rowRtl,
                    pressed && styles.cardPressed
                  ]}
                >
                  <View style={styles.smallIconShell}>
                    <Ionicons name="people-outline" size={21} color={tokens.color.brandStrong} />
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={[styles.cardTitle, textDirection]}>{item.className}</Text>
                    <Text style={[styles.muted, textDirection]}>
                      {item.attendanceStatus === "PENDING"
                        ? translate(locale, "attendance.pending")
                        : translate(locale, "attendance.submitted")}
                    </Text>
                  </View>
                  <Ionicons
                    name={direction === "rtl" ? "chevron-back" : "chevron-forward"}
                    size={19}
                    color={tokens.color.textMuted}
                  />
                </Pressable>
              ))}
              {teacherToday && teacherToday.supervisedClasses.length === 0 ? (
                <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noSupervisedClass")}</Text>
              ) : null}
            </View>

            <View style={styles.phaseCard}>
              <Text style={[styles.sectionLabel, textDirection]}>{translate(locale, "teacher.schedule")}</Text>
              {teacherToday?.schedule.map((period) => (
                <View key={period.id} style={[styles.scheduleRow, direction === "rtl" && styles.rowRtl]}>
                  <View style={styles.timePill}>
                    <Text style={styles.timePillText}>{period.startsAt}</Text>
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={[styles.cardTitle, textDirection]}>{period.subjectName}</Text>
                    <Text style={[styles.muted, textDirection]}>{period.className} · {period.endsAt}</Text>
                  </View>
                </View>
              ))}
              {teacherToday && teacherToday.schedule.length === 0 ? (
                <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noClassesToday")}</Text>
              ) : null}
            </View>

            <TeacherLearningPanel
              key={`teacher-learning-${reconnectEpoch}`}
              accessToken={session.accessToken}
              locale={locale}
              textDirection={textDirection}
              onError={setAppError}
              onNotice={setNotice}
            />

            <CommunicationPanel
              key={`teacher-communication-${reconnectEpoch}`}
              accessToken={session.accessToken}
              mode="TEACHER"
              supervisedClasses={teacherToday?.supervisedClasses ?? []}
              locale={locale}
              textDirection={textDirection}
              onError={setAppError}
              onNotice={setNotice}
            />

            <AdminContactCard contact={adminContact} locale={locale} />

            <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => void logout()}>
              <Text style={styles.secondaryButtonText}>{translate(locale, "auth.logout")}</Text>
            </Pressable>
          </View>
        )}

        {screen === "home" && session?.user.role === "STUDENT" && session.user.status !== "SUSPENDED" && (
          <View style={styles.section}>
            <View style={[styles.teacherHero, direction === "rtl" && styles.rowRtl]}>
              <View style={styles.heroIcon}>
                <Ionicons name="book-outline" size={24} color={tokens.color.brandStrong} />
              </View>
              <View style={styles.flexCopy}>
                <Text style={[styles.title, textDirection]}>{translate(locale, "student.homeTitle")}</Text>
                <Text style={[styles.subtitle, textDirection]}>{translate(locale, "student.homeSubtitle")}</Text>
              </View>
            </View>
            <LearnerLearningPanel
              key={`student-learning-${reconnectEpoch}`}
              accessToken={session.accessToken}
              mode="STUDENT"
              locale={locale}
              textDirection={textDirection}
              onError={setAppError}
              onNotice={setNotice}
            />

            <CommunicationPanel
              key={`student-communication-${reconnectEpoch}`}
              accessToken={session.accessToken}
              mode="STUDENT"
              locale={locale}
              textDirection={textDirection}
              onError={setAppError}
              onNotice={setNotice}
            />
            <AdminContactCard contact={adminContact} locale={locale} />

            <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => void logout()}>
              <Text style={styles.secondaryButtonText}>{translate(locale, "auth.logout")}</Text>
            </Pressable>
          </View>
        )}

        {screen === "teacher-attendance" && session?.user.role === "TEACHER" && session.user.status !== "SUSPENDED" && attendanceSheet && (
          <View style={styles.section}>
            <BackButton
              locale={locale}
              onPress={() => {
                setNotice(null);
                setAppError(null);
                setScreen("home");
              }}
            />
            <View style={[styles.teacherHero, direction === "rtl" && styles.rowRtl]}>
              <View style={styles.heroIcon}>
                <Ionicons name="checkmark-done-outline" size={24} color={tokens.color.brandStrong} />
              </View>
              <View style={styles.flexCopy}>
                <Text style={[styles.title, textDirection]}>{translate(locale, "attendance.dailyTitle")}</Text>
                <Text style={[styles.subtitle, textDirection]}>
                  {attendanceSheet.classSection.name} · {attendanceSheet.date}
                </Text>
              </View>
            </View>

            <View style={styles.attendanceProgress}>
              <Text style={[styles.muted, textDirection]}>
                {attendanceMarkedCount}/{attendanceSheet.students.length} {translate(locale, "attendance.marked")}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${attendanceSheet.students.length
                        ? (attendanceMarkedCount / attendanceSheet.students.length) * 100
                        : 0}%`
                    }
                  ]}
                />
              </View>
            </View>

            {attendanceSheet.students.map((item) => (
              <View key={item.student.id} style={styles.attendanceStudentCard}>
                <View style={[styles.studentHeader, direction === "rtl" && styles.rowRtl]}>
                  <View style={styles.childBadge}>
                    <Text style={styles.childBadgeText}>{item.student.fullName.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={[styles.cardTitle, textDirection]}>{item.student.fullName}</Text>
                    <Text style={[styles.muted, textDirection]}>{item.student.studentCode}</Text>
                  </View>
                </View>
                <View style={[styles.statusGrid, direction === "rtl" && styles.statusGridRtl]}>
                  {attendanceStatuses.map((status) => {
                    const active = attendanceDraft[item.student.id] === status;
                    return (
                      <Pressable
                        key={status}
                        disabled={!attendanceSheet.canEdit}
                        onPress={() => setAttendanceDraft((current) => ({ ...current, [item.student.id]: status }))}
                        style={[
                          styles.statusButton,
                          active && statusStyle[status],
                          !attendanceSheet.canEdit && styles.disabled
                        ]}
                      >
                        <Text style={[styles.statusButtonText, active && styles.statusButtonTextActive]}>
                          {translate(locale, attendanceKey[status])}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {attendanceSheet.locked ? (
              <View style={styles.warningCard}>
                <Ionicons name="lock-closed-outline" size={20} color={tokens.color.warning} />
                <Text style={[styles.warningText, textDirection]}>{translate(locale, "attendance.locked")}</Text>
              </View>
            ) : (
              <PrimaryButton
                disabled={busy || attendanceMarkedCount !== attendanceSheet.students.length}
                label={translate(locale, "attendance.submit")}
                onPress={() => void submitAttendance()}
              />
            )}
          </View>
        )}

        {notice ? (
          <View style={styles.successNotice} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle-outline" size={20} color={tokens.color.success} />
            <Text style={[styles.successNoticeText, textDirection]}>{notice}</Text>
          </View>
        ) : null}
        {busy && screen !== "role" ? <ActivityIndicator style={styles.loader} color={tokens.color.brand} /> : null}
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>

      {showParentNavigation ? (
        <ParentBottomNavigation
          activeTab={parentTab}
          locale={locale}
          onSelect={selectParentTab}
        />
      ) : null}

      {connectionRecovered ? (
        <ConnectionSuccessPopup
          locale={locale}
          reduceMotion={reduceMotion}
          onDismiss={() => setConnectionRecovered(false)}
        />
      ) : errorKey ? (
        <ErrorPopup
          locale={locale}
          errorKey={errorKey}
          kind={errorKind ?? "general"}
          minimized={errorMinimized}
          retrying={retryingConnection}
          exitRequested={errorExitRequested}
          reduceMotion={reduceMotion}
          onDismiss={() => setAppError(null)}
          onExited={finishConnectionRecovery}
          onMinimize={() => setErrorMinimized(true)}
          onExpand={() => setErrorMinimized(false)}
          onRetry={() => void retryServiceConnection(true)}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function SchoolAvatar({ school }: { school: SchoolOption }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [school.imageUrl]);

  if (school.imageUrl && !imageFailed) {
    return (
      <View style={styles.schoolImageShell}>
        <Image
          source={{ uri: school.imageUrl }}
          style={styles.schoolImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
          accessibilityLabel={school.name}
        />
      </View>
    );
  }

  return (
    <View style={styles.schoolIconShell}>
      <Ionicons name="business-outline" size={20} color={tokens.color.brandStrong} />
    </View>
  );
}

function ErrorPopup({
  locale,
  errorKey,
  kind,
  minimized,
  retrying,
  exitRequested,
  reduceMotion,
  onDismiss,
  onExited,
  onMinimize,
  onExpand,
  onRetry
}: {
  locale: SupportedLocale;
  errorKey: TranslationKey;
  kind: AppErrorKind;
  minimized: boolean;
  retrying: boolean;
  exitRequested: boolean;
  reduceMotion: boolean;
  onDismiss: () => void;
  onExited: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onRetry: () => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const slideProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const titleKey =
    kind === "network" ? "common.connectionProblemTitle" : "common.errorTitle";
  const messageKey =
    kind === "network" && retrying ? "common.checkingConnection" : errorKey;

  useEffect(() => {
    if (reduceMotion) {
      slideProgress.setValue(1);
      return;
    }

    slideProgress.setValue(0);
    Animated.timing(slideProgress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();

    return () => slideProgress.stopAnimation();
  }, [reduceMotion, slideProgress]);

  useEffect(() => {
    if (!exitRequested) return;
    animateOut(onExited);
  }, [exitRequested]);

  function animateOut(after: () => void) {
    if (reduceMotion) {
      after();
      return;
    }

    Animated.timing(slideProgress, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start(() => after());
  }

  const animatedStyle = {
    opacity: slideProgress,
    transform: [
      {
        translateY: slideProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-54, 0]
        })
      },
      {
        scale: slideProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1]
        })
      }
    ]
  };

  if (minimized) {
    return (
      <View pointerEvents="box-none" style={styles.errorPopupLayer}>
        <Animated.View
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={[
            styles.errorPopup,
            styles.errorPopupMinimized,
            rtl && styles.errorPopupRtl,
            animatedStyle
          ]}
        >
          <View style={styles.errorPopupIconCompact}>
            <Ionicons
              name={kind === "network" ? "cloud-offline-outline" : "information-circle-outline"}
              size={18}
              color={kind === "network" ? tokens.color.warning : tokens.color.danger}
            />
          </View>
          <Text
            numberOfLines={1}
            style={[styles.errorPopupMinimizedTitle, rtl && styles.errorPopupTextRtl]}
          >
            {translate(locale, titleKey)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate(locale, "action.expand")}
            onPress={onExpand}
            style={({ pressed }) => [styles.errorPopupIconButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-down-outline" size={19} color={tokens.color.textMuted} />
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.errorPopupLayer}>
      <Animated.View
        accessibilityLiveRegion="assertive"
        accessibilityRole="alert"
        style={[styles.errorPopup, rtl && styles.errorPopupRtl, animatedStyle]}
      >
        <View style={styles.errorPopupIcon}>
          <Ionicons
            name={kind === "network" ? "cloud-offline-outline" : "information-circle-outline"}
            size={22}
            color={kind === "network" ? tokens.color.warning : tokens.color.danger}
          />
        </View>
        <View style={styles.errorPopupCopy}>
          <Text style={[styles.errorPopupTitle, rtl && styles.errorPopupTextRtl]}>
            {translate(locale, titleKey)}
          </Text>
          <Text style={[styles.errorPopupMessage, rtl && styles.errorPopupTextRtl]}>
            {translate(locale, messageKey)}
          </Text>
          <View style={[styles.errorPopupActions, rtl && styles.errorPopupActionsRtl]}>
            {kind === "network" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: retrying }}
                disabled={retrying}
                onPress={onRetry}
                style={({ pressed }) => [
                  styles.errorPopupPrimary,
                  retrying && styles.feedbackButtonDisabled,
                  pressed && !retrying && styles.pressed
                ]}
              >
                {retrying ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text style={styles.errorPopupPrimaryText}>
                  {retrying
                    ? translate(locale, "common.checkingConnection")
                    : translate(locale, "action.retry")}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => animateOut(onDismiss)}
                style={({ pressed }) => [styles.errorPopupSecondary, pressed && styles.pressed]}
              >
                <Text style={styles.errorPopupSecondaryText}>{translate(locale, "action.dismiss")}</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: retrying }}
              disabled={retrying}
              onPress={onMinimize}
              style={({ pressed }) => [
                styles.errorPopupSecondary,
                retrying && styles.feedbackButtonDisabled,
                pressed && !retrying && styles.pressed
              ]}
            >
              <Ionicons name="remove-outline" size={17} color={tokens.color.textMuted} />
              <Text style={styles.errorPopupSecondaryText}>{translate(locale, "action.minimize")}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function ConnectionSuccessPopup({
  locale,
  reduceMotion,
  onDismiss
}: {
  locale: SupportedLocale;
  reduceMotion: boolean;
  onDismiss: () => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const slideProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      slideProgress.setValue(1);
    } else {
      slideProgress.setValue(0);
      Animated.timing(slideProgress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    }

    const timeout = setTimeout(() => {
      animateOut(onDismiss);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      slideProgress.stopAnimation();
    };
  }, [reduceMotion, slideProgress]);

  function animateOut(after: () => void) {
    if (reduceMotion) {
      after();
      return;
    }

    Animated.timing(slideProgress, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start(() => after());
  }

  const animatedStyle = {
    opacity: slideProgress,
    transform: [
      {
        translateY: slideProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-54, 0]
        })
      },
      {
        scale: slideProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1]
        })
      }
    ]
  };

  return (
    <View pointerEvents="box-none" style={styles.errorPopupLayer}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.errorPopup,
          styles.successPopup,
          rtl && styles.errorPopupRtl,
          animatedStyle
        ]}
      >
        <View style={[styles.errorPopupIcon, styles.successPopupIcon]}>
          <Ionicons name="checkmark-circle-outline" size={23} color={tokens.color.success} />
        </View>
        <View style={styles.errorPopupCopy}>
          <Text style={[styles.errorPopupTitle, rtl && styles.errorPopupTextRtl]}>
            {translate(locale, "common.connectionRestoredTitle")}
          </Text>
          <Text style={[styles.errorPopupMessage, rtl && styles.errorPopupTextRtl]}>
            {translate(locale, "common.connectionRestored")}
          </Text>
          <View style={[styles.errorPopupActions, rtl && styles.errorPopupActionsRtl]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => animateOut(onDismiss)}
              style={({ pressed }) => [styles.errorPopupSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.errorPopupSecondaryText}>{translate(locale, "action.dismiss")}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function OnboardingProgress({ screen }: { screen: Screen }) {
  if (screen === "home" || screen === "change-password" || screen === "teacher-attendance") return null;
  const index = screen === "role" ? 0 : screen === "school" ? 1 : 2;

  return (
    <View style={styles.progressWrap}>
      {[0, 1, 2].map((step) => (
        <View
          key={step}
          style={[styles.progressDot, step <= index && styles.progressDotActive]}
        />
      ))}
    </View>
  );
}

function AttendanceBadge({ locale, status }: { locale: SupportedLocale; status: AttendanceStatus }) {
  return (
    <View style={[styles.attendanceBadge, statusStyle[status]]}>
      <Text style={styles.attendanceBadgeText}>{translate(locale, attendanceKey[status])}</Text>
    </View>
  );
}

function BackButton({ locale, onPress }: { locale: SupportedLocale; onPress: () => void }) {
  const rtl = getDirection(locale) === "rtl";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translate(locale, "action.back")}
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
    >
      <Ionicons
        name={rtl ? "arrow-forward-outline" : "arrow-back-outline"}
        size={18}
        color={tokens.color.brandStrong}
      />
      <Text style={styles.backButtonText}>{translate(locale, "action.back")}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.buttonPressed
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
      <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f6f8fc" },
  suspendedCard: {
    alignItems: "center",
    gap: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f2d59a",
    borderRadius: 20,
    backgroundColor: "#fff9ec"
  },
  suspendedIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1c8"
  },
  suspendedHint: {
    color: tokens.color.textMuted,
    fontSize: 13,
    lineHeight: 20
  },
  keyboardAvoiding: { flex: 1 },
  backgroundAccentTop: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#eaf1ff",
    top: -110,
    right: -90,
    opacity: 0.9
  },
  backgroundAccentBottom: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#eef7f4",
    bottom: -80,
    left: -80,
    opacity: 0.85
  },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 52, gap: 16 },
  contentWithParentNav: { paddingBottom: 28 },
  center: { flex: 1, minHeight: 500, alignItems: "center", justifyContent: "center", gap: 12 },
  topbar: {
    position: "relative",
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2
  },
  brandRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minWidth: 0
  },
  brandCopy: { flex: 1, minWidth: 0 },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: tokens.color.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1d4ca8",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3
  },
  brand: { color: tokens.color.brandStrong, fontWeight: "900", fontSize: 22, letterSpacing: -0.4 },
  brandCaption: { color: tokens.color.textMuted, fontSize: 11, marginTop: 1 },
  languageSelectWrap: {
    position: "relative",
    zIndex: 30,
    alignItems: "flex-end"
  },
  languageSelect: {
    minHeight: 44,
    minWidth: 112,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce3ed",
    backgroundColor: tokens.color.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
    shadowColor: "#172033",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  languageSelectOpen: {
    borderColor: "#b9ccef",
    backgroundColor: "#f8faff"
  },
  languageSelectText: {
    flex: 1,
    color: tokens.color.text,
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "center"
  },
  languageMenu: {
    position: "absolute",
    top: 50,
    right: 0,
    width: 142,
    padding: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#dce3ed",
    backgroundColor: tokens.color.surface,
    gap: 2,
    shadowColor: "#172033",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12
  },
  languageOption: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  languageOptionActive: {
    backgroundColor: "#edf3ff"
  },
  languageOptionText: {
    color: tokens.color.text,
    fontSize: 13,
    fontWeight: "700"
  },
  languageOptionTextActive: {
    color: tokens.color.brandStrong,
    fontWeight: "900"
  },
  passwordRulesCard: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe6f0",
    borderRadius: 16,
    backgroundColor: "#f8faff"
  },
  passwordRulesTitle: {
    color: tokens.color.text,
    fontSize: 13,
    fontWeight: "800"
  },
  passwordRulesList: {
    gap: 8
  },
  passwordRuleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  passwordRuleRowRtl: {
    flexDirection: "row-reverse"
  },
  passwordRuleText: {
    flex: 1,
    color: tokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  passwordRuleTextPassed: {
    color: tokens.color.success,
    fontWeight: "700"
  },
  progressWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginVertical: 4 },
  progressDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: "#d3dbe7" },
  progressDotActive: { width: 22, backgroundColor: tokens.color.brand },
  screenMotion: { gap: 16 },
  section: { gap: 16 },
  onboardingCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "#e3e9f2",
    shadowColor: "#172033",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff",
    borderWidth: 1,
    borderColor: "#dce7ff"
  },
  title: { color: tokens.color.text, fontSize: 31, lineHeight: 39, fontWeight: "900", letterSpacing: -0.55 },
  subtitle: { color: tokens.color.textMuted, fontSize: 15, lineHeight: 23 },
  muted: { color: tokens.color.textMuted, fontSize: 13, lineHeight: 19 },
  stack: { gap: 11 },
  roleCard: {
    minHeight: 86,
    padding: 15,
    borderRadius: 18,
    backgroundColor: "#fbfcfe",
    borderWidth: 1,
    borderColor: "#e1e7f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  roleCardRtl: { flexDirection: "row-reverse" },
  roleCardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  roleCardMainRtl: { flexDirection: "row-reverse" },
  roleIconShell: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  roleCopy: { flex: 1, gap: 3 },
  roleTitle: { color: tokens.color.text, fontSize: 18, fontWeight: "900" },
  roleHint: { color: tokens.color.textMuted, fontSize: 12.5, lineHeight: 18 },
  schoolCard: {
    minHeight: 78,
    padding: 14,
    borderRadius: 17,
    backgroundColor: "#fbfcfe",
    borderWidth: 1,
    borderColor: "#e1e7f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  schoolCardRtl: { flexDirection: "row-reverse" },
  schoolIconShell: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#edf3ff",
    alignItems: "center",
    justifyContent: "center"
  },
  schoolImageShell: {
    width: 43,
    height: 43,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#edf3ff",
    borderWidth: 1,
    borderColor: "#e1e7f0"
  },
  schoolImage: {
    width: "100%",
    height: "100%"
  },
  schoolCopy: { flex: 1, gap: 3 },
  schoolName: { color: tokens.color.text, fontSize: 16.5, fontWeight: "900" },
  input: {
    minHeight: 54,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fbfcfe",
    color: tokens.color.text,
    fontSize: 16
  },
  passwordField: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fbfcfe"
  },
  passwordFieldRtl: { flexDirection: "row-reverse" },
  passwordInput: { flex: 1, minHeight: 52, paddingHorizontal: 15, paddingVertical: 12, color: tokens.color.text, fontSize: 16 },
  passwordToggle: { width: 52, minHeight: 52, alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: { flex: 1 },
  smallPrimaryButton: {
    width: 54,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: tokens.color.brand,
    shadowColor: "#265dcb",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  primaryButton: {
    minHeight: 54,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: tokens.color.brand,
    shadowColor: "#265dcb",
    shadowOpacity: 0.18,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 15.5 },
  secondaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: tokens.color.surface
  },
  secondaryButtonText: { color: tokens.color.text, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  cardPressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  buttonPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  backButton: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingRight: 10 },
  backButtonText: { color: tokens.color.brandStrong, fontWeight: "800", fontSize: 13 },
  schoolPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#edf3ff",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  schoolPillText: { color: tokens.color.brandStrong, fontWeight: "800", fontSize: 12 },
  parentHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#dfe7f2",
    backgroundColor: "#f8faff"
  },
  parentHeroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f0ff"
  },
  parentHeroEyebrow: { color: tokens.color.brandStrong, fontSize: 11.5, fontWeight: "900" },
  parentHeroName: { color: tokens.color.text, fontSize: 20, lineHeight: 25, fontWeight: "900" },
  parentHeroMeta: { color: tokens.color.textMuted, fontSize: 11.5, lineHeight: 17 },
  parentIntro: { color: tokens.color.textMuted, fontSize: 13, lineHeight: 20 },
  parentSectionHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  parentSectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  sectionLabel: { color: tokens.color.text, fontSize: 15, fontWeight: "900" },
  childSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  childSelectorRtl: { flexDirection: "row-reverse" },
  childChip: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: tokens.color.surface
  },
  childChipActive: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand },
  childChipDot: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  childChipDotActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  childChipDotText: { color: tokens.color.brandStrong, fontSize: 11, fontWeight: "900" },
  childChipDotTextActive: { color: "#fff" },
  childChipText: { color: tokens.color.text, fontWeight: "700" },
  childChipTextActive: { color: "#fff", fontWeight: "900" },
  childCard: {
    padding: 16,
    backgroundColor: tokens.color.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#dfe6ef",
    gap: 14,
    shadowColor: "#172033",
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1
  },
  childIdentityRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  childBadge: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#edf3ff" },
  childBadgeText: { color: tokens.color.brandStrong, fontSize: 20, fontWeight: "900" },
  childName: { color: tokens.color.text, fontSize: 20, lineHeight: 25, fontWeight: "900" },
  childIdentityMeta: { color: tokens.color.textMuted, fontSize: 12.5, lineHeight: 18 },
  childMetaGrid: { flexDirection: "row", gap: 8 },
  childMetaGridRtl: { flexDirection: "row-reverse" },
  childMetaCell: {
    flex: 1,
    minHeight: 64,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#f7f9fc",
    borderWidth: 1,
    borderColor: "#edf0f4",
    gap: 4
  },
  childDetailLabel: { color: tokens.color.textMuted, fontSize: 10.5, fontWeight: "700" },
  childDetailValue: { color: tokens.color.text, fontSize: 13, lineHeight: 17, fontWeight: "900" },
  parentSectionCard: {
    padding: 16,
    backgroundColor: tokens.color.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    gap: 12,
    shadowColor: "#172033",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  parentEmptyState: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f7f9fc"
  },
  parentPageHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 2
  },
  parentPageHeadingIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff",
    borderWidth: 1,
    borderColor: "#dfe9ff"
  },
  parentPageTitle: { color: tokens.color.text, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  parentPageContext: { color: tokens.color.textMuted, fontSize: 12.5, lineHeight: 18 },
  emptyCard: { padding: 18, borderRadius: 17, backgroundColor: "#eef3fa" },
  successMark: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#e8f5ee", alignItems: "center", justifyContent: "center" },
  successMarkText: { color: tokens.color.success, fontSize: 28, fontWeight: "900" },
  errorPopupLayer: {
    position: "absolute",
    top: 24,
    left: 16,
    right: 16,
    zIndex: 50,
    alignItems: "center"
  },
  errorPopup: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3e9f2",
    borderRadius: 18,
    padding: 15,
    shadowColor: "#172033",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  errorPopupRtl: { flexDirection: "row-reverse" },
  errorPopupMinimized: {
    minHeight: 54,
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 11
  },
  errorPopupIconCompact: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff7e8"
  },
  errorPopupMinimizedTitle: {
    flex: 1,
    color: tokens.color.text,
    fontSize: 13.5,
    fontWeight: "900"
  },
  errorPopupIconButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f4f8"
  },
  errorPopupIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff7e8"
  },
  errorPopupCopy: { flex: 1, gap: 5 },
  errorPopupTitle: { color: tokens.color.text, fontSize: 15.5, fontWeight: "900" },
  errorPopupMessage: { color: tokens.color.textMuted, fontSize: 13.5, lineHeight: 20 },
  errorPopupTextRtl: { textAlign: "right", writingDirection: "rtl" },
  errorPopupActions: { flexDirection: "row", marginTop: 7, gap: 8 },
  errorPopupActionsRtl: { flexDirection: "row-reverse" },
  errorPopupPrimary: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.brand
  },
  errorPopupPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 12.5 },
  errorPopupSecondary: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf1f7"
  },
  errorPopupSecondaryText: { color: tokens.color.text, fontWeight: "800", fontSize: 12.5 },
  feedbackButtonDisabled: { opacity: 0.65 },
  successPopup: { borderColor: "#cfe9da" },
  successPopupIcon: { backgroundColor: "#e8f5ee" },
  loader: { marginTop: 8 },
  rowRtl: { flexDirection: "row-reverse" },
  flexCopy: { flex: 1, gap: 3 },
  phaseCard: { padding: 16, backgroundColor: tokens.color.surface, borderRadius: 19, borderWidth: 1, borderColor: "#e1e7f0", gap: 12 },
  phaseCardHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  smallIconShell: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#edf3ff" },
  historyRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: "#eef1f5", paddingTop: 9 },
  historyDate: { color: tokens.color.text, fontSize: 13, fontWeight: "700" },
  attendanceBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  attendanceBadgeText: { color: "#fff", fontSize: 11.5, fontWeight: "900" },
  notificationRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 54, padding: 10, borderRadius: 13 },
  notificationUnread: { backgroundColor: "#f0f5ff" },
  notificationDotWrap: { width: 9, alignItems: "center" },
  notificationDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: tokens.color.brand },
  notificationTitle: { color: tokens.color.text, fontSize: 14, fontWeight: "800" },
  teacherHero: { flexDirection: "row", alignItems: "center", gap: 12 },
  supervisedCard: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, borderTopWidth: 1, borderTopColor: "#eef1f5", paddingTop: 11 },
  cardTitle: { color: tokens.color.text, fontSize: 15.5, fontWeight: "900" },
  scheduleRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11, borderTopWidth: 1, borderTopColor: "#eef1f5", paddingTop: 10 },
  timePill: { backgroundColor: "#edf3ff", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  timePillText: { color: tokens.color.brandStrong, fontSize: 12, fontWeight: "900" },
  attendanceProgress: { gap: 7 },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: "#e4e9f1", overflow: "hidden" },
  progressFill: { height: 7, borderRadius: 999, backgroundColor: tokens.color.brand },
  attendanceStudentCard: { padding: 15, backgroundColor: tokens.color.surface, borderRadius: 18, borderWidth: 1, borderColor: "#e1e7f0", gap: 13 },
  studentHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  statusGridRtl: { flexDirection: "row-reverse" },
  statusButton: { minHeight: 40, minWidth: "47%", flexGrow: 1, paddingHorizontal: 9, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc" },
  statusButtonText: { color: tokens.color.textMuted, fontSize: 12, fontWeight: "800" },
  statusButtonTextActive: { color: "#fff" },
  warningCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 13, borderRadius: 14, backgroundColor: "#fff8e8", borderWidth: 1, borderColor: "#f4dfae" },
  warningText: { flex: 1, color: tokens.color.warning, fontSize: 13.5, lineHeight: 20 },
  successNotice: { flexDirection: "row", alignItems: "center", gap: 9, padding: 13, borderRadius: 14, backgroundColor: "#edf8f2", borderWidth: 1, borderColor: "#cfead9" },
  successNoticeText: { flex: 1, color: tokens.color.success, fontSize: 13.5, lineHeight: 20 }
});

const statusStyle: Record<AttendanceStatus, object> = {
  PRESENT: { backgroundColor: "#198754", borderColor: "#198754" },
  ABSENT: { backgroundColor: "#c0392b", borderColor: "#c0392b" },
  LATE: { backgroundColor: "#b7791f", borderColor: "#b7791f" },
  EXCUSED: { backgroundColor: "#64748b", borderColor: "#64748b" }
};
