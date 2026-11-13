import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const cache = read("apps/mobile/src/read-cache.ts");
const request = read("apps/mobile/src/api.ts");
const policy = read("apps/mobile/src/read-cache-policy.ts");
const locale = read("packages/localization/src/index.ts");
const adminLocale = read("apps/web/app/admin/admin-i18n.ts");
const adminWorkspace = read("apps/web/app/admin/admin-workspace.tsx");
const staff = read("apps/web/app/staff/dashboard/page.tsx");
const navigation = [
  read("apps/mobile/src/teacher-experience.tsx"),
  read("apps/mobile/src/student-navigation.tsx"),
  read("apps/mobile/src/parent-navigation.tsx")
];
const assertContains = (source, text, subject) =>
  assert.ok(source.includes(text), subject + " is missing: " + text);

for (const fragment of [
  "getReadCacheScope()",
  "cacheScopeMatches(expectedScope, scope)",
  "cacheIsCurrent(envelope.savedAt, Date.now(), MAX_CACHE_AGE_MS)",
  "expectedScope: string | null = scope",
  "!cacheScopeMatches(expectedScope, scope)"
]) assertContains(cache, fragment, "Offline cache owner guard");
for (const fragment of [
  "const requestScope = getReadCacheScope();",
  "readReadCache<T>(path, requestScope)",
  "cachedReadFallback<T>(path, cacheable, requestScope)",
  "writeReadCache(path, body as T, requestScope)",
  "requestScope !== getReadCacheScope()",
  'code: "session_changed"',
  "response.status >= 400 && response.status < 500",
  'code: "api_invalid_response"'
]) assertContains(request, fragment, "Cross-account request guard");
for (const fragment of ["export function cacheScopeMatches", "export function cacheIsCurrent",
  "timestamp <= now", "now - timestamp <= maxAge"]) {
  assertContains(policy, fragment, "Offline cache policy");
}
for (const [index, file] of navigation.entries()) {
  assertContains(file, 'numberOfLines={2}', "Role navigation " + index);
  assertContains(file, 'accessibilityRole="tab"', "Role navigation " + index);
  assertContains(file, "accessibilityState={{ selected", "Role navigation " + index);
  assertContains(file, 'writingDirection: "rtl"', "Role navigation " + index);
}
assertContains(staff, "const previousLang = root.lang;", "Staff document locale restoration");
assertContains(staff, "const previousDir = root.dir;", "Staff document direction restoration");
assertContains(staff, "root.lang=previousLang;", "Staff document locale restoration");
assertContains(staff, "root.dir=previousDir;", "Staff document direction restoration");
assertContains(adminWorkspace, "const previousLang = root.lang;", "Admin document locale restoration");
assertContains(adminWorkspace, "const previousDir = root.dir;", "Admin document direction restoration");
assertContains(adminWorkspace, "root.lang = previousLang;", "Admin document locale restoration");
assertContains(adminWorkspace, "root.dir = previousDir;", "Admin document direction restoration");
assertContains(adminLocale, "window.localStorage.getItem(ADMIN_LOCALE_STORAGE_KEY)",
  "Admin locale persistence");
assertContains(adminLocale, "window.localStorage.setItem(ADMIN_LOCALE_STORAGE_KEY, locale)",
  "Admin locale persistence");
assertContains(adminLocale, 'typeof value === "number" && locale !== "en"',
  "Localized admin counters");
assertContains(locale, "date.getUTCFullYear() !== year", "Invalid date rejection");
assertContains(locale, "date.getUTCMonth() + 1 !== month", "Invalid date rejection");
assertContains(locale, "date.getUTCDate() !== day", "Invalid date rejection");
console.log("Phase 8 localization, RTL/LTR navigation, safe offline cache and browser language cleanup guards passed.");
