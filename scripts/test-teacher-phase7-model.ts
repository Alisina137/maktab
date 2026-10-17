import assert from "node:assert/strict";
import test from "node:test";
import type { AnnouncementPayload, TeachingLesson, TeacherTeachingPayload } from "../apps/mobile/src/api.js";
import {
  teacherValidIsoDate,teacherValidReportRange,teacherValidLessonInput,
  teacherLessonList,teacherUnitList,teacherTeachingProgress,
  teacherAnnouncementValid,teacherAnnouncementList
} from "../apps/mobile/src/teacher-phase7-model.js";

const lesson=(id:string,status:TeachingLesson["status"],date:string):TeachingLesson=>({
  id,assignmentId:"assignment-a",unitId:null,lessonDate:date,topic:id,
  objective:"Practice "+id,materials:"Book",notes:"Note",status
});
const lessons=[lesson("older","PLANNED","2026-10-01"),
  lesson("newer","COMPLETED","2026-10-16"),lesson("postponed","POSTPONED","2026-10-08")];
const units:TeacherTeachingPayload["units"]=[
  {unit:{id:"unit1",title:"Fractions",sortOrder:2},status:"IN_PROGRESS"},
  {unit:{id:"unit2",title:"Numbers",sortOrder:1},status:"COMPLETED"},
  {unit:{id:"unit3",title:"Shapes",sortOrder:3},status:"NOT_STARTED"}];
const teaching:TeacherTeachingPayload={lessons,units,summary:{
  lessonPlanned:1,lessonCompleted:1,lessonPostponed:1,unitsTotal:3,
  unitsCompleted:1,unitsInProgress:1,homeworksPublished:0,homeworkDrafts:0,
  assessmentCount:0
}};
function announce(id:string,scope:AnnouncementPayload["audienceScope"],
  published:string,archived=false):AnnouncementPayload{
  return {id,schoolId:"school1",title:"Announcement "+id,content:"Detail "+id,
    audienceScope:scope,classId:scope==="CLASS"?"class1":null,
    audienceRole:null,publishAt:published,createdAt:published,
    archivedAt:archived?published:null};
}

test("Phase 7 validates actual Gregorian lesson dates and report ranges",()=>{
  assert.equal(teacherValidIsoDate("2026-10-17"),true);
  assert.equal(teacherValidIsoDate("2026-02-29"),false);
  assert.equal(teacherValidIsoDate("2028-02-29"),true);
  assert.equal(teacherValidIsoDate("2026-13-01"),false);
  assert.equal(teacherValidReportRange("2026-10-01","2026-10-17"),true);
  assert.equal(teacherValidReportRange("2026-10-17","2026-10-01"),false);
  assert.equal(teacherValidReportRange("2026-02-31","2026-03-01"),false);
  assert.equal(teacherValidLessonInput({lessonDate:"2026-10-17",topic:"T",
    objective:"O",materials:"",notes:""}),true);
  assert.equal(teacherValidLessonInput({lessonDate:"2026-02-30",topic:"T",
    objective:"O",materials:"",notes:""}),false);
  assert.equal(teacherValidLessonInput({lessonDate:"2026-10-17",topic:" ",
    objective:"O",materials:"",notes:""}),false);
  assert.equal(teacherValidLessonInput({lessonDate:"2026-10-17",topic:"T",
    objective:"O",materials:"",notes:"a".repeat(4001)}),false);
});
test("Phase 7 lesson search and status filters use stable newest-first ordering",()=>{
  assert.deepEqual(teacherLessonList(lessons,"","ALL").map(x=>x.id),[
    "newer","postponed","older"]);
  assert.deepEqual(teacherLessonList(lessons,"note","COMPLETED")
    .map(x=>x.id),["newer"]);
  assert.deepEqual(teacherLessonList(lessons,"zzzz","ALL"),[]);
});
test("Phase 7 curriculum progress never invents percentages for empty curricula",()=>{
  assert.deepEqual(teacherUnitList(units,"ALL","").map(x=>x.unit.id),[
    "unit2","unit1","unit3"]);
  assert.deepEqual(teacherUnitList(units,"IN_PROGRESS","fract")
    .map(x=>x.unit.id),["unit1"]);
  const progress=teacherTeachingProgress(teaching);
  assert.deepEqual(progress,{planned:1,completed:1,postponed:1,
    unitTotal:3,unitCompleted:1,completionPercent:33});
  assert.equal(teacherTeachingProgress({...teaching,units:[]}).completionPercent,null);
});
test("Phase 7 teacher announcement publishing requires current supervised class",()=>{
  assert.equal(teacherAnnouncementValid("class1","Welcome","Test",["class1"]),true);
  assert.equal(teacherAnnouncementValid("class2","Welcome","Test",["class1"]),false);
  assert.equal(teacherAnnouncementValid("class1","X","Test",["class1"]),false);
  assert.equal(teacherAnnouncementValid("class1","Welcome"," ",["class1"]),false);
  assert.equal(teacherAnnouncementValid("class1","Welcome","x".repeat(10001),["class1"]),false);
  assert.equal(teacherAnnouncementValid("","Welcome","Test",[]),false);
});
test("Phase 7 announcement search hides archived entries and preserves audience filters",()=>{
  const notices=[
    announce("old","CLASS","2026-10-12T00:00:00Z"),
    announce("new","SCHOOL","2026-10-17T00:00:00Z"),
    announce("role","ROLE","2026-10-15T00:00:00Z"),
    announce("archived","CLASS","2026-10-18T00:00:00Z",true)
  ];
  assert.deepEqual(teacherAnnouncementList(notices,"","ALL").map(x=>x.id),
    ["new","role","old"]);
  assert.deepEqual(teacherAnnouncementList(notices,"","CLASS").map(x=>x.id),["old"]);
  assert.deepEqual(teacherAnnouncementList(notices,"DEtail NEW","ALL").map(x=>x.id),["new"]);
  assert.deepEqual(teacherAnnouncementList(notices,"","ROLE").map(x=>x.id),["role"]);
});
