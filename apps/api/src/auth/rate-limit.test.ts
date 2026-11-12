import assert from "node:assert/strict";
import test from "node:test";
import { LoginRateLimiter } from "./rate-limit.js";

test("Security Phase 2: limits attempts by key without cross-key reset", () => {
  const limiter = new LoginRateLimiter(2, 1000, 3);
  assert.equal(limiter.consume("school:ip:a", 100), true);
  assert.equal(limiter.consume("school:ip:a", 101), true);
  assert.equal(limiter.consume("school:ip:a", 102), false);
  assert.equal(limiter.consume("school:ip:b", 103), true);
  limiter.clear("school:ip:b");
  assert.equal(limiter.consume("school:ip:a", 104), false);
  assert.equal(limiter.consume("school:ip:a", 1100), true);
});

test("Security Phase 2: bounded limiter prunes expired entries and fails closed when full", () => {
  const limiter = new LoginRateLimiter(2, 1000, 2);
  assert.equal(limiter.consume("ip:one", 0), true);
  assert.equal(limiter.consume("ip:two", 5), true);
  assert.equal(limiter.consume("ip:three", 100), false);
  assert.equal(limiter.consume("ip:one", 100), true);
  assert.equal(limiter.consume("ip:one", 100), false);
  assert.equal(limiter.consume("ip:three", 1005), true);
  assert.equal(limiter.consume("ip:one", 1005), true);
});
