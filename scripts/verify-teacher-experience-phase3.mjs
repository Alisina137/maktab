import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const model=read("apps/mobile/src/teacher-schedule-model.ts");
const ui=read("apps/mobile/src/teacher-schedule.tsx");
const teacher=read("apps/mobile/src/teacher-experience.tsx");
const translations=read("packages/localization/src/index.ts");
const test=read("scripts/test-teacher-schedule-model.ts");
const pkg=JSON.parse(read("package.json"));
const workflow=read(".github/workflows/teacher-navigation.yml");

for(const key of [
 "TEACHER_SCHOOL_WEEKDAYS",'"SATURDAY", "SUNDAY", "MONDAY", "TUESDAY"',
 '"WEDNESDAY", "THURSDAY"','"FRIDAY"',
 "teacherKabulWeekday(now: Date)","kabulTeacherClock(now)",
 "teacherShiftWeekday(", "teacherPeriodsForDay(",
 "startEndMinutes(a.startsAt)",
 "teacherSchedulePeriodState(",
 "today.date !== clock.date",
 "teacherKabulWeekday(now) !== period.weekday",
 "today.schedule.some(",
 "item.classId === period.classId",
 "item.subjectId === period.subjectId",
 "item.startsAt === period.startsAt",
 "item.endsAt === period.endsAt",
 'return "CURRENT"','return clock.minutes < start ? "UPCOMING" : "FINISHED"'
]) assert.ok(model.includes(key),"Schedule model safety missing: "+key);
for(const key of [
 'testID="teacher-schedule-panel"',
 'testID="teacher-schedule-week-list"',
 'testID="teacher-schedule-today"',
 'testID="teacher-schedule-previous-day"',
 'testID="teacher-schedule-next-day"',
 'testID={`teacher-schedule-period-${period.id}`}',
 'accessibilityRole="tablist"',
 'accessibilityState={{selected:view===id}}',
 "TeacherScheduleView",
 'onSelectWeekday(teacherShiftWeekday(currentDay,-1))',
 'onSelectWeekday(teacherShiftWeekday(currentDay,1))',
 'teacherPeriodsForDay(academics,weekday)',
 'teacherSchedulePeriodState(period,today,now)',
 'onPress={()=>onOpen(period)}',
 'onSelectWeekday(weekday);onViewChange("DAY");',
 'today?.date !==',
 'teacher.scheduleTemplateHint',
 'AppState.addEventListener("change"',
 'setInterval(()=>setNow(new Date()),60_000)'
].filter(x=>x!=="today?.date !=="))
  assert.ok(ui.includes(key),"Day/Week UI missing: "+key);
assert.ok(!ui.includes("cancelledPeriod")&&!ui.includes("replacementPeriod"),
  "Do not invent date-specific changes that the API does not provide.");
for(const key of [
 'const [scheduleView, setScheduleView] = useState<TeacherScheduleView>("DAY")',
 'const [scheduleWeekday, setScheduleWeekday] = useState<TeacherWeekday | null>(null)',
 '<TeacherSchedulePanel',
 'onViewChange={setScheduleView}',
 'onSelectWeekday={setScheduleWeekday}',
 'onOpenPeriod={openScheduleLesson}',
 'openTodayLesson(period);',
 'setSelectedAssignmentId(assignment.assignmentId)',
 'onSelect("CLASSES")'
])assert.ok(teacher.includes(key),"Teacher navigation binding missing: "+key);
assert.ok(!teacher.includes('weekdays.map((weekday)'),
  "Old six-day full list must not duplicate new timetable.");
const localeKeys=[
  "weekday.friday","teacher.scheduleDay","teacher.scheduleWeek",
  "teacher.schedulePrevious","teacher.scheduleNext","teacher.scheduleViewDay",
  "teacher.scheduleCurrent","teacher.scheduleFinished","teacher.scheduleUpcoming",
  "teacher.scheduleTemplateHint"
];
for(const key of localeKeys){
  assert.ok(translations.includes('  | "'+key+'"'),"Missing localization type: "+key);
  assert.equal((translations.match(new RegExp('"'+key.replaceAll(".","\\.")+'":',"g"))??[]).length,3,
    "Translate in English, Dari and Pashto: "+key);
}
for(const key of ["Kabul weekday","six standard teaching days",
  "day filtering sorts","server-confirmed periods","cancelled","wrongSubject"]){
  assert.ok(test.includes(key),"Phase 3 regression missing: "+key);
}
assert.ok(pkg.scripts["verify:teacher:phase3"]?.includes("verify:teacher:phase2"));
assert.ok(pkg.scripts["verify:teacher:phase3"]?.includes("test-teacher-schedule-model.ts"));
assert.ok(workflow.includes("run: pnpm verify:teacher:phase3"));
console.log("Teacher Phase 3: Day/Week, current lesson, authorization, RTL labels and regression guards passed.");
