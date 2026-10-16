import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const app=read("apps/mobile/App.tsx");
const teacher=read("apps/mobile/src/teacher-experience.tsx");
const more=read("apps/mobile/src/teacher-more.tsx");
const classDetail=read("apps/mobile/src/teacher-class-detail.tsx");
const hub=read("apps/mobile/src/teacher-hub.tsx");
const communication=read("apps/mobile/src/communication-ui.tsx");
const translations=read("packages/localization/src/index.ts");

const expectedTabs=['"TODAY"','"SCHEDULE"','"CLASSES"','"WORK"','"MORE"'];
const declared=teacher.match(/export type TeacherTab = ([^;]+);/)?.[1]??"";
assert.deepEqual(declared.split("|").map(x=>x.trim()),expectedTabs,
  "The teacher must have exactly five bottom destinations.");
for(const tab of expectedTabs){
  assert.ok(teacher.includes("id: "+tab+","),"Missing bottom navigation item "+tab);
}
assert.ok(!app.includes('"WORKFLOWS"')&&!teacher.includes('"WORKFLOWS"'),
  "Old Workflows route must not remain active.");
assert.ok(teacher.includes('tab === "MORE"')&&teacher.includes('tab === "WORK"'));
assert.ok(teacher.includes('onLocaleChange={onLocaleChange}'),
  "More preferences must reach the application's persisted language setting.");
assert.ok(app.includes('onLocaleChange={chooseLocale}'));
assert.ok(more.includes("supportedLocales.map("));
assert.ok(more.includes('section==="PROFILE"')&&more.includes('section==="ANNOUNCEMENTS"'));
assert.ok(more.includes("AdminContactCard")&&more.includes("onLogout"));
assert.ok(more.includes("accessibilityRole=\"radio\""),
  "Language selection must be an accessible mutually exclusive control.");

assert.ok(teacher.includes('onSelect("WORK")')&&teacher.includes('onSelect("MORE")'),
  "Today shortcuts should open Work and More instead of the old Workflows screen.");
assert.ok(teacher.includes('goToWorkflow("ANNOUNCEMENTS")'));
assert.ok(!hub.includes('export type TeacherWorkflowSection = "HOMEWORK" | "GRADES" | "ANNOUNCEMENTS"'),
  "School announcements must no longer be a Work subtab.");
assert.ok(hub.includes('export type TeacherWorkflowSection = "HOMEWORK" | "GRADES" | "TASKS";'));
assert.ok(teacher.includes('mode="TEACHER" teacherSection="ANNOUNCEMENTS"'),
  "Existing school-scoped teacher announcement component must remain available.");
assert.ok(teacher.includes("supervisedClasses={activeSupervisions}"),
  "Class announcements must continue to be Negaran-only.");
assert.ok(communication.includes('api.createTeacherAnnouncement('),
  "Announcement implementation must be reused, not bypassed.");

const expectedSections=['"OVERVIEW"','"STUDENTS"','"LEARNING"','"TEACHING"','"ATTENDANCE"'];
const declaredSection=classDetail.match(/export type TeacherClassSection = ([^;]+);/)?.[1]??"";
assert.deepEqual(declaredSection.split("|").map(x=>x.trim()),expectedSections);
assert.ok(classDetail.includes('section === "LEARNING"'));
assert.ok(classDetail.includes('section={learningSection}'),
  "Class learning panel must receive the nested Homework / Grades selection.");
assert.ok(classDetail.includes('onLearningSectionChange("GRADES")'),
  "Student entry to grades must choose Grades within Learning.");
assert.ok(classDetail.includes('section === "ATTENDANCE" && detail.canSuperviseToday'),
  "Attendance submission must remain permission gated.");
assert.ok(teacher.includes('section={classSection} onSectionChange={setClassSection}'));
assert.ok(teacher.includes('learningSection={classLearningSection} onLearningSectionChange={setClassLearningSection}'),
  "Returning to a selected subject must retain the class and learning subsection.");
assert.ok(teacher.includes('setSelectedAssignmentId(item.assignmentId)'));
assert.ok(teacher.includes('rtl && styles.rowRtl')&&classDetail.includes('rtl && styles.rtl'));

for(const key of [
  "teacher.navWork","teacher.navMore","teacher.moreProfile","teacher.moreAccountInfo",
  "teacher.moreUsername","teacher.moreLanguage","teacher.moreSchool","teacher.moreBack",
  "teacher.moreHelp","teacher.moreIntro","teacher.classLearning","teacher.classAttendance"
]){
  assert.equal((translations.match(new RegExp('"' + key.replaceAll(".", "\\.") + '":',"g"))??[]).length,3,
    "Each new teacher key requires English, Dari and Pashto translations: "+key);
}
assert.ok(app.includes('target === "ANNOUNCEMENTS" ? "MORE" : "WORK"'));
assert.ok(teacher.includes('externalNavigation?.id'));
assert.ok(teacher.includes('if (externalNavigation.target === "ANNOUNCEMENTS")'));
assert.ok(teacher.includes('target === "TEACHER_ANNOUNCEMENTS"') ||
  app.includes('destination === "TEACHER_ANNOUNCEMENTS"'),
  "Push deep links must route to the correct nested destination.");
console.log("Teacher Phase 1 navigation, localization, class context and permission assertions passed.");
