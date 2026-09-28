import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "@maktablink/design-tokens";
import {
  getDirection,
  supportedLocales,
  translate,
  type SupportedLocale
} from "@maktablink/localization";
import { api, type ParentHomePayload, type SchoolOption, type SessionPayload } from "./src/api";
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession
} from "./src/session";

type MobileRole = "PARENT" | "TEACHER" | "STUDENT";
type Screen = "role" | "school" | "login" | "change-password" | "home";

const roleKey: Record<MobileRole, "role.parent" | "role.teacher" | "role.student"> = {
  PARENT: "role.parent",
  TEACHER: "role.teacher",
  STUDENT: "role.student"
};

function AppContent() {
  const [locale, setLocale] = useState<SupportedLocale>("fa-AF");
  const [screen, setScreen] = useState<Screen>("role");
  const [role, setRole] = useState<MobileRole | null>(null);
  const [school, setSchool] = useState<SchoolOption | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
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
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (screen === "school") void loadSchools();
  }, [screen]);

  useEffect(() => {
    if (screen === "home" && session?.user.role === "PARENT" && !session.mustChangePassword) {
      void loadParentHome(session.accessToken);
    }
  }, [screen, session?.accessToken, session?.user.role, session?.mustChangePassword]);

  async function restore() {
    try {
      const stored = await loadStoredSession();
      if (!stored) return;
      setSchool(stored.school);
      const userRole = stored.auth.user.role;
      if (userRole === "PARENT" || userRole === "TEACHER" || userRole === "STUDENT") setRole(userRole);

      try {
        const me = await api.me(stored.auth.accessToken);
        const restored = { ...stored.auth, user: me.user, mustChangePassword: me.mustChangePassword };
        setSession(restored);
        setScreen(me.mustChangePassword ? "change-password" : "home");
      } catch {
        const refreshed = await api.refresh(stored.auth.refreshToken);
        await saveStoredSession({ auth: refreshed, school: stored.school });
        setSession(refreshed);
        setScreen(refreshed.mustChangePassword ? "change-password" : "home");
      }
    } catch {
      await clearStoredSession();
    } finally {
      setBusy(false);
    }
  }

  async function loadSchools() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.schools(query);
      setSchools(result.schools);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "common.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function loadParentHome(accessToken: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.parentHome(accessToken);
      setParentHome(result);
      setSelectedChildId((current) =>
        result.children.some((item) => item.student.id === current)
          ? current
          : result.children[0]?.student.id ?? ""
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "common.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    if (!school || !role) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.login({
        schoolId: school.id,
        expectedRole: role,
        username,
        password
      });
      setSession(next);
      await saveStoredSession({ auth: next, school });
      setPassword("");
      setScreen(next.mustChangePassword ? "change-password" : "home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (!session) return;
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await api.changeTemporaryPassword(session.accessToken, newPassword);
      setSession(next);
      if (school) await saveStoredSession({ auth: next, school });
      setNewPassword("");
      setConfirmPassword("");
      setScreen("home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password change failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const refreshToken = session?.refreshToken;
    setBusy(true);
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // Local logout still succeeds if the network is unavailable.
    } finally {
      await clearStoredSession();
      setSession(null);
      setParentHome(null);
      setSelectedChildId("");
      setSchool(null);
      setRole(null);
      setUsername("");
      setScreen("role");
      setBusy(false);
    }
  }

  function chooseRole(value: MobileRole) {
    setRole(value);
    setError(null);
    setScreen("school");
  }

  const selectedChild =
    parentHome?.children.find((item) => item.student.id === selectedChildId) ??
    parentHome?.children[0] ??
    null;

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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={styles.brand}>{translate(locale, "app.name")}</Text>
          <View style={styles.languageRow}>
            {supportedLocales.map((item) => (
              <Pressable
                key={item}
                onPress={() => setLocale(item)}
                style={[styles.languageButton, item === locale && styles.languageButtonActive]}
              >
                <Text style={item === locale ? styles.languageTextActive : styles.languageText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {screen === "role" && (
          <View style={styles.section}>
            <Text style={[styles.title, textDirection]}>{translate(locale, "auth.chooseRole")}</Text>
            <Text style={[styles.subtitle, textDirection]}>{translate(locale, "auth.chooseRoleHint")}</Text>
            <View style={styles.stack}>
              {(["PARENT", "TEACHER", "STUDENT"] as MobileRole[]).map((item) => (
                <Pressable key={item} style={styles.roleCard} onPress={() => chooseRole(item)}>
                  <Text style={[styles.roleTitle, textDirection]}>{translate(locale, roleKey[item])}</Text>
                  <Text style={[styles.muted, textDirection]}>›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {screen === "school" && (
          <View style={styles.section}>
            <BackButton locale={locale} onPress={() => setScreen("role")} />
            <Text style={[styles.title, textDirection]}>{translate(locale, "school.choose")}</Text>
            <Text style={[styles.subtitle, textDirection]}>{translate(locale, "school.chooseHint")}</Text>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void loadSchools()}
                placeholder={translate(locale, "school.search")}
                style={[styles.input, styles.searchInput, textDirection]}
              />
              <Pressable style={styles.smallPrimaryButton} onPress={() => void loadSchools()}>
                <Text style={styles.primaryButtonText}>⌕</Text>
              </Pressable>
            </View>
            {busy ? <ActivityIndicator /> : null}
            <View style={styles.stack}>
              {schools.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.schoolCard}
                  onPress={() => {
                    setSchool(item);
                    setLocale(item.defaultLanguage);
                    setScreen("login");
                  }}
                >
                  <Text style={[styles.schoolName, textDirection]}>{item.name}</Text>
                  <Text style={[styles.muted, textDirection]}>{item.city} · {item.province} · {item.code}</Text>
                </Pressable>
              ))}
              {!busy && schools.length === 0 ? (
                <Text style={[styles.muted, textDirection]}>{translate(locale, "school.noResults")}</Text>
              ) : null}
            </View>
          </View>
        )}

        {screen === "login" && school && role && (
          <View style={styles.section}>
            <BackButton locale={locale} onPress={() => setScreen("school")} />
            <View style={styles.schoolPill}>
              <Text style={styles.schoolPillText}>{school.name}</Text>
            </View>
            <Text style={[styles.title, textDirection]}>{translate(locale, "login.title")}</Text>
            <Text style={[styles.subtitle, textDirection]}>
              {translate(locale, roleKey[role])} · {translate(locale, "login.hint")}
            </Text>
            <TextInput
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              placeholder={translate(locale, "field.username")}
              style={[styles.input, textDirection]}
            />
            <View style={[styles.passwordRow, direction === "rtl" && styles.passwordRowRtl]}>
              <TextInput
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={setPassword}
                placeholder={translate(locale, "field.password")}
                style={[styles.input, styles.passwordInput, textDirection]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate(locale, passwordVisible ? "action.hidePassword" : "action.showPassword")}
                style={styles.passwordToggle}
                onPress={() => setPasswordVisible((current) => !current)}
              >
                <Text style={styles.passwordToggleText}>
                  {translate(locale, passwordVisible ? "action.hidePassword" : "action.showPassword")}
                </Text>
              </Pressable>
            </View>
            <PrimaryButton disabled={busy || !username || !password} label={translate(locale, "auth.signIn")} onPress={() => void signIn()} />
          </View>
        )}

        {screen === "change-password" && session && (
          <View style={styles.section}>
            <Text style={[styles.title, textDirection]}>{translate(locale, "passwordChange.title")}</Text>
            <Text style={[styles.subtitle, textDirection]}>{translate(locale, "passwordChange.hint")}</Text>
            <View style={[styles.passwordRow, direction === "rtl" && styles.passwordRowRtl]}>
              <TextInput
                secureTextEntry={!newPasswordVisible}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={translate(locale, "field.newPassword")}
                style={[styles.input, styles.passwordInput, textDirection]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate(locale, newPasswordVisible ? "action.hidePassword" : "action.showPassword")}
                style={styles.passwordToggle}
                onPress={() => setNewPasswordVisible((current) => !current)}
              >
                <Text style={styles.passwordToggleText}>
                  {translate(locale, newPasswordVisible ? "action.hidePassword" : "action.showPassword")}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.passwordRow, direction === "rtl" && styles.passwordRowRtl]}>
              <TextInput
                secureTextEntry={!confirmPasswordVisible}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={translate(locale, "field.confirmPassword")}
                style={[styles.input, styles.passwordInput, textDirection]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate(locale, confirmPasswordVisible ? "action.hidePassword" : "action.showPassword")}
                style={styles.passwordToggle}
                onPress={() => setConfirmPasswordVisible((current) => !current)}
              >
                <Text style={styles.passwordToggleText}>
                  {translate(locale, confirmPasswordVisible ? "action.hidePassword" : "action.showPassword")}
                </Text>
              </Pressable>
            </View>
            <PrimaryButton
              disabled={busy || !newPassword || !confirmPassword}
              label={translate(locale, "action.save")}
              onPress={() => void changePassword()}
            />
          </View>
        )}

        {screen === "home" && session?.user.role === "PARENT" && (
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
                      <View style={styles.childCard}>
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
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={[styles.subtitle, textDirection]}>{translate(locale, "parent.noChildren")}</Text>
                  </View>
                )}
              </>
            ) : null}

            <Pressable style={styles.secondaryButton} onPress={() => void logout()}>
              <Text style={styles.secondaryButtonText}>{translate(locale, "auth.logout")}</Text>
            </Pressable>
          </View>
        )}

        {screen === "home" && session && session.user.role !== "PARENT" && (
          <View style={styles.section}>
            <View style={styles.successMark}><Text style={styles.successMarkText}>✓</Text></View>
            <Text style={[styles.title, textDirection]}>{translate(locale, "home.title")}</Text>
            <Text style={[styles.subtitle, textDirection]}>{translate(locale, "home.pending")}</Text>
            <View style={styles.accountCard}>
              <Text style={[styles.accountName, textDirection]}>{session.user.username}</Text>
              <Text style={[styles.muted, textDirection]}>{session.user.role} · {school?.name}</Text>
            </View>
            <Pressable style={styles.secondaryButton} onPress={() => void logout()}>
              <Text style={styles.secondaryButtonText}>{translate(locale, "auth.logout")}</Text>
            </Pressable>
          </View>
        )}

        {error ? <Text style={[styles.error, textDirection]}>{error}</Text> : null}
        {busy && screen !== "role" ? <ActivityIndicator style={styles.loader} /> : null}
      </ScrollView>
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

function BackButton({ locale, onPress }: { locale: SupportedLocale; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backButton}>
      <Text style={styles.backButtonText}>‹ {translate(locale, "action.back")}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primaryButton, disabled && styles.disabled]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tokens.color.canvas },
  content: { padding: tokens.spacing.xl, paddingBottom: 48, gap: tokens.spacing.lg },
  center: { flex: 1, minHeight: 500, alignItems: "center", justifyContent: "center", gap: 12 },
  topbar: { gap: 12, marginBottom: 12 },
  brand: { color: tokens.color.brandStrong, fontWeight: "900", fontSize: 22 },
  languageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  languageButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface },
  languageButtonActive: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand },
  languageText: { color: tokens.color.text, fontWeight: "600" },
  languageTextActive: { color: "#fff", fontWeight: "800" },
  section: { gap: 16 },
  title: { color: tokens.color.text, fontSize: 32, lineHeight: 40, fontWeight: "900" },
  subtitle: { color: tokens.color.textMuted, fontSize: 15, lineHeight: 24 },
  muted: { color: tokens.color.textMuted, fontSize: 14 },
  stack: { gap: 12 },
  roleCard: { minHeight: 82, padding: 18, borderRadius: 18, backgroundColor: tokens.color.surface, borderWidth: 1, borderColor: tokens.color.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roleTitle: { color: tokens.color.text, fontSize: 19, fontWeight: "800" },
  schoolCard: { padding: 18, borderRadius: 16, backgroundColor: tokens.color.surface, borderWidth: 1, borderColor: tokens.color.border, gap: 5 },
  schoolName: { color: tokens.color.text, fontSize: 17, fontWeight: "800" },
  input: { minHeight: 52, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface, color: tokens.color.text, fontSize: 16 },
  passwordRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  passwordRowRtl: { flexDirection: "row-reverse" },
  passwordInput: { flex: 1 },
  passwordToggle: { minWidth: 72, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface },
  passwordToggleText: { color: tokens.color.brandStrong, fontWeight: "800", fontSize: 13 },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: { flex: 1 },
  smallPrimaryButton: { width: 52, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: tokens.color.brand },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: tokens.color.brand },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface },
  secondaryButtonText: { color: tokens.color.text, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  backButton: { alignSelf: "flex-start", paddingVertical: 8, paddingRight: 12 },
  backButtonText: { color: tokens.color.brandStrong, fontWeight: "800" },
  schoolPill: { alignSelf: "flex-start", backgroundColor: tokens.color.surfaceMuted, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  schoolPillText: { color: tokens.color.text, fontWeight: "700" },
  accountCard: { padding: 18, backgroundColor: tokens.color.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.color.border, gap: 5 },
  accountName: { color: tokens.color.text, fontSize: 18, fontWeight: "900" },
  sectionLabel: { color: tokens.color.text, fontSize: 15, fontWeight: "800" },
  childSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  childSelectorRtl: { flexDirection: "row-reverse" },
  childChip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface },
  childChipActive: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand },
  childChipText: { color: tokens.color.text, fontWeight: "700" },
  childChipTextActive: { color: "#fff", fontWeight: "800" },
  childCard: { padding: 18, backgroundColor: tokens.color.surface, borderRadius: 18, borderWidth: 1, borderColor: tokens.color.border, gap: 12 },
  childBadge: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: tokens.color.surfaceMuted },
  childBadgeText: { color: tokens.color.brandStrong, fontSize: 20, fontWeight: "900" },
  childName: { color: tokens.color.text, fontSize: 22, fontWeight: "900" },
  childDetailRow: { gap: 3, paddingTop: 9, borderTopWidth: 1, borderTopColor: tokens.color.border },
  childDetailLabel: { color: tokens.color.textMuted, fontSize: 12, fontWeight: "700" },
  childDetailValue: { color: tokens.color.text, fontSize: 15, fontWeight: "800" },
  emptyCard: { padding: 18, borderRadius: 16, backgroundColor: tokens.color.surfaceMuted },
  successMark: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#e8f5ee", alignItems: "center", justifyContent: "center" },
  successMarkText: { color: tokens.color.success, fontSize: 28, fontWeight: "900" },
  error: { color: tokens.color.danger, lineHeight: 22, backgroundColor: "#fff1f0", borderRadius: 12, padding: 12 },
  loader: { marginTop: 8 }
});
