import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0028_staff_profiles_permissions.sql");
const journal=JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
const model=read("packages/database/src/staff-permissions.ts");
const store=read("packages/database/src/account-store.ts");
const api=read("apps/api/src/staff/routes.ts");
const staffUI=read("apps/web/app/staff/dashboard/page.tsx");
const adminUI=read("apps/web/app/admin/admin-staff-profile-editor.tsx");
const drawer=read("apps/web/app/admin/admin-account-details-drawer.tsx");
const tests=read("apps/api/src/app.test.ts");
const css=read("apps/web/app/globals.css");
const i18n=read("apps/web/app/admin/admin-i18n.ts");
assert.equal(journal.entries.at(-1)?.tag,"0028_staff_profiles_permissions");
assert.ok(schema.includes("export const staffProfiles = pgTable"));
assert.ok(schema.includes('name: "staff_profiles_user_school_fk"'));
assert.ok(migration.includes("FOREIGN KEY (\"school_id\",\"user_id\")"));
assert.ok(model.includes("normalizeStaffPermissions") && model.includes("hasStaffPermission"));
assert.ok(store.includes("upsertStaffProfile(schoolId, userId") &&
  store.includes('action: "staff.profile_updated"') &&
  store.includes("tx.update(authSessions)") &&
  store.includes('eq(users.role, "SCHOOL_STAFF")'));
assert.ok(api.includes('"/v1/admin/staff/:userId/profile"') &&
  api.includes('requireSchoolAdmin(request, reply, accounts)') &&
  api.includes('"/v1/staff/directory"') &&
  api.includes('hasStaffPermission(profile?.permissions, "DIRECTORY_VIEW")') &&
  api.includes('permission_denied') &&
  !api.includes('context.user.role === "SCHOOL_ADMIN" ||'));
assert.ok(adminUI.includes('type="checkbox"') &&
  adminUI.includes('method:"PUT"') && drawer.includes("<AdminStaffProfileEditor"));
assert.ok(staffUI.includes("canDirectory") && staffUI.includes("Directory access not assigned"));
assert.ok(css.includes(".staff-permissions-fieldset"));
assert.ok(tests.includes("Staff Phase 1: job profiles are school-scoped") &&
  tests.includes('"0028_staff_profiles_permissions.sql"') &&
  tests.includes("session-revoking"));
const fa=i18n.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps=i18n.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Staff position & permissions", "Department","Assigned permissions",
  "Directory access not assigned"]) {
  assert.ok(fa?.includes(JSON.stringify(key)+":") &&
    ps?.includes(JSON.stringify(key)+":"), "Missing Dari/Pashto staff copy: "+key);
}
console.log("Staff Phase 1 database schema, role security, profile editor and school scope guards passed.");
