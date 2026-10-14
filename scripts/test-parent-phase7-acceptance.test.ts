import test from "node:test";
import assert from "node:assert/strict";
import { evaluateParentAcceptance, PARENT_GATES } from "./parent-phase7-acceptance.mjs";

const sha="a".repeat(40);
const now=new Date("2026-10-14T13:00:00Z");
const time="2026-10-14T12:00:00Z";
const populated=()=>({
  commitSha:sha,operator:"Independent QA",device:"Android Pixel 7 / build 2026-10-14",
  environment:"STAGING",checks:Object.fromEntries(Object.keys(PARENT_GATES).map(k=>
    [k,{result:"PASS",reference:"qa-evidence/"+k,observedAt:time}]))
});

test("without real device observations the report must remain NO-GO, never fake PASS",()=>{
  const result=evaluateParentAcceptance(null,sha,now);
  assert.equal(result.productionDecision,"NO_GO");
  assert.equal(result.status,"INCOMPLETE");
  assert.equal(result.checks.length,Object.keys(PARENT_GATES).length);
  assert.ok(result.checks.every(c=>c.result==="NOT_RUN"));
  assert.ok(result.blockers.length>=Object.keys(PARENT_GATES).length);
});

test("even a complete manifest is only ready for independent review, never production approved",()=>{
  const result=evaluateParentAcceptance(populated(),sha,now);
  assert.equal(result.status,"READY_FOR_INDEPENDENT_REVIEW");
  assert.equal(result.productionDecision,"NO_GO");
  assert.equal(result.blockers.length,0);
});

test("rejected wrong SHA, missing device, stale timestamps, secrets and unverified runs",()=>{
  const wrong=populated();
  wrong.commitSha="b".repeat(40);
  assert.equal(evaluateParentAcceptance(wrong,sha,now).status,"INCOMPLETE");
  const noDevice=populated();
  noDevice.device="";
  assert.equal(evaluateParentAcceptance(noDevice,sha,now).status,"INCOMPLETE");
  const stale=populated();
  stale.checks.home={result:"PASS",reference:"qa-evidence/home",observedAt:"2025-01-01T12:00:00Z"};
  assert.ok(evaluateParentAcceptance(stale,sha,now).blockers.some(b=>b.includes("home has no recent")));
  const secret=populated();
  secret.checks.inbox={result:"PASS",reference:"session=private-credential",observedAt:time};
  assert.equal(evaluateParentAcceptance(secret,sha,now).status,"INCOMPLETE");
  const unverified=populated();
  unverified.checks.push_cold_start={result:"NOT_RUN",reference:"qa-evidence/push",observedAt:time};
  assert.equal(evaluateParentAcceptance(unverified,sha,now).status,"INCOMPLETE");
  assert.equal(evaluateParentAcceptance(populated(),"invalid-sha",now).status,"INCOMPLETE");
});
