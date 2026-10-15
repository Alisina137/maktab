import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, feeReportCsv } from "../apps/api/src/communication/fee-report-csv.js";

test("CSV escapes commas, quotes, newlines and spreadsheet-injection prefixes", () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('hello"world'), '"hello""world"');
  for (const input of ["=SUM(1,2)", "+cmd", "-cmd", "@evil", " \t=SUM(1,2)", "\n@evil"])
    assert.ok(csvCell(input).includes("'"+input),"formula prefix neutralized: "+JSON.stringify(input));
  assert.equal(csvCell("ordinary value"), '"ordinary value"');
});
test("CSV columns preserve chronological payment and reversal row without merging ledger entries", () => {
  const report = {
    asOf:"2026-10-15",schoolTimezone:"Asia/Kabul",from:null,to:null,
    billed:100,paid:0,outstanding:100,overdue:0,
    aging:{notDue:100,days1to30:0,days31to60:0,days61to90:0,daysOver90:0},
    statement:{grossPayments:100,reversals:100,netCollections:0,methods:[]},
    rows:[{
      paymentId:"payment1",invoiceNumber:1,studentCode:"=1+2",studentName:"A, B",
      kind:"PAYMENT" as const,amount:100,method:"CASH",
      recordedAt:new Date("2026-10-15T08:00:00Z"),transactionReference:null,
      recordedBy:"test",reconciliation:"REVERSED" as const
    },{
      paymentId:"reversal1",invoiceNumber:1,studentCode:"=1+2",studentName:"A, B",
      kind:"REVERSAL" as const,amount:100,method:"REVERSAL",
      recordedAt:new Date("2026-10-15T09:00:00Z"),transactionReference:null,
      recordedBy:"test",reconciliation:"NOT_APPLICABLE" as const
    }],
    invoices:[{invoiceNumber:1,studentCode:"=1+2",studentName:"A, B",
      dueDate:"2026-10-30",amount:100,paid:0,outstanding:100,daysOverdue:0}]
  };
  const exported=feeReportCsv(report,"payments");
  assert.ok(exported.includes("payment1")&&exported.includes("reversal1"));
  assert.ok(exported.includes("'=1+2"));
  assert.ok(exported.includes('"A, B"'));
  assert.ok(exported.startsWith("\uFEFF"));
  const outstanding=feeReportCsv(report,"outstanding");
  assert.ok(outstanding.includes("2026-10-30")&&outstanding.includes("'=1+2"));
});
