import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
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
  type AdminContactPayload,
  type AttendanceSheetPayload,
  type AttendanceStatus,
  type ParentAttendanceDay,
  type ParentHomePayload,
  type ParentNotification,
  type SchoolOption,
  type SessionPayload,
  type TeacherTodayPayload
} from "./src/api";
import { AdminContactCard } from "./src/admin-contact-card";
import { CommunicationPanel } from "./src/communication-ui";
import { LearnerLearningPanel, TeacherLearningPanel } from "./src/learning-ui";
import { deactivatePushForSession, registerPushForSession } from "./src/push";
import { appErrorFromCause, type AppErrorKind } from "./src/error-message";
import {
  setReadCacheFallbackListener,
  setReadCacheScope
} from "./src/read-cache";
import {
  clearStoredSession,
  loadStoredSession,
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
  const [parentAttendance, setParentAttendance] = useState<ParentAttendanceDay[]>([]);
  const [parentToday, setParentToday] = useState("");
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
  const schoolSearchRequestId = useRef(0);
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
    setReadCacheFallbackListener(() => {
      setPreferCachedReads(true);
      setNotice(null);
      setAppError("common.apiUnavailable", "network");
    });
    return () => setReadCacheFallbackListener(null);
  }, [locale]);

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
    if (
      screen === "home" &&
      session?.user.role === "PARENT" &&
      session.user.status !== "SUSPENDED" &&
      selectedChildId
    ) {
      void loadParentAttendance(session.accessToken, selectedChildId);
    }
  }, [screen, session?.accessToken, session?.user.role, selectedChildId, reconnectEpoch]);

  useEffect(() => {
    if (!session || session.mustChangePassword || session.user.status === "SUSPENDED") return;
    void registerPushForSession(session.accessToken);
  }, [session?.accessToken, session?.mustChangePassword, session?.user.status]);

  useEffect(() => {
    if (!session || !school || screen === "role" || screen === "school" || screen === "login") return;

    let checking = false;

    async function syncStatus() {
      if (checking) return;
      checking = true;
      try {
        const me = await api.me(session.accessToken);
        const wasSuspended = session.user.status === "SUSPENDED";
        const isSuspended = me.user.status === "SUSPENDED";
        const next: SessionPayload = {
          ...session,
          user: me.user,
          mustChangePassword: me.mustChangePassword
        };

        if (
          me.user.status !== session.user.status ||
          me.mustChangePassword !== session.mustChangePassword
        ) {
          setSession(next);
          await saveStoredSession({ auth: next, school });
        }

        if (isSuspended) {
          setScreen("home");
          setParentHome(null);
          setSelectedChildId("");
          setParentAttendance([]);
          setParentNotifications([]);
          setTeacherToday(null);
          setAttendanceSheet(null);
          setAttendanceDraft({});
          void loadAdminContact(session.accessToken);
          if (!wasSuspended) setAppError("auth.accountSuspended");
        } else if (wasSuspended) {
          setAppError(null);
          setScreen(screenForSession(next));
          setReconnectEpoch((current) => current + 1);
        }
      } catch (cause) {
        if (cause instanceof ApiRequestError && cause.code === "account_suspended") {
          setSession((current) =>
            current
              ? { ...current, user: { ...current.user, status: "SUSPENDED" } }
              : current
          );
          setScreen("home");
          setAppError("auth.accountSuspended");
          void loadAdminContact(session.accessToken);
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
    setErrorKey(key);
    setErrorKind(key ? kind : null);
    if (key) {
      setConnectionRecovered(false);
      setErrorExitRequested(false);
      setErrorMinimized(false);
    }
  }

  function showCause(cause: unknown, fallback: TranslationKey = "common.requestFailed") {
    if (cause instanceof ApiRequestError && cause.code === "account_suspended") {
      setSession((current) =>
        current
          ? { ...current, user: { ...current.user, status: "SUSPENDED" } }
          : current
      );
      setScreen("home");
      if (session?.accessToken) void loadAdminContact(session.accessToken);
    }

    const failure = appErrorFromCause(cause, fallback);
    if (failure.kind === "network") setPreferCachedReads(true);
    setAppError(failure.key, failure.kind);
  }

  function finishConnectionRecovery() {
    setPreferCachedReads(false);
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
      setReconnectEpoch((current) => current + 1);

      if (errorKey) {
        setErrorExitRequested(true);
      } else {
        finishConnectionRecovery();
      }
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
          setAppError("common.serviceUnavailable");
          setSession(null);
          setScreen("login");
          return;
        }
      }

      try {
        const refreshed = await api.refresh(stored.auth.refreshToken);
        await saveStoredSession({ auth: refreshed, school: stored.school });
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
          setAppError("common.serviceUnavailable");
          setSession(null);
          setScreen("login");
          return;
        }

        await clearStoredSession();
        setReadCacheScope(null);
        setPreferCachedReads(false);
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
      setParentHome(result);
      setSelectedChildId((current) =>
        result.children.some((item) => item.student.id === current)
          ? current
          : result.children[0]?.student.id ?? ""
      );
    } catch (cause) {
      showCause(cause);
    } finally {
      setBusy(false);
    }
  }

  async function loadParentAttendance(accessToken: string, studentId: string) {
    try {
      const result = await api.parentAttendance(accessToken, studentId);
      setParentToday(result.today);
      setParentAttendance(result.days);
    } catch (cause) {
      showCause(cause);
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
    const refreshToken = session?.refreshToken;
    setBusy(true);
    try {
      if (session?.accessToken) await deactivatePushForSession(session.accessToken);
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // Local logout still succeeds if the network is unavailable.
    } finally {
      await clearStoredSession();
      setReadCacheScope(null);
      setPreferCachedReads(false);
      setSession(null);
      setParentHome(null);
      setSelectedChildId("");
      setParentAttendance([]);
      setParentToday("");
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
    parentHome?.children.find((item) => item.student.id === selectedChildId) ??
    parentHome?.children[0] ??
    null;
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
        contentContainerStyle={styles.content}
      >
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="school-outline" size={21} color="#fff" />
            </View>
            <View>
              <Text style={styles.brand}>{translate(locale, "app.name")}</Text>
              <Text style={styles.brandCaption}>{translate(locale, "onboarding.caption")}</Text>
            </View>
          </View>
          <View style={styles.languageRow}>
            {supportedLocales.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: item === locale }}
                accessibilityLabel={item === "fa-AF" ? "دری" : item === "ps-AF" ? "پښتو" : "English"}
                onPress={() => setLocale(item)}
                style={({ pressed }) => [
                  styles.languageButton,
                  item === locale && styles.languageButtonActive,
                  pressed && styles.pressed
                ]}
              >
                <Text style={item === locale ? styles.languageTextActive : styles.languageText}>
                  {item === "fa-AF" ? "دری" : item === "ps-AF" ? "پښتو" : "EN"}
                </Text>
              </Pressable>
            ))}
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
            <Text style={[styles.title, textDirection]}>{translate(locale, "parent.homeTitle")}</Text>
            <Text style={[styles.subtitle, textDirection]}>{translate(locale, "parent.homeSubtitle")}</Text>

            {parentHome ? (
              <>
                <View style={styles.accountCard}>
                  <Text style={[styles.accountName, textDirection]}>{parentHome.parent.fullName}</Text>
                  <Text style={[styles.muted, textDirection]}>{school?.name} · {session.user.username}</Text>
                </View>

                {parentHome.children.length > 0 ? (
                  <>
                    <Text style={[styles.sectionLabel, textDirection]}>{translate(locale, "parent.switchChild")}</Text>
                    <View style={[styles.childSelector, direction === "rtl" && styles.childSelectorRtl]}>
                      {parentHome.children.map((item) => {
                        const active = item.student.id === selectedChild?.student.id;
                        return (
                          <Pressable
                            key={item.student.id}
                            onPress={() => setSelectedChildId(item.student.id)}
                            style={[styles.childChip, active && styles.childChipActive]}
                          >
                            <Text style={active ? styles.childChipTextActive : styles.childChipText}>
                              {item.student.fullName}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

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
                        <View style={styles.childBadge}><Text style={styles.childBadgeText}>{selectedChild.student.fullName.slice(0, 1)}</Text></View>
                        <Text style={[styles.childName, textDirection]}>{selectedChild.student.fullName}</Text>
                        <View style={styles.childDetailRow}>
                          <Text style={[styles.childDetailLabel, textDirection]}>{translate(locale, "parent.studentCode")}</Text>
                          <Text style={[styles.childDetailValue, textDirection]}>{selectedChild.student.studentCode}</Text>
                        </View>
                        <View style={styles.childDetailRow}>
                          <Text style={[styles.childDetailLabel, textDirection]}>{translate(locale, "parent.class")}</Text>
                          <Text style={[styles.childDetailValue, textDirection]}>{selectedChild.classSection.name} · {selectedChild.classSection.code}</Text>
                        </View>
                        <View style={styles.childDetailRow}>
                          <Text style={[styles.childDetailLabel, textDirection]}>{translate(locale, "parent.academicYear")}</Text>
                          <Text style={[styles.childDetailValue, textDirection]}>{selectedChild.academicYear.name}</Text>
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
                <View style={styles.phaseCard}>
                  <View style={[styles.phaseCardHeader, direction === "rtl" && styles.rowRtl]}>
                    <View style={styles.smallIconShell}>
                      <Ionicons name="calendar-outline" size={20} color={tokens.color.brandStrong} />
                    </View>
                    <View style={styles.flexCopy}>
                      <Text style={[styles.sectionLabel, textDirection]}>{translate(locale, "attendance.today")}</Text>
                      <Text style={[styles.muted, textDirection]}>
                        {parentAttendance.find((item) => item.date === parentToday)
                          ? translate(locale, attendanceKey[parentAttendance.find((item) => item.date === parentToday)!.status])
                          : translate(locale, "attendance.notRecorded")}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.phaseCard}>
                  <Text style={[styles.sectionLabel, textDirection]}>{translate(locale, "attendance.recent")}</Text>
                  {parentAttendance.slice(0, 7).map((day) => (
                    <View key={day.attendanceId} style={[styles.historyRow, direction === "rtl" && styles.rowRtl]}>
                      <Text style={[styles.historyDate, textDirection]}>{day.date}</Text>
                      <AttendanceBadge locale={locale} status={day.status} />
                    </View>
                  ))}
                  {parentAttendance.length === 0 ? (
                    <Text style={[styles.muted, textDirection]}>{translate(locale, "attendance.noHistory")}</Text>
                  ) : null}
                </View>

                <LearnerLearningPanel
                  key={`parent-learning-${reconnectEpoch}-${selectedChild.student.id}`}
                  accessToken={session.accessToken}
                  studentId={selectedChild.student.id}
                  mode="PARENT"
                  locale={locale}
                  textDirection={textDirection}
                  onError={setAppError}
                  onNotice={setNotice}
                />

                <CommunicationPanel
                  key={`parent-communication-${reconnectEpoch}-${selectedChild.student.id}`}
                  accessToken={session.accessToken}
                  mode="PARENT"
                  studentId={selectedChild.student.id}
                  locale={locale}
                  textDirection={textDirection}
                  onError={setAppError}
                  onNotice={setNotice}
                />

                <View style={styles.phaseCard}>
                  <Text style={[styles.sectionLabel, textDirection]}>{translate(locale, "notifications.title")}</Text>
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
                    <Text style={[styles.muted, textDirection]}>{translate(locale, "notifications.empty")}</Text>
                  ) : null}
                </View>
              </>
            ) : null}

            <AdminContactCard contact={adminContact} locale={locale} />

            <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => void logout()}>
              <Text style={styles.secondaryButtonText}>{translate(locale, "auth.logout")}</Text>
            </Pressable>
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
  center: { flex: 1, minHeight: 500, alignItems: "center", justifyContent: "center", gap: 12 },
  topbar: { gap: 14, marginBottom: 2 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
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
  languageRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    padding: 4,
    borderRadius: 999,
    backgroundColor: "#edf1f7",
    gap: 3
  },
  languageButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 999
  },
  languageButtonActive: {
    backgroundColor: tokens.color.surface,
    shadowColor: "#172033",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  languageText: { color: tokens.color.textMuted, fontWeight: "700", fontSize: 12 },
  languageTextActive: { color: tokens.color.brandStrong, fontWeight: "900", fontSize: 12 },
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
  accountCard: {
    padding: 18,
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    gap: 5,
    shadowColor: "#172033",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1
  },
  accountName: { color: tokens.color.text, fontSize: 18, fontWeight: "900" },
  sectionLabel: { color: tokens.color.text, fontSize: 15, fontWeight: "900" },
  childSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  childSelectorRtl: { flexDirection: "row-reverse" },
  childChip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: tokens.color.surface
  },
  childChipActive: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand },
  childChipText: { color: tokens.color.text, fontWeight: "700" },
  childChipTextActive: { color: "#fff", fontWeight: "900" },
  childCard: {
    padding: 19,
    backgroundColor: tokens.color.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    gap: 12,
    shadowColor: "#172033",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  childBadge: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#edf3ff" },
  childBadgeText: { color: tokens.color.brandStrong, fontSize: 20, fontWeight: "900" },
  childName: { color: tokens.color.text, fontSize: 22, fontWeight: "900" },
  childDetailRow: { gap: 3, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e9edf3" },
  childDetailLabel: { color: tokens.color.textMuted, fontSize: 12, fontWeight: "700" },
  childDetailValue: { color: tokens.color.text, fontSize: 15, fontWeight: "800" },
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
