import assert from "node:assert/strict";
import test from "node:test";
import { parseOversightPage, parseOversightRelease,
  summarizeOversightPage, oversightReviewActions } from "./pilot-oversight-triage-model.js";

const id = (value: number) => "10000000-0000-4000-8000-" + value.toString().padStart(12,"0");
const event = (value: number, kind: string, action: string) => ({
  id: id(value), kind, action, occurredAt: "2026-10-16T08:00:00.000Z",
  actorId: "private-actor", note: "private-note", reference: "private-reference"
});
const report = (events: unknown[], changes: Record<string, unknown> = {}) => ({
  events, window:"30d", kind:"ALL", limit:15, offset:0, hasMore:false,
  startAt:"2026-09-17T00:00:00.000Z",
  endAt:"2026-10-16T09:00:00.000Z", timeZone:"Asia/Kabul", ...changes
});
const requested = {window:"30d" as const,kind:"ALL" as const,limit:15,offset:0};
const gates = [
  "exact_commit_ci", "real_postgres_migrations", "encrypted_backup_restore",
  "web_android_role_journeys", "cross_school_security", "rtl_accessibility",
  "offline_reconnection", "live_push_scheduler", "concurrent_payments",
  "rollback_incident_runbook", "operator_signoff"
];
const release = (changes: Record<string,unknown> = {}) => ({
  productionDecision:"NO_GO", policy:"MANUAL_RELEASE_ACCEPTANCE_REQUIRED",
  setupReady:true, recordedPilotApproval:true, effectivePilotApproval:true,
  evidenceVerified:5, evidenceRequired:5, openCriticalTickets:0,
  missingExternalGates:gates, summary:"not production ready", ...changes
});

test("Phase 6 timeline: page-only counts distinguish noteworthy history from current state", () => {
  const input=report([
    event(1,"SUPPORT","SUPPORT_OPENED"),
    event(2,"SUPPORT","SUPPORT_RESOLVED"),
    event(3,"IMPORT","IMPORT_FAILED"),
    event(4,"EXPORT","AUDIT_EXPORTED"),
    event(5,"EVIDENCE","EVIDENCE_REVIEWED"),
    event(6,"DECISION","PILOT_NOT_APPROVED")
  ]);
  const clean=parseOversightPage(input,requested);
  assert.deepEqual(summarizeOversightPage(clean),{
    events:6,needsReview:3,support:2,imports:1,evidenceAndDecisions:2,
    exports:1,start:1,end:6
  });
  assert.equal(oversightReviewActions.has("SUPPORT_RESOLVED"),false);
  assert.equal(JSON.stringify(clean).includes("private-actor"),false);
  assert.equal(JSON.stringify(clean).includes("private-note"),false);
  assert.equal(JSON.stringify(clean).includes("private-reference"),false);
});

test("Phase 6 timeline: nonzero offsets and true paging remain bounded to loaded page", () => {
  const rows=Array.from({length:15},(_,i)=>event(i+30,"SUPPORT","SUPPORT_REPLIED"));
  const result=parseOversightPage(report(rows,{offset:30,hasMore:true}),{
    ...requested,offset:30
  });
  const counts=summarizeOversightPage(result);
  assert.deepEqual([counts.events,counts.start,counts.end],[15,31,45]);
  assert.equal(result.hasMore,true);
  const empty=parseOversightPage(report([]),requested);
  assert.deepEqual([summarizeOversightPage(empty).start,summarizeOversightPage(empty).end],[0,0]);
});

test("Phase 6 timeline: forged, unrelated, malformed or duplicate records fail closed", () => {
  const valid=event(1,"IMPORT","IMPORT_FAILED");
  for(const bad of [
    null, {}, report([valid],{kind:"EXPORT"}),report([valid],{window:"7d"}),
    report([valid],{offset:10}),report([valid],{limit:50}),
    report([valid],{hasMore:true}),report([valid],{timeZone:"UTC"}),
    report([{...valid,kind:"SUPPORT"}]),
    report([{...valid,action:"RAW_AUDIT_EVENT"}]),
    report([{...valid,id:"untrusted"}]),
    report([{...valid,occurredAt:"2026-08-01T08:00:00Z"}]),
    report([valid,valid]),
    report([valid],{startAt:"2026-10-17T00:00:00Z"}),
    report([valid],{endAt:"bad"})
  ]) assert.throws(()=>parseOversightPage(bad,requested));
  assert.throws(()=>parseOversightPage(report([valid]),{...requested,kind:"SUPPORT"}));
});

test("Phase 6 release: recorded pilot approval never becomes production GO", () => {
  const parsed=parseOversightRelease(release());
  assert.equal(parsed.productionDecision,"NO_GO");
  assert.equal(parsed.effectivePilotApproval,true);
  assert.equal(parsed.missingExternalGates.length,11);
  assert.equal("summary" in parsed,false);
});
test("Phase 6 release: missing external gates or contradictory sign-offs fail closed", () => {
  for (const bad of [
    release({productionDecision:"GO"}),
    release({policy:"AUTO_APPROVED"}),
    release({missingExternalGates:[]}),
    release({missingExternalGates:[...gates.slice(0,10),gates[0]]}),
    release({missingExternalGates:[...gates.slice(0,10),"external_fake"]}),
    release({evidenceVerified:6}),
    release({openCriticalTickets:1}),
    release({recordedPilotApproval:false}),
    release({evidenceRequired:-1})
  ]) assert.throws(()=>parseOversightRelease(bad));
});
