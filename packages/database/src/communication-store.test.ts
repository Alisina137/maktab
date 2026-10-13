import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createAcademicStore,
  createAccountStore,
  createCommunicationStore,
  createFamilyStore,
  createSchoolStore,
  databaseSchema,
  type FoundationDatabase,
  type PushProvider
} from "./index.js";

async function createPhase7Database() {
  const client = new PGlite();
  for (const file of [
    "0000_phase1_foundation.sql",
    "0001_phase2_auth_accounts.sql",
    "0002_phase3_academic_structure.sql",
    "0003_phase4_student_family.sql",
    "0004_phase4_parent_profile_backfill.sql",
    "0005_phase5_attendance.sql",
    "0006_phase6_learning.sql",
    "0007_phase7_communication_fees.sql",
    "0008_phase8_pilot_readiness.sql",
    "0009_school_image.sql",
    "0014_student_phone.sql",
    "0019_fee_payment_idempotency.sql"
  ]) {
    const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    await client.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }
  const db = drizzle(client, { schema: databaseSchema }) as unknown as FoundationDatabase;
  return { client, db };
}

test("Phase 7 reminder jobs are idempotent and push failure does not roll back school data", async (t) => {
  const { client, db } = await createPhase7Database();
  t.after(async () => client.close());

  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const academics = createAcademicStore(db);
  const families = createFamilyStore(db);
  const communication = createCommunicationStore(db);

  const school = await schools.createSchool({
    code: "COMM-JOB",
    name: "Communication Job School",
    slug: "communication-job-school",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });
  const schoolId = school.school.id;

  const admin = await accounts.createUser({
    schoolId,
    username: "comm.admin",
    passwordHash: "hash",
    role: "SCHOOL_ADMIN"
  });
  const parent = await families.createParentAccount(schoolId, {
    username: "comm.parent",
    passwordHash: "hash",
    fullName: "Communication Parent"
  });

  const year = await academics.createAcademicYear(schoolId, {
    name: "1405",
    startDate: "2026-03-21",
    endDate: "2027-03-20"
  });
  await academics.setAcademicYearStatus(schoolId, year.id, "ACTIVE");
  const grade = await academics.createGradeLevel(schoolId, {
    code: "G6",
    name: "Grade 6",
    sortOrder: 6
  });
  const classSection = await academics.createClassSection(schoolId, {
    academicYearId: year.id,
    gradeLevelId: grade.id,
    code: "6A",
    name: "Grade 6 A"
  });
  const student = await families.createStudent(schoolId, {
    parentUserId: parent.user.id,
    studentCode: "COMM-001",
    fullName: "Communication Student",
    academicYearId: year.id,
    classId: classSection.id
  });

  const invoice = await communication.createFeeInvoice(schoolId, admin.id, {
    studentId: student.id,
    amount: 1200,
    dueDate: "2026-10-08",
    description: "October tuition"
  });
  await communication.issueFeeInvoice(schoolId, invoice.id);
  await communication.updateFeeReminderDays(schoolId, [7, 1]);

  const first = await communication.runScheduledNotifications(new Date("2026-10-01T06:00:00Z"));
  const second = await communication.runScheduledNotifications(new Date("2026-10-01T06:00:00Z"));
  assert.equal(first.feeReminders, 1);
  assert.equal(second.feeReminders, 0);

  const afterReminder = await communication.getUserNotifications(schoolId, parent.user.id);
  assert.equal(afterReminder.filter((item) => item.type === "FEE_DUE").length, 1);

  const announcement = await communication.createAnnouncement(schoolId, admin.id, {
    title: "School update",
    content: "A push outage must not remove this announcement.",
    audienceScope: "ROLE",
    audienceRole: "PARENT"
  });
  await communication.registerDevice(schoolId, parent.user.id, "ExponentPushToken[test-phase7]", "ANDROID");

  const failingProvider: PushProvider = {
    async send() {
      return { ok: false, error: "provider offline" };
    }
  };
  const delivery = await communication.deliverPendingPush(failingProvider);
  assert.ok(delivery.failed >= 1);

  const visibleAnnouncements = await communication.getAnnouncementsForUser(schoolId, parent.user.id, "PARENT");
  assert.ok(visibleAnnouncements.some((item) => item.id === announcement.id));

  const visibleFees = await communication.getParentFees(schoolId, parent.user.id, student.id);
  assert.equal(visibleFees[0]?.invoice.id, invoice.id);
  assert.equal(visibleFees[0]?.outstanding, 1200);

  const afterFailure = await communication.getUserNotifications(schoolId, parent.user.id);
  assert.ok(afterFailure.some((item) => item.type === "ANNOUNCEMENT"));
  assert.ok(afterFailure.some((item) => item.deliveryStatus === "FAILED"));
  // Test 16.9/16.12: inbox remains durable during a provider failure;
  // the next run retries, and a successfully sent device is not sent twice.
  const successfulProvider: PushProvider = {
    async send() { return { ok: true, providerMessageId: "retry-ok" }; }
  };
  const delivered = await communication.deliverPendingPush(successfulProvider);
  assert.ok(delivered.sent >= 1);
  const alreadyDelivered = await communication.deliverPendingPush(successfulProvider);
  assert.equal(alreadyDelivered.sent, 0);
  const finalInbox = await communication.getUserNotifications(schoolId, parent.user.id);
  assert.ok(finalInbox.some(item => item.type === "ANNOUNCEMENT" &&
    item.deliveryStatus === "SENT"));
  const unread = await communication.getUnreadNotificationCount(schoolId, parent.user.id);
  assert.equal(unread, finalInbox.filter(item => !item.readAt).length);

});

// Step 17: a real PostgreSQL-compatible ledger, not mocked arithmetic.
test("Step 17 fees: tenant isolation, replay, exact balances, immutable reversals and reminders", async (t) => {
  const { client, db } = await createPhase7Database();
  t.after(async () => client.close());
  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const academics = createAcademicStore(db);
  const families = createFamilyStore(db);
  const fees = createCommunicationStore(db);
  const school = await schools.createSchool({ code: "FEET17", name: "Fee Testing",
    slug: "fee-test17", province: "Kabul", city: "Kabul", defaultLanguage: "fa-AF" });
  const other = await schools.createSchool({ code: "FEEOT17", name: "Other",
    slug: "fee-other17", province: "Kabul", city: "Kabul", defaultLanguage: "fa-AF" });
  const schoolId = school.school.id;
  const admin = await accounts.createUser({ schoolId, username: "feeadmin17",
    passwordHash: "hash", role: "SCHOOL_ADMIN" });
  const parent = await families.createParentAccount(schoolId, { username: "feeparent17",
    passwordHash: "hash", fullName: "Paying Parent" });
  const stranger = await families.createParentAccount(schoolId, { username: "feestranger17",
    passwordHash: "hash", fullName: "Unrelated Parent" });
  const year = await academics.createAcademicYear(schoolId, {
    name: "1405", startDate: "2026-03-21", endDate: "2027-03-20" });
  await academics.setAcademicYearStatus(schoolId, year.id, "ACTIVE");
  const grade = await academics.createGradeLevel(schoolId, {
    code: "G9", name: "Grade Nine", sortOrder: 9 });
  const section = await academics.createClassSection(schoolId, {
    academicYearId: year.id, gradeLevelId: grade.id, code: "9A", name: "Grade Nine A" });
  const student = await families.createStudent(schoolId, {
    parentUserId: parent.user.id, studentCode: "FEE-001", fullName: "Fee Student",
    academicYearId: year.id, classId: section.id });
  const invoice = await fees.createFeeInvoice(schoolId, admin.id, {
    studentId: student.id, amount: 1200, dueDate: "2099-12-31", description: "Tuition" });
  assert.equal((await fees.getParentFees(schoolId, parent.user.id, student.id)).length, 0);
  await assert.rejects(() => fees.getParentFees(schoolId, stranger.user.id, student.id));
  await assert.rejects(() => fees.issueFeeInvoice(other.school.id, invoice.id), /not found/);
  await fees.issueFeeInvoice(schoolId, invoice.id, admin.id);
  await assert.rejects(() => fees.issueFeeInvoice(schoolId, invoice.id, admin.id), /Only a draft/);

  const first = { amount: 500, method: "CASH", transactionReference: "REC-17",
    idempotencyKey: "17170000-0000-4000-8000-000000000017" };
  const partial = await fees.recordFeePayment(schoolId, admin.id, invoice.id, first);
  assert.equal(partial.paid, 500);
  assert.equal(partial.outstanding, 700);
  assert.equal(partial.invoice.status, "PARTIALLY_PAID");
  assert.equal((await fees.recordFeePayment(schoolId, admin.id, invoice.id, first)).payments.length, 1);
  await assert.rejects(() => fees.recordFeePayment(schoolId, admin.id, invoice.id,
    { ...first, amount: 300 }), /retry key/);
  await assert.rejects(() => fees.recordFeePayment(schoolId, admin.id, invoice.id,
    { amount: 701, method: "CASH" }), /outstanding/);
  await assert.rejects(() => fees.cancelFeeInvoice(schoolId, invoice.id, admin.id), /Reverse recorded/);
  await assert.rejects(() => fees.recordFeePayment(other.school.id, admin.id, invoice.id, first), /not found/);

  await fees.updateFeeReminderDays(schoolId, [7, 1]);
  const now = new Date("2099-12-24T06:00:00Z");
  assert.equal((await fees.runScheduledNotifications(now)).feeReminders, 1);
  assert.equal((await fees.runScheduledNotifications(now)).feeReminders, 0);
  assert.equal((await fees.getUserNotifications(schoolId, parent.user.id))
    .filter(x => x.type === "FEE_DUE").length, 1);
  assert.equal((await fees.getUserNotifications(schoolId, stranger.user.id))
    .filter(x => x.type === "FEE_DUE").length, 0);

  const settled = await fees.recordFeePayment(schoolId, admin.id, invoice.id, {
    amount: 700, method: "BANK", transactionReference: "REC-18" });
  assert.equal(settled.paid, 1200);
  assert.equal(settled.outstanding, 0);
  assert.equal(settled.invoice.status, "PAID");
  assert.equal((await fees.getUserNotifications(schoolId, parent.user.id))
    .filter(x => x.type === "FEE_DUE").length, 0);
  await assert.rejects(() => fees.recordFeePayment(schoolId, admin.id, invoice.id,
    { amount: 1, method: "CASH" }), /issued unpaid/);
  assert.equal((await fees.recordFeePayment(schoolId, admin.id, invoice.id, first)).payments.length, 2);

  const paymentId = settled.payments.find(x => x.kind === "PAYMENT" && x.amount === 700)?.id;
  assert.ok(paymentId);
  const reopened = await fees.reverseFeePayment(schoolId, admin.id, paymentId, {
    reason: "Wrong bank receipt" });
  assert.equal(reopened.paid, 500);
  assert.equal(reopened.invoice.status, "PARTIALLY_PAID");
  await assert.rejects(() => fees.reverseFeePayment(schoolId, admin.id, paymentId, {
    reason: "Second reversal" }), /already been reversed/);
  assert.equal((await fees.runScheduledNotifications(new Date("2100-01-02T06:00:00Z")))
    .overdueInvoices, 1);
  assert.equal((await fees.getParentFees(schoolId, parent.user.id, student.id))[0]?.invoice.status, "OVERDUE");
  assert.equal((await fees.runScheduledNotifications(new Date("2100-01-02T06:00:00Z")))
    .feeReminders, 0);

  const originalId = partial.payments[0]?.id;
  assert.ok(originalId);
  const cleared = await fees.reverseFeePayment(schoolId, admin.id, originalId, {
    reason: "Incorrect cash entry" });
  assert.equal(cleared.paid, 0);
  assert.equal(cleared.payments.length, 4);
  assert.equal((await fees.cancelFeeInvoice(schoolId, invoice.id, admin.id)).status, "CANCELLED");
  assert.equal((await fees.getUserNotifications(schoolId, parent.user.id))
    .filter(x => x.type === "FEE_OVERDUE").length, 0);
  await assert.rejects(() => fees.cancelFeeInvoice(schoolId, invoice.id, admin.id));

  const { rows: audits } = await client.query<{ action: string }>(
    "SELECT action FROM audit_logs WHERE school_id = $1 AND entity_type IN ('fee_invoice', 'fee_payment')",
    [schoolId]);
  const count = (action: string) => audits.filter(x => x.action === action).length;
  assert.equal(count("fee_invoice.created"), 1);
  assert.equal(count("fee_invoice.issued"), 1);
  assert.equal(count("fee_invoice.cancelled"), 1);
  assert.equal(count("fee_payment.recorded"), 2);
  assert.equal(count("fee_payment.reversed"), 2);
});
