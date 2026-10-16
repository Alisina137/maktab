import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PHASE8_MANUAL_GATES = [
  "school_admin_role_permissions",
  "cross_school_privacy_and_sessions",
  "real_import_export_round_trip",
  "school_subscription_and_support",
  "real_notification_and_scheduled_jobs",
  "live_database_migration_and_restore",
  "real_android_parent_student_teacher_journeys",
  "english_dari_pashto_rtl_and_accessibility",
  "network_reconnect_and_retry",
  "exact_sha_operator_signoff"
];

const validSha = (sha) => typeof sha === "string" && /^[0-9a-f]{40}$/.test(sha);

/** Fail closed. Passing CI tests does not satisfy independent pilot or production acceptance. */
export function buildPilotPhase8Report({
  sha, githubSha = "", isGitHubActions = false, ciJobStatus = "unknown", now = new Date()
}) {
  if (!validSha(sha)) throw new Error("A real 40-character Git commit SHA is required.");
  const exactCommit = isGitHubActions && validSha(githubSha) && githubSha === sha;
  const automatedChecks = exactCommit && ciJobStatus === "success"
    ? "CI_REPORTED_PASS" : "NOT_VERIFIED";
  return {
    schemaVersion: 1,
    assessment: "MAKTABLINK_PILOT_OPERATIONS_PHASE8",
    generatedAt: now.toISOString(),
    commitSha: sha,
    source: isGitHubActions ? "github_actions" : "local",
    ci: {
      exactCommit,
      jobStatus: ["success","failure","cancelled"].includes(ciJobStatus) ? ciJobStatus : "unknown",
      automatedChecks
    },
    implementation: "PHASES_1_TO_7_COMMITTED",
    phase8Review: "REQUIRES_MANUAL_ACCEPTANCE",
    productionDecision: "NO_GO",
    reason: "Automated source checks and tests do not establish real-device operation, backup restore, deployed infrastructure, security sign-off or permission to release.",
    manualGates: PHASE8_MANUAL_GATES.map((id) => ({ id, status: "UNVERIFIED" }))
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 2 || (args.length !== 0 && (args[0] !== "--output" || !args[1]))) {
    throw new Error("Usage: node scripts/pilot-phase8-acceptance-report.mjs [--output path]");
  }
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const report = buildPilotPhase8Report({
    sha, githubSha: process.env.GITHUB_SHA ?? "",
    isGitHubActions: process.env.GITHUB_ACTIONS === "true",
    ciJobStatus: process.env.PILOT_PHASE8_CI_JOB_STATUS ?? "unknown"
  });
  const json = JSON.stringify(report, null, 2) + "\n";
  if (args[0] === "--output") {
    const path = resolve(args[1]);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, json, { encoding: "utf8", flag: "w" });
    console.log("Phase 8 evidence report saved; production remains NO_GO.");
  } else process.stdout.write(json);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
