import assert from "node:assert/strict";
import test from "node:test";
import type { HomeworkPayload, TeacherLearningPayload, HomeworkSubmissionPayload } from "../apps/mobile/src/api.js";
import {
  teacherHomeworkOverview, teacherHomeworkList, homeworkDeadline, teacherSubmissionOverview,
  type HomeworkSubmissionEntry
} from "../apps/mobile/src/teacher-homework-model.js";

const t=Date.parse("2026-10-17T08:00:00.000Z");
const assignments=[
  {assignmentId:"a1",academicYearId:"year",classId:"c1",className:"Grade Seven",
    classCode:"7A",subjectId:"math",subjectName:"Mathematics"},
  {assignmentId:"a2",academicYearId:"year",classId:"c2",className:"Grade Eight",
    classCode:"8A",subjectId:"science",subjectName:"Science"}
] satisfies TeacherLearningPayload["assignments"];
function hw(id:string,assignmentId:string,status:HomeworkPayload["status"],deltaHours:number):HomeworkPayload {
  return {id,schoolId:"s",assignmentId,academicYearId:"year",classId:assignmentId==="a1"?"c1":"c2",
    subjectId:assignmentId==="a1"?"math":"science",teacherUserId:"teacher",
    title:id,content:"Practice problems",dueAt:new Date(t+deltaHours*3600_000).toISOString(),
    attachmentUrl:null,attachmentFileId:null,scheduledAt:null,status,publishedAt:null,
    createdAt:"2026-10-10T00:00:00.000Z",updatedAt:"2026-10-10T00:00:00.000Z"};
}
const homeworks=[
  hw("due-soon","a1","PUBLISHED",24),
  hw("past-due","a1","PUBLISHED",-1),
  hw("draft-past","a1","DRAFT",-10),
  hw("other-class","a2","PUBLISHED",49),
  hw("archived","a2","ARCHIVED",-30),
  hw("foreign","unknown","PUBLISHED",-4)
];

test("Phase 5 homework urgency only applies to published and open work",()=>{
  assert.equal(homeworkDeadline(homeworks[0],t),"DUE_SOON");
  assert.equal(homeworkDeadline(homeworks[1],t),"OVERDUE");
  assert.equal(homeworkDeadline(homeworks[2],t),"ALL");
  assert.equal(homeworkDeadline(homeworks[3],t),"ALL");
  assert.equal(homeworkDeadline(homeworks[4],t),"ALL");
  const numbers=teacherHomeworkOverview(homeworks.slice(0,5),t);
  assert.deepEqual(numbers,{total:5,drafts:1,published:3,dueSoon:1,overdue:1});
});
test("Phase 5 homework list filters class, status, search and school-fixed due",()=>{
  assert.deepEqual(teacherHomeworkList(homeworks,assignments,"","ALL","ALL","OVERDUE",t)
    .map(x=>x.id),["past-due"]);
  assert.deepEqual(teacherHomeworkList(homeworks,assignments,"MATHEMATICS","ALL","ALL","ALL",t)
    .map(x=>x.id),["draft-past","past-due","due-soon"]);
  assert.deepEqual(teacherHomeworkList(homeworks,assignments,"","DRAFT","a1","ALL",t)
    .map(x=>x.id),["draft-past"]);
  assert.deepEqual(teacherHomeworkList(homeworks,assignments,"","PUBLISHED","a2","ALL",t)
    .map(x=>x.id),["other-class"]);
  assert.equal(teacherHomeworkList(homeworks,assignments,"","ALL","unknown","ALL",t).length,0);
});
function entry(id:string,status:HomeworkSubmissionPayload["status"]):HomeworkSubmissionEntry {
  return {student:{id,fullName:id==="s1"?"Ahmad":"Bashir",studentCode:id},
    submission:{id:"sub-"+id,homeworkId:"h",studentId:id,answer:"Answer",
      attachmentFileId:null,status,feedback:null,submittedAt:"2026-10-17T00:00:00Z",reviewedAt:null}};
}
const submitted=[entry("s1","SUBMITTED"),entry("s2","REVIEWED")];
const roster=[
  {id:"s1",fullName:"Ahmad",studentCode:"s1"},
  {id:"s2",fullName:"Bashir",studentCode:"s2"},
  {id:"s3",fullName:"Farida",studentCode:"s3"}
];
test("Phase 5 never reports zero missing without an authorized loaded roster",()=>{
  const unavailable=teacherSubmissionOverview(submitted,null,"","ALL");
  assert.equal(unavailable.counts.missing,null);
  assert.equal(unavailable.rows.length,2);
  assert.equal(teacherSubmissionOverview(submitted,null,"","MISSING").rows.length,0);
  const loaded=teacherSubmissionOverview(submitted,roster,"","ALL");
  assert.deepEqual(loaded.counts,{submitted:2,pending:1,reviewed:1,revision:0,missing:1});
  assert.deepEqual(loaded.rows.map(x=>x.student.id),["s1","s2","s3"]);
});
test("Phase 5 student search and review queue preserve status and missing distinction",()=>{
  assert.deepEqual(teacherSubmissionOverview(submitted,roster,"bash","ALL")
    .rows.map(x=>x.student.id),["s2"]);
  assert.deepEqual(teacherSubmissionOverview(submitted,roster,"","SUBMITTED")
    .rows.map(x=>x.student.id),["s1"]);
  assert.deepEqual(teacherSubmissionOverview(submitted,roster,"","REVIEWED")
    .rows.map(x=>x.student.id),["s2"]);
  assert.deepEqual(teacherSubmissionOverview(submitted,roster,"","MISSING")
    .rows.map(x=>x.student.id),["s3"]);
  const revised=[entry("s1","REVISION_REQUESTED")];
  assert.deepEqual(teacherSubmissionOverview(revised,roster,"","REVISION_REQUESTED")
    .rows.map(x=>x.student.id),["s1"]);
});
