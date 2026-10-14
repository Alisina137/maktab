#!/usr/bin/env node
/**
 * Parent Phase 7 operator evidence ledger. Running this locally or in CI does
 * NOT test an Android device. Even a complete manifest is only READY_FOR_REVIEW:
 * Step 20's independent production review remains authoritative.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

export const PARENT_GATES = Object.freeze({
  login_and_session: "Fresh parent login, forced password change, logout, old token revocation",
  linked_children: "One/zero/multiple students, persist selection, rapid switch between children",
  cross_account_school: "Cross-school and cross-parent access denied for every child resource",
  home: "Home published-only actionable overview, linked child selection and refresh",
  academics: "Published homework/results, timetable, correct filters and deep-linked details",
  attendance: "Recorded-only status, Saturday calendar, Solar Hijri month and statistics",
  inbox: "Announcements audience, notification read/unread, paging and exact link behavior",
  fees: "Issued versus draft/cancelled, partial/reversal payment ledger, child isolation",
  profile_school: "Authorized parent profile, school location and verified administrator contact",
  password_rotation: "Incorrect/valid password change, safe session rotation, re-login",
  offline_recovery: "Airplane mode, stale callbacks, per-resource retry, unstable tunnel recovery",
  multilingual_rtl: "English/Dari/Pashto, RTL/LTR, date/time/number formats",
  accessibility: "Small phone and tablet, Android TalkBack, 200% font, tap sizes, focused tabs",
  push_cold_start: "Cold-start/foreground pushes with revoked or missing targets",
  test_ci: "Successful Linux and Windows verification on the exact candidate SHA",
  operator_signoff: "Independent device/operator evidence review and risk acceptance"
});
const isoUtc=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const shaPattern=/^[a-f0-9]{40}$/i;
const forbidden=/(?:password|token|secret|api[_-]?key|authorization|session)[=:]/i;

export function evaluateParentAcceptance(manifest, currentSha, now = new Date()) {
  const blockers=[];
  const validManifest=manifest && typeof manifest==="object" && !Array.isArray(manifest);
  if (!shaPattern.test(currentSha)) blockers.push("Candidate Git SHA is invalid or unavailable.");
  if (!validManifest) blockers.push("A real-device operator manifest is not provided.");
  if (validManifest && manifest.commitSha !== currentSha) {
    blockers.push("Evidence was collected for a different code commit.");
  }
  if (validManifest && (typeof manifest.operator !== "string" ||
    manifest.operator.trim().length < 3)) {
    blockers.push("An independent operator is required.");
  }
  if (validManifest && (typeof manifest.device !== "string" ||
    manifest.device.trim().length < 5)) {
    blockers.push("An identifiable Android device/build is required.");
  }
  if (validManifest && (typeof manifest.environment !== "string" ||
    !["STAGING", "PRODUCTION"].includes(manifest.environment))) {
    blockers.push("Environment must be STAGING or PRODUCTION.");
  }
  const checks=Object.entries(PARENT_GATES).map(([id,label])=>{
    const raw=validManifest && manifest.checks && typeof manifest.checks==="object" ?
      manifest.checks[id] : undefined;
    const result=["PASS","FAIL","NOT_RUN"].includes(raw?.result)?raw.result:"NOT_RUN";
    const reference=typeof raw?.reference==="string"?raw.reference.trim():"";
    const observedAt=typeof raw?.observedAt==="string"?raw.observedAt:"";
    const observed=Date.parse(observedAt);
    const fresh=isoUtc.test(observedAt) && Number.isFinite(observed) &&
      observed <= now.getTime()+300000 && now.getTime()-observ <= 31*86400000;
    const safeRef=reference.length>=8 && reference.length<=500 &&
      !forbidden.test(reference) && !/[\r\n]/.test(reference);
    if(result!=="PASS")blockers.push(id+" has not passed on the actual target.");
    if(!fresh)blockers.push(id+" has no recent UTC observation.");
    if(!safeRef)blockers.push(id+" has no safe, non-sensitive evidence reference.");
    return {id,label,result,reference:safeRef?reference:null,observedAt:fresh?observedAt:null};
  });
  if (validManifest && manifest.checks && typeof manifest.checks==="object") {
    for(const id of Object.keys(manifest.checks)) {
      if(!(id in PARENT_GATES))blockers.push("Unknown parent acceptance check: "+id);
    }
  }
  const ready=blockers.length===0;
  return {
    version:1,generatedAt:now.toISOString(),commitSha:currentSha,
    device:typeof manifest?.device==="string"?manifest.device:null,
    environment:typeof manifest?.environment==="string"?manifest.environment:null,
    operator:typeof manifest?.operator==="string"?manifest.operator:null,
    status:ready?"READY_FOR_INDEPENDENT_REVIEW":"INCOMPLETE",
    productionDecision:"NO_GO",
    reason:ready
      ?"Parent device evidence is recorded but needs independent review and all Step 20 gates."
      :"Parent acceptance has missing or failed external device evidence; automated CI cannot substitute.",
    blockers,checks
  };
}
function cli(argv){
  const options={};
  for(let i=0;i<argv.length;i++){
    const x=argv[i];
    if(x==="--strict"){options.strict=true;continue;}
    if(x!=="--manifest"&&x!=="--output")throw Error("Unknown argument: "+x);
    if(!argv[i+1]||argv[i+1].startsWith("--"))throw Error("Missing value for "+x);
    options[x.slice(2)]=argv[++i];
  }
  return options;
}
function main(){
  const args=cli(process.argv.slice(2));
  const sha=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  const dirty=execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim();
  const manifest=args.manifest?JSON.parse(readFileSync(resolve(args.manifest),"utf8")):null;
  const report=evaluateParentAcceptance(manifest,sha);
  if(dirty) {
    report.status="INCOMPLETE";
    report.blockers.push("Dirty worktree; evidence must refer to a reproducible exact build.");
  }
  const output=JSON.stringify(report,null,2)+"\n";
  if(args.output) {
    writeFileSync(resolve(args.output),output,{flag:"wx",mode:0o600});
    console.log("Parent Phase 7 evidence written; decision: NO_GO.");
  } else process.stdout.write(output);
  if(args.strict && report.status!=="READY_FOR_INDEPENDENT_REVIEW")process.exitCode=2;
}
if(process.argv[1]&&basename(process.argv[1])==="parent-phase7-acceptance.mjs")main();
