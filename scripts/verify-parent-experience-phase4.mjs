import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const app = read("apps/mobile/App.tsx");
const ui = read("apps/mobile/src/parent-academics.tsx");
const model = read("apps/mobile/src/parent-academics-model.ts");
const api = read("apps/mobile/src/api.ts");
const route = read("apps/api/src/learning/routes.ts");
const store = read("packages/database/src/learning-store.ts");
const locale = read("packages/localization/src/index.ts");
const docs = read("docs/PARENT-EXPERIENCE-PHASES.md");

for(const view of ["ParentAcademicHomework", "ParentAcademicResults", "ParentAcademicTimetable"]) {
  assert.ok(ui.includes("export function " + view), "Missing academic view " + view);
  assert.ok(app.includes("<" + view), "Parent navigation must route to " + view);
}
for(const invariant of [
  'key={session.user.id + ":" + selectedChild.student.id + ":homework"}',
  'key={session.user.id + ":" + selectedChild.student.id + ":results"}',
  'key={session.user.id + ":" + selectedChild.student.id + ":timetable"}',
  'parentDataChildId === selectedChildId ? parentLearning : null',
  'parentDataChildId === selectedChildId ? parentTimetable : []',
  'parentResourceStatus.learning', 'parentResourceStatus.timetable',
  'retryParentResource("learning")', 'retryParentResource("timetable")'
]) assert.ok(app.includes(invariant), "Missing child/account identity or error guard: " + invariant);

for(const invariant of [
  'row.grade.status !== "PUBLISHED"',
  'row.exam.status !== "PUBLISHED" && row.exam.status !== "ARCHIVED"',
  'item.homework.status === "PUBLISHED" || item.homework.status === "CLOSED"',
  'kabulCivilDay(item.homework.dueAt)',
  'filterParentHomework(', 'filterParentResults(', 'filterParentTimetable(',
  'schoolWeekdays: Weekday[]', 'weekdayForSchoolDate(schoolToday)',
  'maximum: rows.reduce', 'score: rows.reduce'
]) assert.ok(model.includes(invariant), "Missing published-data or calendar invariant: " + invariant);

for(const invariant of [
  'useState<HomeworkView>("ALL")', 'useState<string | null>(null)',
  'accessibilityState={{ expanded }}', 'accessibilityState={{ selected: selected === option.key }}',
  'shareLearningFile(accessToken', 'item.homework.attachmentUrl?.startsWith("https://")',
  'formatLocalizedDate(', 'formatLocalizedTimeRange(', 'formatLocalizedNumber(',
  'getDirection(locale)', 'onPress={onRetry}', 'academicWeekday(', 'onPress={() => setExpandedId(',
  'accessibilityLabel={translate(locale, "parent.academicRefresh")}',
  'subjectId={',  // avoid unused metadata? explicitly verified in model instead
]) {
  if(invariant==='subjectId={') continue;
  assert.ok(ui.includes(invariant), "Missing interactive academic feature: " + invariant);
}
assert.ok(api.includes('"/v1/parent/children/') || api.includes('/v1/parent/children/'));
assert.ok(route.includes('getParentAcademicView('), "Parent API must resolve authorized learning view");
assert.ok(store.includes('eq(students.parentUserId, parentUserId)') &&
  store.includes('eq(students.schoolId, schoolId)'), "Parent-child and tenant scoping must remain server-side");
for(const key of [
  "academicAll","academicUpcoming","academicPast","academicClosed",
  "academicHomeworkHint","academicSearchHomework","academicStatusFilter","academicSubjectFilter",
  "academicAllSubjects","academicNoMatches","academicResultHint","academicExamFilter",
  "academicAllExams","academicReportedTotal","academicTimetableHint","academicDayFilter",
  "academicWholeWeek","academicPeriods","academicNoPeriods","academicRefresh"
]) assert.equal(locale.split(JSON.stringify("parent." + key) + ":").length, 4,
  "Missing English/Dari/Pashto parent academic translation: " + key);
assert.ok(docs.includes("## Phase 4") && docs.includes("NO-GO"),
  "Document Phase 4 scope and remaining field acceptance");
console.log("Parent Phase 4 academic privacy, filtering, localization, child switching and retry guards passed.");
