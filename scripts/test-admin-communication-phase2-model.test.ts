import assert from "node:assert/strict";
import test from "node:test";
import { announcementStatus, findAnnouncements, pageAnnouncements,
  schoolLocalTimeToIso, schoolInstantToLocal, ANNOUNCEMENT_PAGE_SIZE,
  type AnnouncementSummary
} from "../apps/web/app/admin/communication-announcements-model";

function item(id:string,when:string,scope:AnnouncementSummary["audienceScope"],
  classId:string|null=null,archivedAt:string|null=null,title="School update"):AnnouncementSummary {
  return {id,title,content:"Content for " + id,audienceScope:scope,
    classId,audienceRole:scope==="ROLE"?"PARENT":null,publishAt:when,archivedAt};
}
const now=Date.parse("2026-10-14T12:00:00Z");
const rows=[
  item("published","2026-10-14T09:00:00Z","CLASS","class-a",null,"Math exam"),
  item("scheduled","2026-10-15T09:00:00Z","ROLE",null,null,"Parent meeting"),
  item("archived","2026-10-13T09:00:00Z","SCHOOL",null,"2026-10-14T01:00:00Z","Holiday"),
  item("other-class","2026-10-14T08:00:00Z","CLASS","class-b",null,"Math exam")
];
const filter=(options:Partial<Parameters<typeof findAnnouncements>[1]>)=>
  findAnnouncements(rows,{search:"",status:"ALL",audience:"ALL",classId:"",...options},now);

test("announcement status is exact and archived supersedes scheduled",()=>{
  assert.deepEqual(rows.map(x=>announcementStatus(x,now)),
    ["PUBLISHED","SCHEDULED","ARCHIVED","PUBLISHED"]);
});
test("search/filter entire authorized data set by title, message, status, audience and class",()=>{
  assert.deepEqual(filter({search:"parent"}).map(x=>x.id),["scheduled"]);
  assert.deepEqual(filter({status:"ARCHIVED"}).map(x=>x.id),["archived"]);
  assert.deepEqual(filter({status:"SCHEDULED",audience:"ROLE"}).map(x=>x.id),["scheduled"]);
  assert.deepEqual(filter({classId:"class-a",audience:"CLASS"}).map(x=>x.id),["published"]);
  assert.deepEqual(filter({search:"content for other"}).map(x=>x.id),["other-class"]);
  assert.deepEqual(filter({search:"no results"}),[]);
  assert.equal(filter({}).length,4);
});
test("display pagination preserves results and never drops authorized items",()=>{
  const fortyFive=Array.from({length:45},(_,i)=>item("item"+i,
    new Date(now-i*3600000).toISOString(),"SCHOOL"));
  const ordered=findAnnouncements(fortyFive,
    {search:"",status:"ALL",audience:"ALL",classId:""},now);
  const page1=pageAnnouncements(ordered,20);
  assert.equal(page1.shown,ANNOUNCEMENT_PAGE_SIZE);
  assert.equal(page1.hasMore,true);
  const page2=pageAnnouncements(ordered,40);
  assert.equal(page2.rows.length,40);
  const page3=pageAnnouncements(ordered,60);
  assert.equal(page3.rows.length,45);
  assert.equal(page3.hasMore,false);
  assert.equal(new Set(page3.rows.map(x=>x.id)).size,45);
});
test("school-local time conversion is independent of administrator browser timezone",()=>{
  const iso=schoolLocalTimeToIso("2026-10-14T09:00","Asia/Kabul");
  assert.equal(iso,"2026-10-14T04:30:00.000Z");
  assert.equal(schoolInstantToLocal(iso,"Asia/Kabul"),"2026-10-14T09:00");
  assert.equal(schoolLocalTimeToIso("2026-10-14T09:00","UTC"),"2026-10-14T09:00:00.000Z");
  assert.equal(schoolInstantToLocal("2026-10-14T04:30:00.000Z","Asia/Kabul"),"2026-10-14T09:00");
  assert.throws(()=>schoolLocalTimeToIso("2026-02-30T09:00","Asia/Kabul"));
  assert.throws(()=>schoolLocalTimeToIso("2026-10-14T25:00","Asia/Kabul"));
  assert.throws(()=>schoolLocalTimeToIso("2026-03-08T02:30","America/New_York"),
    /does not exist/i);
});
