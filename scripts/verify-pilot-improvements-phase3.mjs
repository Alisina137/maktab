import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const app = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const plan = read("apps/web/app/admin/pilot-onboarding-import-plan.tsx");
const model = read("apps/web/app/admin/pilot-import-history-model.ts");
const unit = read("apps/web/app/admin/pilot-import-history-model.test.ts");
const api = read("apps/api/src/pilot/routes.ts");
const importApi = read("apps/api/src/families/routes.ts");
const family = read("apps/web/app/admin/family-panel.tsx");
const css = read("apps/web/app/globals.css");
const locale = read("apps/web/app/admin/admin-i18n.ts");

assert.ok(api.includes('STUDENT: "username,studentCode,fullName,parentUsername,academicYear,classCode'));
assert.ok(family.includes('{ key: "username", label: "Username", required: true'));
assert.ok(importApi.includes('"/v1/admin/families/import/history"'));
assert.ok(importApi.includes("requireSchoolAdmin(request, reply, accounts)"));
assert.ok(importApi.includes('reply.header("cache-control", "no-store")'));
assert.ok(importApi.includes('dateFrom: options.dateFrom ? new Date(options.dateFrom + "T00:00:00+04:30")'));
assert.ok(app.includes('const data = await request<unknown>(accessToken,'));
assert.ok(app.includes('parseImportHistoryPage(data, offset, 20)'));
assert.ok(app.includes('setImportHistory(null);'));
assert.ok(app.includes("importPageInsights(importHistory)"));
assert.ok(app.includes("Counts describe this filtered page, not all school imports."));
assert.ok(app.includes('id="pilot-import-templates"'));
assert.ok(app.includes("<PilotOnboardingImportPlan locale={locale} />"));
assert.ok(plan.includes('aria-pressed={entity === value}'));
assert.ok(plan.includes('href="#pilot-import-templates"'));
assert.ok(plan.includes('href="/admin/families"'));
assert.ok(model.includes('obj.hasMore && obj.rows.length !== limit'));
assert.ok(model.includes('importedCount + rejectedCount > rowCount'));
assert.ok(model.includes('requestedOffset') && model.includes('requestedLimit'));
assert.ok(!model.includes('ready: true') && !model.includes('productionDecision: "GO"'));
assert.ok(unit.includes('Phase 3 import history mismatched paging or fake totals fail closed'));
assert.ok(css.includes(".pilot-import-plan-details") && css.includes(".pilot-import-page-insights"));
const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Prepare a safe import", "Required CSV columns", "Import results on this page",
  "Counts describe this filtered page, not all school imports."]) {
  assert.ok(fa?.includes(JSON.stringify(key) + ":") && ps?.includes(JSON.stringify(key) + ":"),
    "Missing localized Phase 3 label: " + key);
}
console.log("Pilot Operations improvements Phase 3 history, template, locale and safety guards passed.");
