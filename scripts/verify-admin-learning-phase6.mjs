import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const db = read("packages/database/src/admin-teaching-progress-store.ts");
const teachingStore = read("packages/database/src/teacher-teaching-store.ts");
const api = read("apps/api/src/teaching/routes.ts");
const panel = read("apps/web/app/admin/learning-panel.tsx");
const ui = read("apps/web/app/admin/admin-learning-teaching.tsx");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const tests = read("apps/api/src/app.test.ts");

for (const fragment of [
  "listAdminTeachingProgress(schoolId, query)",
  "listAdminTeachingUnits(schoolId, yearId, assignmentId, status, limit, offset)",
  "listAdminTeachingLessons(schoolId, yearId, assignmentId, status, limit, offset)",
  "eq(academicYears.schoolId, schoolId)", "eq(teacherAssignments.schoolId, schoolId)",
  "eq(teacherAssignments.academicYearId, query.academicYearId)",
  "eq(curriculumUnits.academicYearId, yearId)", "eq(teacherUnitProgress.assignmentId, assignmentId)",
  "eq(teacherLessonPlans.assignmentId, assignmentId)", "eq(teacherLessonPlans.schoolId, schoolId)",
  "eq(curriculumUnits.subjectId, assignment.subjectId)",
  "Missing progress means NOT_STARTED",
  'status: row.trackedStatus ?? "NOT_STARTED"',
  'if (!assignment) throw new TeachingNotFoundError',
  ".limit(query.limit).offset(query.offset)", ".limit(limit).offset(offset)",
  "summary: {", "noCurriculum", "postponedLessons", "lessonCompleted",
  'query.focus === "INCOMPLETE"', 'query.focus === "POSTPONED"'
]) assert.ok(db.includes(fragment), "Missing Phase 6 data guard: " + fragment);
assert.ok(teachingStore.includes("extends AdminTeachingProgressStore"));
assert.ok(teachingStore.includes("...createAdminTeachingProgressStore(db)"));

for (const fragment of [
  '"/v1/admin/teaching/progress"',
  '"/v1/admin/teaching/progress/:assignmentId/units"',
  '"/v1/admin/teaching/progress/:assignmentId/lessons"',
  "requireSchoolAdmin(request, reply, accounts)",
  "progressFilters.parse(request.query)",
  "uuid.parse(request.params.assignmentId)",
  "limit: z.coerce.number().int().min(1).max(50).default(20)"
]) assert.ok(api.includes(fragment), "Missing admin Phase 6 API validation: "+fragment);
assert.ok(panel.includes("<AdminLearningTeaching"));

for (const fragment of [
  'role="search"', "new AbortController()", "controller.signal.aborted",
  "loadedKey === requestKey", "setExpandedId(null)", "PAGE_SIZE = 20",
  'aria-expanded={expanded}', "new URLSearchParams", "<TeachingDetail",
  'role="tablist"', 'role="status"', 'role="alert"',
  'href="/admin/academics/curriculum"', "<progress",
  "No chapter deadlines or pacing targets are recorded."
]) assert.ok(ui.includes(fragment), "Missing safe Teaching Progress UI control: "+fragment);

for (const marker of [
  ".learning-teaching-workspace",".learning-teaching-overview",
  ".learning-teaching-detail-switch", "@media (max-width: 460px)"
]) assert.ok(css.includes(marker), "Missing Phase6 responsive layout: "+marker);

for (const key of [
  '"Teaching focus: NO_CURRICULUM"', '"Teaching focus: NOT_STARTED"',
  '"Teaching focus: POSTPONED"', '"No chapter deadlines or pacing targets are recorded. Attention filters flag gaps, not verified teaching delays."',
  '"Unit status: IN_PROGRESS"', '"Lesson status: POSTPONED"'
]) assert.equal(i18n.split(key).length, 3, "Missing exactly one Dari and Pashto translation: "+key);

for (const marker of [
  "Admin Learning Phase 6: read-only school/year-scoped teaching progress.",
  "progressOtherAdmin", "emptyTeaching", "focusNotStarted", "completedTeaching",
  "postponedTeaching", "completedChapter", "postponedPlans"
]) assert.ok(tests.includes(marker), "Missing Phase 6 integration assertion: "+marker);
console.log("Admin Learning Phase 6: read-only scoped teaching, curriculum metrics, lesson progress, responsive RTL and regression guards pass.");
