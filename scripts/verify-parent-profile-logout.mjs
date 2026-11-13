#!/usr/bin/env node
// Parent More > Profile sign-out must be discoverable and must call the same
// confirmed logout action used by Preferences. Source guard; no device QA.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8").replace(/\r\n/g,"\n");
const ui = read("apps/mobile/src/parent-more.tsx");
const app = read("apps/mobile/App.tsx");
const locale = read("packages/localization/src/index.ts");

const profile = ui.slice(ui.indexOf("export function ParentProfilePanel("),
  ui.indexOf("export function ParentSchoolPanel("));
const preferences = ui.slice(ui.indexOf("export function ParentPreferencesPanel("));

assert.ok(profile.startsWith("export function ParentProfilePanel("), "Parent Profile component missing");
assert.ok(profile.includes("onRefresh, onLogout") && profile.includes("onLogout: () => void"),
  "Parent Profile must accept an explicit sign-out callback");
assert.ok(profile.includes('<ParentSignOutButton locale={locale} onLogout={onLogout} />'),
  "Parent Profile must show the same logout component as Preferences");
assert.ok(profile.indexOf('<ParentSignOutButton') < profile.indexOf('parent.moreLinkedChildren'),
  "Place Profile sign-out above the potentially long linked-children list");
assert.ok(preferences.includes('<ParentSignOutButton locale={locale} onLogout={onLogout} />'),
  "Keep the existing sign-out access in Parent Preferences");

const button = ui.slice(ui.indexOf("function ParentSignOutButton("),
  ui.indexOf("export function ParentProfilePanel("));
for(const token of [
  'accessibilityRole="button"',
  'accessibilityLabel={translate(locale,"auth.logout")}',
  'accessibilityHint={translate(locale,"parent.moreLogoutConfirm")}',
  'testID="parent-sign-out"',
  'onPress={confirmSignOut}',
  'translate(locale,"parent.moreLogoutTitle")',
  'translate(locale,"parent.moreLogoutConfirm")',
  '{ text: translate(locale,"action.back"), style: "cancel" }',
  '{ text: translate(locale,"auth.logout"), style: "destructive", onPress: onLogout }'
]) assert.ok(button.includes(token), "Accessible confirmed Parent logout missing: " + token);

const profileCall = app.slice(app.indexOf('parentMoreTab === "PROFILE" ? ('),
  app.indexOf('parentMoreTab === "SCHOOL" ? ('));
assert.ok(profileCall.includes("<ParentProfilePanel") &&
  profileCall.includes('onLogout={() => void logout()}'),
  "Parent Profile must call existing app logout()");
assert.ok(app.includes('onLogout={() => void logout()}'), "Existing logout callback must stay wired");
const logout = app.slice(app.indexOf("async function logout()"),
  app.indexOf("async function logout()")+5400);
for(const token of [
  "logoutInProgressRef.current = true",
  "invalidateReadCacheRequests()",
  "removeLocalSessionForLogout(clearStoredSession)",
  "setReadCacheScope(null)",
  "sessionRef.current = null",
  "setSession(null)",
  'setParentMoreTab("FEES")'
]) assert.ok(logout.includes(token), "App logout must still clear Parent private state: " + token);

for(const key of ["parent.moreLogoutTitle","parent.moreLogoutConfirm","auth.logout"])
  assert.ok(locale.split(JSON.stringify(key)+":").length>=4,
    "Confirm/logout text must exist in English, Dari and Pashto: "+key);

console.log("Parent Profile: sign-out is visible, accessible, confirmed, localized and uses existing secure logout.");
