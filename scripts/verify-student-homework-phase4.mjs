import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const model=read("apps/mobile/src/student-homework-model.ts");
const page=read("apps/mobile/src/student-homework.tsx");
const submission=read("apps/mobile/src/student-submission.tsx");
const draft=read("apps/mobile/src/student-homework-draft.ts");
const app=read("apps/mobile/App.tsx");
const api=read("apps/mobile/src/api.ts");
const l10n=read("packages/localization/src/index.ts");
const tests=read("scripts/test-student-homework-phase4.ts");
const pkg=JSON.parse(read("package.json"));
const workflow=read(".github/workflows/student-navigation.yml");
const ci=read(".github/workflows/ci.yml");

for(const marker of [
 'studentHomeworkRows(','studentHomeworkFilter(','studentHomeworkSubjects(',
 'studentHomeworkCounts(','studentHomeworkDeadlineState(',
 'studentHomeworkCanSubmit(','studentSubmissionMap(',
 '"TO_DO" | "SUBMITTED" | "REVISION" | "COMPLETED"',
 'item.homework.status==="PUBLISHED"||item.homework.status==="CLOSED"'
])assert.ok(model.includes(marker),"Phase 4 model missing "+marker);
for(const marker of [
 'testID="student-homework-phase4"','studentHomeworkTabs.map(',
 'student-homework-search','studentHomeworkFilter(rows,',
 'submissionsReady&&submissions!==null','studentHomeworkSubjects(rows)',
 'testID={`student-homework-tab-${next.toLowerCase()}`}',
 '<StudentSubmissionPanel','onRefresh={onRefresh}'
])assert.ok(page.includes(marker),"Phase 4 homework page missing "+marker);
for(const marker of [
 'studentDraftKey(homework.schoolId,studentId,homework.id)',
 'readStudentHomeworkDraft(draftKey)',
 'writeStudentHomeworkDraft(draftKey,snapshot)',
 'clearStudentHomeworkDraft(draftKey)',
 'studentHomeworkCanSubmit(row,submissionsVerified)',
 'submitting.current=true','testID="student-homework-submit"',
 'onSubmitted?.(result.submission)',
 'student.hwTeacherFeedback','student.hwSaveDraft',
 'STUDENT_DRAFT_MAX_CHARS'
])assert.ok(submission.includes(marker),"Phase 4 submission missing "+marker);
for(const marker of [
 'import * as SecureStore from "expo-secure-store"',
 'studentDraftKey(','readStudentHomeworkDraft(',
 'writeStudentHomeworkDraft(','clearStudentHomeworkDraft(',
 'version:1','slot:0|1',
 'await SecureStore.setItemAsync(key,JSON.stringify('
])assert.ok(draft.includes(marker),"Phase 4 encrypted draft missing "+marker);
for(const marker of [
 'submissions={studentSubmissions}',
 'submissionsReady={studentSubmissionsReady}',
 'api.studentHomeworkSubmissions(session.accessToken)',
 'studentSubmissionVersion.current += 1',
 'submitted.studentId!==studentLearning?.student.id',
 'setStudentSubmissionsReady(true)'
])assert.ok(app.includes(marker),"Phase 4 account/session guard missing "+marker);
assert.ok(api.includes('{ cache: false }'),"Phase 4 live submission refresh must bypass stale cache");
const keys=[
 "student.hwToDo","student.hwOverdue","student.hwSubmitted",
 "student.hwNeedsRevision","student.hwReviewed","student.hwClosed",
 "student.hwCompleted","student.hwDueToday","student.hwDueTomorrow",
 "student.hwCannotVerify","student.hwRetry","student.hwSearch",
 "student.hwAllSubjects","student.hwNoMatching",
 "student.hwDraftUnavailable","student.hwDraftSaved","student.hwAnswerTooLong",
 "student.hwSubmissionConfirmed","student.hwViewSubmission","student.hwSubmittedOn",
 "student.hwTeacherFeedback","student.hwResubmit","student.hwWriteAnswer",
 "student.hwSaveDraft","student.hwRemoveFile"
];
for(const key of keys){
 assert.ok(l10n.includes('  | "'+key+'"'),"Missing typed translation "+key);
 assert.equal(l10n.split('"'+key+'":').length-1,3,"Missing three locales for "+key);
}
for(const phrase of [
 'splits homework into four tabs',
 'tabs use search','prevents duplicate','school-local deadlines'
])assert.ok(tests.includes(phrase),"Phase 4 model coverage missing "+phrase);
assert.ok(pkg.scripts["verify:student:phase4"]?.includes("verify:student:phase3"));
assert.ok(pkg.scripts["verify:student:phase4"]?.includes("test-student-homework-phase4.ts"));
assert.ok(workflow.includes("run: pnpm verify:student:phase4") ||
  workflow.includes("run: pnpm verify:student:phase5") ||
  workflow.includes("run: pnpm verify:student:phase6") ||
  workflow.includes("run: pnpm verify:student:phase7"));
assert.ok(ci.includes("run: pnpm verify:student:phase4") ||
  ci.includes("run: pnpm verify:student:phase5") ||
  ci.includes("run: pnpm verify:student:phase6") ||
  ci.includes("run: pnpm verify:student:phase7"));
console.log("Student Phase 4 authenticated homework tabs, filters, encrypted drafts and submission checks verified.");
