import assert from "node:assert/strict";
import test from "node:test";
import {
  parentFeeSummary, parentMoreTabs, parentPasswordValidation,
  sortedParentPayments, visibleParentInvoices
} from "../apps/mobile/src/parent-more-model";
import type { FeeInvoiceViewPayload, FeePaymentPayload } from "../apps/mobile/src/api";

const makeInvoice = (
  id: string, status: FeeInvoiceViewPayload["invoice"]["status"],
  amount: number, paid: number, outstanding: number,
  dueDate = "2026-10-14"
): FeeInvoiceViewPayload => ({
  invoice: {
    id, studentId:"child-1", status, amount, dueDate,
    currency:"AFN", description:"Tuition", issuedAt:"2026-10-01T09:00:00Z"
  },
  studentName:"Child", studentCode:"ST-01",
  paid, outstanding, payments:[]
});

test("fees exclude cancelled and unissued drafts from school-issued ledger totals", () => {
  const rows = [
    makeInvoice("due", "ISSUED", 2000, 0, 2000),
    makeInvoice("partial", "PARTIALLY_PAID", 1000, 400, 600),
    makeInvoice("paid", "PAID", 1500, 1500, 0),
    makeInvoice("cancel", "CANCELLED", 700, 0, 0),
    makeInvoice("draft", "DRAFT", 900, 0, 900)
  ];
  assert.deepEqual(parentFeeSummary(rows), {
    issued: 4500, paid: 1900, outstanding: 2600, dueCount: 2, invoiceCount: 3
  });
  assert.equal(visibleParentInvoices(rows,"ALL").length,4);
  assert.deepEqual(visibleParentInvoices(rows,"DUE").map(row=>row.invoice.id),["due","partial"]);
  assert.deepEqual(visibleParentInvoices(rows,"PAID").map(row=>row.invoice.id),["paid"]);
  assert.deepEqual(visibleParentInvoices(rows,"CANCELLED").map(row=>row.invoice.id),["cancel"]);
  assert.equal(parentFeeSummary([]).outstanding,0);
  assert.deepEqual(parentMoreTabs, ["FEES", "PROFILE", "SCHOOL", "PREFERENCES"]);
});
test("fee rows and reversal entries sort without changing authoritative balances", () => {
  const rows = [
    makeInvoice("later","ISSUED",100,0,100,"2026-10-30"),
    makeInvoice("earlier","ISSUED",100,0,100,"2026-10-01")
  ];
  assert.deepEqual(visibleParentInvoices(rows,"ALL").map(x=>x.invoice.id),["later","earlier"]);
  const payment = (id: string, kind: FeePaymentPayload["kind"], recordedAt: string): FeePaymentPayload => ({
    id, invoiceId:"later", kind, amount:100,
    method:"CASH", transactionReference:null,
    reversalOfPaymentId:kind==="REVERSAL"?"one":null,
    reversalReason:kind==="REVERSAL"?"Duplicate":null, recordedAt
  });
  const first=payment("one","PAYMENT","2026-10-01T12:00:00Z");
  const second=payment("two","REVERSAL","2026-10-04T12:00:00Z");
  assert.deepEqual(sortedParentPayments([first,second]).map(x=>x.id),["two","one"]);
  assert.equal(sortedParentPayments([first,second])[0]?.reversalReason,"Duplicate");
});
test("password fields validate current password, strength, same-as-old and confirmation", () => {
  const v=parentPasswordValidation;
  assert.equal(v("", "Secure123!", "Secure123!"),"CURRENT");
  assert.equal(v("Secure123!", "Secure123!", "Secure123!"),"SAME");
  assert.equal(v("Old123!", "Short1!", "Short1!"),"LENGTH");
  assert.equal(v("Old123!", "123456789!", "123456789!"),"LETTER");
  assert.equal(v("Old123!", "Password!", "Password!"),"NUMBER");
  assert.equal(v("Old123!", "Password1", "Password1"),"SPECIAL");
  assert.equal(v("Old123!", "Password1!", "Password2!"),"CONFIRM");
  assert.equal(v("Old123!", "Password1!", "Password1!"),null);
  assert.equal(v("Old123!", "S1!"+"x".repeat(126), "S1!"+"x".repeat(126)), "LENGTH");
});
