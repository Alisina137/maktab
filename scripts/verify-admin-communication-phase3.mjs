import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("apps/web/app/admin/communication-panel.tsx");
const store=read("packages/database/src/communication-store.ts");
const schema=read("packages/database/src/schema.ts");
const contract=read("packages/contracts/src/index.ts");
const routes=read("apps/api/src/communication/routes.ts");
const migration=read("packages/database/drizzle/0022_fee_invoice_numbers.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const tests=read("apps/api/src/app.test.ts");
const css=read("apps/web/app/globals.css");
const locale=read("apps/web/app/admin/admin-i18n.ts");
const doc=read("docs/ADMIN-COMMUNICATION-FEES-PHASES.md");
const state=read("docs/PROJECT-STATE.md");
for(const part of [
  'INVOICE_STATUSES','feeListingStatus','feeSearch','feeStatus',
  'feeClassId','feeAcademicYearId','feeStudentId','feePage',
  'invoiceQuery(', 'setFeeListing(result)',
  'accessRef.current !== token || generation !== feeGeneration.current',
  'setFeeListingStatus("error")','setFeeReloadKey(value => value + 1)',
  'feeListing.invoices.map','feeListing.total','feeListing.pageSize',
  'openInvoiceId===item.invoice.id','invoiceReference(item.invoice.invoiceNumber)',
  'editingInvoice?.invoice.id===item.invoice.id',
  'expectedUpdatedAt:new Date(item.invoice.updatedAt).toISOString()',
  'updateDraftInvoice','openDraftEditor(item)',
  'Issue this draft invoice to the family? This action cannot be undone.',
  'Cancel this invoice? This action cannot be undone.'
])assert.ok(panel.includes(part),"Phase 3 UI guard missing "+part);
for(const part of [
  'listAdminFeeInvoices(schoolId, query)',
  'updateDraftFeeInvoice(schoolId, actorUserId, invoiceId, input)',
  'eq(feeInvoices.schoolId, schoolId)',
  'eq(students.schoolId, schoolId)',
  '.limit(pageSize).offset((query.page-1)*pageSize)',
  'eq(students.academicYearId, query.academicYearId)',
  'eq(students.classId, query.classId)',
  'sql<number>`count(*)::integer`',
  'eq(feeInvoices.status,"DRAFT")',
  'original.updatedAt.getTime() !== Date.parse(input.expectedUpdatedAt)',
  'action:"fee_invoice.draft_updated"',
  'feeInvoiceCounters.lastNumber} + 1',
  'invoiceNumber: counter.lastNumber'
])assert.ok(store.includes(part),"Phase 3 DB ledger/tenant/school numbering guard missing "+part);
for(const part of ['"fee_invoice_counters"','invoiceNumber: integer("invoice_number").notNull()',
  'fee_invoices_school_number_unique'])assert.ok(schema.includes(part));
for(const part of ['ROW_NUMBER() OVER (PARTITION BY "school_id"',
  'CREATE UNIQUE INDEX "fee_invoices_school_number_unique"',
  'INSERT INTO "fee_invoice_counters"'])assert.ok(migration.includes(part));
assert.ok(journal.includes('"0022_fee_invoice_numbers"'));
for(const part of ['updateDraftFeeInvoiceSchema','expectedUpdatedAt',
  'adminFeeInvoiceQuerySchema'])assert.ok(contract.includes(part));
for(const part of ['app.get("/v1/admin/fees/invoices"','app.patch<{ Params: { invoiceId: string } }>',
  'communication.listAdminFeeInvoices(context.user.schoolId, query)',
  'communication.updateDraftFeeInvoice(',
  'requireSchoolAdmin(request, reply, accounts)'])assert.ok(routes.includes(part));
for(const part of ['fee_invoice.draft_updated','for(let i=0;i<21;i++)',
  'page=2','status=ISSUED','otherAdmin','parentAuth'])assert.ok(tests.includes(part));
for(const part of ['.communication-invoice-filters',
  '.communication-invoice-expanded','.communication-draft-edit',
  '.communication-invoice-pager'])assert.ok(css.includes(part));
for(const key of ['Search invoices','All academic years','Invoice number','Edit draft invoice',
  'Save draft changes','No matching invoices.','Page {page} of {total}',
  'Issue this draft invoice to the family? This action cannot be undone.'])
 assert.equal(locale.split(JSON.stringify(key)+":").length,3,"Incomplete Dari/Pashto "+key);
assert.ok(doc.includes("## Phase 3 — Fee invoices (implemented)"));
assert.ok(state.includes("Admin Communication & Fees — Phase 3"));
console.log("Admin Communication/Fees Phase 3 numbering, server list, draft locking, schema, RTL & tenant guards passed.");
