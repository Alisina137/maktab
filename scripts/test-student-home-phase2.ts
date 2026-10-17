import assert from "node:assert/strict";
import test from "node:test";
import type {
  AnnouncementPayload, HomeworkSubmissionPayload, LearnerAcademicPayload,
  StudentTimetablePayload
} from "../apps/mobile/src/api.js";
import {
  studentSchoolClock,studentTodayLessons,studentLessonFocus,
  studentHomeworkOverview,studentDueDay,studentPublishedResults,
  studentAcademicOverview,studentLatestAnnouncement
} from "../apps/mobile/src/student-home-model.js";

const at=(day:string,time:string)=>new Date(`${day}T${time}:00Z`);
const period=(id:string,start:string,end:string,weekday="SATURDAY")=>({
  period:{id,weekday,startsAt:start,endsAt:end},
  subjectName:id==="first"?"Mathematics":id==="next"?"English":"History",
  teacherName:"Teacher"
});
const timetable={
  student:{id:"student1",fullName:"Student One",studentCode:"S-001",
    status:"ACTIVE",classId:"c1",academicYearId:"year1"},
  classSection:{id:"c1",code:"1-A",name:"1-A",academicYearId:"year1"},
  academicYear:{id:"year1",name:"1405",status:"ACTIVE"},
  periods:[
    period("next","09:00","09:45"),
    period("first","08:00","08:45"),
    period("other","07:00","07:45","SUNDAY")
  ]
} as StudentTimetablePayload;
const homework=(id:string,due:string,status="PUBLISHED")=>({
  homework:{id,dueAt:due,status,title:id},subjectName:"Math",className:"1-A"
}) as LearnerAcademicPayload["homework"][number];
const submission=(homeworkId:string,status:HomeworkSubmissionPayload["status"]):
  HomeworkSubmissionPayload=>({
    id:"submission-"+homeworkId,homeworkId,studentId:"student1",answer:"Done",
    attachmentFileId:null,status,feedback:null,submittedAt:"2026-10-16T06:00:00Z",
    reviewedAt:status==="REVIEWED"?"2026-10-16T07:00:00Z":null
  });
const result=(gradeId:string,score:number,maxScore:number,gradeStatus:"DRAFT"|"PUBLISHED",
  examStatus:"DRAFT"|"PUBLISHED"|"ARCHIVED",date:string,subjectId="math")=>({
  grade:{id:gradeId,score,remark:null,status:gradeStatus,publishedAt:date},
  exam:{id:"exam-"+gradeId,name:gradeId,type:"MIDTERM",
    status:examStatus,publishedAt:date},
  examSubject:{id:"subject-"+gradeId,maxScore,subjectId,classId:"c1",examDate:"2026-10-16"},
  subjectName:subjectId==="math"?"Mathematics":"Science",className:"1-A"
}) as LearnerAcademicPayload["results"][number];
const notice=(id:string,scope:AnnouncementPayload["audienceScope"],cls:string|null,
  date:string,archived=false)=>({
  id,schoolId:"school1",title:id,content:id,audienceScope:scope,classId:cls,
  audienceRole:null,publishAt:date,createdAt:date,archivedAt:archived?date:null
}) as AnnouncementPayload;

test("Student Phase 2 uses Kabul-local date for weekday and deadlines",()=>{
  const now=at("2026-10-17","04:30");
  assert.deepEqual(studentSchoolClock(now),{day:"2026-10-17",weekday:"SATURDAY",minutes:540});
  assert.equal(studentSchoolClock(at("2026-10-17","20:30"))?.day,"2026-10-18");
  assert.equal(studentSchoolClock(new Date(NaN)),null);
  assert.equal(studentDueDay("2026-10-17T20:00:00Z"),"2026-10-18");
  assert.deepEqual(studentTodayLessons(timetable,now).map(x=>x.period.id),["first","next"]);
});
test("Student Phase 2 identifies current, next and completed classes without inventing active lesson",()=>{
  assert.equal(studentLessonFocus(timetable,at("2026-10-17","04:15")).state,"NEXT");
  const current=studentLessonFocus(timetable,at("2026-10-17","04:45"));
  assert.equal(current.state,"CURRENT");
  assert.equal(current.period?.period.id,"next");
  assert.equal(current.completed,1);
  const over=studentLessonFocus(timetable,at("2026-10-17","06:00"));
  assert.equal(over.state,"DONE");assert.equal(over.period,null);
  assert.equal(studentLessonFocus(null,at("2026-10-17","04:30")).state,"UNKNOWN");
});
test("Student Phase 2 nearest due homework excludes submitted/reviewed, retains revision and flags overdue",()=>{
  const now=at("2026-10-17","04:30");
  const items=[
    homework("later","2026-10-18T07:00:00Z"),
    homework("submitted","2026-10-17T04:00:00Z"),
    homework("soon","2026-10-17T06:00:00Z"),
    homework("overdue","2026-10-16T08:00:00Z"),
    homework("unpublished","2026-10-17T05:00:00Z","DRAFT")
  ];
  const records=[submission("submitted","SUBMITTED"),submission("later","REVIEWED"),
    submission("soon","REVISION_REQUESTED")];
  const view=studentHomeworkOverview(items,records,now);
  assert.equal(view.upcoming?.homework.id,"soon");
  assert.equal(view.pending,1);
  assert.equal(view.dueToday,1);
  assert.equal(view.overdue,1);
  assert.equal(view.revision,1);
  assert.equal(view.submitted,1);
  assert.equal(view.reviewed,1);
  assert.equal(view.publishedCount,4);
  assert.equal(view.completionPercent,25);
  const unknown=studentHomeworkOverview(items,null,now);
  assert.equal(unknown.pending,null);
  assert.equal(unknown.dueToday,null);
  assert.equal(unknown.completionPercent,null);
  assert.equal(studentHomeworkOverview([],[],now).completionPercent,null);
});
test("Student Phase 2 never mixes draft or invalid grades into published averages",()=>{
  const results=[
    result("released",80,100,"PUBLISHED","PUBLISHED","2026-10-15T10:00:00Z"),
    result("archived",30,50,"PUBLISHED","ARCHIVED","2026-10-14T10:00:00Z","science"),
    result("draft",100,100,"DRAFT","PUBLISHED","2026-10-17T10:00:00Z"),
    result("not-published",100,100,"PUBLISHED","DRAFT","2026-10-17T09:00:00Z"),
    result("bad",110,100,"PUBLISHED","PUBLISHED","2026-10-17T10:00:00Z")
  ];
  assert.equal(studentPublishedResults(results).length,2);
  const view=studentAcademicOverview(results);
  assert.equal(view.publishedCount,2);
  assert.equal(view.percent,73); // 110 marks of 150 maximum
  assert.equal(view.latest?.grade.id,"released");
  assert.equal(view.focusSubject,"Science");
  assert.equal(view.focusPercent,60);
  assert.equal(studentAcademicOverview([]).percent,null);
  assert.equal(studentAcademicOverview([]).focusSubject,null);
});
test("Student Phase 2 school update excludes archived and transferred class notices",()=>{
  const items=[
    notice("old-class","CLASS","old","2026-10-18T10:00:00Z"),
    notice("archived","SCHOOL",null,"2026-10-19T10:00:00Z",true),
    notice("current-class","CLASS","c1","2026-10-17T10:00:00Z"),
    notice("school","SCHOOL",null,"2026-10-16T10:00:00Z")
  ];
  assert.equal(studentLatestAnnouncement(items,"c1",new Date("2026-10-17T12:00:00Z"))?.id,"current-class");
  assert.equal(studentLatestAnnouncement(items,null,new Date("2026-10-17T12:00:00Z"))?.id,"school");
  assert.equal(studentLatestAnnouncement([items[0]],"c1",new Date("2026-10-17T12:00:00Z")),null);
});
