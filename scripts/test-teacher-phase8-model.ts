import assert from "node:assert/strict";
import test from "node:test";
import type {
  AnnouncementPayload, ParentNotification, TeacherAcademicsPayload, TeacherTodayPayload
} from "../apps/mobile/src/api.js";
import {
  teacherInboxList, teacherUnreadCount, teacherAnnouncementPreview,
  teacherProfileSummary, teacherHubLoadStatus
} from "../apps/mobile/src/teacher-phase8-model.js";
import {notificationDestination} from "../apps/mobile/src/notification-destination.js";

function notification(id:string,createdAt:string,readAt:string|null,type="HOMEWORK_PUBLISHED"):ParentNotification{
  return {id,type,title:"School notice "+id,message:"Homework ready "+id,
    deepLink:"/homework/00000000-0000-4000-8000-000000000000",
    createdAt,readAt,deliveryStatus:"SENT",metadata:{}};
}
const items=[
 notification("first","2026-10-17T07:00:00Z",null),
 notification("old","2026-10-16T07:00:00Z","2026-10-16T08:00:00Z"),
 notification("latest","2026-10-17T08:00:00Z",null)
];
function announcement(id:string,publishAt:string,archivedAt:string|null):AnnouncementPayload{
 return {id,schoolId:"school-1",title:"School notice",content:"Message",
   audienceScope:"SCHOOL",classId:null,audienceRole:null,
   publishAt,createdAt:publishAt,archivedAt};
}
const today:TeacherTodayPayload={
  date:"2026-10-17",weekday:"SATURDAY",
  teacher:{userId:"teacher-1",fullName:"Teacher Example",employeeCode:"T-004"},
  supervisedClasses:[
    {assignmentId:"a1",classId:"class-1",className:"Class One",classCode:"1A",attendanceStatus:"PENDING",attendanceId:null},
    {assignmentId:"a2",classId:"class-2",className:"Class Two",classCode:"2A",attendanceStatus:"SUBMITTED",attendanceId:"att1"}
  ],schedule:[]
};
const academics:TeacherAcademicsPayload={
  assignmentDetails:[
    {assignmentId:"a1",academicYearId:"year1",classId:"class-1",className:"Class One",classCode:"1A",subjectId:"math",subjectName:"Math"},
    {assignmentId:"a2",academicYearId:"year1",classId:"class-1",className:"Class One",classCode:"1A",subjectId:"english",subjectName:"English"},
    {assignmentId:"a3",academicYearId:"year1",classId:"class-2",className:"Class Two",classCode:"2A",subjectId:"science",subjectName:"Science"}
  ],
  schedule:[
    {id:"period-1",weekday:"SATURDAY",startsAt:"08:00",endsAt:"08:45",classId:"class-1",className:"Class One",classCode:"1A",subjectId:"math",subjectName:"Math"},
    {id:"period-2",weekday:"SUNDAY",startsAt:"08:00",endsAt:"08:45",classId:"class-2",className:"Class Two",classCode:"2A",subjectId:"science",subjectName:"Science"}
  ]
};
test("Phase 8 inbox stable descending order and read/unread filtering",()=>{
 assert.deepEqual(teacherInboxList(items,"ALL","").map(x=>x.id),["latest","first","old"]);
 assert.deepEqual(teacherInboxList(items,"UNREAD","").map(x=>x.id),["latest","first"]);
 assert.deepEqual(teacherInboxList(items,"READ","").map(x=>x.id),["old"]);
 assert.equal(teacherUnreadCount(items),2);
 assert.deepEqual(teacherInboxList(items,"ALL"," NOTICE LATEST ").map(x=>x.id),["latest"]);
 assert.deepEqual(teacherInboxList(items,"UNREAD","",1).map(x=>x.id),["latest"]);
 assert.equal(teacherInboxList(items,"ALL","",0).length,0);
 assert.equal(teacherInboxList(items,"ALL","",-4).length,0);
 assert.equal(teacherInboxList(items,"ALL","",NaN).length,3);
});
test("Phase 8 school announcements hide archived entries and bound previews",()=>{
 const data=[
  announcement("a","2026-10-15T00:00:00Z",null),
  announcement("b","2026-10-17T00:00:00Z",null),
  announcement("c","2026-10-18T00:00:00Z","2026-10-19T00:00:00Z")
 ];
 assert.deepEqual(teacherAnnouncementPreview(data).map(x=>x.id),["b","a"]);
 assert.deepEqual(teacherAnnouncementPreview(data,1).map(x=>x.id),["b"]);
 assert.deepEqual(teacherAnnouncementPreview(data,0),[]);
});
test("Phase 8 profile uses server identity and does not fabricate unknown metrics",()=>{
 assert.deepEqual(teacherProfileSummary(null,null),{
  employeeCode:null,fullName:null,assignments:null,classes:null,
  supervisionClasses:null,weeklyPeriods:null
 });
 assert.deepEqual(teacherProfileSummary(today,academics),{
  employeeCode:"T-004",fullName:"Teacher Example",assignments:3,classes:2,
  supervisionClasses:2,weeklyPeriods:2
 });
 const noToday=teacherProfileSummary(null,academics);
 assert.equal(noToday.employeeCode,null);
 assert.equal(noToday.classes,2);
 assert.equal(noToday.supervisionClasses,null);
});
test("Phase 8 transient offline conditions are stale, not zero data",()=>{
 assert.equal(teacherHubLoadStatus(true,true),"STALE");
 assert.equal(teacherHubLoadStatus(false,true),"ERROR");
 assert.equal(teacherHubLoadStatus(false,false),"READY");
});
test("Phase 8 notification destinations do not accept unknown app URLs",()=>{
 assert.equal(notificationDestination("TEACHER",notification("x","2026-10-17T00:00:00Z",null)),"TEACHER_HOMEWORK");
 assert.equal(notificationDestination("TEACHER",{type:"FEE_DUE",deepLink:"https://example.org"}),null);
 assert.equal(notificationDestination("TEACHER",{type:"ANNOUNCEMENT",deepLink:"https://example.org"}),null);
});
