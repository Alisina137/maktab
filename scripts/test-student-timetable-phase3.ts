import assert from "node:assert/strict";
import test from "node:test";
import type {ParentTimetablePeriod,StudentTimetablePayload} from "../apps/mobile/src/api.js";
import {
  studentSchoolWeekdays,studentClassMinutes,studentTime12,studentTimeRange12,
  studentPeriodsForDay,studentTimetablePeriodState,studentTeacherDirectory
} from "../apps/mobile/src/student-timetable-model.js";

function period(id:string,weekday:ParentTimetablePeriod["period"]["weekday"],
    startsAt:string,endsAt:string,teacherUserId="teacher-a",
    subjectId="math",subjectName="Mathematics",teacherName="Teacher A"):ParentTimetablePeriod {
  return {
    period:{id,weekday,startsAt,endsAt,teacherUserId,subjectId,
      academicYearId:"year",classId:"class"},
    subjectName,subjectCode:subjectId,teacherName
  };
}
const data:StudentTimetablePayload={
  student:{id:"s",studentCode:"S-01",fullName:"Student",status:"ACTIVE",
    academicYearId:"year",classId:"class"},
  classSection:{id:"class",academicYearId:"year",code:"A",name:"Grade A"},
  academicYear:{id:"year",name:"1405",status:"ACTIVE"},
  periods:[
    period("second","SATURDAY","09:00","09:45","teacher-b","english","English","Teacher B"),
    period("first","SATURDAY","08:00","08:45"),
    period("sunday","SUNDAY","09:00","09:45"),
    period("monday","MONDAY","08:00","08:45")
  ]
};

test("Student Phase 3 weekday order follows locale and excludes Friday",()=>{
  assert.deepEqual(studentSchoolWeekdays("fa-AF"),
    ["SATURDAY","SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY"]);
  assert.deepEqual(studentSchoolWeekdays("ps-AF"),studentSchoolWeekdays("fa-AF"));
  assert.deepEqual(studentSchoolWeekdays("en"),
    ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","SATURDAY","SUNDAY"]);
});
test("Student Phase 3 clock uses localized AM/PM",()=>{
  assert.equal(studentTime12("00:00","en"),"12:00 AM");
  assert.equal(studentTime12("08:05","en"),"08:05 AM");
  assert.equal(studentTime12("12:00","en"),"12:00 PM");
  assert.equal(studentTime12("13:05","en"),"01:05 PM");
  assert.equal(studentTime12("23:59","en"),"11:59 PM");
  assert.equal(studentTimeRange12("09:00","12:00","en"),"09:00 AM – 12:00 PM");
  assert.ok(studentTime12("13:05","fa-AF").endsWith("PM"));
  assert.ok(studentTime12("13:05","ps-AF").endsWith("PM"));
  assert.equal(studentClassMinutes("24:00"),null);
});
test("Student Phase 3 sorts lessons immutably and tracks current lesson Kabul time",()=>{
  const before=data.periods.map(x=>x.period.id);
  assert.deepEqual(studentPeriodsForDay(data,"SATURDAY").map(x=>x.period.id),["first","second"]);
  assert.deepEqual(data.periods.map(x=>x.period.id),before);
  assert.deepEqual(studentPeriodsForDay(null,"SATURDAY"),[]);
  const first=data.periods[1]!,second=data.periods[0]!;
  assert.equal(studentTimetablePeriodState(first,new Date("2026-10-17T03:29:00Z")),"UPCOMING");
  assert.equal(studentTimetablePeriodState(first,new Date("2026-10-17T03:30:00Z")),"CURRENT");
  assert.equal(studentTimetablePeriodState(first,new Date("2026-10-17T04:15:00Z")),"FINISHED");
  assert.equal(studentTimetablePeriodState(second,new Date("2026-10-17T04:30:00Z")),"CURRENT");
  assert.equal(studentTimetablePeriodState(first,new Date("2026-10-18T04:00:00Z")),"UPCOMING");
});
test("Student Phase 3 teacher directory groups subjects by ID",()=>{
  const entries=studentTeacherDirectory(data);
  assert.equal(entries.length,2);
  assert.equal(entries[0]?.teacherName,"Teacher A");
  assert.equal(entries[0]?.weeklyPeriods,3);
  assert.equal(entries[0]?.subjects.length,1);
  assert.equal(entries[1]?.subjects[0]?.subjectName,"English");
  assert.deepEqual(studentTeacherDirectory(null),[]);
});
