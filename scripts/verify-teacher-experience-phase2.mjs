import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const model=read("apps/mobile/src/teacher-today-model.ts");
const ui=read("apps/mobile/src/teacher-hub.tsx");
const experience=read("apps/mobile/src/teacher-experience.tsx");
const translations=read("packages/localization/src/index.ts");
const tests=read("apps/mobile/src/teacher-today-model.test.ts");
const api=read("apps/mobile/src/api.ts");
const scripts=JSON.parse(read("package.json")).scripts;

for(const marker of [
  'timeZone: "Asia/Kabul"',
  'clock.date !== today.date',
  'item.start <= clock.minutes && clock.minutes < item.end',
  'item.start > clock.minutes',
  'item.end <= clock.minutes',
  'item.classId === period.classId && item.subjectId === period.subjectId',
  'stage: "EMPTY"'
]) assert.ok(model.includes(marker),"Missing timeline safety rule: "+marker);
assert.ok(model.includes('if (!today) return empty'));
for(const marker of [
  'testID="teacher-today-dashboard"',
  'testID="teacher-today-featured-lesson"',
  'testID="teacher-today-priorities"',
  "teacherDayTimeline(today,now)",
  'AppState.addEventListener("change"',
  'setInterval(()=>setNow(new Date()),60_000)',
  "onOpenLesson:(period:TodayPeriod)=>void",
  "onPress={()=>onOpenLesson(featured)}",
  "onTasks:()=>void",
  'onPress={()=>onAttendance(supervision.classId,today.date)',
  'pending.openGradeSheets>0',
  'pending.homeworkDrafts>0',
  'plan.stage==="UNAVAILABLE"'
]) assert.ok(ui.includes(marker),"Missing teacher Today usability item: "+marker);

assert.ok(experience.includes('const assignment = teacherAssignmentForPeriod(period, academics)'));
assert.ok(experience.includes('setSelectedAssignmentId(assignment.assignmentId)'));
assert.ok(experience.includes('setSelectedAssignmentId(null)'));
assert.ok(experience.includes('onOpenLesson={openTodayLesson}'));
assert.ok(experience.includes('onTasks={() => goToWorkflow("TASKS")}'));
assert.ok(experience.includes('onRetry={() => { onRetry(); setHubRefresh(v => v + 1); }}'));
assert.equal((experience.match(/<TeacherTodayInsights/g)??[]).length,1);
assert.ok(!experience.includes("todaySchedule.map("),
  "Today should not render a second copy of the weekly timetable.");
assert.ok(api.includes('supervisedClasses: Array<'),"Permission-scoped Negaran data must remain server-owned.");
for(const key of [
  "teacher.currentLesson","teacher.inProgress","teacher.openLesson",
  "teacher.lessonsCompleted","teacher.lessonsRemaining","teacher.dayNotCurrent"
]) {
  assert.ok(translations.includes('  | "'+key+'"'));
  assert.equal((translations.match(new RegExp('"'+key.replaceAll(".","\\.")+'":',"g"))??[]).length,3,
    "English, Dari and Pashto translations required for "+key);
}
for(const key of ["before, during, between","stale school day","direct lesson route"]){
  assert.ok(tests.includes(key),"Missing Phase 2 regression: "+key);
}
assert.ok(scripts["verify:teacher:phase2"]?.includes("teacher-today-model.test.ts"));
assert.ok(scripts["verify:teacher:phase2"]?.includes("verify:teacher:phase1"));
console.log("Teacher Phase 2 source, school-local clock, direct class routing, UX and localization checks passed.");
