import test from "node:test";
import assert from "node:assert/strict";
import {
  adjacentAttendanceMonth, attendanceMonth, shiftIsoDay, summarizeAttendance, validIsoDay
} from "../apps/mobile/src/parent-attendance-model";
import type { ParentAttendanceDay } from "../apps/mobile/src/api";

function row(date: string, status: ParentAttendanceDay["status"]): ParentAttendanceDay {
  return { attendanceId: date, date, status, note: null, classId: "class-1", className: "A" };
}

test("Gregorian month range and Saturday-first layout are correct across leap day", () => {
  const feb = attendanceMonth("2024-02-20", "en");
  assert.equal(feb.from, "2024-02-01");
  assert.equal(feb.to, "2024-02-29");
  assert.equal(feb.dates.length, 29);
  assert.equal(feb.offset, 5); // February 1, 2024 is Thursday (Saturday = 0).
  assert.equal(adjacentAttendanceMonth("2024-02-15", "en", -1), "2024-01-31");
  assert.equal(adjacentAttendanceMonth("2024-02-15", "en", 1), "2024-03-01");
  assert.equal(attendanceMonth("2025-02-12", "en").dates.length, 28);
  assert.equal(shiftIsoDay("2024-02-28", 1), "2024-02-29");
  assert.equal(validIsoDay("2025-02-29"), false);
});

test("Solar Hijri months, boundaries and visible day labels use the Afghan locale", () => {
  for (const locale of ["fa-AF", "ps-AF"] as const) {
    const month = attendanceMonth("2026-03-21", locale);
    const previous = attendanceMonth(adjacentAttendanceMonth("2026-03-21", locale, -1), locale);
    const next = attendanceMonth(adjacentAttendanceMonth("2026-03-21", locale, 1), locale);
    assert.ok(month.from <= "2026-03-21" && month.to >= "2026-03-21");
    assert.equal(previous.to, shiftIsoDay(month.from, -1));
    assert.equal(next.from, shiftIsoDay(month.to, 1));
    assert.equal(month.dates[0]?.day, 1);
    assert.match(month.title, /\S/);
    assert.ok(month.dates.length >= 29 && month.dates.length <= 31);
  }
});

test("Percentage only considers recorded non-excused days; missing does not mean absent", () => {
  const from = "2026-10-01", to = "2026-10-31";
  const result = summarizeAttendance([
    row("2026-10-01", "PRESENT"), row("2026-10-02", "PRESENT"),
    row("2026-10-03", "LATE"), row("2026-10-04", "ABSENT"),
    row("2026-10-05", "EXCUSED"),
    row("2026-10-05", "EXCUSED"), // do not count a corrected date twice
    row("2026-09-30", "ABSENT"), row("2026-11-01", "ABSENT")
  ], from, to);
  assert.deepEqual(result.counts, { PRESENT: 2, ABSENT: 1, LATE: 1, EXCUSED: 1 });
  assert.equal(result.recorded, 5);
  assert.equal(result.eligible, 4);
  assert.equal(result.rate, 75);
  const empty = summarizeAttendance([], from, to);
  assert.equal(empty.rate, null);
  assert.equal(empty.recorded, 0);
  const excused = summarizeAttendance([row("2026-10-06", "EXCUSED")], from, to);
  assert.equal(excused.rate, null);
});
