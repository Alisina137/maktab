import assert from "node:assert/strict";
import test from "node:test";
import { parseSubscriptionHealth, subscriptionNextActions, subscriptionCheckpoints } from "./pilot-subscription-guidance-model.js";
import { evaluateSubscriptionHealth } from "../../../../packages/database/src/subscription-health.js";

const data = (
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE" | "SUSPENDED" | "CANCELLED",
  expiry: string | null, grace: string | null = null, date = "2026-10-16"
) => ({health:evaluateSubscriptionHealth({ status, expiresOn:expiry, graceEndsOn:grace },date)});

test("Phase 7: every recorded subscription state remains consistent with platform health", () => {
  const cases: Array<Parameters<typeof data>> = [
    ["ACTIVE","2026-12-01"],["ACTIVE","2026-10-23"],["TRIAL","2026-10-31"],
    ["GRACE","2026-10-15","2026-10-18"],["GRACE","2026-10-12","2026-10-15"],
    ["PAST_DUE","2026-10-15"],["CANCELLED",null],["SUSPENDED","2026-10-30"],
    ["ACTIVE",null],["ACTIVE","2026-10-15"]
  ];
  for(const entry of cases){
    const source=data(...entry);
    assert.deepEqual(parseSubscriptionHealth(source),source.health);
  }
});

test("Phase 7: access restrictions depend on recorded status, not dates",()=>{
  const expired=parseSubscriptionHealth(data("ACTIVE","2026-10-15"));
  assert.equal(expired.operationalWritesBlocked,false);
  assert.equal(expired.platformReviewNeeded,true);
  assert.equal(subscriptionNextActions(expired).some(x=>x.key==="reconcile"),true);
  const blocked=parseSubscriptionHealth(data("SUSPENDED","2026-12-31"));
  assert.equal(blocked.operationalWritesBlocked,true);
  assert.equal(subscriptionNextActions(blocked)[0]?.key,"access");
  assert.ok(subscriptionNextActions(blocked).every(x=>x.href.startsWith("/admin/")));
});

test("Phase 7: thresholds are calendar checkpoints, not delivery receipts",()=>{
  const upcoming=subscriptionCheckpoints(parseSubscriptionHealth(data("TRIAL","2026-11-16")));
  assert.deepEqual(upcoming.map(x=>x.state),["future","future","future","future"]);
  const reached=subscriptionCheckpoints(parseSubscriptionHealth(data("ACTIVE","2026-10-23")));
  assert.deepEqual(reached.map(x=>x.state),["past","past","reached","future"]);
  const missing=subscriptionCheckpoints(parseSubscriptionHealth(data("ACTIVE",null)));
  assert.ok(missing.every(x=>x.state==="unknown"));
});

test("Phase 7: forged health records and invalid dates fail closed",()=>{
  const base=data("ACTIVE","2026-10-30");
  for(const changes of [
    {code:"ON_TRACK"}, {level:"healthy"}, {operationalWritesBlocked:true},
    {nextReminderDays:30}, {daysUntilExpiry:20}, {expiryDate:"2026-02-30"},
    {evaluatedOn:"2026-02-30"}, {platformReviewNeeded:true},
    {status:"OTHER"},{daysUntilGraceEnd:0},
    {expiryDate:"2026-10-01",daysUntilExpiry:14}
  ]) assert.throws(()=>parseSubscriptionHealth({ health:{...base.health,...changes} }));
  assert.throws(()=>parseSubscriptionHealth({health:null}));
  assert.throws(()=>parseSubscriptionHealth({}));
});

test("Phase 7: only known allowlisted health fields escape normalization",()=>{
  const health=data("ACTIVE","2026-10-25");
  const obj=parseSubscriptionHealth({
    health:{...health.health, passwordHash:"hidden", session:"hidden"},
    schoolId:"private"
  });
  assert.equal(JSON.stringify(obj).includes("hidden"),false);
  assert.equal(JSON.stringify(obj).includes("private"),false);
  assert.ok(subscriptionNextActions(obj).every(x=>!x.href.includes("/v1/platform")));
});
