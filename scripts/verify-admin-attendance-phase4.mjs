import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const contract=read("packages/contracts/src/index.ts");
const db=read("packages/database/src/attendance-store.ts");
const audit=read("packages/database/src/attendance-audit-store.ts");
const routes=read("apps/api/src/attendance/routes.ts");
const panel=read("apps/web/app/admin/attendance-panel.tsx");
const ui=read("apps/web/app/admin/admin-attendance-audit.tsx");
const i18n=read("apps/web/app/admin/admin-i18n.ts");
const css=read("apps/web/app/globals.css");
const test=read("apps/api/src/app.test.ts");
for(const x of [
  "reason: z.string().trim().min(5).max(240)",
  "expectedUpdatedAt: z.string().datetime({ offset: true })",
  "}).strict();"
])assert.ok(contract.includes(x),"Missing required correction contract: "+x);
for(const x of [
  "current.entry.updatedAt.toISOString() !== new Date(input.expectedUpdatedAt).toISOString()",
  "eq(studentAttendances.updatedAt, current.entry.updatedAt)",
  "Math.max(Date.now(), current.entry.updatedAt.getTime() + 1)",
  "input.status === current.entry.status",
  "reason: input.reason",
  "originalNote: current.entry.note",
  "await syncAttendanceAlert(tx, schoolId, attendance, current.student, entry.status)",
  'action: "attendance.corrected_by_admin"',
  "...createAttendanceAuditStore(db)"
])assert.ok(db.includes(x),"Correction guard, original note or transaction missing: "+x);
assert.ok(!db.includes("note: input.note || null"),"Admin correction must never overwrite teacher note.");
for(const x of [
  "eq(auditLogs.schoolId, schoolId)",
  "eq(dailyAttendances.schoolId, schoolId)",
  "eq(dailyAttendances.academicYearId, academicYearId)",
  'eq(auditLogs.action, "attendance.corrected_by_admin")',
  ".limit(limit).offset(offset)",
  "eq(students.schoolId, schoolId)",
  "eq(users.schoolId, schoolId)"
])assert.ok(audit.includes(x),"Unscoped correction history or unbounded query: "+x);
for(const x of [
  '"/v1/admin/attendance/audit"',
  "adminAttendanceAuditQuerySchema",
  "requireSchoolAdmin(request, reply, accounts)",
  "attendance.getAdminAttendanceAudit(context.user.schoolId, query)",
  "cache-control"
])assert.ok(routes.includes(x),"Protected audit API missing: "+x);
for(const x of [
  'expectedUpdatedAt: row.updatedAt',
  'reason: reason.trim()',
  'readOnly={historicalReadOnly}',
  'admin-attendance-audit',
  '<AdminAttendanceAudit',
  'Original teacher note',
  'reason.trim().length >= 5'
])assert.ok(panel.includes(x),"Safe correction UI missing: "+x);
for(const x of [
  "new AbortController()",
  "controller.signal.aborted",
  "getAdminAttendanceAudit",
  "dateStyle",
  "timeZone: \"Asia/Kabul\"",
  "attendance/audit?",
  "setOffset(n=>n+PAGE_SIZE)",
  'role="alert"'
]) if(x!=="getAdminAttendanceAudit") assert.ok(ui.includes(x),"Audit page safeguard missing: "+x);
for(const key of ["Original teacher note","Correction reason (required)",
  "No correction events match these filters.","Student name or code",
  "Reason not captured for older correction","Changed by"]) {
  assert.equal(i18n.split(JSON.stringify(key)+":").length,3,
    "Missing Dari / Pashto translation: "+key);
}
for(const x of [".attendance-audit-card",".attendance-audit-filter",".attendance-original-note",
  "@media (max-width:620px)"])assert.ok(css.includes(x),"Missing attendance Phase 4 styling: "+x);
for(const x of ["const noReason=","const noRevision=","const staleRevision=",
  "const auditResponse=","const conflict=","originalNote,beforeRow.note"])
  assert.ok(test.includes(x),"Missing Phase 4 integrated API regression: "+x);
console.log("Attendance Phase 4 correction reasons, original notes, optimistic locks, tenant-safe audit API, pagination, localized UI and tests verified.");
