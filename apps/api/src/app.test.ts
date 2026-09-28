import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createAcademicStore,
  createAccountStore,
  createSchoolStore,
  databaseSchema,
  type FoundationDatabase
} from "@maktablink/database";
import { buildApp } from "./app.js";

const provisioningKey = "phase-3-test-provisioning-key";

async function createTestApp() {
  const client = new PGlite();
  for (const file of [
    "0000_phase1_foundation.sql",
    "0001_phase2_auth_accounts.sql",
    "0002_phase3_academic_structure.sql"
  ]) {
    const sql = await readFile(
      new URL(`../../../packages/database/drizzle/${file}`, import.meta.url),
      "utf8"
    );
    await client.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }

  const db = drizzle(client, { schema: databaseSchema }) as unknown as FoundationDatabase;
  const app = buildApp({
    schoolStore: createSchoolStore(db),
    accountStore: createAccountStore(db),
    academicStore: createAcademicStore(db),
    provisioningKey
  });
  return { app, client };
}

async function provisionSchool(app: Awaited<ReturnType<typeof createTestApp>>["app"], code: string) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/platform/schools",
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: {
      code,
      name: `School ${code}`,
      slug: `school-${code.toLowerCase()}`,
      province: "Kabul",
      city: "Kabul"
    }
  });
  assert.equal(response.statusCode, 201);
  return response.json<{ school: { id: string } }>().school.id;
}

async function bootstrapAdmin(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  schoolId: string,
  username = "admin"
) {
  const bootstrap = await app.inject({
    method: "POST",
    url: `/v1/platform/schools/${schoolId}/admin`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { username }
  });
  assert.equal(bootstrap.statusCode, 201);
  const temporaryPassword = bootstrap.json<{ temporaryPassword: string }>().temporaryPassword;

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "SCHOOL_ADMIN",
      username,
      password: temporaryPassword
    }
  });
  assert.equal(login.statusCode, 200);
  const loginBody = login.json<{ accessToken: string; mustChangePassword: boolean }>();
  assert.equal(loginBody.mustChangePassword, true);

  const changed = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${loginBody.accessToken}` },
    payload: { newPassword: "AdminSecure2026!" }
  });
  assert.equal(changed.statusCode, 200);
  return changed.json<{ accessToken: string }>().accessToken;
}

test("platform routes reject a missing provisioning key", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const response = await app.inject({ method: "GET", url: "/v1/platform/schools" });
  assert.equal(response.statusCode, 401);
});

test("school-scoped credentials, forced password change, role matching, and suspension work together", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolA = await provisionSchool(app, "AA");
  const schoolB = await provisionSchool(app, "BB");
  const adminAccessToken = await bootstrapAdmin(app, schoolA);

  const createParent = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: { authorization: `Bearer ${adminAccessToken}` },
    payload: { username: "parent.one", role: "PARENT" }
  });
  assert.equal(createParent.statusCode, 201);
  const createdParent = createParent.json<{
    user: { id: string };
    temporaryPassword: string;
  }>();

  const wrongSchool = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId: schoolB,
      expectedRole: "PARENT",
      username: "parent.one",
      password: createdParent.temporaryPassword
    }
  });
  assert.equal(wrongSchool.statusCode, 401);

  const wrongRole = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId: schoolA,
      expectedRole: "TEACHER",
      username: "parent.one",
      password: createdParent.temporaryPassword
    }
  });
  assert.equal(wrongRole.statusCode, 403);
  assert.equal(wrongRole.json<{ error: string }>().error, "role_mismatch");

  const parentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId: schoolA,
      expectedRole: "PARENT",
      username: "parent.one",
      password: createdParent.temporaryPassword
    }
  });
  assert.equal(parentLogin.statusCode, 200);
  const parentLoginBody = parentLogin.json<{ accessToken: string; mustChangePassword: boolean }>();
  assert.equal(parentLoginBody.mustChangePassword, true);

  const parentChange = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${parentLoginBody.accessToken}` },
    payload: { newPassword: "ParentSecure2026!" }
  });
  assert.equal(parentChange.statusCode, 200);
  const parentSession = parentChange.json<{ accessToken: string }>();

  const suspend = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${createdParent.user.id}/suspend`,
    headers: { authorization: `Bearer ${adminAccessToken}` }
  });
  assert.equal(suspend.statusCode, 200);

  const meAfterSuspend = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: `Bearer ${parentSession.accessToken}` }
  });
  assert.equal(meAfterSuspend.statusCode, 401);
});

test("school admin can model teacher assignments, Negaran responsibility, and timetable", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "ACADEMIC");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminAccessToken}` };

  const teacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: auth,
    payload: { username: "teacher.academic", role: "TEACHER" }
  });
  assert.equal(teacherAccount.statusCode, 201);
  const teacherUserId = teacherAccount.json<{ user: { id: string } }>().user.id;

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1405", startDate: "2026-03-21", endDate: "2027-03-20" }
  });
  assert.equal(yearResponse.statusCode, 201);
  const yearId = yearResponse.json<{ academicYear: { id: string } }>().academicYear.id;

  const activate = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${yearId}/activate`,
    headers: auth
  });
  assert.equal(activate.statusCode, 200);

  const gradeResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "G7", name: "Grade 7", sortOrder: 7 }
  });
  assert.equal(gradeResponse.statusCode, 201);
  const gradeId = gradeResponse.json<{ grade: { id: string } }>().grade.id;

  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "7A", name: "Grade 7 A" }
  });
  assert.equal(classResponse.statusCode, 201);
  const classId = classResponse.json<{ class: { id: string } }>().class.id;

  const subjectResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/subjects",
    headers: auth,
    payload: { code: "MATH", name: "Mathematics" }
  });
  assert.equal(subjectResponse.statusCode, 201);
  const subjectId = subjectResponse.json<{ subject: { id: string } }>().subject.id;

  const teacherProfile = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/teachers",
    headers: auth,
    payload: {
      userId: teacherUserId,
      employeeCode: "T-001",
      fullName: "Academic Teacher",
      phone: "0700000000"
    }
  });
  assert.equal(teacherProfile.statusCode, 201);

  const assignmentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/assignments",
    headers: auth,
    payload: {
      academicYearId: yearId,
      classId,
      subjectId,
      teacherUserId
    }
  });
  assert.equal(assignmentResponse.statusCode, 201);

  const negaranResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/negaran",
    headers: auth,
    payload: {
      academicYearId: yearId,
      classId,
      teacherUserId,
      startDate: "2026-03-21"
    }
  });
  assert.equal(negaranResponse.statusCode, 201);

  const timetableResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/timetable",
    headers: auth,
    payload: {
      academicYearId: yearId,
      classId,
      subjectId,
      teacherUserId,
      weekday: "SATURDAY",
      startsAt: "08:00",
      endsAt: "08:45"
    }
  });
  assert.equal(timetableResponse.statusCode, 201);

  const overview = await app.inject({
    method: "GET",
    url: "/v1/admin/academics",
    headers: auth
  });
  assert.equal(overview.statusCode, 200);
  const body = overview.json<{
    teachers: unknown[];
    assignments: unknown[];
    negaranAssignments: unknown[];
    timetable: unknown[];
  }>();
  assert.equal(body.teachers.length, 1);
  assert.equal(body.assignments.length, 1);
  assert.equal(body.negaranAssignments.length, 1);
  assert.equal(body.timetable.length, 1);
});

test("public school search returns active minimal school records", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  await provisionSchool(app, "SEARCH");
  const response = await app.inject({ method: "GET", url: "/v1/public/schools?q=SEARCH" });
  assert.equal(response.statusCode, 200);
  const body = response.json<{ schools: Array<{ code: string; name: string }> }>();
  assert.equal(body.schools.length, 1);
  assert.equal(body.schools[0]?.code, "SEARCH");
});
