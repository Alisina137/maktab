import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createAccountStore, createAcademicStore, createCommunicationStore,
  createFamilyStore, createSchoolStore, databaseSchema, type FoundationDatabase
} from "./index.js";

async function setup() {
  const client = new PGlite();
  const migrations = [
    "0000_phase1_foundation.sql","0001_phase2_auth_accounts.sql",
    "0002_phase3_academic_structure.sql","0003_phase4_student_family.sql",
    "0004_phase4_parent_profile_backfill.sql","0005_phase5_attendance.sql",
    "0006_phase6_learning.sql","0007_phase7_communication_fees.sql",
    "0008_phase8_pilot_readiness.sql","0009_school_image.sql",
    "0014_student_phone.sql","0019_fee_payment_idempotency.sql",
    "0022_fee_invoice_numbers.sql","0023_notification_scheduler_health.sql",
    "0024_fee_payment_reconciliation.sql", "0025_notification_push_lease.sql"
  ];
  for (const file of migrations) {
    const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    await client.exec(sql.replaceAll("--> statement-breakpoint",""));
  }
  const db = drizzle(client, {schema:databaseSchema}) as unknown as FoundationDatabase;
  return {client,db};
}

test("Phase 6: issued invoices, append-only collections, aging, reconciliation, duplicate preview and tenant safety",async(t)=>{
  const {client,db}=await setup(); t.after(async()=>client.close());
  const schools=createSchoolStore(db);
  const accounts=createAccountStore(db);
  const academics=createAcademicStore(db);
  const families=createFamilyStore(db);
  const fees=createCommunicationStore(db);

  const schoolA=(await schools.createSchool({
    code:"REPORT-A",name:"Report A",slug:"report-a",province:"Kabul",city:"Kabul",defaultLanguage:"en"
  })).school.id;
  const schoolB=(await schools.createSchool({
    code:"REPORT-B",name:"Report B",slug:"report-b",province:"Herat",city:"Herat",defaultLanguage:"en"
  })).school.id;
  const adminA=await accounts.createUser({schoolId:schoolA,username:"report.admin",passwordHash:"hash",role:"SCHOOL_ADMIN"});
  const adminB=await accounts.createUser({schoolId:schoolB,username:"report.admin",passwordHash:"hash",role:"SCHOOL_ADMIN"});
  const parent=await families.createParentAccount(schoolA,{
    username:"report.parent",passwordHash:"hash",fullName:"Parent"
  });
  const year=await academics.createAcademicYear(schoolA,{name:"1405",startDate:"2026-03-21",endDate:"2027-03-20"});
  await academics.setAcademicYearStatus(schoolA,year.id,"ACTIVE");
  const grade=await academics.createGradeLevel(schoolA,{code:"G5",name:"Grade Five",sortOrder:5});
  const room=await academics.createClassSection(schoolA,{
    academicYearId:year.id,gradeLevelId:grade.id,code:"5A",name:"5 A"
  });
  const student=await families.createStudent(schoolA,{
    parentUserId:parent.user.id,studentCode:"FIN-001",fullName:"Report Student",
    academicYearId:year.id,classId:room.id
  });
  const dueDate="2026-10-08";
  const issued=await fees.createFeeInvoice(schoolA,adminA.id,{
    studentId:student.id,amount:1500,dueDate,description:"October"
  });
  await fees.issueFeeInvoice(schoolA,issued.id,adminA.id);
  const draft=await fees.createFeeInvoice(schoolA,adminA.id,{
    studentId:student.id,amount:700,dueDate:"2090-01-01",description:"Draft only"
  });
  assert.equal(draft.status,"DRAFT");
  const paid=await fees.recordFeePayment(schoolA,adminA.id,issued.id,{
    amount:500,method:"CASH",transactionReference:"CASH-001"
  });
  const originalPayment=paid.payments.find(x=>x.kind==="PAYMENT")!;
  assert.ok(originalPayment);
  const report=await fees.getFeeFinancialReport(schoolA,{});
  assert.equal(report.billed,1500);
  assert.equal(report.paid,500);
  assert.equal(report.outstanding,1000);
  assert.equal(report.statement.grossPayments,500);
  assert.equal(report.statement.reversals,0);
  assert.equal(report.statement.methods.find(x=>x.method==="CASH")?.pendingAmount,500);
  assert.equal(report.rows[0]?.reconciliation,"PENDING");
  assert.equal(report.invoices.length,1);
  assert.equal((await fees.getFeeFinancialReport(schoolB,{})).billed,0);

  const marked=await fees.setFeePaymentReconciliation(schoolA,adminA.id,originalPayment.id,{
    status:"RECONCILED",reference:"CASH-REGISTER-01"
  });
  assert.equal(marked.status,"RECONCILED");
  let snapshot=await fees.getFeeFinancialReport(schoolA,{});
  assert.equal(snapshot.rows[0]?.reconciliation,"RECONCILED");
  assert.equal(snapshot.statement.methods.find(x=>x.method==="CASH")?.reconciledAmount,500);
  await assert.rejects(fees.setFeePaymentReconciliation(schoolB,adminB.id,originalPayment.id,{
    status:"RECONCILED"
  }),/not found/i);
  const preview=await fees.previewBulkFeeInvoices(schoolA,adminA.id,{
    invoices:[
      {studentId:student.id,amount:1500,dueDate,description:"October"},
      {studentId:student.id,amount:1500,dueDate,description:"October"},
      {studentId:student.id,amount:800,dueDate:"2026-11-08",description:"November"}
    ]
  });
  assert.equal(preview.created,false);
  assert.equal(preview.total,3);
  assert.equal(preview.ready,1);
  assert.equal(preview.duplicates,2);
  assert.equal(preview.rows[0]?.status,"EXISTING_INVOICE");
  assert.equal(preview.rows[1]?.status,"DUPLICATE_BATCH");
  const afterPreview=await fees.getAdminOverview(schoolA);
  assert.equal(afterPreview.invoices.length,2,"preview must never create an invoice");

  await fees.reverseFeePayment(schoolA,adminA.id,originalPayment.id,{reason:"Cash drawer correction"});
  snapshot=await fees.getFeeFinancialReport(schoolA,{});
  assert.equal(snapshot.paid,0);
  assert.equal(snapshot.outstanding,1500);
  assert.equal(snapshot.statement.netCollections,0);
  assert.equal(snapshot.statement.reversals,500);
  assert.equal(snapshot.rows.find(x=>x.paymentId===originalPayment.id)?.reconciliation,"REVERSED");
  await assert.rejects(fees.setFeePaymentReconciliation(schoolA,adminA.id,originalPayment.id,{
    status:"RECONCILED"
  }),/Reversed payments/i);
});
