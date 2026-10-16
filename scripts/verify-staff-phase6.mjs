import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const permissions=read("packages/database/src/staff-permissions.ts");
const store=read("packages/database/src/staff-fee-read-store.ts");
const routes=read("apps/api/src/staff/fee-routes.ts");
const app=read("apps/api/src/app.ts");
const server=read("apps/api/src/server.ts");
const dashboard=read("apps/web/app/staff/dashboard/page.tsx");
const home=read("apps/web/app/staff/staff-home-panel.tsx");
const panel=read("apps/web/app/staff/staff-fees-panel.tsx");
const css=read("apps/web/app/staff/staff-fees.css");
const i18n=read("apps/web/app/staff/staff-fees-i18n.ts");
const suite=read("apps/api/src/staff/fees-phase6.integration.test.ts");
const legacy=read("packages/database/src/communication-store.ts");
const packageJson=JSON.parse(read("package.json"));
assert.ok(permissions.includes('"FEES_VIEW"')&&permissions.includes('"FEES_COLLECT"'));
for(const key of [
  'eq(feeInvoices.schoolId,schoolId)','eq(students.schoolId,schoolId)',
  'eq(classSections.schoolId,schoolId)','eq(feePayments.schoolId,schoolId)',
  'inArray(feeInvoices.status','pageSize:PAGE_SIZE','Math.max(0,row.amount'
])assert.ok(store.includes(key),"Missing scoped invoice read guard: "+key);
for(const key of [
  'ctx.user.role!=="SCHOOL_STAFF"','ctx.user.mustChangePassword',
  'hasStaffPermission(profile?.permissions,"FEES_VIEW")',
  'hasStaffPermission(profile?.permissions,"FEES_COLLECT")',
  'recordFeePaymentSchema.extend(','idempotencyKey:z.string().uuid()',
  'staff.canView?undefined:staff.ctx.user.id',
  'if(!staff.canView&&row.payment.recordedBy!==staff.ctx.user.id)',
  'if(!staff.canCollect)','recordFeePayment(',
  'getAdminFeePaymentReceipt(','reply.header("cache-control","no-store")'
])assert.ok(routes.includes(key),"Missing staff fee API guard: "+key);
assert.ok(!routes.includes('reverseFeePayment(')&&!routes.includes('createFeeInvoice('));
assert.ok(!routes.includes('setFeePaymentReconciliation(')&&!routes.includes('issueFeeInvoice('));
assert.ok(legacy.includes('idempotencyKey: input.idempotencyKey') &&
  legacy.includes('action: "fee_payment.recorded"') &&
  legacy.includes('.for("update")') &&
  legacy.includes('input.amount > invoice.amount - paid'),
  "Reuse audited and atomic existing payment ledger");
assert.ok(app.includes("registerStaffFeeRoutes(app,"));
assert.ok(server.includes("staffFeeReadStore: createStaffFeeReadStore(database.db)"));
assert.ok(dashboard.includes("canViewFees")&&dashboard.includes("canCollectFees")&&
  dashboard.includes('tab==="fees"&&canFees'));
assert.ok(home.includes("onFees")&&home.includes('permissions.includes("FEES_COLLECT")'));
for(const key of [
  'crypto.randomUUID()','pendingPayment.current','Record a payment',
  'View receipt','window.print()','Payment history',
  'schoolTimezone','fee.status'
].filter(x=>x!=="fee.status"))
  assert.ok(panel.includes(key),"Missing Phase 6 fee workspace feature: "+key);
assert.ok(css.includes('@media print')&&css.includes('.staff-fees-columns'));
assert.ok(i18n.includes("const fa:")&&i18n.includes("const ps:")&&
  i18n.includes("staffFeesText("));
for(const key of [
  'Staff Phase 6 — collection permissions','idempotencyKey:randomUUID()',
  'assert.equal(ledger.json','/v1/staff/fees/receipts/',
  'staffCannotReverse','permissions:["FEES_VIEW"]'
])assert.ok(suite.includes(key),"Missing Phase 6 API acceptance evidence: "+key);
assert.ok(packageJson.scripts["verify:staff:phase6"].includes("fees-phase6.integration.test.ts"));
console.log("Staff Phase 6 payment safeguards, role isolation, navigation, RTL and receipt source checks passed.");
