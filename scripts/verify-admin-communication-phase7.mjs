import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../"+p, import.meta.url), "utf8");
const store = read("packages/database/src/communication-store.ts");
const schema = read("packages/database/src/schema.ts");
const routes = read("apps/api/src/communication/routes.ts");
const migration = read("packages/database/drizzle/0025_notification_push_lease.sql");
const journal = JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
const tests = read("packages/database/src/communication-store.test.ts");
const release = read("docs/ADMIN-COMMUNICATION-FEES-PHASE7-ACCEPTANCE.md");
const state = read("docs/PROJECT-STATE.md");
const workflow = read(".github/workflows/ci.yml");
for(const marker of [
  'pushClaimToken: claimToken', 'pushClaimUntil: claimUntil',
  'lte(notifications.pushClaimUntil, now)',
  'eq(notifications.pushClaimToken, claimToken)',
  'pushClaimToken: null, pushClaimUntil: null',
  'anyFailed ? "FAILED" : anySent ? "SENT"',
  'AbortSignal.timeout(15_000)',
  'eq(feeInvoices.id, candidate.id)',
  '.limit(1).for("update")',
  'const ledger = await tx.select().from(feePayments)',
  'feeReminders += outcome.due + outcome.overdue'
]) assert.ok(store.includes(marker), "Phase 7 worker/payment safety missing: "+marker);
assert.ok(schema.includes('pushClaimToken: uuid("push_claim_token")'));
assert.ok(migration.includes('push_claim_until') && migration.includes('push_claim_token'));
assert.ok(journal.entries.some(item => item.tag === "0025_notification_push_lease"));
assert.ok(routes.includes('"/v1/platform/jobs/communication/run"'));
assert.ok(routes.includes('requireProvisioningKey(request, reply, provisioningKey)'));
for(const marker of ["Overlapping workers must not duplicate provider handoffs",
  "Partial device acceptance", "partialRow?.deliveryStatus"])
  assert.ok(tests.includes(marker), "Missing Phase 7 store regression: "+marker);
assert.ok(release.includes("PRODUCTION NO-GO"));
assert.ok(state.includes("Admin Communication & Fees — Phase 7"));
assert.ok(workflow.includes("verify:admin-communication:phase7"));
console.log("Phase 7 communication and fee concurrency safety gates passed. Manual acceptance remains NO-GO.");
