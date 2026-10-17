import assert from "node:assert/strict";
import test from "node:test";
import {teacherClassesOverview,teacherProgressRatio} from "../apps/mobile/src/teacher-classes-model.js";
import type {TeacherAcademicsPayload,TeacherLearningPayload} from "../apps/mobile/src/api.js";

const academics:TeacherAcademicsPayload={
  assignmentDetails:[
    {assignmentId:"a1",academicYearId:"y",classId:"c1",className:"Grade Seven",classCode:"7A",subjectId:"math",subjectName:"Mathematics"},
    {assignmentId:"a2",academicYearId:"y",classId:"c1",className:"Grade Seven",classCode:"7A",subjectId:"science",subjectName:"Science"},
    {assignmentId:"a3",academicYearId:"y",classId:"c2",className:"Grade Eight",classCode:"8A",subjectId:"math",subjectName:"Mathematics"}
  ],schedule:[]
};
const learning={
  homeworks:[
    {id:"h1",assignmentId:"a1",classId:"c1",subjectId:"math",status:"DRAFT"},
    {id:"h2",assignmentId:"a1",classId:"c1",subjectId:"math",status:"PUBLISHED"},
    {id:"h3",assignmentId:"a3",classId:"c2",subjectId:"math",status:"DRAFT"},
    {id:"otherTeacher",assignmentId:"foreign",classId:"c1",subjectId:"math",status:"DRAFT"}
  ],
  examSubjects:[
    {examSubject:{id:"e1",classId:"c1",subjectId:"math"},exam:{academicYearId:"y",status:"IN_PROGRESS"}},
    {examSubject:{id:"e2",classId:"c1",subjectId:"science"},exam:{academicYearId:"y",status:"PUBLISHED"}},
    {examSubject:{id:"e3",classId:"c2",subjectId:"math"},exam:{academicYearId:"old",status:"IN_PROGRESS"}},
    {examSubject:{id:"e4",classId:"c2",subjectId:"math"},exam:{academicYearId:"y",status:"IN_PROGRESS"}}
  ]
} as unknown as TeacherLearningPayload;

test("Phase 4 groups only own assigned subjects and class counts",()=>{
  const result=teacherClassesOverview(academics,learning,"","ALL");
  assert.equal(result.totalClasses,2);assert.equal(result.totalSubjects,3);
  assert.equal(result.classes.length,2);
  assert.equal(result.classes.find(item=>item.classId==="c1")?.subjects.length,2);
  assert.equal(result.homeworkDrafts,2);
  assert.equal(result.openExams,2);
});
test("Phase 4 searches class code and subject without showing another class",()=>{
  assert.deepEqual(teacherClassesOverview(academics,learning," 8A ","ALL").classes.map(x=>x.classId),["c2"]);
  assert.deepEqual(teacherClassesOverview(academics,learning,"sCIence","ALL").classes.find(item=>item.classId==="c1")?.subjects.map(x=>x.assignment.assignmentId),["a2"]);
  assert.equal(teacherClassesOverview(academics,learning,"Unlisted","ALL").classes.length,0);
});
test("Phase 4 filters drafts and grading only for assigned academic-year subject",()=>{
  const drafts=teacherClassesOverview(academics,learning,"","HOMEWORK");
  assert.equal(drafts.classes[0]?.subjects.length,1);
  assert.equal(drafts.classes[1]?.subjects.length,1);
  const exams=teacherClassesOverview(academics,learning,"","GRADING");
  assert.equal(exams.classes.length,2);
  assert.deepEqual(exams.classes.find(item=>item.classId==="c1")?.subjects.map(x=>x.assignment.assignmentId),["a1"]);
});
test("Phase 4 renders unknown progress as N/A and never as fabricated zero",()=>{
  assert.equal(teacherProgressRatio(0,0),null);
  assert.equal(teacherProgressRatio(0,5),0);
  assert.equal(teacherProgressRatio(4,5),80);
  assert.equal(teacherProgressRatio(10,5),100);
  assert.equal(teacherProgressRatio(-1,5),null);
  assert.equal(teacherProgressRatio(Number.NaN,10),null);
  const empty=teacherClassesOverview(academics,null,"","ALL");
  assert.equal(empty.classes.length,2);
  assert.equal(teacherClassesOverview(null,null,"","ALL").totalClasses,0);
});
