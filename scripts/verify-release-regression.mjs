// Step 20 evidence guard: fail CI if the critical end-to-end regression
// scenarios or deployment prerequisites silently disappear from the repo.
// This is a source/test-discovery guard, NOT a live-device E2E test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const api = read("apps/api/src/app.test.ts");
const communication = read("packages/database/src/communication-store.test.ts");
const family = read("packages/database/src/family-store.test.ts");
const accounts = read("packages/database/src/account-store.test.ts");
const locale = read("packages/localization/src/index.test.ts");
const academic = read("packages/database/src/academic-store.test.ts");
const network = read("apps/api/src/connection-stability.test.ts");
const migration = read("packages/database/src/migration-chain.test.ts");
const css = read("apps/web/app/globals.css");
const mobile = read("apps/mobile/App.tsx");
const landing = read("apps/web/app/page.tsx");
const pilot = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const accountPage = read("apps/web/app/admin/(workspace)/accounts/page.tsx");
const accountRules = read("apps/web/app/admin/account-create-rules.ts");
const credentialPanel = read("apps/web/app/admin/account-temporary-credential.tsx");
const creationTests = read("apps/api/src/account-create-rules.test.ts");
const adminTranslations = read("apps/web/app/admin/admin-i18n.ts");
const ci = read(".github/workflows/ci.yml");
const pkg = JSON.parse(read("package.json"));
const packages = [
  "apps/api/package.json", "packages/database/package.json",
  "packages/contracts/package.json", "packages/localization/package.json"
];

const scenario = (id, evidence, source, title) => {
  assert.ok(source.includes(`test("${title}"`),
    `${id} regression evidence missing: ${evidence}. Do not silently drop this test.`);
  console.log(`[release:evidence] ${id} indexed: ${evidence}`);
};

const cases = [
  ["20.1", "Atomic pilot onboarding", api, "Step 18 pilot onboarding is credential-gated, scoped, and rejects inconsistent dates without orphan schools"],
  ["20.2", "Academic setup and timetable", api, "school admin can model teacher assignments, Negaran responsibility, and timetable"],
  ["20.3", "Cross-school family linking", family, "cross-school parent links and duplicate student codes are rejected"],
  ["20.4", "Teacher and Negaran assignments", academic, "a teacher can teach several classes and subjects while separately supervising one class"],
  ["20.5", "Parent multiple-child home", api, "parent account can own three students and sees all three through one login"],
  ["20.6", "Student enrollment and login permissions", api, "student entry enforces role, temporary password, active enrollment, and suspension"],
  ["20.7", "Teacher assignment and role isolation", api, "teacher without Negaran assignment cannot access another class attendance"],
  ["20.8", "Negaran to Parent attendance notification", api, "Negaran submits daily attendance once, duplicate retry is idempotent, and parent sees state plus alert"],
  ["20.9", "Homework draft-to-published privacy", api, "homework stays private as draft, then becomes visible to parent and linked student after publish"],
  ["20.10", "Grade publication and corrections", api, "draft grades are hidden until admin publishes the complete exam, and unrelated teachers cannot grade"],
  ["20.11", "Announcement and fee API flow", api, "Phase 7 class announcements stay inside the intended class and fee payments use immutable reversals"],
  ["20.11", "Scheduled notification idempotency", communication, "Phase 7 reminder jobs are idempotent and push failure does not roll back school data"],
  ["20.12", "Payment ledger and retries", communication, "Step 17 fees: tenant isolation, replay, exact balances, immutable reversals and reminders"],
  ["20.13", "Suspended subscription access", api, "Phase 8 subscription suspension blocks end users and operational admin writes but preserves billing and export access"],
  ["20.14", "Inactive-school and archived-token revocation", api, "Step 20 deactivated schools and archived users cannot reuse existing access or refresh tokens"],
  ["20.14", "Tenant-scoped account identities", accounts, "the same username can exist in different schools but not twice in one school"],
  ["20.15", "Three-locale text parity", locale, "all locales expose the same translation keys"],
  ["20.15", "RTL and Gregorian date rules", locale, "Afghan RTL locales use Solar Hijri dates while English stays Gregorian"],
  ["20.17", "Connection bounce recovery", network, "short network interruptions recover silently but prolonged outages retain confirmation"],
  ["20.18", "Complete SQL migration journal", migration,
    "Step 20: the complete migration journal applies in order to a fresh PostgreSQL-compatible database"]
];
for (const [id, evidence, source, title] of cases) {
  scenario(id, evidence, source, title);
}

for (const p of packages) {
  assert.ok(JSON.parse(read(p)).scripts.test.includes('"src/**/*.test.ts"'),
    `Quoted test glob required in ${p}; unquoted glob caused missing Linux integration tests.`);
}
assert.ok(ci.includes("windows-api-regression:"), "Missing Windows/Node24 CI regression job");
assert.ok(ci.includes("pnpm test"), "Missing full automated test execution in CI");
assert.ok(ci.includes("pnpm build"), "Missing production build in CI");
assert.ok(ci.includes("pnpm verify:release"), "Missing Step20 release evidence CI gate");
assert.ok(ci.includes("pnpm verify:parent-localization"), "Missing parent locale CI verification");
assert.ok(ci.includes("pnpm verify:parent-resilience"), "Missing parent offline/reconnect CI verification");
assert.ok(pkg.scripts.verify.includes("verify:release"), "Local pnpm verify must execute Step20 evidence gate");

assert.ok(css.includes(":focus-visible"), "Admin keyboard focus indicator missing");
assert.ok(css.includes("@media (max-width:"), "Responsive breakpoint missing");
assert.ok(css.includes("prefers-reduced-motion"), "Reduced motion CSS behavior missing");
assert.ok(mobile.includes("accessibilityLabel"), "Android accessibility labels missing");
assert.ok(mobile.includes("AccessibilityInfo"), "Android accessibility support missing");
assert.ok(pilot.includes('readiness.checks.filter((check) => check.passed).length'),
  "Onboarding progress must be computed from the server-side readiness checks");
assert.ok(pilot.includes('aria-label={t("Onboarding progress")}'),
  "Onboarding progress meter requires an accessible name");
assert.ok(pilot.includes("pilot-check-passed") && pilot.includes("pilot-check-pending"),
  "Onboarding status cards must visually distinguish passed and pending checks");
assert.ok(css.includes(".pilot-onboarding-card .pilot-check-list") && css.includes("@media (max-width: 1140px)"),
  "Onboarding cards must adapt to narrower viewport widths");
for (const key of ['"Setup progress":', '"{done} of {total} checks complete":', '"Onboarding progress":']) {
  assert.ok(adminTranslations.split(key).length >= 3,
    `Onboarding copy is missing a Dari or Pashto translation: ${key}`);
}

/* Phase 1 Accounts: safeguard directory-first layout, status filters and locale coverage. */
assert.ok(accountPage.includes('useState<AccountView>("DIRECTORY")') &&
  accountPage.includes('admin-account-grid-directory') &&
  accountPage.includes('admin-account-grid-creating'),
  "Accounts must default to the directory and retain the two adaptive layouts");
assert.ok(accountPage.includes('const summaries = [') &&
  accountPage.includes('users.filter(needsActivation)') &&
  accountPage.includes('onClick={() => selectSummary(summary.id)}'),
  "Account overview status cards must be derived from users and be actionable");
assert.ok(accountPage.includes('role="group" aria-label={t("Account role")}') &&
  accountPage.includes('aria-pressed={group === value}'),
  "Role filters must expose their selection to assistive technology");
assert.ok(accountPage.includes('placeholder={newRole === "PARENT" ? "parent001"') &&
  !accountPage.includes('"parent.001"'),
  "Parent and student username examples must comply with the alphanumeric-only contract");
assert.ok(css.includes(".admin-account-stat-selected") &&
  css.includes(".admin-account-view-button:focus-visible") &&
  css.includes(".admin-account-grid-creating .admin-users-panel"),
  "Accounts overview focus, selected state or responsive directory/form layout missing");
for (const key of ['"Account overview":', '"Total accounts":', '"Active accounts":',
                   '"Pending activation":', '"Suspended accounts":', '"Search accounts":',
                   '"Filter by status":']) {
  assert.ok(adminTranslations.split(key).length >= 3,
    `Accounts Phase1 is missing a Dari or Pashto translation: ${key}`);
}
/* Admin Accounts Phase 2: validated role-specific creation and ephemeral credentials. */
assert.ok(accountPage.includes('validateAccountCreation({') &&
  accountPage.includes('noValidate onSubmit={createUser}') &&
  accountPage.includes('creationAttempted'),
  "Phase 2 account creation must validate locally before the server request");
assert.ok(accountPage.includes('matchingStudentRecords') &&
  accountPage.includes('setStudentRecordId("")') &&
  accountPage.includes('availableStudentRecords.map((item) => item.student.id)'),
  "Student account creation must restrict selection to active unlinked student records");
assert.ok(accountPage.includes('<AccountTemporaryCredentialPanel') &&
  accountPage.includes('onClose={() => setCredential(null)}'),
  "One-time credentials must be explicitly dismissible");
assert.ok(accountRules.includes('/^[A-Za-z0-9]+$/') &&
  accountRules.includes('/^[A-Za-z0-9._@+-]+$/') &&
  accountRules.includes('existingUsernames.some'),
  "Client-side account creation rules must mirror role-specific server username rules");
assert.ok(credentialPanel.includes('navigator.clipboard.writeText') &&
  credentialPanel.includes('revealed ? credential.password : "••••••••••••"') &&
  credentialPanel.includes('useEffect(() => {'),
  "Credential panel must conceal passwords by default and provide secure copy controls");
assert.ok(creationTests.includes('duplicate username guidance is case-insensitive') &&
  creationTests.includes('student selection must reference an eligible active unlinked student'),
  "Phase 2 account creation regression tests are missing");
assert.ok(css.includes('.account-create-field-error') &&
  css.includes('.account-credential-panel .credential-values') &&
  css.includes('@media (max-width: 760px)'),
  "Phase 2 form errors and credential panel must remain responsive");
for (const key of ['"Step 1 · Account role":', '"Copy username":',
                   '"Copy password":', '"Select an eligible student":',
                   '"Username must contain between 3 and 64 characters.":',
                   '"Parent and student usernames may contain English letters and numbers only.":']) {
  assert.ok(adminTranslations.split(key).length >= 3,
    `Account Phase2 is missing a Dari or Pashto translation: ${key}`);
}
assert.ok(landing.includes('id="home-heading"'), "Public landing page heading is missing");
assert.ok(!landing.includes("intentionally deferred to Phase 4"), "Obsolete release page content returned");
assert.ok(read("packages/database/drizzle.config.ts").includes("DATABASE_URL_UNPOOLED"),
  "Direct migration URL preference missing");
assert.ok(read("packages/database/scripts/check-db.mjs").includes("CONNECT_TIMEOUT"),
  "Remote PostgreSQL diagnostic missing");
assert.ok(read("docs/TEST-20-FULL-REGRESSION.md").includes("NO-GO"),
  "A release warning/blocker record is required");

console.log("[release:evidence] Core API/store workflows, locales, migrations and release source gates are indexed.");
console.log("[release:evidence] Live browser/Android, Neon migration, push, backup restore and operator sign-off remain MANUAL/NOT VERIFIED.");
