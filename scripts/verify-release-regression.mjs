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
const detailsDrawer = read("apps/web/app/admin/admin-account-details-drawer.tsx");
const actionConfirm = read("apps/web/app/admin/admin-account-action-confirm.tsx");
const userRoutes = read("apps/api/src/users/routes.ts");
const accountStoreSource = read("packages/database/src/account-store.ts");
const detailsData = read("apps/web/app/admin/account-details-data.ts");
const detailsTests = read("apps/api/src/account-details-data.test.ts");
const directoryUi = read("apps/web/app/admin/admin-account-directory.tsx");
const bulkConfirm = read("apps/web/app/admin/admin-account-bulk-confirm.tsx");
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
  accountPage.includes('summaryCounts.pending') &&
  accountPage.includes('adminApi<AccountDirectoryResult>') &&
  accountPage.includes('onClick={() => selectSummary(summary.id)}'),
  "Account overview status cards must be derived from users and be actionable");
assert.ok(directoryUi.includes('role="group" aria-label={t("Account role")}') &&
  directoryUi.includes('aria-pressed={group === value}'),
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
/* Admin Accounts Phase 3: role-linked account details and safe navigation. */
assert.ok(accountPage.includes('selectedAccountId') &&
  accountPage.includes('<AdminAccountDetailsDrawer') &&
  accountPage.includes('familyOverview') &&
  directoryUi.includes('className="admin-account-view-details"'),
  "Accounts must expose a selection-preserving account details experience");
assert.ok(detailsDrawer.includes('role="dialog"') &&
  detailsDrawer.includes('aria-modal="true"') &&
  detailsDrawer.includes('event.key === "Escape"') &&
  detailsDrawer.includes('previousFocus?.focus()') &&
  detailsDrawer.includes('document.body.style.overflow = previousOverflow'),
  "Account details drawer must handle screen reader modal semantics, Escape, focus restore and scrolling");
assert.ok(detailsDrawer.includes('/v1/admin/academics') &&
  detailsDrawer.includes('href="/admin/families"') &&
  detailsDrawer.includes('href="/admin/academics/teachers"') &&
  detailsDrawer.includes('href="/admin/profile"'),
  "Account detail teacher/family data and canonical edit navigation missing");
assert.ok(detailsData.includes('row.student.parentUserId === userId') &&
  detailsData.includes('row.student.userId === userId') &&
  detailsData.includes('row.teacherUserId === userId') &&
  !detailsDrawer.includes('passwordHash'),
  "Account detail joins must be per user and must not expose password hashes");
assert.ok(detailsTests.includes('teacher assignments and Negaran remain scoped to selected teacher') &&
  detailsTests.includes('parent lists only explicitly linked children'),
  "Account relationship regression tests are missing");
assert.ok(css.includes('.account-detail-drawer[dir="rtl"]') &&
  css.includes('.account-detail-close:focus-visible') &&
  css.includes('.account-detail-facts'),
  "Account detail RTL, focus and responsive styles missing");
for (const key of ['"Account details":', '"View details":',
  '"Linked children":', '"Teacher profile and assignments":', '"Manage families":']) {
  assert.ok(adminTranslations.split(key).length >= 3,
    `Account Phase3 missing a Dari or Pashto translation: ${key}`);
}
/* Admin Accounts Phase 4 — confirm and audit user lifecycle mutations. */
assert.ok(accountPage.includes('<AdminAccountActionConfirm') &&
  accountPage.includes('setPendingAction({ user, action })') &&
  accountPage.includes('onConfirm={(reason) => void executeAction(reason)}'),
  "Phase4 account actions must require an explicit confirmation");
assert.ok(actionConfirm.includes('role="alertdialog"') &&
  actionConfirm.includes('aria-modal="true"') &&
  actionConfirm.includes('Suspension reason (optional)') &&
  actionConfirm.includes('event.key === "Escape"') &&
  actionConfirm.includes('onCancel'),
  "Phase4 confirmations need accessible dismissal and an optional reason");
assert.ok(userRoutes.includes('suspendAccountSchema') &&
  userRoutes.includes('/v1/admin/users/:userId/audit') &&
  userRoutes.includes('already_suspended') &&
  userRoutes.includes('not_suspended'),
  "Phase4 API must validate lifecycle transitions and expose scoped user history");
assert.ok(accountStoreSource.includes('status === "SUSPENDED"') &&
  accountStoreSource.includes('status === "ACTIVE"') &&
  accountStoreSource.includes('async listAccountAuditLogs(schoolId, userId') &&
  accountStoreSource.includes('eq(auditLogs.schoolId, schoolId)') &&
  accountStoreSource.includes('metadata: reason ? { reason } : {}'),
  "Phase4 store must revoke sessions transactionally and keep audit tenant scoped");
assert.ok(detailsDrawer.includes('account-detail-audit-list') &&
  detailsDrawer.includes('/audit?limit=25') &&
  detailsDrawer.includes('actorUserId'),
  "Phase4 details must show the actor, reason, and account history");
assert.ok(api.includes('Phase 4 account lifecycle confirms reasons') &&
  accounts.includes('admin status transition stores suspension reason'),
  "Phase4 API and datastore lifecycle regressions are missing");
for (const key of ['"Confirm password reset":', '"Confirm suspension":',
  '"Account history":', '"Suspension reason (optional)":', '"Performed by":']) {
  assert.ok(adminTranslations.split(key).length >= 3,
    `Account Phase4 missing a Dari or Pashto translation: ${key}`);
}
/* Admin Accounts Phase 5: server pagination and atomic batch selection. */
assert.ok(accountPage.includes('/v1/admin/users/directory?') &&
  accountPage.includes('new AbortController()') &&
  accountPage.includes('setDebouncedQuery(query.trim())') &&
  accountPage.includes('setSelectedIds(new Set())'),
  "Account directory must use abortable, debounced server pagination and reset page selection");
assert.ok(accountPage.includes('/v1/admin/users/username-check?') &&
  accountPage.includes('<AdminAccountBulkConfirm') &&
  accountPage.includes('/v1/admin/users/bulk-status'),
  "Phase5 must check school usernames and require explicit bulk confirmation");
assert.ok(directoryUi.includes('onSelectPage(eligiblePage.map') &&
  directoryUi.includes('user.role !== "SCHOOL_ADMIN"') &&
  directoryUi.includes('pageSize') &&
  directoryUi.includes('sortBy') &&
  directoryUi.includes('role="region" aria-label={t("Bulk account actions")}'),
  "Phase5 directory must have safe current-page-only selection and sorting controls");
assert.ok(bulkConfirm.includes('role="alertdialog"') &&
  bulkConfirm.includes('Changes are all-or-nothing.'),
  "Bulk account actions require an accessible confirmation dialog and atomic disclosure");
assert.ok(userRoutes.includes('/v1/admin/users/directory') &&
  userRoutes.includes('/v1/admin/users/username-check') &&
  userRoutes.includes('/v1/admin/users/bulk-status') &&
  userRoutes.includes('accountBatchSchema.parse(request.body)'),
  "Phase5 API routes and payload validation missing");
assert.ok(accountStoreSource.includes('async searchUserDirectory(schoolId, input)') &&
  accountStoreSource.includes('eq(users.schoolId, schoolId)') &&
  accountStoreSource.includes('async bulkSetUserStatusAsAdmin') &&
  accountStoreSource.includes('AccountBatchConflictError') &&
  accountStoreSource.includes('tx.insert(auditLogs).values(updated.map'),
  "Phase5 SQL scoping, transactional lifecycle, and audit must remain");
assert.ok(accounts.includes('Phase 5 directory paging, school counts') &&
  accounts.includes('Phase 5 batch actions are atomic') &&
  api.includes('Phase 5 bulk API enforces school scope'),
  "Phase5 backend regression tests are missing");
assert.ok(css.includes('.account-directory-pagination') &&
  css.includes('.account-directory-bulk-toolbar') &&
  css.includes('.account-bulk-preview'),
  "Phase5 responsive list, selection, or bulk confirmation styling missing");
for (const key of ['"Accounts per page":', '"Bulk account actions":',
  '"Confirm bulk suspension":', '"Select current page":', '"Ascending":']) {
  assert.ok(adminTranslations.split(key).length >= 3,
    `Account Phase5 missing a Dari or Pashto translation: ${key}`);
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
