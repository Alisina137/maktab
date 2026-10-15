import assert from "node:assert/strict";
import test from "node:test";
import { classifyAttendanceDay } from "../packages/database/src/attendance-monitoring-model.ts";
import { validCalendarDay } from "../packages/database/src/attendance-monitoring-store.ts";

const base={
  date:"2026-10-15",today:"2026-10-15",
  yearStart:"2026-03-21",yearEnd:"2027-03-20",
  closed:false,hasTimetable:true,activeStudents:25,negaranCount:1,submitted:false
};
test("eligibility requires school-year teaching day, students and one Negaran",()=>{
  assert.deepEqual(classifyAttendanceDay(base),{state:"PENDING",expected:true});
  assert.deepEqual(classifyAttendanceDay({...base,submitted:true}),{state:"SUBMITTED",expected:true});
  assert.deepEqual(classifyAttendanceDay({...base,closed:true}),{state:"CLOSED",expected:false});
  assert.deepEqual(classifyAttendanceDay({...base,hasTimetable:false}),{state:"NOT_SCHEDULED",expected:false});
  assert.deepEqual(classifyAttendanceDay({...base,activeStudents:0}),{state:"NO_STUDENTS",expected:false});
  assert.deepEqual(classifyAttendanceDay({...base,negaranCount:0}),{state:"NO_NEGARAN",expected:false});
  assert.deepEqual(classifyAttendanceDay({...base,negaranCount:2}),{state:"MULTIPLE_NEGARAN",expected:false});
  assert.deepEqual(classifyAttendanceDay({...base,date:"2026-10-16"}),{state:"FUTURE",expected:false});
  assert.deepEqual(classifyAttendanceDay({...base,date:"2026-02-15"}),{state:"OUTSIDE_YEAR",expected:false});
});
test("existing submitted sheets remain visible, but never inflate expected-day denominator",()=>{
  assert.deepEqual(classifyAttendanceDay({...base,submitted:true,closed:true}),{
    state:"SUBMITTED",expected:false
  });
  assert.deepEqual(classifyAttendanceDay({...base,submitted:true,hasTimetable:false}),{
    state:"SUBMITTED",expected:false
  });
});
test("date validation rejects impossible days and unsafe inputs",()=>{
  assert.equal(validCalendarDay("2026-10-15"),true);
  assert.equal(validCalendarDay("2026-02-29"),false);
  assert.equal(validCalendarDay("2026-04-31"),false);
  assert.equal(validCalendarDay("2026-2-1"),false);
  assert.equal(validCalendarDay("2028-02-29"),true);
});
