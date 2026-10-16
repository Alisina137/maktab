import assert from "node:assert/strict";
import test from "node:test";
import { parseServiceHealthResponse, serviceFollowUps } from "./pilot-service-health-model.js";
const base = () => ({
  report: {
    evaluatedAt: "2026-10-16T08:00:00.000Z",
    timeZone: "Asia/Kabul",
    api: "responding",
    database: "query_succeeded",
    notificationQueue: { pending: 6, stalePending: 2, failed: 3, status: "attention" },
    support: { unresolved: 7, unresolvedCritical: 2, status: "attention" },
    imports: { failedLast7Days: 4, status: "attention" },
    unverified: ["scheduler", "push_delivery", "backups", "uptime_history"]
  },
  subscription: {
    status: "ACTIVE", level: "healthy", code: "ON_TRACK", daysUntilExpiry: 40,
    platformReviewNeeded: false, operationalWritesBlocked: false
  }
});
test("Phase 5 action categories are ordered and bound to safe admin pages", () => {
  const actions = serviceFollowUps(parseServiceHealthResponse(base()));
  assert.deepEqual(actions.map(x=>x.key),[
    "critical-support","failed-notifications","stale-notifications",
    "failed-imports","independent-verification"]);
  assert.deepEqual(actions.map(x=>x.level),
    ["critical","warning","warning","warning","unverified"]);
  assert.ok(actions.every(x=>x.href.startsWith("/admin/pilot/")));
});
test("Phase 5 healthy queue records do not verify push delivery or uptime", () => {
  const input=base();
  input.report.notificationQueue={pending:2,stalePending:0,failed:0,status:"no_backlog"};
  input.report.support={unresolved:3,unresolvedCritical:0,status:"no_critical_tickets"};
  input.report.imports={failedLast7Days:0,status:"no_recent_failures"};
  const actions=serviceFollowUps(parseServiceHealthResponse(input));
  assert.deepEqual(actions.map(x=>x.key),["independent-verification"]);
});
test("Phase 5 recognizes subscription restrictions and platform-review requests", () => {
  const input=base();
  input.subscription={
    status:"SUSPENDED",level:"critical",code:"SUSPENDED",daysUntilExpiry:-3,
    operationalWritesBlocked:true,platformReviewNeeded:true
  };
  const actions=serviceFollowUps(parseServiceHealthResponse(input));
  assert.ok(actions.some(x=>x.key==="subscription-blocked"&&x.level==="critical"));
  assert.ok(actions.some(x=>x.key==="subscription-review"&&x.level==="warning"));
});
test("Phase 5 malformed service counts and status contradictions are rejected", () => {
  const src=base();
  for (const report of [
    { ...src.report, notificationQueue:{pending:0,stalePending:2,failed:3,status:"attention"} },
    { ...src.report, notificationQueue:{pending:6,stalePending:0,failed:0,status:"attention"} },
    { ...src.report, support:{unresolved:1,unresolvedCritical:2,status:"attention"} },
    { ...src.report, imports:{failedLast7Days:4,status:"no_recent_failures"} },
    { ...src.report, unverified:["scheduler","push_delivery","backups"] },
    { ...src.report, timeZone:"UTC" },
    { ...src.report, evaluatedAt:"invalid" }
  ]) assert.throws(()=>parseServiceHealthResponse({ ...src, report }));
  assert.throws(()=>parseServiceHealthResponse({ ...src, subscription:{
    ...src.subscription, operationalWritesBlocked:true
  }}));
});
test("Phase 5 payload normalization omits unexpected fields",()=>{
  const source={...base(), internalKey:"private-context"};
  const result=parseServiceHealthResponse(source);
  assert.equal(JSON.stringify(result).includes("private-context"),false);
  assert.equal(JSON.stringify(result).includes("productionDecision"),false);
});
