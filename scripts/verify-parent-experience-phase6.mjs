import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("apps/mobile/App.tsx");
const ui=read("apps/mobile/src/parent-more.tsx");
const model=read("apps/mobile/src/parent-more-model.ts");
const mobileApi=read("apps/mobile/src/api.ts");
const server=read("apps/api/src/auth/routes.ts");
const families=read("apps/api/src/families/routes.ts");
const store=read("packages/database/src/communication-store.ts");
const locales=read("packages/localization/src/index.ts");
const phase=read("docs/PARENT-EXPERIENCE-PHASES.md");
const state=read("docs/PROJECT-STATE.md");

for(const marker of [
  'useState<ParentMoreTab>("FEES")',
  '<ParentFeesPanel', '<ParentProfilePanel', '<ParentSchoolPanel',
  '<ParentPreferencesPanel', 'parentDataChildId === selectedChildId ? parentFees : []',
  'parentDataChildId === selectedChildId', 'parentResourceStatus.fees',
  'retryParentResource("fees")', 'parentMoreTab === "FEES"',
  'parentMoreTab === "PROFILE"', 'parentMoreTab === "SCHOOL"',
  'setParentMoreTab("FEES")',
  'changeParentAccountPassword(', 'api.changeParentPassword(',
  'sessionRef.current = changed;', 'setSession(changed);',
  'saveStoredSession({ auth: changed, school: activeSchool })',
  'sameSessionEpoch(sessionRef.current, active, schoolRef.current, activeSchool)'
]) assert.ok(app.includes(marker),"Phase 6 app wiring missing: "+marker);

for(const marker of [
  'export function ParentFeesPanel', 'export function ParentProfilePanel',
  'export function ParentSchoolPanel', 'export function ParentPreferencesPanel',
  'parentFeeSummary(', 'visibleParentInvoices(', 'sortedParentPayments(',
  'accessibilityState={{expanded:open}}', 'onRetry={onRetry}',
  'formatLocalizedDate(', 'formatAfn(', 'getDirection(locale)',
  'AdminContactCard contact={contact}', 'parentPasswordValidation(',
  'await onChangePassword(current,next)', 'setCurrent("")',
  'supportedLocales.map(', 'onSelectLocale(code)', 'onLogout'
]) assert.ok(ui.includes(marker),"Phase 6 privacy/UX feature missing: "+marker);

for(const marker of [
  'row.invoice.status !== "DRAFT" && row.invoice.status !== "CANCELLED"',
  'row.outstanding > 0', 'status === "DRAFT"',
  'invoices.filter(', 'parentPasswordValidation(', 'current === next',
  'next !== confirm'
]) assert.ok(model.includes(marker),"Phase 6 model invariant missing: "+marker);

assert.ok(mobileApi.includes('"/v1/auth/change-password"') &&
  mobileApi.includes('body: JSON.stringify({ currentPassword, newPassword })'),
  "Change-password must call existing authenticated API without a new endpoint");
assert.ok(server.includes('verifyPassword(input.currentPassword, context.user.passwordHash)') &&
  server.includes('context.user.role === "SCHOOL_ADMIN"') &&
  server.includes('user.password_changed'),
  "Server password validation, role-specific 2FA and audit must remain authoritative");
assert.ok(families.includes('"/v1/parent/home"'),"Family linkage remains server-authorized");
assert.ok(store.includes('eq(feeInvoices.studentId, studentId)') &&
  store.includes('student.parentUserId !== parentUserId') &&
  store.includes('ne(feeInvoices.status, "DRAFT")'),
  "School-scoped parent-only issued invoices must remain authoritative");
for(const key of [
  "moreFees","moreProfile","moreSchool","morePreferences","moreFeesDescription",
  "moreBilled","moreLedgerHint","moreInvoices","moreUnpaid","moreAllInvoices",
  "morePaid","moreNoFilteredFees","moreIssuedOn","morePaymentHistory","moreNoPayments",
  "moreReference","moreReversalReason","morePaymentHelp","moreProfileHint",
  "moreParentAccount","moreUsername","moreNotProvided","moreManagedBySchool",
  "moreLinkedChildren","moreSchoolHint","moreSchoolCode","moreProvince","moreCity",
  "moreSchoolContactHelp","moreLanguage","moreLanguageHint","moreSecurity",
  "moreSecurityHint","moreCurrentPassword","moreNewPassword","moreConfirmPassword",
  "morePasswordRules","moreCurrentRequired","moreSamePassword","morePasswordLength",
  "moreChangePassword","morePasswordFailed","morePasswordChanged",
  "moreLogoutTitle","moreLogoutConfirm"
]) assert.equal(locales.split(JSON.stringify("parent."+key)+":").length,4,
  "Phase 6 copy missing English/Dari/Pashto: parent."+key);
assert.ok(phase.includes("## Phase 6") && phase.includes("NO-GO"));
assert.ok(state.includes("Parent Experience — Phase 6"));
console.log("Parent Phase 6 parent-only finance, preferences, password security, RTL, localization and release guards passed.");
