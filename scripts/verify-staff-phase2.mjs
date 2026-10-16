import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const dashboard=read("apps/web/app/staff/dashboard/page.tsx");
const home=read("apps/web/app/staff/staff-home-panel.tsx");
const api=read("apps/api/src/staff/routes.ts");
const css=read("apps/web/app/globals.css");
const locale=read("apps/web/app/admin/admin-i18n.ts");
assert.ok(dashboard.includes('useState<"home"|"directory"|"registration"|"attendance"|"settings">("home")') &&
 dashboard.includes("staff-workspace-nav") &&
 dashboard.includes('aria-pressed={tab===item.id}') &&
 dashboard.includes('tab==="home"') &&
 dashboard.includes('tab==="directory"') &&
 dashboard.includes('tab==="settings"') &&
 dashboard.includes("canDirectory") &&
 dashboard.includes("<StaffHomePanel"));
assert.ok(home.includes('permissions.includes("DIRECTORY_VIEW")') &&
 home.includes("Coming in a later phase") &&
 home.includes("A granted permission is not an active module") &&
 !home.includes('method:"POST"'));
assert.ok(api.includes('"/v1/staff/me"') &&
 api.includes('context.user.role !== "SCHOOL_STAFF"'));
assert.ok(css.includes(".staff-workspace-nav") &&
 css.includes(".staff-home-cards") &&
 css.includes(".staff-settings-layout") &&
 css.includes("@media(max-width:620px)"));
const fa=locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps=locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for(const key of ["Staff Home","My daily workspace","Quick actions","Assigned responsibilities",
  "Profile & Settings","Coming in a later phase"]) {
 assert.ok(fa?.includes(JSON.stringify(key)+":") && ps?.includes(JSON.stringify(key)+":"),
 "Missing staff Phase2 translation: "+key);
}
console.log("Staff Phase 2 role-aware Home, navigation, profile, RTL and future module isolation passed.");
