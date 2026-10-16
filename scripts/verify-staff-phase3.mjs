import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const store=read("packages/database/src/account-store.ts");
const api=read("apps/api/src/staff/routes.ts");
const dashboard=read("apps/web/app/staff/dashboard/page.tsx");
const tests=read("apps/api/src/app.test.ts");
const databaseTests=read("packages/database/src/account-store.test.ts");
const css=read("apps/web/app/globals.css");
const locale=read("apps/web/app/admin/admin-i18n.ts");
assert.ok(store.includes("safeStaffSearch?: boolean") &&
 store.includes("!input.safeStaffSearch ? [ilike(phoneExpr, pattern)]") &&
 store.includes("!input.safeStaffSearch ? [") &&
 store.includes('eq(users.schoolId, schoolId)'),
 "Staff lookup must not search by hidden phone or account role/status");
assert.ok(api.includes('status: z.enum(["ALL","ACTIVE","INVITED","SUSPENDED","ARCHIVED"])') &&
 api.includes('sortBy: z.enum(["name","username"])') &&
 api.includes('order: z.enum(["asc","desc"])') &&
 api.includes('safeStaffSearch:true') &&
 api.includes('hasStaffPermission(profile?.permissions, "DIRECTORY_VIEW")') &&
 api.includes('reply.header("cache-control","no-store")') &&
 !api.includes("safeUser(entry.user)") &&
 !api.includes("phone:entry"));
for(const key of ["setStatus","setSortBy","setOrder","setPageSize","setSelected",
 "Clear filters","Read-only school record","aria-expanded={selected?.username===row.username}",
 "Only basic directory fields are available"]) {
 assert.ok(dashboard.includes(key),"Missing staff Phase3 UI: "+key);
}
assert.ok(databaseTests.includes('"0028_staff_profiles_permissions.sql"'),
 "Database directory test fixtures require staff profile migration");
assert.ok(tests.includes("Staff Phase 3: directory filtering, privacy boundaries") &&
 tests.includes("Hidden status strings must never work as staff free-text search") &&
 tests.includes("Staff response must be redacted"));
assert.ok(css.includes(".staff-lookup-button") &&
 css.includes(".staff-record-details") &&
 css.includes(".staff-directory-actions"));
const fa=locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps=locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for(const key of ["Account status","All statuses","Results per page","Clear filters",
 "Read-only school record"]) {
 assert.ok(fa?.includes(JSON.stringify(key)+":") && ps?.includes(JSON.stringify(key)+":"),
 "Missing staff Phase3 translation: "+key);
}
console.log("Staff Phase 3 scoped filters, read-only details, privacy, access and RTL guards passed.");
