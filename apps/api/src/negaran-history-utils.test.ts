import test from "node:test";
import assert from "node:assert/strict";
import { countAttendance, fillUnmarkedPresent, monthRange, shiftMonth, calendarCells } from "../../mobile/src/negaran-attendance-utils.js";

test("bulk mark present preserves explicit absence and late marks", () => {
  const ids = ["a","b","c","d"];
  const draft = { a: "ABSENT", b: "LATE", c: "PRESENT" } as const;
  const filled = fillUnmarkedPresent(ids, draft);
  assert.deepEqual(filled, {a:"ABSENT",b:"LATE",c:"PRESENT",d:"PRESENT"});
  assert.deepEqual(countAttendance(ids, filled), {
    totals: {PRESENT:2, ABSENT:1, LATE:1, EXCUSED:0},
    marked:4, unmarked:0, total:4
  });
  assert.deepEqual(draft, {a:"ABSENT",b:"LATE",c:"PRESENT"});
});

test("monthly history cannot request future days or invalid months", () => {
  assert.deepEqual(monthRange("2026-02","2026-10-13"), {from:"2026-02-01",to:"2026-02-28"});
  assert.deepEqual(monthRange("2024-02","2026-10-13"), {from:"2024-02-01",to:"2024-02-29"});
  assert.deepEqual(monthRange("2026-10","2026-10-13"), {from:"2026-10-01",to:"2026-10-13"});
  assert.equal(monthRange("2026-11","2026-10-13"), null);
  assert.equal(monthRange("2026-00","2026-10-13"), null);
  assert.equal(shiftMonth("2026-01",-1),"2025-12");
  assert.equal(shiftMonth("2026-12",1),"2027-01");
  const jan = calendarCells("2026-01");
  assert.equal(jan.filter(Boolean).length,31);
  assert.ok(jan.includes("2026-01-01"));
  assert.equal(jan.length%7,0);
});
