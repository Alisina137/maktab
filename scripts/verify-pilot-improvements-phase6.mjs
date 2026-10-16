import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL("../" + file, import.meta.url),"utf8");
const model = read("apps/web/app/admin/pilot-oversight-triage-model.ts");
const tests = read("apps/web/app/admin/pilot-oversight-triage-model.test.ts");
const ui = read("apps/web/app/admin/pilot-oversight-panel.tsx");
const db = read("packages/database/src/pilot-oversight-store.ts");
const api = read("apps/api/src/pilot/routes.ts");
const css = read("apps/web/app/globals.css");
const locale = read("apps/web/app/admin/admin-i18n.ts");

for (const key of ["parseOversightPage", "parseOversightRelease", "summarizeOversightPage",
  "oversightActionKind", "oversightReviewActions", "Unknown oversight event.",
  "Inconsistent oversight page.", "Unverified production release gate.",
  "MANUAL_RELEASE_ACCEPTANCE_REQUIRED", "productionDecision: \"NO_GO\""])
  assert.ok(model.includes(key), "Oversight safety rule missing: " + key);
for (const key of ["parseOversightPage(value, { window, kind, limit: 15, offset })",
  "parseOversightRelease(value)", "new AbortController()", "controller.abort()",
  "setOffset(0)", "visibleEvents", "pageSummary", "onlyReview",
  "These are page counts, not totals for the reporting period."])
  assert.ok(ui.includes(key), "Oversight interface rule missing: " + key);
assert.ok(ui.includes("PRODUCTION NO-GO"));
assert.ok(ui.includes("Independent Step 20 evidence and operator sign-off are required."));
assert.ok(!ui.includes("approveProduction"));
assert.ok(db.includes("ORDER BY occurred_at DESC, kind ASC, id DESC"));
for (const scope of ["s.school_id = ${schoolId}::uuid",
  "a.school_id = ${schoolId}::uuid", "b.school_id = ${schoolId}::uuid",
  "d.school_id = ${schoolId}::uuid"])
  assert.ok(db.includes(scope), "School boundary missing");
assert.ok(api.includes("oversightQuerySchema.parse(request.query)"));
assert.ok(api.includes("requireSchoolAdmin(request, reply, accounts)"));
assert.ok(css.includes(".pilot-oversight-page-metrics") && css.includes(".pilot-oversight-row-review"));
assert.ok(tests.includes("Phase 6 timeline: forged"));
assert.ok(tests.includes("Phase 6 release: missing external gates"));
const fa=locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps=locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Recorded on this page", "Review recorded event",
  "No notable records on this page. Other pages may contain them."])
  assert.ok(fa?.includes(JSON.stringify(key)+":") && ps?.includes(JSON.stringify(key)+":"),
    "Translation missing: " + key);
console.log("Pilot improvement Phase 6 timeline, release gate, tenancy and locale guards passed.");
