import assert from "node:assert/strict";
import test from "node:test";
import { adoptionSummary, parseAdoptionReport } from "./pilot-adoption-model.js";

const role = (name: string, eligible: number, signedIn: number, activated: number) => ({
  role: name, eligible, signedIn, activated,
  signedInPercent: eligible ? Math.round(signedIn / eligible * 100) : null,
  activatedPercent: eligible ? Math.round(activated / eligible * 100) : null
});
const data = (r = [
  role("TEACHER",10,5,8), role("PARENT",20,10,18), role("STUDENT",30,12,27)
], other: Record<string,unknown> = {}) => ({
  window: "7d", startAt: "2026-10-10T00:00:00.000Z",
  endAt: "2026-10-16T08:00:00.000Z", timeZone: "Asia/Kabul",
  roles: r,
  activities: { homeworkPublished: 4, homeworkSubmissions: 5,
    attendanceClassDays: 6, attendanceStudentMarks: 20, announcementsPublished: 2 },
  ...other
});
test("Improvement Phase 4: validates complete role and real activity aggregates", () => {
  const validated = parseAdoptionReport(data(), "7d");
  const summary = adoptionSummary(validated);
  assert.deepEqual([summary.eligible, summary.signedIn, summary.activated],[60,27,53]);
  assert.equal(summary.signedInPercent,45);
  assert.equal(summary.activatedPercent,88);
  assert.equal(summary.followUps.length,6);
  assert.equal(summary.followUps.find(f=>f.key==="TEACHER-activation")?.count,2);
  assert.equal(summary.followUps.find(f=>f.key==="STUDENT-latest-login")?.count,18);
  assert.ok(summary.followUps.every(f=>f.href.startsWith("/admin/")));
});
test("Improvement Phase 4: empty cohorts remain unknown, never 0 or 100 percent", () => {
  const empty = data([
    role("TEACHER",0,0,0),role("PARENT",0,0,0),role("STUDENT",0,0,0)]);
  const validated = parseAdoptionReport(empty,"7d");
  const summary = adoptionSummary(validated);
  assert.equal(summary.signedInPercent,null);
  assert.equal(summary.activatedPercent,null);
  assert.deepEqual(summary.followUps.map(f=>f.kind),["empty","empty","empty"]);
});
test("Improvement Phase 4: wrong window, timezone, role denominator and percentages fail closed", () => {
  for (const wrong of [
    data(undefined,{window:"today"}),
    data(undefined,{timeZone:"UTC"}),
    data(undefined,{startAt:"tomorrow"}),
    data(undefined,{startAt:"2026-10-17T00:00:00.000Z"}),
    data([role("TEACHER",10,5,8),role("PARENT",20,10,18)]),
    data([role("TEACHER",10,5,8),role("TEACHER",10,5,8),role("STUDENT",30,12,27)]),
    data([role("ADMIN",10,5,8),role("PARENT",20,10,18),role("STUDENT",30,12,27)]),
    data([role("TEACHER",10,11,8),role("PARENT",20,10,18),role("STUDENT",30,12,27)]),
    data([role("TEACHER",10,5,11),role("PARENT",20,10,18),role("STUDENT",30,12,27)]),
    data([role("TEACHER",10,5,8),role("PARENT",20,10,18),{...role("STUDENT",30,12,27), signedInPercent:99}]),
    data(undefined,{activities:{homeworkPublished: -1}})
  ]) assert.throws(()=>parseAdoptionReport(wrong,"7d"));
});
test("Improvement Phase 4: valid empty educational activity never proves usage success",()=>{
  const input=data(undefined,{activities:{
    homeworkPublished:0,homeworkSubmissions:0,attendanceClassDays:0,
    attendanceStudentMarks:0,announcementsPublished:0
  }});
  const result=adoptionSummary(parseAdoptionReport(input,"7d"));
  assert.ok(result.followUps.length>0);
  assert.equal("productionDecision" in result,false);
});
test("Improvement Phase 4: normalized model excludes unexpected private server payloads",()=>{
  const input=data(undefined,{studentNames:["secret"],schoolId:"secret",token:"private"});
  const result=parseAdoptionReport(input,"7d");
  assert.equal(JSON.stringify(result).includes("secret"),false);
});
