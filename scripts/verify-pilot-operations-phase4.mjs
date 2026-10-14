import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (name) => readFileSync(new URL("../"+name, import.meta.url), "utf8");
const schema = read("packages/database/src/schema.ts");
const account = read("packages/database/src/account-store.ts");
const safety = read("packages/database/src/audit-safe.ts");
const pilot = read("packages/database/src/pilot-store.ts");
const api = read("apps/api/src/pilot/routes.ts");
const page = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const css = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const tests = read("apps/api/src/app.test.ts");
assert.ok(schema.includes("export const auditLogs"), "Existing audit ledger must be preserved");
assert.ok(account.includes("listPilotAuditEvents(schoolId") && account.includes("eq(auditLogs.schoolId, schoolId)"),
  "All audit queries must be bound to current school");
assert.ok(account.includes("safeAuditMetadata(row.metadata)") &&
  account.includes("categorizeAuditAction(row.action)") &&
  account.includes("actorUsername: auditActor.username") &&
  account.includes("targetUsername: affectedUser.username"), "Safe labels/metadata must originate on server");
assert.ok(account.includes("orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))") &&
  account.includes("limit(bounded + 1).offset(offset)"), "Audit search requires bounded paging");
assert.ok(safety.includes('const allowed = ["reason", "role", "status", "bulk", "count"') &&
  !safety.includes('const allowed = ["password"'), "Audit metadata must use an explicit allowlist");
assert.ok(pilot.includes('const EXPORT_ROW_CAP = 1500') &&
  pilot.includes('const EXPORT_BYTE_CAP = 5 * 1024 * 1024') &&
  pilot.includes("PilotExportLimitError") &&
  pilot.includes("Buffer.byteLength") &&
  pilot.includes("auditRows.map(row => ({ ...row, metadata: safeAuditMetadata(row.metadata) }))"),
  "Core export must reject oversize files and redact raw metadata");
for(const key of ["passwordHash", "accessToken", "verificationCode", "transactionReference", "supportNotes"]) {
  assert.ok(pilot.includes('"'+key+'"'), "Export must redact private property "+key);
}
assert.ok(api.includes('"/v1/admin/pilot/audit"') &&
  api.includes('"/v1/admin/pilot/audit/export"') &&
  api.includes("requireSchoolAdmin(request, reply, accounts)") &&
  api.includes("auditQuerySchema") && api.includes("auditDateSchema") &&
  api.includes(".max(100)") && api.includes(".max(100_000)"), "School audit read/filter contract missing");
assert.ok(api.includes('action: "pilot.exported"') &&
  api.includes('action: "pilot.audit_exported"') &&
  api.includes("await accounts.writeAudit({") &&
  api.includes("csvSafeCell") &&
  api.includes("reply.header(\"cache-control\", \"no-store\")"),
  "Every export must be audited, bounded and never cached");
assert.ok(api.includes("if (page.hasMore || page.logs.length > 500)") &&
  api.includes("PilotExportLimitError") &&
  api.includes("reply.code(413)"), "Explicit 413 required to prevent truncation");
assert.ok(page.includes("AdminHijriDatePicker") &&
  page.includes("pilot-audit-filters") &&
  page.includes("pilot-audit-drawer") &&
  page.includes('"/v1/admin/pilot/audit?"') &&
  page.includes("/v1/admin/pilot/audit/export?") &&
  page.includes('window.confirm(t("This export contains sensitive school records.') &&
  page.includes("setSelectedAudit(null)"),
  "Audit UI needs filters, accessible details and export confirmation");
assert.ok(css.includes(".pilot-audit-form") && css.includes(".pilot-audit-drawer") &&
  css.includes("[dir=\"rtl\"] .pilot-audit-drawer-overlay"), "Pilot audit RTL/mobile styles missing");
assert.ok(tests.includes("Pilot Phase 4 filters, exports and safe metadata stay school scoped"),
  "Role/tenant/redaction/PGlite regressions must be present");
const fa=i18n.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps=i18n.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for(const key of ["Audit filters", "All categories", "Activity details",
  "Export filtered audit CSV", "Apply filters", "Close"]) {
  assert.ok(fa?.includes(JSON.stringify(key)+":") && ps?.includes(JSON.stringify(key)+":"),
    "Missing Dari/Pashto audit label "+key);
}
console.log("Pilot Operations Phase 4 audit/export school-scope, security and RTL guards passed.");
