import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const api=read("apps/api/src/staff/routes.ts");
const register=read("apps/api/src/app.ts");
const login=read("apps/web/app/staff/page.tsx");
const dashboard=read("apps/web/app/staff/dashboard/page.tsx");
const staffSession=read("apps/web/app/staff/staff-client.ts");
const admin=read("apps/web/app/admin/admin-client.ts");
const contracts=read("packages/contracts/src/index.ts");
const users=read("apps/api/src/users/routes.ts");
const tests=read("apps/api/src/app.test.ts");
const styles=read("apps/web/app/globals.css");
const locale=read("apps/web/app/admin/admin-i18n.ts");

for(const p of ["/v1/staff/me","/v1/staff/directory"]){
  assert.ok(api.includes('"'+p+'"'),"Staff endpoint missing "+p);
}
assert.ok(register.includes("registerStaffRoutes(app, options.accountStore, options.registrationStore)"));
assert.ok(api.includes('context.user.role !== "SCHOOL_STAFF"') &&
  api.includes("context.user.mustChangePassword") &&
  api.includes("requireAccess(request, reply, accounts)") &&
  api.includes("context.user.schoolId") &&
  api.includes('group: z.enum(["STUDENT", "PARENT", "TEACHER"])'));
assert.ok(!api.includes("safeUser(entry.user)") && !api.includes("passwordHash:entry") &&
  !api.includes("phone:entry") && !api.includes("email:entry"),
  "Staff API must not return full users or private contacts.");
assert.ok(api.includes("fullName:entry.profile.fullName") &&
  api.includes("username:entry.user.username") &&
  api.includes("status:entry.user.status"));
assert.ok(login.includes('expectedRole:"SCHOOL_STAFF"') &&
  login.includes("/v1/auth/change-temporary-password") &&
  login.includes('router.replace("/staff/dashboard")'));
assert.ok(dashboard.includes('"/v1/staff/me"') &&
  dashboard.includes('"/v1/staff/directory?"') &&
  dashboard.includes('"/v1/auth/change-password"') &&
  dashboard.includes('"/v1/auth/logout"') &&
  dashboard.includes('"/v1/auth/refresh"') &&
  !dashboard.includes('"/v1/admin/users"'));
assert.ok(staffSession.includes('maktablink.staff.session.v1') &&
  staffSession.includes('value.session.user.role!=="SCHOOL_STAFF"'));
assert.ok(admin.includes('session.session.user?.role !== "SCHOOL_ADMIN"') &&
  admin.includes('value.session.user.role !== "SCHOOL_ADMIN"'));
assert.ok(contracts.includes('mobileRoleSchema = z.enum(["TEACHER", "PARENT", "STUDENT"])'),
  "Staff must not be added to mobile role selector.");
assert.ok(users.includes('if (context.user.role !== "SCHOOL_ADMIN")'),
  "Staff must not inherit admin account privileges.");
assert.ok(tests.includes("Standalone web staff role: first-login setup") &&
  tests.includes("cannotSeeOtherSchool") &&
  tests.includes("nowForbidden") &&
  tests.includes("illegalRole"));
assert.ok(styles.includes(".staff-workspace-grid") &&
  styles.includes(".staff-search") &&
  styles.includes("@media(max-width:620px)"));
const fa=locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps=locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for(const label of ["School Staff Portal","Staff sign in","School directory lookup",
  "My staff account", "Daily staff work"]){
  assert.ok(fa?.includes(JSON.stringify(label)+":") && ps?.includes(JSON.stringify(label)+":"),
    "Missing staff Dari/Pashto localization: "+label);
}
console.log("Standalone web staff login, scoped directory, admin separation, RTL and test guards passed.");
