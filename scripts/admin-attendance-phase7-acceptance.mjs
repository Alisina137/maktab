#!/usr/bin/env node
/** Repeatable, exact-build evidence for administrator attendance manual sign-off.
 * Automatic build/tests are required separately. This never asserts device
 * acceptance, live data migration or production release approval. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
const args=process.argv.slice(2);
const outputIndex=args.indexOf("--output");
if(outputIndex!==-1 && !args[outputIndex+1]){
  process.stderr.write("Provide an output path after --output.\n");
  process.exitCode=2;
} else {
  const manual=[
    ["ADMIN","Sign in as a real school administrator; verify all six Attendance tabs, focus, keyboard navigation, filters, refresh and errors in desktop/tablet/mobile browsers."],
    ["PARENT","Log in as a parent; verify published child attendance, alerts after corrections and that all admin Attendance routes are forbidden."],
    ["TEACHER","Submit, retry and correct eligible Negaran day marks; inspect read-only historical sheets and admin-only access controls."],
    ["CROSS_SCHOOL","Validate another school cannot read student marks, student history, correction reasons, contact logs or exports."],
    ["REGRESSION","Switch academic year and login mid-fetch; retry under simulated offline/slow responses and verify old school data never reappears."],
    ["RTL","Inspect English, Dari and Pashto across all six tabs with keyboard and screen reader on actual devices."],
    ["MOBILE","Review tap sizes, horizontal overflow, calendar popover, long names, paginated lists and date selection on Android/iOS."],
    ["EXPORT","Download CSV for days, classes and students; verify Excel formula protection, non-leakage of notes, correct row totals and BOM."],
    ["MIGRATION","Back up and apply migrations through 0027 to a staging copy, validate existing marks/notifications remain correct, and practice restore."],
    ["PERFORMANCE","Load real school-size data and verify the legacy register report is usable; large volumes still need manual validation."],
    ["DATE","Check Kabul school-local midnight and device time-zone mismatch with Today controls, closures, and date boundaries."],
    ["RELEASE","Review complete CI run SHA, user acceptance sign-off, recovery strategy and deployment/rollback checklist."]
  ];
  const report={
    schemaVersion:1,
    product:"MaktabLink",
    scope:"Admin > Attendance > Phase 7",
    repository:"Alisina137/maktab",
    commit:process.env.GITHUB_SHA??null,
    githubRunId:process.env.GITHUB_RUN_ID??null,
    generatedAt:new Date().toISOString(),
    automated:"Execute pnpm verify:admin-attendance:phase7 and full Linux/Windows CI; do not interpret this artifact as their result.",
    manualChecks:manual.map(([id,instruction])=>({id,instruction,result:"NOT_VERIFIED",evidence:null,verifiedBy:null})),
    decision:"NO_GO",
    reason:"Independent human-device, staging migration, timezone and release acceptance are not verified."
  };
  const text=JSON.stringify(report,null,2)+"\n";
  if(outputIndex>=0){
    const dest=resolve(args[outputIndex+1]);
    mkdirSync(dirname(dest),{recursive:true});
    writeFileSync(dest,text,"utf8");
    process.stdout.write("Attendance Phase7 NO_GO evidence saved: "+dest+"\n");
  } else {
    process.stdout.write(text);
  }
}
