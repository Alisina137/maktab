import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const store=read("packages/database/src/academic-store.ts");
const schema=read("packages/database/src/schema.ts");
const teacher=read("apps/mobile/src/teacher-experience.tsx");
const list=read("apps/mobile/src/teacher-classes.tsx");
const model=read("apps/mobile/src/teacher-classes-model.ts");
const detail=read("apps/mobile/src/teacher-class-detail.tsx");
const progress=read("apps/mobile/src/teacher-class-progress.tsx");
const api=read("apps/mobile/src/api.ts");
const translations=read("packages/localization/src/index.ts");
const tests=read("scripts/test-teacher-classes-model.ts");
const pkg=JSON.parse(read("package.json"));
const ci=read(".github/workflows/teacher-navigation.yml");

for(const marker of [
  "await getTeacher(schoolId, teacherUserId)",
  "eq(teacherAssignments.schoolId, schoolId)",
  "eq(teacherAssignments.teacherUserId, teacherUserId)",
  "eq(teacherAssignments.id, assignmentId)",
  'eq(academicYears.status, "ACTIVE")',
  "eq(homeworks.schoolId, schoolId)",
  "eq(homeworks.teacherUserId, teacherUserId)",
  "eq(homeworks.assignmentId, assignmentId)",
  "eq(homeworks.subjectId, assignment.subjectId)",
  "eq(homeworks.academicYearId, assignment.academicYearId)",
  "eq(examSubjects.schoolId, schoolId)",
  "eq(examSubjects.classId, assignment.classId)",
  "eq(examSubjects.subjectId, assignment.subjectId)",
  "eq(exams.academicYearId, assignment.academicYearId)",
  "eq(homeworkSubmissions.schoolId, schoolId)",
  "eq(gradeRecords.schoolId, schoolId)",
  "activeStudentIds.has(row.studentId)",
  "activeStudentIds.has(grade.studentId)",
  "grade.score < 0 || grade.score > maximum",
  'row.status === "PUBLISHED"',
  "averageExamPercent:",
  "studentProgress: progress",
  "canSuperviseToday: !!supervision, insights"
])assert.ok(store.includes(marker),"Missing scoped class insight guard: "+marker);
assert.ok(schema.includes('export const gradeRecords ='));
assert.ok(schema.includes('export const homeworkSubmissions ='));
for(const marker of [
  "studentProgress: Array<",
  "averageExamPercent: number | null",
  "homeworkPublished: number",
  "examGradesRecorded: number"
])assert.ok(api.includes(marker),"Missing typed response: "+marker);
for(const marker of [
  "teacherClassesOverview(", "searchable(value)",
  'filter === "HOMEWORK"', 'filter === "GRADING"',
  "item.assignmentId === assignment.assignmentId",
  "item.exam.academicYearId === assignment.academicYearId",
  "teacherProgressRatio(", "denominator<=0"
])assert.ok(model.includes(marker),"Missing model behavior: "+marker);
for(const marker of [
  'testID="teacher-classes-overview"',
  'testID="teacher-classes-search"',
  'testID={`teacher-open-assignment-${item.assignment.assignmentId}`}',
  "learningReady&&learning",
  "data.classes.map(",
  "onOpenAssignment(item.assignment)",
  "onOpenAttendance(item.classId,today.date)",
  "rtl&&styles.rtl"
])assert.ok(list.includes(marker),"Missing class list UI: "+marker);
for(const marker of [
  'const [classQuery, setClassQuery] = useState("")',
  'const [classFilter, setClassFilter] = useState<TeacherClassesFilter>("ALL")',
  "<TeacherClassesPanel",
  "onOpenAssignment={openClassAssignment}",
  "onQuery={setClassQuery}",
  "onFilter={setClassFilter}"
])assert.ok(teacher.includes(marker),"Missing parent navigation state: "+marker);
assert.ok(detail.includes('<TeacherClassProgressPanel mode="OVERVIEW" detail={detail}'));
assert.ok(detail.includes('<TeacherClassProgressPanel mode="STUDENTS" detail={detail}'));
for(const marker of [
  'testID="teacher-class-progress-overview"',
  'testID="teacher-class-student-progress"',
  'testID="teacher-class-student-search"',
  "progress.examsRecorded<progress.examsAvailable",
  "progress.homeworkSubmitted<progress.homeworkAvailable",
  "teacherProgressRatio(n,d)",
  "item?.averageExamPercent==null",
  "student.studentCode"
])assert.ok(progress.includes(marker),"Missing safe class/student progress UI: "+marker);
for(const key of [
  "classesIntro","classFilterAll","classFilterDrafts","classFilterExams",
  "classSearch","classClearSearch","classNoMatch","classResetFilters",
  "classDraftShort","classExamShort","classPerformance","classStatsHint",
  "classGradeSheets","classPublishedHomework","classGradeCoverage",
  "classSubmissionCoverage","classStudentProgress","classPerformanceHint",
  "studentSearch","studentFilterAll","studentFilterMissingGrades",
  "studentFilterMissingHomework","studentExamAverage","studentGradeProgress",
  "studentHomeworkProgress","classNoStudentMatch"
]){
 const full="teacher."+key;
 assert.ok(translations.includes('  | "'+full+'"'),"Missing localization union: "+full);
 assert.equal((translations.match(new RegExp('"'+full.replaceAll(".","\\.")+'":',"g"))??[]).length,3,
   "English, Dari, Pashto must all be provided: "+full);
}
for(const marker of [
  "groups only own assigned subjects",
  "searches class code and subject",
  "filters drafts and grading",
  "unknown progress"
])assert.ok(tests.includes(marker),"Missing regression test: "+marker);
assert.ok(pkg.scripts["verify:teacher:phase4"]?.includes("verify:teacher:phase3"));
assert.ok(pkg.scripts["verify:teacher:phase4"]?.includes("test-teacher-classes-model.ts"));
assert.ok(ci.includes("run: pnpm verify:teacher:phase4") ||
  ci.includes("run: pnpm verify:teacher:phase5") ||
  ci.includes("run: pnpm verify:teacher:phase6") ||
  ci.includes("run: pnpm verify:teacher:phase7") ||
  ci.includes("run: pnpm verify:teacher:phase8"));
console.log("Teacher Phase 4 source verification passed: scoped queries, class search, progress, RTL, and 3 languages.");
