#!/usr/bin/env node
// Phase 12 Step 6: GET-only isolated staging release candidate pre-review.
// No database writes, real-device assertions, automated GO decisions or credential logs.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessLedger, probeStagingApi, validateStagingApi } from "./phase11-pilot.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const SHA = /^[a-f0-9]{40}$/;
const BUILD = /^[a-zA-Z0-9._:-]{5,120}$/;
export function validateCandidateEnv(env) {
  if (env.PHASE11_CONFIRM_STAGING !== "YES") throw new Error("Explicit isolated staging confirmation required.");
  if (!env.PRODUCTION_API_URL) throw new Error("Production API host required for staging isolation.");
  const stage = validateStagingApi(env);
  let prod; try { prod = new URL(env.PRODUCTION_API_URL); }
  catch { throw new Error("Production API URL must be valid."); }
  if (prod.protocol !== "https:" || !prod.hostname || stage.hostname === prod.hostname) {
    throw new Error("Staging and production must be separate HTTPS hosts.");
  }
  if (!SHA.test(env.PHASE12_DEPLOYED_SHA ?? "")) throw new Error("Exact deployed commit required.");
  for (const key of ["PHASE12_API_BUILD", "PHASE12_WEB_BUILD", "PHASE12_MOBILE_BUILD"]) {
    if (!BUILD.test(env[key] ?? "")) throw new Error(key + " requires a concrete safe build label.");
  }
  return {
    sha: env.PHASE12_DEPLOYED_SHA, apiBuild: env.PHASE12_API_BUILD,
    webBuild: env.PHASE12_WEB_BUILD, mobileBuild: env.PHASE12_MOBILE_BUILD
  };
}

export function assessPhase12Candidate({
  sourceSha, deployedSha, ledger, apiBuild, webBuild, mobileBuild,
  probe, worktreeClean = true, now = new Date()
}) {
  if (!SHA.test(sourceSha ?? "")) throw new Error("Invalid exact source SHA.");
  const submitted = assessLedger(ledger, { sha: sourceSha, now, worktreeClean });
  const observations = Array.isArray(probe?.results) ? probe.results.map(row => ({
    path: typeof row?.path === "string" && /^\/[a-zA-Z0-9/_-]*$/.test(row.path)
      ? row.path : "INVALID",
    check: ["anonymous", "admin", "metrics"].includes(row?.check) ? row.check : "INVALID",
    status: Number.isInteger(row?.status) && row.status >= 100 && row.status <= 599
      ? row.status : "NETWORK_ERROR",
    pass: row?.pass === true
  })) : [];
  const blockers = [];
  if (sourceSha !== deployedSha) blockers.push("Staging deployment SHA differs from checked-out source.");
  if (!worktreeClean) blockers.push("Source checkout is not clean.");
  if (![apiBuild,webBuild,mobileBuild].every(value => BUILD.test(value ?? ""))) {
    blockers.push("Missing actual staged API, web or mobile build identifiers.");
  }
  if (probe?.environment !== "staging" || probe?.result !== "PROBE_PASS_NOT_LIVE_E2E" ||
      !observations.length || observations.some(row => !row.pass)) {
    blockers.push("Staging API readiness and security probes have not passed.");
  }
  if (!observations.some(row => row.path === "/health" && row.pass) ||
      !observations.some(row => row.path === "/ready" && row.pass) ||
      !observations.some(row => row.path === "/metrics" && row.check === "anonymous"
        && row.pass && row.status !== 200)) {
    blockers.push("Missing health/readiness/private-metrics observations.");
  }
  if (observations.some(row => row.check === "anonymous" && row.status === 200 &&
      (row.path === "/metrics" || row.path.startsWith("/v1/")))) {
    blockers.push("Private data or metrics may be exposed without authorization.");
  }
  if (submitted.readiness !== "READY_FOR_INDEPENDENT_PILOT_REVIEW") {
    blockers.push("All Phase 11 external live journeys and gates require real independent evidence.");
  }
  return {
    reportVersion: 1, generatedAt: now.toISOString(),
    sourceSha, deployedSha: SHA.test(deployedSha ?? "") ? deployedSha : null,
    stagingBuilds: {
      api: BUILD.test(apiBuild ?? "") ? apiBuild : "UNVERIFIED",
      web: BUILD.test(webBuild ?? "") ? webBuild : "UNVERIFIED",
      mobile: BUILD.test(mobileBuild ?? "") ? mobileBuild : "UNVERIFIED"
    },
    integrationMatrix: [
      "verify:phase12:step1", "verify:phase12:step2", "verify:phase12:step3",
      "verify:phase12:step4", "verify:phase12:step5"
    ],
    liveJourneysRecordedPass: submitted.completedJourneys ?? 0,
    externalGatesRecordedPass: submitted.completedGates ?? 0,
    liveJourneysRequired: submitted.totalJourneys ?? 20,
    externalGatesRequired: submitted.totalGates ?? 11,
    stagingProbe: { result: probe?.result === "PROBE_PASS_NOT_LIVE_E2E"
      ? "REPORTED_PASS_REQUIRES_INDEPENDENT_REVIEW" : "FAILED_OR_UNVERIFIED",
      observations },
    blockers: [...new Set([...blockers, ...(submitted.blockers ?? [])])],
    readiness: blockers.length ? "INCOMPLETE" : "READY_FOR_INDEPENDENT_OPERATOR_REVIEW",
    productionDecision: "NO_GO",
    note: "Operator-supplied evidence is not independently authenticated and GET probes cannot prove browsers, Android, financial concurrency or live delivery."
  };
}
function outsideRepo(path) {
  if (!path || !isAbsolute(path)) throw new Error("Evidence requires absolute external file path.");
  const location = resolve(path);
  const rel = relative(root, location);
  if (!rel || (!rel.startsWith("..") && !isAbsolute(rel))) throw new Error("Evidence must remain outside Git.");
  return location;
}
function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    if (!["--input", "--output"].includes(argv[i]) || !argv[i+1] ||
        argv[i+1].startsWith("--") || result[argv[i]]) throw new Error("Use --input and --output.");
    result[argv[i]] = argv[++i];
  }
  if (!result["--input"] || !result["--output"]) throw new Error("Both input and output required.");
  return result;
}
async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const build = validateCandidateEnv(process.env);
  const ledger = JSON.parse(readFileSync(outsideRepo(opt["--input"]), "utf8"));
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const worktreeClean = execFileSync("git", ["status", "--porcelain"],
    { encoding: "utf8" }).trim() === "";
  const probe = await probeStagingApi(process.env);
  const report = assessPhase12Candidate({
    sourceSha, deployedSha: build.sha, apiBuild: build.apiBuild,
    webBuild: build.webBuild, mobileBuild: build.mobileBuild,
    ledger, probe, worktreeClean
  });
  writeFileSync(outsideRepo(opt["--output"]), JSON.stringify(report, null, 2) + "\n",
    { mode: 0o600, flag: "wx" });
  console.log("Phase 12 staging candidate: " + report.readiness + "; production: NO_GO.");
  if (report.readiness !== "READY_FOR_INDEPENDENT_OPERATOR_REVIEW") process.exitCode = 2;
}
if (process.argv[1] && basename(process.argv[1]) === "phase12-release-candidate.mjs") {
  main().catch(() => {
    console.error("Phase 12 candidate review failed. Inspect private evidence and staging configuration.");
    process.exitCode = 2;
  });
}
