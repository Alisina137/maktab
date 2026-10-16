import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("packages/database/drizzle/0029_staff_registration_requests.sql");
const journal=JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
const store=read("packages/database/src/registration-store.ts");
const api=read("apps/api/src/staff/routes.ts");
const dashboard=read("apps/web/app/staff/dashboard/page.tsx");
const staff=read("apps/web/app/staff/staff-registration-panel.tsx");
const admin=read("apps/web/app/admin/(workspace)/registrations/page.tsx");
const css=read("apps/web/app/globals.css");
const home=read("apps/web/app/staff/staff-home-panel.tsx");
assert.equal(journal.entries[29]?.tag,"0029_staff_registration_requests");
for(const key of ["CHECK (\"status\" IN","staff_registration_pending_code_unique","staff_registration_approved_student_unique"])
  assert.ok(sql.includes(key),"Migration safety requirement: "+key);
for(const key of ["eq(registrationRequests.schoolId,schoolId)","eq(registrationRequests.status,\"DRAFT\")",
  "eq(registrationRequests.status,\"SUBMITTED\")","eq(registrationRequests.status,\"UNDER_REVIEW\")",
  "tx.insert(students)","tx.insert(studentClassHistory)","return db.transaction","approvedStudentId:student.id",
  "eq(classSections.gradeLevelId,row.gradeLevelId)","eq(academicYears.schoolId,schoolId)",
  "eq(parentProfiles.schoolId,schoolId)","ne(users.status,\"SUSPENDED\")"])
  assert.ok(store.includes(key),"Registration store guard: "+key);
for(const key of ["ENROLLMENT_REQUESTS","requireSchoolAdmin","details.parse(request.body)",
  "approval.parse(request.body)","registration.approved","registration.rejected",
  'reply.header("cache-control","no-store")'])
  assert.ok(api.includes(key),"Registration endpoint guard: "+key);
assert.ok(dashboard.includes("canRegister")&&dashboard.includes("StaffRegistrationPanel"));
assert.ok(home.includes("onRegistrations, onAttendance, onFees, onWork, onNotifications, unreadCount, onSettings"));
assert.ok(staff.includes("Submit for review")&&staff.includes("identityChecked"));
assert.ok(admin.includes("Approve & enroll")&&admin.includes("Reject application"));
assert.ok(css.includes(".staff-reg-columns"));
console.log("Staff Phase 4 migration, school boundaries, roles, lifecycle, UI and RTL source checks passed.");
