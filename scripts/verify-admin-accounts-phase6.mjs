// Accounts Phase 6 source, localization, accessibility, and responsive evidence guard.
// Real browsers, screen readers and deployed-school authentication require manual acceptance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const sources = [
  "apps/web/app/admin/(workspace)/accounts/page.tsx",
  "apps/web/app/admin/admin-account-directory.tsx",
  "apps/web/app/admin/admin-account-action-confirm.tsx",
  "apps/web/app/admin/admin-account-bulk-confirm.tsx",
  "apps/web/app/admin/admin-account-details-drawer.tsx",
  "apps/web/app/admin/account-temporary-credential.tsx"
];
const content = Object.fromEntries(sources.map((path) => [path, read(path)]));
const page = content[sources[0]];
const directory = content[sources[1]];
const confirm = content[sources[2]];
const bulk = content[sources[3]];
const detail = content[sources[4]];
const secret = content[sources[5]];
const safety = read("apps/web/app/admin/account-directory-safety.ts");
const store = read("packages/database/src/account-store.ts");
const api = read("apps/api/src/users/routes.ts");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");

const faText = i18n.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const psText = i18n.split("const ps: Record<string, string> = {")[1]?.split("export function adminText")[0];
assert.ok(faText && psText, "Cannot locate both admin translation tables");

const uiKeys = new Set();
for (const source of Object.values(content)) {
  for (const match of source.matchAll(/\bt\(\s*"([^"]+)"/g)) uiKeys.add(match[1]);
  for (const match of source.matchAll(/adminFormat\(\s*locale,\s*"([^"]+)"/g)) uiKeys.add(match[1]);
}
for (const value of [
  "Create a parent login and parent profile together.",
  "Select an existing active student without a login. Family linking stays in Families.",
  "Create a teacher login here, then complete the teacher profile in Academics.",
  "Create a school staff login with school-scoped access.",
  "Create another administrator only when school-wide administrative access is necessary.",
  "Account created", "Parent account created", "Student login created",
  "Account suspended", "Account reactivated", "Password reset",
  "Temporary password changed", "Account updated",
  "Confirm bulk suspension", "Confirm bulk reactivation",
  "Bulk actions are limited to 20 accounts."
]) uiKeys.add(value);

const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z]+)\}/g)].map((match) => match[1]).sort();
function translationFor(dict, key, language) {
  const start = "  " + JSON.stringify(key) + ": ";
  const line = dict.split("\n").find((entry) => entry.startsWith(start));
  assert.ok(line, `Accounts missing ${language} translation: ${key}`);
  const match = line.slice(start.length).match(/^("(?:\\.|[^"\\])*"),?\s*$/);
  assert.ok(match, `Accounts invalid ${language} translation: ${key}`);
  const translated = JSON.parse(match[1]);
  assert.ok(translated.trim(), `Accounts blank ${language} translation: ${key}`);
  assert.deepEqual(placeholders(translated), placeholders(key),
    `Accounts ${language} template placeholders mismatch for: ${key}`);
}
for (const key of uiKeys) {
  translationFor(faText, key, "Dari");
  translationFor(psText, key, "Pashto");
}
assert.ok(uiKeys.size >= 120, "Accounts must retain comprehensive localized coverage");

for (const [source, invariants] of [
  [page, [
    "new AbortController()", "shouldAcceptAccountDirectoryResult(", "directoryToken !== sessionToken",
    "familyToken === sessionToken", "queryIntentRef.current = next.trim()", "updateAccountSelection(",
    "setSelectedIds(new Set())", "refreshDirectory()"
  ]],
  [directory, [
    'aria-label={t("Search accounts")}', 'aria-label={t("Filter by status")}',
    'aria-label={t("Sort accounts by")}', 'aria-label={t("Sort direction")}',
    'aria-label={t("Account pagination")}', "aria-busy={loading}", "MAX_ACCOUNT_BULK_SELECTION",
    'id="account-directory-selection-note"'
  ]],
  [confirm, ['role="alertdialog"', 'aria-modal="true"', 'event.key === "Escape"',
    "previousFocus.current?.focus()", "aria-invalid={reasonInvalid}"]],
  [bulk, ['role="alertdialog"', 'aria-modal="true"', 'event.key === "Escape"',
    "previousFocus.current?.focus()", "Existing sessions will be revoked. Users must sign in again."]],
  [detail, ['role="dialog"', 'aria-modal="true"', 'event.key === "Escape"',
    "previousFocus?.focus()", "account-detail-audit-list"]],
  [secret, ['revealed ? credential.password : "••••••••••••"', "onClose",
    "navigator.clipboard.writeText"]],
  [safety, ["MAX_ACCOUNT_BULK_SELECTION = 20", "requestedToken === currentToken",
    "requestedQuery === currentQuery.trim()", "eligibleVisible.has(id)"]],
  [api, ["/v1/admin/users/directory", "/v1/admin/users/username-check",
    "/v1/admin/users/bulk-status", "requireSchoolAdmin(request, reply, store)"]],
  [store, ["async searchUserDirectory", "async bulkSetUserStatusAsAdmin",
    "eq(users.schoolId, schoolId)", "tx.insert(auditLogs).values(updated.map"]]
]) {
  for (const invariant of invariants) {
    assert.ok(source.includes(invariant), `Accounts Phase6 invariant missing: ${invariant}`);
  }
}
for (const selector of [
  ".account-directory-pagination", ".account-directory-bulk-toolbar",
  ".account-detail-drawer[dir=\"rtl\"]", ".admin-account-confirm-card",
  ".account-directory-scaled :is(button, select, input):focus-visible",
  "@media (max-width: 1280px)", "@media (max-width: 620px)",
  "@media (prefers-reduced-motion: reduce)"
]) assert.ok(css.includes(selector), `Accounts Phase6 accessibility/responsive style missing: ${selector}`);

console.log(`[accounts:phase6] ${uiKeys.size} UI copy keys verified across Dari/Pashto, placeholder parity, tenant/network guards, focus and responsive source contracts.`);
console.log("[accounts:phase6] Live DOM keyboard, screen-reader, zoom, phone, network and deployment scenarios still require manual acceptance.");
