import assert from "node:assert/strict";
import test from "node:test";
import { createReadinessProbe, hasMetricsBearer } from "./operational-readiness.js";

test("Phase 9: dedicated metrics token is required and compared without leaking credentials", () => {
  const token = "phase-9-probe-isolated-credential-1234567890";
  assert.equal(hasMetricsBearer(undefined, token), false);
  assert.equal(hasMetricsBearer("Bearer " + token, undefined), false);
  assert.equal(hasMetricsBearer("Bearer wrong", token), false);
  assert.equal(hasMetricsBearer(token, token), false);
  assert.equal(hasMetricsBearer("Basic " + token, token), false);
  assert.equal(hasMetricsBearer("Bearer " + token, token), true);
});

test("Phase 9: readiness probes share a single in-flight SQL query and cache successes", async () => {
  let now = 1000;
  let checks = 0;
  let answer: ((value: boolean) => void) | null = null;
  const check = createReadinessProbe(() => {
    checks++;
    return new Promise<boolean>((resolve) => { answer = resolve; });
  }, { now: () => now, ttlMs: 1000, timeoutMs: 100 });
  const first = check();
  const second = check();
  await Promise.resolve();
  assert.equal(checks, 1);
  if (!answer) throw new Error("Missing pending health check");
  (answer as (value: boolean) => void)(true);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(await check(), true);
  assert.equal(checks, 1);
  now += 1001;
  const third = check();
  await Promise.resolve();
  assert.equal(checks, 2);
  if (!answer) throw new Error("Missing second health check");
  (answer as (value: boolean) => void)(false);
  assert.equal(await third, false);
});

test("Phase 9: database exception or hang fails readiness closed within a bounded deadline", async () => {
  let invocations = 0;
  const failing = createReadinessProbe(async () => {
    invocations++;
    throw new Error("SQL connection string should never leak to a probe response");
  }, { ttlMs: 10, timeoutMs: 25 });
  assert.equal(await failing(), false);
  assert.equal(await failing(), false);
  assert.equal(invocations, 1);
  const hung = createReadinessProbe(() => new Promise<boolean>(() => {}),
    { timeoutMs: 20, ttlMs: 5 });
  const started = Date.now();
  assert.equal(await hung(), false);
  assert.ok(Date.now() - started < 500, "The timeout must bound an unresponsive query");
});

test("Phase 9: late query success after a timeout never turns a failed probe green", async () => {
  let resolveProbe: ((value: boolean) => void) | undefined;
  const probe = createReadinessProbe(
    () => new Promise<boolean>((resolve) => { resolveProbe = resolve; }),
    { ttlMs: 10_000, timeoutMs: 20 }
  );
  assert.equal(await probe(), false);
  resolveProbe?.(true);
  await Promise.resolve();
  assert.equal(await probe(), false);
});
