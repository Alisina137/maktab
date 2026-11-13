import assert from "node:assert/strict";
import test from "node:test";
import type {ParentNotification} from "../apps/mobile/src/api.js";
import {teacherInboxList,teacherInboxMatches} from "../apps/mobile/src/teacher-phase8-model.js";
import {notificationDestination} from "../apps/mobile/src/notification-destination.js";

const notification=(index:number,readAt:string|null=null):ParentNotification=>({
  id:"notice-"+String(index).padStart(3,"0"),
  type:"HOMEWORK_PUBLISHED",
  title:"Class update "+index,
  message:"Homework "+index,
  deepLink:"/homework/00000000-0000-4000-8000-000000000000",
  createdAt:new Date(Date.UTC(2026,9,1,0,index)).toISOString(),
  readAt,deliveryStatus:"SENT",metadata:{}
});
test("Phase 18.2: teacher inbox counts and pages across more than 100 notifications",()=>{
  const all=Array.from({length:165},(_,i)=>notification(i,i%2?"2026-11-13T00:00:00Z":null));
  assert.equal(teacherInboxMatches(all,"ALL","").length,165);
  assert.equal(teacherInboxList(all,"ALL","",30).length,30);
  assert.equal(teacherInboxList(all,"ALL","",120).length,120);
  assert.equal(teacherInboxList(all,"ALL","",180).length,165);
  assert.equal(teacherInboxMatches(all,"UNREAD","").length,83);
  assert.equal(teacherInboxMatches(all,"READ","").length,82);
  assert.equal(teacherInboxMatches(all,"ALL","update 14").length,11);
  const page120=teacherInboxList(all,"ALL","",120).map(x=>x.id);
  assert.equal(page120[0],"notice-164");
  assert.equal(page120[119],"notice-045");
  assert.equal(teacherInboxList(all,"ALL","",NaN).length,30);
  assert.equal(teacherInboxList(all,"ALL","",-2).length,0);
  assert.equal(all[0].id,"notice-000"); // sorting must not mutate inputs
});
test("Phase 18.5: Teacher notification destinations stay role- and scheme-checked",()=>{
  const valid=notification(1);
  assert.equal(notificationDestination("TEACHER",valid),"TEACHER_HOMEWORK");
  assert.equal(notificationDestination("TEACHER",{...valid,deepLink:"https://evil.example/"}),null);
  assert.equal(notificationDestination("TEACHER",{...valid,type:"UNSUPPORTED_EVENT"}),null);
  assert.equal(notificationDestination("TEACHER",{...valid,type:"ANNOUNCEMENT",deepLink:"/announcements"}),"TEACHER_ANNOUNCEMENTS");
});
