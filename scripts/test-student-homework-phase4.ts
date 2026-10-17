import assert from "node:assert/strict";
import test from "node:test";
import type {HomeworkSubmissionPayload,LearnerAcademicPayload} from "../apps/mobile/src/api.js";
import {
  studentHomeworkRows,studentHomeworkTabs,studentHomeworkCounts,
  studentHomeworkFilter,studentHomeworkSubjects,studentHomeworkDeadlineState,
  studentHomeworkCanSubmit,studentSubmissionMap
} from "../apps/mobile/src/student-homework-model.js";

const now=new Date("2026-10-17T04:30:00Z");
function assignment(id:string,status:"PUBLISHED"|"CLOSED"|"DRAFT"|"ARCHIVED"="PUBLISHED",
    dueAt="2026-10-18T07:00:00Z",subject="Mathematics"):
    LearnerAcademicPayload["homework"][number] {
  return {
    homework:{id,status,dueAt,title:id,content:"Solve the exercise",schoolId:"school",
      assignmentId:"assignment",academicYearId:"year",classId:"class",subjectId:subject,
      teacherUserId:"teacher",attachmentUrl:null,attachmentFileId:null,scheduledAt:null,
      publishedAt:null,createdAt:dueAt,updatedAt:dueAt},
    subjectName:subject,className:"Grade A"
  };
}
function submission(homeworkId:string,status:HomeworkSubmissionPayload["status"],
    submittedAt="2026-10-17T01:00:00Z"):HomeworkSubmissionPayload{
  return {id:homeworkId+status,studentId:"student",homeworkId,status,
    submittedAt,answer:"Answer",attachmentFileId:null,feedback:null,reviewedAt:null};
}
const homework=[
  assignment("to-do"),
  assignment("overdue","PUBLISHED","2026-10-16T07:00:00Z"),
  assignment("submitted","PUBLISHED","2026-10-18T07:00:00Z","English"),
  assignment("revision","PUBLISHED","2026-10-18T07:00:00Z","Science"),
  assignment("reviewed","CLOSED","2026-10-16T07:00:00Z","Science"),
  assignment("closed","CLOSED"),
  assignment("draft","DRAFT"),
  assignment("archived","ARCHIVED")
];
const submitted=[
  submission("submitted","SUBMITTED"),submission("revision","REVISION_REQUESTED"),
  submission("reviewed","REVIEWED")
];

test("Student Phase 4 splits homework into four tabs without leaking draft or archived tasks",()=>{
  const rows=studentHomeworkRows(homework,submitted,now);
  assert.deepEqual(studentHomeworkTabs,["TO_DO","SUBMITTED","REVISION","COMPLETED"]);
  assert.equal(rows.length,6);
  const states=Object.fromEntries(rows.map(row=>[row.item.homework.id,row.state]));
  assert.deepEqual(states,{
    overdue:"OVERDUE",reviewed:"REVIEWED",closed:"CLOSED",
    "to-do":"TO_DO",submitted:"SUBMITTED",revision:"REVISION"
  });
  assert.deepEqual(studentHomeworkCounts(rows),{
    TO_DO:2,SUBMITTED:1,REVISION:1,COMPLETED:2
  });
  assert.equal(rows.find(row=>row.item.homework.id==="reviewed")?.canSubmit,false);
  assert.equal(rows.find(row=>row.item.homework.id==="overdue")?.canSubmit,false);
  assert.equal(rows.find(row=>row.item.homework.id==="revision")?.canSubmit,true);
});
test("Student Phase 4 tabs use search and exact subject filtering",()=>{
  const rows=studentHomeworkRows(homework,submitted,now);
  assert.deepEqual(studentHomeworkSubjects(rows),["English","Mathematics","Science"]);
  assert.deepEqual(studentHomeworkFilter(rows,{tab:"REVISION",subject:"Science",query:"Exercise"})
    .map(row=>row.item.homework.id),["revision"]);
  assert.deepEqual(studentHomeworkFilter(rows,{tab:"TO_DO",subject:"English",query:""}),[]);
  assert.deepEqual(studentHomeworkFilter(rows,{tab:"SUBMITTED",subject:null,query:"EngLish"})
    .map(row=>row.item.homework.id),["submitted"]);
  assert.equal(studentHomeworkFilter(rows,{tab:"COMPLETED",subject:null,query:"unknown"}).length,0);
});
test("Student Phase 4 prevents duplicate submission when the authoritative list is unknown",()=>{
  const rows=studentHomeworkRows(homework,null,now);
  const todo=rows.find(row=>row.item.homework.id==="to-do")!;
  assert.equal(todo.canSubmit,true);
  assert.equal(studentHomeworkCanSubmit(todo,false),false);
  assert.equal(studentHomeworkCanSubmit(todo,true),true);
  assert.equal(studentHomeworkCanSubmit(rows.find(row=>row.item.homework.id==="overdue")!,true),false);
  assert.equal(studentSubmissionMap([submission("x","SUBMITTED"),
    submission("x","REVIEWED","2026-10-17T03:00:00Z")]).get("x")?.status,"REVIEWED");
});
test("Student Phase 4 labels school-local deadlines precisely",()=>{
  assert.equal(studentHomeworkDeadlineState("2026-10-17T05:00:00Z",now),"TODAY");
  assert.equal(studentHomeworkDeadlineState("2026-10-17T20:00:00Z",now),"TOMORROW");
  assert.equal(studentHomeworkDeadlineState("2026-10-16T08:00:00Z",now),"OVERDUE");
  assert.equal(studentHomeworkDeadlineState("2026-10-19T08:00:00Z",now),"LATER");
  assert.equal(studentHomeworkDeadlineState("invalid",now),"UNKNOWN");
});
