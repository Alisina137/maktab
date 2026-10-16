import assert from "node:assert/strict";
import test from "node:test";
import { readinessPriorities } from "./pilot-readiness-priority-model.js";

const coreKeys = ["school-active","subscription","admin","academic-year",
  "classes","subjects","teachers","assignments","families"];
const metricKeys = [
  ["teaching","critical"],["timetable","warning"],["class_students","warning"],
  ["negaran","warning"],["family_links","critical"],["student_logins","warning"],
  ["teacher_logins","warning"]
] as const;
const core = (missing = "") => ({
  ready: !missing,
  checks: coreKeys.map(key => ({ key, passed: key !== missing }))
});
const coverage = (missing = "", total = 5, coreReady = true) => ({
  ready: coreReady && total > 0 && !["teaching","family_links"].includes(missing),
  coreReady,
  metrics: metricKeys.map(([key,severity]) => {
    const affected = Number(key === missing);
    return { key, severity, total, complete: total - affected,
      missing: affected, percentage: total ? Math.round((total - affected) / total * 100) : null,
      status: total === 0 ? "not_applicable" : affected ? severity : "complete" };
  })
});

test("Phase 2 priority worklist: blockers precede advisory warnings", () => {
  const items = readinessPriorities(core("assignments"), coverage("student_logins",5,false));
  assert.deepEqual(items.map(item => item.key), ["core-assignments","coverage-student_logins"]);
  assert.deepEqual(items.map(item => item.level), ["blocker","warning"]);
  assert.ok(items.every(item => item.href.startsWith("/admin/")));
  assert.equal(items[1]?.affected,1);
});
test("Phase 2 priority worklist: missing eligible classes and families are blocking", () => {
  const items = readinessPriorities(core(), coverage("",0));
  assert.deepEqual(items.map(item=>item.key),["coverage-teaching","coverage-family_links"]);
  assert.ok(items.every(item=>item.level==="blocker"));
});
test("Phase 2 priority worklist: partial API failure is unknown, never healthy", () => {
  const items = readinessPriorities(core("families"), null);
  assert.deepEqual(items.map(item=>item.level),["blocker","unverified"]);
  assert.deepEqual(readinessPriorities(null,null).map(item=>item.level),
    ["unverified","unverified"]);
});
test("Phase 2 priority worklist: malformed and contradictory payloads fail closed", () => {
  assert.equal(readinessPriorities({...core(),ready:false},coverage())[0]?.key,"core-unavailable");
  const duplicated = {...core(),checks:[core().checks[0],...core().checks.slice(0,-1)]};
  assert.equal(readinessPriorities(duplicated,coverage())[0]?.key,"core-unavailable");
  const incomplete = {...coverage(),metrics:coverage().metrics.slice(1)};
  assert.ok(readinessPriorities(core(),incomplete).some(item=>item.key==="coverage-unavailable"));
  const invalid = {...coverage(),metrics:coverage().metrics.map(m=>({...m,missing:999}))};
  assert.ok(readinessPriorities(core(),invalid).some(item=>item.key==="coverage-unavailable"));
});
test("Phase 2 priority worklist: complete records do not authorize production", () => {
  assert.deepEqual(readinessPriorities(core(),coverage()),[]);
});
