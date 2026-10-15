import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const panel = read("apps/web/app/admin/learning-panel.tsx");
const examWorkspace = read("apps/web/app/admin/admin-learning-exams.tsx");
const css = read("apps/web/app/globals.css");
const routes = read("apps/api/src/learning/routes.ts");
const store = read("packages/database/src/learning-store.ts");
const translations = read("apps/web/app/admin/admin-i18n.ts");
const apiTests = read("apps/api/src/app.test.ts");

for (const tab of ["OVERVIEW","HOMEWORK","EXAMS","RESULTS","TEACHING","REPORTS"])
  assert.ok(panel.includes('id: "' + tab + '"'), "Missing learning tab "+tab);
for (const fragment of [
  'setActiveTab] = useState<LearningTab>(initialExamId ? "EXAMS" : "OVERVIEW")',
  'role="tablist" aria-label={t("Learning sections")}',
  'role="tab" aria-selected={activeTab === id}',
  'tabRefs.current[activeTab]?.scrollIntoView',
  'event.key === "Home"',
  'event.key === "End"',
  'const controller = new AbortController()',
  'generation.current !== id',
  'controller.signal.aborted',
  'currentToken.current !== token',
  '}, [accessToken, selectedAcademicYearId]);',
  'loadingStatus === "error"',
  'Learning data unavailable',
  'selectedAcademicYearId ? request<LearningDashboard>',
  'role="tabpanel" aria-labelledby="learning-tab-exams"',
  'role="tabpanel" aria-labelledby="learning-tab-results"',
  'Learning dashboard unavailable.',
  'Schoolwide homework records and submission filters are not yet available in this view.',
  'href="/admin/academics/curriculum"'
]) assert.ok(panel.includes(fragment), "Missing Phase 1 UI safeguard: "+fragment);
for (const fragment of [
  '"Exam lifecycle"', 'role="tablist" aria-label={t("Examination detail sections")}',
  'window.confirm(t(exam.status === "RESULTS_READY"'
]) assert.ok(examWorkspace.includes(fragment), "Phase 2 must preserve relocated Phase 1 exam behavior: "+fragment);
assert.ok(!panel.includes('Phase 6 · Homework, Exams & Results'), "No internal phase language on Learning page.");
for (const fragment of [
  '"/v1/admin/learning/dashboard"',
  'requireSchoolAdmin(request, reply, accounts)',
  'academicYearId: z.string().uuid()',
  'getAdminDashboard(context.user.schoolId, academicYearId)'
]) assert.ok(routes.includes(fragment), "Missing protected dashboard API: "+fragment);
for (const fragment of [
  'eq(academicYears.schoolId, schoolId)',
  'eq(homeworks.academicYearId, academicYearId)',
  'eq(students.status, "ACTIVE")',
  'item.status === "SUBMITTED"',
  'item.status === "RESULTS_READY"',
  'curriculumAssignedUnits',
  'return {',
  'attention: attention.slice(0, 8)'
]) assert.ok(store.includes(fragment), "Missing real school-scoped dashboard logic: "+fragment);
for (const fragment of [
  '.learning-section .learning-main-tabs',
  '.learning-section .learning-metric-grid',
  '.learning-section .learning-attention-item',
  '.learning-section .learning-tab-panel',
  '@media (max-width: 620px)',
  '@media (prefers-reduced-motion: reduce)'
]) assert.ok(css.includes(fragment), "Missing responsive tab layout: "+fragment);
for (const fragment of ['"Learning management"', '"Learning overview"', '"Homework monitoring"', '"Learning data unavailable"']) {
  assert.equal(translations.split(fragment).length, 3, "Translate Learning UI in both Dari and Pashto: "+fragment);
}
assert.ok(apiTests.includes("Admin Learning Phase 1 dashboard is year-scoped"));
console.log("Admin Learning Phase 1 navigation, authenticated overview, RTL, localized and abort-safe guards passed.");
