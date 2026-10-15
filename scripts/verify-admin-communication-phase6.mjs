import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");
const store=read("packages/database/src/fee-financial-store.ts");
const schema=read("packages/database/src/schema.ts");
const routes=read("apps/api/src/communication/routes.ts");
const contract=read("packages/contracts/src/index.ts");
const csv=read("apps/api/src/communication/fee-report-csv.ts");
const panel=read("apps/web/app/admin/communication-panel.tsx");
const report=read("apps/web/app/admin/admin-fee-financial-reports.tsx");
const css=read("apps/web/app/globals.css");
const translations=read("apps/web/app/admin/admin-i18n.ts");
const packageJson=read("package.json");
const docs=read("docs/ADMIN-COMMUNICATION-FEES-PHASES.md");
const state=read("docs/PROJECT-STATE.md");

for(const marker of ["MAX_REPORT_ROWS = 5000","feeInvoices.status, \"DRAFT\"",
  "feeInvoices.status, \"CANCELLED\"","schoolDate(","daysBetween(",
  "getFeeFinancialReport(schoolId, query)",
  "setFeePaymentReconciliation(schoolId, actorUserId, paymentId, input)",
  "fee_payment.reconciliation_updated","eq(feePayments.schoolId, schoolId)",
  "eq(feePaymentReconciliations.schoolId, schoolId)",
  "Reversed payments cannot be reconciled.","previewBulkFeeInvoices(schoolId, actorUserId, input)",
  "fee_invoice.bulk_previewed","created: false","DUPLICATE_BATCH","EXISTING_INVOICE"]) {
  assert.ok(store.includes(marker),"Missing tenant/report/reconciliation safeguard: "+marker);
}
for(const marker of ["feePaymentReconciliations","paymentId: uuid(\"payment_id\").primaryKey()",
  "CREATE TABLE"]) {
  assert.ok((schema+read("packages/database/drizzle/0024_fee_payment_reconciliation.sql")).includes(marker),
    "Missing independent reconciliation schema: "+marker);
}
for(const marker of ['"/v1/admin/fees/reports"','"/v1/admin/fees/reports/export"',
  '"/v1/admin/fees/invoices/bulk-preview"',
  '"/v1/admin/fees/payments/:paymentId/reconciliation"',
  "requireSchoolAdmin(request, reply, accounts)","feeReconciliationSchema.parse",
  "adminFeeReportQuerySchema.parse","bulkFeePreviewSchema.parse","feeReportCsv("]) {
  assert.ok(routes.includes(marker),"Missing authorized report endpoint: "+marker);
}
assert.ok(contract.includes("adminFeeReportQuerySchema")&&contract.includes("feeReconciliationSchema")&&contract.includes("bulkFeePreviewSchema"));
assert.ok(csv.includes("csvCell")&&csv.includes('replaceAll(\'"\', \'""\')')&&csv.includes('leading.startsWith(prefix)'));
for(const marker of ["AdminFeeFinancialReports","\"REPORTS\"","feesModule === \"REPORTS\""]) assert.ok(panel.includes(marker));
for(const marker of ["generation.current","tokenRef.current","exportCsv","reconcile(","bulkPreview(",
  "window.confirm(","adminApi","Preview only. No invoices are created.",
  "URL.createObjectURL","AdminHijriDatePicker"]) assert.ok(report.includes(marker));
for(const marker of [".admin-financial-reports",".admin-financial-students","@media (max-width: 550px)"]) assert.ok(css.includes(marker));
for(const phrase of ["Financial reports & reconciliation","Reconciliation status updated and audited.",
  "Preview only. No invoices are created. Existing student/date/description matches are flagged for review.",
  "Export transactions CSV","Export outstanding CSV"]) {
  assert.equal(translations.split(JSON.stringify(phrase)+":").length,3,
    "Missing or duplicate translation for Dari/Pashto: "+phrase);
}
assert.ok(packageJson.includes("verify:admin-communication:phase6"));
assert.ok(docs.includes("Phase 6 — Reports and financial operations (implemented)"));
assert.ok(state.includes("Admin Communication & Fees — Phase 6"));
console.log("Phase 6 school-scoped report, CSV safety, immutable reconciliation, preview and RTL guards passed.");
