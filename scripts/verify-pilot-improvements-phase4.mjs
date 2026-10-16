import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url),"utf8");
const model = read("apps/web/app/admin/pilot-adoption-model.ts");
const tests = read("apps/web/app/admin/pilot-adoption-model.test.ts");
const ui = read("apps/web/app/admin/pilot-adoption-panel.tsx");
const api = read("apps/api/src/pilot/routes.ts");
const database = read("packages/database/src/pilot-adoption-store.ts");
const locale = read("apps/web/app/admin/admin-i18n.ts");
const css = read("apps/web/app/globals.css");
for (const metric of ["homeworkPublished","homeworkSubmissions","attendanceClassDays",
  "attendanceStudentMarks","announcementsPublished"]) {
  assert.ok(model.includes(metric), "Model must require real activity metric: " + metric);
}
for (const token of ["parseAdoptionReport", "adoptionSummary", "Mismatched usage reporting scope.",
  "Contradictory role coverage.", "signedIn > eligible", "activated > eligible",
  "timeZone !== \"Asia/Kabul\""]) {
  assert.ok(model.includes(token), "Fail-closed adoption logic missing: " + token);
}
assert.ok(model.includes("denominator ? Math.round(numerator / denominator * 100) : null"),
  "No eligible population must not display fake 0% or 100%.");
assert.ok(ui.includes("parseAdoptionReport(payload, window)"));
assert.ok(ui.includes('cache: "no-store"'));
assert.ok(ui.includes("new AbortController()"));
assert.ok(ui.includes("return () => abort.abort()"));
assert.ok(ui.includes("setData(null); setBusy(true);"));
assert.ok(ui.includes('aria-pressed={window === item.value}'));
assert.ok(ui.includes("role.activatedPercent === null"));
assert.ok(ui.includes("role.signedInPercent === null"));
assert.ok(ui.includes("summary.followUps.map"));
assert.ok(ui.includes("Recommended adoption follow-ups"));
assert.ok(ui.includes("last login only"), "Last-login caveat must remain visible.");
assert.ok(api.includes('"/v1/admin/pilot/adoption"') &&
  api.includes("requireSchoolAdmin(request, reply, accounts)") &&
  api.includes("pilot.getAdoptionReport(context.user.schoolId, window)"));
assert.ok(database.includes("FROM users u WHERE u.school_id = ${schoolId}::uuid") &&
  database.includes('timeZone: "Asia/Kabul"'));
assert.ok(css.includes(".pilot-adoption-overview-grid") &&
  css.includes(".pilot-adoption-followup"));
assert.ok(tests.includes("Improvement Phase 4: empty cohorts remain unknown"));
assert.ok(tests.includes("Improvement Phase 4: normalized model excludes unexpected private server payloads"));
const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Account adoption overview","Recommended adoption follow-ups",
  "Activation needed","No eligible accounts. Coverage cannot be assessed."]) {
  assert.ok(fa?.includes(JSON.stringify(key) + ":") && ps?.includes(JSON.stringify(key) + ":"),
    "Dari/Pashto translation missing: " + key);
}
console.log("Pilot Operations improvement Phase 4 adoption safety and interface guards passed.");
