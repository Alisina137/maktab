import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("apps/web/app/admin/communication-panel.tsx");
const operations=read("apps/web/app/admin/admin-fee-operations.tsx");
const store=read("packages/database/src/communication-store.ts");
const routes=read("apps/api/src/communication/routes.ts");
const contract=read("packages/contracts/src/index.ts");
const tests=read("apps/api/src/app.test.ts");
const css=read("apps/web/app/globals.css");
const locale=read("apps/web/app/admin/admin-i18n.ts");
const roadmap=read("docs/ADMIN-COMMUNICATION-FEES-PHASES.md");
const state=read("docs/PROJECT-STATE.md");
for(const marker of [
  'feesModule', '"INVOICES" | "PAYMENTS" | "BALANCES"',
  'mode={feesModule}', 'AdminFeeOperations',
  'AdminFeeReceiptButton', 'feeReloadKey',
  '<select', '<option value="CASH">', '<option value="BANK_TRANSFER">',
  '<option value="MOBILE_MONEY">', '<option value="OTHER">',
  'Number.isSafeInteger(amount)', 'amount > outstanding',
  'window.confirm(', 'idempotencyKey',
  'recordPayment(item.invoice.id, item.outstanding',
  'paymentAttempts.current[invoiceId]',
  'refreshInvoiceViews()'
]) assert.ok(panel.includes(marker),"Phase 4 payment safety / tabs missing: "+marker);
for(const marker of [
  '/v1/admin/fees/payments?', '/v1/admin/fees/students/',
  '/v1/admin/fees/payments/', '/receipt', 'schoolTimezone',
  'recordedByUsername', 'kind', 'method', 'studentId',
  'from', 'to', 'page', 'Print / Save as PDF', 'window.print()',
  'receipt.reversed', 'REVERSED — NOT A VALID PAYMENT',
  'currentOutstanding', 'generation.current', 'tokenRef.current',
  'invoiceReference(row.invoice.invoiceNumber)'
]) assert.ok(operations.includes(marker),"Phase 4 ledger/receipt UI missing: "+marker);
for(const marker of [
  'listAdminFeePayments(schoolId, query)',
  'getAdminFeePaymentReceipt(schoolId, paymentId)',
  'getAdminStudentFeeBalance(schoolId, studentId)',
  'eq(feePayments.schoolId, schoolId)',
  'eq(feeInvoices.schoolId, schoolId)',
  'eq(students.schoolId, schoolId)',
  'eq(users.schoolId, schoolId)',
  'AT TIME ZONE', 'query.from', 'query.to',
  'eq(feePayments.kind, "PAYMENT")',
  'reversalOfPaymentId', 'currentOutstanding',
  'ne(feeInvoices.status, "DRAFT")', 'ne(feeInvoices.status, "CANCELLED")',
  'invoiceView', 'paymentTotals', 'recordedByUsername'
]) assert.ok(store.includes(marker),"Phase 4 immutable tenant ledger invariant missing: "+marker);
for(const marker of [
  '"/v1/admin/fees/payments"', '"/v1/admin/fees/payments/:paymentId/receipt"',
  '"/v1/admin/fees/students/:studentId/balance"',
  'adminFeePaymentsQuerySchema.parse(request.query)',
  'requireSchoolAdmin(request, reply, accounts)'
]) assert.ok(routes.includes(marker),"Phase 4 auth/API invariant missing: "+marker);
assert.ok(contract.includes('adminFeePaymentsQuerySchema') &&
  contract.includes('refine(value => !value.from || !value.to || value.from <= value.to'),
  "Payment filter contracts must enforce valid school-local date windows");
for(const marker of [
  'Admin Fees Phase 4 records and reverses immutable payments',
  'schoolId=await provisionSchool', 'kind=REVERSAL',
  'receipt.reversed,false', 'receipt.reversed,true',
  'financial.billed,1200', 'newBalance.outstanding,1000',
  'statusCode,403'
]) assert.ok(tests.includes(marker),"Phase 4 authorization/ledger integration regression missing: "+marker);
for(const marker of [
  '.admin-fee-module-tabs', '.admin-fee-operations', '.admin-fee-filters',
  '.admin-fee-receipt', '.admin-fee-reversed', '@media print',
  'body:has(.admin-fee-receipt-overlay)'
]) assert.ok(css.includes(marker),"Phase 4 RTL/print layout missing: "+marker);
for(const key of [
  "Payment history","Student balances","View receipt","Payment receipt",
  "Print / Save as PDF","REVERSED — NOT A VALID PAYMENT",
  "Record {amount} for {student} ({invoice}) using {method}? Remaining after payment: {remaining}. This records an immutable transaction.",
  "Payment amount must be a whole AFN value within the outstanding balance.",
  "Cash","Bank transfer","Mobile money","Other",
  "No matching payment transactions.","Select a student to review their financial balance."
]) assert.equal(locale.split(JSON.stringify(key)+":").length,3,
  "Missing or duplicate Dari/Pashto translation: "+key);
assert.ok(roadmap.includes("## Phase 4 — Payments and student balances (implemented)"));
assert.ok(state.includes("Admin Communication & Fees — Phase 4"));
console.log("Admin Communication/Fees Phase 4 immutable ledger, auth, confirmation, localized receipt/print and student balances source checks passed.");
