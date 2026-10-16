import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const guide = read("apps/web/app/admin/pilot-onboarding-guide.tsx");
const pilot = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const store = read("packages/database/src/family-store.ts");
const api = read("apps/api/src/families/routes.ts");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const tests = read("apps/api/src/app.test.ts");

const steps = [
  "school", "year", "classes", "teachers", "assignments",
  "parents", "students", "family_links", "timetable", "negaran"
];
for (const step of steps) {
  assert.ok(guide.includes('key: "' + step + '"'), "Missing onboarding step " + step);
}
assert.ok(guide.includes('stateFromCoverage("teaching")') &&
  guide.includes('stateFromCoverage("family_links")') &&
  guide.includes('stateFromCoverage("timetable")') &&
  guide.includes('stateFromCoverage("negaran")'),
"Advanced steps must use live server coverage rather than local status toggles");
assert.ok(guide.includes('coverage("student_logins")?.total'),
  "Student onboarding population must be scoped to the current active academic year");
assert.ok(guide.includes('metric.total > 0 && metric.missing === 0'),
  "Zero-denominator checks cannot count as completed");
assert.ok(guide.includes(' : "unknown"') &&
  guide.includes('Data quality is unavailable; no all-clear can be confirmed.'),
  "Unknown coverage must not be represented as complete");
assert.ok(guide.includes('No outstanding issues in these seven data-quality checks.') &&
  guide.includes('issues.every((item) => (item.metric?.total ?? 0) > 0)'),
  "All-clear requires actual eligible records in every checked category");
assert.ok(guide.includes('href="/admin/pilot/readiness"') &&
  guide.includes('href={item.href}'),
  "Quality findings and next setup steps must be actionable");
assert.ok(pilot.includes("<PilotOnboardingGuide") &&
  pilot.includes('section === "onboarding" && readiness'),
  "The new guide must only appear on the authenticated Data Onboarding page");

assert.ok(api.includes('"/v1/admin/families/import/history"') &&
  api.includes("requireSchoolAdmin(request, reply, accounts)"),
  "History is school-admin only");
for (const q of [
  "status: z.enum", "dateFrom: importHistoryDateSchema",
  "dateTo: importHistoryDateSchema", "actor: z.string().trim().min(2).max(64)",
  '}).strict().refine(', 'T00:00:00+04:30', 'cache-control'
]) assert.ok(api.includes(q), "Missing strict import history query guard: " + q);
for (const q of [
  "eq(familyImportBatches.schoolId, schoolId)",
  "eq(familyImportBatches.status, options.status)",
  "gte(familyImportBatches.createdAt, options.dateFrom)",
  "lt(familyImportBatches.createdAt, options.dateToExclusive)",
  "ilike(users.username", ".limit(options.limit + 1).offset(options.offset)"
]) assert.ok(store.includes(q), "Server-side filter missing: " + q);
assert.ok(pilot.includes("importHistoryRequestVersion.current") &&
  pilot.includes("filters.entityType") && pilot.includes("filters.status") &&
  pilot.includes("filters.actor.trim()") && pilot.includes("filters.dateFrom") &&
  pilot.includes("filters.dateTo") && pilot.includes("setImportAppliedFilters") &&
  pilot.includes("clearImportFilters"), "UI must persist applied filters across pagination and retries");
assert.ok(pilot.includes('onChange={(date) => setImportDraftFilters') &&
  pilot.includes("<AdminHijriDatePicker"),
  "Localized date pickers must be used for history filters");
assert.ok(tests.includes("Pilot Operations Data Onboarding refinement") &&
  tests.includes("&status=COMPLETED") && tests.includes("&actor=") &&
  tests.includes("&dateFrom=2000-01-01") && tests.includes("statusCode, 400, invalid"),
  "API tests must cover status, actor, dates and invalid query input");
assert.ok(css.includes(".pilot-guide-list") && css.includes(".pilot-quality-grid") &&
  css.includes(".pilot-import-filters-expanded") && css.includes("@media (max-width: 510px)"),
  "Guide, quality and history filters require mobile layout");
const fa = i18n.split('const fa: Record<string, string> = {')[1]?.split('const ps: Record<string, string> = {')[0];
const ps = i18n.split('const ps: Record<string, string> = {')[1]?.split("export function adminText(")[0];
for(const key of [
  "School onboarding checklist", "Continue setup", "Data quality",
  "Enrollment and account quality", "Import outcome", "Administrator username",
  "Data quality is unavailable; no all-clear can be confirmed."
]) {
  assert.ok(fa?.includes(JSON.stringify(key) + ":") && ps?.includes(JSON.stringify(key) + ":"),
    "Missing Dari/Pashto translation: " + key);
}
assert.ok(!pilot.includes("/v1/platform/"), "No platform credentials or endpoints in school UI");
console.log("Pilot Operations Data Onboarding refinement Phase 3 source guards passed.");
