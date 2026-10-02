import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createAcademicStore,
  createAccountStore,
  createAttendanceStore,
  createCommunicationStore,
  createFamilyStore,
  createLearningStore,
  createPilotStore,
  createSchoolStore,
  type PushProvider,
  databaseSchema,
  type FoundationDatabase
} from "@maktablink/database";
import { buildApp } from "./app.js";
import type { AdminPasswordVerificationDelivery } from "./auth/admin-password-2fa.js";

const provisioningKey = "phase-3-test-provisioning-key";

async function createTestApp() {
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
    "0010_admin_profiles.sql",
    "0011_admin_contact_profile.sql",
    "0012_admin_password_2fa.sql",
    "0014_student_phone.sql"
  ]) {
    const sql = await readFile(
      new URL(`../../../packages/database/drizzle/${file}`, import.meta.url),
      "utf8"
    );
    await client.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }

  const db = drizzle(client, { schema: databaseSchema }) as unknown as FoundationDatabase;
  const pushProvider: PushProvider = {
    async send() {
      return { ok: true, providerMessageId: "test-push-id" };
    }
  };
  const passwordVerificationMessages = {
    email: [] as Array<{ to: string; code: string }>,
    sms: [] as Array<{ to: string; code: string }>
  };
  const passwordVerificationDelivery: AdminPasswordVerificationDelivery = {
    configured: true,
    async sendEmailCode({ to, code }) {
      passwordVerificationMessages.email.push({ to, code });
    },
    async sendSmsCode({ to, code }) {
      passwordVerificationMessages.sms.push({ to, code });
    }
  };
  const app = buildApp({
    schoolStore: createSchoolStore(db),
    accountStore: createAccountStore(db),
    academicStore: createAcademicStore(db),
    familyStore: createFamilyStore(db),
    attendanceStore: createAttendanceStore(db),
    learningStore: createLearningStore(db),
    communicationStore: createCommunicationStore(db),
    pilotStore: createPilotStore(db),
    pushProvider,
    passwordVerificationDelivery,
    passwordVerificationSecret: "test-password-verification-secret-2026",
    provisioningKey
  });
  return { app, client, passwordVerificationMessages };
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

test("school admin password change requires email verification", async (t) => {
  const { app, client, passwordVerificationMessages } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "ADMIN-EMAIL-2FA");
  const accessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${accessToken}` };

  const profile = await app.inject({
    method: "PATCH",
    url: "/v1/admin/profile",
    headers: auth,
    payload: {
      fullName: "Secure Admin",
      email: "admin@example.com"
    }
  });
  assert.equal(profile.statusCode, 200);

  const blockedWithoutVerification = await app.inject({
    method: "POST",
    url: "/v1/auth/change-password",
    headers: auth,
    payload: {
      currentPassword: "AdminSecure2026!",
      newPassword: "AdminMoreSecure2026!"
    }
  });
  assert.equal(blockedWithoutVerification.statusCode, 403);
  assert.equal(
    blockedWithoutVerification.json<{ error: string }>().error,
    "two_factor_verification_required"
  );

  const wrongCurrentPassword = await app.inject({
    method: "POST",
    url: "/v1/auth/admin-password-verification/start",
    headers: auth,
    payload: { currentPassword: "wrong-password" }
  });
  assert.equal(wrongCurrentPassword.statusCode, 401);

  const started = await app.inject({
    method: "POST",
    url: "/v1/auth/admin-password-verification/start",
    headers: auth,
    payload: { currentPassword: "AdminSecure2026!" }
  });
  assert.equal(started.statusCode, 200);
  const startedBody = started.json<{ verificationId: string; email: string }>();
  assert.ok(startedBody.email.includes("@example.com"));
  assert.equal(passwordVerificationMessages.email.length, 1);
  assert.equal(passwordVerificationMessages.sms.length, 0);
  assert.equal(passwordVerificationMessages.email[0]?.to, "admin@example.com");

  const wrongCode = await app.inject({
    method: "POST",
    url: "/v1/auth/admin-password-verification/verify",
    headers: auth,
    payload: {
      verificationId: startedBody.verificationId,
      emailCode: "000000"
    }
  });
  assert.equal(wrongCode.statusCode, 400);
  assert.equal(wrongCode.json<{ error: string }>().error, "two_factor_code_invalid");

  const verified = await app.inject({
    method: "POST",
    url: "/v1/auth/admin-password-verification/verify",
    headers: auth,
    payload: {
      verificationId: startedBody.verificationId,
      emailCode: passwordVerificationMessages.email[0]!.code
    }
  });
  assert.equal(verified.statusCode, 200);
  const verificationToken = verified.json<{ verificationToken: string }>().verificationToken;
  assert.ok(verificationToken.length >= 32);

  const changed = await app.inject({
    method: "POST",
    url: "/v1/auth/change-password",
    headers: auth,
    payload: {
      currentPassword: "AdminSecure2026!",
      newPassword: "AdminMoreSecure2026!",
      verificationToken
    }
  });
  assert.equal(changed.statusCode, 200);
  const newAccessToken = changed.json<{ accessToken: string }>().accessToken;

  const reused = await app.inject({
    method: "POST",
    url: "/v1/auth/change-password",
    headers: { authorization: `Bearer ${newAccessToken}` },
    payload: {
      currentPassword: "AdminMoreSecure2026!",
      newPassword: "AdminEvenMoreSecure2026!",
      verificationToken
    }
  });
  assert.equal(reused.statusCode, 403);
  assert.equal(reused.json<{ error: string }>().error, "two_factor_verification_required");
});

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

  const genericParent = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: { authorization: `Bearer ${adminAccessToken}` },
    payload: { username: "legacy.parent", role: "PARENT" }
  });
  assert.equal(genericParent.statusCode, 400);
  assert.equal(genericParent.json<{ error: string }>().error, "family_workflow_required");

  const createParent = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: { authorization: `Bearer ${adminAccessToken}` },
    payload: { username: "parentone", fullName: "Parent One" }
  });
  assert.equal(createParent.statusCode, 201);
  const createdParent = createParent.json<{
    user: { id: string };
    temporaryPassword: string;
  }>();

  const wrongPassword = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId: schoolA,
      expectedRole: "PARENT",
      username: "parentone",
      password: "DefinitelyWrong2026!"
    }
  });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(wrongPassword.json<{ error: string }>().error, "invalid_credentials");

  const wrongSchool = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId: schoolB,
      expectedRole: "PARENT",
      username: "parentone",
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
      username: "parentone",
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
      username: "parentone",
      password: createdParent.temporaryPassword
    }
  });
  assert.equal(parentLogin.statusCode, 200);
  const parentLoginBody = parentLogin.json<{ accessToken: string; mustChangePassword: boolean }>();
  assert.equal(parentLoginBody.mustChangePassword, true);

  const meBeforePasswordChange = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: `Bearer ${parentLoginBody.accessToken}` }
  });
  assert.equal(meBeforePasswordChange.statusCode, 200);
  assert.equal(
    meBeforePasswordChange.json<{ mustChangePassword: boolean }>().mustChangePassword,
    true
  );

  const blockedHomeBeforePasswordChange = await app.inject({
    method: "GET",
    url: "/v1/parent/home",
    headers: { authorization: `Bearer ${parentLoginBody.accessToken}` }
  });
  assert.equal(blockedHomeBeforePasswordChange.statusCode, 403);
  assert.equal(
    blockedHomeBeforePasswordChange.json<{ error: string }>().error,
    "password_change_required"
  );

  const parentChange = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${parentLoginBody.accessToken}` },
    payload: { newPassword: "ParentSecure2026!" }
  });
  assert.equal(parentChange.statusCode, 200);
  const parentSession = parentChange.json<{
    accessToken: string;
    refreshToken: string;
    mustChangePassword: boolean;
    user: { status: string; role: string };
  }>();
  assert.equal(parentSession.mustChangePassword, false);
  assert.equal(parentSession.user.status, "ACTIVE");
  assert.equal(parentSession.user.role, "PARENT");

  const homeAfterPasswordChange = await app.inject({
    method: "GET",
    url: "/v1/parent/home",
    headers: { authorization: `Bearer ${parentSession.accessToken}` }
  });
  assert.equal(homeAfterPasswordChange.statusCode, 200);

  const refreshedParent = await app.inject({
    method: "POST",
    url: "/v1/auth/refresh",
    payload: { refreshToken: parentSession.refreshToken }
  });
  assert.equal(refreshedParent.statusCode, 200);
  const refreshedParentBody = refreshedParent.json<{
    accessToken: string;
    user: { role: string };
    mustChangePassword: boolean;
  }>();
  assert.equal(refreshedParentBody.user.role, "PARENT");
  assert.equal(refreshedParentBody.mustChangePassword, false);
  const activeParentAccessToken = refreshedParentBody.accessToken;

  const suspend = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${createdParent.user.id}/suspend`,
    headers: { authorization: `Bearer ${adminAccessToken}` }
  });
  assert.equal(suspend.statusCode, 200);

  const meAfterSuspend = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: `Bearer ${activeParentAccessToken}` }
  });
  assert.equal(meAfterSuspend.statusCode, 200);
  assert.equal(meAfterSuspend.json<{ user: { status: string } }>().user.status, "SUSPENDED");

  const blockedHome = await app.inject({
    method: "GET",
    url: "/v1/parent/home",
    headers: { authorization: `Bearer ${activeParentAccessToken}` }
  });
  assert.equal(blockedHome.statusCode, 403);
  assert.equal(blockedHome.json<{ error: string }>().error, "account_suspended");

  const contactWhileSuspended = await app.inject({
    method: "GET",
    url: "/v1/school/admin-contact",
    headers: { authorization: `Bearer ${activeParentAccessToken}` }
  });
  assert.equal(contactWhileSuspended.statusCode, 200);

  const suspendedLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId: schoolA,
      expectedRole: "PARENT",
      username: "parentone",
      password: "ParentSecure2026!"
    }
  });
  assert.equal(suspendedLogin.statusCode, 200);
  assert.equal(suspendedLogin.json<{ user: { status: string } }>().user.status, "SUSPENDED");

  const reactivate = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${createdParent.user.id}/reactivate`,
    headers: { authorization: `Bearer ${adminAccessToken}` }
  });
  assert.equal(reactivate.statusCode, 200);

  const homeAfterReactivate = await app.inject({
    method: "GET",
    url: "/v1/parent/home",
    headers: { authorization: `Bearer ${activeParentAccessToken}` }
  });
  assert.equal(homeAfterReactivate.statusCode, 200);
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

  const secondTeacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: auth,
    payload: { username: "teacher.academic.two", role: "TEACHER" }
  });
  assert.equal(secondTeacherAccount.statusCode, 201);
  const secondTeacherUserId = secondTeacherAccount.json<{ user: { id: string } }>().user.id;

  const secondTeacherProfile = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/teachers",
    headers: auth,
    payload: {
      userId: secondTeacherUserId,
      employeeCode: "T-002",
      fullName: "Second Academic Teacher"
    }
  });
  assert.equal(secondTeacherProfile.statusCode, 201);

  const occupiedClassSubject = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/assignments",
    headers: auth,
    payload: {
      academicYearId: yearId,
      classId,
      subjectId,
      teacherUserId: secondTeacherUserId
    }
  });
  assert.equal(occupiedClassSubject.statusCode, 409);
  assert.equal(
    occupiedClassSubject.json<{ message: string }>().message,
    "This class and subject already have a teacher assigned."
  );

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
  assert.equal(body.teachers.length, 2);
  assert.equal(body.assignments.length, 1);
  assert.equal(body.negaranAssignments.length, 1);
  assert.equal(body.timetable.length, 1);
});

test("academic structure returns specific lifecycle and validation errors", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "ACADEMIC-ERRORS");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminAccessToken}` };

  const invalidYear = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "Invalid year", startDate: "2027-03-21", endDate: "2026-03-20" }
  });
  assert.equal(invalidYear.statusCode, 400);
  assert.equal(invalidYear.json<{ error: string }>().error, "validation_error");
  assert.equal(
    invalidYear.json<{ message: string }>().message,
    "Academic year end date must be after its start date."
  );

  const firstYear = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1406", startDate: "2027-03-21", endDate: "2028-03-20" }
  });
  assert.equal(firstYear.statusCode, 201);
  const firstYearId = firstYear.json<{ academicYear: { id: string } }>().academicYear.id;

  const activateFirst = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/activate`,
    headers: auth
  });
  assert.equal(activateFirst.statusCode, 200);

  const secondYear = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1407", startDate: "2028-03-21", endDate: "2029-03-20" }
  });
  assert.equal(secondYear.statusCode, 201);
  const secondYearId = secondYear.json<{ academicYear: { id: string } }>().academicYear.id;

  const activateSecond = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${secondYearId}/activate`,
    headers: auth
  });
  assert.equal(activateSecond.statusCode, 409);
  assert.equal(activateSecond.json<{ error: string }>().error, "academic_conflict");
  assert.equal(
    activateSecond.json<{ message: string }>().message,
    "Only one academic year may be active for a school."
  );

  const grade = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "G7", name: "Grade 7", sortOrder: 7 }
  });
  assert.equal(grade.statusCode, 201);
  const gradeId = grade.json<{ grade: { id: string } }>().grade.id;

  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: {
      academicYearId: firstYearId,
      gradeLevelId: gradeId,
      code: "صنف-۷-الف",
      name: "Grade 7 A"
    }
  });
  assert.equal(classResponse.statusCode, 201);
  assert.equal(
    classResponse.json<{ class: { code: string } }>().class.code,
    "صنف-۷-الف"
  );

  const closeFirst = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/close`,
    headers: auth
  });
  assert.equal(closeFirst.statusCode, 200);

  const classOnClosedYear = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: {
      academicYearId: firstYearId,
      gradeLevelId: gradeId,
      code: "7B",
      name: "Grade 7 B"
    }
  });
  assert.equal(classOnClosedYear.statusCode, 409);
  assert.equal(classOnClosedYear.json<{ error: string }>().error, "academic_conflict");
  assert.equal(
    classOnClosedYear.json<{ message: string }>().message,
    "Closed or archived academic years cannot receive new academic structure."
  );

  const activateSecondAfterClose = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${secondYearId}/activate`,
    headers: auth
  });
  assert.equal(activateSecondAfterClose.statusCode, 200);

  const blockedReactivation = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/activate`,
    headers: auth
  });
  assert.equal(blockedReactivation.statusCode, 409);
  assert.equal(
    blockedReactivation.json<{ message: string }>().message,
    "Only one academic year may be active for a school."
  );

  const closeSecond = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${secondYearId}/close`,
    headers: auth
  });
  assert.equal(closeSecond.statusCode, 200);

  const reactivateFirst = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/activate`,
    headers: auth
  });
  assert.equal(reactivateFirst.statusCode, 200);
  assert.equal(
    reactivateFirst.json<{ academicYear: { status: string } }>().academicYear.status,
    "ACTIVE"
  );

  const closeFirstAgain = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/close`,
    headers: auth
  });
  assert.equal(closeFirstAgain.statusCode, 200);

  const archiveFirst = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/archive`,
    headers: auth
  });
  assert.equal(archiveFirst.statusCode, 200);
  assert.equal(
    archiveFirst.json<{ academicYear: { status: string } }>().academicYear.status,
    "ARCHIVED"
  );

  const overviewAfterArchive = await app.inject({
    method: "GET",
    url: "/v1/admin/academics",
    headers: auth
  });
  assert.equal(overviewAfterArchive.statusCode, 200);
  const archivedBody = overviewAfterArchive.json<{
    academicYears: Array<{ id: string; status: string }>;
    classes: Array<{ academicYearId: string; code: string }>;
  }>();
  assert.equal(
    archivedBody.academicYears.find((year) => year.id === firstYearId)?.status,
    "ARCHIVED"
  );
  assert.equal(
    archivedBody.classes.some(
      (classSection) =>
        classSection.academicYearId === firstYearId && classSection.code === "صنف-۷-الف"
    ),
    true
  );

  const unarchiveFirst = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/unarchive`,
    headers: auth
  });
  assert.equal(unarchiveFirst.statusCode, 200);
  assert.equal(
    unarchiveFirst.json<{ academicYear: { status: string } }>().academicYear.status,
    "CLOSED"
  );

  const reactivateAfterUnarchive = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/activate`,
    headers: auth
  });
  assert.equal(reactivateAfterUnarchive.statusCode, 200);
  assert.equal(
    reactivateAfterUnarchive.json<{ academicYear: { status: string } }>().academicYear.status,
    "ACTIVE"
  );

  const closeAfterUnarchive = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/close`,
    headers: auth
  });
  assert.equal(closeAfterUnarchive.statusCode, 200);

  const rearchiveFirst = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${firstYearId}/archive`,
    headers: auth
  });
  assert.equal(rearchiveFirst.statusCode, 200);
  assert.equal(
    rearchiveFirst.json<{ academicYear: { status: string } }>().academicYear.status,
    "ARCHIVED"
  );

  const blockedDeleteWithHistory = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/years/${firstYearId}`,
    headers: auth
  });
  assert.equal(blockedDeleteWithHistory.statusCode, 409);
  const blockedDeleteWithHistoryBody = blockedDeleteWithHistory.json<{
    message: string;
    dependencies: string[];
  }>();
  assert.equal(
    blockedDeleteWithHistoryBody.message,
    "This academic year cannot be deleted because it is used by:"
  );
  assert.ok(blockedDeleteWithHistoryBody.dependencies.includes("Classes"));

  const blockedDeleteClosed = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/years/${secondYearId}`,
    headers: auth
  });
  assert.equal(blockedDeleteClosed.statusCode, 409);
  assert.equal(
    blockedDeleteClosed.json<{ message: string }>().message,
    "Only archived academic years can be deleted."
  );

  const emptyYear = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1408", startDate: "2029-03-21", endDate: "2030-03-20" }
  });
  assert.equal(emptyYear.statusCode, 201);
  const emptyYearId = emptyYear.json<{ academicYear: { id: string } }>().academicYear.id;

  const activateEmpty = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${emptyYearId}/activate`,
    headers: auth
  });
  assert.equal(activateEmpty.statusCode, 200);

  const closeEmpty = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${emptyYearId}/close`,
    headers: auth
  });
  assert.equal(closeEmpty.statusCode, 200);

  const archiveEmpty = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${emptyYearId}/archive`,
    headers: auth
  });
  assert.equal(archiveEmpty.statusCode, 200);

  const deleteEmpty = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/years/${emptyYearId}`,
    headers: auth
  });
  assert.equal(deleteEmpty.statusCode, 200);

  const overviewAfterDelete = await app.inject({
    method: "GET",
    url: "/v1/admin/academics",
    headers: auth
  });
  assert.equal(overviewAfterDelete.statusCode, 200);
  assert.equal(
    overviewAfterDelete
      .json<{ academicYears: Array<{ id: string }> }>()
      .academicYears.some((year) => year.id === emptyYearId),
    false
  );
});

test("academic duplicate feedback is explicit and browser DELETE requests are allowed", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/v1/admin/academics/grades/example",
    headers: {
      origin: "http://localhost:3000",
      "access-control-request-method": "DELETE",
      "access-control-request-headers": "authorization"
    }
  });
  assert.equal(preflight.statusCode, 204);
  assert.ok((preflight.headers["access-control-allow-methods"] ?? "").includes("DELETE"));

  const schoolId = await provisionSchool(app, "ACADEMIC-DOMAIN-ERRORS");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminToken}` };

  const year = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1410 Duplicate Test", startDate: "2031-03-21", endDate: "2032-03-19" }
  });
  assert.equal(year.statusCode, 201);

  const duplicateYear = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1410 Duplicate Test", startDate: "2032-03-20", endDate: "2033-03-19" }
  });
  assert.equal(duplicateYear.statusCode, 409);
  assert.equal(duplicateYear.json<{ error: string }>().error, "academic_conflict");
  assert.equal(
    duplicateYear.json<{ message: string }>().message,
    "Duplicate academic years are not allowed. An academic year with that name already exists in this school."
  );

  const grade = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "DUP-7", name: "Duplicate Grade Test", sortOrder: 7 }
  });
  assert.equal(grade.statusCode, 201);
  const gradeId = grade.json<{ grade: { id: string } }>().grade.id;

  const duplicateGrade = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "DUP-7", name: "Another Grade Name", sortOrder: 8 }
  });
  assert.equal(duplicateGrade.statusCode, 409);
  assert.equal(duplicateGrade.json<{ error: string }>().error, "academic_conflict");
  assert.equal(
    duplicateGrade.json<{ message: string }>().message,
    "Duplicate grade levels are not allowed. A grade with that code or name already exists in this school."
  );

  const deleteUnusedGrade = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/grades/${gradeId}`,
    headers: auth
  });
  assert.equal(deleteUnusedGrade.statusCode, 200);

  const emptyYearId = year.json<{ academicYear: { id: string } }>().academicYear.id;
  const activate = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${emptyYearId}/activate`,
    headers: auth
  });
  assert.equal(activate.statusCode, 200);
  const close = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${emptyYearId}/close`,
    headers: auth
  });
  assert.equal(close.statusCode, 200);
  const archive = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${emptyYearId}/archive`,
    headers: auth
  });
  assert.equal(archive.statusCode, 200);
  const deleteEmptyYear = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/years/${emptyYearId}`,
    headers: auth
  });
  assert.equal(deleteEmptyYear.statusCode, 200);
});

test("academic deletion removes unlinked records, explains dependencies, and keeps the API healthy", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "SAFE-DELETE");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminToken}` };

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1411 Safe Delete", startDate: "2032-03-20", endDate: "2033-03-19" }
  });
  assert.equal(yearResponse.statusCode, 201);
  const yearId = yearResponse.json<{ academicYear: { id: string } }>().academicYear.id;

  const unusedGrade = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "UNUSED-G", name: "Unused Grade", sortOrder: 90 }
  });
  const unusedGradeId = unusedGrade.json<{ grade: { id: string } }>().grade.id;
  const deleteUnusedGrade = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/grades/${unusedGradeId}`,
    headers: auth
  });
  assert.equal(deleteUnusedGrade.statusCode, 200);

  const usedGrade = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "USED-G", name: "Used Grade", sortOrder: 91 }
  });
  const usedGradeId = usedGrade.json<{ grade: { id: string } }>().grade.id;
  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: {
      academicYearId: yearId,
      gradeLevelId: usedGradeId,
      code: "SAFE-A",
      name: "Safe Delete Class"
    }
  });
  assert.equal(classResponse.statusCode, 201);
  const classId = classResponse.json<{ class: { id: string } }>().class.id;

  const blockedGrade = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/grades/${usedGradeId}`,
    headers: auth
  });
  assert.equal(blockedGrade.statusCode, 409);
  assert.equal(blockedGrade.json<{ error: string }>().error, "academic_dependency");
  assert.deepEqual(blockedGrade.json<{ dependencies: string[] }>().dependencies, ["Classes"]);

  const healthAfterBlockedDelete = await app.inject({ method: "GET", url: "/health" });
  assert.equal(healthAfterBlockedDelete.statusCode, 200);
  const academicsAfterBlockedDelete = await app.inject({
    method: "GET",
    url: "/v1/admin/academics",
    headers: auth
  });
  assert.equal(academicsAfterBlockedDelete.statusCode, 200);

  const unusedSubject = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/subjects",
    headers: auth,
    payload: { code: "UNUSED-S", name: "Unused Subject" }
  });
  const unusedSubjectId = unusedSubject.json<{ subject: { id: string } }>().subject.id;
  const deleteUnusedSubject = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/subjects/${unusedSubjectId}`,
    headers: auth
  });
  assert.equal(deleteUnusedSubject.statusCode, 200);

  const teacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: auth,
    payload: { username: "safe.delete.teacher", role: "TEACHER" }
  });
  assert.equal(teacherAccount.statusCode, 201);
  const teacherId = teacherAccount.json<{ user: { id: string } }>().user.id;
  const teacherProfile = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/teachers",
    headers: auth,
    payload: { userId: teacherId, employeeCode: "SAFE-T", fullName: "Safe Delete Teacher" }
  });
  assert.equal(teacherProfile.statusCode, 201);

  const usedSubject = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/subjects",
    headers: auth,
    payload: { code: "USED-S", name: "Used Subject" }
  });
  const usedSubjectId = usedSubject.json<{ subject: { id: string } }>().subject.id;
  const assignment = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/assignments",
    headers: auth,
    payload: {
      academicYearId: yearId,
      teacherUserId: teacherId,
      subjectId: usedSubjectId,
      classId
    }
  });
  assert.equal(assignment.statusCode, 201);
  const assignmentId = assignment.json<{ assignment: { id: string } }>().assignment.id;

  const blockedSubject = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/subjects/${usedSubjectId}`,
    headers: auth
  });
  assert.equal(blockedSubject.statusCode, 409);
  assert.deepEqual(blockedSubject.json<{ dependencies: string[] }>().dependencies, ["Teacher assignments"]);

  const blockedTeacher = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/teachers/${teacherId}`,
    headers: auth
  });
  assert.equal(blockedTeacher.statusCode, 409);
  assert.deepEqual(blockedTeacher.json<{ dependencies: string[] }>().dependencies, ["Teacher assignments"]);

  const deleteAssignment = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/assignments/${assignmentId}`,
    headers: auth
  });
  assert.equal(deleteAssignment.statusCode, 200);

  const deleteSubject = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/subjects/${usedSubjectId}`,
    headers: auth
  });
  assert.equal(deleteSubject.statusCode, 200);

  const deleteTeacher = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/teachers/${teacherId}`,
    headers: auth
  });
  assert.equal(deleteTeacher.statusCode, 200);

  const deleteClass = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/classes/${classId}`,
    headers: auth
  });
  assert.equal(deleteClass.statusCode, 200);

  const deleteGrade = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/grades/${usedGradeId}`,
    headers: auth
  });
  assert.equal(deleteGrade.statusCode, 200);

  const activate = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${yearId}/activate`,
    headers: auth
  });
  assert.equal(activate.statusCode, 200);
  const close = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${yearId}/close`,
    headers: auth
  });
  assert.equal(close.statusCode, 200);
  const archive = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${yearId}/archive`,
    headers: auth
  });
  assert.equal(archive.statusCode, 200);
  const deleteYear = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/years/${yearId}`,
    headers: auth
  });
  assert.equal(deleteYear.statusCode, 200);

  const finalHealth = await app.inject({ method: "GET", url: "/health" });
  assert.equal(finalHealth.statusCode, 200);
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


test("parent account can own three students and sees all three through one login", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "FAMILY");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminAccessToken}` };

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1405", startDate: "2026-03-21", endDate: "2027-03-20" }
  });
  const yearId = yearResponse.json<{ academicYear: { id: string } }>().academicYear.id;
  await app.inject({ method: "POST", url: `/v1/admin/academics/years/${yearId}/activate`, headers: auth });

  const gradeResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "G7", name: "Grade 7", sortOrder: 7 }
  });
  const gradeId = gradeResponse.json<{ grade: { id: string } }>().grade.id;

  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "7A", name: "Grade 7 A" }
  });
  const classId = classResponse.json<{ class: { id: string } }>().class.id;

  const subjectResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/subjects",
    headers: auth,
    payload: { code: "MATH7", name: "Mathematics 7" }
  });
  assert.equal(subjectResponse.statusCode, 201);
  const subjectId = subjectResponse.json<{ subject: { id: string } }>().subject.id;

  const teacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: auth,
    payload: { username: "familyteacher", role: "TEACHER" }
  });
  assert.equal(teacherAccount.statusCode, 201);
  const teacherUserId = teacherAccount.json<{ user: { id: string } }>().user.id;

  const teacherProfile = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/teachers",
    headers: auth,
    payload: {
      userId: teacherUserId,
      employeeCode: "TFAMILY",
      fullName: "Family Teacher"
    }
  });
  assert.equal(teacherProfile.statusCode, 201);

  const assignment = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/assignments",
    headers: auth,
    payload: { academicYearId: yearId, classId, subjectId, teacherUserId }
  });
  assert.equal(assignment.statusCode, 201);

  const timetablePeriod = await app.inject({
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
  assert.equal(timetablePeriod.statusCode, 201);

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: auth,
    payload: { username: "familyparent", fullName: "Family Parent", phone: "0700000000" }
  });
  assert.equal(parentResponse.statusCode, 201);
  const parent = parentResponse.json<{
    user: { id: string };
    temporaryPassword: string;
  }>();

  const studentIds: string[] = [];
  for (let index = 1; index <= 3; index += 1) {
    const student = await app.inject({
      method: "POST",
      url: "/v1/admin/families/students",
      headers: auth,
      payload: {
        parentUserId: parent.user.id,
        studentCode: `S-00${index}`,
        fullName: `Student ${index}`,
        academicYearId: yearId,
        classId
      }
    });
    assert.equal(student.statusCode, 201);
    studentIds.push(student.json<{ student: { id: string } }>().student.id);
  }

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "familyparent",
      password: parent.temporaryPassword
    }
  });
  assert.equal(login.statusCode, 200);
  const loginBody = login.json<{ accessToken: string }>();

  const changed = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${loginBody.accessToken}` },
    payload: { newPassword: "ParentSecure2026!" }
  });
  assert.equal(changed.statusCode, 200);
  const parentAccess = changed.json<{ accessToken: string }>().accessToken;

  const home = await app.inject({
    method: "GET",
    url: "/v1/parent/home",
    headers: { authorization: `Bearer ${parentAccess}` }
  });
  assert.equal(home.statusCode, 200);
  const body = home.json<{ children: Array<{ student: { studentCode: string } }> }>();
  assert.equal(body.children.length, 3);
  assert.deepEqual(body.children.map((item) => item.student.studentCode), ["S-001", "S-002", "S-003"]);

  const timetable = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentIds[0]}/timetable`,
    headers: { authorization: `Bearer ${parentAccess}` }
  });
  assert.equal(timetable.statusCode, 200);
  const timetableBody = timetable.json<{
    periods: Array<{
      period: { weekday: string; startsAt: string; endsAt: string };
      subjectName: string;
      teacherName: string;
    }>;
  }>();
  assert.equal(timetableBody.periods.length, 1);
  assert.equal(timetableBody.periods[0]?.period.weekday, "SATURDAY");
  assert.equal(timetableBody.periods[0]?.period.startsAt, "08:00");
  assert.equal(timetableBody.periods[0]?.subjectName, "Mathematics 7");
  assert.equal(timetableBody.periods[0]?.teacherName, "Family Teacher");

  const familyOverview = await app.inject({
    method: "GET",
    url: "/v1/admin/families",
    headers: auth
  });
  assert.equal(familyOverview.statusCode, 200);
  const familyOverviewBody = familyOverview.json<{
    enrollments: Array<{ academicYear: { id: string }; student: { studentCode: string } }>;
  }>();
  assert.equal(
    familyOverviewBody.enrollments.filter((item) => item.academicYear.id === yearId).length,
    3
  );
});



test("family usernames are alphanumeric and empty parents can be deleted safely", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "FAMILYRULES");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminAccessToken}` };

  const invalidParent = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: auth,
    payload: { username: "parent.withdot", fullName: "Invalid Parent" }
  });
  assert.equal(invalidParent.statusCode, 400);
  assert.match(
    invalidParent.json<{ message: string }>().message,
    /only English letters and digits/i
  );

  const emptyParentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: auth,
    payload: { username: "emptyparent1", fullName: "Empty Parent" }
  });
  assert.equal(emptyParentResponse.statusCode, 201);
  const emptyParent = emptyParentResponse.json<{ user: { id: string } }>();

  const duplicate = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: auth,
    payload: { username: "emptyparent1", fullName: "Duplicate Parent" }
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(
    duplicate.json<{ message: string }>().message,
    "This username already exists. Please type another username."
  );

  const deleted = await app.inject({
    method: "DELETE",
    url: `/v1/admin/families/parents/${emptyParent.user.id}`,
    headers: auth
  });
  assert.equal(deleted.statusCode, 204);

  const overviewAfterDelete = await app.inject({
    method: "GET",
    url: "/v1/admin/families",
    headers: auth
  });
  assert.equal(overviewAfterDelete.statusCode, 200);
  assert.ok(
    !overviewAfterDelete
      .json<{ parents: Array<{ user: { id: string } }> }>()
      .parents.some((item) => item.user.id === emptyParent.user.id)
  );

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1406", startDate: "2027-03-21", endDate: "2028-03-19" }
  });
  const yearId = yearResponse.json<{ academicYear: { id: string } }>().academicYear.id;
  await app.inject({ method: "POST", url: `/v1/admin/academics/years/${yearId}/activate`, headers: auth });

  const gradeResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "G1", name: "Grade 1", sortOrder: 1 }
  });
  const gradeId = gradeResponse.json<{ grade: { id: string } }>().grade.id;

  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "1A", name: "Grade 1 A" }
  });
  const classId = classResponse.json<{ class: { id: string } }>().class.id;

  const linkedParentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: auth,
    payload: { username: "linkedparent1", fullName: "Linked Parent" }
  });
  const linkedParent = linkedParentResponse.json<{ user: { id: string } }>();

  const studentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/students",
    headers: auth,
    payload: {
      parentUserId: linkedParent.user.id,
      studentCode: "S-0001",
      fullName: "Linked Student",
      academicYearId: yearId,
      classId
    }
  });
  assert.equal(studentResponse.statusCode, 201);
  const studentId = studentResponse.json<{ student: { id: string } }>().student.id;

  const duplicateStudentCode = await app.inject({
    method: "POST",
    url: "/v1/admin/families/students",
    headers: auth,
    payload: {
      parentUserId: linkedParent.user.id,
      studentCode: "S-0001",
      fullName: "Duplicate Code Student",
      academicYearId: yearId,
      classId
    }
  });
  assert.equal(duplicateStudentCode.statusCode, 409);
  assert.equal(
    duplicateStudentCode.json<{ message: string }>().message,
    "That student code already exists in this school."
  );

  const overviewAfterDuplicateStudent = await app.inject({
    method: "GET",
    url: "/v1/admin/families",
    headers: auth
  });
  assert.equal(overviewAfterDuplicateStudent.statusCode, 200);
  assert.equal(
    overviewAfterDuplicateStudent
      .json<{ students: Array<{ student: { studentCode: string } }> }>()
      .students.filter((item) => item.student.studentCode === "S-0001").length,
    1
  );

  const invalidStudentUsername = await app.inject({
    method: "POST",
    url: `/v1/admin/families/students/${studentId}/account`,
    headers: auth,
    payload: { username: "student.withdot" }
  });
  assert.equal(invalidStudentUsername.statusCode, 400);
  assert.match(
    invalidStudentUsername.json<{ message: string }>().message,
    /only English letters and digits/i
  );

  const blockedDelete = await app.inject({
    method: "DELETE",
    url: `/v1/admin/families/parents/${linkedParent.user.id}`,
    headers: auth
  });
  assert.equal(blockedDelete.statusCode, 409);
  assert.equal(
    blockedDelete.json<{ message: string }>().message,
    "This parent cannot be deleted because students are linked to the account."
  );

  const studentAccount = await app.inject({
    method: "POST",
    url: `/v1/admin/families/students/${studentId}/account`,
    headers: auth,
    payload: { username: "linkedstudent1", phone: "0701234567" }
  });
  assert.equal(studentAccount.statusCode, 201);
  const studentAccountBody = studentAccount.json<{
    user: { id: string };
    student: { phone: string | null; fullName: string };
    temporaryPassword: string;
  }>();
  const studentUserId = studentAccountBody.user.id;
  assert.equal(studentAccountBody.student.phone, "0701234567");
  assert.equal(studentAccountBody.student.fullName, "Linked Student");
  assert.ok(studentAccountBody.temporaryPassword.length >= 8);

  const overviewWithStudentPhone = await app.inject({
    method: "GET",
    url: "/v1/admin/families",
    headers: auth
  });
  assert.equal(overviewWithStudentPhone.statusCode, 200);
  const linkedStudentOverview = overviewWithStudentPhone
    .json<{ students: Array<{ student: { id: string; phone: string | null } }> }>()
    .students.find((item) => item.student.id === studentId);
  assert.equal(linkedStudentOverview?.student.phone, "0701234567");

  const suspendStudent = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${studentUserId}/suspend`,
    headers: auth
  });
  assert.equal(suspendStudent.statusCode, 200);
  assert.equal(suspendStudent.json<{ user: { status: string } }>().user.status, "SUSPENDED");

  const reactivateStudent = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${studentUserId}/reactivate`,
    headers: auth
  });
  assert.equal(reactivateStudent.statusCode, 200);
  assert.notEqual(reactivateStudent.json<{ user: { status: string } }>().user.status, "SUSPENDED");

  const resetStudent = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${studentUserId}/reset-password`,
    headers: auth
  });
  assert.equal(resetStudent.statusCode, 200);
  assert.ok(resetStudent.json<{ temporaryPassword?: string }>().temporaryPassword);

  const deleteStudent = await app.inject({
    method: "DELETE",
    url: `/v1/admin/families/students/${studentId}`,
    headers: auth
  });
  assert.equal(deleteStudent.statusCode, 204);

  const overviewAfterStudentDelete = await app.inject({
    method: "GET",
    url: "/v1/admin/families",
    headers: auth
  });
  assert.equal(overviewAfterStudentDelete.statusCode, 200);
  assert.ok(
    !overviewAfterStudentDelete
      .json<{ students: Array<{ student: { id: string } }> }>()
      .students.some((item) => item.student.id === studentId)
  );

  const deleteParentAfterStudent = await app.inject({
    method: "DELETE",
    url: `/v1/admin/families/parents/${linkedParent.user.id}`,
    headers: auth
  });
  assert.equal(deleteParentAfterStudent.statusCode, 204);
});


test("bulk student import validation reports duplicate rows without committing them", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "IMPORT");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminAccessToken}` };

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1405", startDate: "2026-03-21", endDate: "2027-03-20" }
  });
  const yearId = yearResponse.json<{ academicYear: { id: string } }>().academicYear.id;
  await app.inject({ method: "POST", url: `/v1/admin/academics/years/${yearId}/activate`, headers: auth });

  const gradeResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "G8", name: "Grade 8", sortOrder: 8 }
  });
  const gradeId = gradeResponse.json<{ grade: { id: string } }>().grade.id;

  await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "8A", name: "Grade 8 A" }
  });

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: auth,
    payload: { username: "importparent", fullName: "Import Parent" }
  });
  assert.equal(parentResponse.statusCode, 201);

  const rows = [
    { username: "importstudent1", code: "IMP-001", name: "Student One", parent: "importparent", year: "1405", class: "8A" },
    { username: "importstudent2", code: "IMP-001", name: "Student Duplicate", parent: "importparent", year: "1405", class: "8A" }
  ];
  const validation = await app.inject({
    method: "POST",
    url: "/v1/admin/families/import/validate",
    headers: auth,
    payload: {
      entityType: "STUDENT",
      rows,
      mapping: {
        username: "username",
        studentCode: "code",
        fullName: "name",
        parentUsername: "parent",
        academicYear: "year",
        classCode: "class"
      }
    }
  });
  assert.equal(validation.statusCode, 200);
  const validationBody = validation.json<{
    valid: boolean;
    validRowCount: number;
    errors: Array<{ row: number; field?: string }>;
  }>();
  assert.equal(validationBody.valid, false);
  assert.equal(validationBody.validRowCount, 1);
  assert.ok(validationBody.errors.some((item) => item.row === 3 && item.field === "studentCode"));

  const overview = await app.inject({
    method: "GET",
    url: "/v1/admin/families",
    headers: auth
  });
  assert.equal(overview.statusCode, 200);
  assert.equal(overview.json<{ students: unknown[] }>().students.length, 0);
});


test("Negaran submits daily attendance once, duplicate retry is idempotent, and parent sees state plus alert", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "ATTENDANCE");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const admin = { authorization: `Bearer ${adminToken}` };

  const teacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: admin,
    payload: { username: "teacher.negaran", role: "TEACHER" }
  });
  assert.equal(teacherAccount.statusCode, 201);
  const teacherBody = teacherAccount.json<{ user: { id: string }; temporaryPassword: string }>();
  const teacherId = teacherBody.user.id;

  const year = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: admin,
    payload: { name: "1405", startDate: "2026-03-21", endDate: "2027-03-20" }
  });
  const yearId = year.json<{ academicYear: { id: string } }>().academicYear.id;
  await app.inject({ method: "POST", url: `/v1/admin/academics/years/${yearId}/activate`, headers: admin });

  const grade = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: admin,
    payload: { code: "G9", name: "Grade 9", sortOrder: 9 }
  });
  const gradeId = grade.json<{ grade: { id: string } }>().grade.id;

  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: admin,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "9A", name: "Grade 9 A" }
  });
  const classId = classResponse.json<{ class: { id: string } }>().class.id;

  await app.inject({
    method: "POST",
    url: "/v1/admin/academics/teachers",
    headers: admin,
    payload: { userId: teacherId, employeeCode: "T-N-1", fullName: "Negaran Teacher" }
  });
  await app.inject({
    method: "POST",
    url: "/v1/admin/academics/negaran",
    headers: admin,
    payload: { academicYearId: yearId, classId, teacherUserId: teacherId, startDate: "2026-03-21" }
  });

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: admin,
    payload: { username: "attendanceparent", fullName: "Attendance Parent" }
  });
  assert.equal(parentResponse.statusCode, 201);
  const parentBody = parentResponse.json<{ user: { id: string }; temporaryPassword: string }>();

  const studentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/students",
    headers: admin,
    payload: {
      parentUserId: parentBody.user.id,
      studentCode: "ATT-001",
      fullName: "Attendance Student",
      academicYearId: yearId,
      classId
    }
  });
  assert.equal(studentResponse.statusCode, 201);
  const studentId = studentResponse.json<{ student: { id: string } }>().student.id;

  const teacherLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "TEACHER",
      username: "teacher.negaran",
      password: teacherBody.temporaryPassword
    }
  });
  const teacherChanged = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${teacherLogin.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "TeacherSecure2026!" }
  });
  const teacherToken = teacherChanged.json<{ accessToken: string }>().accessToken;
  const teacherAuth = { authorization: `Bearer ${teacherToken}` };

  const todayResponse = await app.inject({ method: "GET", url: "/v1/teacher/today", headers: teacherAuth });
  assert.equal(todayResponse.statusCode, 200);
  const today = todayResponse.json<{ date: string; supervisedClasses: Array<{ classId: string; attendanceStatus: string }> }>();
  assert.equal(today.supervisedClasses[0]?.classId, classId);
  assert.equal(today.supervisedClasses[0]?.attendanceStatus, "PENDING");

  const payload = {
    classId,
    date: today.date,
    entries: [{ studentId, status: "ABSENT" }]
  };
  const submitted = await app.inject({
    method: "POST",
    url: "/v1/teacher/negaran/attendance",
    headers: teacherAuth,
    payload
  });
  assert.equal(submitted.statusCode, 201);
  assert.equal(submitted.json<{ changed: boolean; notificationCount: number }>().changed, true);
  assert.equal(submitted.json<{ changed: boolean; notificationCount: number }>().notificationCount, 1);

  const retried = await app.inject({
    method: "POST",
    url: "/v1/teacher/negaran/attendance",
    headers: teacherAuth,
    payload
  });
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.json<{ changed: boolean; notificationCount: number }>().changed, false);
  assert.equal(retried.json<{ changed: boolean; notificationCount: number }>().notificationCount, 0);

  const parentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "attendanceparent",
      password: parentBody.temporaryPassword
    }
  });
  const parentChanged = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${parentLogin.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "ParentAttendance2026!" }
  });
  const parentToken = parentChanged.json<{ accessToken: string }>().accessToken;
  const parentAuth = { authorization: `Bearer ${parentToken}` };

  const parentAttendance = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/attendance`,
    headers: parentAuth
  });
  assert.equal(parentAttendance.statusCode, 200);
  const parentAttendanceBody = parentAttendance.json<{ today: string; days: Array<{ status: string }> }>();
  assert.equal(parentAttendanceBody.today, today.date);
  assert.equal(parentAttendanceBody.days[0]?.status, "ABSENT");

  const alerts = await app.inject({
    method: "GET",
    url: "/v1/parent/notifications",
    headers: parentAuth
  });
  assert.equal(alerts.statusCode, 200);
  assert.equal(alerts.json<{ notifications: Array<{ type: string }> }>().notifications[0]?.type, "ATTENDANCE_ABSENT");

  const corrected = await app.inject({
    method: "PATCH",
    url: `/v1/admin/attendance/${submitted.json<{ sheet: { attendance: { id: string } } }>().sheet.attendance.id}/students/${studentId}`,
    headers: admin,
    payload: { status: "PRESENT", note: "Corrected by school admin" }
  });
  assert.equal(corrected.statusCode, 200);
  assert.equal(corrected.json<{ previousStatus: string; entry: { status: string } }>().previousStatus, "ABSENT");
  assert.equal(corrected.json<{ entry: { status: string } }>().entry.status, "PRESENT");

  const parentAfterCorrection = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/attendance`,
    headers: parentAuth
  });
  assert.equal(parentAfterCorrection.json<{ days: Array<{ status: string }> }>().days[0]?.status, "PRESENT");
});

test("teacher without Negaran assignment cannot access another class attendance", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "NO-NEGARAN");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const admin = { authorization: `Bearer ${adminToken}` };

  const teacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: admin,
    payload: { username: "teacher.other", role: "TEACHER" }
  });
  const teacher = teacherAccount.json<{ user: { id: string }; temporaryPassword: string }>();

  const year = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: admin,
    payload: { name: "1405", startDate: "2026-03-21", endDate: "2027-03-20" }
  });
  const yearId = year.json<{ academicYear: { id: string } }>().academicYear.id;
  await app.inject({ method: "POST", url: `/v1/admin/academics/years/${yearId}/activate`, headers: admin });

  const grade = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: admin,
    payload: { code: "G10", name: "Grade 10", sortOrder: 10 }
  });
  const gradeId = grade.json<{ grade: { id: string } }>().grade.id;
  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: admin,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "10A", name: "Grade 10 A" }
  });
  const classId = classResponse.json<{ class: { id: string } }>().class.id;

  await app.inject({
    method: "POST",
    url: "/v1/admin/academics/teachers",
    headers: admin,
    payload: { userId: teacher.user.id, employeeCode: "T-OTHER", fullName: "Other Teacher" }
  });

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "TEACHER",
      username: "teacher.other",
      password: teacher.temporaryPassword
    }
  });
  const changed = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${login.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "OtherTeacher2026!" }
  });
  const accessToken = changed.json<{ accessToken: string }>().accessToken;
  const today = new Date().toISOString().slice(0, 10);

  const sheet = await app.inject({
    method: "GET",
    url: `/v1/teacher/negaran/${classId}/attendance?date=${today}`,
    headers: { authorization: `Bearer ${accessToken}` }
  });
  assert.equal(sheet.statusCode, 400);
  assert.equal(sheet.json<{ error: string }>().error, "attendance_validation");
});


test("homework stays private as draft, then becomes visible to parent and linked student after publish", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "LEARN-HW");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const admin = { authorization: `Bearer ${adminToken}` };

  const teacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: admin,
    payload: { username: "teacher.homework", role: "TEACHER" }
  });
  assert.equal(teacherAccount.statusCode, 201);
  const teacherBody = teacherAccount.json<{ user: { id: string }; temporaryPassword: string }>();

  const year = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: admin,
    payload: { name: "1406", startDate: "2027-03-21", endDate: "2028-03-20" }
  });
  const yearId = year.json<{ academicYear: { id: string } }>().academicYear.id;
  await app.inject({ method: "POST", url: `/v1/admin/academics/years/${yearId}/activate`, headers: admin });

  const grade = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: admin,
    payload: { code: "G6", name: "Grade 6", sortOrder: 6 }
  });
  const gradeId = grade.json<{ grade: { id: string } }>().grade.id;

  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: admin,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "6A", name: "Grade 6 A" }
  });
  const classId = classResponse.json<{ class: { id: string } }>().class.id;

  const subject = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/subjects",
    headers: admin,
    payload: { code: "SCI", name: "Science" }
  });
  const subjectId = subject.json<{ subject: { id: string } }>().subject.id;

  await app.inject({
    method: "POST",
    url: "/v1/admin/academics/teachers",
    headers: admin,
    payload: { userId: teacherBody.user.id, employeeCode: "T-HW", fullName: "Homework Teacher" }
  });
  const assignment = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/assignments",
    headers: admin,
    payload: { academicYearId: yearId, classId, subjectId, teacherUserId: teacherBody.user.id }
  });
  const assignmentId = assignment.json<{ assignment: { id: string } }>().assignment.id;

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: admin,
    payload: { username: "learnparent", fullName: "Learning Parent" }
  });
  const parent = parentResponse.json<{ user: { id: string }; temporaryPassword: string }>();

  const studentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/students",
    headers: admin,
    payload: {
      parentUserId: parent.user.id,
      studentCode: "LRN-001",
      fullName: "Learning Student",
      academicYearId: yearId,
      classId
    }
  });
  const studentId = studentResponse.json<{ student: { id: string } }>().student.id;

  const studentAccount = await app.inject({
    method: "POST",
    url: `/v1/admin/families/students/${studentId}/account`,
    headers: admin,
    payload: { username: "studentlearning" }
  });
  assert.equal(studentAccount.statusCode, 201);
  const studentCredential = studentAccount.json<{ temporaryPassword: string }>();

  const teacherLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "TEACHER",
      username: "teacher.homework",
      password: teacherBody.temporaryPassword
    }
  });
  const teacherChanged = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${teacherLogin.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "HomeworkTeacher2027!" }
  });
  const teacherAuth = { authorization: `Bearer ${teacherChanged.json<{ accessToken: string }>().accessToken}` };

  const parentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "learnparent",
      password: parent.temporaryPassword
    }
  });
  const parentChanged = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${parentLogin.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "LearningParent2027!" }
  });
  const parentAuth = { authorization: `Bearer ${parentChanged.json<{ accessToken: string }>().accessToken}` };

  const studentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "STUDENT",
      username: "studentlearning",
      password: studentCredential.temporaryPassword
    }
  });
  const studentChanged = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${studentLogin.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "LearningStudent2027!" }
  });
  const studentAuth = { authorization: `Bearer ${studentChanged.json<{ accessToken: string }>().accessToken}` };

  const created = await app.inject({
    method: "POST",
    url: "/v1/teacher/homework",
    headers: teacherAuth,
    payload: {
      assignmentId,
      title: "Read chapter 3",
      content: "Read chapter 3 and answer the review questions.",
      dueAt: "2099-12-31T12:00:00Z"
    }
  });
  assert.equal(created.statusCode, 201);
  const homeworkId = created.json<{ homework: { id: string; status: string } }>().homework.id;
  assert.equal(created.json<{ homework: { status: string } }>().homework.status, "DRAFT");

  const parentDraft = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  assert.equal(parentDraft.statusCode, 200);
  assert.equal(parentDraft.json<{ homework: unknown[] }>().homework.length, 0);

  const studentDraft = await app.inject({ method: "GET", url: "/v1/student/home", headers: studentAuth });
  assert.equal(studentDraft.statusCode, 200);
  assert.equal(studentDraft.json<{ homework: unknown[] }>().homework.length, 0);

  const published = await app.inject({
    method: "POST",
    url: `/v1/teacher/homework/${homeworkId}/publish`,
    headers: teacherAuth
  });
  assert.equal(published.statusCode, 200);

  const parentPublished = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  assert.equal(parentPublished.json<{ homework: Array<{ homework: { title: string } }> }>().homework[0]?.homework.title, "Read chapter 3");

  const studentPublished = await app.inject({ method: "GET", url: "/v1/student/home", headers: studentAuth });
  assert.equal(studentPublished.json<{ homework: Array<{ homework: { title: string } }> }>().homework[0]?.homework.title, "Read chapter 3");
});

test("draft grades are hidden until admin publishes the complete exam, and unrelated teachers cannot grade", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "LEARN-EXAM");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const admin = { authorization: `Bearer ${adminToken}` };

  async function createTeacher(username: string, employeeCode: string) {
    const account = await app.inject({
      method: "POST",
      url: "/v1/admin/users",
      headers: admin,
      payload: { username, role: "TEACHER" }
    });
    const body = account.json<{ user: { id: string }; temporaryPassword: string }>();
    await app.inject({
      method: "POST",
      url: "/v1/admin/academics/teachers",
      headers: admin,
      payload: { userId: body.user.id, employeeCode, fullName: username }
    });
    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { schoolId, expectedRole: "TEACHER", username, password: body.temporaryPassword }
    });
    const changed = await app.inject({
      method: "POST",
      url: "/v1/auth/change-temporary-password",
      headers: { authorization: `Bearer ${login.json<{ accessToken: string }>().accessToken}` },
      payload: { newPassword: `${employeeCode}Secure2027!` }
    });
    return { userId: body.user.id, auth: { authorization: `Bearer ${changed.json<{ accessToken: string }>().accessToken}` } };
  }

  const year = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: admin,
    payload: { name: "1407", startDate: "2028-03-21", endDate: "2029-03-20" }
  });
  const yearId = year.json<{ academicYear: { id: string } }>().academicYear.id;
  await app.inject({ method: "POST", url: `/v1/admin/academics/years/${yearId}/activate`, headers: admin });

  const grade = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: admin,
    payload: { code: "G5", name: "Grade 5", sortOrder: 5 }
  });
  const gradeId = grade.json<{ grade: { id: string } }>().grade.id;
  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: admin,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "5A", name: "Grade 5 A" }
  });
  const classId = classResponse.json<{ class: { id: string } }>().class.id;
  const subject = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/subjects",
    headers: admin,
    payload: { code: "MATH5", name: "Mathematics 5" }
  });
  const subjectId = subject.json<{ subject: { id: string } }>().subject.id;

  const assignedTeacher = await createTeacher("teacher.marks", "TMARK");
  const unrelatedTeacher = await createTeacher("teacher.unrelated", "TOTHER");

  await app.inject({
    method: "POST",
    url: "/v1/admin/academics/assignments",
    headers: admin,
    payload: { academicYearId: yearId, classId, subjectId, teacherUserId: assignedTeacher.userId }
  });

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: admin,
    payload: { username: "marksparent", fullName: "Marks Parent" }
  });
  const parent = parentResponse.json<{ user: { id: string }; temporaryPassword: string }>();
  const studentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/students",
    headers: admin,
    payload: {
      parentUserId: parent.user.id,
      studentCode: "MRK-001",
      fullName: "Marks Student",
      academicYearId: yearId,
      classId
    }
  });
  const studentId = studentResponse.json<{ student: { id: string } }>().student.id;

  const studentAccount = await app.inject({
    method: "POST",
    url: `/v1/admin/families/students/${studentId}/account`,
    headers: admin,
    payload: { username: "marksstudent" }
  });
  assert.equal(studentAccount.statusCode, 201);
  const studentCredential = studentAccount.json<{ temporaryPassword: string }>();

  const studentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "STUDENT",
      username: "marksstudent",
      password: studentCredential.temporaryPassword
    }
  });
  assert.equal(studentLogin.statusCode, 200);
  const studentChanged = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${studentLogin.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "MarksStudent2028!" }
  });
  assert.equal(studentChanged.statusCode, 200);
  const studentAuth = { authorization: `Bearer ${studentChanged.json<{ accessToken: string }>().accessToken}` };

  const parentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { schoolId, expectedRole: "PARENT", username: "marksparent", password: parent.temporaryPassword }
  });
  const parentChanged = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${parentLogin.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "MarksParent2028!" }
  });
  const parentAuth = { authorization: `Bearer ${parentChanged.json<{ accessToken: string }>().accessToken}` };

  const exam = await app.inject({
    method: "POST",
    url: "/v1/admin/exams",
    headers: admin,
    payload: { academicYearId: yearId, name: "Midyear", type: "MIDYEAR" }
  });
  const examId = exam.json<{ exam: { id: string } }>().exam.id;
  const examSubject = await app.inject({
    method: "POST",
    url: "/v1/admin/exam-subjects",
    headers: admin,
    payload: { examId, subjectId, classId, maxScore: 100 }
  });
  const examSubjectId = examSubject.json<{ examSubject: { id: string } }>().examSubject.id;

  await app.inject({
    method: "POST",
    url: `/v1/admin/exams/${examId}/status`,
    headers: admin,
    payload: { status: "SCHEDULED" }
  });
  await app.inject({
    method: "POST",
    url: `/v1/admin/exams/${examId}/status`,
    headers: admin,
    payload: { status: "IN_PROGRESS" }
  });

  const unrelated = await app.inject({
    method: "GET",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: unrelatedTeacher.auth
  });
  assert.equal(unrelated.statusCode, 400);
  assert.equal(unrelated.json<{ error: string }>().error, "learning_validation");

  const invalidScore = await app.inject({
    method: "POST",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: assignedTeacher.auth,
    payload: { entries: [{ studentId, score: 101 }] }
  });
  assert.equal(invalidScore.statusCode, 400);

  const save = await app.inject({
    method: "POST",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: assignedTeacher.auth,
    payload: { entries: [{ studentId, score: 88, remark: "Good work" }] }
  });
  assert.equal(save.statusCode, 200);

  const parentDraft = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  assert.equal(parentDraft.statusCode, 200);
  assert.equal(parentDraft.json<{ results: unknown[] }>().results.length, 0);

  const studentDraft = await app.inject({
    method: "GET",
    url: "/v1/student/home",
    headers: studentAuth
  });
  assert.equal(studentDraft.statusCode, 200);
  assert.equal(studentDraft.json<{ results: unknown[] }>().results.length, 0);

  const ready = await app.inject({
    method: "POST",
    url: `/v1/admin/exams/${examId}/status`,
    headers: admin,
    payload: { status: "RESULTS_READY" }
  });
  assert.equal(ready.statusCode, 200);

  const beforePublish = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  assert.equal(beforePublish.json<{ results: unknown[] }>().results.length, 0);

  const studentBeforePublish = await app.inject({
    method: "GET",
    url: "/v1/student/home",
    headers: studentAuth
  });
  assert.equal(studentBeforePublish.json<{ results: unknown[] }>().results.length, 0);

  const publish = await app.inject({
    method: "POST",
    url: `/v1/admin/exams/${examId}/publish`,
    headers: admin
  });
  assert.equal(publish.statusCode, 200);

  const parentPublished = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  const results = parentPublished.json<{ results: Array<{ grade: { id: string; score: number; status: string } }> }>().results;
  assert.equal(results.length, 1);
  assert.equal(results[0]?.grade.score, 88);
  assert.equal(results[0]?.grade.status, "PUBLISHED");

  const studentPublished = await app.inject({
    method: "GET",
    url: "/v1/student/home",
    headers: studentAuth
  });
  const studentResults = studentPublished.json<{ results: Array<{ grade: { score: number; status: string } }> }>().results;
  assert.equal(studentResults.length, 1);
  assert.equal(studentResults[0]?.grade.score, 88);
  assert.equal(studentResults[0]?.grade.status, "PUBLISHED");

  const resultAlerts = await app.inject({
    method: "GET",
    url: "/v1/parent/notifications",
    headers: parentAuth
  });
  assert.ok(
    resultAlerts
      .json<{ notifications: Array<{ type: string }> }>()
      .notifications.some((notification) => notification.type === "RESULTS_PUBLISHED")
  );

  const corrected = await app.inject({
    method: "PATCH",
    url: `/v1/admin/grades/${results[0]!.grade.id}/correct`,
    headers: admin,
    payload: { score: 91, remark: "Reviewed", reason: "Verified scoring correction" }
  });
  assert.equal(corrected.statusCode, 200);
  assert.equal(corrected.json<{ previousScore: number; grade: { score: number } }>().previousScore, 88);
  assert.equal(corrected.json<{ grade: { score: number } }>().grade.score, 91);

  const parentCorrected = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  assert.equal(
    parentCorrected.json<{ results: Array<{ grade: { score: number } }> }>().results[0]?.grade.score,
    91
  );
});


async function activateRoleLogin(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  schoolId: string,
  role: "PARENT" | "TEACHER" | "STUDENT",
  username: string,
  temporaryPassword: string,
  permanentPassword: string
) {
  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { schoolId, expectedRole: role, username, password: temporaryPassword }
  });
  assert.equal(login.statusCode, 200);
  const changed = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${login.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: permanentPassword }
  });
  assert.equal(changed.statusCode, 200);
  return changed.json<{ accessToken: string }>().accessToken;
}

test("Phase 7 class announcements stay inside the intended class and fee payments use immutable reversals", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "COMM7");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const admin = { authorization: `Bearer ${adminToken}` };

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: admin,
    payload: { name: "1405", startDate: "2026-03-21", endDate: "2027-03-20" }
  });
  const yearId = yearResponse.json<{ academicYear: { id: string } }>().academicYear.id;
  await app.inject({ method: "POST", url: `/v1/admin/academics/years/${yearId}/activate`, headers: admin });

  const gradeResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: admin,
    payload: { code: "G11", name: "Grade 11", sortOrder: 11 }
  });
  const gradeId = gradeResponse.json<{ grade: { id: string } }>().grade.id;

  const classAResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: admin,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "11A", name: "Grade 11 A" }
  });
  const classBResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: admin,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "11B", name: "Grade 11 B" }
  });
  const classA = classAResponse.json<{ class: { id: string } }>().class.id;
  const classB = classBResponse.json<{ class: { id: string } }>().class.id;

  const parentAResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: admin,
    payload: { username: "classaparent", fullName: "Class A Parent" }
  });
  const parentBResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: admin,
    payload: { username: "classbparent", fullName: "Class B Parent" }
  });
  const parentA = parentAResponse.json<{ user: { id: string }; temporaryPassword: string }>();
  const parentB = parentBResponse.json<{ user: { id: string }; temporaryPassword: string }>();

  const studentAResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/students",
    headers: admin,
    payload: {
      parentUserId: parentA.user.id,
      studentCode: "C7-A",
      fullName: "Class A Student",
      academicYearId: yearId,
      classId: classA
    }
  });
  await app.inject({
    method: "POST",
    url: "/v1/admin/families/students",
    headers: admin,
    payload: {
      parentUserId: parentB.user.id,
      studentCode: "C7-B",
      fullName: "Class B Student",
      academicYearId: yearId,
      classId: classB
    }
  });
  const studentA = studentAResponse.json<{ student: { id: string } }>().student;

  const parentAToken = await activateRoleLogin(
    app, schoolId, "PARENT", "classaparent", parentA.temporaryPassword, "ClassAParent2026!"
  );
  const parentBToken = await activateRoleLogin(
    app, schoolId, "PARENT", "classbparent", parentB.temporaryPassword, "ClassBParent2026!"
  );

  const announcement = await app.inject({
    method: "POST",
    url: "/v1/admin/announcements",
    headers: admin,
    payload: {
      title: "Class A meeting",
      content: "This message belongs only to Grade 11 A.",
      audienceScope: "CLASS",
      classId: classA
    }
  });
  assert.equal(announcement.statusCode, 201);

  const classAAnnouncements = await app.inject({
    method: "GET",
    url: "/v1/announcements",
    headers: { authorization: `Bearer ${parentAToken}` }
  });
  const classBAnnouncements = await app.inject({
    method: "GET",
    url: "/v1/announcements",
    headers: { authorization: `Bearer ${parentBToken}` }
  });
  assert.equal(classAAnnouncements.statusCode, 200);
  assert.equal(classBAnnouncements.statusCode, 200);
  assert.equal(classAAnnouncements.json<{ announcements: unknown[] }>().announcements.length, 1);
  assert.equal(classBAnnouncements.json<{ announcements: unknown[] }>().announcements.length, 0);

  const classANotifications = await app.inject({
    method: "GET",
    url: "/v1/notifications",
    headers: { authorization: `Bearer ${parentAToken}` }
  });
  const classBNotifications = await app.inject({
    method: "GET",
    url: "/v1/notifications",
    headers: { authorization: `Bearer ${parentBToken}` }
  });
  assert.equal(
    classANotifications.json<{ notifications: Array<{ type: string }> }>().notifications.filter((item) => item.type === "ANNOUNCEMENT").length,
    1
  );
  assert.equal(
    classBNotifications.json<{ notifications: Array<{ type: string }> }>().notifications.filter((item) => item.type === "ANNOUNCEMENT").length,
    0
  );

  const invoiceResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/fees/invoices",
    headers: admin,
    payload: {
      studentId: studentA.id,
      amount: 1000,
      dueDate: "2099-12-31",
      description: "Tuition"
    }
  });
  assert.equal(invoiceResponse.statusCode, 201);
  const invoiceId = invoiceResponse.json<{ invoice: { id: string } }>().invoice.id;

  const issued = await app.inject({
    method: "POST",
    url: `/v1/admin/fees/invoices/${invoiceId}/issue`,
    headers: admin
  });
  assert.equal(issued.statusCode, 200);

  const paymentResponse = await app.inject({
    method: "POST",
    url: `/v1/admin/fees/invoices/${invoiceId}/payments`,
    headers: admin,
    payload: { amount: 400, method: "CASH", transactionReference: "RCPT-001" }
  });
  assert.equal(paymentResponse.statusCode, 201);
  const paidView = paymentResponse.json<{
    paid: number;
    outstanding: number;
    invoice: { status: string };
    payments: Array<{ id: string; kind: string }>;
  }>();
  assert.equal(paidView.paid, 400);
  assert.equal(paidView.outstanding, 600);
  assert.equal(paidView.invoice.status, "PARTIALLY_PAID");
  const paymentId = paidView.payments.find((item) => item.kind === "PAYMENT")?.id;
  assert.ok(paymentId);

  const reversed = await app.inject({
    method: "POST",
    url: `/v1/admin/fees/payments/${paymentId}/reverse`,
    headers: admin,
    payload: { reason: "Cash entry was recorded against the wrong receipt." }
  });
  assert.equal(reversed.statusCode, 201);
  const reversedView = reversed.json<{
    paid: number;
    outstanding: number;
    invoice: { status: string };
    payments: Array<{ kind: string; reversalOfPaymentId: string | null }>;
  }>();
  assert.equal(reversedView.paid, 0);
  assert.equal(reversedView.outstanding, 1000);
  assert.equal(reversedView.invoice.status, "ISSUED");
  assert.equal(reversedView.payments.length, 2);
  assert.ok(reversedView.payments.some((item) => item.kind === "REVERSAL" && item.reversalOfPaymentId === paymentId));

  const secondReversal = await app.inject({
    method: "POST",
    url: `/v1/admin/fees/payments/${paymentId}/reverse`,
    headers: admin,
    payload: { reason: "Duplicate reversal should fail." }
  });
  assert.equal(secondReversal.statusCode, 409);

  const parentFees = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentA.id}/fees`,
    headers: { authorization: `Bearer ${parentAToken}` }
  });
  assert.equal(parentFees.statusCode, 200);
  assert.equal(parentFees.json<{ invoices: Array<{ outstanding: number }> }>().invoices[0]?.outstanding, 1000);
});


test("Phase 8 pilot onboarding works without direct database manipulation", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const onboard = await app.inject({
    method: "POST",
    url: "/v1/platform/pilot/onboard",
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: {
      school: {
        code: "PILOT8",
        name: "Phase 8 Pilot School",
        slug: "phase-8-pilot-school",
        province: "Kabul",
        city: "Kabul",
        defaultLanguage: "fa-AF"
      },
      adminUsername: "pilot.admin",
      subscription: {
        status: "ACTIVE",
        planCode: "PILOT-ANNUAL",
        billingCycle: "ANNUAL",
        priceAfn: 0
      }
    }
  });
  assert.equal(onboard.statusCode, 201);
  const body = onboard.json<{
    school: { id: string };
    subscription: { status: string };
    admin: { username: string };
    temporaryPassword: string;
  }>();
  assert.equal(body.subscription.status, "ACTIVE");
  assert.equal(body.admin.username, "pilot.admin");

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId: body.school.id,
      expectedRole: "SCHOOL_ADMIN",
      username: "pilot.admin",
      password: body.temporaryPassword
    }
  });
  assert.equal(login.statusCode, 200);
});

test("Phase 8 subscription suspension blocks end users and operational admin writes but preserves billing and export access", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "SUSPEND8");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const admin = { authorization: `Bearer ${adminToken}` };

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: admin,
    payload: { username: "suspendparent", fullName: "Suspended Parent" }
  });
  assert.equal(parentResponse.statusCode, 201);
  const parent = parentResponse.json<{ temporaryPassword: string }>();

  const parentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "suspendparent",
      password: parent.temporaryPassword
    }
  });
  assert.equal(parentLogin.statusCode, 200);
  const changed = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${parentLogin.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "SuspendedParent2026!" }
  });
  assert.equal(changed.statusCode, 200);
  const parentAccess = changed.json<{ accessToken: string }>().accessToken;

  const suspended = await app.inject({
    method: "PATCH",
    url: `/v1/platform/schools/${schoolId}/subscription`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { status: "SUSPENDED" }
  });
  assert.equal(suspended.statusCode, 200);

  const parentMe = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: `Bearer ${parentAccess}` }
  });
  assert.equal(parentMe.statusCode, 503);
  assert.equal(parentMe.json<{ error: string }>().error, "school_service_unavailable");

  const blockedParentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "suspendparent",
      password: "SuspendedParent2026!"
    }
  });
  assert.equal(blockedParentLogin.statusCode, 503);
  assert.equal(
    blockedParentLogin.json<{ error: string }>().error,
    "school_service_unavailable"
  );

  const contactDuringSubscriptionSuspension = await app.inject({
    method: "GET",
    url: "/v1/school/admin-contact",
    headers: { authorization: `Bearer ${parentAccess}` }
  });
  assert.equal(contactDuringSubscriptionSuspension.statusCode, 200);

  const adminWrite = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: admin,
    payload: { username: "blocked.teacher", role: "TEACHER" }
  });
  assert.equal(adminWrite.statusCode, 403);
  assert.equal(adminWrite.json<{ error: string }>().error, "subscription_write_blocked");

  const subscription = await app.inject({
    method: "GET",
    url: "/v1/admin/subscription",
    headers: admin
  });
  assert.equal(subscription.statusCode, 200);
  assert.equal(subscription.json<{ subscription: { status: string } }>().subscription.status, "SUSPENDED");

  const exported = await app.inject({
    method: "GET",
    url: "/v1/admin/pilot/export",
    headers: admin
  });
  assert.equal(exported.statusCode, 200);
  assert.equal(exported.body.includes("passwordHash"), false);
});

test("Phase 8 readiness, audit pagination, import templates, and database readiness are available to school admins", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const ready = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.json<{ database: string }>().database, "ok");

  const metrics = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(metrics.statusCode, 200);
  assert.match(metrics.body, /maktablink_database_ready 1/);
  assert.match(metrics.body, /maktablink_http_requests_total/);

  const schoolId = await provisionSchool(app, "READY8");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminToken}` };

  const readiness = await app.inject({
    method: "GET",
    url: "/v1/admin/pilot/readiness",
    headers: auth
  });
  assert.equal(readiness.statusCode, 200);
  assert.equal(typeof readiness.json<{ ready: boolean }>().ready, "boolean");

  const audit = await app.inject({
    method: "GET",
    url: "/v1/admin/audit?limit=1&offset=0",
    headers: auth
  });
  assert.equal(audit.statusCode, 200);
  assert.equal(audit.json<{ logs: unknown[]; limit: number }>().limit, 1);
  assert.ok(audit.json<{ logs: unknown[] }>().logs.length <= 1);

  const template = await app.inject({
    method: "GET",
    url: "/v1/admin/pilot/import-template/STUDENT",
    headers: auth
  });
  assert.equal(template.statusCode, 200);
  assert.match(template.body, /studentCode,fullName,parentUsername,academicYear,classCode/);
});


test("Phase 8 subscription expiry reminders are idempotent across repeated scheduler runs", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "SUBREM8");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);
  const grace = new Date(today.getTime() + 15 * 86_400_000).toISOString().slice(0, 10);

  const updated = await app.inject({
    method: "PATCH",
    url: `/v1/platform/schools/${schoolId}/subscription`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: {
      status: "ACTIVE",
      expiresOn: tomorrow,
      graceEndsOn: grace
    }
  });
  assert.equal(updated.statusCode, 200);

  const first = await app.inject({
    method: "POST",
    url: "/v1/platform/jobs/subscriptions/run",
    headers: { "x-platform-provisioning-key": provisioningKey }
  });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json<{ remindersCreated: number }>().remindersCreated, 1);

  const second = await app.inject({
    method: "POST",
    url: "/v1/platform/jobs/subscriptions/run",
    headers: { "x-platform-provisioning-key": provisioningKey }
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.json<{ remindersCreated: number }>().remindersCreated, 0);

  const notifications = await app.inject({
    method: "GET",
    url: "/v1/notifications",
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(notifications.statusCode, 200);
  const expiryAlerts = notifications
    .json<{ notifications: Array<{ type: string }> }>()
    .notifications.filter((item) => item.type === "SUBSCRIPTION_EXPIRING");
  assert.equal(expiryAlerts.length, 1);
});


test("admin reset and suspend actions succeed atomically and directory includes profile data", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "ACCOUNT-ACTIONS");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminAccessToken}` };

  const teacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: auth,
    payload: { username: "teacher.actions", role: "TEACHER" }
  });
  assert.equal(teacherAccount.statusCode, 201);
  const created = teacherAccount.json<{
    user: { id: string };
    temporaryPassword: string;
  }>();

  const reset = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${created.user.id}/reset-password`,
    headers: auth
  });
  assert.equal(reset.statusCode, 200);
  const resetBody = reset.json<{ temporaryPassword: string; user: { mustChangePassword: boolean } }>();
  assert.equal(resetBody.user.mustChangePassword, true);
  assert.notEqual(resetBody.temporaryPassword, created.temporaryPassword);

  const suspend = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${created.user.id}/suspend`,
    headers: auth
  });
  assert.equal(suspend.statusCode, 200);
  assert.equal(suspend.json<{ user: { status: string } }>().user.status, "SUSPENDED");

  const directory = await app.inject({
    method: "GET",
    url: "/v1/admin/users",
    headers: auth
  });
  assert.equal(directory.statusCode, 200);
  const directoryUser = directory
    .json<{ users: Array<{ id: string; profile: { fullName: string | null; phone: string | null; code: string | null } }> }>()
    .users.find((item) => item.id === created.user.id);
  assert.ok(directoryUser);
  assert.deepEqual(directoryUser.profile, { fullName: null, phone: null, code: null });
});


test("school administrator can read and update their own profile", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "ADMIN-PROFILE");
  const accessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${accessToken}` };

  const initial = await app.inject({ method: "GET", url: "/v1/admin/profile", headers: auth });
  assert.equal(initial.statusCode, 200);
  assert.equal(initial.json<{ profile: { fullName: string } }>().profile.fullName, "admin");

  const updated = await app.inject({
    method: "PATCH",
    url: "/v1/admin/profile",
    headers: auth,
    payload: {
      fullName: "School Administrator",
      jobTitle: "Principal",
      imageUrl: "https://example.com/admin.jpg",
      email: "admin@example.com",
      whatsapp: "+93700000000",
      phone: "0700000000",
      officeLocation: "Main office",
      officeHours: "08:00-14:00",
      bio: "School administration contact."
    }
  });
  assert.equal(updated.statusCode, 200);
  assert.deepEqual(updated.json<{
    profile: {
      fullName: string;
      jobTitle: string | null;
      imageUrl: string | null;
      email: string | null;
      whatsapp: string | null;
      phone: string | null;
      officeLocation: string | null;
      officeHours: string | null;
      bio: string | null;
    };
  }>().profile, {
    fullName: "School Administrator",
    jobTitle: "Principal",
    imageUrl: "https://example.com/admin.jpg",
    email: "admin@example.com",
    whatsapp: "+93700000000",
    phone: "0700000000",
    officeLocation: "Main office",
    officeHours: "08:00-14:00",
    bio: "School administration contact."
  });

  const readBack = await app.inject({ method: "GET", url: "/v1/admin/profile", headers: auth });
  assert.equal(readBack.statusCode, 200);
  assert.equal(readBack.json<{ profile: { fullName: string } }>().profile.fullName, "School Administrator");

  const uploadedImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const uploaded = await app.inject({
    method: "PATCH",
    url: "/v1/admin/profile",
    headers: auth,
    payload: {
      fullName: "School Administrator",
      jobTitle: "Principal",
      imageUrl: uploadedImage,
      email: "admin@example.com",
      whatsapp: "+93700000000",
      phone: "0700000000",
      officeLocation: "Main office",
      officeHours: "08:00-14:00",
      bio: "School administration contact."
    }
  });
  assert.equal(uploaded.statusCode, 200);
  assert.equal(uploaded.json<{ profile: { imageUrl: string | null } }>().profile.imageUrl, uploadedImage);

  const uploadedReadBack = await app.inject({ method: "GET", url: "/v1/admin/profile", headers: auth });
  assert.equal(uploadedReadBack.statusCode, 200);
  assert.equal(
    uploadedReadBack.json<{ profile: { imageUrl: string | null } }>().profile.imageUrl,
    uploadedImage
  );

  const unsafeImage = await app.inject({
    method: "PATCH",
    url: "/v1/admin/profile",
    headers: auth,
    payload: {
      fullName: "School Administrator",
      imageUrl: "javascript:alert(1)"
    }
  });
  assert.equal(unsafeImage.statusCode, 400);
  assert.equal(unsafeImage.json<{ error: string }>().error, "validation_error");
});


test("school users can read the public administrator contact card", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "ADMIN-CONTACT");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const admin = { authorization: `Bearer ${adminToken}` };

  const profile = await app.inject({
    method: "PATCH",
    url: "/v1/admin/profile",
    headers: admin,
    payload: {
      fullName: "Contact Administrator",
      jobTitle: "School Principal",
      imageUrl: "https://example.com/principal.jpg",
      email: "principal@example.com",
      whatsapp: "+93700111222",
      phone: "0700111222",
      officeLocation: "Administration office",
      officeHours: "08:00-14:00",
      bio: "Contact the school administration for support."
    }
  });
  assert.equal(profile.statusCode, 200);

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: admin,
    payload: { username: "contactparent", fullName: "Contact Parent" }
  });
  assert.equal(parentResponse.statusCode, 201);
  const parent = parentResponse.json<{ temporaryPassword: string }>();
  const parentToken = await activateRoleLogin(
    app,
    schoolId,
    "PARENT",
    "contactparent",
    parent.temporaryPassword,
    "ContactParent2026!"
  );

  const contact = await app.inject({
    method: "GET",
    url: "/v1/school/admin-contact",
    headers: { authorization: `Bearer ${parentToken}` }
  });
  assert.equal(contact.statusCode, 200);
  const body = contact.json<{ contact: { email: string | null; whatsapp: string | null; fullName: string } | null }>();
  assert.ok(body.contact);
  assert.equal(body.contact.fullName, "Contact Administrator");
  assert.equal(body.contact.email, "principal@example.com");
  assert.equal(body.contact.whatsapp, "+93700111222");
});

test("administrator cannot bypass email verification when changing their own password", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "ADMIN-PASSWORD");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const changed = await app.inject({
    method: "POST",
    url: "/v1/auth/change-password",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      currentPassword: "AdminSecure2026!",
      newPassword: "AdminChanged2026!"
    }
  });
  assert.equal(changed.statusCode, 403);
  assert.equal(
    changed.json<{ error: string }>().error,
    "two_factor_verification_required"
  );

  const originalPasswordStillWorks = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "SCHOOL_ADMIN",
      username: "admin",
      password: "AdminSecure2026!"
    }
  });
  assert.equal(originalPasswordStillWorks.statusCode, 200);
});

test("security account actions remain available while subscription writes are blocked", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "SECURITY-ACTIONS");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminToken}` };

  const teacher = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: auth,
    payload: { username: "security.teacher", role: "TEACHER" }
  });
  assert.equal(teacher.statusCode, 201);
  const teacherId = teacher.json<{ user: { id: string } }>().user.id;

  const suspendedSubscription = await app.inject({
    method: "PATCH",
    url: `/v1/platform/schools/${schoolId}/subscription`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { status: "SUSPENDED" }
  });
  assert.equal(suspendedSubscription.statusCode, 200);

  const reset = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${teacherId}/reset-password`,
    headers: auth
  });
  assert.equal(reset.statusCode, 200);
  assert.ok(reset.json<{ temporaryPassword: string }>().temporaryPassword);

  const suspend = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${teacherId}/suspend`,
    headers: auth
  });
  assert.equal(suspend.statusCode, 200);
  assert.equal(suspend.json<{ user: { status: string } }>().user.status, "SUSPENDED");
});


test("empty JSON requests are reported as client errors instead of internal errors", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/admin/users/not-a-user/suspend",
    headers: { "content-type": "application/json" },
    payload: ""
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json<{ error: string }>().error, "invalid_request");
});


test("first-login password change enforces the complete password policy", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "PASSWORD-POLICY");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: { authorization: `Bearer ${adminAccessToken}` },
    payload: { username: "passwordparent", fullName: "Password Parent" }
  });
  assert.equal(parentResponse.statusCode, 201);
  const created = parentResponse.json<{ temporaryPassword: string }>();

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "passwordparent",
      password: created.temporaryPassword
    }
  });
  assert.equal(login.statusCode, 200);
  const session = login.json<{ accessToken: string; mustChangePassword: boolean }>();
  assert.equal(session.mustChangePassword, true);

  const noSpecial = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${session.accessToken}` },
    payload: { newPassword: "Password2026" }
  });
  assert.equal(noSpecial.statusCode, 400);
  assert.equal(noSpecial.json<{ error: string }>().error, "validation_error");

  const valid = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${session.accessToken}` },
    payload: { newPassword: "Pass2026!" }
  });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.json<{ mustChangePassword: boolean }>().mustChangePassword, false);
});

test("academic entity CRUD edits classes and protects dependent class history", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "ACADEMIC-CRUD");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminAccessToken}` };

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1409", startDate: "2030-03-21", endDate: "2031-03-20" }
  });
  assert.equal(yearResponse.statusCode, 201);
  const yearId = yearResponse.json<{ academicYear: { id: string } }>().academicYear.id;
  assert.equal(
    (await app.inject({ method: "POST", url: `/v1/admin/academics/years/${yearId}/activate`, headers: auth })).statusCode,
    200
  );

  const gradeResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "G11", name: "Grade 11", sortOrder: 11 }
  });
  assert.equal(gradeResponse.statusCode, 201);
  const gradeId = gradeResponse.json<{ grade: { id: string } }>().grade.id;

  const disposableClass = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: {
      academicYearId: yearId,
      gradeLevelId: gradeId,
      code: "11A",
      name: "Grade 11 A"
    }
  });
  assert.equal(disposableClass.statusCode, 201);
  const disposableClassId = disposableClass.json<{ class: { id: string } }>().class.id;

  const editedClass = await app.inject({
    method: "PATCH",
    url: `/v1/admin/academics/classes/${disposableClassId}`,
    headers: auth,
    payload: {
      academicYearId: yearId,
      gradeLevelId: gradeId,
      code: "11-A",
      name: "Grade 11 - A"
    }
  });
  assert.equal(editedClass.statusCode, 200);
  assert.equal(editedClass.json<{ class: { code: string; name: string } }>().class.code, "11-A");
  assert.equal(editedClass.json<{ class: { code: string; name: string } }>().class.name, "Grade 11 - A");

  const deletedClass = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/classes/${disposableClassId}`,
    headers: auth
  });
  assert.equal(deletedClass.statusCode, 200);

  const protectedClass = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: {
      academicYearId: yearId,
      gradeLevelId: gradeId,
      code: "11B",
      name: "Grade 11 B"
    }
  });
  assert.equal(protectedClass.statusCode, 201);
  const protectedClassId = protectedClass.json<{ class: { id: string } }>().class.id;

  const subjectResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/subjects",
    headers: auth,
    payload: { code: "PHY11", name: "Physics 11" }
  });
  assert.equal(subjectResponse.statusCode, 201);
  const subjectId = subjectResponse.json<{ subject: { id: string } }>().subject.id;

  const teacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: auth,
    payload: { username: "teacher.crud", role: "TEACHER" }
  });
  assert.equal(teacherAccount.statusCode, 201);
  const teacherUserId = teacherAccount.json<{ user: { id: string } }>().user.id;

  const teacherProfile = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/teachers",
    headers: auth,
    payload: {
      userId: teacherUserId,
      employeeCode: "T-CRUD",
      fullName: "CRUD Teacher"
    }
  });
  assert.equal(teacherProfile.statusCode, 201);

  const assignment = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/assignments",
    headers: auth,
    payload: {
      academicYearId: yearId,
      classId: protectedClassId,
      subjectId,
      teacherUserId
    }
  });
  assert.equal(assignment.statusCode, 201);

  const blockedDelete = await app.inject({
    method: "DELETE",
    url: `/v1/admin/academics/classes/${protectedClassId}`,
    headers: auth
  });
  assert.equal(blockedDelete.statusCode, 409);
  const blockedDeleteBody = blockedDelete.json<{
    message: string;
    dependencies: string[];
  }>();
  assert.equal(
    blockedDeleteBody.message,
    "This class cannot be deleted because it is used by:"
  );
  assert.ok(blockedDeleteBody.dependencies.includes("Teacher assignments"));

  const overview = await app.inject({
    method: "GET",
    url: "/v1/admin/academics",
    headers: auth
  });
  assert.equal(overview.statusCode, 200);
  const overviewBody = overview.json<{
    classes: Array<{ id: string; code: string }>;
  }>();
  assert.equal(overviewBody.classes.some((item) => item.id === disposableClassId), false);
  assert.equal(overviewBody.classes.some((item) => item.id === protectedClassId), true);
});



test("bulk import creates login credentials consistently for parents, teachers, and students", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "IMPORT-CREDENTIALS");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminAccessToken}` };

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1405", startDate: "2026-03-21", endDate: "2027-03-20" }
  });
  assert.equal(yearResponse.statusCode, 201);
  const yearId = yearResponse.json<{ academicYear: { id: string } }>().academicYear.id;

  const activateYear = await app.inject({
    method: "POST",
    url: `/v1/admin/academics/years/${yearId}/activate`,
    headers: auth
  });
  assert.equal(activateYear.statusCode, 200);

  const gradeResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "G9", name: "Grade 9", sortOrder: 9 }
  });
  assert.equal(gradeResponse.statusCode, 201);
  const gradeId = gradeResponse.json<{ grade: { id: string } }>().grade.id;

  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "9A", name: "Grade 9 A" }
  });
  assert.equal(classResponse.statusCode, 201);

  async function validateAndCommit(
    entityType: "PARENT" | "TEACHER" | "STUDENT",
    rows: Array<Record<string, string>>,
    mapping: Record<string, string>
  ) {
    const validation = await app.inject({
      method: "POST",
      url: "/v1/admin/families/import/validate",
      headers: auth,
      payload: { entityType, rows, mapping }
    });
    assert.equal(validation.statusCode, 200);
    const validationBody = validation.json<{
      valid: boolean;
      normalizedRows: Array<Record<string, string>>;
      errors: unknown[];
    }>();
    assert.equal(validationBody.valid, true);
    assert.deepEqual(validationBody.errors, []);

    const commit = await app.inject({
      method: "POST",
      url: "/v1/admin/families/import/commit",
      headers: auth,
      payload: { entityType, rows: validationBody.normalizedRows }
    });
    assert.equal(commit.statusCode, 201);
    return commit.json<{
      importedCount: number;
      credentials: Array<{ username: string; temporaryPassword: string }>;
    }>();
  }

  const parentImport = await validateAndCommit(
    "PARENT",
    [{ username: "bulkparent1", fullName: "Bulk Parent", phone: "0700000001" }],
    { username: "username", fullName: "fullName", phone: "phone" }
  );
  assert.equal(parentImport.importedCount, 1);
  assert.equal(parentImport.credentials.length, 1);
  assert.equal(parentImport.credentials[0]?.username, "bulkparent1");

  const parentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "bulkparent1",
      password: parentImport.credentials[0]?.temporaryPassword
    }
  });
  assert.equal(parentLogin.statusCode, 200);

  const teacherImport = await validateAndCommit(
    "TEACHER",
    [{
      username: "bulkteacher1",
      employeeCode: "T-BULK-1",
      fullName: "Bulk Teacher",
      phone: "0700000002"
    }],
    {
      username: "username",
      employeeCode: "employeeCode",
      fullName: "fullName",
      phone: "phone"
    }
  );
  assert.equal(teacherImport.importedCount, 1);
  assert.equal(teacherImport.credentials.length, 1);
  assert.equal(teacherImport.credentials[0]?.username, "bulkteacher1");

  const teacherLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "TEACHER",
      username: "bulkteacher1",
      password: teacherImport.credentials[0]?.temporaryPassword
    }
  });
  assert.equal(teacherLogin.statusCode, 200);

  const studentImport = await validateAndCommit(
    "STUDENT",
    [{
      username: "bulkstudent1",
      studentCode: "S-BULK-1",
      fullName: "Bulk Student",
      parentUsername: "bulkparent1",
      phone: "0700000003",
      academicYear: "1405",
      classCode: "9A"
    }],
    {
      username: "username",
      studentCode: "studentCode",
      fullName: "fullName",
      parentUsername: "parentUsername",
      phone: "phone",
      academicYear: "academicYear",
      classCode: "classCode"
    }
  );
  assert.equal(studentImport.importedCount, 1);
  assert.equal(studentImport.credentials.length, 1);
  assert.equal(studentImport.credentials[0]?.username, "bulkstudent1");

  const studentLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "STUDENT",
      username: "bulkstudent1",
      password: studentImport.credentials[0]?.temporaryPassword
    }
  });
  assert.equal(studentLogin.statusCode, 200);

  const familyOverview = await app.inject({
    method: "GET",
    url: "/v1/admin/families",
    headers: auth
  });
  assert.equal(familyOverview.statusCode, 200);
  const overviewBody = familyOverview.json<{
    students: Array<{
      student: { studentCode: string; phone: string | null; userId: string | null };
      user: { username: string; role: string; mustChangePassword: boolean } | null;
    }>;
  }>();
  const importedStudent = overviewBody.students.find((item) => item.student.studentCode === "S-BULK-1");
  assert.ok(importedStudent);
  assert.ok(importedStudent.student.userId);
  assert.equal(importedStudent.student.phone, "0700000003");
  assert.equal(importedStudent.user?.username, "bulkstudent1");
  assert.equal(importedStudent.user?.role, "STUDENT");
  assert.equal(importedStudent.user?.mustChangePassword, true);

  const duplicateStudentUsername = await app.inject({
    method: "POST",
    url: "/v1/admin/families/import/validate",
    headers: auth,
    payload: {
      entityType: "STUDENT",
      rows: [{
        username: "bulkstudent1",
        studentCode: "S-BULK-2",
        fullName: "Second Bulk Student",
        parentUsername: "bulkparent1",
        academicYear: "1405",
        classCode: "9A"
      }],
      mapping: {
        username: "username",
        studentCode: "studentCode",
        fullName: "fullName",
        parentUsername: "parentUsername",
        academicYear: "academicYear",
        classCode: "classCode"
      }
    }
  });
  assert.equal(duplicateStudentUsername.statusCode, 200);
  const duplicateBody = duplicateStudentUsername.json<{
    valid: boolean;
    errors: Array<{ field?: string; message: string }>;
  }>();
  assert.equal(duplicateBody.valid, false);
  assert.ok(duplicateBody.errors.some((item) => item.field === "username"));
});
