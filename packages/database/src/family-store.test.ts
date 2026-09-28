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
    "0006_phase6_learning.sql"
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
    "0003_phase4_student_family.sql"
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

  const migration = await readFile(
    new URL("../drizzle/0004_phase4_parent_profile_backfill.sql", import.meta.url),
    "utf8"
  );
  await client.exec(migration.replaceAll("--> statement-breakpoint", ""));

  const home = await createFamilyStore(db).getParentHome(school.school.id, legacyParent.id);
  assert.equal(home.parent.userId, legacyParent.id);
  assert.equal(home.parent.fullName, "parent.legacy");
  assert.deepEqual(home.children, []);
});
