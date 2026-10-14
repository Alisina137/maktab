import test from "node:test";
import assert from "node:assert/strict";
import { announcementDashboard, feeDashboard } from "../apps/web/app/admin/communication-overview-model";

function invoice(id: string, status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED",
  amount: number, paid: number, outstanding: number, studentId: string) {
  return { invoice: { id, studentId, amount, status, dueDate: "2026-10-14" }, paid, outstanding };
}

test("financial dashboard excludes draft and cancelled invoices from issued bill, paid, outstanding and collection rate", () => {
  const actual = feeDashboard([
    invoice("active", "ISSUED", 2000, 0, 2000, "a"),
    invoice("partial", "PARTIALLY_PAID", 1500, 500, 1000, "a"),
    invoice("overdue", "OVERDUE", 1000, 0, 1000, "b"),
    invoice("paid", "PAID", 500, 500, 0, "b"),
    invoice("draft", "DRAFT", 9999, 0, 9999, "c"),
    invoice("cancelled", "CANCELLED", 9999, 0, 0, "d")
  ]);
  assert.equal(actual.totalInvoices,6);
  assert.equal(actual.issuedInvoices,4);
  assert.equal(actual.billed,5000);
  assert.equal(actual.paid,1000);
  assert.equal(actual.outstanding,4000);
  assert.equal(actual.overdue,1000);
  assert.equal(actual.owingStudents,2);
  assert.equal(actual.collectionRate,20);
});

test("empty, all draft, all cancelled or fully settled school does not fabricate collection rate", () => {
  assert.deepEqual(feeDashboard([]), {
    totalInvoices:0,issuedInvoices:0,billed:0,paid:0,outstanding:0,
    overdue:0,collectionRate:null,owingStudents:0
  });
  const drafts=feeDashboard([
    invoice("draft","DRAFT",1200,0,1200,"student"),
    invoice("cancel","CANCELLED",1200,0,0,"student")
  ]);
  assert.equal(drafts.billed,0);
  assert.equal(drafts.paid,0);
  assert.equal(drafts.collectionRate,null);
  assert.equal(feeDashboard([invoice("paid","PAID",100,100,0,"student")]).collectionRate,100);
});

test("announcements count scheduled, published and archived without assuming push delivery", () => {
  const now=new Date("2026-10-14T12:00:00Z");
  const sample=[
    {id:"a",publishAt:"2026-10-14T11:59:00Z",archivedAt:null},
    {id:"b",publishAt:"2026-10-14T12:00:00Z",archivedAt:null},
    {id:"c",publishAt:"2026-10-14T12:01:00Z",archivedAt:null},
    {id:"d",publishAt:"2026-10-14T12:01:00Z",archivedAt:"2026-10-14T11:00:00Z"}
  ];
  assert.deepEqual(announcementDashboard(sample,now),{
    total:4,published:2,scheduled:1,archived:1
  });
});
