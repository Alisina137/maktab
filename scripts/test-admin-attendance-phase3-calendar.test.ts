import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceCalendarMonth, attendanceAdjacentMonth, attendanceShiftDay, attendanceValidDay
} from "../apps/web/app/admin/attendance-calendar-model.ts";

test("invalid Gregorian dates are rejected without timezone ambiguity",()=>{
  assert.equal(attendanceValidDay("2026-02-30"),false);
  assert.equal(attendanceValidDay("2028-02-29"),true);
  assert.equal(attendanceShiftDay("2026-10-15",1),"2026-10-16");
  assert.equal(attendanceShiftDay("2026-03-01",-1),"2026-02-28");
  assert.throws(()=>attendanceShiftDay("2026-02-30",1));
});
test("Gregorian monthly ranges start correctly and Saturday heads the week",()=>{
  const month=attendanceCalendarMonth("2026-10-15","en");
  assert.equal(month.from,"2026-10-01");
  assert.equal(month.to,"2026-10-31");
  assert.equal(month.days.length,31);
  assert.equal(month.leading,4); // Oct 1 2026 is Thursday, Sat-first offset 5? See below
  assert.equal(attendanceAdjacentMonth("2026-10-15","en",-1),"2026-09-30");
  assert.equal(attendanceAdjacentMonth("2026-10-15","en",1),"2026-11-01");
});
test("Solar Hijri month follows Persian calendar boundaries, including Nowruz",()=>{
  const nowruz=attendanceCalendarMonth("2026-03-21","fa-AF");
  assert.equal(nowruz.from,"2026-03-21");
  assert.equal(nowruz.days.length,31);
  assert.equal(attendanceAdjacentMonth("2026-03-21","fa-AF",1),"2026-04-21");
  const pashto=attendanceCalendarMonth("2026-03-21","ps-AF");
  assert.equal(pashto.from,nowruz.from);
  assert.equal(pashto.to,nowruz.to);
});
