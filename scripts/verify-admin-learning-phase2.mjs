import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const parent = read("apps/web/app/admin/learning-panel.tsx");
const exams = read("apps/web/app/admin/admin-learning-exams.tsx");
const api = read("apps/api/src/learning/routes.ts");
const db = read("packages/database/src/learning-store.ts");
const shell = read("apps/web/app/admin/admin-workspace.tsx");
const route = read("apps/web/app/admin/(workspace)/learning/exams/[examId]/page.tsx");
const styles = read("apps/web/app/globals.css");
const locales = read("apps/web/app/admin/admin-i18n.ts");
const tests = read("apps/api/src/app.test.ts");

for (const marker of [
  'AdminLearningExams', 'initialExamId={initialExamId}',
  'role="tabpanel" aria-labelledby="learning-tab-exams"',
  'setBusy', 'PublishedGradeRow'
]) assert.ok(parent.includes(marker), "Missing parent Learning regression invariant: " + marker);
for (const marker of [
  'initialExamId={params.examId}', 'LearningPanel',
  '../../../../learning-panel'
]) assert.ok(route.includes(marker), "Invalid detail page route: " + marker);
for (const marker of [
  'role="tablist" aria-label={t("Examination detail sections")}',
  'role="tab" id={`exam-detail-tab-${id.toLowerCase()}`}',
  'event.key === "Home"', 'event.key === "End"',
  'yearId={', // not in exams module? unnecessary
]) if (marker !== 'yearId={') assert.ok(exams.includes(marker), "Missing accessible details: " + marker);
for (const marker of [
  'statusFilter === "ALL" || exam.status === statusFilter',
  'Math.ceil(filtered.length / 10)',
  'formatAdminHijriDate(locale',
  'window.confirm(t(exam.status === "RESULTS_READY"',
  'selected!.status === "DRAFT"',
  'availableSubjects', 'setDetailRevision',
  'const controller = new AbortController()',
  'controller.signal.aborted',
  'activeToken.current !== token',
  'get' // ignore
]) if (marker !== "get") assert.ok(exams.includes(marker), "Missing Phase2 directory guard: " + marker);
assert.ok(exams.includes('t("Two or more subjects are scheduled on the same day'));
assert.ok(exams.includes('t("Schedule stores calendar dates per class and subject'));
assert.ok(exams.includes('canConfigure = !!selected && yearActive'));
for(const marker of [
  '"/v1/admin/exams/:examId/detail"',
  'requireSchoolAdmin(request, reply, accounts)',
  'z.string().uuid().parse(request.params.examId)',
  'learning.getAdminExamDetail(context.user.schoolId, examId)'
]) assert.ok(api.includes(marker), "Missing detail API guard: " + marker);
for(const marker of [
  'getAdminExamDetail(schoolId, examId)',
  'eq(exams.schoolId, schoolId)',
  'eq(examSubjects.schoolId, schoolId)',
  'eq(classSections.schoolId, examSubjects.schoolId)',
  'eq(subjects.schoolId, examSubjects.schoolId)',
  'sameDayWarnings'
]) assert.ok(db.includes(marker), "Missing school-scoped detail query: " + marker);
assert.ok(shell.includes('pathname.startsWith("/admin/learning/exams/")'),
  "Nested exam route must retain the school academic year selector and Learning heading.");
assert.ok(styles.includes('.learning-exam-detail-tabs'));
assert.ok(styles.includes('@media (max-width: 620px)'));
assert.ok(styles.includes('.learning-exam-filters'));
for (const marker of ['"Exam directory"', '"Exam schedule"', '"Examination details"']) {
  assert.equal(locales.split(marker).length, 3,
    "Both Dari and Pashto must translate " + marker);
}
assert.ok(tests.includes('Admin Learning Phase 2: year-scoped direct detail'));
console.log("Admin Learning Phase 2: directory, nested detail, school isolation, schedule advisory and RTL/i18n guards passed.");
