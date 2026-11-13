import assert from "node:assert/strict";
import test from "node:test";
import { createSerializedWriteQueue } from "../apps/mobile/src/serialized-operations.js";
import { updateParentChildPreferences } from "../apps/mobile/src/stored-session-policy.js";
import {
  fallbackStaffTab, permittedStaffTabs
} from "../apps/web/app/staff/staff-navigation-policy.js";

const school="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const parent="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const student="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const uuid=(i:number)=>"dddddddd-dddd-4ddd-8ddd-"+i.toString(16).padStart(12,"0");

test("Phase 14: session logout delete cannot overtake an earlier pending write",async()=>{
  const queue=createSerializedWriteQueue();
  const state:{value:string|null}={value:null};
  const events:string[]=[];
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const old=queue.enqueue(async()=>{
    events.push("old-start");
    await gate;
    state.value="old-session";
    events.push("old-write");
  });
  const logout=queue.enqueue(async()=>{
    state.value=null;
    events.push("logout-delete");
  });
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  assert.deepEqual(events,["old-start"]);
  release();
  await Promise.all([old,logout,queue.drained()]);
  assert.deepEqual(events,["old-start","old-write","logout-delete"]);
  assert.equal(state.value,null);
});

test("Phase 14: failed SecureStore write rejects but does not poison future writes",async()=>{
  const queue=createSerializedWriteQueue();
  const first=queue.enqueue(async()=>{throw new Error("native storage full");});
  const events:string[]=[];
  const second=queue.enqueue(async()=>{events.push("session-cleared");});
  await assert.rejects(first,/native storage full/);
  await second;
  await queue.drained();
  assert.deepEqual(events,["session-cleared"]);
});

test("Phase 14: repeated parent selections preserve latest value without losing sibling parents",()=>{
  const key=school+":"+parent;
  const otherParent=uuid(88);
  const otherKey=school+":"+otherParent;
  const first=updateParentChildPreferences(null,school,parent,student);
  const second=updateParentChildPreferences(first,school,otherParent,uuid(89));
  const updated=updateParentChildPreferences(second,school,parent,uuid(90));
  assert.equal(updated[key],uuid(90));
  assert.equal(updated[otherKey],uuid(89));
  assert.deepEqual(Object.keys(updated),[otherKey,key]);
  assert.equal(Object.getPrototypeOf(updated),null);
  assert.throws(()=>updateParentChildPreferences(updated,"invalid",parent,student),/Invalid school/);
  assert.throws(()=>updateParentChildPreferences(updated,school,parent,"__proto__"),/Invalid school/);
});

test("Phase 14: parent preference writes are bounded and newly used child stays visible",()=>{
  let preferences:Record<string,string>|null=null;
  for(let i=0;i<140;i++){
    preferences=updateParentChildPreferences(preferences,school,uuid(i),student);
  }
  assert.equal(Object.keys(preferences!).length,100);
  assert.equal(preferences![school+":"+uuid(0)],undefined);
  assert.equal(preferences![school+":"+uuid(139)],student);
  preferences=updateParentChildPreferences(preferences,school,uuid(40),uuid(151));
  assert.equal(Object.keys(preferences!).length,100);
  assert.equal(preferences![school+":"+uuid(40)],uuid(151));
  assert.equal(Object.keys(preferences!).at(-1),school+":"+uuid(40));
});

test("Phase 14: staff role never grants workspace capabilities without explicit permissions",()=>{
  assert.deepEqual(permittedStaffTabs([]),["home","notifications","settings"]);
  assert.deepEqual(permittedStaffTabs(["DIRECTORY_VIEW","ENROLLMENT_REQUESTS"]),
    ["home","directory","registration","notifications","settings"]);
  assert.ok(permittedStaffTabs(["ATTENDANCE_REVIEW"]).includes("attendance"));
  assert.ok(permittedStaffTabs(["FEES_COLLECT"]).includes("fees"));
  assert.ok(permittedStaffTabs(["FEES_VIEW"]).includes("fees"));
  assert.ok(permittedStaffTabs(["TASKS_VIEW"]).includes("work"));
  assert.ok(permittedStaffTabs(["COMMUNICATION_DRAFT"]).includes("work"));
  assert.equal(fallbackStaffTab("registration",[]),"home");
  assert.equal(fallbackStaffTab("directory",["DIRECTORY_VIEW"]),"directory");
  assert.equal(fallbackStaffTab("settings",[]),"settings");
  assert.equal(fallbackStaffTab("notifications",null),"notifications");
  assert.deepEqual(permittedStaffTabs(["DIRECTORY_VIEW","DIRECTORY_VIEW"]),
    ["home","directory","notifications","settings"]);
});


test("Phase 14: a queued corrupted-session read cannot delete a newer login", async () => {
  const queue = createSerializedWriteQueue();
  let value: string | null = "{broken";
  const steps: string[] = [];
  let release!: () => void;
  const readGate = new Promise<void>(resolve => { release = resolve; });

  const restore = queue.enqueue(async (): Promise<null> => {
    const snapshot = value;
    steps.push("read-started");
    await readGate;
    if (snapshot === "{broken") {
      value = null;
      steps.push("invalid-record-removed");
    }
    return null;
  });
  const signIn = queue.enqueue(async () => {
    value = "new-session";
    steps.push("new-session-saved");
  });
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  assert.deepEqual(steps, ["read-started"]);
  release();
  await Promise.all([restore, signIn]);
  assert.deepEqual(steps, [
    "read-started", "invalid-record-removed", "new-session-saved"
  ]);
  assert.equal(value, "new-session");
});

test("Phase 14: read operations return results without delaying or poisoning subsequent logout", async () => {
  const queue = createSerializedWriteQueue();
  const read = queue.enqueue(async () => ({ id: "current" }));
  const remove = queue.enqueue(async () => undefined);
  assert.deepEqual(await read, { id: "current" });
  await remove;
  await queue.drained();
});

test("Phase 14: corrupt session cleanup cannot erase a newer login saved while a native read waits",async()=>{
  const queue=createSerializedWriteQueue();
  let nativeValue:string|null="corrupt";
  const events:string[]=[];
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const restore=queue.read(async()=>{
    const value=nativeValue;
    events.push("read-started");
    await gate;
    if(value==="corrupt") {
      nativeValue=null;
      events.push("corrupt-deleted");
    }
    return null;
  });
  const laterLogin=queue.enqueue(async()=>{
    nativeValue="new-user-session";
    events.push("new-login-saved");
  });
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  assert.deepEqual(events,["read-started"]);
  release();
  await Promise.all([restore,laterLogin,queue.drained()]);
  assert.deepEqual(events,["read-started","corrupt-deleted","new-login-saved"]);
  assert.equal(nativeValue,"new-user-session");
});
