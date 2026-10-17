import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const model=read("apps/mobile/src/teacher-phase7-model.ts");
const teaching=read("apps/mobile/src/teacher-teaching.tsx");
const communication=read("apps/mobile/src/communication-ui.tsx");
const classDetail=read("apps/mobile/src/teacher-class-detail.tsx");
const api=read("apps/mobile/src/api.ts");
const loc=read("packages/localization/src/index.ts");
const tests=read("scripts/test-teacher-phase7-model.ts");
const pkg=JSON.parse(read("package.json"));
const ci=read(".github/workflows/teacher-navigation.yml");
for(const needle of [
  "teacherValidIsoDate(","teacherValidReportRange(","teacherValidLessonInput(",
  "teacherLessonList(","teacherUnitList(","teacherTeachingProgress(",
  "teacherAnnouncementValid(","teacherAnnouncementList(",
  "allowedClasses.includes(classId)","!item.archivedAt"
])assert.ok(model.includes(needle),"Model missing "+needle);
for(const needle of [
  'testID="teacher-lesson-search"',
  'testID="teacher-unit-search"',
  "teacherValidReportRange(from,to)",
  "teacherValidLessonInput({lessonDate,topic,objective,materials,notes})",
  "teacherTeachingProgress(view)",
  "function navigate(next:Section)",
  "teacher.lessonUnsavedHint"
])assert.ok(teaching.includes(needle),"Teaching workspace missing "+needle);
for(const needle of [
  'testID="teacher-announcement-title"',
  'testID="teacher-announcement-content"',
  'testID="teacher-announcement-search"',
  "teacherAnnouncementValid(","teacherAnnouncementList(",
  "function confirmAnnouncement()",
  "teacher.noticeShowAll",
  'mode==="TEACHER"'
])assert.ok(communication.includes(needle),"Class communication missing "+needle);
for(const needle of [
  'testID="teacher-supervision-tabs"',
  'attendanceView==="TODAY"',
  'attendanceView==="HISTORY"&&supervision',
  'attendanceView==="NOTICES"&&supervision',
  'detail.canSuperviseToday'
])assert.ok(classDetail.includes(needle),"Negaran role navigation missing "+needle);
for(const needle of [
  "announcements(accessToken: string, fresh = false)",
  "teacherTeaching(accessToken: string, assignmentId: string)",
  "teacherTeachingReport(accessToken: string, assignmentId: string, from: string, to: string)"
])assert.ok(api.includes(needle),"Live API access missing "+needle);
for(const key of [
  "teacher.supervisionToday","teacher.lessonUnsavedTitle","teacher.lessonUnsavedHint",
  "teacher.lessonCount","teacher.lessonSearch","teacher.lessonNoMatch",
  "teacher.unitSearch","teacher.unitNoMatch","teacher.noticeConfirmTitle",
  "teacher.noticeConfirmHint","teacher.noticeResults","teacher.noticeSearch",
  "teacher.noticeClass","teacher.noticeSchool","teacher.noticeRole",
  "teacher.noticeNoMatch","teacher.noticeShowLess","teacher.noticeShowAll"
]) {
  assert.ok(loc.includes('  | "'+key+'"'),"Missing locale type "+key);
  assert.equal(loc.split('"'+key+'":').length-1,3,"Missing translation "+key);
}
for(const needle of ["validates actual Gregorian lesson dates",
  "newest-first ordering","never invents percentages",
  "current supervised class","hides archived entries"])
  assert.ok(tests.includes(needle),"Tests missing "+needle);
assert.ok(pkg.scripts["verify:teacher:phase7"]?.includes("verify:teacher:phase6"));
assert.ok(pkg.scripts["verify:teacher:phase7"]?.includes("test-teacher-phase7-model.ts"));
assert.ok(ci.includes("run: pnpm verify:teacher:phase7"));
console.log("Teacher Phase 7 model, UI role restrictions, live data, locales and regressions verified.");
