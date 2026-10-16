import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const paths=[
 "packages/database/src/schema.ts",
 "packages/database/src/staff-workflow-store.ts",
 "apps/api/src/staff/workflow-routes.ts",
 "apps/api/src/staff/attendance-routes.ts",
 "apps/api/src/staff/fee-routes.ts",
 "apps/web/app/staff/dashboard/page.tsx",
 "apps/web/app/staff/staff-work-panel.tsx",
 "apps/web/app/staff/staff-work-preferences.tsx",
 "apps/web/app/admin/(workspace)/staff-work/page.tsx",
 "apps/web/app/admin/admin-workspace.tsx"
];
const sources=Object.fromEntries(paths.map(path=>[path,read(path)]));
const workflow=sources[paths[2]],store=sources[paths[1]],dashboard=sources[paths[5]];
const journal=JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
assert.equal(journal.entries.at(-1)?.tag,"0031_staff_workflow");
assert.equal(new Set(journal.entries.map(x=>x.tag)).size,journal.entries.length);
for(const part of [
  'eq(staffWorkTasks.schoolId,schoolId)',
  'eq(staffWorkTasks.assignedTo,staffId)',
  'eq(staffMessageDrafts.schoolId,schoolId)',
  'eq(staffMessageDrafts.createdBy,staffId)',
  'eq(staffMessageDrafts.status,"SUBMITTED")',
  'return db.transaction(async tx=>',
  'staff_task.cancelled',
  'staff_message.reviewed',
])assert.ok(store.includes(part),"Database guard missing: "+part);
for(const part of [
  'requireSchoolAdmin(request,reply,accounts)',
  'hasStaffPermission(permissions,permission)',
  '"/v1/staff/tasks"',
  '"/v1/staff/message-drafts"',
  '"/v1/staff/work-preferences"',
  '"/v1/staff/work-notifications"',
  'cache-control","no-store"',
])assert.ok(workflow.includes(part),"API guard missing: "+part);
assert.ok(!workflow.includes('createAnnouncement('),"Staff cannot publish announcements.");
assert.ok(dashboard.includes('failure.code!=="permission_denied"'),
  "Permission errors should not force staff logout.");
assert.ok(dashboard.includes('current_password_invalid'),
  "Password mistakes should not force logout.");
for(const key of ["<StaffWorkPanel","<StaffWorkPreferences","canTasks","canDrafts","canFees","canAttend","canRegister"]){
 assert.ok(dashboard.includes(key),"Missing dashboard module: "+key);
}
assert.ok(sources[paths[8]].includes("Approve copy"));
assert.ok(sources[paths[9]].includes('href: "/admin/staff-work"'));
assert.ok(sources[paths[6]].includes('if(saved)editDraft(null)'),
 "Draft editing must survive failed saves.");
assert.ok(sources[paths[7]].includes('showNotificationBadge'));
assert.ok(sources[paths[3]].includes("ATTENDANCE_REVIEW"));
assert.ok(sources[paths[4]].includes("FEES_COLLECT"));
const p=JSON.parse(read("package.json"));
for(let i=1;i<=7;i++)assert.ok(p.scripts["verify:staff:phase"+i],"Missing staff phase "+i+" suite");
console.log("Staff Phase 8: security, workflow, navigation, migration and regression gates passed.");
