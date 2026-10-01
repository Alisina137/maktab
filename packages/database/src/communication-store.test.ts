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
    "0014_student_phone.sql"
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
});
