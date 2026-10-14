import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const family = read("packages/database/src/family-store.ts");
const schema = read("packages/database/src/schema.ts");
const migration = read("packages/database/drizzle/0020_pilot_import_history.sql");
const api = read("apps/api/src/families/routes.ts");
const familiesUi = read("apps/web/app/admin/family-panel.tsx");
const pilotUi = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const locale = read("apps/web/app/admin/admin-i18n.ts");
const docs = read("docs/PILOT-OPERATIONS-PHASES.md");
const journal = JSON.parse(read("packages/database/drizzle/meta/_journal.json"));

assert.ok(journal.entries.some((entry) => entry.tag === "0020_pilot_import_history"), "Phase 3 migration must remain in the journal");
assert.ok(schema.includes("familyImportBatches,") && migration.includes("family_import_batches_school_key_unique"),
  "Persistent ledger and unique school+request key required");
assert.ok(migration.includes("fingerprint") && migration.includes("row_count") &&
  !migration.includes("password_hash") && !migration.includes("temporary_password"),
  "Migration must record metadata only, never secrets");
assert.ok(family.includes("await markBatch(tx, schoolId, batch)") &&
  (family.match(/await markBatch\(tx, schoolId, batch\)/g) ?? []).length === 3 &&
  family.includes(".onConflictDoNothing"),
  "All three import entity types must commit idempotency marker atomically");
assert.ok(family.includes("getImportBatch(schoolId") &&
  family.includes("listImportBatches(schoolId") &&
  family.includes("recordImportAttempt(schoolId"),
  "School history and failure summaries missing");
assert.ok(api.includes('"/v1/admin/families/import/history"') &&
  api.includes("requireSchoolAdmin(request, reply, accounts)") &&
  api.includes("importHistoryQuerySchema") && api.includes(".max(50)"),
  "Authenticated bounded import history required");
assert.ok(api.includes("createHash") && api.includes("existing.fingerprint !== fingerprint") &&
  api.includes("idempotencyKey: z.string().uuid().optional()") &&
  api.includes("requiresCredentialReset: true") &&
  api.includes("alreadyCommitted: true") && api.includes("credentials: []"),
  "Replay must not recreate accounts or resend transient passwords");
assert.ok(familiesUi.includes("importIdempotencyKey") &&
  familiesUi.includes("setImportIdempotencyKey(crypto.randomUUID())") &&
  familiesUi.includes("idempotencyKey: key") &&
  familiesUi.includes("result.alreadyCommitted"),
  "Family upload/validate/commit UI must keep retry key and explain replay");
assert.ok(pilotUi.includes("/v1/admin/families/import/history?") &&
  pilotUi.includes("importHistoryRequestVersion.current") &&
  pilotUi.includes("pilot-import-history") &&
  pilotUi.includes("importHistory.hasMore"),
  "Pilot Operations should load school-scoped paginated import history");
assert.ok(docs.includes("Phase 3 — Durable onboarding history (implemented)"),
  "Documentation must describe Phase 3 scope");
const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const key of ["Import history", "No import history found.", "Completed", "Rejected",
  "This import was already completed. No accounts were created again. For missing temporary passwords, reset individual account passwords securely."]) {
  assert.ok(fa?.includes(JSON.stringify(key)+":") && ps?.includes(JSON.stringify(key)+":"),
    "Missing translated key " + key);
}
console.log("Pilot Phase 3 school-scoped batch, idempotency, migration, UI and locale gates passed.");
