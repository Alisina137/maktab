// Phase 1 foundation guard: cheap, dependency-free checks that should fail
// before expensive CI jobs when tooling, lockfile or repository hygiene drifts.
// This is a static consistency guard, not a substitute for builds or live tests.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

const pkg = JSON.parse(read("package.json"));
const manager = /^pnpm@(\d+\.\d+\.\d+)$/.exec(pkg.packageManager ?? "");
assert.ok(manager, "Root packageManager must pin an exact pnpm version.");
const pnpmVersion = manager[1];

const lock = read("pnpm-lock.yaml");
const lockManager = /packageManagerDependencies:\s*\n\s*pnpm:\s*\n\s*specifier:\s*(\d+\.\d+\.\d+)\s*\n\s*version:\s*(\d+\.\d+\.\d+)/.exec(lock);
assert.ok(lockManager, "Lockfile must pin the pnpm manager used by the repository.");
assert.equal(lockManager[1], pnpmVersion, "Lockfile pnpm specifier differs from packageManager.");
assert.equal(lockManager[2], pnpmVersion, "Resolved pnpm version differs from packageManager.");

const workflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/student-navigation.yml",
  ".github/workflows/teacher-navigation.yml",
  ".github/workflows/staff-phase8.yml"
];
for (const path of workflows) {
  const yaml = read(path);
  assert.ok(yaml.includes("version: " + pnpmVersion), path + " must use the pinned pnpm version.");
  assert.match(yaml, /pnpm install --frozen-lockfile/, path + " must install from the committed lockfile.");
  assert.doesNotMatch(yaml, /pnpm install --no-frozen-lockfile/, path + " must not rewrite dependency resolution.");
}

const ci = read(".github/workflows/ci.yml");
assert.match(ci, /permissions:\s*\n\s*contents: read/, "Main CI must use read-only token permissions.");
assert.match(ci, /concurrency:/, "Main CI must control concurrent runs.");
assert.match(ci, /node-version: 22\.13\.1/, "Linux CI must cover the minimum supported Node runtime.");
assert.match(ci, /node-version: "24"/, "Windows CI must cover the current development Node runtime.");
assert.match(ci, /run: pnpm verify:foundation/, "Main CI must execute foundation checks.");

assert.equal(
  pkg.scripts["verify:foundation"],
  "node scripts/verify-project-foundation.mjs",
  "The repository must expose the foundation verification command."
);
assert.match(pkg.scripts.verify, /pnpm verify:foundation/, "Full verification must include the foundation checks.");

for (const name of ["verify:admin-grade-codes", "verify:admin-class-codes", "verify:admin-teacher-codes"]) {
  assert.ok(pkg.scripts.verify.includes("pnpm " + name), "Full verification must run " + name + ".");
  assert.ok(ci.includes("pnpm " + name), "Main CI must run " + name + ".");
}


const ignored = read(".gitignore");
assert.match(ignored, /^\*\.tsbuildinfo$/m, "Generated TypeScript build cache must be ignored.");
assert.match(ignored, /^\.env\.\*$/m, "Local and mobile environment secrets must remain ignored.");

const readme = read("README.md");
assert.match(readme, /docs\/FINAL-AUDIT-PHASE1\.md/, "README must link to the current foundation audit.");
assert.match(readme, /NO-GO/, "README must not imply an unapproved production release.");

if (existsSync(resolve(root, ".git"))) {
  const trackedBuildCache = execFileSync(
    "git",
    ["ls-files", "--", "apps/web/tsconfig.tsbuildinfo"],
    { cwd: root, encoding: "utf8" }
  ).trim();
  assert.equal(trackedBuildCache, "", "Generated TypeScript build cache must not be committed.");
}

console.log("[foundation] PASS: pinned pnpm, lockfile, CI Node matrix and permissions.");
console.log("[foundation] PASS: Git ignore rules, release caveat and generated-artifact hygiene.");
