#!/usr/bin/env node
// Phase 13 static guard complements runtime policy tests; it does not replace
// physical Android/browser checks or independent school pilot acceptance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const hub = read("apps/mobile/src/teacher-hub.tsx");
const start = hub.indexOf("function TeacherHubLoading(");
const end = hub.indexOf("\ntype Icon", start);
assert.ok(start >= 0 && end > start, "Teacher loading component must exist");
const body = hub.slice(start, end);
assert.ok(body.includes("<ActivityIndicator"), "Loading spinner missing");
assert.ok(body.includes('translate(locale, "common.loading")'), "Localized loading message missing");
assert.ok(!/<TeacherHubLoading\b/.test(body),
  "TeacherHubLoading must never render itself: this caused a fatal recursion in Phase 12");
assert.ok(hub.match(/<TeacherHubLoading\b/g)?.length >= 3,
  "TeacherHub loading placeholders must be usable in Today/learning/notices");

const session = read("apps/mobile/src/session.ts");
const sessionGuard = read("apps/mobile/src/stored-session-policy.ts");
for (const token of [
  "validStoredSession(parsed)", "SecureStore.deleteItemAsync(KEY)",
  "parseParentChildPreferences(JSON.parse(raw))", "validStudentPreferenceId"
]) assert.ok(session.includes(token), "Saved session or preference policy removed: " + token);
for (const token of ["user.schoolId === school.id", "ROLES", "validStudentPreferenceId"]) {
  assert.ok(sessionGuard.includes(token), "Storage validation policy removed: " + token);
}
const cache = read("apps/mobile/src/read-cache.ts");
assert.ok(cache.includes("const CACHE_VERSION = 2"), "Cache identity metadata requires v2");
assert.ok(cache.includes("owner: expectedScope") && cache.includes("cacheEnvelopeBelongsTo("),
  "Cache data must be bound to its owner and the requested endpoint");
const registration = read("apps/web/app/staff/staff-registration-panel.tsx");
assert.ok(registration.includes("hasUnsavedRegistrationChanges(draft,selected)"),
  "Registration form must compare working and saved drafts");
assert.ok(registration.includes("disabled={busy||missing||unsavedDraft}"),
  "Submit button must block unsaved changes and missing mandatory checks");
assert.ok(registration.includes("selected.createdBy!==userId"),
  "Non-creator must not submit somebody else's draft");
console.log("Phase 13 source checks: teacher crash fix, session restore, cache tenant binding, and staff draft safety present.");
