import assert from "node:assert/strict";
import test from "node:test";
import { cacheIsCurrent, cacheScopeMatches } from "../apps/mobile/src/read-cache-policy.js";

test("Phase 8 offline reads belong to the exact school/account scope", () => {
  const owner = "school-one:parent-one";
  assert.equal(cacheScopeMatches(owner, owner), true);
  assert.equal(cacheScopeMatches(owner, "school-two:parent-one"), false);
  assert.equal(cacheScopeMatches(owner, "school-one:parent-two"), false);
  assert.equal(cacheScopeMatches(null, null), false);
  assert.equal(cacheScopeMatches("", ""), false);
  assert.equal(cacheScopeMatches(owner, null), false);
  // An in-flight GET from the previous account MUST fail this check after logout.
  let activeScope: string | null = owner;
  const requestScope = activeScope;
  activeScope = "school-two:parent-two";
  assert.equal(cacheScopeMatches(requestScope, activeScope), false);
});

test("Phase 8 cache TTL rejects stale, future-dated and malformed offline snapshots", () => {
  const now = Date.parse("2026-11-13T05:00:00.000Z");
  const ttl = 7 * 24 * 3600_000;
  assert.equal(cacheIsCurrent(new Date(now).toISOString(), now, ttl), true);
  assert.equal(cacheIsCurrent(new Date(now - ttl).toISOString(), now, ttl), true);
  assert.equal(cacheIsCurrent(new Date(now - ttl - 1).toISOString(), now, ttl), false);
  assert.equal(cacheIsCurrent(new Date(now + 1).toISOString(), now, ttl), false);
  assert.equal(cacheIsCurrent("malformed", now, ttl), false);
  assert.equal(cacheIsCurrent(undefined, now, ttl), false);
  assert.equal(cacheIsCurrent({}, now, ttl), false);
  assert.equal(cacheIsCurrent(new Date(now).toISOString(), NaN, ttl), false);
  assert.equal(cacheIsCurrent(new Date(now).toISOString(), now, 0), false);
});
