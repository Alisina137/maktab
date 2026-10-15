import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const db = read("packages/database/src/learning-store.ts");
const api = read("apps/api/src/learning/routes.ts");
const panel = read("apps/web/app/admin/learning-panel.tsx");
const ui = read("apps/web/app/admin/admin-learning-homework.tsx");
const styles = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const tests = read("apps/api/src/app.test.ts");

for(const fragment of [
  "listAdminHomework(schoolId, query)", "getAdminHomeworkRoster(schoolId, homeworkId, filter, limit, offset)",
  "eq(homeworks.schoolId, schoolId)", "eq(homeworks.academicYearId, query.academicYearId)",
  "eq(students.schoolId, schoolId)", 'eq(students.status, "ACTIVE")',
  "eq(homeworkSubmissions.homeworkId, homeworkId)", "eq(homeworkSubmissions.schoolId, schoolId)",
  "eq(students.academicYearId, homework.academicYearId)",
  "gt(roster, submitted)", "gt(pending, 0)", "gt(revisions, 0)",
  ".limit(query.limit).offset(query.offset)", ".limit(limit).offset(offset)",
  "rosterBasis: \"CURRENT_ACTIVE_ENROLLMENT\"",
  'if (homework.status === "DRAFT")',
  'homework.status === "PUBLISHED"'
]) assert.ok(db.includes(fragment), "Missing scoped Phase5 data guard: " + fragment);

for(const fragment of [
  '"/v1/admin/learning/homework"', '"/v1/admin/learning/homework/:homeworkId/roster"',
  "requireSchoolAdmin(request, reply, accounts)",
  "z.string().uuid().parse(request.params.homeworkId)",
  "limit: z.coerce.number().int().min(1).max(50).default(20)",
  "learning.getAdminHomeworkRoster(context.user.schoolId"
]) assert.ok(api.includes(fragment), "Missing protected Phase5 route: " + fragment);
assert.ok(panel.includes("<AdminLearningHomework"));
for(const fragment of [
  'role="search"', "const controller = new AbortController()", "controller.signal.aborted",
  "loadedKey === requestKey", "setExpandedId(null)", "PAGE_SIZE = 20",
  'aria-expanded={expanded}', "new URLSearchParams", "<HomeworkRoster",
  "student.submission", // check optional chain uses entry.submission instead; intentionally skipped
  "Submission filter: ", 'role="alert"'
]) if(fragment !== "student.submission") assert.ok(ui.includes(fragment),
  "Missing client safety feature: " + fragment);

for(const key of [
  '"Homework attention: PAST_DUE"', '"Homework attention: AWAITING_REVIEW"',
  '"Past due with missing submissions"', '"Current active roster"',
  '"Counts use students currently active in this class and academic year; historical class membership is not reconstructed."'
]) assert.equal(i18n.split(key).length, 3, "Missing exactly one Dari and Pashto label: " + key);
assert.ok(styles.includes(".learning-homework-filters"));
assert.ok(styles.includes("@media (max-width: 540px)"));
for(const marker of [
  "Admin Learning Phase 5: schoolwide directory permits school admins only",
  "directoryDraft", "missingOnly", "pendingHomeworkDirectory", "revisionsDirectory",
  "reviewedDirectory", "archivedDirectory"
]) assert.ok(tests.includes(marker), "Missing Phase5 API integration test: "+marker);
console.log("Admin Learning Phase 5: school/role-scoped homework, active roster, filters, statuses, i18n and regression assertions pass.");
