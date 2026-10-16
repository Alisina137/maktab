import assert from "node:assert/strict";
import test from "node:test";
import { parsePilotReleaseResult, pilotReleaseSummary, REQUIRED_EXTERNAL_GATES } from "./pilot-release-readiness-model.js";
import { evaluateSchoolReleaseReadiness } from "../../../../packages/database/src/pilot-release-readiness.js";

const source = (opts: {setupReady:boolean;recordedPilotApproval:boolean;
  evidenceVerified:number;evidenceRequired:number;openCriticalTickets:number} = {
    setupReady:true,recordedPilotApproval:true,evidenceVerified:5,
    evidenceRequired:5,openCriticalTickets:0
}) => evaluateSchoolReleaseReadiness(opts);

test("Pilot improvements Phase 8: full Step 20 response normalizes to NO-GO", () => {
  const original = source();
  const result = parsePilotReleaseResult({...original, secretInternalField:"omit"});
  assert.equal(result.productionDecision,"NO_GO");
  assert.equal(result.effectivePilotApproval,true);
  assert.equal(result.checks.length,20);
  assert.equal(result.missingExternalGates.length,REQUIRED_EXTERNAL_GATES.length);
  assert.equal(JSON.stringify(result).includes("secretInternalField"),false);
  assert.deepEqual(pilotReleaseSummary(result),{
    checked:0,unverified:20,productionDecision:"NO_GO"
  });
});

test("Pilot improvements Phase 8: even incomplete school setup remains NO-GO", () => {
  for(const input of [
    {setupReady:false,recordedPilotApproval:true,evidenceVerified:5,evidenceRequired:5,openCriticalTickets:0},
    {setupReady:true,recordedPilotApproval:false,evidenceVerified:5,evidenceRequired:5,openCriticalTickets:0},
    {setupReady:true,recordedPilotApproval:true,evidenceVerified:4,evidenceRequired:5,openCriticalTickets:0},
    {setupReady:true,recordedPilotApproval:true,evidenceVerified:5,evidenceRequired:5,openCriticalTickets:1}
  ]) {
    const output = parsePilotReleaseResult(source(input));
    assert.equal(output.effectivePilotApproval,false);
    assert.equal(output.productionDecision,"NO_GO");
  }
});

test("Pilot improvements Phase 8: forged GO, missing gates and inconsistent approval fail closed", () => {
  const valid = source();
  for (const corrupt of [
    {...valid,productionDecision:"GO"},
    {...valid,policy:"AUTO_APPROVAL"},
    {...valid,recordedPilotApproval:false},
    {...valid,evidenceVerified:-1},
    {...valid,evidenceVerified:6},
    {...valid,openCriticalTickets:NaN},
    {...valid,missingExternalGates:[]},
    {...valid,missingExternalGates:valid.missingExternalGates.slice(0,10)},
    {...valid,missingExternalGates:[...valid.missingExternalGates.slice(0,10),"fake_gate"]},
    {...valid,checks:valid.checks.slice(0,19)},
    {...valid,checks:[...valid.checks.slice(0,19),{...valid.checks[19],status:"UNVERIFIED"}]},
    {...valid,checks:[valid.checks[1],valid.checks[0],...valid.checks.slice(2)]},
    {...valid,checks:[{...valid.checks[0],name:"" },...valid.checks.slice(1)]}
  ]) assert.throws(()=>parsePilotReleaseResult(corrupt));
  assert.throws(()=>parsePilotReleaseResult(null));
});

test("Pilot improvements Phase 8: no unknown identity, evidence or student data leaves the server payload", () => {
  const good=source();
  const payload={
    ...good,
    studentNames:["private student"],
    checks:good.checks.map((c,i)=>({...c, actorId:"secret actor "+i}))
  };
  const verified=parsePilotReleaseResult(payload);
  assert.equal(JSON.stringify(verified).includes("private student"),false);
  assert.equal(JSON.stringify(verified).includes("secret actor"),false);
  assert.deepEqual(verified.checks.map(c=>c.id),Array.from({length:20},(_,i)=>"20."+(i+1)));
});
