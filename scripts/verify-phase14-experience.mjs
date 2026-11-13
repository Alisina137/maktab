#!/usr/bin/env node
// Regression guard for actual Phase 14 runtime code. It complements executable
// policy tests and Phase 12 API journeys; not browser/Android/staging acceptance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path, import.meta.url),"utf8");
const app=read("apps/mobile/App.tsx");
const restore=app.slice(app.indexOf("  async function restore() {"),
  app.indexOf("\n  async function loadStudentHomeData(",app.indexOf("  async function restore() {")));
assert.ok(restore.startsWith("  async function restore() {"),"Restore function missing");
for(const fragment of [
  "if (!stored || sessionRef.current || logoutInProgressRef.current) return;",
  "const isRestoring = () => !logoutInProgressRef.current",
  "sameSessionEpoch(sessionRef.current, stored.auth, schoolRef.current, stored.school)",
  "if (!isRestoring()) return;",
  "if (!sessionRef.current && !logoutInProgressRef.current)"
])assert.ok(restore.includes(fragment),"Mobile restoration epoch protection lost: "+fragment);
assert.ok(restore.split("if (!isRestoring()) return;").length>=6,
  "Restore health/me/refresh callbacks must check the original account epoch.");

const session=read("apps/mobile/src/session.ts");
for(const item of ["const sessionWrites = createSerializedWriteQueue()",
  "const parentPreferenceWrites = createSerializedWriteQueue()",
  "await sessionWrites.drained()",
  "sessionWrites.enqueue(() => SecureStore.setItemAsync(KEY",
  "sessionWrites.enqueue(() => SecureStore.deleteItemAsync(KEY)",
  "parentPreferenceWrites.enqueue(async () =>",
  "updateParentChildPreferences(preferences, schoolId, parentUserId, studentId)"
])assert.ok(session.includes(item),"Serialized SecureStore behavior lost: "+item);

const reg=read("apps/web/app/staff/staff-registration-panel.tsx");
for(const item of [
  'window.addEventListener("beforeunload",warn)',
  'window.confirm(t("Discard unsaved registration changes?"))',
  "setRows(current=>[result.request,...current.filter(",
  'setError(t("Saved successfully, but the list could not refresh. Use Refresh."))',
  'setError(t("Submitted successfully, but the list could not refresh. Use Refresh."))',
  "setSelected(current=>current?list.requests.find(",
  "hasUnsavedRegistrationChanges(draft,initial)",
  "onDirtyChange?.(hasUnsavedForm)"
])assert.ok(reg.includes(item),"Staff form safety behavior lost: "+item);

const web=read("apps/web/app/staff/dashboard/page.tsx");
for(const item of ["permittedStaffTabs(profile?.profile?.permissions)",
  "fallbackStaffTab(tab,profile?.profile?.permissions)",
  "setDirectoryRetryEpoch(x=>x+1)", "setWorking(false);return;",
  "registrationDirty", "window.confirm(t(\"Discard unsaved registration changes?\"))",
  "onDirtyChange={setRegistrationDirty}"])
  assert.ok(web.includes(item),"Staff directory permission/retry behavior lost: "+item);
const i18n=read("apps/web/app/admin/admin-i18n.ts");
for(const item of ["Discard unsaved registration changes?",
  "Saved successfully, but the list could not refresh. Use Refresh.",
  "Submitted successfully, but the list could not refresh. Use Refresh."]) {
  assert.ok(i18n.split('"'+item+'"').length>=3,
    "New Staff feedback must exist in both Dari and Pashto translations: "+item);
}
console.log("Phase 14 guards: restore epochs, ordered native storage, Staff form results, directory retry and RTL strings.");
