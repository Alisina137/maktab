import test from "node:test";
import assert from "node:assert/strict";
import {
  invoiceQuery, invoiceReference, INVOICE_STATUSES
} from "../apps/web/app/admin/communication-invoices-model";

test("school-local numeric invoice number formats consistently and does not recycle on display",()=>{
  assert.equal(invoiceReference(1),"INV-000001");
  assert.equal(invoiceReference(42),"INV-000042");
  assert.equal(invoiceReference(1000000),"INV-1000000");
  assert.throws(()=>invoiceReference(0));
  assert.throws(()=>invoiceReference(1.25));
  assert.throws(()=>invoiceReference(Number.NaN));
});

test("invoice query preserves safe filter keys and page during server search",()=>{
  const result=invoiceQuery({q:" Student A & Fee ",status:"PARTIALLY_PAID",page:2,
    classId:"class-A",academicYearId:"year-B",studentId:"student-C"});
  const p=new URLSearchParams(result);
  assert.equal(p.get("q"),"Student A & Fee");
  assert.equal(p.get("status"),"PARTIALLY_PAID");
  assert.equal(p.get("page"),"2");
  assert.equal(p.get("classId"),"class-A");
  assert.equal(p.get("academicYearId"),"year-B");
  assert.equal(p.get("studentId"),"student-C");
  assert.equal(new URLSearchParams(invoiceQuery({q:"",status:"ALL",
    page:1,classId:"",academicYearId:"",studentId:""})).has("studentId"),false);
  assert.ok(INVOICE_STATUSES.includes("CANCELLED"));
});
