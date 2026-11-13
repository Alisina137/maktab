import assert from "node:assert/strict";
import test from "node:test";
import { removeLocalSessionForLogout, revokeSignedOutSession }
  from "../apps/mobile/src/logout-operations.js";

test("Phase 17.4: local deletion succeeds on the first attempt", async () => {
  let calls=0;
  assert.equal(await removeLocalSessionForLogout(async()=>{calls++}),true);
  assert.equal(calls,1);
});

test("Phase 17.4: failed native SecureStore delete is retried once", async () => {
  let calls=0;
  const cleared=await removeLocalSessionForLogout(async()=>{
    calls++;
    if(calls===1)throw Error("temporary secure storage unavailable");
  });
  assert.equal(cleared,true);
  assert.equal(calls,2);
});

test("Phase 17.4: repeated secure delete failure must not report a successful logout", async () => {
  let calls=0;
  const cleared=await removeLocalSessionForLogout(async()=>{
    calls++;
    throw Error("native storage failure");
  });
  assert.equal(cleared,false);
  assert.equal(calls,2);
});

test("Phase 17.5: server logout still executes when push deactivation fails", async () => {
  const actions:string[]=[];
  const result=await revokeSignedOutSession("old-access","old-refresh",
    async token=>{actions.push("push:"+token);throw Error("push service down")},
    async token=>{actions.push("auth:"+token)});
  assert.deepEqual(actions.sort(),["auth:old-refresh","push:old-access"]);
  assert.deepEqual(result,{push:"rejected",auth:"fulfilled"});
});

test("Phase 17.5: push deactivation still executes when token revocation fails", async () => {
  const actions:string[]=[];
  const result=await revokeSignedOutSession("access","refresh",
    async token=>{actions.push("push:"+token)},
    async token=>{actions.push("auth:"+token);throw Error("offline")});
  assert.deepEqual(actions.sort(),["auth:refresh","push:access"]);
  assert.deepEqual(result,{push:"fulfilled",auth:"rejected"});
});

test("Phase 17.5: no stale access or refresh token means no network calls", async () => {
  const result=await revokeSignedOutSession(null,null,
    async()=>{throw Error("should skip push")},
    async()=>{throw Error("should skip logout")});
  assert.deepEqual(result,{push:"skipped",auth:"skipped"});
});

test("Phase 17.5: independent slow push cleanup cannot block token revocation", async () => {
  let resolvePush!:()=>void;
  let authCalled=false;
  const pushPending=new Promise<void>(resolve=>{resolvePush=resolve});
  const running=revokeSignedOutSession("access","refresh",
    async()=>pushPending,
    async()=>{authCalled=true});
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(authCalled,true);
  resolvePush();
  assert.deepEqual(await running,{push:"fulfilled",auth:"fulfilled"});
});
