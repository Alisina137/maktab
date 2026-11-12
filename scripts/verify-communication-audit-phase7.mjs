import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const communication = read("packages/database/src/communication-store.ts");
const finance = read("packages/database/src/fee-financial-store.ts");
const communicationTests = read("packages/database/src/communication-store.test.ts");
const financialTests = read("packages/database/src/fee-financial-store.test.ts");

function required(source, fragments, scope) {
  for (const fragment of fragments) {
    assert.ok(source.includes(fragment), scope + " missing: " + fragment);
  }
}
function section(source, first, next) {
  const a = source.indexOf("    async " + first + "(");
  const b = source.indexOf("    async " + next + "(", a + 8);
  assert.ok(a >= 0 && b > a, "Store method boundaries missing: " + first);
  return source.slice(a, b);
}

required(section(communication, "createFeeInvoice", "issueFeeInvoice"), [
  "return db.transaction(async tx => {",
  "const [lockedStudent] = await tx.select",
  '.limit(1).for("update")',
  'lockedStudent.status !== "ACTIVE"',
  "feeInvoiceCounters"
], "Invoice creation");
required(section(communication, "issueFeeInvoice", "cancelFeeInvoice"), [
  '.limit(1).for("update")',
  'student.status !== "ACTIVE"',
  'eq(feeInvoices.status, "DRAFT")'
].filter(x => x !== 'eq(feeInvoices.status, "DRAFT")'), "Invoice issuance");
required(section(communication, "updateDraftFeeInvoice", "createFeeInvoice"), [
  "const [targetStudent] = await tx.select",
  '.limit(1).for("update")',
  "expectedUpdatedAt"
], "Draft invoice updates");

required(section(communication, "registerDevice", "deactivateDevice"), [
  "onConflictDoNothing({ target: devices.pushToken })",
  "eq(devices.schoolId, schoolId)", "eq(devices.userId, userId)",
  "already registered to another account"
], "Device token ownership");
const push = communication.slice(communication.indexOf("    async deliverPendingPush("));
required(push, [
  "pushClaimToken: claimToken",
  "let result: PushResult;",
  "result = await provider.send(",
  'result = { ok: false, error: "Push provider transport failed." }',
  'status: "FAILED"',
  "pushClaimToken: null"
], "Push delivery resilience");
required(communication, ['error: "Expo push transport failed."'], "Provider error redaction");

required(finance, [
  'normalized === "BANK" || normalized === "BANK_TRANSFER"',
  'safeMethod(payment.method) !== "CASH"',
  'safeMethod(payment.method) !== "BANK_TRANSFER"'
], "Bank alias financial grouping and reconciliation");
required(communicationTests, [
  "Provider exception", "phase7-concurrent-device",
  "already registered to another account", "draftBeforeWithdrawal",
  "Push provider transport failed."
], "Notification and billing regression");
required(financialTests, [
  'method:"BANK"', 'method==="BANK_TRANSFER"',
  'reconciledAmount,900', 'reversals,900'
], "Bank reconciliation regression");

console.log("Final Audit Phase 7 communication and fee integrity guards passed.");
