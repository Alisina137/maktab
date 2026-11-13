#!/usr/bin/env node
/**
 * Final project-wide release matrix for MaktabLink.
 * CI builds a source + test-coverage inventory for the EXACT Git commit,
 * but neither a green unit test nor a completed manifest constitutes
 * real Android, database, push or operator release acceptance.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { evaluateReleaseManifest } from "./phase7-release-report.mjs";

export const PHASE10_AUTOMATED_CHECKS = Object.freeze([
  { phase: 1, check: "verify:foundation", capability: "Monorepo, dependency and CI integrity" },
  { phase: 2, check: "verify:security:phase2", capability: "Authentication, sessions, authorization and 2FA" },
  { phase: 3, check: "verify:db:phase3", capability: "Full migration journal and tenant/year constraints" },
  { phase: 4, check: "verify:admin:phase4", capability: "Admin responsiveness, keyboard/focus navigation and loading" },
  { phase: 5, check: "verify:academic:phase5", capability: "Academic, attendance, homework and grading workflows" },
  { phase: 6, check: "verify:accounts:phase6", capability: "Family enrollment, account lifecycle and roles" },
  { phase: 7, check: "verify:communication:phase7", capability: "Fee ledger, payment reconciliation and push queue" },
  { phase: 8, check: "verify:localization:phase8", capability: "Dari/Pashto/English RTL, accessibility and offline isolation" },
  { phase: 9, check: "verify:api:phase9", capability: "API reliability, private metrics and deployment safety" },
  { phase: 10, check: "verify:release:phase10", capability: "Cross-role acceptance inventory and safe staging restore" }
]);

export const PHASE10_LIVE_JOURNEYS = Object.freeze([
  ["platform_setup", "Platform operator", "Provision two isolated schools and initial administrators; audit tenant boundaries."],
  ["admin_dashboard", "School administrator", "Open every dashboard section on desktop/mobile; test errors, loading, keyboard focus, permissions and responsive menus."],
  ["academic_setup", "School administrator", "Create year, grades, classes, teachers, assignments and timetable; check concurrent edit conflicts."],
  ["family_accounts", "School administrator", "Create/import parent, student and staff accounts; test parent linking, suspension, withdrawal, transfer and credential rotation."],
  ["staff_portal", "School staff", "Exercise registration/front desk, attendance corrections, fees and approval boundaries with denied permissions."],
  ["teacher_attendance", "Teacher / Negaran", "Complete Today, timetable, daily register and same-day correction; verify another class and school are denied."],
  ["teacher_homework", "Teacher / Parent / Student", "Publish, schedule, submit, review and archive homework; verify draft privacy and timed publication."],
  ["exam_results", "Admin / Teacher / Parent / Student", "Schedule exam, save marks, publish/correct results, verify roster, privacy and audit trail."],
  ["parent_multiple_children", "Parent", "Switch siblings; inspect attendance, results, homework, alerts and each child's fees on Android."],
  ["student_role", "Student", "View assigned class timetable, homework, notifications and published results; reject unauthorized records."],
  ["announcements_push", "Admin / Teacher / Parent / Student", "Target announcements, verify live push delivery on physical Android, read receipts and deep links."],
  ["fees_reconciliation", "Admin / Staff / Parent", "Create invoice, partial payment, reverse/reconcile AFN receipt, test duplicate retries and bank statement totals."],
  ["account_session_recovery", "All roles", "Change passwords, log out mid-request, suspend/archive users, retry stale/expired sessions and verify no data leakage."],
  ["two_school_isolation", "All roles", "Use two independent schools and school-specific user credentials; prove all API, exports and offline caches are isolated."],
  ["three_languages", "All roles", "Verify Dari/Pashto RTL and English LTR, calendar, digits, 200% text, browser zoom and TalkBack."],
  ["offline_device", "Parent / Student / Teacher", "Test airplane mode, read-only cache, reconnect, backend outage and account switching on actual phones."],
  ["neon_migrations", "Deployment operator", "Run Phase 3 and 6 preflights, ordered migrations and two-connection transaction tests in isolated Neon staging."],
  ["backup_restore", "Deployment operator", "Authenticate encrypted backup and demonstrate disposable staging restore with checksum/data validation."],
  ["production_operations", "Deployment operator", "Monitor readiness/private metrics, trigger communication/subscription jobs, test push retries, alerts and rolling restart."],
  ["operator_signoff", "Independent release owner", "Record exact build SHA, tested device/browser, known defects, rollback evidence and explicit sign-off."]
].map(([id, actor, procedure]) => Object.freeze({ id, actor, procedure })));

function validSha(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

export function buildFinalAuditReport({
  sha, isClean = true, scripts, ciWorkflow = "",
  manifest = null, now = new Date(),
  githubRunId = null
}) {
  if (!validSha(sha)) throw new Error("Final audit requires an exact 40-character lowercase Git SHA.");
  if (!scripts || typeof scripts !== "object") throw new Error("Package scripts are required.");
  const declared = PHASE10_AUTOMATED_CHECKS.map(({ phase, check, capability }) => ({
    phase, check, capability,
    status: typeof scripts[check] === "string" && scripts[check].trim()
      ? "CONFIGURED_NOT_EXECUTED_BY_REPORT" : "MISSING"
  }));
  const missing = declared.filter((entry) => entry.status === "MISSING");
  const root = scripts.verify ?? "";
  const rootMissing = declared.filter((entry) => !root.includes("pnpm " + entry.check));
  const ciMissing = declared.filter((entry) => !ciWorkflow.includes("pnpm " + entry.check));
  const gitClean = Boolean(isClean);
  const evidence = evaluateReleaseManifest(manifest, sha, gitClean, now);
  const blockers = [
    ...missing.map((row) => "Missing phase verification command: " + row.check),
    ...rootMissing.map((row) => "Root pnpm verify must include " + row.check),
    ...ciMissing.map((row) => "Linux/Windows CI must execute " + row.check),
    ...evidence.blockers
  ];

  return {
    reportVersion: 1,
    product: "MaktabLink",
    checkedOutSha: sha,
    generatedAt: now.toISOString(),
    ciRunId: typeof githubRunId === "string" && /^\d{1,20}$/.test(githubRunId)
      ? githubRunId : null,
    gitWorktreeClean: gitClean,
    productionDecision: "NO_GO",
    evidenceState: blockers.length ? "INCOMPLETE" : "READY_FOR_INDEPENDENT_RELEASE_REVIEW",
    automatedCoverage: {
      state: missing.length || rootMissing.length || ciMissing.length
        ? "INCOMPLETE" : "CONFIGURED_NOT_PROVEN_BY_REPORT",
      note: "This inventory checks source/CI configuration, not GitHub job outcomes or real devices. Verify CI on this exact SHA separately.",
      phases: declared
    },
    externalEvidence: {
      state: evidence.evidenceState,
      checks: evidence.checks,
      note: "Operator-supplied references are not independently authenticated."
    },
    liveJourneys: PHASE10_LIVE_JOURNEYS.map(({ id, actor, procedure }) => ({
      id, actor, procedure, status: "UNVERIFIED",
      note: "An in-process API regression is not evidence of a deployed browser, phone or real PostgreSQL environment."
    })),
    blockers: [...new Set(blockers)],
    nextAction: blockers.length
      ? "Record independent staging, real-device, migration, backup/restore and exact-build evidence; keep production disabled."
      : "Submit the evidence for independent manual review. An operator must issue a separate production authorization; this script never issues GO."
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--strict") { options.strict = true; continue; }
    if (key !== "--output" && key !== "--manifest") {
      throw new Error("Unknown option. Use --output <new-report.json>, --manifest <local-evidence.json> or --strict.");
    }
    if (!args[index + 1] || args[index + 1].startsWith("--")) {
      throw new Error("Missing value after " + key);
    }
    options[key.slice(2)] = args[++index];
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const isClean = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "";
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const manifest = options.manifest
    ? JSON.parse(readFileSync(resolve(options.manifest), "utf8")) : null;

  const report = buildFinalAuditReport({
    sha, isClean, scripts: packageJson.scripts, ciWorkflow,
    manifest, githubRunId: process.env.GITHUB_RUN_ID
  });
  const json = JSON.stringify(report, null, 2) + "\n";
  if (options.output) {
    // Do not overwrite any previous acceptance evidence, even in a rerun.
    const destination = resolve(options.output);
    writeFileSync(destination, json, { flag: "wx", mode: 0o600 });
    console.log("Final audit Phase 10 NO_GO report: " + destination);
  } else {
    process.stdout.write(json);
  }
  if (report.automatedCoverage.state === "INCOMPLETE" ||
      (options.strict && report.evidenceState === "INCOMPLETE")) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && basename(process.argv[1]) === "final-audit-phase10.mjs") {
  try { main(); } catch (error) {
    console.error("Final audit failed to produce a valid release report.");
    process.exitCode = 2;
  }
}
