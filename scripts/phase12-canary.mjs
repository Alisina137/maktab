#!/usr/bin/env node
/**
 * Phase 12 Task 12.1: bounded, GET-only, staging-only canary health monitor.
 * Never auto-approves release, changes accounts, or stores response bodies/tokens.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { probeStagingApi, validateStagingApi } from "./phase11-pilot.mjs";

const SHA = /^[a-f0-9]{40}$/;
const SENSITIVE = /(?:password|secret|token|api[_-]?key|authorization|cookie|session)[=:]/i;
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));

export function validateCanaryOptions({ count = 3, intervalMs = 1500 } = {}) {
  if (!Number.isInteger(count) || count < 2 || count > 12) {
    throw new Error("Canary sample count must be an integer from 2 to 12.");
  }
  if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 30000 ||
      (count - 1) * intervalMs > 180000) {
    throw new Error("Canary intervals must be 0-30000 ms and total scheduled wait <= 3 minutes.");
  }
  return { count, intervalMs };
}

export function buildCanaryAssessment(samples, { sha, deploymentIdentifier, environment = "staging",
  now = new Date(), maxConsecutiveFailures = 2 } = {}) {
  if (!SHA.test(sha ?? "")) throw new Error("Exact candidate Git SHA is required.");
  if (environment !== "staging") throw new Error("Phase 12 canary is restricted to staging.");
  if (typeof deploymentIdentifier !== "string" || !/^[a-zA-Z0-9._-]{5,100}$/.test(deploymentIdentifier)) {
    throw new Error("A safe concrete staging deployment identifier is required.");
  }
  if (!Array.isArray(samples) || samples.length < 2 || samples.length > 12) {
    throw new Error("Two to twelve actual health observations are required.");
  }
  if (!Number.isInteger(maxConsecutiveFailures) || maxConsecutiveFailures < 1 || maxConsecutiveFailures > 3) {
    throw new Error("Invalid failure threshold.");
  }
  let consecutive = 0, longest = 0, unhealthy = 0;
  const clean = samples.map((sample, index) => {
    if (!sample || sample.environment !== "staging" ||
        !["PROBE_PASS_NOT_LIVE_E2E", "PROBE_FAIL"].includes(sample.result) ||
        !Array.isArray(sample.results) || !sample.results.length) {
      throw new Error("Invalid staging canary sample at index " + index);
    }
    if (typeof sample.observedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(sample.observedAt) ||
        !Number.isFinite(Date.parse(sample.observedAt)) ||
        Date.parse(sample.observedAt) > now.getTime() + 300000) {
      throw new Error("Canary sample timestamp is invalid.");
    }
    if (index > 0 && Date.parse(sample.observedAt) < Date.parse(samples[index - 1].observedAt)) {
      throw new Error("Canary sample timestamps must be chronological.");
    }
    let ok = sample.result === "PROBE_PASS_NOT_LIVE_E2E";
    const paths = [];
    for (const probe of sample.results) {
      if (typeof probe?.path !== "string" || !/^\/[a-zA-Z0-9/_-]*$/.test(probe.path) ||
          typeof probe.pass !== "boolean" ||
          !Number.isInteger(probe.status) && probe.status !== "NETWORK_ERROR" ||
          !["anonymous", "admin", "metrics"].includes(probe.check)) {
        throw new Error("Malformed canary endpoint result.");
      }
      paths.push({ path: probe.path, check: probe.check, pass: probe.pass,
        status: probe.status });
      if (!probe.pass) ok = false;
      // Leakage is a critical stop, even if a buggy caller labeled the probe PASS.
      if (probe.path === "/metrics" && probe.check === "anonymous" && probe.status === 200) ok = false;
      if (probe.path.startsWith("/v1/") && probe.check === "anonymous" && probe.status === 200) ok = false;
    }
    if (!paths.some(p => p.path === "/health") || !paths.some(p => p.path === "/ready") ||
        !paths.some(p => p.path === "/metrics" && p.check === "anonymous")) {
      ok = false;
    }
    if (!ok) { consecutive++; unhealthy++; } else consecutive = 0;
    longest = Math.max(longest, consecutive);
    return { observedAt: sample.observedAt, pass: ok, probes: paths };
  });
  const privacyViolations = clean.flatMap(sample => sample.probes
    .filter(p => p.check === "anonymous" && p.status === 200 &&
      (p.path.startsWith("/v1/") || p.path === "/metrics"))
    .map(p => p.path));
  const halt = unhealthy > 0 || longest >= maxConsecutiveFailures || privacyViolations.length > 0;
  return {
    reportVersion: 1, releaseSha: sha, deploymentIdentifier, environment,
    generatedAt: now.toISOString(), sampleCount: clean.length,
    successfulSamples: clean.length - unhealthy, failedSamples: unhealthy,
    longestConsecutiveFailures: longest,
    privacyViolations: [...new Set(privacyViolations)],
    // Even zero failures are only a preliminary staging signal, never launch authority.
    canaryState: halt ? "HALT_AND_INVESTIGATE" : "STAGING_OBSERVATION_PASS",
    productionDecision: "NO_GO",
    samples: clean,
    note: "Staging GET-only probes cannot prove Android usability, real provider delivery, tenant isolation or operator signoff."
  };
}

export async function sampleStagingCanary(env, {
  count = 3, intervalMs = 1500, probe = probeStagingApi,
  wait = ms => new Promise(done => setTimeout(done, ms)),
  clock = () => new Date()
} = {}) {
  validateStagingApi(env);
  validateCanaryOptions({ count, intervalMs });
  const samples = [];
  for (let index = 0; index < count; index++) {
    if (index) await wait(intervalMs);
    const result = await probe(env);
    samples.push({ ...result, observedAt: clock().toISOString() });
  }
  return samples;
}

function outsideRepository(path) {
  if (!path || !isAbsolute(path)) throw new Error("Use an absolute external evidence file path.");
  const location = resolve(path);
  const rel = relative(root, location);
  if (!rel || (!rel.startsWith("..") && !isAbsolute(rel))) {
    throw new Error("Private canary evidence must remain outside Git.");
  }
  return location;
}
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!["--output", "--count", "--interval-ms", "--deployment"].includes(key) ||
        !argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("Invalid Phase 12 options.");
    if (opts[key]) throw new Error("Duplicate Phase 12 option.");
    opts[key] = argv[++i];
  }
  return opts;
}
async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (!opt["--output"]) throw new Error("--output path outside repository is required.");
  const count = opt["--count"] === undefined ? 3 : Number(opt["--count"]);
  const intervalMs = opt["--interval-ms"] === undefined ? 1500 : Number(opt["--interval-ms"]);
  validateCanaryOptions({ count, intervalMs });
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!SHA.test(sha)) throw new Error("Unable to establish exact build SHA.");
  const deploymentIdentifier = opt["--deployment"] || process.env.PHASE12_STAGING_BUILD;
  const result = await sampleStagingCanary(process.env, { count, intervalMs });
  const report = buildCanaryAssessment(result, { sha, deploymentIdentifier });
  writeFileSync(outsideRepository(opt["--output"]), JSON.stringify(report, null, 2) + "\n",
    { flag: "wx", mode: 0o600 });
  console.log("Staging canary: " + report.canaryState + "; " +
    report.successfulSamples + "/" + report.sampleCount + " successful. Production: NO_GO.");
  if (report.canaryState !== "STAGING_OBSERVATION_PASS") process.exitCode = 2;
}
if (process.argv[1] && basename(process.argv[1]) === "phase12-canary.mjs") {
  main().catch(error => {
    // Never echo potentially sensitive probe errors or environment values.
    const publicError = error instanceof Error && !SENSITIVE.test(error.message) &&
      !/postgres|https?:\/\//i.test(error.message) ? error.message : "Review staging configuration and output path.";
    console.error("Phase 12 staging canary failed: " + publicError);
    process.exitCode = 2;
  });
}
