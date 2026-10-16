import assert from "node:assert/strict";
import test from "node:test";
import { oversightWindowBounds } from "./pilot-oversight-store.js";

test("Pilot Operations oversight windows use Kabul civil midnight, not the server's UTC midnight", () => {
  const now = new Date("2026-10-16T20:00:00Z"); // 17 October, 00:30 in Kabul
  const seven = oversightWindowBounds("7d", now);
  const thirty = oversightWindowBounds("30d", now);
  const ninety = oversightWindowBounds("90d", now);
  assert.equal(seven.startAt, "2026-10-10T19:30:00.000Z");
  assert.equal(thirty.startAt, "2026-09-17T19:30:00.000Z");
  assert.equal(ninety.startAt, "2026-07-19T19:30:00.000Z");
  assert.equal(seven.endAt, now.toISOString());
  assert.equal(thirty.endAt, now.toISOString());
  assert.equal(ninety.endAt, now.toISOString());
});

test("Pilot oversight windows handle year boundaries with fixed Kabul offset", () => {
  const now = new Date("2027-01-01T00:00:00Z"); // 04:30 Kabul, Jan 1
  const seven = oversightWindowBounds("7d", now);
  assert.equal(seven.startAt, "2026-12-25T19:30:00.000Z");
});
