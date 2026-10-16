import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const journal=JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
const sql=read("packages/database/drizzle/0030_staff_attendance_corrections.sql");
const schema=read("packages/database/src/schema.ts");
const store=read("packages/database/src/staff-attendance-correction-store.ts");
const alerts=read("packages/database/src/staff-attendance-alert.ts");
const routes=read("apps/api/src/staff/attendance-routes.ts");
const app=read("apps/api/src/app.ts");
const server=read("apps/api/src/server.ts");
const dash=read("apps/web/app/staff/dashboard/page.tsx");
const staff=read("apps/web/app/staff/staff-attendance-panel.tsx");
const admin=read("apps/web/app/admin/admin-staff-attendance-requests.tsx");
const panel=read("apps/web/app/admin/attendance-panel.tsx");
const model=read("apps/web/app/admin/attendance-workspace-model.ts");
const local=read("apps/web/app/staff/staff-attendance-i18n.ts");
assert.equal(journal.entries[30]?.tag,"0030_staff_attendance_corrections");
for(const key of [
  'CREATE TABLE "staff_attendance_correction_requests"',
  'CHECK ("status" IN', 'staff_attendance_one_pending_mark_idx',
  'WHERE "status" = \'PENDING\'', '"expected_updated_at" timestamptz NOT NULL',
  '"school_id" uuid NOT NULL'
])assert.ok(sql.includes(key),"Missing correction migration rule: "+key);
assert.ok(schema.includes("export const staffAttendanceCorrectionRequests"));
assert.ok(schema.includes("  staffAttendanceCorrectionRequests,"));
for(const key of [
  'eq(staffAttendanceCorrectionRequests.schoolId,schoolId)',
  'eq(staffAttendanceCorrectionRequests.status,"PENDING")',
  'eq(studentAttendances.updatedAt,current.entry.updatedAt)',
  'current.entry.status!==request.originalStatus',
  'eq(academicYears.schoolId,schoolId)', 'return db.transaction(async tx=>',
  'attendance.corrected_by_admin','syncStaffCorrectionAlert'
])assert.ok(store.includes(key),"Missing transactional correction guard: "+key);
for(const key of [
  'deliveryStatus:"CANCELLED"','deliveryStatus:"PENDING"',
  'student.parentUserId','dedupKey'
])assert.ok(alerts.includes(key),"Missing parent notification lifecycle: "+key);
for(const key of [
  'requireAttendanceStaff','"ATTENDANCE_REVIEW"','requireSchoolAdmin',
  'const correctionInput=z.object','expectedUpdatedAt:z.string().datetime()',
  '"APPROVE"','"REJECT"', 'cache-control","no-store"',
  'getSchoolToday(ctx.user.schoolId)','await attendance.getAdminReport(ctx.user.schoolId',
  'rows:report.rows.slice(query.offset,query.offset+50)'
])assert.ok(routes.includes(key),"Missing Phase 5 endpoint/access guard: "+key);
assert.ok(!routes.includes('app.patch("/v1/staff/attendance'));
assert.ok(app.includes("registerStaffAttendanceRoutes("));
assert.ok(server.includes("createStaffAttendanceCorrectionStore(database.db)"));
assert.ok(dash.includes("canAttend")&&dash.includes("<StaffAttendancePanel"));
assert.ok(staff.includes("Submit correction request")&&staff.includes("AdminHijriDatePicker"));
assert.ok(admin.includes("Approve correction")&&admin.includes("Reject request"));
assert.ok(model.includes('id: "STAFF_REQUESTS"'));
assert.ok(panel.includes("<AdminStaffAttendanceRequests"));
assert.ok(local.includes("const fa:")&&local.includes("const ps:"));
console.log("Staff Phase 5 source safeguards and UI wiring checks passed.");
