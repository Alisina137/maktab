import assert from "node:assert/strict";
import test from "node:test";
import { validateOperationalSummary } from "./pilot-operational-readiness-model.js";
const definitions = [
  ["teacher_overlap","critical"],["class_overlap","critical"],
  ["assignment_gap","warning"],["invalid_period","warning"]
] as const;
const make = (missing = "", total = 3) => ({
  scope: "active_year_timetable", evaluatedPeriods: total,
  ready: total > 0 && !missing,
  critical: ["teacher_overlap","class_overlap"].includes(missing) ? 1 : 0,
  warnings: ["assignment_gap","invalid_period"].includes(missing) ? 1 : 0,
  metrics: definitions.map(([key,severity]) => {
    const affected = Number(missing === key);
    return {key,severity,total,complete:total-affected,missing:affected,
      percentage:total?Math.round((total-affected)/total*100):null,
      status:total===0?"not_applicable":affected?severity:"complete"};
  })
});
test("Phase 2 timetable validation: valid current year checks retain actual conflict severity",()=>{
  const result=validateOperationalSummary(make("teacher_overlap"));
  assert.equal(result.ready,false);
  assert.equal(result.critical,1);
  assert.equal(result.metrics[0]?.missing,1);
});
test("Phase 2 timetable validation: no periods must not display passed status",()=>{
  const result=validateOperationalSummary(make("",0));
  assert.equal(result.ready,false);
  assert.equal(result.metrics.every(m=>m.status==="not_applicable"),true);
  assert.throws(()=>validateOperationalSummary({...make("",0),ready:true}));
});
test("Phase 2 timetable validation: missing, duplicated and malformed metrics fail closed",()=>{
  assert.throws(()=>validateOperationalSummary({}));
  assert.throws(()=>validateOperationalSummary({...make(),scope:"all_schools"}));
  assert.throws(()=>validateOperationalSummary({...make(),metrics:make().metrics.slice(1)}));
  const duplicated={...make(),metrics:[make().metrics[0],make().metrics[0],
    ...make().metrics.slice(2)]};
  assert.throws(()=>validateOperationalSummary(duplicated));
  assert.throws(()=>validateOperationalSummary({...make(),critical:9}));
  assert.throws(()=>validateOperationalSummary({...make(),metrics:make().metrics.map(m=>({...m,missing:20}))}));
});
test("Phase 2 timetable validation: only complete and consistent active-year summary is passed",()=>{
  assert.equal(validateOperationalSummary(make()).ready,true);
  assert.throws(()=>validateOperationalSummary({...make(),ready:false}));
});
