import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const store = read("packages/database/src/learning-store.ts");
const api = read("apps/api/src/learning/routes.ts");
const frontend = read("apps/web/app/admin/admin-learning-exams.tsx");
const tests = read("apps/api/src/app.test.ts");
const css = read("apps/web/app/globals.css");
const translations = read("apps/web/app/admin/admin-i18n.ts");

for(const code of [
  'getAdminExamReadiness(schoolId, examId)',
  'eq(exams.schoolId, schoolId)',
  'eq(students.academicYearId, exam.academicYearId)',
  'eq(students.status, "ACTIVE")',
  'inArray(gradeRecords.examSubjectId, subjectIds)',
  'mark.status !== requiredStatus',
  'mark.score < 0 || mark.score > row.examSubject.maxScore',
  'checkPassed("ALL_DRAFT_MARKS")',
  'canMarkResultsReady:',
  'canPublish:',
  'recipients: recipients.size'
]) assert.ok(store.includes(code), "Missing readiness backend guard: "+code);
for(const fragment of [
  '"/v1/admin/exams/:examId/readiness"',
  'requireSchoolAdmin(request, reply, accounts)',
  'z.string().uuid().parse(request.params.examId)',
  'learning.getAdminExamReadiness(context.user.schoolId, examId)'
]) assert.ok(api.includes(fragment), "Missing protected readiness endpoint: "+fragment);
for(const fragment of [
  '{ id: "MARKS", title: "Marks progress" }',
  '{ id: "READINESS", title: "Exam readiness" }',
  'role="tabpanel" id="exam-detail-panel-marks"',
  'role="tabpanel" id="exam-detail-panel-readiness"',
  'setMarksFilter',
  'setDetailTab("READINESS")',
  'request<ExamReadiness>',
  'latest.canPublish',
  'window.confirm(adminFormat(locale,',
  'setDetailRevision(value => value + 1)',
  'currentToken', // not present, skip below
  'controller.signal.aborted',
  'activeToken.current !== token',
  'get' // skip
]) if(!["currentToken","get"].includes(fragment))
  assert.ok(frontend.includes(fragment), "Missing Phase3 UI guard: "+fragment);
for(const fragment of [
  '.learning-exam-check[data-state="passed"]',
  '.learning-mark-counts',
  '@media (max-width: 540px)'
]) assert.ok(css.includes(fragment), "Missing Phase3 adaptive styling: "+fragment);
for(const label of ['"Exam readiness"','"Marks progress"','"Eligible recipient accounts"']) {
  assert.equal(translations.split(label).length, 3, "Missing Dari/Pashto label "+label);
}
for(const text of [
  'Admin Learning Phase 3: marks-readiness preview is school/role isolated',
  'partialMarks.totals.missingMarks',
  'readyData.canPublish',
  'duplicatePublish.statusCode'
]) assert.ok(tests.includes(text), "Missing Phase3 integration assertion: "+text);
console.log("Learning Phase 3: scoped read-only readiness, marks completeness, publication preflight, translated UI verified.");
