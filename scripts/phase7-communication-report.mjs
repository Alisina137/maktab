#!/usr/bin/env node
// Deliberately conservative communication/fees readiness artifact.
// This report inventories unverified manual gates; it never grants production approval.
import { existsSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

export const PHASE7_COMMUNICATION_GATES = Object.freeze([
  "exact_sha_linux_windows_ci",
  "real_postgres_migrations",
  "encrypted_backup_restore",
  "cross_school_admin_scope",
  "cross_role_denials",
  "multi_connection_payment_races",
  "invoice_preview_dedup",
  "civil_timezone_dst",
  "announcement_publish_archive_races",
  "overlapping_cron_lease_recovery",
  "actual_android_expo_push",
  "rtl_keyboard_talkback_zoom",
  "financial_csv_accounting",
  "offline_suspension_withdrawal",
  "operator_release_signoff"
]);

export function communicationPhase7Report(sha = null) {
  return {
    kind: "maktablink.admin-communication-fees.phase7.manual-acceptance",
    revision: 1,
    testedCommit: sha,
    generatedAt: new Date().toISOString(),
    productionDecision: "NO_GO",
    automatedBuildIsNotDeviceProof: true,
    manualGates: PHASE7_COMMUNICATION_GATES.map((name, index) => ({
      id: `C7-${String(index + 1).padStart(2, "0")}`, name, status: "NOT_RUN"
    })),
    nextStep: "Run the manual matrix, then independently review the Step 20 operator manifest outside this script.",
    matrix: "docs/ADMIN-COMMUNICATION-FEES-PHASE7-ACCEPTANCE.md"
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex === -1 ? null : process.argv[outputIndex + 1];
  if (outputIndex !== -1 && (!output || output.startsWith("--"))) {
    throw new Error("--output requires a new report filename.");
  }
  let sha = process.env.GITHUB_SHA ?? null;
  if (!sha) {
    try { sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
    catch { sha = null; }
  }
  const report = communicationPhase7Report(sha);
  if (output) {
    if (existsSync(output)) throw new Error("Refusing to overwrite an existing release report.");
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  }
  process.stdout.write(JSON.stringify({
    testedCommit: report.testedCommit, productionDecision: report.productionDecision,
    unverifiedManualGates: report.manualGates.length, reportFile: output
  }) + "\n");
}
