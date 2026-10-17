import assert from "node:assert/strict";
import test from "node:test";
import type {
  ContinuousAssessmentPayload, ContinuousAssessmentSheetPayload,
  GradeSheetPayload, TeacherLearningPayload
} from "../apps/mobile/src/api.js";
import {
  teacherExamDirectory,teacherGradeSummary,teacherGradeStudents,
  teacherAssessmentDateValid,teacherAssessmentDirectory,teacherAssessmentDrafts,
  teacherAssessmentChanges,teacherAssessmentSummary,teacherAssessmentStudents
} from "../apps/mobile/src/teacher-grading-model.js";

const assignments:TeacherLearningPayload["assignments"]=[
  {assignmentId:"a1",academicYearId:"2026",classId:"c1",className:"Seventh",
    classCode:"7A",subjectId:"math",subjectName:"Mathematics"},
  {assignmentId:"a2",academicYearId:"2026",classId:"c2",className:"Eighth",
    classCode:"8A",subjectId:"science",subjectName:"Science"}
];
const exam=(id:string,classId:string,subjectId:string,year:string,
  status:TeacherLearningPayload["examSubjects"][number]["exam"]["status"])=>
  ({examSubject:{id,examId:"exam-"+id,subjectId,classId,maxScore:100,examDate:"2026-10-19"},
    exam:{id:"exam-"+id,academicYearId:year,name:"Term "+id,type:"MIDTERM",status},
    className:classId==="c1"?"Seventh":"Eighth",classCode:classId==="c1"?"7A":"8A",
    subjectName:subjectId==="math"?"Mathematics":"Science"});
const exams=[
  exam("e1","c1","math","2026","IN_PROGRESS"),
  exam("e2","c1","math","2026","PUBLISHED"),
  exam("e3","c2","science","2026","IN_PROGRESS"),
  exam("wrongYear","c1","math","2025","IN_PROGRESS"),
  exam("foreign","c1","biology","2026","IN_PROGRESS")
];
const gradeSheet:GradeSheetPayload={
  examSubject:{id:"e1",examId:"exam-e1",classId:"c1",subjectId:"math",maxScore:100,examDate:null},
  exam:{id:"exam-e1",academicYearId:"2026",name:"Term e1",type:"MIDTERM",status:"IN_PROGRESS"},
  classSection:{id:"c1",name:"Seventh",code:"7A"},
  subject:{id:"math",name:"Mathematics",code:"M"},
  canEdit:true,
  students:[
    {student:{id:"s1",studentCode:"1",fullName:"Ahmad"},grade:{id:"g1",score:80,remark:"good",status:"DRAFT"}},
    {student:{id:"s2",studentCode:"2",fullName:"Bashir"},grade:{id:"g2",score:60,remark:null,status:"DRAFT"}},
    {student:{id:"s3",studentCode:"3",fullName:"Farida"},grade:null}
  ]
};
const makeAssessment=(id:string,assignmentId="a1",category:ContinuousAssessmentPayload["category"]="QUIZ"):
  ContinuousAssessmentPayload=>({id,assignmentId,title:"Test "+id,category,
    assessedOn:"2026-10-16",maxScore:20});
const assessmentSheet:ContinuousAssessmentSheetPayload={
  assessment:makeAssessment("test1"),
  students:[
    {student:{id:"s1",fullName:"Ahmad",studentCode:"1"},score:{score:16,remark:"good"}},
    {student:{id:"s2",fullName:"Bashir",studentCode:"2"},score:{score:10,remark:null}},
    {student:{id:"s3",fullName:"Farida",studentCode:"3"},score:null}
  ]
};

test("Phase 6 limits official exam sheets to chosen assigned subject and academic year",()=>{
  assert.deepEqual(teacherExamDirectory(exams,assignments,"a1","","ALL")
    .map(item=>item.examSubject.id),["e1","e2"]);
  assert.deepEqual(teacherExamDirectory(exams,assignments,"a2","","ALL")
    .map(item=>item.examSubject.id),["e3"]);
  assert.deepEqual(teacherExamDirectory(exams,assignments,"a1","","OPEN")
    .map(item=>item.examSubject.id),["e1"]);
  assert.deepEqual(teacherExamDirectory(exams,assignments,"a1","","READ_ONLY")
    .map(item=>item.examSubject.id),["e2"]);
  assert.deepEqual(teacherExamDirectory(exams,assignments,"missing","","ALL"),[]);
  assert.deepEqual(teacherExamDirectory(exams,assignments,"a1"," e2 ","ALL")
    .map(item=>item.examSubject.id),["e2"]);
});
test("Phase 6 official mark coverage excludes unknown scores from average",()=>{
  const summary=teacherGradeSummary(gradeSheet);
  assert.equal(summary.total,3);assert.equal(summary.recorded,2);
  assert.equal(summary.missing,1);assert.equal(summary.averagePercent,70);
  assert.equal(summary.above80,1);assert.equal(summary.between60And79,1);
  assert.equal(summary.below60,0);
  assert.deepEqual(teacherGradeStudents(gradeSheet,"Far",true).map(x=>x.student.id),["s3"]);
  const blank:GradeSheetPayload={...gradeSheet,students:[{student:{id:"s3",studentCode:"3",fullName:"Farida"},grade:null}]};
  assert.equal(teacherGradeSummary(blank).averagePercent,null);
});
test("Phase 6 filters assessments by assignment, category and search",()=>{
  const items=[makeAssessment("quiz1"),makeAssessment("quiz2"),makeAssessment("other","a2","HOMEWORK")];
  assert.deepEqual(teacherAssessmentDirectory(items,"a1","QUIZ","quiz2").map(x=>x.id),["quiz2"]);
  assert.deepEqual(teacherAssessmentDirectory(items,"a2","ALL","").map(x=>x.id),["other"]);
  assert.equal(teacherAssessmentDirectory(items,"absent","ALL","").length,0);
});
test("Phase 6 only sends changed valid continuous marks, including explicitly cleared remarks",()=>{
  const drafts=teacherAssessmentDrafts(assessmentSheet);
  assert.deepEqual(teacherAssessmentChanges(assessmentSheet,drafts),{entries:[],invalid:false});
  drafts.scores.s1="18";drafts.remarks.s1="";
  drafts.scores.s3="0";
  const changes=teacherAssessmentChanges(assessmentSheet,drafts);
  assert.equal(changes.invalid,false);
  assert.deepEqual(changes.entries,[
    {studentId:"s1",score:18,remark:""},
    {studentId:"s3",score:0,remark:""}
  ]);
  const summary=teacherAssessmentSummary(assessmentSheet,drafts);
  assert.equal(summary.recorded,2);assert.equal(summary.missing,1);
  assert.equal(summary.averagePercent,65);
  assert.equal(summary.pendingChanges,2);
  drafts.scores.s2="-1";
  assert.equal(teacherAssessmentChanges(assessmentSheet,drafts).invalid,true);
  assert.equal(teacherAssessmentSummary(assessmentSheet,drafts).pendingChanges,null);
  drafts.scores.s2="10.5";
  assert.equal(teacherAssessmentChanges(assessmentSheet,drafts).invalid,true);
  drafts.scores.s2="";
  assert.equal(teacherAssessmentChanges(assessmentSheet,drafts).invalid,true);
  drafts.scores.s2="21";
  assert.equal(teacherAssessmentChanges(assessmentSheet,drafts).invalid,true);
});
test("Phase 6 filters missing students and validates dates with calendar boundaries",()=>{
  assert.deepEqual(teacherAssessmentStudents(assessmentSheet,"3",true)
    .map(row=>row.student.id),["s3"]);
  assert.deepEqual(teacherAssessmentStudents(assessmentSheet,"ahmad",false)
    .map(row=>row.student.id),["s1"]);
  assert.equal(teacherAssessmentDateValid("2026-02-29"),false);
  assert.equal(teacherAssessmentDateValid("2028-02-29"),true);
  assert.equal(teacherAssessmentDateValid("2026-13-05"),false);
  assert.equal(teacherAssessmentDateValid("2026-10-17"),true);
});
