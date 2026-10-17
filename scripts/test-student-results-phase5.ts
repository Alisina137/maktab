import assert from "node:assert/strict";
import test from "node:test";
import type {LearnerAcademicPayload} from "../apps/mobile/src/api.js";
import {
  studentVisibleResults,studentExamGroups,studentSubjectPerformance,
  studentResultHistory,studentResultsSubjects,studentResultsTypes,
  studentFilterResults,studentPublishedAverage,studentResultsTabs
} from "../apps/mobile/src/student-results-model.js";
type Row=LearnerAcademicPayload["results"][number];
function grade(id:string,subjectId:string,score:number,max:number,date:string,
 status:"DRAFT"|"PUBLISHED"="PUBLISHED",examStatus:"PUBLISHED"|"DRAFT"|"ARCHIVED"="PUBLISHED",
 classId="c1",examType="MIDTERM"):Row{
 return {grade:{id,score,status,remark:id==="latest"?"Good work":null,publishedAt:date},
  exam:{id:"exam-"+id,name:"Exam "+id,type:examType,status:examStatus,publishedAt:date},
  examSubject:{id:"sheet-"+id,maxScore:max,subjectId,classId,examDate:date.slice(0,10)},
  className:"Grade 10",subjectName:subjectId==="math"?"Math":"Physics"};
}
const data:LearnerAcademicPayload={
 student:{id:"student",studentCode:"S-01",fullName:"Learner",academicYearId:"year",classId:"c1"},
 homework:[],results:[
 grade("old","math",30,50,"2026-09-12T09:00:00Z"),
 grade("latest","math",80,100,"2026-10-15T10:00:00Z"),
 grade("science","science",40,100,"2026-10-10T10:00:00Z","PUBLISHED","ARCHIVED","c1","FINAL"),
 grade("draft","math",100,100,"2026-10-17T10:00:00Z","DRAFT"),
 grade("unreleased","math",100,100,"2026-10-17T11:00:00Z","PUBLISHED","DRAFT"),
 grade("wrong-class","math",100,100,"2026-10-17T11:00:00Z","PUBLISHED","PUBLISHED","c2"),
 grade("invalid","science",120,100,"2026-10-17T12:00:00Z")
]};
test("Student Phase 5 only includes authorized published valid grades",()=>{
 const rows=studentVisibleResults(data);
 assert.deepEqual(rows.map(x=>x.grade.id),["latest","science","old"]);
 assert.deepEqual(studentResultsTabs,["EXAMS","PERFORMANCE","HISTORY"]);
 assert.equal(studentVisibleResults(null).length,0);
 assert.equal(studentPublishedAverage(rows),60);
 assert.equal(studentPublishedAverage([]),null);
 assert.equal(studentVisibleResults({...data,results:[...data.results,data.results[0]!]}).length,3);
});
test("Student Phase 5 exam groups and weighted subject trends",()=>{
 const rows=studentVisibleResults(data);
 const exams=studentExamGroups(rows);
 assert.equal(exams.length,3);
 assert.equal(exams[0]?.percent,80);
 assert.equal(exams[1]?.percent,40);
 assert.equal(exams[2]?.percent,60);
 const subjects=studentSubjectPerformance(rows);
 assert.equal(subjects[0]?.name,"Physics");
 assert.equal(subjects[0]?.percent,40);
 assert.equal(subjects[0]?.trend,"NEW");
 assert.equal(subjects[1]?.percent,73);
 assert.equal(subjects[1]?.latestPercent,80);
 assert.equal(subjects[1]?.previousPercent,60);
 assert.equal(subjects[1]?.trend,"UP");
 assert.deepEqual(subjects[1]?.timeline.map(x=>x.id),["latest","old"]);
});
test("Student Phase 5 filters and published result chronology",()=>{
 const rows=studentVisibleResults(data);
 assert.deepEqual(studentResultsSubjects(rows),["Math","Physics"]);
 assert.deepEqual(studentResultsTypes(rows),["FINAL","MIDTERM"]);
 assert.deepEqual(studentFilterResults(rows,{subject:"Math",examType:"MIDTERM",query:"latest"})
   .map(x=>x.grade.id),["latest"]);
 assert.deepEqual(studentFilterResults(rows,{subject:null,examType:"FINAL",query:"Physics"})
   .map(x=>x.grade.id),["science"]);
 assert.deepEqual(studentFilterResults(rows,{subject:"Physics",examType:"MIDTERM",query:""}),[]);
 const history=studentResultHistory(rows);
 assert.deepEqual(history.map(x=>x.id),["latest","science","old"]);
 assert.equal(history[0]?.remark,"Good work");
 assert.equal(history[0]?.percent,80);
});
