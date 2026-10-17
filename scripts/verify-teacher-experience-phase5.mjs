import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const files=[
"apps/mobile/src/teacher-homework-model.ts",
"apps/mobile/src/teacher-submissions.tsx",
"apps/mobile/src/learning-ui.tsx",
"packages/localization/src/index.ts",
"scripts/test-teacher-homework-model.ts"
].map(read);
const [model,review,learning,locale,tests]=files;
for(const term of ["roster === null ? null","homeworkDeadline(","teacherHomeworkList(",
  'item.status !== "PUBLISHED"',"byId.has(item.assignmentId)"])
  assert.ok(model.includes(term),term);
for(const term of ["teacherClassDetail(","teacherHomeworkSubmissions(",
 "reviewHomeworkSubmission(","generation.current","maxLength={500}"])
  assert.ok(review.includes(term),term);
for(const term of ["teacherHomeworkOverview(","teacherHomeworkList(",
 'testID="teacher-homework-workload"',"setHomeworkDeadlineFilter"])
  assert.ok(learning.includes(term),term);
for(const term of ["teacher.homeworkRecords","teacher.homeworkDueSoon",
 "teacher.homeworkPastDue","learning.submissionPending","learning.submissionMissingUnknown"])
 assert.equal((locale.split('"'+term+'":').length-1),3,term);
for(const term of ["missing without an authorized loaded roster","homework urgency",
 "student search and review queue"])assert.ok(tests.includes(term),term);
console.log("Teacher Phase 5 source verification passed.");
