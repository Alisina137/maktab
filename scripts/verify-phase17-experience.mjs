#!/usr/bin/env node
// Runtime wiring guard: executable unit tests complement this check.
// No real Expo/Android/device acceptance is implied.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8").replace(/\r\n/g,"\n");
const app=read("apps/mobile/App.tsx");
const logout=app.slice(app.indexOf("  async function logout() {"),
  app.indexOf("\n  async function changeParentAccountPassword(",app.indexOf("  async function logout() {")));
assert.ok(logout.startsWith("  async function logout() {"),"Shared logout entrypoint missing.");
for(const key of [
  "invalidateReadCacheRequests();",
  "const previousAccessToken = sessionRef.current?.accessToken ?? null;",
  "const previousRefreshToken = sessionRef.current?.refreshToken ?? null;",
  "removeLocalSessionForLogout(clearStoredSession)",
  'setAppError("auth.logoutDeviceFailed")',
  "if (!deleted)",
  "setReadCacheScope(null);",
  "setPreferCachedReads(false);",
  "sessionRef.current = null;",
  "setSession(null);",
  'setScreen("role");',
  "revokeSignedOutSession(",
  "previousAccessToken, previousRefreshToken,",
  "deactivatePushForSession, api.logout",
  "logoutInProgressRef.current = false;"
])assert.ok(logout.includes(key),"Phase 17 logout lifecycle missing: "+key);
assert.ok(
  logout.indexOf("removeLocalSessionForLogout(clearStoredSession)") <
  logout.indexOf("setSession(null);") &&
  logout.indexOf("setSession(null);") <
  logout.indexOf("revokeSignedOutSession("),
  "First clear secure storage, then hide the account, then attempt remote cleanup.");
const hidden=app.slice(app.indexOf("  if (logoutInProgressRef.current && busy) {"),
  app.indexOf("  if (busy && screen === \"role\") {"));
assert.ok(hidden.includes("<SafeAreaView")&&hidden.includes("<ActivityIndicator"),
  "During logout, render a privacy-safe spinner instead of the previous account.");

const teacher=read("apps/mobile/src/teacher-more.tsx");
const teacherHome=teacher.slice(teacher.indexOf('{section==="HOME"?<>'),
  teacher.indexOf('{section==="ANNOUNCEMENTS"'));
const teacherProfile=teacher.slice(teacher.indexOf('{section==="PROFILE"?<>'));
assert.ok(teacherHome.includes("<TeacherSignOutButton locale={locale} onLogout={onLogout}/>"),
  "Teacher More landing must provide a direct sign-out action.");
assert.ok(teacherProfile.includes("<TeacherSignOutButton locale={locale} onLogout={onLogout}/>"),
  "Teacher Profile must retain sign-out.");
assert.ok(teacher.includes('testID="teacher-sign-out"') &&
  teacher.includes('accessibilityLabel={translate(locale,"auth.logout")}') &&
  teacher.includes('style:"destructive",onPress:onLogout'),
  "Teacher logout should be accessible and require native confirmation.");

const student=read("apps/mobile/src/student-more.tsx");
assert.ok(student.indexOf('testID="student-sign-out"') >
  student.indexOf('testID="student-more-profile"') &&
  student.indexOf('testID="student-sign-out"') <
  student.indexOf('testID="student-phase8-enrollment"'),
  "Student account sign-out should be above long records/settings pages.");
assert.ok(student.includes('style:"destructive",onPress:onLogout')&&
  student.includes('accessibilityHint={translate(locale,"parent.moreLogoutConfirm")}'),
  "Student logout confirmation/accessibility missing.");

const parent=read("apps/mobile/src/parent-more.tsx");
assert.ok(parent.includes('testID="parent-sign-out"') &&
  parent.includes('<ParentSignOutButton locale={locale} onLogout={onLogout} />'),
  "Parent Profile/Preferences sign-out must survive Phase 17 changes.");

const push=read("apps/mobile/src/push.ts");
for(const token of [
  "const token = registeredToken;",
  "const platform = registeredPlatform;",
  "registeredToken = null;",
  "await api.deactivatePushDevice(accessToken, token, platform);"
])assert.ok(push.includes(token),"Stale push deactivation must not change a new account's registration: "+token);
assert.ok(push.indexOf("registeredToken = null;",push.indexOf("export async function deactivatePushForSession")) <
  push.indexOf("await api.deactivatePushDevice(accessToken, token, platform);"),
  "Clear OLD push registration before awaiting its network deactivation.");

const suspend=app.slice(app.indexOf('function showCause('),
  app.indexOf('function finishConnectionRecovery('));
for(const token of [
  'cause.code === "account_suspended"',
  "sessionRef.current = suspended;",
  "setSession(suspended);",
  "invalidateReadCacheRequests();",
  "setPreferCachedReads(false);"
])assert.ok(suspend.includes(token),"Suspended account status/source must be consistent: "+token);

const locale=read("packages/localization/src/index.ts");
assert.equal(locale.split('"auth.logoutDeviceFailed"').length,5,
  "Native secure-storage deletion failure feedback must be translated to English/Dari/Pashto.");
console.log("Phase 17 mobile role logout UX, storage-first auth, independent server cleanup and suspension guards passed.");
