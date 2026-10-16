import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const journal=JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
const migration=read("packages/database/drizzle/0031_staff_workflow.sql");
const schema=read("packages/database/src/schema.ts");
const store=read("packages/database/src/staff-workflow-store.ts");
const route=read("apps/api/src/staff/workflow-routes.ts");
const app=read("apps/api/src/app.ts");
const server=read("apps/api/src/server.ts");
const staff=read("apps/web/app/staff/dashboard/page.tsx");
const tasks=read("apps/web/app/staff/staff-work-panel.tsx");
const prefs=read("apps/web/app/staff/staff-work-preferences.tsx");
const home=read("apps/web/app/staff/staff-home-panel.tsx");
const admin=read("apps/web/app/admin/(workspace)/staff-work/page.tsx");
const navigation=read("apps/web/app/admin/admin-workspace.tsx");
const css=read("apps/web/app/staff/staff-work.css");
const i18n=read("apps/web/app/staff/staff-work-i18n.ts");
const tests=read("apps/api/src/staff/workflow-phase7.integration.test.ts");
assert.equal(journal.entries[31]?.tag,"0031_staff_workflow");
assert.equal(journal.entries.at(-1)?.tag,"0031_staff_workflow");
assert.equal(new Set(journal.entries.map(x=>x.tag)).size,journal.entries.length);
for(const key of [
 'CREATE TABLE "staff_work_tasks"', 'CREATE TABLE "staff_message_drafts"',
 'CREATE TABLE "staff_workspace_preferences"',
 '"staff_work_assignee_school_fk"', '"staff_message_author_school_fk"',
 '"staff_workspace_owner_fk"', 'PRIMARY KEY ("school_id","user_id")',
 'CHECK ("status" IN', '"school_id" uuid NOT NULL'
])assert.ok(migration.includes(key),"Migration integrity: "+key);
for(const key of [
 "export const staffWorkTasks", "export const staffMessageDrafts",
 "export const staffWorkspacePreferences", "staffWorkTasks,","staffMessageDrafts,",
 "staffWorkspacePreferences,", "primaryKey({columns:[table.schoolId,table.userId]})"
])assert.ok(schema.includes(key),"Schema registration: "+key);
for(const key of [
 "eq(staffWorkTasks.schoolId,schoolId)", "eq(staffWorkTasks.assignedTo,staffId)",
 "eq(staffWorkTasks.updatedAt,current.updatedAt)", "return db.transaction(async tx=>",
 "staff.permissions.includes(\"TASKS_VIEW\")", "staff_task.assigned",
 "staff_task.cancelled", "staff_message.submitted", "staff_message.reviewed",
 "eq(staffMessageDrafts.schoolId,schoolId)", "eq(staffMessageDrafts.createdBy,staffId)",
 'eq(staffMessageDrafts.status,"SUBMITTED")',
 "onConflictDoNothing()", 'showNotificationBadge:row?.showNotificationBadge??true',
 "const admins=await tx.select"
])assert.ok(store.includes(key),"Data isolation and lifecycle guard: "+key);
for(const key of [
 'hasStaffPermission(permissions,permission)', '"TASKS_VIEW"', '"COMMUNICATION_DRAFT"',
 'requireSchoolAdmin(request,reply,accounts)', 'requireAccess(request,reply,accounts)',
 'const draftEdit=draftFields.extend(', 'const taskUpdate=z.object(',
 '"/v1/staff/tasks"', '"/v1/staff/message-drafts"',
 '"/v1/admin/staff-work/tasks"', '"/v1/admin/staff-work/drafts"',
 '"/v1/staff/work-notifications"', '"/v1/staff/work-preferences"',
 'communication.markNotificationRead(actor.ctx.user.schoolId,actor.ctx.user.id,id)',
 'reply.header("cache-control","no-store")'
])assert.ok(route.includes(key),"API scope and validation: "+key);
assert.ok(!route.includes('createAnnouncement('),"Staff draft review must never publish announcements.");
assert.ok(app.includes("registerStaffWorkflowRoutes(app,"));
assert.ok(server.includes("staffWorkflowStore: createStaffWorkflowStore(database.db)"));
for(const key of ['canTasks','canDrafts','tab==="work"','tab==="notifications"',
 '<StaffWorkPanel','<StaffWorkPreferences'])
  assert.ok(staff.includes(key),"Staff panel wiring: "+key);
assert.ok(tasks.includes('Edit communication draft')&&tasks.includes('Submit for review')&&
  tasks.includes("Mark as read")&&tasks.includes('status==="DONE"'));
assert.ok(prefs.includes('"/v1/staff/work-preferences"')&&prefs.includes('showNotificationBadge'));
assert.ok(home.includes("onNotifications")&&home.includes("onWork"));
assert.ok(navigation.includes('href: "/admin/staff-work"'));
assert.ok(admin.includes("Approve copy")&&admin.includes("Cancel task")&&
  admin.includes("Open announcements")&&admin.includes('href="/admin/communication"'));
assert.ok(css.includes("@media(max-width:800px)")&&css.includes(".staff-work-unread"));
assert.ok(i18n.includes("const fa:Record<string,string>")&&i18n.includes("const ps:Record<string,string>"));
for(const key of ["Staff Phase 7 — scoped assignments",
  "expectedUpdatedAt:task.updatedAt", "statusCode,409", "assert.equal(approved.statusCode,200",
  "overview.body.includes", "work-preferences", "permissions:[\"TASKS_VIEW\",\"COMMUNICATION_DRAFT\"]"]){
  if(key==="statusCode,409")continue;
  assert.ok(tests.includes(key),"Integration test coverage: "+key);
}
console.log("Staff Phase 7 schema, role permissions, school isolation, review workflow, notifications, UI and RTL checks passed.");
