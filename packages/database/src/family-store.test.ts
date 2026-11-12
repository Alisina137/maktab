import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createAcademicStore,
  createAccountStore,
  createFamilyStore,
  createSchoolStore,
  databaseSchema,
  type FoundationDatabase
} from "./index.js";

async function createTestDatabase() {
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

async function buildAcademicBase(db: FoundationDatabase, schoolId: string) {
  const academics = createAcademicStore(db);
  const year = await academics.createAcademicYear(schoolId, {
    name: "1405",
    startDate: "2026-03-21",
    endDate: "2027-03-20"
  });
  await academics.setAcademicYearStatus(schoolId, year.id, "ACTIVE");
  const grade = await academics.createGradeLevel(schoolId, {
    code: "G7",
    name: "Grade 7",
    sortOrder: 7
  });
  const classSection = await academics.createClassSection(schoolId, {
    academicYearId: year.id,
    gradeLevelId: grade.id,
    code: "7A",
    name: "Grade 7 A"
  });
  return { year, classSection };
}

test("one parent owns multiple students while every student has one parentUserId", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());

  const schools = createSchoolStore(db);
  const families = createFamilyStore(db);
  const school = await schools.createSchool({
    code: "FAMILY-A",
    name: "Family A",
    slug: "family-a",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });
  const { year, classSection } = await buildAcademicBase(db, school.school.id);
  const parent = await families.createParentAccount(school.school.id, {
    username: "parent.one",
    passwordHash: "hash",
    fullName: "Parent One"
  });

  for (let index = 1; index <= 3; index += 1) {
    await families.createStudent(school.school.id, {
      parentUserId: parent.user.id,
      studentCode: `S-${index}`,
      fullName: `Student ${index}`,
      academicYearId: year.id,
      classId: classSection.id
    });
  }

  const home = await families.getParentHome(school.school.id, parent.user.id);
  assert.equal(home.children.length, 3);
  assert.ok(home.children.every((item) => item.student.parentUserId === parent.user.id));
});

test("cross-school parent links and duplicate student codes are rejected", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());

  const schools = createSchoolStore(db);
  const families = createFamilyStore(db);
  const schoolA = await schools.createSchool({
    code: "FAMILY-AA",
    name: "Family AA",
    slug: "family-aa",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });
  const schoolB = await schools.createSchool({
    code: "FAMILY-BB",
    name: "Family BB",
    slug: "family-bb",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "ps-AF"
  });
  const baseA = await buildAcademicBase(db, schoolA.school.id);
  const parentA = await families.createParentAccount(schoolA.school.id, {
    username: "parent.a",
    passwordHash: "hash",
    fullName: "Parent A"
  });
  const parentB = await families.createParentAccount(schoolB.school.id, {
    username: "parent.b",
    passwordHash: "hash",
    fullName: "Parent B"
  });

  await families.createStudent(schoolA.school.id, {
    parentUserId: parentA.user.id,
    studentCode: "DUP-1",
    fullName: "First Student",
    academicYearId: baseA.year.id,
    classId: baseA.classSection.id
  });

  await assert.rejects(
    families.createStudent(schoolA.school.id, {
      parentUserId: parentA.user.id,
      studentCode: "DUP-1",
      fullName: "Duplicate Student",
      academicYearId: baseA.year.id,
      classId: baseA.classSection.id
    }),
    /student code/i
  );

  await assert.rejects(
    families.createStudent(schoolA.school.id, {
      parentUserId: parentB.user.id,
      studentCode: "FOREIGN-1",
      fullName: "Foreign Parent Student",
      academicYearId: baseA.year.id,
      classId: baseA.classSection.id
    }),
    /Parent account not found/i
  );
});


test("Phase 4 parent backfill makes legacy PARENT users available to parent home", async (t) => {
  const client = new PGlite();
  t.after(async () => client.close());

  for (const file of [
    "0000_phase1_foundation.sql",
    "0001_phase2_auth_accounts.sql",
    "0002_phase3_academic_structure.sql",
    "0003_phase4_student_family.sql",
    "0008_phase8_pilot_readiness.sql",
    "0009_school_image.sql",
    "0014_student_phone.sql"
  ]) {
    const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    await client.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }

  const db = drizzle(client, { schema: databaseSchema }) as unknown as FoundationDatabase;
  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const school = await schools.createSchool({
    code: "LEGACY-PARENT",
    name: "Legacy Parent School",
    slug: "legacy-parent-school",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });
  const legacyParent = await accounts.createUser({
    schoolId: school.school.id,
    username: "parent.legacy",
    passwordHash: "legacy-hash",
    role: "PARENT"
  });

  for (const file of [
    "0004_phase4_parent_profile_backfill.sql",
    "0005_phase5_attendance.sql",
    "0006_phase6_learning.sql"
  ]) {
    const migration = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    await client.exec(migration.replaceAll("--> statement-breakpoint", ""));
  }

  const home = await createFamilyStore(db).getParentHome(school.school.id, legacyParent.id);
  assert.equal(home.parent.userId, legacyParent.id);
  assert.equal(home.parent.fullName, "parent.legacy");
  assert.deepEqual(home.children, []);
});


test("Audit Phase 6: simultaneous student login attachment creates one account and no orphan", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());
  const schools = createSchoolStore(db);
  const families = createFamilyStore(db);
  const school = await schools.createSchool({
    code: "P6-LOGIN", name: "Phase 6 Student Login", slug: "phase6-login",
    province: "Kabul", city: "Kabul", defaultLanguage: "fa-AF"
  });
  const schoolId = school.school.id;
  const { year, classSection } = await buildAcademicBase(db, schoolId);
  const parent = await families.createParentAccount(schoolId, {
    username: "phase6parent", fullName: "Phase Six Parent", passwordHash: "hash"
  });
  const student = await families.createStudent(schoolId, {
    parentUserId: parent.user.id, studentCode: "PH6-ST-1", fullName: "Phase Six Learner",
    academicYearId: year.id, classId: classSection.id
  });
  const results = await Promise.allSettled([
    families.createStudentAccount(schoolId, student.id, { username: "phase6first", passwordHash: "hash" }),
    families.createStudentAccount(schoolId, student.id, { username: "phase6second", passwordHash: "hash" })
  ]);
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal(results.filter((entry) => entry.status === "rejected").length, 1);
  const winner = results.find((entry) => entry.status === "fulfilled");
  if (winner?.status !== "fulfilled") throw new Error("Expected exactly one student login.");
  const linked = await client.query<{ user_id: string }>(
    "SELECT user_id FROM students WHERE school_id = $1 AND id = $2", [schoolId, student.id]
  );
  assert.equal(linked.rows[0]?.user_id, winner.value.user.id);
  const users = await client.query<{ total: number }>(
    "SELECT count(*)::integer AS total FROM users WHERE school_id = $1 AND role = 'STUDENT'", [schoolId]
  );
  assert.equal(users.rows[0]?.total, 1, "The losing transaction must roll back the extra user.");
  await assert.rejects(
    families.createStudentAccount(schoolId, student.id, { username: "phase6third", passwordHash: "hash" }),
    /already|without a login|only an active student/i
  );

  const otherStudent = await families.createStudent(schoolId, {
    parentUserId: parent.user.id, studentCode: "PH6-ST-2", fullName: "Unlinked Learner",
    academicYearId: year.id, classId: classSection.id
  });
  await families.updateStudent(schoolId, otherStudent.id, { status: "WITHDRAWN" });
  await assert.rejects(
    families.createStudentAccount(schoolId, otherStudent.id, { username: "withdrawnphase6", passwordHash: "hash" }),
    /active student/i
  );
  const afterRejected = await client.query<{ total: number }>(
    "SELECT count(*)::integer AS total FROM users WHERE school_id = $1 AND role = 'STUDENT'", [schoolId]
  );
  assert.equal(afterRejected.rows[0]?.total, 1, "Withdrawn students must not leave a user behind.");
});

test("Audit Phase 6: withdrawal, reactivation and class transfer preserve enrollment intervals", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());
  const schools = createSchoolStore(db);
  const academics = createAcademicStore(db);
  const families = createFamilyStore(db);
  const school = await schools.createSchool({
    code: "P6-INTERVAL", name: "Phase 6 Enrollment", slug: "phase6-enrollment",
    province: "Kabul", city: "Kabul", defaultLanguage: "ps-AF"
  });
  const schoolId = school.school.id;
  const { year, classSection } = await buildAcademicBase(db, schoolId);
  const grade = await academics.createGradeLevel(schoolId, {
    code: "G8", name: "Grade 8", sortOrder: 8
  });
  const nextClass = await academics.createClassSection(schoolId, {
    academicYearId: year.id, gradeLevelId: grade.id, code: "8-A", name: "Class 8A"
  });
  const parent = await families.createParentAccount(schoolId, {
    username: "intervalparent", passwordHash: "hash", fullName: "Enrollment Parent"
  });
  const student = await families.createStudent(schoolId, {
    parentUserId: parent.user.id, studentCode: "PH6-INTERVAL", fullName: "Enrollment Learner",
    academicYearId: year.id, classId: classSection.id
  });
  async function openHistory() {
    const rows = await client.query<{ class_id: string }>(
      "SELECT class_id FROM student_class_history WHERE school_id=$1 AND student_id=$2 AND ended_at IS NULL",
      [schoolId, student.id]
    );
    return rows.rows;
  }
  assert.equal((await openHistory()).length, 1);
  await families.updateStudent(schoolId, student.id, { status: "WITHDRAWN" });
  assert.equal((await openHistory()).length, 0, "Withdrawal ends the active interval.");
  await families.updateStudent(schoolId, student.id, { status: "WITHDRAWN", classId: nextClass.id, academicYearId: year.id });
  assert.equal((await openHistory()).length, 0, "Transferring a withdrawn learner must not open a new interval.");
  await families.updateStudent(schoolId, student.id, { status: "ACTIVE" });
  assert.deepEqual((await openHistory()).map(row => row.class_id), [nextClass.id]);
  await families.updateStudent(schoolId, student.id, { fullName: "Updated Learner" });
  assert.equal((await openHistory()).length, 1, "Non-placement edits must not duplicate enrollment history.");
  await families.updateStudent(schoolId, student.id, { classId: classSection.id, academicYearId: year.id });
  assert.deepEqual((await openHistory()).map(row => row.class_id), [classSection.id]);
  const history = await client.query<{ total: number; closed: number }>(
    "SELECT count(*)::integer AS total, count(*) FILTER (WHERE ended_at IS NOT NULL)::integer AS closed FROM student_class_history WHERE school_id=$1 AND student_id=$2",
    [schoolId, student.id]
  );
  assert.deepEqual(history.rows[0], { total: 3, closed: 2 });
});

test("Audit Phase 6: parent and student account deletion respect linked records and school boundaries", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());
  const schools = createSchoolStore(db);
  const families = createFamilyStore(db);
  const school = await schools.createSchool({
    code: "P6-DELETE", name: "Phase 6 Deletion", slug: "phase6-delete",
    province: "Kabul", city: "Kabul", defaultLanguage: "fa-AF"
  });
  const other = await schools.createSchool({
    code: "P6-OTHER", name: "Phase 6 Other", slug: "phase6-other",
    province: "Herat", city: "Herat", defaultLanguage: "fa-AF"
  });
  const schoolId = school.school.id;
  const { year, classSection } = await buildAcademicBase(db, schoolId);
  const parent = await families.createParentAccount(schoolId, {
    username: "deleteparent", fullName: "Deletion Parent", passwordHash: "hash"
  });
  const foreignParent = await families.createParentAccount(other.school.id, {
    username: "foreignparent", fullName: "Foreign Parent", passwordHash: "hash"
  });
  const student = await families.createStudent(schoolId, {
    parentUserId: parent.user.id, studentCode: "PH6-DELETE", fullName: "Deletion Learner",
    academicYearId: year.id, classId: classSection.id
  });
  await assert.rejects(families.deleteParentAccount(schoolId, parent.user.id), /linked/i);
  await assert.rejects(
    families.updateStudent(schoolId, student.id, { parentUserId: foreignParent.user.id }),
    /parent account is unavailable/i
  );
  const account = await families.createStudentAccount(schoolId, student.id, {
    username: "deletelearner", passwordHash: "hash"
  });
  await assert.rejects(families.deleteStudent(other.school.id, student.id), /not found/i);
  await families.deleteStudent(schoolId, student.id);
  const remainingUser = await client.query<{ id: string }>("SELECT id FROM users WHERE id=$1", [account.user.id]);
  assert.equal(remainingUser.rows.length, 0, "Removing an unreferenced student must remove its own login.");
  await families.deleteParentAccount(schoolId, parent.user.id);
  await assert.rejects(families.getParentHome(schoolId, parent.user.id), /not found/i);
});
