import assert from "node:assert/strict";
import test from "node:test";
import type {AnnouncementPayload,ParentNotification} from "../apps/mobile/src/api.js";
import {
 STUDENT_INBOX_PAGE_SIZE,studentReadFilters,studentTopicFilters,
 studentAnnouncementFilters,studentVisibleAnnouncements,studentFilterAnnouncements,
 studentVisibleNotifications,studentFilterNotifications,studentNotificationUnread,
 studentNotificationTopic,studentInboxPage
} from "../apps/mobile/src/student-communication-model.js";

const now=new Date("2026-10-17T06:00:00Z");
function announce(id:string,scope:AnnouncementPayload["audienceScope"],
  classId:string|null=null,audienceRole:AnnouncementPayload["audienceRole"]=null,
  published="2026-10-16T09:00:00Z",archivedAt:string|null=null):AnnouncementPayload {
 return {id,schoolId:"school1",title:"Title "+id,content:"Details "+id,
  audienceScope:scope,classId,audienceRole,publishAt:published,createdAt:published,archivedAt};
}
function notify(id:string,type:string,readAt:string|null=null,
  createdAt="2026-10-16T09:00:00Z",deliveryStatus:ParentNotification["deliveryStatus"]="SENT"):ParentNotification {
 return {id,type,title:"Title "+id,message:"Text "+id,
  deepLink:null,readAt,createdAt,deliveryStatus,metadata:{}};
}
test("Student Phase 7 announcements reject archived future other-role and transferred-class notices",()=>{
 const notices=[
  announce("school","SCHOOL"),
  announce("my-class","CLASS","c1"),
  announce("wrong-class","CLASS","c2"),
  announce("wrong-role","ROLE",null,"PARENT"),
  announce("class-for-parent","CLASS","c1","PARENT"),
  announce("student-role","ROLE",null,"STUDENT"),
  announce("archived","SCHOOL",null,null,"2026-10-14T09:00:00Z","2026-10-15T09:00:00Z"),
  announce("future","SCHOOL",null,null,"2026-10-19T09:00:00Z")
 ];
 assert.deepEqual(studentVisibleAnnouncements(notices,"c1",now).map(x=>x.id),
  ["student-role","school","my-class"]); // same date, descending ID
 assert.deepEqual(studentVisibleAnnouncements(notices,null,now).map(x=>x.id),
  ["student-role","school"]);
 assert.deepEqual(studentFilterAnnouncements(notices,{classId:"c1",audience:"CLASS",
  query:"my-class",now}).map(x=>x.id),["my-class"]);
 assert.deepEqual(studentFilterAnnouncements(notices,{classId:"c1",audience:"STUDENT",
  query:"",now}).map(x=>x.id),["student-role"]);
 assert.equal(studentFilterAnnouncements(notices,{classId:"c1",audience:"ALL",
  query:"wrong-role",now}).length,0);
});
test("Student Phase 7 notification read filters topic scopes and stable order",()=>{
 const items=[
  notify("school","ANNOUNCEMENT"),
  notify("homework","HOMEWORK_PUBLISHED",null,"2026-10-15T09:00:00Z"),
  notify("attendance","ATTENDANCE_ABSENT","2026-10-17T01:00:00Z"),
  notify("fees","FEE_DUE"),
  notify("failed","RESULTS_PUBLISHED",null,"2026-10-17T05:00:00Z","FAILED")
 ];
 assert.deepEqual(studentReadFilters,["ALL","UNREAD","READ"]);
 assert.deepEqual(studentTopicFilters,["ALL","SCHOOL","ACADEMICS","ATTENDANCE","FEES"]);
 assert.deepEqual(studentAnnouncementFilters,["ALL","SCHOOL","CLASS","STUDENT"]);
 assert.equal(studentNotificationUnread(items),3);
 assert.equal(studentVisibleNotifications(items).length,4);
 assert.equal(studentNotificationTopic(items[1]!),"ACADEMICS");
 assert.equal(studentNotificationTopic(items[2]!),"ATTENDANCE");
 assert.deepEqual(studentFilterNotifications(items,{query:"Text fees",read:"UNREAD",
  topic:"FEES"}).map(x=>x.id),["fees"]);
 assert.deepEqual(studentFilterNotifications(items,{query:"",read:"READ",
  topic:"ATTENDANCE"}).map(x=>x.id),["attendance"]);
 assert.deepEqual(studentFilterNotifications(items,{query:"",read:"UNREAD",
  topic:"ACADEMICS"}).map(x=>x.id),["homework"]);
 assert.equal(studentFilterNotifications(items,{query:"",read:"READ",topic:"FEES"}).length,0);
});
test("Student Phase 7 pagination never invents inaccessible announcements or notification IDs",()=>{
 const items=Array.from({length:57},(_,i)=>({id:String(i),name:String(i)}));
 assert.equal(STUDENT_INBOX_PAGE_SIZE,20);
 const first=studentInboxPage(items,1,x=>x.id);
 assert.equal(first.showing,20);
 assert.equal(first.total,57);
 assert.equal(first.hasMore,true);
 assert.equal(studentInboxPage(items,2,x=>x.id).showing,40);
 assert.equal(studentInboxPage(items,3,x=>x.id).showing,57);
 assert.equal(studentInboxPage(items,1,x=>x.id,"44").showing,57);
 assert.equal(studentInboxPage(items,1,x=>x.id,"unknown").showing,20);
 assert.deepEqual(items.slice(0,20),first.visible);
});
