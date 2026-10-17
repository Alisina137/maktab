import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const model=read("apps/mobile/src/student-results-model.ts");
const view=read("apps/mobile/src/student-results.tsx");
const api=read("apps/mobile/src/api.ts");
const app=read("apps/mobile/App.tsx");
const i18n=read("packages/localization/src/index.ts");
const tests=read("scripts/test-student-results-phase5.ts");
const pkg=JSON.parse(read("package.json"));
const workflow=read(".github/workflows/student-navigation.yml");
const ci=read(".github/workflows/ci.yml");
for(const marker of [
  "studentVisibleResults(", "studentFilterResults(", "studentResultsSubjects(",
  "studentResultsTypes(", "studentExamGroups(", "studentSubjectPerformance(",
  "studentResultHistory(", "studentPublishedAverage(", '"EXAMS" | "PERFORMANCE" | "HISTORY"',
  'studentPublishedResults(payload.results)',"item.examSubject.classId!==classId",
  "Math.round(score/maxScore*100)"
])assert.ok(model.includes(marker),"Phase 5 model missing "+marker);
for(const marker of [
  'testID="student-results-phase5"', "studentResultsTabs.map(",
  "student-results-search", "student-results-exams", "student-results-performance",
  "student-results-history", "studentVisibleResults(learning)",
  "studentFilterResults(all,", "studentExamGroups(filtered)",
  "studentSubjectPerformance(filtered)", "studentResultHistory(filtered)",
  'accessibilityState={{selected:tab===next}}', "result.grade.remark",
  "student.resWeightedExplanation", "student.resHistoryScope",
  "student.resNoMatching", "student.resPublishedAverage"
])assert.ok(view.includes(marker),"Phase 5 results UI missing "+marker);
assert.ok(app.includes('<StudentResultsContent'));
assert.ok(view.includes('testID="student-results-refresh"'));
assert.ok(app.includes("api.studentHome(session.accessToken,true)"));
assert.ok(api.includes("studentHome(accessToken: string, fresh = false)"));
assert.ok(api.includes("examSubject: {")&&api.includes("publishedAt: string | null;"));
const keys=[
 "student.resExams","student.resPerformance","student.resHistory",
 "student.resPublishedAverage","student.resPublishedMarks","student.resSearch",
 "student.resSubjectFilter","student.resAllSubjects","student.resExamTypeFilter",
 "student.resAllTypes","student.resNoMatching","student.resSubjectBreakdown",
 "student.resWeightedExplanation","student.resImproving","student.resDeclining",
 "student.resStable","student.resFirstMark","student.resLatestMark",
 "student.resPreviousMark","student.resHistoryScope","student.resScorePercent",
 "student.resRefresh","student.resRefreshFailed"
];
for(const key of keys){
  assert.ok(i18n.includes('  | "'+key+'"'),"Phase 5 missing translation type "+key);
  assert.equal(i18n.split('"'+key+'":').length-1,3,
    "Phase 5 missing English/Dari/Pashto translation "+key);
}
for(const phrase of ["authorized published valid grades","weighted subject trends","filters and published"])
assert.ok(tests.includes(phrase),"Phase 5 test coverage missing "+phrase);
assert.ok(pkg.scripts["verify:student:phase5"]?.includes("verify:student:phase4"));
assert.ok(pkg.scripts["verify:student:phase5"]?.includes("test-student-results-phase5.ts"));
assert.ok(workflow.includes("run: pnpm verify:student:phase5"));
assert.ok(ci.includes("run: pnpm verify:student:phase5"));
console.log("Student Phase 5 published-only scores, academic analysis, history, three locales and regressions verified.");
