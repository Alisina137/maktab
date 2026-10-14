#!/usr/bin/env node
// Offline operator evidence ledger validator. This is not a live test runner,
// GitHub Actions verifier, or automatic release-approval mechanism.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const GATES = Object.freeze({
  exact_commit_ci: "Successful Linux and Windows jobs for the actual deployment commit",
  real_postgres_migrations: "Live PostgreSQL connectivity and full ordered migration chain",
  encrypted_backup_restore: "Encrypted off-host backup and non-production restore rehearsal",
  web_android_role_journeys: "Admin/Teacher/Parent/Student browser and Android journeys",
  cross_school_security: "Production-like cross-role isolation, session revocation and permissions",
  rtl_accessibility: "Dari/Pashto/English RTL, zoom, TalkBack and real device accessibility",
  offline_reconnection: "Airplane-mode, expired token, ngrok and network fault recovery",
  live_push_scheduler: "Actual push, communication/subscription jobs and monitoring alerts",
  concurrent_payments: "Two-connection PostgreSQL payment and reminder retry checks",
  rollback_incident_runbook: "Deployment rollback, incident ownership and recovery exercise",
  operator_signoff: "Named independent operator final acceptance and risk review"
});

function parseArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--strict") { values.strict = true; continue; }
    if (arg !== "--manifest" && arg !== "--output") {
      throw new Error("Unknown argument. Use --manifest <local-file>, --output <report>, or --strict.");
    }
    if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing value after ${arg}`);
    values[arg === "--manifest" ? "manifest" : "output"] = args[++i];
  }
  return values;
}
export function evaluateReleaseManifest(manifest, sha, clean = true, now = new Date()) {
  const observations = [];
  const failures = [];
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) {
    failures.push("Actual checked-out Git SHA is unavailable or invalid.");
  }
  if (!clean) failures.push("Worktree is not clean; recorded evidence must target a reproducible commit.");
  if (!manifest) {
    failures.push("No operator manifest supplied. Real devices, remote database and release sign-off were not verified.");
  } else if (typeof manifest !== "object" || Array.isArray(manifest)) {
    failures.push("Manifest must be a JSON object.");
  } else {
    if (manifest.releaseSha !== sha) failures.push("Manifest SHA does not exactly match checked-out commit.");
    if (manifest.environment !== "production") failures.push("Production acceptance requires environment=production.");
    if (typeof manifest.schoolId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(manifest.schoolId)) {
      failures.push("A valid school UUID is required for a production acceptance record.");
    }
    if (typeof manifest.deploymentIdentifier !== "string" ||
      manifest.deploymentIdentifier.trim().length < 5) {
      failures.push("A concrete deployment identifier is required.");
    }
    if (typeof manifest.operator !== "string" || manifest.operator.trim().length < 3) {
      failures.push("A named independent operator is required.");
    }
    if (!manifest.checks || typeof manifest.checks !== "object" || Array.isArray(manifest.checks)) {
      failures.push("All external acceptance checks must be recorded individually.");
    }
    for (const [key, label] of Object.entries(GATES)) {
      const value = manifest.checks?.[key];
      const status = value?.result === "PASS" || value?.result === "FAIL" ||
        value?.result === "NOT_RUN" ? value.result : "NOT_RUN";
      const reference = typeof value?.reference === "string" ? value.reference.trim() : "";
      const observedAt = typeof value?.observedAt === "string" ? value.observedAt : "";
      const observedTime = Date.parse(observedAt);
      const dated = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(observedAt) &&
        Number.isFinite(observedTime) &&
        observedTime <= now.getTime() + 5 * 60_000 &&
        now.getTime() - observedTime < 31 * 86_400_000;
      if (status !== "PASS") failures.push(`${key} not marked PASS.`);
      if (reference.length < 8 || reference.length > 500 || /[\r\n]/.test(reference)) {
        failures.push(`${key} lacks a usable non-sensitive evidence reference.`);
      }
      if (!dated) failures.push(`${key} must have a recent UTC evidence timestamp.`);
      observations.push({ id: key, label, result: status,
        evidenceReference: reference || null, observedAt: dated ? observedAt : null });
    }
    for (const key of Object.keys(manifest.checks ?? {})) {
      if (!(key in GATES)) failures.push(`Unknown acceptance gate: ${key}`);
    }
  }
  if (!manifest || !manifest.checks || typeof manifest.checks !== "object" ||
    Array.isArray(manifest.checks)) {
    for (const [id, label] of Object.entries(GATES)) {
      observations.push({ id, label, result: "NOT_RUN", evidenceReference: null, observedAt: null });
    }
  }
  return {
    reportVersion: 1,
    generatedAt: now.toISOString(),
    checkedOutSha: sha,
    targetEnvironment: "production",
    schoolId: typeof manifest?.schoolId === "string" ? manifest.schoolId : null,
    deploymentIdentifier: typeof manifest?.deploymentIdentifier === "string"
      ? manifest.deploymentIdentifier : null,
    operator: typeof manifest?.operator === "string" ? manifest.operator : null,
    productionDecision: "NO_GO",
    evidenceState: failures.length ? "INCOMPLETE" : "READY_FOR_INDEPENDENT_RELEASE_REVIEW",
    explanation: failures.length
      ? "Release remains NO-GO: mandatory external evidence has not been independently established."
      : "All required items were recorded in the supplied operator manifest. This does not independently validate artifacts or authorize a production GO.",
    blockers: [...new Set(failures)],
    checks: observations
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const clean = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "";
  const manifest = opts.manifest ? JSON.parse(readFileSync(resolve(opts.manifest), "utf8")) : null;
  const report = evaluateReleaseManifest(manifest, sha, clean);
  const output = JSON.stringify(report, null, 2) + "\n";
  if (opts.output) {
    writeFileSync(resolve(opts.output), output, { flag: "wx", mode: 0o600 });
    console.log(`Phase 7 acceptance report written to ${resolve(opts.output)} (decision: NO_GO).`);
  } else {
    process.stdout.write(output);
  }
  if (opts.strict && report.evidenceState === "INCOMPLETE") process.exitCode = 2;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main();
} else if (process.argv[1]?.endsWith("phase7-release-report.mjs")) {
  main();
}
