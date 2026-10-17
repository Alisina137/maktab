import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const model=read("apps/mobile/src/student-home-model.ts");
const dashboard=read("apps/mobile/src/student-dashboard.tsx");
const app=read("apps/mobile/App.tsx");
const homework=read("apps/mobile/src/student-homework.tsx");
const submission=read("apps/mobile/src/student-submission.tsx");
const locale=read("packages/localization/src/index.ts");
const tests=read("scripts/test-student-home-phase2.ts");
const packageJson=JSON.parse(read("package.json"));
const workflow=read(".github/workflows/student-navigation.yml");

for(const key of [
  "studentSchoolClock(","studentTodayLessons(","studentLessonFocus(",
  "studentHomeworkOverview(","studentDueDay(","studentPublishedResults(",
  "studentAcademicOverview(","studentLatestAnnouncement(",
  'timeZone:"Asia/Kabul"', 'item.homework.status==="PUBLISHED"',
  'submission.status==="REVISION_REQUESTED"',
  'item.grade.status==="PUBLISHED"',
  'item.exam.status==="ARCHIVED"',
  'item.audienceScope!=="CLASS"'
])assert.ok(model.includes(key),"Student Phase 2 model missing "+key);
for(const key of [
  'testID="student-home-dashboard-phase2"',
  'testID="student-home-featured-lesson"',
  'testID="student-home-urgent-homework"',
  "studentLessonFocus(timetable,now)",
  "studentHomeworkOverview(learning?.homework??[],submissions,now)",
  "studentAcademicOverview(studentVisibleResults(learning))",
  "studentLatestAnnouncement(announcements,student?.classId??null)",
  "setInterval(()=>setNow(new Date()),60_000)",
  "student.homeAtGlance","student.homeUpcomingTasks",
  "student.homeAcademicProgress","student.homeSchoolUpdates",
  "onOpenHomework","onOpenTimetable","onOpenResults","onOpenAnnouncements"
])assert.ok(dashboard.includes(key),"Student Phase 2 dashboard missing "+key);
for(const key of [
  "api.studentHomeworkSubmissions(accessToken)",
  "setStudentSubmissions(",
  "setStudentSubmissionsReady(true)",
  "submitted.studentId!==studentLearning?.student.id",
  "submissions={studentSubmissions}",
  "submissionsReady={studentSubmissionsReady}",
  'onSubmitted={(submitted)=>'
])assert.ok(app.includes(key),"Student submission state or scope missing "+key);
assert.ok(homework.includes("onSubmitted={onSubmitted}"));
assert.ok(submission.includes("onSubmitted?.(result.submission)"));
for(const key of [
  "student.homeCurrentLesson","student.homeNextLesson","student.homeLessonsFinished",
  "student.homeAtGlance","student.homeClassesToday","student.homePendingHomework",
  "student.homeDueToday","student.homeSubmissionUnknown","student.homeSchedule",
  "student.homeDataUnavailable","student.homeLessonsDone",
  "student.homeUpcomingTasks","student.homeNearestDeadline",
  "student.homeOverdue","student.homeRevisions","student.homeReviewedWork",
  "student.homeAcademicProgress","student.homePublishedAverage",
  "student.homePublishedMarks","student.homeFocusSubject","student.homeSchoolUpdates"
]){
  assert.ok(locale.includes('  | "'+key+'"'),"Missing localization type "+key);
  assert.equal(locale.split('"'+key+'":').length-1,3,
    "Missing English/Dari/Pashto translations for "+key);
}
for(const phrase of [
  "Kabul-local date","identifies current, next",
  "excludes submitted/reviewed","never mixes draft","excludes archived"
])assert.ok(tests.includes(phrase),"Student model coverage missing "+phrase);
assert.ok(packageJson.scripts["verify:student:phase2"]?.includes("verify:student:phase1"));
assert.ok(packageJson.scripts["verify:student:phase2"]?.includes("test-student-home-phase2.ts"));
assert.ok(workflow.includes("run: pnpm verify:student:phase2") ||
  workflow.includes("run: pnpm verify:student:phase3") ||
  workflow.includes("run: pnpm verify:student:phase4") ||
  workflow.includes("run: pnpm verify:student:phase5") ||
  workflow.includes("run: pnpm verify:student:phase6") ||
  workflow.includes("run: pnpm verify:student:phase7"));
console.log("Student Phase 2: school-local lessons, published grades, authenticated submission status and 3 locales verified.");
