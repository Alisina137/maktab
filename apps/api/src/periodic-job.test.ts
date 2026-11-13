import assert from "node:assert/strict";
import test from "node:test";
import { createNonOverlappingJob } from "./periodic-job.js";

test("Phase 9: periodic job never overlaps and shutdown waits for current attempt", async () => {
  let total = 0;
  let done: (() => void) | undefined;
  let failures = 0;
  const worker = createNonOverlappingJob(() => {
    total++;
    return new Promise<void>((resolve) => { done = resolve; });
  }, () => { failures++; });

  const first = worker.trigger();
  const second = worker.trigger();
  await Promise.resolve();
  assert.equal(total, 1);
  assert.equal(first, second);
  const stopping = worker.stop(500);
  done?.();
  assert.equal(await stopping, true);
  await first;
  await worker.trigger();
  assert.equal(total, 1, "Stopped job must not restart.");
  assert.equal(failures, 0);
});

test("Phase 9: failed job calls safe failure callback once and can be retried", async () => {
  let runs = 0;
  let reports = 0;
  const worker = createNonOverlappingJob(async () => {
    runs++;
    if (runs === 1) throw new Error("secret=never-expose");
  }, () => { reports++; });
  await worker.trigger();
  assert.equal(reports, 1);
  await worker.trigger();
  assert.equal(runs, 2);
  assert.equal(reports, 1);
  assert.equal(await worker.stop(), true);
});

test("Phase 9: shutdown has a finite deadline when a task never returns", async () => {
  const worker = createNonOverlappingJob(
    () => new Promise<void>(() => {}), () => {}
  );
  void worker.trigger();
  await Promise.resolve();
  const start = Date.now();
  assert.equal(await worker.stop(15), false);
  assert.ok(Date.now() - start < 500);
});
