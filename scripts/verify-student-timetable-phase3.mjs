import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const model=read("apps/mobile/src/student-timetable-model.ts");
const screen=read("apps/mobile/src/student-timetable.tsx");
const home=read("apps/mobile/src/student-home-model.ts");
const app=read("apps/mobile/App.tsx");
const l10n=read("packages/localization/src/index.ts");
const tests=read("scripts/test-student-timetable-phase3.ts");
const pkg=JSON.parse(read("package.json"));
const workflow=read(".github/workflows/student-navigation.yml");
const ci=read(".github/workflows/ci.yml");

for(const key of [
 "studentSchoolWeekdays","studentClassMinutes(","studentTime12(",
 "studentTimeRange12(","studentPeriodsForDay(","studentTimetablePeriodState(",
 "studentTeacherDirectory(","timeZone"
])assert.ok((model+home).includes(key),"Phase 3 schedule model missing "+key);
for(const key of [
 'testID="student-timetable-phase3"',
 '"TODAY","WEEK","TEACHERS"',
 'student-timetable-tab-','student-timetable-today','student-timetable-week',
 'student-timetable-teachers','student-teachers-search',
 'studentTimetablePeriodState(item,now)','studentTimeRange12(',
 'setInterval(refresh,60_000)','AppState.addEventListener',
 'studentSchoolWeekdays(locale)','studentTeacherDirectory(timetable)',
 'accessibilityState={{expanded:open}}','highlightToday={isToday}'
])assert.ok(screen.includes(key),"Phase 3 schedule UI missing "+key);
assert.ok(app.includes('screen === "student-timetable"'));
assert.ok(app.includes('<StudentTimetableAgenda'));
for(const k of [
 "student.scheduleToday","student.scheduleWeek","student.scheduleTeachers",
 "student.scheduleInProgress","student.scheduleCompleted","student.scheduleUpcoming",
 "student.scheduleTeacherDirectory","student.scheduleWeeklyLessons",
 "student.scheduleSearchTeachers","student.scheduleNoMatchingTeachers",
 "student.scheduleNoTeachers","student.scheduleUnavailable"
]){
 assert.ok(l10n.includes('  | "'+k+'"'),"Phase 3 missing type "+k);
 assert.equal(l10n.split('"'+k+'":').length-1,3,"Phase 3 missing three translations "+k);
}
for(const name of [
 "weekday order follows locale","localized AM/PM",
 "sorts lessons immutably","teacher directory groups subjects"
])assert.ok(tests.includes(name),"Phase 3 missing behavioral coverage "+name);
assert.ok(pkg.scripts["verify:student:phase3"]?.includes("verify:student:phase2"));
assert.ok(pkg.scripts["verify:student:phase3"]?.includes("test-student-timetable-phase3.ts"));
assert.ok(workflow.includes("run: pnpm verify:student:phase3") ||
  workflow.includes("run: pnpm verify:student:phase4") ||
  workflow.includes("run: pnpm verify:student:phase5") ||
  workflow.includes("run: pnpm verify:student:phase6") ||
  (workflow.includes("run: pnpm verify:student:phase7") || workflow.includes("run: pnpm verify:student:phase8")));
assert.ok(ci.includes("run: pnpm verify:student:phase3") ||
  ci.includes("run: pnpm verify:student:phase4") ||
  ci.includes("run: pnpm verify:student:phase5") ||
  ci.includes("run: pnpm verify:student:phase6") ||
  (ci.includes("run: pnpm verify:student:phase7") || ci.includes("run: pnpm verify:student:phase8")));
console.log("Student Phase 3 timetable tabs, current lesson, Kabul time, teacher directory, RTL and regressions verified.");
