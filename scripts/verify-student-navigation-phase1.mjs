import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const nav=read("apps/mobile/src/student-navigation.tsx");
const routes=read("apps/mobile/src/student-navigation-model.ts");
const more=read("apps/mobile/src/student-more.tsx");
const app=read("apps/mobile/App.tsx");
const loc=read("packages/localization/src/index.ts");
const tests=read("scripts/test-student-navigation-phase1.ts");
const pkg=JSON.parse(read("package.json"));
const workflow=read(".github/workflows/student-navigation.yml");

for(const marker of [
  '"HOME" | "TIMETABLE" | "HOMEWORK" | "RESULTS" | "MORE"',
  'key: "TIMETABLE", label: "student.navTimetable"',
  'accessibilityRole="tab"',
  'accessibilityState={{ selected }}',
  'rtl && styles.barRtl'
])assert.ok(nav.includes(marker),"Student primary tab missing "+marker);
for(const marker of [
  'studentTabOrder','studentDestination(','studentTabForScreen(',
  'studentIsPrimaryScreen(','studentReturnScreen(',
  '"student-timetable"','"student-more"'
])assert.ok(routes.includes(marker),"Student route model missing "+marker);
for(const marker of [
  'testID="student-more-page"','testID="student-more-profile"',
  'student.moreSchoolUpdates','student.moreSettings','student.moreHelp',
  'supportedLocales.map(', 'onOpenUpdates("ANNOUNCEMENTS")',
  'onOpenUpdates("NOTIFICATIONS")','onLogout','AdminContactCard'
])assert.ok(more.includes(marker),"Student More missing "+marker);
for(const marker of [
  'studentTabForScreen(screen)??"HOME"',
  'const destination=studentDestination(tab)',
  'screen === "student-timetable"',
  'studentDetailReturnScreen, setStudentDetailReturnScreen',
  'setStudentDetailReturnScreen(studentReturnScreen(screen))',
  'testID="student-header-notifications"','<StudentMorePanel',
  'onOpenUpdates={(tab)=>','onLocaleChange={chooseLocale}',
  '<StudentBottomNavigation'
])assert.ok(app.includes(marker),"Student App navigation missing "+marker);
const timetable=app.slice(app.indexOf('{screen === "student-timetable" &&'),
  app.indexOf('{screen === "student-homework" &&'));
assert.ok(!timetable.includes("<BackButton"),"Timetable must be primary and not show child back");
assert.ok(app.includes('!studentEnrollmentUnavailable'),"Student enrollment authorization must remain in routing");
for(const k of ["student.navTimetable","student.moreSchoolUpdates",
 "student.moreSchoolUpdatesHint","student.moreProfileHint","student.moreSettings",
 "student.moreLanguage","student.moreHelp"]){
 assert.ok(loc.includes('  | "'+k+'"'),"Missing type "+k);
 assert.equal(loc.split('"'+k+'":').length-1,3,"Translation missing for "+k);
}
assert.ok(tests.includes("five unique ordered primary tabs"));
assert.ok(tests.includes("round-trips each tab"));
assert.ok(tests.includes("child pages are not mistaken"));
assert.ok(pkg.scripts["verify:student:phase1"]?.includes("test-student-navigation-phase1.ts"));
assert.ok(workflow.includes("run: pnpm verify:student:phase1") ||
  workflow.includes("run: pnpm verify:student:phase2"));
console.log("Student Phase 1 navigation, More, RTL, language, safe deep-links and test guards passed.");
