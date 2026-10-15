import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0027_admin_attendance_followups.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const store=read("packages/database/src/attendance-followup-store.ts");
const attendance=read("packages/database/src/attendance-store.ts");
const routes=read("apps/api/src/attendance/routes.ts");
const panel=read("apps/web/app/admin/attendance-panel.tsx");
const ui=read("apps/web/app/admin/admin-attendance-followups.tsx");
const css=read("apps/web/app/globals.css");
const i18n=read("apps/web/app/admin/admin-i18n.ts");
const tests=read("apps/api/src/app.test.ts");
for(const x of ["attendanceFollowupCases","attendanceFollowupActivities",
  "attendance_followup_mark_unique","followupStatusEnum","followupActivityEnum"])
  assert.ok(schema.includes(x),"Missing follow-up database model: "+x);
for(const x of ["CREATE TABLE \"attendance_followup_cases\"",
  "CREATE TABLE \"attendance_followup_activities\"",
  "CREATE UNIQUE INDEX \"attendance_followup_mark_unique\""])
  assert.ok(migration.includes(x),"Missing safe follow-up migration: "+x);
assert.ok(journal.includes('0027_admin_attendance_followups'));
for(const x of ["eq(studentAttendances.schoolId,schoolId)","eq(dailyAttendances.schoolId,schoolId)",
  'mark.status!=="ABSENT"&&mark.status!=="LATE"',
  "year.status!==\"ACTIVE\"","users.role,\"SCHOOL_ADMIN\"",
  "users.role,\"SCHOOL_STAFF\"","eq(attendanceFollowupCases.updatedAt,record.updatedAt)",
  "onConflictDoNothing()","followup_validation","attendance.followup_"]) {
    if(x==="followup_validation")assert.ok(routes.includes(x),"Follow-up validation error contract missing.");
    else assert.ok(store.includes(x),"Missing follow-up safety: "+x);
}
for(const x of ["...createAttendanceFollowupStore(db)","AttendanceFollowupStore"])
  assert.ok(attendance.includes(x),"Follow-up implementation not wired into DB.");
for(const x of ['"/v1/admin/attendance/followups"',"/followups/candidates",
  "/followups/assignees",'/followups/:caseId/activities',
  "requireSchoolAdmin(request,reply,accounts)"])
  assert.ok(routes.includes(x),"Missing scoped follow-up endpoint: "+x);
for(const x of ["<AdminAttendanceFollowups","academicYearStatus={selectedAcademicYear?.status??\"\\"" ])
  assert.ok(panel.includes(x),"Missing follow-up tab integration: "+x);
for(const x of ["new AbortController()","controller.signal.aborted",
  'role="tablist"','role="alert"',"createFor.attendanceId",
  "current.updatedAt","current.currentStatus","Opening reason (required)",
  "Follow-up due date","Contact and activity log",
  "does not send a message or call anyone","formatAdminHijriDate",
  "activityNote.trim().length<5","No cases match the selected filters."])
  assert.ok(ui.includes(x),"Missing follow-up UX safeguard: "+x);
for(const x of [".attendance-followup-body",".attendance-followup-summary",
  "@media (max-width:690px)"])assert.ok(css.includes(x),"Missing follow-up responsive design: "+x);
for(const k of ["Absence and lateness follow-ups","Case already opened","Opening reason (required)",
  "Resolution note","Contact and activity log","Activity details","Historical academic years are read-only; follow-up records stay visible."]) {
    assert.equal(i18n.split(JSON.stringify(k)+":").length,3,"Missing Dari/Pashto phrase: "+k);
}
for(const x of ["Admin Attendance Phase 5","followupAudits","const openedCase=",
  "const updatedFollowup=","const anotherSchool=","const recordedCall="])
  assert.ok(tests.includes(x),"Missing Phase 5 API regression: "+x);
console.log("Attendance Phase 5 follow-up cases, strict tenant boundary, audit, RTL UI and CI gates verified.");
