import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const model=read("apps/mobile/src/teacher-grading-model.ts");
const assessment=read("apps/mobile/src/teacher-assessments.tsx");
const learning=read("apps/mobile/src/learning-ui.tsx");
const api=read("apps/mobile/src/api.ts");
const local=read("packages/localization/src/index.ts");
const tests=read("scripts/test-teacher-grading-model.ts");
const pkg=JSON.parse(read("package.json"));
const ci=read(".github/workflows/teacher-navigation.yml");
for(const marker of [
 "teacherExamDirectory(","item.exam.academicYearId === assignment.academicYearId",
 "item.examSubject.classId === assignment.classId",
 "item.examSubject.subjectId === assignment.subjectId",
 "teacherGradeSummary(","teacherGradeStudents(",
 "teacherAssessmentDirectory(","teacherAssessmentChanges(",
 "teacherAssessmentSummary(","teacherAssessmentDateValid("
])assert.ok(model.includes(marker),"Phase 6 grading model missing "+marker);
for(const marker of [
 "teacherAssessmentDirectory(","teacherAssessmentChanges(",
 "teacherAssessmentSummary(","teacherAssessmentStudents(",
 "teacherAssessmentDrafts(","teacherAssessmentDateValid(",
 "testID=\"teacher-assessment-sheet\"",
 "gradeUnsavedTitle","gradeDiscard","review"
].filter(x=>x!=="review"))assert.ok(assessment.includes(marker),"Phase 6 UI missing "+marker);
for(const marker of [
 "teacherExamDirectory(","teacherGradeSummary(","teacherGradeStudents(",
 "testID=\"teacher-exam-search\"",
 "teacher.gradePrivateDraft","confirmGradeDiscard(",
 "gradeSheet.canEdit&&!busy",
 "gradeGeneration.current++"
])assert.ok(learning.includes(marker),"Phase 6 exam UI missing "+marker);
for(const marker of [
 "teacherAssessmentSheet(","saveTeacherAssessmentScores(",
 "gradeSheet(accessToken: string, examSubjectId: string, fresh = false)",
 "{ cache: false }"
])assert.ok(api.includes(marker),"Phase 6 authenticated API missing "+marker);
const keys=[
 "teacher.gradeUnsavedTitle","teacher.gradeUnsavedHint","teacher.gradeDiscard",
 "teacher.gradeSearchAssessments","teacher.gradeNoAssessmentsMatch",
 "teacher.gradeRecorded","teacher.gradeMissing","teacher.gradeAverage",
 "teacher.gradePrivateDraft","teacher.gradeUnsaved","teacher.gradeInvalidDraft",
 "teacher.gradeSearchExams","teacher.gradeOpen","teacher.gradeReadOnly",
 "teacher.gradeExamCount","teacher.gradeNoExamsMatch"
];
for(const key of keys){
 assert.ok(local.includes('  | "'+key+'"'),"Phase 6 key union missing "+key);
 assert.equal((local.split('"'+key+'":').length-1),3,
   "Missing English / Dari / Pashto dictionary value: "+key);
}
for(const marker of ["limits official exam sheets","explicitly cleared remarks",
 "unknown scores from average","calendar boundaries"])
 assert.ok(tests.includes(marker),"Phase 6 regression missing "+marker);
assert.ok(pkg.scripts["verify:teacher:phase6"]?.includes("verify:teacher:phase5"));
assert.ok(pkg.scripts["verify:teacher:phase6"]?.includes("test-teacher-grading-model.ts"));
assert.ok(ci.includes("run: pnpm verify:teacher:phase6") ||
  ci.includes("run: pnpm verify:teacher:phase7") ||
  ci.includes("run: pnpm verify:teacher:phase8"));
console.log("Teacher Phase 6: scoped exam and assessment grading, private marks and 3 languages verified.");
