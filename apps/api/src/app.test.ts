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
  createLearningExtensionsStore,
  createTeacherTeachingStore,
  createTeacherTasksStore,
  createPilotStore,
  createPilotLaunchStore,
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
    "0014_student_phone.sql",
    "0015_teacher_learning_workflows.sql",
    "0016_teacher_teaching_plans.sql",
    "0017_teacher_productivity.sql",
    "0018_exam_subject_dates.sql",
    "0019_fee_payment_idempotency.sql",
    "0020_pilot_import_history.sql",
    "0021_pilot_launch_support.sql",
    "0022_fee_invoice_numbers.sql",
    "0023_notification_scheduler_health.sql",
    "0024_fee_payment_reconciliation.sql",
    "0025_notification_push_lease.sql",
    "0026_admin_attendance_calendar.sql",
    "0027_admin_attendance_followups.sql",
    "0028_staff_profiles_permissions.sql"
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
  const learningExtensionsStore = createLearningExtensionsStore(db);
  const pilotLaunchStore = createPilotLaunchStore(db);
  const app = buildApp({
    schoolStore: createSchoolStore(db),
    accountStore: createAccountStore(db),
    academicStore: createAcademicStore(db),
    familyStore: createFamilyStore(db),
    attendanceStore: createAttendanceStore(db),
    learningStore: createLearningStore(db),
    learningExtensionsStore,
    teacherTeachingStore: createTeacherTeachingStore(db),
    teacherTasksStore: createTeacherTasksStore(db),
    communicationStore: createCommunicationStore(db),
    pilotStore: createPilotStore(db),
    pilotLaunchStore,
    pushProvider,
    passwordVerificationDelivery,
    passwordVerificationSecret: "test-password-verification-secret-2026",
    provisioningKey
  });
  return { app, client, learningExtensionsStore, pilotLaunchStore, passwordVerificationMessages };
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
  assert.equal(meAfterSuspend.statusCode, 401);
  assert.equal(meAfterSuspend.json<{ error: string }>().error, "session_invalid");

  const blockedHome = await app.inject({
    method: "GET",
    url: "/v1/parent/home",
    headers: { authorization: `Bearer ${activeParentAccessToken}` }
  });
  assert.equal(blockedHome.statusCode, 401);
  assert.equal(blockedHome.json<{ error: string }>().error, "session_invalid");

  const contactWhileSuspended = await app.inject({
    method: "GET",
    url: "/v1/school/admin-contact",
    headers: { authorization: `Bearer ${activeParentAccessToken}` }
  });
  assert.equal(contactWhileSuspended.statusCode, 401);

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
  const restrictedToken = suspendedLogin.json<{ accessToken: string; refreshToken: string; user: { status: string } }>();
  assert.equal(restrictedToken.user.status, "SUSPENDED");
  const restrictedHome = await app.inject({
    method: "GET", url: "/v1/parent/home",
    headers: { authorization: `Bearer ${restrictedToken.accessToken}` }
  });
  assert.equal(restrictedHome.statusCode, 403);
  assert.equal(restrictedHome.json<{ error: string }>().error, "account_suspended");
  const restrictedContact = await app.inject({
    method: "GET", url: "/v1/school/admin-contact",
    headers: { authorization: `Bearer ${restrictedToken.accessToken}` }
  });
  assert.equal(restrictedContact.statusCode, 200);

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
  assert.equal(homeAfterReactivate.statusCode, 401);
  const staleRestricted = await app.inject({
    method: "GET", url: "/v1/parent/home",
    headers: { authorization: `Bearer ${restrictedToken.accessToken}` }
  });
  assert.equal(staleRestricted.statusCode, 401);
  const staleRefresh = await app.inject({
    method: "POST", url: "/v1/auth/refresh",
    payload: { refreshToken: restrictedToken.refreshToken }
  });
  assert.equal(staleRefresh.statusCode, 401);
  const newLogin = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { schoolId: schoolA, expectedRole: "PARENT", username: "parentone", password: "ParentSecure2026!" }
  });
  assert.equal(newLogin.statusCode, 200);
  const newHome = await app.inject({
    method: "GET", url: "/v1/parent/home",
    headers: { authorization: `Bearer ${newLogin.json<{ accessToken: string }>().accessToken}` }
  });
  assert.equal(newHome.statusCode, 200);
});

test("student entry enforces role, temporary password, active enrollment, and suspension", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "STUDENT-ENTRY");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);
  const auth = { authorization: `Bearer ${adminAccessToken}` };

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1406 Student Entry", startDate: "2027-03-21", endDate: "2028-03-19" }
  });
  assert.equal(yearResponse.statusCode, 201);
  const yearId = yearResponse.json<{ academicYear: { id: string } }>().academicYear.id;
  assert.equal(
    (await app.inject({
      method: "POST",
      url: `/v1/admin/academics/years/${yearId}/activate`,
      headers: auth
    })).statusCode,
    200
  );

  const gradeResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/grades",
    headers: auth,
    payload: { code: "G10STUDENT", name: "Grade 10 Student Entry", sortOrder: 10 }
  });
  assert.equal(gradeResponse.statusCode, 201);
  const gradeId = gradeResponse.json<{ grade: { id: string } }>().grade.id;

  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: {
      academicYearId: yearId,
      gradeLevelId: gradeId,
      code: "10STUDENT",
      name: "Grade 10 Student Entry"
    }
  });
  assert.equal(classResponse.statusCode, 201);
  const classId = classResponse.json<{ class: { id: string } }>().class.id;

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: auth,
    payload: {
      username: "studententryparent",
      fullName: "Student Entry Parent",
      phone: "0700000010"
    }
  });
  assert.equal(parentResponse.statusCode, 201);
  const parentUserId = parentResponse.json<{ user: { id: string } }>().user.id;

  const studentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/students",
    headers: auth,
    payload: {
      parentUserId,
      studentCode: "S-STUDENT-ENTRY",
      fullName: "Student Entry Learner",
      academicYearId: yearId,
      classId
    }
  });
  assert.equal(studentResponse.statusCode, 201);
  const studentId = studentResponse.json<{ student: { id: string } }>().student.id;

  const accountResponse = await app.inject({
    method: "POST",
    url: `/v1/admin/families/students/${studentId}/account`,
    headers: auth,
    payload: {
      username: "studententry",
      phone: "0700000011"
    }
  });
  assert.equal(accountResponse.statusCode, 201);
  const studentAccount = accountResponse.json<{
    user: { id: string };
    temporaryPassword: string;
  }>();

  const wrongRoleLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "studententry",
      password: studentAccount.temporaryPassword
    }
  });
  assert.equal(wrongRoleLogin.statusCode, 403);
  assert.equal(wrongRoleLogin.json<{ error: string }>().error, "role_mismatch");

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "STUDENT",
      username: "studententry",
      password: studentAccount.temporaryPassword
    }
  });
  assert.equal(login.statusCode, 200);
  const loginBody = login.json<{
    accessToken: string;
    mustChangePassword: boolean;
    user: { role: string; status: string };
  }>();
  assert.equal(loginBody.user.role, "STUDENT");
  assert.equal(loginBody.mustChangePassword, true);

  const blockedBeforePasswordChange = await app.inject({
    method: "GET",
    url: "/v1/student/home",
    headers: { authorization: `Bearer ${loginBody.accessToken}` }
  });
  assert.equal(blockedBeforePasswordChange.statusCode, 403);
  assert.equal(
    blockedBeforePasswordChange.json<{ error: string }>().error,
    "password_change_required"
  );

  const passwordChange = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${loginBody.accessToken}` },
    payload: { newPassword: "StudentEntry2026!" }
  });
  assert.equal(passwordChange.statusCode, 200);
  const activeSession = passwordChange.json<{
    accessToken: string;
    user: { role: string; status: string };
    mustChangePassword: boolean;
  }>();
  assert.equal(activeSession.user.role, "STUDENT");
  assert.equal(activeSession.user.status, "ACTIVE");
  assert.equal(activeSession.mustChangePassword, false);

  const studentStatus = await app.inject({
    method: "GET",
    url: "/v1/student/status",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(studentStatus.statusCode, 200);
  assert.deepEqual(
    studentStatus.json<{ studentId: string; status: string }>(),
    { studentId, status: "ACTIVE" }
  );

  const studentHome = await app.inject({
    method: "GET",
    url: "/v1/student/home",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(studentHome.statusCode, 200);
  const studentHomeBody = studentHome.json<{
    student: { id: string; studentCode: string; fullName: string };
  }>();
  assert.equal(studentHomeBody.student.id, studentId);
  assert.equal(studentHomeBody.student.studentCode, "S-STUDENT-ENTRY");

  const studentTimetable = await app.inject({
    method: "GET",
    url: "/v1/student/timetable",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(studentTimetable.statusCode, 200);
  const timetableBody = studentTimetable.json<{
    student: { id: string; classId: string; academicYearId: string };
    classSection: { id: string; code: string };
    academicYear: { id: string; name: string };
    periods: unknown[];
  }>();
  assert.equal(timetableBody.student.id, studentId);
  assert.equal(timetableBody.student.classId, classId);
  assert.equal(timetableBody.student.academicYearId, yearId);
  assert.equal(timetableBody.classSection.id, classId);
  assert.equal(timetableBody.classSection.code, "10STUDENT");
  assert.equal(timetableBody.academicYear.id, yearId);
  assert.deepEqual(timetableBody.periods, []);

  const forbiddenParentHome = await app.inject({
    method: "GET",
    url: "/v1/parent/home",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(forbiddenParentHome.statusCode, 403);

  const forbiddenTeacherHome = await app.inject({
    method: "GET",
    url: "/v1/teacher/today",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(forbiddenTeacherHome.statusCode, 403);

  const withdraw = await app.inject({
    method: "PATCH",
    url: `/v1/admin/families/students/${studentId}`,
    headers: auth,
    payload: { status: "WITHDRAWN" }
  });
  assert.equal(withdraw.statusCode, 200);

  const withdrawnStatus = await app.inject({
    method: "GET",
    url: "/v1/student/status",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(withdrawnStatus.statusCode, 403);
  assert.equal(withdrawnStatus.json<{ error: string }>().error, "account_unavailable");

  const withdrawnHome = await app.inject({
    method: "GET",
    url: "/v1/student/home",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(withdrawnHome.statusCode, 403);
  assert.equal(withdrawnHome.json<{ error: string }>().error, "account_unavailable");

  const withdrawnTimetable = await app.inject({
    method: "GET",
    url: "/v1/student/timetable",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(withdrawnTimetable.statusCode, 403);
  assert.equal(withdrawnTimetable.json<{ error: string }>().error, "account_unavailable");

  // Step 11.8: withdrawing a Student must close communication APIs as well
  // as learning/timetable, without destroying the user or active session.
  const withdrawnCommunicationRoutes = [
    { method: "GET", url: "/v1/announcements" },
    { method: "GET", url: "/v1/notifications" },
    { method: "GET", url: "/v1/student/fees" },
    { method: "POST", url: "/v1/notifications/any-notification-id/read" }
  ] as const;
  for (const route of withdrawnCommunicationRoutes) {
    const blocked = await app.inject({
      ...route,
      headers: { authorization: `Bearer ${activeSession.accessToken}` }
    });
    assert.equal(blocked.statusCode, 403, route.url);
    assert.equal(blocked.json<{ error: string }>().error, "account_unavailable");
  }

  const reactivateEnrollment = await app.inject({
    method: "PATCH",
    url: `/v1/admin/families/students/${studentId}`,
    headers: auth,
    payload: { status: "ACTIVE" }
  });
  assert.equal(reactivateEnrollment.statusCode, 200);

  const reactivatedStatus = await app.inject({
    method: "GET",
    url: "/v1/student/status",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(reactivatedStatus.statusCode, 200);
  assert.equal(
    reactivatedStatus.json<{ studentId: string; status: string }>().status,
    "ACTIVE"
  );
  const reactivatedAnnouncements = await app.inject({
    method: "GET",
    url: "/v1/announcements",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(reactivatedAnnouncements.statusCode, 200);

  const suspend = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${studentAccount.user.id}/suspend`,
    headers: auth
  });
  assert.equal(suspend.statusCode, 200);

  const suspendedHome = await app.inject({
    method: "GET",
    url: "/v1/student/home",
    headers: { authorization: `Bearer ${activeSession.accessToken}` }
  });
  assert.equal(suspendedHome.statusCode, 401);
  assert.equal(suspendedHome.json<{ error: string }>().error, "session_invalid");
});

test("refresh sessions rotate once and logout revokes the current session", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => {
    await app.close();
    await client.close();
  });

  const schoolId = await provisionSchool(app, "SESSION-ROTATION");
  const adminAccessToken = await bootstrapAdmin(app, schoolId);

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: { authorization: `Bearer ${adminAccessToken}` },
    payload: {
      username: "sessionparent",
      fullName: "Session Parent"
    }
  });
  assert.equal(parentResponse.statusCode, 201);
  const parent = parentResponse.json<{
    user: { id: string };
    temporaryPassword: string;
  }>();

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "sessionparent",
      password: parent.temporaryPassword
    }
  });
  assert.equal(login.statusCode, 200);

  const loginBody = login.json<{ accessToken: string }>();
  const changed = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${loginBody.accessToken}` },
    payload: { newPassword: "SessionParent2026!" }
  });
  assert.equal(changed.statusCode, 200);

  const initial = changed.json<{
    accessToken: string;
    refreshToken: string;
  }>();

  const firstRefresh = await app.inject({
    method: "POST",
    url: "/v1/auth/refresh",
    payload: { refreshToken: initial.refreshToken }
  });
  assert.equal(firstRefresh.statusCode, 200);
  const rotated = firstRefresh.json<{
    accessToken: string;
    refreshToken: string;
  }>();
  assert.notEqual(rotated.refreshToken, initial.refreshToken);
  assert.notEqual(rotated.accessToken, initial.accessToken);

  const replayOldRefresh = await app.inject({
    method: "POST",
    url: "/v1/auth/refresh",
    payload: { refreshToken: initial.refreshToken }
  });
  assert.equal(replayOldRefresh.statusCode, 401);
  assert.equal(replayOldRefresh.json<{ error: string }>().error, "refresh_invalid");

  const meWithRotatedAccess = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: `Bearer ${rotated.accessToken}` }
  });
  assert.equal(meWithRotatedAccess.statusCode, 200);

  const logout = await app.inject({
    method: "POST",
    url: "/v1/auth/logout",
    payload: { refreshToken: rotated.refreshToken }
  });
  assert.equal(logout.statusCode, 204);

  const refreshAfterLogout = await app.inject({
    method: "POST",
    url: "/v1/auth/refresh",
    payload: { refreshToken: rotated.refreshToken }
  });
  assert.equal(refreshAfterLogout.statusCode, 401);
  assert.equal(refreshAfterLogout.json<{ error: string }>().error, "refresh_invalid");

  const meAfterLogout = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: `Bearer ${rotated.accessToken}` }
  });
  assert.equal(meAfterLogout.statusCode, 401);
  assert.equal(meAfterLogout.json<{ error: string }>().error, "session_invalid");
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
  assert.equal(teacherAccount.statusCode, 201, teacherAccount.body);
  const teacherUserId = teacherAccount.json<{ user: { id: string } }>().user.id;

  const yearResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/years",
    headers: auth,
    payload: { name: "1405", startDate: "2026-03-21", endDate: "2027-03-20" }
  });
  assert.equal(yearResponse.statusCode, 201, yearResponse.body);
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
  assert.equal(gradeResponse.statusCode, 201, gradeResponse.body);
  const gradeId = gradeResponse.json<{ grade: { id: string } }>().grade.id;

  const classResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/classes",
    headers: auth,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "7A", name: "Grade 7 A" }
  });
  assert.equal(classResponse.statusCode, 201, classResponse.body);
  const classId = classResponse.json<{ class: { id: string } }>().class.id;

  const subjectResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/academics/subjects",
    headers: auth,
    payload: { code: "MATH", name: "Mathematics" }
  });
  assert.equal(subjectResponse.statusCode, 201, subjectResponse.body);
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
  assert.equal(teacherProfile.statusCode, 201, teacherProfile.body);

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
  assert.equal(assignmentResponse.statusCode, 201, assignmentResponse.body);

  const secondTeacherAccount = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: auth,
    payload: { username: "teacher.academic.two", role: "TEACHER" }
  });
  assert.equal(secondTeacherAccount.statusCode, 201, secondTeacherAccount.body);
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
  assert.equal(secondTeacherProfile.statusCode, 201, secondTeacherProfile.body);

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
  assert.equal(occupiedClassSubject.statusCode, 409, occupiedClassSubject.body);
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
  assert.equal(negaranResponse.statusCode, 201, negaranResponse.body);

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
  assert.equal(timetableResponse.statusCode, 201, timetableResponse.body);

  // Step 12: teacher identity, school-scoped schedule, linked assignments and
  // the distinction between normal teaching and Negaran supervision.
  const teacherPassword = teacherAccount.json<{ temporaryPassword: string }>().temporaryPassword;
  const teacherToken = await activateRoleLogin(
    app, schoolId, "TEACHER", "teacher.academic", teacherPassword, "TeacherAcademic2026!"
  );
  const teacherHeaders = { authorization: `Bearer ${teacherToken}` };
  const teacherAcademics = await app.inject({
    method: "GET", url: "/v1/teacher/academics", headers: teacherHeaders
  });
  assert.equal(teacherAcademics.statusCode, 200);
  const teacherView = teacherAcademics.json<{
    assignmentDetails: Array<{ classCode: string; subjectName: string; classId: string }>;
    schedule: Array<{ classId: string; classCode: string; subjectName: string; startsAt: string; weekday: string }>;
  }>();
  assert.deepEqual(teacherView.assignmentDetails.map((item) => [item.classCode, item.subjectName]), [
    ["7A", "Mathematics"]
  ]);
  assert.deepEqual(teacherView.schedule.map((item) => [item.classCode, item.subjectName, item.startsAt, item.weekday]), [
    ["7A", "Mathematics", "08:00", "SATURDAY"]
  ]);
  assert.equal(teacherView.schedule[0]?.classId, classId);

  const teacherToday = await app.inject({
    method: "GET", url: "/v1/teacher/today", headers: teacherHeaders
  });
  assert.equal(teacherToday.statusCode, 200);
  const teacherTodayData = teacherToday.json<{
    date: string;
    weekday: string;
    teacher: { userId: string; fullName: string };
    supervisedClasses: Array<{ classId: string }>;
    schedule: Array<{ startsAt: string }>;
  }>();
  assert.equal(teacherTodayData.teacher.userId, teacherUserId);
  assert.equal(teacherTodayData.teacher.fullName, "Academic Teacher");
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const getDatePart = (type: "year" | "month" | "day") =>
    todayParts.find((part) => part.type === type)?.value;
  assert.equal(teacherTodayData.date, `${getDatePart("year")}-${getDatePart("month")}-${getDatePart("day")}`);
  assert.equal(teacherTodayData.supervisedClasses[0]?.classId, classId);
  assert.deepEqual(teacherTodayData.schedule.map((item) => item.startsAt),
    [...teacherTodayData.schedule.map((item) => item.startsAt)].sort());

  const otherPassword = secondTeacherAccount.json<{ temporaryPassword: string }>().temporaryPassword;
  const otherToken = await activateRoleLogin(
    app, schoolId, "TEACHER", "teacher.academic.two", otherPassword, "TeacherAcademicTwo2026!"
  );
  const otherView = await app.inject({
    method: "GET", url: "/v1/teacher/academics",
    headers: { authorization: `Bearer ${otherToken}` }
  });
  assert.equal(otherView.statusCode, 200);
  assert.deepEqual(otherView.json<{ assignmentDetails: unknown[]; schedule: unknown[] }>().assignmentDetails, []);
  assert.deepEqual(otherView.json<{ assignmentDetails: unknown[]; schedule: unknown[] }>().schedule, []);
  // Teacher Phase 6: private tasks never cross teacher or school identity,
  // completed status persists, and invalid dates cannot enter storage.
  const emptyTasks = await app.inject({
    method: "GET", url: "/v1/teacher/tasks", headers: teacherHeaders
  });
  assert.equal(emptyTasks.statusCode, 200);
  assert.deepEqual(emptyTasks.json<{ tasks: unknown[] }>().tasks, []);
  const firstTask = await app.inject({
    method: "POST", url: "/v1/teacher/tasks", headers: teacherHeaders,
    payload: { title: "Prepare Wednesday quiz", details: "Revise fractions",
      priority: "HIGH", dueOn: "2026-10-14" }
  });
  assert.equal(firstTask.statusCode, 201, firstTask.body);
  const taskId = firstTask.json<{ task: { id: string } }>().task.id;
  const invalidDue = await app.inject({
    method: "POST", url: "/v1/teacher/tasks", headers: teacherHeaders,
    payload: { title: "Impossible date", dueOn: "2026-02-30" }
  });
  assert.equal(invalidDue.statusCode, 400);
  const secondTeacherTasks = await app.inject({
    method: "GET", url: "/v1/teacher/tasks",
    headers: { authorization: `Bearer ${otherToken}` }
  });
  assert.equal(secondTeacherTasks.statusCode, 200);
  assert.deepEqual(secondTeacherTasks.json<{ tasks: unknown[] }>().tasks, []);
  const otherTeacherUpdateTask = await app.inject({
    method: "PATCH", url: `/v1/teacher/tasks/${taskId}`,
    headers: { authorization: `Bearer ${otherToken}` },
    payload: { status: "DONE" }
  });
  assert.equal(otherTeacherUpdateTask.statusCode, 404);
  const otherTeacherDeleteTask = await app.inject({
    method: "DELETE", url: `/v1/teacher/tasks/${taskId}`,
    headers: { authorization: `Bearer ${otherToken}` }
  });
  assert.equal(otherTeacherDeleteTask.statusCode, 404);
  const adminTeacherTasks = await app.inject({
    method: "GET", url: "/v1/teacher/tasks", headers: auth
  });
  assert.equal(adminTeacherTasks.statusCode, 403);
  const markDone = await app.inject({
    method: "PATCH", url: `/v1/teacher/tasks/${taskId}`,
    headers: teacherHeaders, payload: { status: "DONE" }
  });
  assert.equal(markDone.statusCode, 200, markDone.body);
  assert.equal(markDone.json<{ task: { status: string } }>().task.status, "DONE");
  const markDoneAgain = await app.inject({
    method: "PATCH", url: `/v1/teacher/tasks/${taskId}`,
    headers: teacherHeaders, payload: { title: "Prepare fractions worksheet", status: "OPEN" }
  });
  assert.equal(markDoneAgain.statusCode, 200);
  assert.equal(markDoneAgain.json<{ task: { status: string } }>().task.status, "OPEN");
  const readAll = await app.inject({
    method: "POST", url: "/v1/teacher/notifications/read-all", headers: teacherHeaders
  });
  assert.equal(readAll.statusCode, 200);
  assert.equal(typeof readAll.json<{ changed: number }>().changed, "number");
  const adminReadAllDenied = await app.inject({
    method: "POST", url: "/v1/teacher/notifications/read-all", headers: auth
  });
  assert.equal(adminReadAllDenied.statusCode, 403);
  const taskRemove = await app.inject({
    method: "DELETE", url: `/v1/teacher/tasks/${taskId}`, headers: teacherHeaders
  });
  assert.equal(taskRemove.statusCode, 200);
  const taskNotFound = await app.inject({
    method: "PATCH", url: `/v1/teacher/tasks/${taskId}`,
    headers: teacherHeaders, payload: { status: "DONE" }
  });
  assert.equal(taskNotFound.statusCode, 404);

  // Phase 2: class details derive from exact active teacher assignment.
  const ownAssignmentId = assignmentResponse.json<{ assignment: { id: string } }>().assignment.id;

  // Admin Learning Phase 6: read-only school/year-scoped teaching progress.
  const progressUrl = "/v1/admin/teaching/progress?academicYearId=" + yearId;
  const chaptersUrl = "/v1/admin/teaching/progress/" + ownAssignmentId +
    "/units?academicYearId=" + yearId;
  const lessonsUrl = "/v1/admin/teaching/progress/" + ownAssignmentId +
    "/lessons?academicYearId=" + yearId;
  const teacherAccess = { authorization: `Bearer ${otherToken}` };
  for (const url of [progressUrl, chaptersUrl, lessonsUrl]) {
    assert.equal((await app.inject({ method:"GET",url })).statusCode,401);
    assert.equal((await app.inject({ method:"GET",url,headers:teacherHeaders })).statusCode,403);
    assert.equal((await app.inject({ method:"GET",url,headers:teacherAccess })).statusCode,403);
  }
  const progressOtherAdmin = { authorization: `Bearer ${await bootstrapAdmin(app,
    await provisionSchool(app, "LEARN-TEACH-PHASE6-OTHER"))}` };
  assert.equal((await app.inject({method:"GET",url:progressUrl,headers:progressOtherAdmin})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:chaptersUrl,headers:progressOtherAdmin})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:lessonsUrl,headers:progressOtherAdmin})).statusCode,404);
  for (const invalid of ["&limit=0","&limit=51","&offset=-2","&focus=INVALID",
    "&classId=invalid","&subjectId=invalid","&teacherUserId=invalid"]) {
    assert.equal((await app.inject({method:"GET",url:progressUrl+invalid,
      headers:auth})).statusCode,400);
  }
  for (const invalid of ["&status=INVALID","&limit=0","&offset=-5"]) {
    assert.equal((await app.inject({method:"GET",url:chaptersUrl+invalid,headers:auth})).statusCode,400);
    assert.equal((await app.inject({method:"GET",url:lessonsUrl+invalid,headers:auth})).statusCode,400);
  }
  const emptyTeaching = await app.inject({method:"GET",url:progressUrl,headers:auth});
  assert.equal(emptyTeaching.statusCode,200,emptyTeaching.body);
  const emptyProgress = emptyTeaching.json<{total:number;summary:{
    assignments:number;noCurriculum:number;completedUnits:number
  };rows:Array<{assignmentId:string;unitsTotal:number;attention:string[]}>}>();
  assert.equal(emptyProgress.total,1);
  assert.equal(emptyProgress.summary.assignments,1);
  assert.equal(emptyProgress.summary.noCurriculum,1);
  assert.equal(emptyProgress.summary.completedUnits,0);
  assert.equal(emptyProgress.rows[0]?.assignmentId,ownAssignmentId);
  assert.equal(emptyProgress.rows[0]?.unitsTotal,0);
  assert.ok(emptyProgress.rows[0]?.attention.includes("NO_CURRICULUM"));
  assert.equal((await app.inject({method:"GET",url:progressUrl+
    "&focus=NO_CURRICULUM",headers:auth})).json<{total:number}>().total,1);
  assert.equal((await app.inject({method:"GET",url:chaptersUrl,headers:auth})).json<{total:number}>().total,0);

  // Admin Learning Phase 7: reports, year-scoped audit and export authority.
  const reportPath = "/v1/admin/learning/reports?academicYearId=" + yearId;
  const auditPath = "/v1/admin/learning/audit?academicYearId=" + yearId;
  const otherReportAdmin = { authorization: `Bearer ${await bootstrapAdmin(app,
    await provisionSchool(app, "LEARN-REPORTS-P7-OTHER"))}` };
  for (const url of [reportPath, auditPath,
    "/v1/admin/learning/reports/export?academicYearId="+yearId,
    "/v1/admin/learning/audit/export?academicYearId="+yearId]) {
    assert.equal((await app.inject({method:"GET",url})).statusCode,401);
    assert.equal((await app.inject({method:"GET",url,headers:teacherHeaders})).statusCode,403);
    assert.equal((await app.inject({method:"GET",url,headers:otherReportAdmin})).statusCode,404);
  }
  for (const suffix of ["&limit=0","&limit=51","&offset=-1","&classId=invalid"]) {
    assert.equal((await app.inject({method:"GET",url:reportPath+suffix,headers:auth})).statusCode,400);
  }
  for (const suffix of ["&category=WRONG","&from=2026-02-30",
    "&from=2026-11-15&to=2026-11-14","&limit=99","&offset=-1",
    "&from=2025-01-01&to=2027-01-01"]) {
    assert.equal((await app.inject({method:"GET",url:auditPath+suffix,headers:auth})).statusCode,400);
  }
  const baselineReport = await app.inject({method:"GET",url:reportPath,headers:auth});
  assert.equal(baselineReport.statusCode,200,baselineReport.body);
  const baseReport = baselineReport.json<{total:number;coverage:string;summary:{
    assignments:number;publishedGrades:number;curriculumUnits:number;
  };rows:Array<{className:string;subjectName:string}>}>();
  assert.equal(baseReport.total,1);
  assert.equal(baseReport.summary.assignments,1);
  assert.equal(baseReport.summary.publishedGrades,0);
  assert.equal(baseReport.summary.curriculumUnits,0);
  assert.equal(baseReport.coverage,"ASSIGNED_CLASS_SUBJECTS_ONLY");
  for (const suffix of ["&classId="+classId,"&subjectId="+subjectId,
    "&search=Academic%20Teacher","&limit=1&offset=0"]) {
    assert.equal((await app.inject({method:"GET",url:reportPath+suffix,headers:auth}))
      .json<{total:number}>().total,1);
  }
  assert.equal((await app.inject({method:"GET",url:reportPath+"&search=Nobody",headers:auth}))
    .json<{total:number}>().total,0);
  assert.equal((await app.inject({method:"GET",url:reportPath+"&limit=1&offset=1",headers:auth}))
    .json<{rows:unknown[]}>().rows.length,0);
  const emptyYearAudit = await app.inject({method:"GET",url:auditPath,headers:auth});
  assert.equal(emptyYearAudit.statusCode,200,emptyYearAudit.body);
  assert.equal(emptyYearAudit.json<{total:number}>().total,0);

  // Phase 5: only school administration defines official curriculum units.
  const curriculumUnitCreate = await app.inject({
    method: "POST", url: "/v1/admin/teaching/curriculum", headers: auth,
    payload: { academicYearId: yearId, classId, subjectId, title: "Fractions", sortOrder: 1 }
  });
  assert.equal(curriculumUnitCreate.statusCode, 201, curriculumUnitCreate.body);
  const unitId = curriculumUnitCreate.json<{ unit: { id: string } }>().unit.id;
  const unstartedChapterList = await app.inject({method:"GET",url:chaptersUrl+
    "&status=NOT_STARTED&limit=1&offset=0",headers:auth});
  assert.equal(unstartedChapterList.statusCode,200,unstartedChapterList.body);
  assert.equal(unstartedChapterList.json<{total:number;rows:Array<{id:string;status:string}>}>().total,1);
  assert.equal(unstartedChapterList.json<{rows:Array<{status:string}>}>().rows[0]?.status,"NOT_STARTED");
  const focusNotStarted = await app.inject({method:"GET",url:progressUrl+
    "&focus=NOT_STARTED",headers:auth});
  assert.equal(focusNotStarted.statusCode,200,focusNotStarted.body);
  assert.equal(focusNotStarted.json<{total:number}>().total,1);
  assert.equal((await app.inject({method:"GET",url:progressUrl+
    "&focus=INCOMPLETE&classId="+classId+"&subjectId="+subjectId,
    headers:auth})).json<{total:number}>().total,1);
  assert.equal((await app.inject({method:"GET",url:progressUrl+
    "&focus=NO_LESSONS",headers:auth})).json<{total:number}>().total,1);
  assert.equal((await app.inject({method:"GET",url:progressUrl+
    "&search=Academic%20Teacher",headers:auth})).json<{total:number}>().total,1);
  assert.equal((await app.inject({method:"GET",url:progressUrl+
    "&search=Nobody",headers:auth})).json<{total:number}>().total,0);
  assert.equal((await app.inject({method:"GET",url:progressUrl+
    "&limit=1&offset=1",headers:auth})).json<{rows:unknown[];total:number}>().rows.length,0);

  const curriculumAudit = await app.inject({method:"GET",url:auditPath+
    "&category=CURRICULUM",headers:auth});
  assert.equal(curriculumAudit.statusCode,200,curriculumAudit.body);
  const curriculumEvents = curriculumAudit.json<{total:number;rows:Array<{
    action:string;entityType:string;metadata?:unknown
  }> }>();
  assert.equal(curriculumEvents.total,1);
  assert.equal(curriculumEvents.rows[0]?.action,"curriculum.unit_created");
  assert.equal(curriculumEvents.rows[0]?.entityType,"curriculum_unit");
  assert.equal("metadata" in curriculumEvents.rows[0]!,false);
  assert.equal((await app.inject({method:"GET",url:auditPath+
    "&category=EXAMS",headers:auth})).json<{total:number}>().total,0);
  const reportExport = await app.inject({method:"GET",
    url:"/v1/admin/learning/reports/export?academicYearId="+yearId,headers:auth});
  assert.equal(reportExport.statusCode,200,reportExport.body);
  assert.match(reportExport.headers["cache-control"] as string,/no-store/);
  const exportedReport = reportExport.json<{total:number;exportedRows:number;
    truncated:boolean;csv:string;filename:string}>();
  assert.equal(exportedReport.total,1);
  assert.equal(exportedReport.exportedRows,1);
  assert.equal(exportedReport.truncated,false);
  assert.match(exportedReport.csv,/published_grades/);
  assert.ok(exportedReport.csv.startsWith("\uFEFF"));
  assert.ok(exportedReport.filename.endsWith(".csv"));
  const auditExport = await app.inject({method:"GET",
    url:"/v1/admin/learning/audit/export?academicYearId="+yearId+
    "&category=CURRICULUM",headers:auth});
  assert.equal(auditExport.statusCode,200,auditExport.body);
  assert.equal(auditExport.json<{total:number;exportedRows:number}>().total,1);
  assert.equal(auditExport.json<{total:number;exportedRows:number}>().exportedRows,1);
  const exportEvents = await client.query<{action:string}>(`SELECT action FROM audit_logs
    WHERE school_id=$1 AND action IN ('learning.report_exported','learning.audit_exported')`,
    [schoolId]);
  assert.equal(exportEvents.rows.length,2);
  // Unscoped export actions are not shown in the academic entity audit feed.
  assert.equal((await app.inject({method:"GET",url:auditPath,headers:auth}))
    .json<{total:number}>().total,1);

  const duplicateUnit = await app.inject({
    method: "POST", url: "/v1/admin/teaching/curriculum", headers: auth,
    payload: { academicYearId: yearId, classId, subjectId, title: "Another chapter", sortOrder: 1 }
  });
  assert.equal(duplicateUnit.statusCode, 409, duplicateUnit.body);
  const teacherCannotDefineCurriculum = await app.inject({
    method: "POST", url: "/v1/admin/teaching/curriculum", headers: teacherHeaders,
    payload: { academicYearId: yearId, classId, subjectId, title: "Unauthorized", sortOrder: 2 }
  });
  assert.equal(teacherCannotDefineCurriculum.statusCode, 403);
  const curriculum = await app.inject({
    method: "GET",
    url: `/v1/admin/teaching/curriculum?academicYearId=${yearId}&classId=${classId}&subjectId=${subjectId}`,
    headers: auth
  });
  assert.equal(curriculum.statusCode, 200);
  assert.deepEqual(curriculum.json<{ units: Array<{ title: string }> }>().units.map((x) => x.title), ["Fractions"]);
  const updatedUnit = await app.inject({
    method: "PATCH", url: `/v1/admin/teaching/curriculum/${unitId}`, headers: auth,
    payload: { title: "Adding fractions" }
  });
  assert.equal(updatedUnit.statusCode, 200, updatedUnit.body);
  assert.equal(updatedUnit.json<{ unit: { title: string } }>().unit.title, "Adding fractions");
  const unauthorizedUnitEdit = await app.inject({
    method: "PATCH", url: `/v1/admin/teaching/curriculum/${unitId}`, headers: teacherHeaders,
    payload: { title: "Teacher override" }
  });
  assert.equal(unauthorizedUnitEdit.statusCode, 403);
  const unusedUnit = await app.inject({
    method: "POST", url: "/v1/admin/teaching/curriculum", headers: auth,
    payload: { academicYearId: yearId, classId, subjectId, title: "Unused lesson", sortOrder: 2 }
  });
  assert.equal(unusedUnit.statusCode, 201, unusedUnit.body);
  const unusedId = unusedUnit.json<{ unit: { id: string } }>().unit.id;
  const removedUnusedUnit = await app.inject({
    method: "DELETE", url: `/v1/admin/teaching/curriculum/${unusedId}`, headers: auth
  });
  assert.equal(removedUnusedUnit.statusCode, 200);


  const teacherWorkspace = await app.inject({
    method: "GET", url: `/v1/teacher/teaching/${ownAssignmentId}`, headers: teacherHeaders
  });
  assert.equal(teacherWorkspace.statusCode, 200, teacherWorkspace.body);
  assert.equal(teacherWorkspace.json<{ units: Array<{ status: string }> }>().units[0]?.status, "NOT_STARTED");
  const otherTeacherDeniedTeaching = await app.inject({
    method: "GET", url: `/v1/teacher/teaching/${ownAssignmentId}`,
    headers: { authorization: `Bearer ${otherToken}` }
  });
  assert.equal(otherTeacherDeniedTeaching.statusCode, 404);
  const adminDeniedTeaching = await app.inject({
    method: "GET", url: `/v1/teacher/teaching/${ownAssignmentId}`, headers: auth
  });
  assert.equal(adminDeniedTeaching.statusCode, 403);
  const createLesson = await app.inject({
    method: "POST", url: `/v1/teacher/teaching/${ownAssignmentId}/lessons`, headers: teacherHeaders,
    payload: {
      lessonDate: "2026-10-13", topic: "Fraction addition",
      objective: "Students add fractions with different denominators.",
      materials: "Textbook chapter 4", notes: "Prepare sample questions.", unitId
    }
  });
  assert.equal(createLesson.statusCode, 201, createLesson.body);
  const lessonId = createLesson.json<{ lesson: { id: string } }>().lesson.id;
  const otherTeacherLessonDenied = await app.inject({
    method: "PATCH", url: `/v1/teacher/teaching/${ownAssignmentId}/lessons/${lessonId}`,
    headers: { authorization: `Bearer ${otherToken}` }, payload: { status: "COMPLETED" }
  });
  assert.equal(otherTeacherLessonDenied.statusCode, 404);
  const invalidLessonDate = await app.inject({
    method: "POST", url: `/v1/teacher/teaching/${ownAssignmentId}/lessons`, headers: teacherHeaders,
    payload: { lessonDate: "2026-02-30", topic: "Invalid", objective: "Invalid", materials: "", notes: "" }
  });
  assert.equal(invalidLessonDate.statusCode, 400);
  const completedLesson = await app.inject({
    method: "PATCH", url: `/v1/teacher/teaching/${ownAssignmentId}/lessons/${lessonId}`,
    headers: teacherHeaders, payload: { status: "COMPLETED", notes: "Taught successfully." }
  });
  assert.equal(completedLesson.statusCode, 200);
  const invalidProgress = await app.inject({
    method: "PUT", url: `/v1/teacher/teaching/${ownAssignmentId}/units/${unitId}`,
    headers: teacherHeaders, payload: { status: "PUBLISHED" }
  });
  assert.equal(invalidProgress.statusCode, 400);
  const completedUnit = await app.inject({
    method: "PUT", url: `/v1/teacher/teaching/${ownAssignmentId}/units/${unitId}`,
    headers: teacherHeaders, payload: { status: "COMPLETED" }
  });
  assert.equal(completedUnit.statusCode, 200);
  assert.equal(completedUnit.json<{ status: string }>().status, "COMPLETED");
  const deleteTrackedUnitDenied = await app.inject({
    method: "DELETE", url: `/v1/admin/teaching/curriculum/${unitId}`, headers: auth
  });
  assert.equal(deleteTrackedUnitDenied.statusCode, 409, deleteTrackedUnitDenied.body);

  const report = await app.inject({
    method: "GET", url: `/v1/teacher/teaching/${ownAssignmentId}/report?from=2026-10-01&to=2026-10-31`,
    headers: teacherHeaders
  });
  assert.equal(report.statusCode, 200, report.body);
  const reportBody = report.json<{ summary: {
    lessonCompleted: number; unitsCompleted: number; unitsTotal: number; assessmentCount: number;
  }; lessons: Array<{ topic: string }> }>();
  assert.equal(reportBody.summary.lessonCompleted, 1);
  assert.equal(reportBody.summary.unitsCompleted, 1);
  assert.equal(reportBody.summary.unitsTotal, 1);
  assert.equal(reportBody.summary.assessmentCount, 0);
  assert.deepEqual(reportBody.lessons.map((x) => x.topic), ["Fraction addition"]);
  const completedTeaching = await app.inject({method:"GET",
    url:progressUrl+"&limit=1&offset=0",headers:auth});
  assert.equal(completedTeaching.statusCode,200,completedTeaching.body);
  const completedTeachingRow = completedTeaching.json<{summary:{
    totalUnits:number;completedUnits:number;inProgressUnits:number;
  };rows:Array<{unitsTotal:number;unitsCompleted:number;unitsNotStarted:number;
    lessonCompleted:number;lessonPlanned:number;attention:string[]}>}> ();
  assert.equal(completedTeachingRow.summary.totalUnits,1);
  assert.equal(completedTeachingRow.summary.completedUnits,1);
  assert.equal(completedTeachingRow.rows[0]?.unitsCompleted,1);
  assert.equal(completedTeachingRow.rows[0]?.unitsNotStarted,0);
  assert.equal(completedTeachingRow.rows[0]?.lessonCompleted,1);
  assert.equal(completedTeachingRow.rows[0]?.attention.includes("INCOMPLETE"),false);
  const completedChapter = await app.inject({method:"GET",url:chaptersUrl+"&status=COMPLETED",headers:auth});
  assert.equal(completedChapter.statusCode,200,completedChapter.body);
  assert.equal(completedChapter.json<{total:number;rows:Array<{status:string}>}>().total,1);
  assert.equal(completedChapter.json<{rows:Array<{status:string}>}>().rows[0]?.status,"COMPLETED");
  assert.equal((await app.inject({method:"GET",url:chaptersUrl+
    "&status=NOT_STARTED",headers:auth})).json<{total:number}>().total,0);
  const completedLessons = await app.inject({method:"GET",url:lessonsUrl+"&status=COMPLETED",headers:auth});
  assert.equal(completedLessons.statusCode,200,completedLessons.body);
  assert.equal(completedLessons.json<{rows:Array<{topic:string;status:string;chapterTitle:string}>}>()
    .rows[0]?.chapterTitle,"Adding fractions");
  assert.equal(completedLessons.json<{rows:Array<{status:string}>}>().rows[0]?.status,"COMPLETED");

  const completedAcademicReport = await app.inject({method:"GET",url:reportPath,headers:auth});
  assert.equal(completedAcademicReport.statusCode,200,completedAcademicReport.body);
  const academicSummary = completedAcademicReport.json<{summary:{
    curriculumUnits:number;completedUnits:number;completedLessons:number;
  }}>().summary;
  assert.equal(academicSummary.curriculumUnits,1);
  assert.equal(academicSummary.completedUnits,1);
  assert.equal(academicSummary.completedLessons,1);

  const invalidReport = await app.inject({
    method: "GET", url: `/v1/teacher/teaching/${ownAssignmentId}/report?from=2026-10-31&to=2026-10-01`,
    headers: teacherHeaders
  });
  assert.equal(invalidReport.statusCode, 400);


  const postponedLesson = await app.inject({method:"POST",
    url:`/v1/teacher/teaching/${ownAssignmentId}/lessons`,headers:teacherHeaders,
    payload:{lessonDate:"2026-11-03",topic:"Postponed class",
      objective:"Practice fractions",materials:"",notes:""}
  });
  assert.equal(postponedLesson.statusCode,201,postponedLesson.body);
  const postponedLessonId = postponedLesson.json<{lesson:{id:string}}>().lesson.id;
  assert.equal((await app.inject({method:"PATCH",url:
    `/v1/teacher/teaching/${ownAssignmentId}/lessons/${postponedLessonId}`,headers:teacherHeaders,
    payload:{status:"POSTPONED"}})).statusCode,200);
  const postponedTeaching = await app.inject({method:"GET",url:progressUrl+
    "&focus=POSTPONED",headers:auth});
  assert.equal(postponedTeaching.statusCode,200,postponedTeaching.body);
  assert.equal(postponedTeaching.json<{total:number;summary:{postponedLessons:number}}>().total,1);
  assert.equal(postponedTeaching.json<{summary:{postponedLessons:number}}>()
    .summary.postponedLessons,1);
  const postponedPlans = await app.inject({method:"GET",url:lessonsUrl+
    "&status=POSTPONED",headers:auth});
  assert.equal(postponedPlans.statusCode,200,postponedPlans.body);
  assert.equal(postponedPlans.json<{total:number;rows:Array<{topic:string}>}>().total,1);
  assert.equal(postponedPlans.json<{rows:Array<{topic:string}>}>().rows[0]?.topic,"Postponed class");

  const createdParent = await app.inject({
    method: "POST", url: "/v1/admin/families/parents", headers: auth,
    payload: { username: "parentclassroster", fullName: "Roster Parent" }
  });
  assert.equal(createdParent.statusCode, 201, createdParent.body);
  const parentId = createdParent.json<{ user: { id: string } }>().user.id;
  const createdStudent = await app.inject({
    method: "POST", url: "/v1/admin/families/students", headers: auth,
    payload: {
      parentUserId: parentId, studentCode: "S-CLASS-ROSTER",
      fullName: "Roster Learner", academicYearId: yearId, classId
    }
  });
  assert.equal(createdStudent.statusCode, 201, createdStudent.body);
  const studentId = createdStudent.json<{ student: { id: string } }>().student.id;
  const ownDetail = await app.inject({
    method: "GET", url: `/v1/teacher/classes/${ownAssignmentId}`, headers: teacherHeaders
  });
  assert.equal(ownDetail.statusCode, 200);
  const ownBody = ownDetail.json<{
    assignment: { assignmentId: string; subjectName: string; classId: string };
    students: Array<{ id: string; fullName: string; studentCode: string }>;
    schedule: Array<{ weekday: string; startsAt: string }>;
    canSuperviseToday: boolean;
  }>();
  assert.equal(ownBody.assignment.assignmentId, ownAssignmentId);
  assert.equal(ownBody.assignment.subjectName, "Mathematics");
  assert.equal(ownBody.canSuperviseToday, true);
  assert.deepEqual(ownBody.students, [{ id: studentId, fullName: "Roster Learner", studentCode: "S-CLASS-ROSTER" }]);
  assert.equal(ownBody.schedule[0]?.startsAt, "08:00");
  assert.equal(ownBody.schedule[0]?.weekday, "SATURDAY");

  const colleagueDenied = await app.inject({
    method: "GET", url: `/v1/teacher/classes/${ownAssignmentId}`,
    headers: { authorization: `Bearer ${otherToken}` }
  });
  assert.equal(colleagueDenied.statusCode, 404);
  const adminDenied = await app.inject({
    method: "GET", url: `/v1/teacher/classes/${ownAssignmentId}`, headers: auth
  });
  assert.equal(adminDenied.statusCode, 403);
  const badId = await app.inject({
    method: "GET", url: "/v1/teacher/classes/not-a-uuid", headers: teacherHeaders
  });
  assert.equal(badId.statusCode, 400);

  // A normal teacher in the SAME class gets a roster, not Negaran privileges.
  const physics = await app.inject({
    method: "POST", url: "/v1/admin/academics/subjects", headers: auth,
    payload: { code: "PHYS-7A", name: "Physics" }
  });
  assert.equal(physics.statusCode, 201, physics.body);
  const physicsId = physics.json<{ subject: { id: string } }>().subject.id;
  const physicsAssignment = await app.inject({
    method: "POST", url: "/v1/admin/academics/assignments", headers: auth,
    payload: { academicYearId: yearId, classId, subjectId: physicsId, teacherUserId: secondTeacherUserId }
  });
  assert.equal(physicsAssignment.statusCode, 201, physicsAssignment.body);
  const otherAssignmentId = physicsAssignment.json<{ assignment: { id: string } }>().assignment.id;
  const otherDetail = await app.inject({
    method: "GET", url: `/v1/teacher/classes/${otherAssignmentId}`,
    headers: { authorization: `Bearer ${otherToken}` }
  });
  assert.equal(otherDetail.statusCode, 200);
  assert.equal(otherDetail.json<{ canSuperviseToday: boolean }>().canSuperviseToday, false);
  assert.equal(otherDetail.json<{ students: unknown[] }>().students.length, 1);
  const otherAssignmentDenied = await app.inject({
    method: "GET", url: `/v1/teacher/classes/${otherAssignmentId}`, headers: teacherHeaders
  });
  assert.equal(otherAssignmentDenied.statusCode, 404);

  const withdraw = await app.inject({
    method: "PATCH", url: `/v1/admin/families/students/${studentId}`,
    headers: auth, payload: { status: "WITHDRAWN" }
  });
  assert.equal(withdraw.statusCode, 200);
  const afterWithdrawal = await app.inject({
    method: "GET", url: `/v1/teacher/classes/${ownAssignmentId}`, headers: teacherHeaders
  });
  assert.equal(afterWithdrawal.statusCode, 200);
  assert.deepEqual(afterWithdrawal.json<{ students: unknown[] }>().students, []);

  const nonNegaran = await app.inject({
    method: "GET", url: `/v1/teacher/negaran/${classId}/attendance?date=${teacherTodayData.date}`,
    headers: { authorization: `Bearer ${otherToken}` }
  });
  assert.equal(nonNegaran.statusCode, 400);
  assert.equal(nonNegaran.json<{ error: string }>().error, "attendance_validation");
  const parentViewDenied = await app.inject({
    method: "GET", url: "/v1/parent/home", headers: teacherHeaders
  });
  assert.equal(parentViewDenied.statusCode, 403);

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
  assert.equal(body.assignments.length, 2);
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

  const otherParentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: auth,
    payload: { username: "otherfamilyparent", fullName: "Other Family Parent" }
  });
  assert.equal(otherParentResponse.statusCode, 201);
  const otherParentId = otherParentResponse.json<{ user: { id: string } }>().user.id;

  const otherStudentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/students",
    headers: auth,
    payload: {
      parentUserId: otherParentId,
      studentCode: "S-OTHER",
      fullName: "Other Family Student",
      academicYearId: yearId,
      classId
    }
  });
  assert.equal(otherStudentResponse.statusCode, 201);
  const otherStudentId = otherStudentResponse.json<{ student: { id: string } }>().student.id;

  const blockedOtherChildRequests = await Promise.all([
    app.inject({
      method: "GET",
      url: `/v1/parent/children/${otherStudentId}/timetable`,
      headers: { authorization: `Bearer ${parentAccess}` }
    }),
    app.inject({
      method: "GET",
      url: `/v1/parent/children/${otherStudentId}/attendance`,
      headers: { authorization: `Bearer ${parentAccess}` }
    }),
    app.inject({
      method: "GET",
      url: `/v1/parent/children/${otherStudentId}/learning`,
      headers: { authorization: `Bearer ${parentAccess}` }
    }),
    app.inject({
      method: "GET",
      url: `/v1/parent/children/${otherStudentId}/fees`,
      headers: { authorization: `Bearer ${parentAccess}` }
    })
  ]);
  for (const response of blockedOtherChildRequests) {
    assert.equal(response.statusCode, 404);
    assert.equal(
      response.json<{ message: string }>().message,
      "Student not found for this parent account."
    );
  }

  const parentAuth = { authorization: `Bearer ${parentAccess}` };
  const forbiddenRoleRequests = await Promise.all([
    app.inject({ method: "GET", url: "/v1/teacher/today", headers: parentAuth }),
    app.inject({ method: "GET", url: "/v1/teacher/learning", headers: parentAuth }),
    app.inject({ method: "POST", url: "/v1/teacher/homework", headers: parentAuth, payload: {} }),
    app.inject({ method: "POST", url: "/v1/teacher/negaran/attendance", headers: parentAuth, payload: {} }),
    app.inject({ method: "GET", url: "/v1/student/home", headers: parentAuth }),
    app.inject({ method: "GET", url: "/v1/admin/families", headers: parentAuth }),
    app.inject({ method: "GET", url: "/v1/admin/communication", headers: parentAuth }),
    app.inject({ method: "POST", url: "/v1/admin/announcements", headers: parentAuth, payload: {} }),
    app.inject({ method: "POST", url: "/v1/admin/fees/invoices", headers: parentAuth, payload: {} }),
    app.inject({
      method: "PATCH",
      url: `/v1/admin/attendance/${studentIds[0]}/students/${studentIds[0]}`,
      headers: parentAuth,
      payload: { status: "ABSENT" }
    })
  ]);
  for (const response of forbiddenRoleRequests) {
    assert.equal(response.statusCode, 403);
  }

  const withdrawnChildId = studentIds[2]!;
  const withdrawChild = await app.inject({
    method: "PATCH",
    url: `/v1/admin/families/students/${withdrawnChildId}`,
    headers: auth,
    payload: { status: "WITHDRAWN" }
  });
  assert.equal(withdrawChild.statusCode, 200);

  const homeAfterWithdrawal = await app.inject({
    method: "GET",
    url: "/v1/parent/home",
    headers: parentAuth
  });
  assert.equal(homeAfterWithdrawal.statusCode, 200);
  assert.deepEqual(
    homeAfterWithdrawal
      .json<{ children: Array<{ student: { id: string } }> }>()
      .children.map((item) => item.student.id),
    studentIds.slice(0, 2)
  );

  const withdrawnChildRequests = await Promise.all([
    app.inject({
      method: "GET",
      url: `/v1/parent/children/${withdrawnChildId}/timetable`,
      headers: parentAuth
    }),
    app.inject({
      method: "GET",
      url: `/v1/parent/children/${withdrawnChildId}/attendance`,
      headers: parentAuth
    }),
    app.inject({
      method: "GET",
      url: `/v1/parent/children/${withdrawnChildId}/learning`,
      headers: parentAuth
    }),
    app.inject({
      method: "GET",
      url: `/v1/parent/children/${withdrawnChildId}/fees`,
      headers: parentAuth
    })
  ]);
  for (const response of withdrawnChildRequests) {
    assert.equal(response.statusCode, 404);
    assert.equal(
      response.json<{ message: string }>().message,
      "Student not found for this parent account."
    );
  }
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

  // Admin Attendance Phase 1: school-derived date defaults, not device-local
  // dates, and retained school/year authorization on the existing endpoint.
  const initialAdminAttendance = await app.inject({
    method: "GET", url: "/v1/admin/attendance/report?academicYearId="+yearId,
    headers: admin
  });
  assert.equal(initialAdminAttendance.statusCode,200,initialAdminAttendance.body);
  const attendanceDefaults = initialAdminAttendance.json<{
    from:string; to:string; summary:{ totalMarks:number };
  }>();
  assert.equal(attendanceDefaults.from,today.date);
  assert.equal(attendanceDefaults.to,today.date);
  assert.equal(attendanceDefaults.summary.totalMarks,0);
  assert.equal((await app.inject({method:"GET",
    url:"/v1/admin/attendance/report?academicYearId="+yearId})).statusCode,401);
  assert.equal((await app.inject({method:"GET",
    url:"/v1/admin/attendance/report?academicYearId="+yearId,
    headers:teacherAuth})).statusCode,403);
  // Admin Attendance Phase 2: school/year-scoped monitoring and closure
  // operations are audited; a closed school day blocks Negaran submission.
  const dailyUrl = `/v1/admin/attendance/monitor?academicYearId=${yearId}&date=${today.date}`;
  const monitoringBefore = await app.inject({method:"GET",url:dailyUrl,headers:admin});
  assert.equal(monitoringBefore.statusCode,200,monitoringBefore.body);
  const dailyBefore=monitoringBefore.json<{
    today:string; classes:Array<{classId:string;state:string}>;
    summary:{expectedClasses:number;submittedExpected:number;pendingClasses:number};
  }>();
  assert.equal(dailyBefore.today,today.date);
  assert.equal(dailyBefore.classes.length,1);
  assert.equal(dailyBefore.classes[0]?.classId,classId);
  assert.equal(dailyBefore.classes[0]?.state,"NOT_SCHEDULED");
  assert.equal(dailyBefore.summary.expectedClasses,0);
  assert.equal(dailyBefore.summary.pendingClasses,0);
  assert.equal((await app.inject({method:"GET",url:dailyUrl,headers:teacherAuth})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:dailyUrl})).statusCode,401);
  const invalidCalendarDay=await app.inject({method:"GET",
    url:`/v1/admin/attendance/monitor?academicYearId=${yearId}&date=2026-02-30`,headers:admin});
  assert.equal(invalidCalendarDay.statusCode,400);
  const closureInput={academicYearId:yearId,date:today.date,reason:"School holiday"};
  const createClosure=await app.inject({method:"POST",
    url:"/v1/admin/attendance/closures",headers:admin,payload:closureInput});
  assert.equal(createClosure.statusCode,201,createClosure.body);
  const closureId=createClosure.json<{closure:{id:string}}>().closure.id;
  const duplicateClosure=await app.inject({method:"POST",
    url:"/v1/admin/attendance/closures",headers:admin,payload:closureInput});
  assert.equal(duplicateClosure.statusCode,409);
  const closureList=await app.inject({method:"GET",url:
    `/v1/admin/attendance/closures?academicYearId=${yearId}`,headers:admin});
  assert.equal(closureList.statusCode,200);
  assert.equal(closureList.json<{closures:unknown[]}>().closures.length,1);
  const closedMonitor=await app.inject({method:"GET",url:dailyUrl,headers:admin});
  assert.equal(closedMonitor.statusCode,200);
  assert.equal(closedMonitor.json<{classes:Array<{state:string}>}>().classes[0]?.state,"CLOSED");
  const deniedClosedSubmission=await app.inject({method:"POST",
    url:"/v1/teacher/negaran/attendance",headers:teacherAuth,
    payload:{classId,date:today.date,entries:[{studentId,status:"ABSENT"}]}});
  assert.equal(deniedClosedSubmission.statusCode,409);
  assert.equal((await app.inject({method:"DELETE",url:
    `/v1/admin/attendance/closures/${closureId}`,headers:teacherAuth})).statusCode,403);
  const reopen=await app.inject({method:"DELETE",
    url:`/v1/admin/attendance/closures/${closureId}`,headers:admin});
  assert.equal(reopen.statusCode,200,reopen.body);
  const reopenedMonitoring=await app.inject({method:"GET",url:dailyUrl,headers:admin});
  assert.equal(reopenedMonitoring.statusCode,200);
  assert.equal(reopenedMonitoring.json<{classes:Array<{state:string}>}>().classes[0]?.state,"NOT_SCHEDULED");
  const calendarAudit=await client.query<{action:string}>(
    "SELECT action FROM audit_logs WHERE school_id=$1 AND action LIKE 'attendance.calendar_%' ORDER BY created_at",
    [schoolId]);
  assert.deepEqual(calendarAudit.rows.map(item=>item.action).sort(),
    ["attendance.calendar_closed","attendance.calendar_reopened"]);
  const payload = {
    classId,
    date: today.date,
    entries: [{ studentId, status: "ABSENT", note: "Original note from Negaran" }]
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

  // Admin Attendance Phase 5: follow-up candidates are real marks, never
  // missing days or automatic cases. Only a school administrator can act.
  const followupQuery="/v1/admin/attendance/followups?academicYearId="+yearId;
  const candidateUrl="/v1/admin/attendance/followups/candidates?academicYearId="+yearId;
  const candidates=await app.inject({method:"GET",url:candidateUrl,headers:admin});
  assert.equal(candidates.statusCode,200,candidates.body);
  assert.equal(candidates.json<{total:number}>().total,1);
  assert.equal(candidates.json<{rows:Array<{status:string;existingCaseId:string|null}>}>().rows[0]?.status,"ABSENT");
  assert.equal(candidates.json<{rows:Array<{existingCaseId:string|null}>}>().rows[0]?.existingCaseId,null);
  assert.equal((await app.inject({method:"GET",url:candidateUrl})).statusCode,401);
  assert.equal((await app.inject({method:"GET",url:candidateUrl,headers:teacherAuth})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:candidateUrl+"&limit=100",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:candidateUrl+"&from=2026-02-30",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:candidateUrl+"&from=2020-01-01&to=2026-10-15",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:followupQuery,headers:admin})).json<{total:number}>().total,0);
  const inputFollowup={
    academicYearId:yearId,attendanceId:submitted.json<{sheet:{attendance:{id:string}}}>().sheet.attendance.id,
    studentId,openingNote:"Contact family to discuss the recorded absence."
  };
  assert.equal((await app.inject({method:"POST",url:"/v1/admin/attendance/followups",
    headers:teacherAuth,payload:inputFollowup})).statusCode,403);
  assert.equal((await app.inject({method:"POST",url:"/v1/admin/attendance/followups",
    headers:admin,payload:{...inputFollowup,openingNote:"No"}})).statusCode,400);
  assert.equal((await app.inject({method:"POST",url:"/v1/admin/attendance/followups",
    headers:admin,payload:{...inputFollowup,assignedToUserId:teacherId}})).statusCode,400);
  const openedCase=await app.inject({method:"POST",url:"/v1/admin/attendance/followups",
    headers:admin,payload:inputFollowup});
  assert.equal(openedCase.statusCode,201,openedCase.body);
  const followupId=openedCase.json<{id:string}>().id;
  assert.equal((await app.inject({method:"POST",url:"/v1/admin/attendance/followups",
    headers:admin,payload:inputFollowup})).statusCode,409);
  const existingCandidate=await app.inject({method:"GET",url:candidateUrl,headers:admin});
  assert.equal(existingCandidate.json<{rows:Array<{existingCaseId:string|null}>}>().rows[0]?.existingCaseId,followupId);
  const initialCases=await app.inject({method:"GET",url:followupQuery,headers:admin});
  assert.equal(initialCases.statusCode,200,initialCases.body);
  const initialCase=initialCases.json<{total:number;summary:{OPEN:number};rows:Array<{updatedAt:string;status:string}>}>();
  assert.equal(initialCase.total,1);
  assert.equal(initialCase.summary.OPEN,1);
  assert.equal(initialCase.rows[0]?.status,"OPEN");
  assert.equal((await app.inject({method:"GET",url:followupQuery,headers:teacherAuth})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:followupQuery+"&status=RESOLVED",headers:admin}))
    .json<{total:number}>().total,0);
  assert.equal((await app.inject({method:"GET",url:followupQuery+"&search=not-a-real-student",headers:admin}))
    .json<{total:number}>().total,0);
  const eventsUrl=`/v1/admin/attendance/followups/${followupId}/activities`;
  assert.equal((await app.inject({method:"GET",url:eventsUrl,headers:teacherAuth})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:eventsUrl,headers:admin}))
    .json<{total:number}>().total,1);
  const recordedCall=await app.inject({method:"POST",url:eventsUrl,headers:admin,payload:{
    kind:"CALL",details:"Spoke to the parent about the recorded absence."
  }});
  assert.equal(recordedCall.statusCode,201,recordedCall.body);
  assert.equal((await app.inject({method:"GET",url:eventsUrl,headers:admin}))
    .json<{total:number}>().total,2);
  assert.equal((await app.inject({method:"POST",url:eventsUrl,headers:admin,payload:{
    kind:"CALL",details:"x"
  }})).statusCode,400);
  const updateUrl=`/v1/admin/attendance/followups/${followupId}`;
  const invalidUpdate=await app.inject({method:"PATCH",url:updateUrl,headers:admin,payload:{
    status:"RESOLVED",note:"Family contacted and issue addressed."
  }});
  assert.equal(invalidUpdate.statusCode,400);
  const updatedFollowup=await app.inject({method:"PATCH",url:updateUrl,headers:admin,payload:{
    status:"RESOLVED",note:"Family contacted and issue addressed.",
    expectedUpdatedAt:initialCase.rows[0]!.updatedAt
  }});
  assert.equal(updatedFollowup.statusCode,200,updatedFollowup.body);
  assert.equal((await app.inject({method:"PATCH",url:updateUrl,headers:admin,payload:{
    status:"OPEN",note:"Stale attempt",expectedUpdatedAt:initialCase.rows[0]!.updatedAt
  }})).statusCode,409);
  assert.equal((await app.inject({method:"POST",url:eventsUrl,headers:admin,payload:{
    kind:"NOTE",details:"Attempt after resolution should not be allowed."
  }})).statusCode,409);
  const closedCase=await app.inject({method:"GET",url:followupQuery,headers:admin});
  const closed=closedCase.json<{summary:{OPEN:number;RESOLVED:number};rows:Array<{status:string;resolutionNote:string}>}>();
  assert.equal(closed.summary.OPEN,0);assert.equal(closed.summary.RESOLVED,1);
  assert.equal(closed.rows[0]?.resolutionNote,"Family contacted and issue addressed.");
  const anotherSchool=await provisionSchool(app,"FOLLOWUPOTHER");
  const anotherAdmin={authorization:`Bearer ${await bootstrapAdmin(app,anotherSchool)}`};
  assert.equal((await app.inject({method:"GET",url:followupQuery,headers:anotherAdmin})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:eventsUrl,headers:anotherAdmin})).statusCode,404);
  assert.equal((await app.inject({method:"POST",url:eventsUrl,headers:anotherAdmin,
    payload:{kind:"NOTE",details:"Try to read another school's case."}})).statusCode,404);
  assert.equal((await app.inject({method:"PATCH",url:updateUrl,headers:anotherAdmin,
    payload:{status:"OPEN",note:"Attempt to change another school.",expectedUpdatedAt:initialCase.rows[0]!.updatedAt}
  })).statusCode,404);
  const followupAudits=await client.query<{action:string}>(
    "SELECT action FROM audit_logs WHERE school_id=$1 AND action LIKE 'attendance.followup_%'",
    [schoolId]
  );
  assert.equal(followupAudits.rows.length,3);
  // No push messages or parent notifications are generated by case activity.
  // The existing attendance notification count remains governed by marks.

  // Phase 6: reporting uses submitted marks, not missing-day inference.
  const analyticsUrl=`/v1/admin/attendance/analytics?academicYearId=${yearId}&from=${today.date}&to=${today.date}`;
  const analytics=await app.inject({method:"GET",url:analyticsUrl,headers:admin});
  assert.equal(analytics.statusCode,200,analytics.body);
  const analyticsData=analytics.json<{
    summary:{present:number;absent:number;late:number;excused:number;rate:number|null;
      recorded:number;submittedRegisters:number;daysWithRegisters:number};
    classes:Array<{classId:string;absent:number;rate:number|null;submittedRegisters:number}>;
    days:Array<{date:string;absent:number;rate:number|null;submittedRegisters:number}>;
  }>();
  assert.equal(analyticsData.summary.recorded,1);
  assert.equal(analyticsData.summary.absent,1);
  assert.equal(analyticsData.summary.present,0);
  assert.equal(analyticsData.summary.rate,0);
  assert.equal(analyticsData.summary.submittedRegisters,1);
  assert.equal(analyticsData.summary.daysWithRegisters,1);
  assert.equal(analyticsData.classes[0]?.classId,classId);
  assert.equal(analyticsData.classes[0]?.absent,1);
  assert.equal(analyticsData.classes[0]?.rate,0);
  assert.equal(analyticsData.days[0]?.date,today.date);
  assert.equal(analyticsData.days[0]?.submittedRegisters,1);
  assert.equal((await app.inject({method:"GET",url:analyticsUrl})).statusCode,401);
  assert.equal((await app.inject({method:"GET",url:analyticsUrl,headers:teacherAuth})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:analyticsUrl,headers:anotherAdmin})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:analyticsUrl+"&classId="+teacherId,headers:admin})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:analyticsUrl+"&from=2026-02-30",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:analyticsUrl+"&to=2026-01-01",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:analyticsUrl+"&from=2026-01-01",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:analyticsUrl+"&extraneous=1",headers:admin})).statusCode,400);
  const noMarks=await app.inject({method:"GET",headers:admin,url:
    `/v1/admin/attendance/analytics?academicYearId=${yearId}&classId=${classId}&from=2026-03-21&to=2026-03-21`});
  assert.equal(noMarks.statusCode,200,noMarks.body);
  const emptyReport=noMarks.json<{summary:{recorded:number;rate:number|null};classes:Array<{rate:number|null;absent:number}>;days:unknown[]}>();
  assert.equal(emptyReport.summary.recorded,0);
  assert.equal(emptyReport.summary.rate,null);
  assert.equal(emptyReport.classes[0]?.absent,0);
  assert.equal(emptyReport.classes[0]?.rate,null);
  assert.equal(emptyReport.days.length,0);
  const analyticsStudentsUrl=analyticsUrl.replace("/analytics?","/analytics/students?");
  const analyticsStudents=await app.inject({method:"GET",url:analyticsStudentsUrl,headers:admin});
  assert.equal(analyticsStudents.statusCode,200,analyticsStudents.body);
  const studentReport=analyticsStudents.json<{total:number;rows:Array<{studentId:string;classId:string;absent:number;rate:number|null}>}>();
  assert.equal(studentReport.total,1);
  assert.equal(studentReport.rows[0]?.studentId,studentId);
  assert.equal(studentReport.rows[0]?.classId,classId);
  assert.equal(studentReport.rows[0]?.absent,1);
  assert.equal(studentReport.rows[0]?.rate,0);
  assert.equal((await app.inject({method:"GET",url:analyticsStudentsUrl+"&limit=60",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:analyticsStudentsUrl+"&limit=1&offset=1",headers:admin}))
    .json<{total:number;rows:unknown[]}>().rows.length,0);
  assert.equal((await app.inject({method:"GET",url:analyticsStudentsUrl,headers:teacherAuth})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:analyticsStudentsUrl,headers:anotherAdmin})).statusCode,404);
  const analyticsExportUrl=analyticsUrl.replace("/analytics?","/analytics/export?");
  for(const kind of ["classes","days","students"]) {
    const csvResult=await app.inject({method:"GET",url:analyticsExportUrl+"&kind="+kind,headers:admin});
    assert.equal(csvResult.statusCode,200,csvResult.body);
    assert.ok(String(csvResult.headers["content-type"]).includes("text/csv"));
    assert.match(csvResult.headers["content-disposition"] as string,/attachment/);
    assert.ok(csvResult.body.startsWith("\uFEFF"));
    assert.ok(csvResult.body.includes('"1"'));
    assert.ok(csvResult.body.includes("\r\n"));
  }
  assert.equal((await app.inject({method:"GET",url:analyticsExportUrl+"&kind=raw",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:analyticsExportUrl+"&kind=students",headers:teacherAuth})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:analyticsExportUrl+"&kind=students",headers:anotherAdmin})).statusCode,404);
  // Student exports require the same selected school/year/date scope as report views.

  // Admin Attendance Phase 3 integration: school-scoped directory and register.
  const directoryUrl = `/v1/admin/attendance/students?academicYearId=${yearId}&limit=10`;
  const directory = await app.inject({ method:"GET",url:directoryUrl,headers:admin });
  assert.equal(directory.statusCode,200,directory.body);
  assert.equal(directory.json<{total:number;rows:Array<{recorded:number;absent:number}>}>().total,1);
  assert.equal(directory.json<{rows:Array<{recorded:number;absent:number}>}>().rows[0]?.absent,1);
  assert.equal((await app.inject({method:"GET",url:directoryUrl,headers:teacherAuth})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:directoryUrl+"&limit=80",headers:admin})).statusCode,400);
  const classUrl=`/v1/admin/attendance/classes/${classId}/register?academicYearId=${yearId}&date=${today.date}`;
  const register=await app.inject({method:"GET",url:classUrl,headers:admin});
  assert.equal(register.statusCode,200,register.body);
  assert.equal(register.json<{students:Array<{status:string}>}>().students[0]?.status,"ABSENT");
  assert.equal((await app.inject({method:"GET",url:classUrl,headers:teacherAuth})).statusCode,403);
  const phase3HistoryUrl=`/v1/admin/attendance/students/${studentId}/history?academicYearId=${yearId}&from=${today.date}&to=${today.date}`;
  const studentHistory=await app.inject({method:"GET",url:phase3HistoryUrl,headers:admin});
  assert.equal(studentHistory.statusCode,200,studentHistory.body);
  assert.equal(studentHistory.json<{days:Array<{status:string}>}>().days[0]?.status,"ABSENT");
  assert.equal((await app.inject({method:"GET",url:phase3HistoryUrl,headers:teacherAuth})).statusCode,403);

  const retried = await app.inject({
    method: "POST",
    url: "/v1/teacher/negaran/attendance",
    headers: teacherAuth,
    payload
  });
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.json<{ changed: boolean; notificationCount: number }>().changed, false);
  assert.equal(retried.json<{ changed: boolean; notificationCount: number }>().notificationCount, 0);

  // Phase 4: month-history is read-only, summary derives from submitted marks,
  // and the data is visible only to the active Negaran for this class.
  const historyUrl = `/v1/teacher/negaran/${classId}/history?from=${today.date}&to=${today.date}`;
  const attendanceHistory = await app.inject({
    method: "GET", url: historyUrl, headers: teacherAuth
  });
  assert.equal(attendanceHistory.statusCode, 200);
  const initialHistory = attendanceHistory.json<{
    days: Array<{ date: string; absent: number; total: number; recordStatus: string }>;
    summary: { submittedDays: number; totalMarks: number; absent: number; attendancePercent: number | null };
  }>();
  assert.equal(initialHistory.days.length, 1);
  assert.equal(initialHistory.days[0]?.date, today.date);
  assert.equal(initialHistory.days[0]?.absent, 1);
  assert.equal(initialHistory.days[0]?.total, 1);
  assert.deepEqual(initialHistory.summary, {
    submittedDays: 1, present: 0, absent: 1, late: 0, excused: 0,
    totalMarks: 1, attendancePercent: 0
  });

  const invalidRange = await app.inject({
    method: "GET",
    url: `/v1/teacher/negaran/${classId}/history?from=${today.date}&to=2099-01-01`,
    headers: teacherAuth
  });
  assert.equal(invalidRange.statusCode, 400);
  assert.equal(invalidRange.json<{ error: string }>().error, "attendance_validation");

  const invalidCalendar = await app.inject({
    method: "GET",
    url: `/v1/teacher/negaran/${classId}/history?from=2026-02-30&to=${today.date}`,
    headers: teacherAuth
  });
  assert.equal(invalidCalendar.statusCode, 400);
  assert.equal(invalidCalendar.json<{ error: string }>().error, "attendance_validation");

  const missingQuery = await app.inject({
    method: "GET", url: `/v1/teacher/negaran/${classId}/history`, headers: teacherAuth
  });
  assert.equal(missingQuery.statusCode, 400);

  const unauthorizedReport = await app.inject({
    method: "GET", url: historyUrl, headers: admin
  });
  assert.equal(unauthorizedReport.statusCode, 403);

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


  // Admin Attendance Phase 7 — role matrix spanning all six administrator
  // views. Parent/Negaran clients must never read admin follow-up notes,
  // corrections, analytics, CSV or class/student histories through admin APIs.
  const phase7AdminUrls=[
    `/v1/admin/attendance/report?academicYearId=${yearId}&from=${today.date}&to=${today.date}`,
    `/v1/admin/attendance/monitor?academicYearId=${yearId}&date=${today.date}`,
    `/v1/admin/attendance/closures?academicYearId=${yearId}`,
    `/v1/admin/attendance/students?academicYearId=${yearId}`,
    `/v1/admin/attendance/students/${studentId}/history?academicYearId=${yearId}&from=${today.date}&to=${today.date}`,
    `/v1/admin/attendance/classes/${classId}/register?academicYearId=${yearId}&date=${today.date}`,
    `/v1/admin/attendance/followups/assignees`,
    `/v1/admin/attendance/followups/candidates?academicYearId=${yearId}`,
    `/v1/admin/attendance/followups?academicYearId=${yearId}`,
    `/v1/admin/attendance/followups/${followupId}/activities`,
    `/v1/admin/attendance/audit?academicYearId=${yearId}`,
    `/v1/admin/attendance/analytics?academicYearId=${yearId}&from=${today.date}&to=${today.date}`,
    `/v1/admin/attendance/analytics/students?academicYearId=${yearId}&from=${today.date}&to=${today.date}`,
    `/v1/admin/attendance/analytics/export?academicYearId=${yearId}&from=${today.date}&to=${today.date}&kind=students`
  ];
  for(const url of phase7AdminUrls){
    const unauthenticated=await app.inject({method:"GET",url});
    assert.equal(unauthenticated.statusCode,401,`Expected anonymous 401: ${url}`);
    for(const [role,headers] of [["teacher",teacherAuth],["parent",parentAuth]] as const){
      const forbidden=await app.inject({method:"GET",url,headers});
      assert.equal(forbidden.statusCode,403,`Expected ${role} 403: ${url}`);
    }
    const differentSchool=await app.inject({method:"GET",url,headers:anotherAdmin});
    // Assignees intentionally is year-independent: another school may see
    // its *own* administrators, never the student's school or private data.
    assert.ok(!differentSchool.body.includes(studentId),`Leaked student ID across schools: ${url}`);
    assert.ok(!differentSchool.body.includes("ATT-001"),`Leaked student code across schools: ${url}`);
    assert.ok(!differentSchool.body.includes("Spoke to the parent"),`Leaked private notes across schools: ${url}`);
  }
  assert.equal(phase7AdminUrls.length,14);
  // Reading any of these school datasets must not create parent alerts or
  // automatically open a follow-up case for unsubmitted class-days.
  const caseRows=await client.query<{total:string}>(
    "SELECT count(*)::text AS total FROM attendance_followup_cases WHERE school_id=$1",[schoolId]);
  assert.equal(Number(caseRows.rows[0]?.total),1);

  // Invalid calendar dates must return client validation errors, not
  // PostgreSQL date-cast failures/HTTP 500.
  const invalidTeacherDate = await app.inject({
    method: "GET",
    url: `/v1/teacher/negaran/${classId}/attendance?date=2026-02-30`,
    headers: teacherAuth
  });
  assert.equal(invalidTeacherDate.statusCode, 400);
  assert.equal(invalidTeacherDate.json<{ error: string }>().error, "attendance_validation");
  const invalidParentDate = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/attendance?from=2026-02-30`,
    headers: parentAuth
  });
  assert.equal(invalidParentDate.statusCode, 400);
  const invalidAdminDate = await app.inject({
    method: "GET",
    url: "/v1/admin/attendance/report?from=2026-02-30&to=2026-03-01",
    headers: admin
  });
  assert.equal(invalidAdminDate.statusCode, 400);

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

  // Test 13: a read Absence alert must be retired when a same-day Negaran
  // correction changes the mark. A subsequent absence must re-alert unread.
  const initialAlert = alerts.json<{ notifications: Array<{ id: string }> }>().notifications[0]!;
  const originalVersion = submitted.json<{ sheet: { attendance: { updatedAt: string } } }>()
    .sheet.attendance.updatedAt;
  const readInitial = await app.inject({
    method: "POST", url: `/v1/parent/notifications/${initialAlert.id}/read`, headers: parentAuth
  });
  assert.equal(readInitial.statusCode, 200);

  const toPresent = await app.inject({
    method: "POST", url: "/v1/teacher/negaran/attendance", headers: teacherAuth,
    payload: { ...payload, entries: [{ studentId, status: "PRESENT" }], expectedUpdatedAt: originalVersion }
  });
  assert.equal(toPresent.statusCode, 200);
  assert.equal(toPresent.json<{ changed: boolean }>().changed, true);
  const cancelledAlerts = await app.inject({
    method: "GET", url: "/v1/parent/notifications", headers: parentAuth
  });
  assert.deepEqual(cancelledAlerts.json<{ notifications: unknown[] }>().notifications, []);
  const cannotReadCancelled = await app.inject({
    method: "POST", url: `/v1/parent/notifications/${initialAlert.id}/read`, headers: parentAuth
  });
  assert.equal(cannotReadCancelled.statusCode, 404);

  const toExcused = await app.inject({
    method: "POST", url: "/v1/teacher/negaran/attendance", headers: teacherAuth,
    payload: {
      ...payload, entries: [{ studentId, status: "EXCUSED" }],
      expectedUpdatedAt: toPresent.json<{ sheet: { attendance: { updatedAt: string } } }>()
        .sheet.attendance.updatedAt
    }
  });
  assert.equal(toExcused.statusCode, 200);
  const excusedAlerts = await app.inject({
    method: "GET", url: "/v1/parent/notifications", headers: parentAuth
  });
  assert.deepEqual(excusedAlerts.json<{ notifications: unknown[] }>().notifications, []);

  const toLate = await app.inject({
    method: "POST", url: "/v1/teacher/negaran/attendance", headers: teacherAuth,
    payload: {
      ...payload, entries: [{ studentId, status: "LATE" }],
      expectedUpdatedAt: toExcused.json<{ sheet: { attendance: { updatedAt: string } } }>()
        .sheet.attendance.updatedAt
    }
  });
  assert.equal(toLate.statusCode, 200);
  const renewedAlert = await app.inject({
    method: "GET", url: "/v1/parent/notifications", headers: parentAuth
  });
  assert.equal(renewedAlert.json<{ notifications: Array<{ type: string; readAt: string | null }> }>()
    .notifications[0]?.type, "ATTENDANCE_LATE");
  assert.equal(renewedAlert.json<{ notifications: Array<{ readAt: string | null }> }>()
    .notifications[0]?.readAt, null);

  const backAbsent = await app.inject({
    method: "POST", url: "/v1/teacher/negaran/attendance", headers: teacherAuth,
    payload: {
      ...payload, expectedUpdatedAt: toLate.json<{ sheet: { attendance: { updatedAt: string } } }>()
        .sheet.attendance.updatedAt
    }
  });
  assert.equal(backAbsent.statusCode, 200);
  const alertsAfterReopen = await app.inject({
    method: "GET", url: "/v1/parent/notifications", headers: parentAuth
  });
  assert.equal(alertsAfterReopen.json<{ notifications: Array<{ type: string; readAt: string | null }> }>()
    .notifications[0]?.type, "ATTENDANCE_ABSENT");
  assert.equal(alertsAfterReopen.json<{ notifications: Array<{ readAt: string | null }> }>()
    .notifications[0]?.readAt, null);
  // Admin receives the current record; the stale teacher form remains old.
  const staleTeacherVersion = backAbsent.json<{ sheet: { attendance: { updatedAt: string } } }>()
    .sheet.attendance.updatedAt;
  const rereadAlert = await app.inject({
    method: "POST", url: `/v1/parent/notifications/${initialAlert.id}/read`, headers: parentAuth
  });
  assert.equal(rereadAlert.statusCode, 200);

  // Phase 4 requires a reason and the exact mark revision, and rejects
  // stale writes before mutating the mark, notifications or audit history.
  const phase4CorrectionUrl = `/v1/admin/attendance/${submitted.json<{ sheet: { attendance: { id: string } } }>().sheet.attendance.id}/students/${studentId}`;
  const beforeCorrection = await app.inject({ method:"GET",
    url:"/v1/admin/attendance/report?academicYearId="+yearId+
      "&from="+today.date+"&to="+today.date,headers:admin });
  assert.equal(beforeCorrection.statusCode,200);
  const beforeRow=beforeCorrection.json<{ rows:Array<{updatedAt:string;note:string|null;status:string}> }>().rows[0]!;
  const noReason=await app.inject({method:"PATCH",url:phase4CorrectionUrl,headers:admin,
    payload:{status:"PRESENT",expectedUpdatedAt:beforeRow.updatedAt}});
  assert.equal(noReason.statusCode,400);
  const noRevision=await app.inject({method:"PATCH",url:phase4CorrectionUrl,headers:admin,
    payload:{status:"PRESENT",reason:"Fix recorded mark"}});
  assert.equal(noRevision.statusCode,400);
  const staleRevision=await app.inject({method:"PATCH",url:phase4CorrectionUrl,headers:admin,
    payload:{status:"PRESENT",reason:"Fix recorded mark",expectedUpdatedAt:"2025-01-01T00:00:00.000Z"}});
  assert.equal(staleRevision.statusCode,409);
  assert.equal((await app.inject({method:"PATCH",url:phase4CorrectionUrl,headers:teacherAuth,
    payload:{status:"PRESENT",reason:"Fix recorded mark",expectedUpdatedAt:beforeRow.updatedAt}})).statusCode,403);
  const auditUrl="/v1/admin/attendance/audit?academicYearId="+yearId;
  assert.equal((await app.inject({method:"GET",url:auditUrl})).statusCode,401);
  assert.equal((await app.inject({method:"GET",url:auditUrl,headers:teacherAuth})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:auditUrl+"&limit=100",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:auditUrl+"&from=2026-02-30",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:auditUrl+"&from=2024-01-01&to=2026-10-15",headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:
    "/v1/admin/attendance/audit?academicYearId=00000000-0000-4000-8000-000000000001",headers:admin})).statusCode,404);
  assert.equal((await app.inject({method:"GET",url:auditUrl,headers:admin}))
    .json<{total:number}>().total,0);

  const corrected = await app.inject({
    method: "PATCH",
    url: `/v1/admin/attendance/${submitted.json<{ sheet: { attendance: { id: string } } }>().sheet.attendance.id}/students/${studentId}`,
    headers: admin,
    payload: {
      status: "PRESENT", reason: "Teacher sheet had an incorrect status",
      expectedUpdatedAt: (await app.inject({
        method: "GET",
        url: "/v1/admin/attendance/report?academicYearId=" + yearId +
          "&from=" + today.date + "&to=" + today.date, headers: admin
      })).json<{ rows: Array<{ updatedAt: string }> }>().rows[0]!.updatedAt
    }
  });
  assert.equal(corrected.statusCode, 200, corrected.body);
  assert.equal(corrected.json<{ previousStatus: string; entry: { status: string } }>().previousStatus, "ABSENT");
  assert.equal(corrected.json<{ entry: { status: string } }>().entry.status, "PRESENT");
  const analyticsAfterCorrection=await app.inject({method:"GET",url:analyticsUrl,headers:admin});
  assert.equal(analyticsAfterCorrection.statusCode,200,analyticsAfterCorrection.body);
  assert.equal(analyticsAfterCorrection.json<{summary:{absent:number;present:number;rate:number|null}}>().summary.absent,0);
  assert.equal(analyticsAfterCorrection.json<{summary:{absent:number;present:number;rate:number|null}}>().summary.present,1);
  assert.equal(analyticsAfterCorrection.json<{summary:{rate:number|null}}>().summary.rate,100);

  assert.equal(corrected.json<{ entry: { note: string | null } }>().entry.note,beforeRow.note);
  const afterCorrection=await app.inject({method:"GET",
    url:"/v1/admin/attendance/report?academicYearId="+yearId+
      "&from="+today.date+"&to="+today.date,headers:admin});
  assert.equal(afterCorrection.json<{rows:Array<{note:string|null}>}>().rows[0]?.note,beforeRow.note);
  const auditResponse=await app.inject({method:"GET",url:auditUrl,headers:admin});
  assert.equal(auditResponse.statusCode,200,auditResponse.body);
  const auditData=auditResponse.json<{total:number;rows:Array<{
    studentId:string;date:string;previousStatus:string;status:string;
    reason:string;originalNote:string|null;actorName:string;
  }>}>();
  assert.equal(auditData.total,1);
  assert.equal(auditData.rows[0]?.studentId,studentId);
  assert.equal(auditData.rows[0]?.date,today.date);
  assert.equal(auditData.rows[0]?.previousStatus,"ABSENT");
  assert.equal(auditData.rows[0]?.status,"PRESENT");
  assert.equal(auditData.rows[0]?.reason,"Teacher sheet had an incorrect status");
  assert.equal(auditData.rows[0]?.originalNote,beforeRow.note);
  assert.equal((await app.inject({method:"GET",url:auditUrl+"&search=missing-student",headers:admin}))
    .json<{total:number}>().total,0);
  assert.equal((await app.inject({method:"GET",url:auditUrl+"&limit=1&offset=1",headers:admin}))
    .json<{rows:unknown[]}>().rows.length,0);
  assert.equal((await app.inject({method:"GET",url:auditUrl+"&from=2020-01-01&to=2020-01-01",headers:admin}))
    .json<{total:number}>().total,0);

  // Phase 7 — one authoritative correction must propagate consistently
  // to reports, student directory/history, teacher/parent read models,
  // follow-up source/current status and CSV exports.
  const postCorrectionViews=await Promise.all([
    app.inject({method:"GET",url:directoryUrl,headers:admin}),
    app.inject({method:"GET",url:classUrl,headers:admin}),
    app.inject({method:"GET",url:phase3HistoryUrl,headers:admin}),
    app.inject({method:"GET",url:followupQuery,headers:admin}),
    app.inject({method:"GET",url:analyticsStudentsUrl,headers:admin}),
    app.inject({method:"GET",url:analyticsExportUrl+"&kind=students",headers:admin})
  ]);
  for(const item of postCorrectionViews)assert.equal(item.statusCode,200,item.body);
  assert.equal(postCorrectionViews[0]!.json<{rows:Array<{present:number;absent:number}>}>()
    .rows[0]?.present,1);
  assert.equal(postCorrectionViews[0]!.json<{rows:Array<{absent:number}>}>().rows[0]?.absent,0);
  assert.equal(postCorrectionViews[1]!.json<{students:Array<{status:string}>}>()
    .students[0]?.status,"PRESENT");
  assert.equal(postCorrectionViews[2]!.json<{days:Array<{status:string}>}>()
    .days[0]?.status,"PRESENT");
  assert.equal(postCorrectionViews[3]!.json<{rows:Array<{sourceStatus:string;currentStatus:string;
    status:string}>}>().rows[0]?.sourceStatus,"ABSENT");
  assert.equal(postCorrectionViews[3]!.json<{rows:Array<{currentStatus:string;status:string}>}>()
    .rows[0]?.currentStatus,"PRESENT");
  assert.equal(postCorrectionViews[3]!.json<{rows:Array<{status:string}>}>().rows[0]?.status,"RESOLVED");
  assert.equal(postCorrectionViews[4]!.json<{rows:Array<{present:number;absent:number;rate:number|null}>}>()
    .rows[0]?.present,1);
  assert.equal(postCorrectionViews[4]!.json<{rows:Array<{absent:number;rate:number|null}>}>()
    .rows[0]?.absent,0);
  assert.equal(postCorrectionViews[4]!.json<{rows:Array<{rate:number|null}>}>().rows[0]?.rate,100);
  assert.ok(postCorrectionViews[5]!.body.includes('"100"'));
  assert.ok(!postCorrectionViews[5]!.body.includes("Original note from Negaran"));
  assert.ok(!postCorrectionViews[5]!.body.includes("Spoke to the parent"));
  assert.equal(postCorrectionViews[5]!.headers["cache-control"],"private, no-store");

  // A stale second form cannot silently overwrite an already corrected mark.
  const conflict=await app.inject({method:"PATCH",url:phase4CorrectionUrl,headers:admin,
    payload:{status:"LATE",reason:"Later stale attempt",expectedUpdatedAt:beforeRow.updatedAt}});
  assert.equal(conflict.statusCode,409);


  const correctedHistory = await app.inject({
    method: "GET", url: historyUrl, headers: teacherAuth
  });
  assert.equal(correctedHistory.statusCode, 200);
  const correctedSummary = correctedHistory.json<{
    days: Array<{ present: number; absent: number; recordStatus: string }>;
    summary: { present: number; absent: number; attendancePercent: number };
  }>();
  assert.equal(correctedSummary.days[0]?.present, 1);
  assert.equal(correctedSummary.days[0]?.absent, 0);
  assert.equal(correctedSummary.days[0]?.recordStatus, "CORRECTED");
  assert.equal(correctedSummary.summary.attendancePercent, 100);

  const parentAfterCorrection = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/attendance`,
    headers: parentAuth
  });
  assert.equal(parentAfterCorrection.json<{ days: Array<{ status: string }> }>().days[0]?.status, "PRESENT");

  // Admin correction also retires a *read* alert and cannot be overwritten by
  // the teacher's previously loaded attendance form.
  const postAdminAlerts = await app.inject({
    method: "GET", url: "/v1/parent/notifications", headers: parentAuth
  });
  assert.deepEqual(postAdminAlerts.json<{ notifications: unknown[] }>().notifications, []);
  const staleSubmit = await app.inject({
    method: "POST", url: "/v1/teacher/negaran/attendance", headers: teacherAuth,
    payload: { ...payload, expectedUpdatedAt: staleTeacherVersion }
  });
  assert.equal(staleSubmit.statusCode, 409);
  assert.equal(staleSubmit.json<{ error: string }>().error, "attendance_conflict");
  const afterConflict = await app.inject({
    method: "GET", url: `/v1/parent/children/${studentId}/attendance`, headers: parentAuth
  });
  assert.equal(afterConflict.json<{ days: Array<{ status: string }> }>().days[0]?.status, "PRESENT");

  // A status-only retry must preserve the admin's correction note and not
  // recreate an absence alert. The current revision may be used by the UI.
  const reloadedSheet = await app.inject({
    method: "GET", url: `/v1/teacher/negaran/${classId}/attendance?date=${today.date}`, headers: teacherAuth
  });
  const reloadedVersion = reloadedSheet.json<{ attendance: { updatedAt: string } }>()
    .attendance.updatedAt;
  const sameMarkRetry = await app.inject({
    method: "POST", url: "/v1/teacher/negaran/attendance", headers: teacherAuth,
    payload: {
      ...payload, entries: [{ studentId, status: "PRESENT" }],
      expectedUpdatedAt: reloadedVersion
    }
  });
  assert.equal(sameMarkRetry.statusCode, 200);
  assert.equal(sameMarkRetry.json<{ changed: boolean; sheet: { students: Array<{ note: string }> } }>()
    .changed, false);
  assert.equal(sameMarkRetry.json<{ sheet: { students: Array<{ note: string }> } }>()
    .sheet.students[0]?.note, "Original note from Negaran");

  // Test 13: audit events are committed once per real change, not on
  // duplicate retries or rejected stale edits, and have the correct actor.
  const auditRows = await client.query<{
    action: string; actor_user_id: string; entity_id: string
  }>(
    "SELECT action, actor_user_id, entity_id FROM audit_logs WHERE school_id = $1 AND action IN ('attendance.submitted','attendance.corrected_by_negaran','attendance.corrected_by_admin') ORDER BY created_at, id",
    [schoolId]
  );
  assert.equal(auditRows.rows.filter((item) => item.action === "attendance.submitted").length, 1);
  assert.equal(auditRows.rows.filter((item) => item.action === "attendance.corrected_by_negaran").length, 4);
  assert.equal(auditRows.rows.filter((item) => item.action === "attendance.corrected_by_admin").length, 1);
  assert.equal(auditRows.rows.length, 6);
  assert.equal(auditRows.rows.filter((item) => item.actor_user_id === teacherId).length, 5);
  assert.equal(new Set(auditRows.rows.map((item) => item.entity_id)).size, 1);

  // Preserve the originally marked students on historical sheets even when
  // their present-day enrollment has since been withdrawn. Admin corrections
  // remain the only way to change locked historical marks.
  const withdrawnResponse = await app.inject({
    method: "PATCH", url: `/v1/admin/families/students/${studentId}`,
    headers: admin, payload: { status: "WITHDRAWN" }
  });
  assert.equal(withdrawnResponse.statusCode, 200);
  const yesterdayDate = new Date(today.date + "T12:00:00Z");
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  await client.query(
    "UPDATE daily_attendances SET date = $1 WHERE id = $2",
    [yesterday, submitted.json<{ sheet: { attendance: { id: string } } }>().sheet.attendance.id]
  );
  const historicalSheet = await app.inject({
    method: "GET",
    url: `/v1/teacher/negaran/${classId}/attendance?date=${yesterday}`,
    headers: teacherAuth
  });
  assert.equal(historicalSheet.statusCode, 200);
  const historicalData = historicalSheet.json<{
    canEdit: boolean; locked: boolean;
    students: Array<{ student: { id: string }; status: string }>
  }>();
  assert.equal(historicalData.canEdit, false);
  assert.equal(historicalData.locked, true);
  assert.deepEqual(historicalData.students.map((row) => ({
    id: row.student.id, status: row.status
  })), [{ id: studentId, status: "PRESENT" }]);

  const historicalSummary = await app.inject({
    method: "GET",
    url: `/v1/teacher/negaran/${classId}/history?from=${yesterday}&to=${today.date}`,
    headers: teacherAuth
  });
  assert.equal(historicalSummary.statusCode, 200);
  assert.equal(historicalSummary.json<{ summary: { present: number } }>().summary.present, 1);
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

  const historyDenied = await app.inject({
    method: "GET",
    url: `/v1/teacher/negaran/${classId}/history?from=${today}&to=${today}`,
    headers: { authorization: `Bearer ${accessToken}` }
  });
  assert.equal(historyDenied.statusCode, 400);
  assert.equal(historyDenied.json<{ error: string }>().error, "attendance_validation");

  const unauthorizedAnnouncement = await app.inject({
    method: "POST",
    url: "/v1/teacher/announcements",
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      title: "Unauthorized class update",
      content: "Regular teaching assignment does not grant Negaran communication permissions.",
      audienceScope: "CLASS",
      classId
    }
  });
  assert.equal(unauthorizedAnnouncement.statusCode, 400);
  assert.equal(unauthorizedAnnouncement.json<{ error: string }>().error, "communication_validation");

  const emptyTeacherToday = await app.inject({
    method: "GET", url: "/v1/teacher/today",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  assert.equal(emptyTeacherToday.statusCode, 200);
  assert.deepEqual(emptyTeacherToday.json<{
    schedule: unknown[];
    supervisedClasses: unknown[];
  }>().schedule, []);
  assert.deepEqual(emptyTeacherToday.json<{
    supervisedClasses: unknown[];
  }>().supervisedClasses, []);
});


test("homework stays private as draft, then becomes visible to parent and linked student after publish", async (t) => {
  const { app, client, learningExtensionsStore } = await createTestApp();
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

  // Test 14.1, 14.2 and 14.11: reject invalid payloads and forged assignments.
  const invalidCases = [
    { assignmentId, content: "Missing title", dueAt: "2099-12-31T12:00:00Z" },
    { assignmentId, title: "Good title", content: "  ", dueAt: "2099-12-31T12:00:00Z" },
    { assignmentId, title: "Good title", content: "Valid", dueAt: "bad date" },
    { assignmentId, title: "Good title", content: "Valid", dueAt: "2001-01-01T00:00:00Z" },
    { assignmentId, title: "Good title", content: "Valid", dueAt: "2099-12-31T12:00:00Z",
      attachmentUrl: "http://untrusted.example/worksheet.pdf" }
  ];
  for (const payload of invalidCases) {
    const response = await app.inject({
      method: "POST", url: "/v1/teacher/homework", headers: teacherAuth, payload
    });
    assert.equal(response.statusCode, 400, response.body);
  }
  const parentCannotCreate = await app.inject({
    method: "POST", url: "/v1/teacher/homework", headers: parentAuth,
    payload: { assignmentId, title: "Unauthorized", content: "No", dueAt: "2099-12-31T12:00:00Z" }
  });
  assert.equal(parentCannotCreate.statusCode, 403);

  const otherTeacherAccount = await app.inject({
    method: "POST", url: "/v1/admin/users", headers: admin,
    payload: { username: "teacher.unassigned", role: "TEACHER" }
  });
  assert.equal(otherTeacherAccount.statusCode, 201);
  const otherTeacher = otherTeacherAccount.json<{ temporaryPassword: string }>();
  const otherLogin = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { schoolId, expectedRole: "TEACHER", username: "teacher.unassigned",
      password: otherTeacher.temporaryPassword }
  });
  assert.equal(otherLogin.statusCode, 200);
  const otherChanged = await app.inject({
    method: "POST", url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${otherLogin.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "UnassignedTeacher2099!" }
  });
  assert.equal(otherChanged.statusCode, 200);
  const otherTeacherAuth = {
    authorization: `Bearer ${otherChanged.json<{ accessToken: string }>().accessToken}`
  };
  const unrelatedCreate = await app.inject({
    method: "POST", url: "/v1/teacher/homework", headers: otherTeacherAuth,
    payload: { assignmentId, title: "Wrong class", content: "Cannot create",
      dueAt: "2099-12-31T12:00:00Z" }
  });
  assert.equal(unrelatedCreate.statusCode, 404);

  const secondClass = await app.inject({
    method: "POST", url: "/v1/admin/academics/classes", headers: admin,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "6B", name: "Grade 6 B" }
  });
  assert.equal(secondClass.statusCode, 201);
  const secondClassId = secondClass.json<{ class: { id: string } }>().class.id;
  const secondStudent = await app.inject({
    method: "POST", url: "/v1/admin/families/students", headers: admin,
    payload: { parentUserId: parent.user.id, studentCode: "LRN-002",
      fullName: "Other Class Child", academicYearId: yearId, classId: secondClassId }
  });
  assert.equal(secondStudent.statusCode, 201);
  const otherChildId = secondStudent.json<{ student: { id: string } }>().student.id;

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

  // Admin Learning Phase 5: schoolwide directory permits school admins only;
  // draft status is visible for management but no submissions are expected.
  const homeworkDirectory = "/v1/admin/learning/homework?academicYearId=" + yearId;
  const homeworkRoster = "/v1/admin/learning/homework/" + homeworkId + "/roster";
  const adminOtherSchool = { authorization: `Bearer ${await bootstrapAdmin(app,
    await provisionSchool(app, "LEARN-HW-PHASE5-OTHER"))}` };
  assert.equal((await app.inject({ method: "GET", url: homeworkDirectory })).statusCode, 401);
  for (const headers of [teacherAuth, studentAuth, parentAuth]) {
    assert.equal((await app.inject({ method: "GET", url: homeworkDirectory, headers })).statusCode, 403);
    assert.equal((await app.inject({ method: "GET", url: homeworkRoster, headers })).statusCode, 403);
  }
  assert.equal((await app.inject({ method: "GET", url: homeworkDirectory, headers: adminOtherSchool }))
    .json<{total:number}>().total, 0);
  assert.equal((await app.inject({ method: "GET", url: homeworkRoster, headers: adminOtherSchool })).statusCode, 404);
  const directoryDraft = await app.inject({ method: "GET", url: homeworkDirectory, headers: admin });
  assert.equal(directoryDraft.statusCode, 200, directoryDraft.body);
  const draftItems = directoryDraft.json<{rows:Array<{
    homework:{id:string;status:string}; expected:number; submitted:number; missing:number
  }> }>().rows;
  assert.equal(draftItems.length, 1);
  assert.equal(draftItems[0]?.homework.status, "DRAFT");
  assert.equal(draftItems[0]?.expected, 0);
  assert.equal(draftItems[0]?.submitted, 0);
  assert.equal(draftItems[0]?.missing, 0);
  const rosterDraft = await app.inject({ method: "GET", url: homeworkRoster, headers: admin });
  assert.equal(rosterDraft.statusCode, 200);
  assert.equal(rosterDraft.json<{total:number}>().total, 0);
  for (const suffix of ["&academicYearId=invalid", "&limit=51", "&offset=-1",
    "&attention=WRONG", "&classId=invalid"]) {
    const url = suffix.startsWith("&academicYearId")
      ? "/v1/admin/learning/homework?" + suffix.slice(1) : homeworkDirectory + suffix;
    assert.equal((await app.inject({ method: "GET", url, headers: admin })).statusCode, 400);
  }
  assert.equal((await app.inject({ method: "GET", url: homeworkRoster + "?limit=0",
    headers: admin })).statusCode, 400);

  // Test 14.4: only a draft can be edited. The stored content is the new draft.
  const editDraft = await app.inject({
    method: "PATCH", url: `/v1/teacher/homework/${homeworkId}`,
    headers: teacherAuth, payload: { content: "Revised questions for chapter 3." }
  });
  assert.equal(editDraft.statusCode, 200);
  assert.equal(editDraft.json<{ homework: { content: string } }>().homework.content,
    "Revised questions for chapter 3.");
  for (const payload of [{}, { dueAt: "2001-01-01T00:00:00Z" },
    { attachmentUrl: "javascript:alert(1)" }]) {
    const result = await app.inject({
      method: "PATCH", url: `/v1/teacher/homework/${homeworkId}`,
      headers: teacherAuth, payload
    });
    assert.equal(result.statusCode, 400, result.body);
  }
  const unauthorizedEdit = await app.inject({
    method: "PATCH", url: `/v1/teacher/homework/${homeworkId}`,
    headers: otherTeacherAuth, payload: { title: "Not my homework" }
  });
  assert.equal(unauthorizedEdit.statusCode, 404);


  // Real PDF bytes are validated and only available to authorized users.
  const pdf = Buffer.from("%PDF-1.7\\n1 0 obj\\n<<>>\\nendobj").toString("base64");
  const invalidMime = await app.inject({
    method:"POST",url:"/v1/learning/files",headers:teacherAuth,
    payload:{fileName:"bad.pdf",mimeType:"text/html",base64:pdf}
  });
  assert.equal(invalidMime.statusCode,400);
  const uploaded = await app.inject({
    method:"POST",url:"/v1/learning/files",headers:teacherAuth,
    payload:{fileName:"worksheet.pdf",mimeType:"application/pdf",base64:pdf}
  });
  assert.equal(uploaded.statusCode,201);
  const fileId=uploaded.json<{file:{id:string}}>().file.id;
  const forbiddenFileBeforePublish=await app.inject({
    method:"GET",url:`/v1/learning/files/${fileId}`,headers:studentAuth
  });
  assert.equal(forbiddenFileBeforePublish.statusCode,404);
  const attached=await app.inject({
    method:"PUT",url:`/v1/teacher/homework/${homeworkId}/file`,
    headers:teacherAuth,payload:{fileId}
  });
  assert.equal(attached.statusCode,200);

  // A scheduled date must be after now AND before the due date.
  const invalidScheduled = await app.inject({
    method:"PUT",url:`/v1/teacher/homework/${homeworkId}/schedule`,
    headers:teacherAuth,payload:{scheduledAt:"2000-01-01T00:00:00.000Z"}
  });
  assert.equal(invalidScheduled.statusCode,400);
  const scheduled=await app.inject({
    method:"PUT",url:`/v1/teacher/homework/${homeworkId}/schedule`,
    headers:teacherAuth,payload:{scheduledAt:"2098-12-31T09:00:00.000Z"}
  });
  assert.equal(scheduled.statusCode,200);
  const scheduleUnauthorized=await app.inject({
    method:"PUT",url:`/v1/teacher/homework/${homeworkId}/schedule`,
    headers:studentAuth,payload:{scheduledAt:null}
  });
  assert.equal(scheduleUnauthorized.statusCode,403);
  const assessment=await app.inject({
    method:"POST",url:"/v1/teacher/assessments",headers:teacherAuth,
    payload:{assignmentId,title:"Weekly quiz",category:"QUIZ",maxScore:20,assessedOn:"2026-10-13"}
  });
  assert.equal(assessment.statusCode,201);
  const assessmentId=assessment.json<{assessment:{id:string}}>().assessment.id;
  const assessmentSheet=await app.inject({method:"GET",url:`/v1/teacher/assessments/${assessmentId}`,headers:teacherAuth});
  assert.equal(assessmentSheet.statusCode,200);
  assert.equal(assessmentSheet.json<{students:unknown[]}>().students.length,1);
  const scoreSave=await app.inject({
    method:"POST",url:`/v1/teacher/assessments/${assessmentId}/scores`,headers:teacherAuth,
    payload:{entries:[{studentId,score:18}]}
  });
  assert.equal(scoreSave.statusCode,200);
  const scoreDenied=await app.inject({
    method:"POST",url:`/v1/teacher/assessments/${assessmentId}/scores`,headers:teacherAuth,
    payload:{entries:[{studentId,score:100}]}
  });
  assert.equal(scoreDenied.statusCode,400);
  const studentAssessmentDenied=await app.inject({
    method:"GET",url:`/v1/teacher/assessments/${assessmentId}`,headers:studentAuth
  });
  assert.equal(studentAssessmentDenied.statusCode,403);

  const parentDraft = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  assert.equal(parentDraft.statusCode, 200);
  assert.equal(parentDraft.json<{ homework: unknown[] }>().homework.length, 0);
  const otherChildDraft = await app.inject({ method: "GET",
    url: `/v1/parent/children/${otherChildId}/learning`, headers: parentAuth });
  assert.equal(otherChildDraft.statusCode, 200);
  assert.equal(otherChildDraft.json<{ homework: unknown[] }>().homework.length, 0);
  const unauthorizedPublish = await app.inject({ method: "POST",
    url: `/v1/teacher/homework/${homeworkId}/publish`, headers: otherTeacherAuth });
  assert.equal(unauthorizedPublish.statusCode, 404);

  const studentDraft = await app.inject({ method: "GET", url: "/v1/student/home", headers: studentAuth });
  assert.equal(studentDraft.statusCode, 200);
  assert.equal(studentDraft.json<{ homework: unknown[] }>().homework.length, 0);

  const published = await app.inject({
    method: "POST",
    url: `/v1/teacher/homework/${homeworkId}/publish`,
    headers: teacherAuth
  });
  assert.equal(published.statusCode, 200);
  const repeatPublish = await app.inject({ method: "POST",
    url: `/v1/teacher/homework/${homeworkId}/publish`, headers: teacherAuth });
  assert.equal(repeatPublish.statusCode, 409);
  const editPublished = await app.inject({ method: "PATCH",
    url: `/v1/teacher/homework/${homeworkId}`, headers: teacherAuth,
    payload: { title: "Unsafe edit" } });
  assert.equal(editPublished.statusCode, 409);
  const publishedFileEdit = await app.inject({ method: "PUT",
    url: `/v1/teacher/homework/${homeworkId}/file`, headers: teacherAuth,
    payload: { fileId: null } });
  assert.equal(publishedFileEdit.statusCode, 409);

  const publishedHomeworkDirectory = await app.inject({
    method: "GET", url: homeworkDirectory + "&status=PUBLISHED", headers: admin
  });
  assert.equal(publishedHomeworkDirectory.statusCode, 200, publishedHomeworkDirectory.body);
  const publishedItem = publishedHomeworkDirectory.json<{total:number; rows:Array<{
    homework:{id:string}; expected:number; submitted:number; missing:number; teacherName:string
  }> }>();
  assert.equal(publishedItem.total, 1);
  assert.equal(publishedItem.rows[0]?.homework.id, homeworkId);
  assert.equal(publishedItem.rows[0]?.expected, 1);
  assert.equal(publishedItem.rows[0]?.submitted, 0);
  assert.equal(publishedItem.rows[0]?.missing, 1);
  assert.equal(publishedItem.rows[0]?.teacherName, "Homework Teacher");
  const missingOnly = await app.inject({ method: "GET", url: homeworkDirectory +
    "&attention=MISSING&classId=" + classId + "&subjectId=" + subjectId,
    headers: admin });
  assert.equal(missingOnly.statusCode, 200);
  assert.equal(missingOnly.json<{total:number}>().total, 1);
  const beforeSubmissionRoster = await app.inject({ method: "GET",
    url: homeworkRoster + "?filter=MISSING", headers: admin });
  assert.equal(beforeSubmissionRoster.statusCode, 200);
  assert.equal(beforeSubmissionRoster.json<{total:number}>().total, 1);

  const parentPublished = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  assert.equal(parentPublished.json<{ homework: Array<{ homework: { title: string } }> }>().homework[0]?.homework.title, "Read chapter 3");

  const studentPublished = await app.inject({ method: "GET", url: "/v1/student/home", headers: studentAuth });
  assert.equal(studentPublished.json<{ homework: Array<{ homework: { title: string } }> }>().homework[0]?.homework.title, "Read chapter 3");
  assert.equal(studentPublished.json<{ homework: Array<{ homework: { content: string } }> }>()
    .homework[0]?.homework.content, "Revised questions for chapter 3.");
  const otherChildPublished = await app.inject({ method: "GET",
    url: `/v1/parent/children/${otherChildId}/learning`, headers: parentAuth });
  assert.equal(otherChildPublished.statusCode, 200);
  assert.equal(otherChildPublished.json<{ homework: unknown[] }>().homework.length, 0);

  // Publication fan-out: precisely one alert per authorized recipient.
  for (const headers of [parentAuth, studentAuth]) {
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications", headers });
    assert.equal(inbox.statusCode, 200);
    assert.equal(inbox.json<{ notifications: Array<{ type: string; metadata: { homeworkId: string } }> }>()
      .notifications.filter(x => x.type === "HOMEWORK_PUBLISHED" && x.metadata.homeworkId === homeworkId).length, 1);
  }
  // Published-homework notification acknowledgement persists on the server.
  const parentInboxBeforeRead = await app.inject({ method: "GET",
    url: "/v1/notifications", headers: parentAuth });
  const parentNotificationId = parentInboxBeforeRead.json<{
    notifications: Array<{ id: string; type: string }>
  }>().notifications.find(x => x.type === "HOMEWORK_PUBLISHED")?.id;
  assert.ok(parentNotificationId);
  const parentAcknowledgement = await app.inject({ method: "POST",
    url: `/v1/notifications/${parentNotificationId}/read`, headers: parentAuth });
  assert.equal(parentAcknowledgement.statusCode, 200);
  assert.ok(parentAcknowledgement.json<{ notification: { readAt: string } }>().notification.readAt);
  const otherTeacherInbox = await app.inject({ method: "GET",
    url: "/v1/notifications", headers: otherTeacherAuth });
  assert.equal(otherTeacherInbox.statusCode, 200);
  assert.equal(otherTeacherInbox.json<{ notifications: Array<{ type: string }> }>()
    .notifications.filter(x => x.type === "HOMEWORK_PUBLISHED").length, 0);


  const visibleFile = await app.inject({method:"GET",url:`/v1/learning/files/${fileId}`,headers:studentAuth});
  assert.equal(visibleFile.statusCode,200);
  assert.equal(visibleFile.json<{file:{base64:string}}>().file.base64,pdf);
  const parentFile=await app.inject({method:"GET",url:`/v1/learning/files/${fileId}`,headers:parentAuth});
  assert.equal(parentFile.statusCode,200);
  assert.equal(parentFile.json<{file:{fileName:string}}>().file.fileName,"worksheet.pdf");
  const adminFile=await app.inject({method:"GET",url:`/v1/learning/files/${fileId}`,headers:admin});
  assert.equal(adminFile.statusCode,404);
  const submission = await app.inject({
    method:"POST",url:`/v1/student/homework/${homeworkId}/submission`,
    headers:studentAuth,payload:{answer:"My chapter answers."}
  });
  assert.equal(submission.statusCode,200);
  const submissionId=submission.json<{submission:{id:string}}>().submission.id;
  const pendingHomeworkDirectory = await app.inject({
    method: "GET", url: homeworkDirectory + "&attention=AWAITING_REVIEW",
    headers: admin
  });
  assert.equal(pendingHomeworkDirectory.statusCode, 200);
  assert.equal(pendingHomeworkDirectory.json<{total:number;rows:Array<{awaitingReview:number;submitted:number}>}>()
    .rows[0]?.awaitingReview, 1);
  const studentSubmittedPage = await app.inject({ method: "GET",
    url: homeworkRoster + "?filter=SUBMITTED&limit=1&offset=0", headers: admin });
  assert.equal(studentSubmittedPage.statusCode, 200);
  assert.equal(studentSubmittedPage.json<{total:number}>().total, 1);
  assert.equal(studentSubmittedPage.json<{students:Array<{
    submission:{status:string}|null
  }>} >().students[0]?.submission?.status, "SUBMITTED");
  assert.equal((await app.inject({ method:"GET",url:homeworkDirectory+
    "&attention=MISSING",headers:admin })).json<{total:number}>().total,0);

  const duplicate=await app.inject({
    method:"POST",url:`/v1/student/homework/${homeworkId}/submission`,
    headers:studentAuth,payload:{answer:"Duplicate"}
  });
  assert.equal(duplicate.statusCode,409);
  const submittedView=await app.inject({
    method:"GET",url:`/v1/teacher/homework/${homeworkId}/submissions`,headers:teacherAuth
  });
  assert.equal(submittedView.statusCode,200);
  assert.equal(submittedView.json<{submissions:unknown[]}>().submissions.length,1);
  const review=await app.inject({
    method:"POST",url:`/v1/teacher/homework/${homeworkId}/submissions/${submissionId}/review`,
    headers:teacherAuth,payload:{status:"REVISION_REQUESTED",feedback:"Add page numbers."}
  });
  assert.equal(review.statusCode,200);
  const revisionsDirectory = await app.inject({ method: "GET",
    url: homeworkDirectory + "&attention=REVISION_REQUESTED", headers: admin });
  assert.equal(revisionsDirectory.statusCode, 200);
  assert.equal(revisionsDirectory.json<{total:number}>().total, 1);
  const revisionsRoster = await app.inject({ method: "GET",
    url: homeworkRoster + "?filter=REVISION_REQUESTED", headers: admin });
  assert.equal(revisionsRoster.statusCode, 200);
  assert.equal(revisionsRoster.json<{total:number}>().total, 1);

  const revised=await app.inject({
    method:"POST",url:`/v1/student/homework/${homeworkId}/submission`,
    headers:studentAuth,payload:{answer:"Updated answers with pages."}
  });
  assert.equal(revised.statusCode,200);
  const reviewComplete=await app.inject({
    method:"POST",url:`/v1/teacher/homework/${homeworkId}/submissions/${submissionId}/review`,
    headers:teacherAuth,payload:{status:"REVIEWED",feedback:"Good work."}
  });
  assert.equal(reviewComplete.statusCode,200);
  const reviewedDirectory = await app.inject({ method: "GET",
    url: homeworkDirectory + "&search=chapter%203&limit=1&offset=0", headers: admin });
  assert.equal(reviewedDirectory.statusCode, 200);
  const reviewedItem = reviewedDirectory.json<{rows:Array<{
    expected:number;submitted:number;reviewed:number;awaitingReview:number;
  }> }>().rows[0];
  assert.equal(reviewedItem?.expected, 1);
  assert.equal(reviewedItem?.submitted, 1);
  assert.equal(reviewedItem?.reviewed, 1);
  assert.equal(reviewedItem?.awaitingReview, 0);
  assert.equal((await app.inject({ method:"GET",url:homeworkDirectory+
    "&attention=AWAITING_REVIEW",headers:admin })).json<{total:number}>().total,0);
  const reviewedRoster = await app.inject({method:"GET",
    url:homeworkRoster+"?filter=REVIEWED",headers:admin});
  assert.equal(reviewedRoster.statusCode,200);
  assert.equal(reviewedRoster.json<{students:Array<{
    submission:{status:string;feedback:string}|null
  }>} >().students[0]?.submission?.feedback,"Good work.");
  assert.equal((await app.inject({method:"GET",url:homeworkRoster+
    "?filter=MISSING",headers:admin})).json<{total:number}>().total,0);

  const ownSubmission=await app.inject({
    method:"GET",url:"/v1/student/homework/submissions",headers:studentAuth
  });
  assert.equal(ownSubmission.statusCode,200);
  assert.equal(ownSubmission.json<{submissions:Array<{submission:{feedback:string}}>}>().submissions[0]?.submission.feedback,"Good work.");

  // Durable scheduling: claim once, even if the scheduler checks repeatedly.
  const future = await app.inject({
    method:"POST",url:"/v1/teacher/homework",headers:teacherAuth,
    payload:{assignmentId,title:"Scheduled chapter",content:"Read before exam",
      dueAt:"2099-12-30T12:00:00Z"}
  });
  assert.equal(future.statusCode,201);
  const futureId=future.json<{homework:{id:string}}>().homework.id;
  const setFuture=await app.inject({
    method:"PUT",url:`/v1/teacher/homework/${futureId}/schedule`,
    headers:teacherAuth,payload:{scheduledAt:"2098-12-29T12:00:00.000Z"}
  });
  assert.equal(setFuture.statusCode,200);
  await client.query(`UPDATE homeworks SET scheduled_at = now() - interval '1 second'
    WHERE id = '${futureId}'`);
  assert.equal(await learningExtensionsStore.publishDueHomeworks(),1);
  assert.equal(await learningExtensionsStore.publishDueHomeworks(),0);
  const scheduledStudent=await app.inject({method:"GET",url:"/v1/student/home",headers:studentAuth});
  assert.equal(scheduledStudent.statusCode,200);
  assert.ok(scheduledStudent.json<{homework:Array<{homework:{id:string}}>}>().homework
    .some(item=>item.homework.id===futureId));

  // 14.8: Close blocks new submissions/edits, preserves learner history.
  const closed = await app.inject({ method: "POST",
    url: `/v1/teacher/homework/${homeworkId}/close`, headers: teacherAuth });
  assert.equal(closed.statusCode, 200);
  assert.equal(closed.json<{ homework: { status: string } }>().homework.status, "CLOSED");
  const repeatClose = await app.inject({ method: "POST",
    url: `/v1/teacher/homework/${homeworkId}/close`, headers: teacherAuth });
  assert.equal(repeatClose.statusCode, 409);
  const editClosed = await app.inject({ method: "PATCH",
    url: `/v1/teacher/homework/${homeworkId}`, headers: teacherAuth,
    payload: { content: "Cannot revise closed homework" } });
  assert.equal(editClosed.statusCode, 409);
  const lateSubmission = await app.inject({ method: "POST",
    url: `/v1/student/homework/${homeworkId}/submission`,
    headers: studentAuth, payload: { answer: "Too late" } });
  assert.equal(lateSubmission.statusCode, 404);
  for (const [headers, url] of [
    [parentAuth, `/v1/parent/children/${studentId}/learning`],
    [studentAuth, "/v1/student/home"]
  ] as const) {
    const response = await app.inject({ method: "GET", url, headers });
    assert.equal(response.statusCode, 200);
    assert.ok(response.json<{ homework: Array<{ homework: { id: string; status: string } }> }>()
      .homework.some(x => x.homework.id === homeworkId && x.homework.status === "CLOSED"));
  }

  // 14.9–14.12: Archived homework is retained for teacher historical review
  // but hidden from learner feeds under the Phase 6 visibility contract.
  const archived = await app.inject({ method: "POST",
    url: `/v1/teacher/homework/${homeworkId}/archive`, headers: teacherAuth });
  assert.equal(archived.statusCode, 200);
  assert.equal(archived.json<{ homework: { status: string } }>().homework.status, "ARCHIVED");
  const archivedDirectory = await app.inject({ method: "GET",
    url: homeworkDirectory + "&status=ARCHIVED", headers: admin });
  assert.equal(archivedDirectory.statusCode, 200);
  assert.equal(archivedDirectory.json<{total:number}>().total, 1);
  const archivedRoster = await app.inject({ method: "GET",
    url: homeworkRoster + "?filter=REVIEWED", headers: admin });
  assert.equal(archivedRoster.statusCode, 200);
  assert.equal(archivedRoster.json<{total:number}>().total, 1);

  const repeatArchive = await app.inject({ method: "POST",
    url: `/v1/teacher/homework/${homeworkId}/archive`, headers: teacherAuth });
  assert.equal(repeatArchive.statusCode, 409);
  const editArchived = await app.inject({ method: "PATCH",
    url: `/v1/teacher/homework/${homeworkId}`, headers: teacherAuth,
    payload: { title: "Cannot rewrite an archive" } });
  assert.equal(editArchived.statusCode, 409);
  const teacherHistory = await app.inject({ method: "GET",
    url: "/v1/teacher/learning", headers: teacherAuth });
  assert.equal(teacherHistory.statusCode, 200);
  assert.ok(teacherHistory.json<{ homeworks: Array<{ id: string; status: string }> }>()
    .homeworks.some(h => h.id === homeworkId && h.status === "ARCHIVED"));
  const historicalSubmissions = await app.inject({ method: "GET",
    url: `/v1/teacher/homework/${homeworkId}/submissions`, headers: teacherAuth });
  assert.equal(historicalSubmissions.statusCode, 200);
  assert.equal(historicalSubmissions.json<{ submissions: unknown[] }>().submissions.length, 1);
  const archivedReviewDenied = await app.inject({ method: "POST",
    url: `/v1/teacher/homework/${homeworkId}/submissions/${submissionId}/review`,
    headers: teacherAuth, payload: { status: "REVIEWED", feedback: "No edits to archives" }
  });
  assert.equal(archivedReviewDenied.statusCode, 409);
  // Closing the academic year must not erase the teacher's historical
  // archived submissions or make historical files disappear.
  await client.query("UPDATE academic_years SET status = 'CLOSED' WHERE id = $1", [yearId]);
  const archivedYearHistory = await app.inject({ method: "GET",
    url: `/v1/teacher/homework/${homeworkId}/submissions`, headers: teacherAuth });
  assert.equal(archivedYearHistory.statusCode, 200);
  assert.equal(archivedYearHistory.json<{ submissions: unknown[] }>().submissions.length, 1);

  for (const [headers, url] of [
    [parentAuth, `/v1/parent/children/${studentId}/learning`],
    [studentAuth, "/v1/student/home"]
  ] as const) {
    const result = await app.inject({ method: "GET", url, headers });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json<{ homework: Array<{ homework: { id: string } }> }>()
      .homework.some(x => x.homework.id === homeworkId), false);
  }
  const archiveFile = await app.inject({ method: "GET",
    url: `/v1/learning/files/${fileId}`, headers: parentAuth });
  assert.equal(archiveFile.statusCode, 404);
  const lifecycleAudit = await client.query<{ action: string }>(
    "SELECT action FROM audit_logs WHERE school_id = $1 AND entity_id = $2",
    [schoolId, homeworkId]
  );
  for (const action of ["homework.published", "homework.closed", "homework.archived"]) {
    assert.equal(lifecycleAudit.rows.filter(x => x.action === action).length, 1);
  }

});

test("Admin Learning Phase 1 dashboard is year-scoped, role-protected and has empty metrics", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });

  const schoolA = await provisionSchool(app, "LEARN-P1-A");
  const schoolB = await provisionSchool(app, "LEARN-P1-B");
  const adminA = { authorization: `Bearer ${await bootstrapAdmin(app, schoolA)}` };
  const adminB = { authorization: `Bearer ${await bootstrapAdmin(app, schoolB)}` };

  const year = await app.inject({ method: "POST", url: "/v1/admin/academics/years",
    headers: adminA,
    payload: { name: "1408", startDate: "2029-03-21", endDate: "2030-03-20" } });
  assert.equal(year.statusCode, 201, year.body);
  const yearId = year.json<{ academicYear: { id: string } }>().academicYear.id;
  const url = `/v1/admin/learning/dashboard?academicYearId=${yearId}`;

  assert.equal((await app.inject({ method: "GET", url })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url, headers: adminB })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET",
    url: "/v1/admin/learning/dashboard?academicYearId=bad", headers: adminA })).statusCode, 400);
  assert.equal((await app.inject({ method: "GET",
    url: "/v1/admin/learning/dashboard", headers: adminA })).statusCode, 400);

  const empty = await app.inject({ method: "GET", url, headers: adminA });
  assert.equal(empty.statusCode, 200, empty.body);
  const dashboard = empty.json<{ academicYearId: string; metrics: {
    activeExams: number; examsAwaitingPublication: number;
    publishedHomework: number; submissionsAwaitingReview: number;
    classesWithMissingMarks: number; curriculumAssignedUnits: number;
  }; attention: unknown[] }>();
  assert.equal(dashboard.academicYearId, yearId);
  assert.deepEqual(dashboard.attention, []);
  assert.equal(dashboard.metrics.activeExams, 0);
  assert.equal(dashboard.metrics.publishedHomework, 0);
  assert.equal(dashboard.metrics.submissionsAwaitingReview, 0);
  assert.equal(dashboard.metrics.classesWithMissingMarks, 0);
  assert.equal(dashboard.metrics.curriculumAssignedUnits, 0);
  const draft = await app.inject({ method: "POST", url: "/v1/admin/exams",
    headers: adminA, payload: { academicYearId: yearId, name: "Year end", type: "FINAL" } });
  assert.equal(draft.statusCode, 409, "Year must be active before creating exam.");
  await app.inject({ method: "POST",
    url: `/v1/admin/academics/years/${yearId}/activate`, headers: adminA });
  const created = await app.inject({ method: "POST", url: "/v1/admin/exams",
    headers: adminA, payload: { academicYearId: yearId, name: "Year end", type: "FINAL" } });
  assert.equal(created.statusCode, 201, created.body);
  const after = await app.inject({ method: "GET", url, headers: adminA });
  assert.equal(after.statusCode, 200, after.body);
  assert.equal(after.json<{metrics:{activeExams:number}}>().metrics.activeExams, 0,
    "Draft exam is not yet active.");
  assert.equal((await app.inject({ method: "GET", url, headers: adminB })).statusCode, 404);
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

  // Step 15: an exam cycle can contain multiple independently dated subjects.
  const secondSubject = await app.inject({
    method: "POST", url: "/v1/admin/academics/subjects", headers: admin,
    payload: { code: "ZOO5", name: "Zoology 5" }
  });
  assert.equal(secondSubject.statusCode, 201, secondSubject.body);
  const secondSubjectId = secondSubject.json<{ subject: { id: string } }>().subject.id;
  const secondAssignment = await app.inject({
    method: "POST", url: "/v1/admin/academics/assignments", headers: admin,
    payload: { academicYearId: yearId, classId, subjectId: secondSubjectId,
      teacherUserId: assignedTeacher.userId }
  });
  assert.equal(secondAssignment.statusCode, 201, secondAssignment.body);
  const outsideClass = await app.inject({
    method: "POST", url: "/v1/admin/academics/classes", headers: admin,
    payload: { academicYearId: yearId, gradeLevelId: gradeId, code: "5B", name: "Grade 5 B" }
  });
  assert.equal(outsideClass.statusCode, 201, outsideClass.body);
  const outsideClassId = outsideClass.json<{ class: { id: string } }>().class.id;

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
  const outsideStudent = await app.inject({
    method: "POST", url: "/v1/admin/families/students", headers: admin,
    payload: { parentUserId: parent.user.id, studentCode: "MRK-002",
      fullName: "Other Class Marks Student", academicYearId: yearId, classId: outsideClassId }
  });
  assert.equal(outsideStudent.statusCode, 201, outsideStudent.body);
  const outsideStudentId = outsideStudent.json<{ student: { id: string } }>().student.id;

  const studentAccount = await app.inject({
    method: "POST",
    url: `/v1/admin/families/students/${studentId}/account`,
    headers: admin,
    payload: { username: "marksstudent" }
  });
  assert.equal(studentAccount.statusCode, 201, studentAccount.body);
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

  // 15.1–15.3: creation is admin-only, scoped to active academic year,
  // with required names/type and no duplicate exam cycles.
  const teacherExamDenied = await app.inject({
    method: "POST", url: "/v1/admin/exams", headers: assignedTeacher.auth,
    payload: { academicYearId: yearId, name: "Unauthorized", type: "FINAL" }
  });
  assert.equal(teacherExamDenied.statusCode, 403);
  const invalidExamName = await app.inject({
    method: "POST", url: "/v1/admin/exams", headers: admin,
    payload: { academicYearId: yearId, name: " ", type: "FINAL" }
  });
  assert.equal(invalidExamName.statusCode, 400);
  const inactiveExamYear = await app.inject({
    method: "POST", url: "/v1/admin/academics/years", headers: admin,
    payload: { name: "1408", startDate: "2029-03-21", endDate: "2030-03-20" }
  });
  assert.equal(inactiveExamYear.statusCode, 201, inactiveExamYear.body);
  const draftYearId = inactiveExamYear.json<{ academicYear: { id: string } }>().academicYear.id;
  const invalidYearExam = await app.inject({
    method: "POST", url: "/v1/admin/exams", headers: admin,
    payload: { academicYearId: draftYearId, name: "Inactive Year", type: "FINAL" }
  });
  assert.equal(invalidYearExam.statusCode, 409, invalidYearExam.body);

  const exam = await app.inject({
    method: "POST",
    url: "/v1/admin/exams",
    headers: admin,
    payload: { academicYearId: yearId, name: "Midyear", type: "MIDYEAR" }
  });
  assert.equal(exam.statusCode, 201, exam.body);
  const duplicateExam = await app.inject({
    method: "POST", url: "/v1/admin/exams", headers: admin,
    payload: { academicYearId: yearId, name: "Midyear", type: "MIDYEAR" }
  });
  assert.equal(duplicateExam.statusCode, 409, duplicateExam.body);
  const examId = exam.json<{ exam: { id: string } }>().exam.id;
  const otherSchoolId = await provisionSchool(app, "LEARN-EXAM-OTHER");
  const otherSchoolAdminToken = await bootstrapAdmin(app, otherSchoolId);
  const otherAdmin = { authorization: `Bearer ${otherSchoolAdminToken}` };
  const wrongSchoolStatus = await app.inject({ method: "POST",
    url: `/v1/admin/exams/${examId}/status`, headers: otherAdmin,
    payload: { status: "SCHEDULED" } });
  assert.equal(wrongSchoolStatus.statusCode, 404);
  const wrongSchoolSubject = await app.inject({ method: "POST",
    url: "/v1/admin/exam-subjects", headers: otherAdmin,
    payload: { examId, subjectId, classId, maxScore: 100, examDate: "2028-09-15" } });
  assert.equal(wrongSchoolSubject.statusCode, 404);

  // Exam needs at least one subject before moving DRAFT → SCHEDULED.
  const withoutSubjects = await app.inject({
    method: "POST", url: `/v1/admin/exams/${examId}/status`, headers: admin,
    payload: { status: "SCHEDULED" }
  });
  assert.equal(withoutSubjects.statusCode, 409, withoutSubjects.body);
  const subjectPayload = { examId, subjectId, classId, maxScore: 100,
    examDate: "2028-09-15" };
  for (const override of [
    { examDate: "2028-02-30" }, { examDate: "2029-03-21" },
    { examDate: "2028-03-20" }, { maxScore: 0 }, { maxScore: 1.5 },
    { examDate: undefined }
  ]) {
    const response = await app.inject({ method: "POST", url: "/v1/admin/exam-subjects",
      headers: admin, payload: { ...subjectPayload, ...override } });
    assert.equal(response.statusCode, 400, response.body);
  }
  const teacherSubjectDenied = await app.inject({
    method: "POST", url: "/v1/admin/exam-subjects", headers: assignedTeacher.auth,
    payload: subjectPayload
  });
  assert.equal(teacherSubjectDenied.statusCode, 403);
  const unassignedClassSubject = await app.inject({
    method: "POST", url: "/v1/admin/exam-subjects", headers: admin,
    payload: { ...subjectPayload, classId: outsideClassId }
  });
  assert.equal(unassignedClassSubject.statusCode, 400);

  const examSubject = await app.inject({
    method: "POST",
    url: "/v1/admin/exam-subjects",
    headers: admin,
    payload: { examId, subjectId, classId, maxScore: 100, examDate: "2028-09-15" }
  });
  assert.equal(examSubject.statusCode, 201, examSubject.body);
  const duplicateExamSubject = await app.inject({
    method: "POST", url: "/v1/admin/exam-subjects", headers: admin,
    payload: subjectPayload
  });
  assert.equal(duplicateExamSubject.statusCode, 409, duplicateExamSubject.body);
  const zoologyExamSubject = await app.inject({
    method: "POST", url: "/v1/admin/exam-subjects", headers: admin,
    payload: { examId, subjectId: secondSubjectId, classId, maxScore: 50,
      examDate: "2028-09-17" }
  });
  assert.equal(zoologyExamSubject.statusCode, 201, zoologyExamSubject.body);
  const secondExamSubjectId = zoologyExamSubject.json<{ examSubject: { id: string } }>().examSubject.id;

  // Admin Learning Phase 2: year-scoped direct detail, role/tenant denial,
  // and same-class same-calendar-day warnings (not alleged time collisions).
  const detailUrl = `/v1/admin/exams/${examId}/detail`;
  assert.equal((await app.inject({ method: "GET", url: detailUrl })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: detailUrl,
    headers: assignedTeacher.auth })).statusCode, 403);
  assert.equal((await app.inject({ method: "GET", url: detailUrl,
    headers: otherAdmin })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET",
    url: "/v1/admin/exams/not-a-uuid/detail", headers: admin })).statusCode, 400);
  const detailBefore = await app.inject({ method: "GET", url: detailUrl, headers: admin });
  assert.equal(detailBefore.statusCode, 200, detailBefore.body);
  const detailPayload = detailBefore.json<{
    exam: { id: string; academicYearId: string };
    subjects: Array<{ examSubject: { id: string; examDate: string } }>;
    sameDayWarnings: unknown[];
  }>();
  assert.equal(detailPayload.exam.id, examId);
  assert.equal(detailPayload.exam.academicYearId, yearId);
  assert.equal(detailPayload.subjects.length, 2);
  assert.deepEqual(detailPayload.sameDayWarnings, []);

  // Admin Learning Phase 3: marks-readiness preview is school/role isolated.
  const readinessUrl = `/v1/admin/exams/${examId}/readiness`;
  assert.equal((await app.inject({ method: "GET", url: readinessUrl })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: readinessUrl,
    headers: assignedTeacher.auth })).statusCode, 403);
  assert.equal((await app.inject({ method: "GET", url: readinessUrl,
    headers: otherAdmin })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET",
    url: "/v1/admin/exams/not-a-uuid/readiness", headers: admin })).statusCode, 400);
  const earlyReadiness = await app.inject({ method: "GET", url: readinessUrl, headers: admin });
  assert.equal(earlyReadiness.statusCode, 200, earlyReadiness.body);
  const earlyData = earlyReadiness.json<{
    totals: { configuredSubjects: number; scheduledSubjects: number;
      expectedMarks: number; missingMarks: number; validMarks: number; recipients: number };
    canSchedule: boolean; canPublish: boolean;
    checks: Array<{ code: string; passed: boolean }>
  }>();
  assert.equal(earlyData.totals.configuredSubjects, 2);
  assert.equal(earlyData.totals.scheduledSubjects, 2);
  assert.equal(earlyData.totals.expectedMarks, 2);
  assert.equal(earlyData.totals.missingMarks, 2);
  assert.equal(earlyData.totals.recipients, 2);
  assert.equal(earlyData.canSchedule, true);
  assert.equal(earlyData.canPublish, false);
  assert.equal(earlyData.checks.find(row => row.code === "ALL_DRAFT_MARKS")?.passed, false);
  const collision = await app.inject({ method: "PATCH",
    url: `/v1/admin/exam-subjects/${secondExamSubjectId}/date`, headers: admin,
    payload: { examDate: "2028-09-15" } });
  assert.equal(collision.statusCode, 200, collision.body);
  const advisory = await app.inject({ method: "GET", url: detailUrl, headers: admin });
  assert.equal(advisory.statusCode, 200, advisory.body);
  const advisories = advisory.json<{
    sameDayWarnings: Array<{ classId: string; examDate: string; subjectNames: string[] }>
  }>().sameDayWarnings;
  assert.equal(advisories.length, 1);
  assert.equal(advisories[0]?.classId, classId);
  assert.equal(advisories[0]?.examDate, "2028-09-15");
  assert.equal(advisories[0]?.subjectNames.length, 2);
  const restoreDate = await app.inject({ method: "PATCH",
    url: `/v1/admin/exam-subjects/${secondExamSubjectId}/date`, headers: admin,
    payload: { examDate: "2028-09-17" } });
  assert.equal(restoreDate.statusCode, 200, restoreDate.body);

  // Legacy rows have a nullable date after migration. School Admin can date
  // them before IN_PROGRESS; the change and old date are audited.
  await client.query("UPDATE exam_subjects SET exam_date = NULL WHERE id = $1",
    [secondExamSubjectId]);
  const badDateUpdate = await app.inject({ method: "PATCH",
    url: `/v1/admin/exam-subjects/${secondExamSubjectId}/date`,
    headers: admin, payload: { examDate: "2028-02-30" } });
  assert.equal(badDateUpdate.statusCode, 400);
  const unrelatedDateEdit = await app.inject({ method: "PATCH",
    url: `/v1/admin/exam-subjects/${secondExamSubjectId}/date`,
    headers: assignedTeacher.auth, payload: { examDate: "2028-09-18" } });
  assert.equal(unrelatedDateEdit.statusCode, 403);
  const repairedSubjectDate = await app.inject({ method: "PATCH",
    url: `/v1/admin/exam-subjects/${secondExamSubjectId}/date`,
    headers: admin, payload: { examDate: "2028-09-18" } });
  assert.equal(repairedSubjectDate.statusCode, 200);
  assert.equal(repairedSubjectDate.json<{ examSubject: { examDate: string } }>()
    .examSubject.examDate, "2028-09-18");

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

  const frozenDate = await app.inject({ method: "PATCH",
    url: `/v1/admin/exam-subjects/${secondExamSubjectId}/date`,
    headers: admin, payload: { examDate: "2028-09-19" } });
  assert.equal(frozenDate.statusCode, 409, frozenDate.body);

  const unrelated = await app.inject({
    method: "GET",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: unrelatedTeacher.auth
  });
  assert.equal(unrelated.statusCode, 400);
  assert.equal(unrelated.json<{ error: string }>().error, "learning_validation");

  // 15.2, 15.4: grade-sheet roster includes only ACTIVE students in the
  // configured class and cannot be read by a second teacher or Parent.
  const roster = await app.inject({ method: "GET",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: assignedTeacher.auth });
  assert.equal(roster.statusCode, 200);
  assert.equal(roster.json<{ students: Array<{ student: { id: string } }> }>().students.length, 1);
  assert.equal(roster.json<{ students: Array<{ student: { id: string } }> }>().students[0]?.student.id, studentId);
  assert.equal(roster.json<{ canEdit: boolean }>().canEdit, true);
  const parentCannotReadRoster = await app.inject({ method: "GET",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`, headers: parentAuth });
  assert.equal(parentCannotReadRoster.statusCode, 403);

  // 15.5: nonnumeric, fractional, out-of-range, missing, duplicate and
  // wrong-class marks all fail without mutating stored grades.
  for (const entries of [
    [{ studentId, score: -1 }], [{ studentId, score: 1.5 }],
    [{ studentId, score: "ten" }], [{ studentId }],
    [{ studentId, score: 50 }, { studentId, score: 60 }],
    [{ studentId: outsideStudentId, score: 10 }]
  ]) {
    const rejected = await app.inject({ method: "POST",
      url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
      headers: assignedTeacher.auth, payload: { entries } });
    assert.equal(rejected.statusCode, 400, rejected.body);
  }
  const unrelatedMarkWrite = await app.inject({ method: "POST",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: unrelatedTeacher.auth, payload: { entries: [{ studentId, score: 5 }] } });
  assert.equal(unrelatedMarkWrite.statusCode, 400);

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
  const firstReadyDenied = await app.inject({ method: "POST",
    url: `/v1/admin/exams/${examId}/status`, headers: admin,
    payload: { status: "RESULTS_READY" } });
  assert.equal(firstReadyDenied.statusCode, 409, firstReadyDenied.body);
  const partiallyGraded = await app.inject({ method: "GET", url: readinessUrl, headers: admin });
  assert.equal(partiallyGraded.statusCode, 200, partiallyGraded.body);
  const partialMarks = partiallyGraded.json<{
    totals: { validMarks: number; missingMarks: number };
    canMarkResultsReady: boolean
  }>();
  assert.equal(partialMarks.totals.validMarks, 1);
  assert.equal(partialMarks.totals.missingMarks, 1);
  assert.equal(partialMarks.canMarkResultsReady, false);
  const saveZoology = await app.inject({ method: "POST",
    url: `/v1/teacher/exam-subjects/${secondExamSubjectId}/grades`,
    headers: assignedTeacher.auth,
    payload: { entries: [{ studentId, score: 40, remark: "Well done" }] } });
  assert.equal(saveZoology.statusCode, 200);
  const repeatedGrade = await app.inject({ method: "POST",
    url: `/v1/teacher/exam-subjects/${secondExamSubjectId}/grades`,
    headers: assignedTeacher.auth, payload: { entries: [{ studentId, score: 40, remark: "Well done" }] } });
  assert.equal(repeatedGrade.statusCode, 200);

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
  const readyPreview = await app.inject({ method: "GET", url: readinessUrl, headers: admin });
  assert.equal(readyPreview.statusCode, 200, readyPreview.body);
  const readyData = readyPreview.json<{
    totals: { missingMarks: number; invalidMarks: number; validMarks: number;
      expectedMarks: number; recipients: number };
    canPublish: boolean
  }>();
  assert.equal(readyData.canPublish, true);
  assert.equal(readyData.totals.validMarks, 2);
  assert.equal(readyData.totals.expectedMarks, 2);
  assert.equal(readyData.totals.missingMarks, 0);
  assert.equal(readyData.totals.invalidMarks, 0);
  assert.equal(readyData.totals.recipients, 2);

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

  // Once Results Ready is reached, teacher grade writes and duplicate
  // lifecycle transitions are denied even when another session retries.
  const gradeLocked = await app.inject({ method: "GET",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: assignedTeacher.auth });
  assert.equal(gradeLocked.statusCode, 200);
  assert.equal(gradeLocked.json<{ canEdit: boolean }>().canEdit, false);
  const gradesAfterReadyDenied = await app.inject({ method: "POST",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: assignedTeacher.auth, payload: { entries: [{ studentId, score: 95 }] } });
  assert.equal(gradesAfterReadyDenied.statusCode, 409, gradesAfterReadyDenied.body);
  const repeatedReadyDenied = await app.inject({ method: "POST",
    url: `/v1/admin/exams/${examId}/status`, headers: admin,
    payload: { status: "RESULTS_READY" } });
  assert.equal(repeatedReadyDenied.statusCode, 409, repeatedReadyDenied.body);
  const unauthorizedPublish = await app.inject({ method: "POST",
    url: `/v1/admin/exams/${examId}/publish`, headers: assignedTeacher.auth });
  assert.equal(unauthorizedPublish.statusCode, 403);

  // Admin Learning Phase 4: draft grades never enter the published directory.
  const directoryPath = "/v1/admin/learning/published-results?academicYearId=" + yearId;
  // Draft grades must not leak into Phase 7 published-grade summaries.
  const academicPath = "/v1/admin/learning/reports?academicYearId="+yearId;
  const gradesAuditPath = "/v1/admin/learning/audit?academicYearId="+yearId;
  const beforePublicationReport = await app.inject({method:"GET",url:academicPath,headers:admin});
  assert.equal(beforePublicationReport.statusCode,200,beforePublicationReport.body);
  assert.equal(beforePublicationReport.json<{summary:{publishedGrades:number}}>()
    .summary.publishedGrades,0);

  const draftDirectory = await app.inject({ method: "GET", url: directoryPath, headers: admin });
  assert.equal(draftDirectory.statusCode, 200, draftDirectory.body);
  assert.equal(draftDirectory.json<{total:number;rows:unknown[]}>().total, 0);

  const publish = await app.inject({
    method: "POST",
    url: `/v1/admin/exams/${examId}/publish`,
    headers: admin
  });
  assert.equal(publish.statusCode, 200);
  assert.equal(publish.json<{ notificationCount: number }>().notificationCount, 2);
  const publishedAcademicReport = await app.inject({method:"GET",url:academicPath,headers:admin});
  assert.equal(publishedAcademicReport.statusCode,200,publishedAcademicReport.body);
  const publishedAcademicSummary = publishedAcademicReport.json<{summary:{
    publishedGrades:number;publishedExamSubjects:number
  }}>().summary;
  assert.equal(publishedAcademicSummary.publishedGrades,2);
  assert.equal(publishedAcademicSummary.publishedExamSubjects,2);
  const examsAudit = await app.inject({method:"GET",url:gradesAuditPath+"&category=EXAMS",headers:admin});
  assert.equal(examsAudit.statusCode,200,examsAudit.body);
  assert.ok(examsAudit.json<{rows:Array<{action:string}>}>().rows
    .some(row=>row.action==="exam.results_published"));

  const afterPublication = await app.inject({ method: "GET", url: readinessUrl, headers: admin });
  assert.equal(afterPublication.statusCode, 200, afterPublication.body);
  assert.equal(afterPublication.json<{canPublish:boolean;totals:{validMarks:number}}>().canPublish, false);
  assert.equal(afterPublication.json<{totals:{validMarks:number}}>().totals.validMarks, 2);
  const duplicatePublish = await app.inject({ method: "POST",
    url: `/v1/admin/exams/${examId}/publish`, headers: admin });
  assert.equal(duplicatePublish.statusCode, 409);
  for (const headers of [parentAuth, studentAuth]) {
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications", headers });
    assert.equal(inbox.statusCode, 200);
    assert.equal(inbox.json<{ notifications: Array<{ type: string; metadata: { examId?: string } }> }>()
      .notifications.filter(x => x.type === "RESULTS_PUBLISHED" && x.metadata.examId === examId).length, 1);
  }

  const publishAgain = await app.inject({ method: "POST",
    url: `/v1/admin/exams/${examId}/publish`, headers: admin });
  assert.equal(publishAgain.statusCode, 409, publishAgain.body);
  const teacherAfterPublish = await app.inject({ method: "POST",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: assignedTeacher.auth, payload: { entries: [{ studentId, score: 99 }] } });
  assert.equal(teacherAfterPublish.statusCode, 409, teacherAfterPublish.body);

  const parentPublished = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  const results = parentPublished.json<{ results: Array<{ grade: { id: string; score: number; status: string; updatedAt: string } }> }>().results;
  assert.equal(results.length, 2);
  assert.equal(results[0]?.grade.score, 88);
  assert.equal(results.reduce((sum, row) => sum + row.grade.score, 0), 128);
  assert.equal(results[0]?.grade.status, "PUBLISHED");

  const studentPublished = await app.inject({
    method: "GET",
    url: "/v1/student/home",
    headers: studentAuth
  });
  const studentResults = studentPublished.json<{ results: Array<{ grade: { score: number; status: string } }> }>().results;
  assert.equal(studentResults.length, 2);
  assert.equal(studentResults[0]?.grade.score, 88);
  assert.equal(studentResults.reduce((sum, row) => sum + row.grade.score, 0), 128);
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

  // Admin Learning Phase 4: tenant-safe published directory, SQL filters,
  // stable pagination, and strict filter validation.
  assert.equal((await app.inject({ method: "GET", url: directoryPath })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: directoryPath,
    headers: assignedTeacher.auth })).statusCode, 403);
  const otherSchoolDirectory = await app.inject({ method: "GET", url: directoryPath, headers: otherAdmin });
  assert.equal(otherSchoolDirectory.statusCode, 200, otherSchoolDirectory.body);
  assert.equal(otherSchoolDirectory.json<{total:number}>().total, 0);
  const fullDirectory = await app.inject({ method: "GET", url: directoryPath, headers: admin });
  assert.equal(fullDirectory.statusCode, 200, fullDirectory.body);
  const directoryRows = fullDirectory.json<{total:number; rows:Array<{
    grade:{id:string;score:number}; examId:string; canCorrect:boolean;
  }> }>();
  assert.equal(directoryRows.total, 2);
  assert.equal(directoryRows.rows.length, 2);
  assert.ok(directoryRows.rows.every(row => row.examId === examId && row.canCorrect));
  for (const query of [
    "&examId=" + examId, "&classId=" + classId,
    "&subjectId=" + subjectId, "&search=Midyear"
  ]) {
    const filtered = await app.inject({ method: "GET", url: directoryPath + query, headers: admin });
    assert.equal(filtered.statusCode, 200, filtered.body);
    assert.ok(filtered.json<{total:number}>().total >= 1);
  }
  for (const query of ["&examId=not-a-uuid", "&limit=1000", "&offset=-1"]) {
    assert.equal((await app.inject({ method: "GET", url: directoryPath + query,
      headers: admin })).statusCode, 400);
  }
  const firstPage = await app.inject({ method: "GET",
    url: directoryPath + "&limit=1&offset=0", headers: admin });
  const secondPage = await app.inject({ method: "GET",
    url: directoryPath + "&limit=1&offset=1", headers: admin });
  assert.equal(firstPage.statusCode, 200);
  assert.equal(secondPage.statusCode, 200);
  const gradeOnPageOne = firstPage.json<{rows:Array<{grade:{id:string}}>}>().rows[0]?.grade.id;
  const gradeOnPageTwo = secondPage.json<{rows:Array<{grade:{id:string}}>}>().rows[0]?.grade.id;
  assert.ok(gradeOnPageOne && gradeOnPageTwo && gradeOnPageOne !== gradeOnPageTwo);
  const streamlinedOverview = await app.inject({ method: "GET",
    url: "/v1/admin/learning?includePublishedGrades=false", headers: admin });
  assert.equal(streamlinedOverview.statusCode, 200);
  assert.equal(streamlinedOverview.json<{publishedGrades:unknown[]}>().publishedGrades.length, 0);

  // 15.10/15.12: post-publication edits are Admin-only and validated.
  const gradeIdToCorrect = results[0]!.grade.id;
  const initialGradeRevision = results[0]!.grade.updatedAt;
  const correctionHistoryUrl = "/v1/admin/grades/" + gradeIdToCorrect + "/corrections";
  assert.equal((await app.inject({ method: "GET", url: correctionHistoryUrl })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: correctionHistoryUrl,
    headers: assignedTeacher.auth })).statusCode, 403);
  assert.equal((await app.inject({ method: "GET", url: correctionHistoryUrl,
    headers: otherAdmin })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET",
    url: "/v1/admin/grades/not-a-uuid/corrections", headers: admin })).statusCode, 400);
  const beforeCorrectionHistory = await app.inject({ method: "GET",
    url: correctionHistoryUrl, headers: admin });
  assert.equal(beforeCorrectionHistory.statusCode, 200);
  assert.equal(beforeCorrectionHistory.json<{total:number}>().total, 0);

  for (const payload of [
    { score: -1, reason: "Bad value" },
    { score: 101, reason: "Out of range" },
    { score: 92, reason: " " },
    { score: 88, remark: null, reason: "No actual change" }
  ]) {
    const invalid = await app.inject({ method: "PATCH",
      url: `/v1/admin/grades/${gradeIdToCorrect}/correct`, headers: admin,
      payload });
    assert.equal(invalid.statusCode, 400, invalid.body);
  }
  const teacherCannotCorrect = await app.inject({ method: "PATCH",
    url: `/v1/admin/grades/${gradeIdToCorrect}/correct`,
    headers: assignedTeacher.auth,
    payload: { score: 91, reason: "Not an administrator" } });
  assert.equal(teacherCannotCorrect.statusCode, 403);

  const corrected = await app.inject({
    method: "PATCH",
    url: `/v1/admin/grades/${results[0]!.grade.id}/correct`,
    headers: admin,
    payload: { score: 91, remark: "Reviewed", reason: "Verified scoring correction",
      expectedUpdatedAt: initialGradeRevision }
  });
  assert.equal(corrected.statusCode, 200);
  assert.equal(corrected.json<{ previousScore: number; grade: { score: number } }>().previousScore, 88);
  assert.equal(corrected.json<{ grade: { score: number } }>().grade.score, 91);
  const phase7CorrectionAudit = await app.inject({method:"GET",
    url:gradesAuditPath+"&category=GRADES",headers:admin});
  assert.equal(phase7CorrectionAudit.statusCode,200,phase7CorrectionAudit.body);
  assert.ok(phase7CorrectionAudit.json<{rows:Array<{action:string;metadata?:unknown;score?:number}>}>()
    .rows.some(row=>row.action==="grade.corrected"));
  assert.ok(phase7CorrectionAudit.json<{rows:Array<{metadata?:unknown;score?:number}>}>()
    .rows.every(row=>row.metadata===undefined&&row.score===undefined));
  const crossYearAudit = await app.inject({method:"GET",url:gradesAuditPath,headers:otherAdmin});
  assert.equal(crossYearAudit.statusCode,404);

  const correctionHistory = await app.inject({ method: "GET",
    url: correctionHistoryUrl, headers: admin });
  assert.equal(correctionHistory.statusCode, 200, correctionHistory.body);
  const correctionEvents = correctionHistory.json<{total:number; events:Array<{
    previousScore:number;score:number;reason:string;actorUsername:string;
  }> }>();
  assert.equal(correctionEvents.total, 1);
  assert.equal(correctionEvents.events[0]?.previousScore, 88);
  assert.equal(correctionEvents.events[0]?.score, 91);
  assert.equal(correctionEvents.events[0]?.reason, "Verified scoring correction");
  assert.ok(correctionEvents.events[0]?.actorUsername);
  const updatedDirectory = await app.inject({ method: "GET", url: directoryPath, headers: admin });
  assert.equal(updatedDirectory.statusCode, 200);
  assert.equal(updatedDirectory.json<{rows:Array<{grade:{id:string;score:number}}>}>()
    .rows.find(item => item.grade.id === gradeIdToCorrect)?.grade.score, 91);

  const crossTenantCorrection = await app.inject({ method: "PATCH",
    url: `/v1/admin/grades/${gradeIdToCorrect}/correct`, headers: otherAdmin,
    payload: { score: 90, reason: "Different school may not edit" } });
  assert.equal(crossTenantCorrection.statusCode, 404);

  const staleCorrection = await app.inject({ method: "PATCH",
    url: `/v1/admin/grades/${gradeIdToCorrect}/correct`,
    headers: admin, payload: { score: 90, reason: "Stale overwrite",
      expectedUpdatedAt: initialGradeRevision } });
  assert.equal(staleCorrection.statusCode, 409, staleCorrection.body);

  const parentCorrected = await app.inject({
    method: "GET",
    url: `/v1/parent/children/${studentId}/learning`,
    headers: parentAuth
  });
  assert.equal(
    parentCorrected.json<{ results: Array<{ grade: { score: number } }> }>().results[0]?.grade.score,
    91
  );

  const studentCorrected = await app.inject({
    method: "GET",
    url: "/v1/student/home",
    headers: studentAuth
  });
  const correctedStudentResult = studentCorrected.json<{
    results: Array<{
      grade: { score: number; remark: string | null; status: string };
      exam: { status: string };
    }>;
  }>().results[0];
  assert.equal(correctedStudentResult?.grade.score, 91);
  assert.equal(correctedStudentResult?.grade.remark, "Reviewed");
  assert.equal(correctedStudentResult?.grade.status, "PUBLISHED");
  assert.equal(correctedStudentResult?.exam.status, "PUBLISHED");
  // 15.11: aggregation uses all published subject maximums, not a
  // hardcoded 100-point percentage; correction immediately changes totals.
  const finalParentRows = parentCorrected.json<{ results: Array<{
    grade: { score: number }; examSubject: { maxScore: number }
  }> }>().results;
  assert.equal(finalParentRows.reduce((sum, x) => sum + x.grade.score, 0), 131);
  assert.equal(finalParentRows.reduce((sum, x) => sum + x.examSubject.maxScore, 0), 150);
  const finalStudentRows = studentCorrected.json<{ results: Array<{
    grade: { score: number }; examSubject: { maxScore: number }
  }> }>().results;
  assert.equal(finalStudentRows.reduce((sum, x) => sum + x.grade.score, 0), 131);
  assert.equal(finalStudentRows.reduce((sum, x) => sum + x.examSubject.maxScore, 0), 150);
  const otherClassResults = await app.inject({ method: "GET",
    url: `/v1/parent/children/${outsideStudentId}/learning`, headers: parentAuth });
  assert.equal(otherClassResults.statusCode, 200);
  assert.equal(otherClassResults.json<{ results: unknown[] }>().results.length, 0);
  // Published aggregate results remain durable after archival, without
  // re-publishing or making archived grades editable.
  const archived = await app.inject({ method: "POST",
    url: `/v1/admin/exams/${examId}/status`, headers: admin,
    payload: { status: "ARCHIVED" } });
  assert.equal(archived.statusCode, 200);
  const archivedDirectory = await app.inject({ method: "GET", url: directoryPath, headers: admin });
  assert.equal(archivedDirectory.statusCode, 200, archivedDirectory.body);
  assert.equal(archivedDirectory.json<{rows:Array<{canCorrect:boolean}>}>().rows.length, 2);
  assert.ok(archivedDirectory.json<{rows:Array<{canCorrect:boolean}>}>()
    .rows.every(row => !row.canCorrect));

  const archivedRoster = await app.inject({ method: "GET",
    url: `/v1/teacher/exam-subjects/${examSubjectId}/grades`,
    headers: assignedTeacher.auth });
  assert.equal(archivedRoster.statusCode, 200);
  assert.equal(archivedRoster.json<{ canEdit: boolean }>().canEdit, false);
  const archivedCorrection = await app.inject({ method: "PATCH",
    url: `/v1/admin/grades/${gradeIdToCorrect}/correct`,
    headers: admin, payload: { score: 93, reason: "Archived results locked" } });
  assert.equal(archivedCorrection.statusCode, 409, archivedCorrection.body);
  for (const [headers, url] of [
    [parentAuth, `/v1/parent/children/${studentId}/learning`],
    [studentAuth, "/v1/student/home"]
  ] as const) {
    const history = await app.inject({ method: "GET", url, headers });
    assert.equal(history.statusCode, 200);
    assert.equal(history.json<{ results: Array<{ exam: { status: string } }> }>()
      .results.length, 2);
    assert.ok(history.json<{ results: Array<{ exam: { status: string } }> }>()
      .results.every(x => x.exam.status === "ARCHIVED"));
  }

  const auditLog = await client.query<{
    action: string; entity_id: string; metadata: Record<string, unknown>
  }>(
    "SELECT action, entity_id, metadata FROM audit_logs WHERE school_id = $1 ORDER BY created_at",
    [schoolId]
  );
  const forExam = auditLog.rows.filter(x => x.entity_id === examId);
  assert.equal(forExam.filter(x => x.action === "exam.created").length, 1);
  assert.equal(forExam.filter(x => x.action === "exam.status_changed").length, 4);
  assert.equal(forExam.filter(x => x.action === "exam.results_published").length, 1);
  assert.equal(auditLog.rows.filter(x => x.action === "exam.subject_added" &&
    [examSubjectId, secondExamSubjectId].includes(x.entity_id)).length, 2);
  // Phase 2 tests two legitimate date changes for the same-day advisory,
  // restores the original date, and later exercises the original date repair.
  assert.equal(auditLog.rows.filter(x => x.action === "exam.subject_date_changed" &&
    x.entity_id === secondExamSubjectId).length, 3);
  assert.equal(auditLog.rows.filter(x => x.action === "grades.draft_saved" &&
    [examSubjectId, secondExamSubjectId].includes(x.entity_id)).length, 2);
  const correctionAudit = auditLog.rows.filter(x =>
    x.action === "grade.corrected" && x.entity_id === gradeIdToCorrect);
  assert.equal(correctionAudit.length, 1);
  assert.equal(correctionAudit[0]?.metadata.previousScore, 88);
  assert.equal(correctionAudit[0]?.metadata.score, 91);
  assert.equal(correctionAudit[0]?.metadata.reason, "Verified scoring correction");


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
  const studentBResponse = await app.inject({
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
  const studentB = studentBResponse.json<{ student: { id: string } }>().student;

  const studentAAccount = await app.inject({
    method: "POST",
    url: `/v1/admin/families/students/${studentA.id}/account`,
    headers: admin,
    payload: { username: "comm7studenta" }
  });
  const studentBAccount = await app.inject({
    method: "POST",
    url: `/v1/admin/families/students/${studentB.id}/account`,
    headers: admin,
    payload: { username: "comm7studentb" }
  });
  assert.equal(studentAAccount.statusCode, 201);
  assert.equal(studentBAccount.statusCode, 201);
  const studentAToken = await activateRoleLogin(
    app, schoolId, "STUDENT", "comm7studenta",
    studentAAccount.json<{ temporaryPassword: string }>().temporaryPassword,
    "CommStudentA2026!"
  );
  const studentBToken = await activateRoleLogin(
    app, schoolId, "STUDENT", "comm7studentb",
    studentBAccount.json<{ temporaryPassword: string }>().temporaryPassword,
    "CommStudentB2026!"
  );

  const parentAToken = await activateRoleLogin(
    app, schoolId, "PARENT", "classaparent", parentA.temporaryPassword, "ClassAParent2026!"
  );
  const parentBToken = await activateRoleLogin(
    app, schoolId, "PARENT", "classbparent", parentB.temporaryPassword, "ClassBParent2026!"
  );

  // Admin Communication Phase 2: recipient preview shares the exact audience
  // resolver used by publication but must not create messages/notifications.
  const preview = (payload: Record<string,unknown>, headers=admin) =>
    app.inject({ method:"POST",url:"/v1/admin/announcements/recipients/preview",
      headers,payload });
  const ownClassPreview=await preview({audienceScope:"CLASS",classId:classA});
  assert.equal(ownClassPreview.statusCode,200,ownClassPreview.body);
  assert.equal(ownClassPreview.json<{recipientCount:number}>().recipientCount,2);
  assert.ok(ownClassPreview.json<{schoolTimezone:string}>().schoolTimezone);
  assert.equal((await preview({audienceScope:"CLASS",classId:classA,
    audienceRole:"PARENT"})).json<{recipientCount:number}>().recipientCount,1);
  assert.equal((await preview({audienceScope:"CLASS",classId:classB,
    audienceRole:"STUDENT"})).json<{recipientCount:number}>().recipientCount,1);
  assert.equal((await preview({audienceScope:"ROLE",
    audienceRole:"PARENT"})).json<{recipientCount:number}>().recipientCount,2);
  assert.equal((await preview({audienceScope:"SCHOOL",audienceRole:"PARENT"})).statusCode,400);
  assert.equal((await preview({audienceScope:"CLASS"})).statusCode,400);
  assert.equal((await preview({audienceScope:"CLASS",
    classId:"12345678-1234-4234-8234-123456789999"})).statusCode,404);
  assert.equal((await preview({audienceScope:"CLASS",classId:classA},
    {authorization:`Bearer ${parentAToken}`})).statusCode,403);
  const beforePreviewMessages=await app.inject({method:"GET",
    url:"/v1/admin/communication",headers:admin});
  assert.equal(beforePreviewMessages.json<{announcements:unknown[]}>().announcements.length,0);

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

  // Step 11.6: Student announcement scope and personal notification ownership.
  const studentAAnnouncements = await app.inject({
    method: "GET", url: "/v1/announcements",
    headers: { authorization: `Bearer ${studentAToken}` }
  });
  const studentBAnnouncements = await app.inject({
    method: "GET", url: "/v1/announcements",
    headers: { authorization: `Bearer ${studentBToken}` }
  });
  assert.equal(studentAAnnouncements.statusCode, 200);
  assert.equal(studentBAnnouncements.statusCode, 200);
  assert.equal(studentAAnnouncements.json<{ announcements: unknown[] }>().announcements.length, 1);
  assert.equal(studentBAnnouncements.json<{ announcements: unknown[] }>().announcements.length, 0);

  const studentANotifications = await app.inject({
    method: "GET", url: "/v1/notifications",
    headers: { authorization: `Bearer ${studentAToken}` }
  });
  const recipientAlerts = studentANotifications.json<{
    notifications: Array<{ id: string; type: string; readAt: string | null }>
  }>().notifications.filter((item) => item.type === "ANNOUNCEMENT");
  assert.equal(recipientAlerts.length, 1);
  assert.equal(recipientAlerts[0]?.readAt, null);
  const recipientNotificationId = recipientAlerts[0]!.id;
  const crossAccountRead = await app.inject({
    method: "POST",
    url: `/v1/notifications/${recipientNotificationId}/read`,
    headers: { authorization: `Bearer ${studentBToken}` }
  });
  assert.equal(crossAccountRead.statusCode, 404);
  const acknowledged = await app.inject({
    method: "POST",
    url: `/v1/notifications/${recipientNotificationId}/read`,
    headers: { authorization: `Bearer ${studentAToken}` }
  });
  assert.equal(acknowledged.statusCode, 200);
  assert.ok(acknowledged.json<{ notification: { readAt: string | null } }>().notification.readAt);
  // Step 16: audience fields are exclusive except CLASS + optional role,
  // which is an intersection (class membership AND the requested role).
  for (const payload of [
    { title: "Wrong scope", content: "No", audienceScope: "SCHOOL", audienceRole: "PARENT" },
    { title: "Missing role", content: "No", audienceScope: "ROLE" },
    { title: "Missing class", content: "No", audienceScope: "CLASS" },
    { title: "X", content: "No", audienceScope: "SCHOOL" },
    { title: "Wrong class field", content: "No", audienceScope: "ROLE",
      audienceRole: "STUDENT", classId: classA }
  ]) {
    const invalid = await app.inject({ method: "POST", url: "/v1/admin/announcements",
      headers: admin, payload });
    assert.equal(invalid.statusCode, 400, invalid.body);
  }
  const roleTarget = await app.inject({ method: "POST",
    url: "/v1/admin/announcements", headers: admin,
    payload: { title: "Class B students only", content: "Only students of B",
      audienceScope: "CLASS", classId: classB, audienceRole: "STUDENT" } });
  assert.equal(roleTarget.statusCode, 201);
  const roleTargetId = roleTarget.json<{ announcement: { id: string } }>().announcement.id;
  for (const [token, visible] of [
    [studentAToken, false], [studentBToken, true],
    [parentAToken, false], [parentBToken, false]
  ] as const) {
    const res = await app.inject({ method: "GET", url: "/v1/announcements",
      headers: { authorization: `Bearer ${token}` } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json<{ announcements: Array<{ id: string }> }>()
      .announcements.some(item => item.id === roleTargetId), visible);
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications",
      headers: { authorization: `Bearer ${token}` } });
    assert.equal(inbox.json<{ notifications: Array<{ metadata: { announcementId?: string } }> }>()
      .notifications.some(item => item.metadata.announcementId === roleTargetId), visible);
  }


  // 16.3: a role-only announcement is not silently broadcast school-wide.
  const parentRoleNotice = await app.inject({ method: "POST",
    url: "/v1/admin/announcements", headers: admin,
    payload: { title: "Parents meeting", content: "For parent accounts",
      audienceScope: "ROLE", audienceRole: "PARENT" } });
  assert.equal(parentRoleNotice.statusCode, 201);
  const parentRoleId = parentRoleNotice.json<{ announcement: { id: string } }>().announcement.id;
  for (const [token, expected] of [
    [parentAToken, true], [parentBToken, true],
    [studentAToken, false], [studentBToken, false]
  ] as const) {
    const response = await app.inject({ method: "GET", url: "/v1/announcements",
      headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.json<{ announcements: Array<{ id: string }> }>()
      .announcements.some(item => item.id === parentRoleId), expected);
  }

  // 16.6: unpublished SCHEDULED announcements can be edited; published
  // notices cannot be silently rewritten after delivery.
  const scheduled = await app.inject({ method: "POST",
    url: "/v1/admin/announcements", headers: admin,
    payload: { title: "Scheduled opening", content: "Old text",
      audienceScope: "SCHOOL", publishAt: "2099-12-01T08:00:00Z" } });
  assert.equal(scheduled.statusCode, 201);
  const scheduledId = scheduled.json<{ announcement: { id: string } }>().announcement.id;
  const editScheduled = await app.inject({ method: "PATCH",
    url: `/v1/admin/announcements/${scheduledId}`, headers: admin,
    payload: { title: "Updated scheduled opening", content: "New scheduled text",
      audienceScope: "CLASS", classId: classB, audienceRole: "PARENT" } });
  assert.equal(editScheduled.statusCode, 200);
  const editingPublished = await app.inject({ method: "PATCH",
    url: `/v1/admin/announcements/${roleTargetId}`, headers: admin,
    payload: { content: "Cannot silently rewrite" } });
  assert.equal(editingPublished.statusCode, 409);
  const noEarlyDelivery = await app.inject({ method: "GET", url: "/v1/notifications",
    headers: { authorization: `Bearer ${parentBToken}` } });
  assert.equal(noEarlyDelivery.json<{ notifications: Array<{ metadata: { announcementId?: string } }> }>()
    .notifications.some(item => item.metadata.announcementId === scheduledId), false);

  // Scheduler replay creates each recipient alert only once, even after a
  // transient retry. A Class B parent receives it, not Class A or Students.
  await client.query("UPDATE announcements SET publish_at=now()-interval '1 second' WHERE id=$1",
    [scheduledId]);
  const runJob = () => app.inject({ method: "POST",
    url: "/v1/platform/jobs/communication/run",
    headers: { "x-platform-provisioning-key": provisioningKey } });
  const firstScheduledJob = await runJob();
  assert.equal(firstScheduledJob.statusCode, 200);
  const secondScheduledJob = await runJob();
  assert.equal(secondScheduledJob.statusCode, 200);
  const adminDelivery = await app.inject({
    method: "GET", url: "/v1/admin/notifications/delivery", headers: admin
  });
  assert.equal(adminDelivery.statusCode, 200);
  const deliveryInfo = adminDelivery.json<{
    scheduler: { lastSuccessAt: string | null };
    counts: { queued: number; providerAccepted: number; read: number };
    recent: Array<{ id: string; title: string }>;
  }>();
  assert.ok(deliveryInfo.scheduler.lastSuccessAt, "scheduler heartbeat must be persisted");
  assert.ok(deliveryInfo.counts.queued > 0, "in-app queue exists even without push registration");
  assert.equal(deliveryInfo.counts.providerAccepted, 0, "no registered devices means no provider acceptance");
  assert.ok(deliveryInfo.recent.length > 0);
  assert.equal((await app.inject({
    method: "GET", url: "/v1/admin/notifications/delivery",
    headers: { authorization: `Bearer ${parentBToken}` }
  })).statusCode, 403);
  assert.equal((await app.inject({
    method: "POST",
    url: `/v1/admin/notifications/${deliveryInfo.recent[0]!.id}/retry`,
    headers: admin
  })).statusCode, 409);
  assert.equal((await app.inject({
    method: "POST",
    url: `/v1/admin/notifications/${deliveryInfo.recent[0]!.id}/retry`,
    headers: { authorization: `Bearer ${parentBToken}` }
  })).statusCode, 403);
  for (const [token, expected] of [
    [parentAToken, false], [parentBToken, true],
    [studentAToken, false], [studentBToken, false]
  ] as const) {
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications",
      headers: { authorization: `Bearer ${token}` } });
    const matches = inbox.json<{ notifications: Array<{ metadata: { announcementId?: string } }> }>()
      .notifications.filter(x => x.metadata.announcementId === scheduledId);
    assert.equal(matches.length, expected ? 1 : 0);
  }

  // 16.7/16.8: counts reflect current visibility and bulk-read is idempotent.
  const bAuth = { authorization: `Bearer ${parentBToken}` };
  const beforeBulk = await app.inject({ method: "GET",
    url: "/v1/notifications", headers: bAuth });
  const unreadExpected = beforeBulk.json<{
    unreadCount: number; notifications: Array<{ readAt: string | null }>
  }>();
  assert.equal(unreadExpected.unreadCount, unreadExpected.notifications.filter(x => !x.readAt).length);
  const readAll = await app.inject({ method: "POST",
    url: "/v1/notifications/read-all", headers: bAuth });
  assert.equal(readAll.statusCode, 200);
  assert.equal(readAll.json<{ changed: number }>().changed, unreadExpected.unreadCount);
  const repeatReadAll = await app.inject({ method: "POST",
    url: "/v1/notifications/read-all", headers: bAuth });
  assert.equal(repeatReadAll.json<{ changed: number }>().changed, 0);
  const unreadAfter = await app.inject({ method: "GET",
    url: "/v1/notifications/unread-count", headers: bAuth });
  assert.equal(unreadAfter.json<{ unreadCount: number }>().unreadCount, 0);

  const archivedNotice = await app.inject({ method: "POST",
    url: `/v1/admin/announcements/${scheduledId}/archive`, headers: admin });
  assert.equal(archivedNotice.statusCode, 200);
  const repeatArchive = await app.inject({ method: "POST",
    url: `/v1/admin/announcements/${scheduledId}/archive`, headers: admin });
  assert.equal(repeatArchive.statusCode, 409);
  const afterArchive = await app.inject({ method: "GET",
    url: "/v1/notifications", headers: bAuth });
  assert.equal(afterArchive.json<{ notifications: Array<{ metadata: { announcementId?: string } }> }>()
    .notifications.some(x => x.metadata.announcementId === scheduledId), false);

  // 16.5: one Parent can legitimately receive notices for children in
  // different classes. Access is the union of CURRENT active enrollments.
  const sibling = await app.inject({ method: "POST",
    url: "/v1/admin/families/students", headers: admin,
    payload: { parentUserId: parentA.user.id, studentCode: "C7-A-SIB",
      fullName: "Class B Sibling", academicYearId: yearId, classId: classB } });
  assert.equal(sibling.statusCode, 201);
  const classBAll = await app.inject({ method: "POST",
    url: "/v1/admin/announcements", headers: admin,
    payload: { title: "All of Class B", content: "Parents and students",
      audienceScope: "CLASS", classId: classB } });
  assert.equal(classBAll.statusCode, 201);
  const classBAllId = classBAll.json<{ announcement: { id: string } }>().announcement.id;
  for (const [token, expected] of [
    [parentAToken, true], [parentBToken, true],
    [studentAToken, false], [studentBToken, true]
  ] as const) {
    const notices = await app.inject({ method: "GET", url: "/v1/announcements",
      headers: { authorization: `Bearer ${token}` } });
    assert.equal(notices.json<{ announcements: Array<{ id: string }> }>()
      .announcements.some(item => item.id === classBAllId), expected);
  }

  // The Parent's Class B entitlement is revoked when the only Class B
  // child withdraws; archived/old inbox messages cannot bypass this check.
  const siblingId = sibling.json<{ student: { id: string } }>().student.id;
  const withdrawnSibling = await app.inject({ method: "PATCH",
    url: `/v1/admin/families/students/${siblingId}`, headers: admin,
    payload: { status: "WITHDRAWN" } });
  assert.equal(withdrawnSibling.statusCode, 200);
  const noLongerVisible = await app.inject({ method: "GET",
    url: "/v1/announcements",
    headers: { authorization: `Bearer ${parentAToken}` } });
  assert.equal(noLongerVisible.json<{ announcements: Array<{ id: string }> }>()
    .announcements.some(x => x.id === classBAllId), false);
  const noLongerInInbox = await app.inject({ method: "GET",
    url: "/v1/notifications",
    headers: { authorization: `Bearer ${parentAToken}` } });
  assert.equal(noLongerInInbox.json<{
    notifications: Array<{ metadata: { announcementId?: string } }>
  }>().notifications.some(x => x.metadata.announcementId === classBAllId), false);

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
  const parentAAuth = { authorization: `Bearer ${parentAToken}` };
  const parentBAuth = { authorization: `Bearer ${parentBToken}` };
  const draftInvisible = await app.inject({ method: "GET", url: `/v1/parent/children/${studentA.id}/fees`, headers: parentAAuth });
  assert.equal(draftInvisible.statusCode, 200);
  assert.equal(draftInvisible.json<{ invoices: Array<{ invoice: { id: string } }> }>().invoices.some(x => x.invoice.id === invoiceId), false);
  assert.equal((await app.inject({ method: "POST", url: "/v1/admin/fees/invoices", headers: parentAAuth,
    payload: { studentId: studentA.id, amount: 50, dueDate: "2099-12-31" } })).statusCode, 403);
  for (const payload of [
    { studentId: studentA.id, amount: 0, dueDate: "2099-12-31" },
    { studentId: studentA.id, amount: 1.5, dueDate: "2099-12-31" },
    { studentId: studentA.id, amount: 200, dueDate: "2099-02-30" },
    { studentId: "00000000-0000-0000-0000-000000000001", amount: 100, dueDate: "2099-12-31" }
  ]) {
    const invalid = await app.inject({ method: "POST", url: "/v1/admin/fees/invoices", headers: admin, payload });
    assert.ok([400, 404].includes(invalid.statusCode), invalid.body);
  }

  const issued = await app.inject({
    method: "POST",
    url: `/v1/admin/fees/invoices/${invoiceId}/issue`,
    headers: admin
  });
  assert.equal(issued.statusCode, 200);
  const issuedAgain = await app.inject({ method: "POST", url: `/v1/admin/fees/invoices/${invoiceId}/issue`, headers: admin });
  assert.equal(issuedAgain.statusCode, 409);
  assert.equal((await app.inject({ method: "GET", url: `/v1/parent/children/${studentA.id}/fees`,
    headers: parentBAuth })).statusCode, 404);
  const otherStudentFees = await app.inject({ method: "GET", url: "/v1/student/fees",
    headers: { authorization: `Bearer ${studentBToken}` } });
  assert.equal(otherStudentFees.statusCode, 200);
  assert.equal(otherStudentFees.json<{ invoices: unknown[] }>().invoices.length, 0);
  const ownStudentFees = await app.inject({ method: "GET", url: "/v1/student/fees",
    headers: { authorization: `Bearer ${studentAToken}` } });
  assert.equal(ownStudentFees.json<{ invoices: Array<{ invoice: { id: string } }> }>()
    .invoices.some(x => x.invoice.id === invoiceId), true);

  const paymentPayload = { amount: 400, method: "CASH", transactionReference: "RCPT-001",
    idempotencyKey: "17000000-0000-4000-8000-000000000017" };
  const paymentResponse = await app.inject({
    method: "POST",
    url: `/v1/admin/fees/invoices/${invoiceId}/payments`,
    headers: admin,
    payload: paymentPayload
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
  const safeRetry = await app.inject({ method: "POST",
    url: `/v1/admin/fees/invoices/${invoiceId}/payments`, headers: admin, payload: paymentPayload });
  assert.equal(safeRetry.statusCode, 201);
  assert.equal(safeRetry.json<{ payments: unknown[]; paid: number }>().payments.length, 1);
  assert.equal(safeRetry.json<{ paid: number }>().paid, 400);
  assert.equal((await app.inject({ method: "POST", url: `/v1/admin/fees/invoices/${invoiceId}/payments`,
    headers: admin, payload: { ...paymentPayload, amount: 300 } })).statusCode, 409);
  assert.equal((await app.inject({ method: "POST", url: `/v1/admin/fees/invoices/${invoiceId}/payments`,
    headers: admin, payload: { amount: 601, method: "CASH" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: `/v1/admin/fees/invoices/${invoiceId}/cancel`,
    headers: admin })).statusCode, 409);

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

  // Student enrollment is authoritative for school-wide delivery too:
  // withdrawal must prevent new notifications even if the account is ACTIVE.
  const withdrawStudentA = await app.inject({
    method: "PATCH",
    url: `/v1/admin/families/students/${studentA.id}`,
    headers: admin,
    payload: { status: "WITHDRAWN" }
  });
  assert.equal(withdrawStudentA.statusCode, 200);
  const schoolAnnouncement = await app.inject({
    method: "POST",
    url: "/v1/admin/announcements",
    headers: admin,
    payload: {
      title: "School update after withdrawal",
      content: "Current students receive this notice.",
      audienceScope: "SCHOOL"
    }
  });
  assert.equal(schoolAnnouncement.statusCode, 201);
  const studentBRecent = await app.inject({
    method: "GET",
    url: "/v1/notifications",
    headers: { authorization: `Bearer ${studentBToken}` }
  });
  assert.ok(
    studentBRecent.json<{ notifications: Array<{ title: string }> }>().notifications
      .some((item) => item.title === "School update after withdrawal")
  );
  const reactivateStudentA = await app.inject({
    method: "PATCH",
    url: `/v1/admin/families/students/${studentA.id}`,
    headers: admin,
    payload: { status: "ACTIVE" }
  });
  assert.equal(reactivateStudentA.statusCode, 200);
  const studentAAfterReactivation = await app.inject({
    method: "GET",
    url: "/v1/notifications",
    headers: { authorization: `Bearer ${studentAToken}` }
  });
  assert.equal(studentAAfterReactivation.statusCode, 200);
  assert.equal(
    studentAAfterReactivation.json<{ notifications: Array<{ title: string }> }>().notifications
      .some((item) => item.title === "School update after withdrawal"),
    false
  );
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

test("Step 18 pilot onboarding is credential-gated, scoped, and rejects inconsistent dates without orphan schools", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });

  const payload = {
    school: {
      code: "ATOMIC18", name: "Atomic Pilot School", slug: "atomic-18",
      province: "Kabul", city: "Kabul", defaultLanguage: "fa-AF"
    },
    adminUsername: "pilot18.admin"
  };
  const unauthorized = await app.inject({
    method: "POST", url: "/v1/platform/pilot/onboard", payload
  });
  assert.equal(unauthorized.statusCode, 401);

  const badDates = await app.inject({
    method: "POST", url: "/v1/platform/pilot/onboard",
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { ...payload, subscription: { startsOn: "2099-12-01" } }
  });
  assert.equal(badDates.statusCode, 409, badDates.body);
  const list = await app.inject({
    method: "GET", url: "/v1/platform/schools",
    headers: { "x-platform-provisioning-key": provisioningKey }
  });
  assert.equal(list.statusCode, 200);
  assert.equal(
    list.json<{ schools: Array<{ code: string }> }>().schools.some(row => row.code === "ATOMIC18"),
    false
  );

  const onboard = await app.inject({
    method: "POST", url: "/v1/platform/pilot/onboard",
    headers: { "x-platform-provisioning-key": provisioningKey }, payload
  });
  assert.equal(onboard.statusCode, 201, onboard.body);
  const created = onboard.json<{ school: { id: string }; admin: { id: string; username: string };
    temporaryPassword: string }>();
  assert.equal(created.admin.username, "pilot18.admin");
  assert.ok(created.temporaryPassword.length >= 12);
  assert.equal(onboard.body.includes("passwordHash"), false);

  const duplicate = await app.inject({
    method: "POST", url: "/v1/platform/pilot/onboard",
    headers: { "x-platform-provisioning-key": provisioningKey }, payload
  });
  assert.equal(duplicate.statusCode, 409, duplicate.body);
  const schools = await app.inject({
    method: "GET", url: "/v1/platform/schools",
    headers: { "x-platform-provisioning-key": provisioningKey }
  });
  assert.equal(schools.json<{ schools: Array<{ code: string }> }>().schools.filter(
    row => row.code === "ATOMIC18"
  ).length, 1);
});

test("Step 18 subscription patch validates persisted dates and never revives CANCELLED", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });

  const schoolId = await provisionSchool(app, "SUB18");
  const url = `/v1/platform/schools/${schoolId}/subscription`;
  const headers = { "x-platform-provisioning-key": provisioningKey };
  const mismatch = await app.inject({
    method: "PATCH", url, headers,
    payload: { startsOn: "2099-01-01" }
  });
  assert.equal(mismatch.statusCode, 409);

  const current = await app.inject({
    method: "GET", url: `/v1/platform/schools/${schoolId}`, headers
  });
  assert.equal(current.statusCode, 200);
  assert.notEqual(
    current.json<{ subscription: { startsOn: string } }>().subscription.startsOn,
    "2099-01-01"
  );

  const cancelled = await app.inject({
    method: "PATCH", url, headers, payload: { status: "CANCELLED" }
  });
  assert.equal(cancelled.statusCode, 200);
  const revive = await app.inject({
    method: "PATCH", url, headers, payload: { status: "ACTIVE" }
  });
  assert.equal(revive.statusCode, 409);
  const unchanged = await app.inject({
    method: "GET", url: `/v1/platform/schools/${schoolId}`, headers
  });
  assert.equal(unchanged.json<{ subscription: { status: string } }>().subscription.status, "CANCELLED");
});

test("Step 18 readiness counts only active administrator accounts", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolId = await provisionSchool(app, "READY18");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const another = await app.inject({
    method: "POST", url: `/v1/platform/schools/${schoolId}/admin`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { username: "invited18.admin" }
  });
  assert.equal(another.statusCode, 201);
  const readiness = await app.inject({
    method: "GET", url: "/v1/admin/pilot/readiness",
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(readiness.statusCode, 200);
  const data = readiness.json<{ ready: boolean; counts: { admins: number; activeAcademicYears: number };
    checks: Array<{ key: string; passed: boolean }> }>();
  assert.equal(data.counts.admins, 1);
  assert.equal(data.counts.activeAcademicYears, 0);
  assert.equal(data.ready, false);
  assert.equal(data.checks.find(row => row.key === "academic-year")?.passed, false);
});

test("Step 20 duplicate teacher usernames return conflict without cross-school blocking", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const firstSchool = await provisionSchool(app, "TENANT-USER-20A");
  const secondSchool = await provisionSchool(app, "TENANT-USER-20B");
  const firstAdmin = { authorization: `Bearer ${await bootstrapAdmin(app, firstSchool)}` };
  const secondAdmin = { authorization: `Bearer ${await bootstrapAdmin(app, secondSchool)}` };
  const payload = { username: "teacherduplicate20", role: "TEACHER" };
  const first = await app.inject({
    method: "POST", url: "/v1/admin/users", headers: firstAdmin, payload
  });
  assert.equal(first.statusCode, 201, first.body);
  const conflict = await app.inject({
    method: "POST", url: "/v1/admin/users", headers: firstAdmin, payload
  });
  assert.equal(conflict.statusCode, 409, conflict.body);
  assert.equal(conflict.json<{ error: string }>().error, "username_conflict");
  const otherSchool = await app.inject({
    method: "POST", url: "/v1/admin/users", headers: secondAdmin, payload
  });
  assert.equal(otherSchool.statusCode, 201, otherSchool.body);
  const directory = await app.inject({ method: "GET", url: "/v1/admin/users", headers: firstAdmin });
  assert.equal(directory.statusCode, 200, directory.body);
  assert.equal(directory.json<{ users: Array<{ username: string }> }>().users.filter(
    (entry) => entry.username === payload.username
  ).length, 1);
});

test("Step 20 deactivated schools and archived users cannot reuse existing access or refresh tokens", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });

  const schoolId = await provisionSchool(app, "SCHOOL-INACTIVE-20");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const adminAuth = { authorization: `Bearer ${adminToken}` };
  const created = await app.inject({
    method: "POST", url: "/v1/admin/families/parents", headers: adminAuth,
    payload: { username: "inactiveparent20", fullName: "Inactive Parent" }
  });
  assert.equal(created.statusCode, 201, created.body);
  const parent = created.json<{ user: { id: string }; temporaryPassword: string }>();
  const login = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { schoolId, username: "inactiveparent20", password: parent.temporaryPassword,
      expectedRole: "PARENT" }
  });
  assert.equal(login.statusCode, 200, login.body);
  const changed = await app.inject({
    method: "POST", url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${login.json<{ accessToken: string }>().accessToken}` },
    payload: { newPassword: "InactiveParent20!" }
  });
  assert.equal(changed.statusCode, 200, changed.body);
  const active = changed.json<{ accessToken: string; refreshToken: string }>();
  const parentAuth = { authorization: `Bearer ${active.accessToken}` };

  for (const headers of [adminAuth, parentAuth]) {
    const before = await app.inject({ method: "GET", url: "/v1/auth/me", headers });
    assert.equal(before.statusCode, 200, before.body);
  }

  const deactivate = await app.inject({
    method: "PATCH", url: `/v1/platform/schools/${schoolId}/status`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { status: "INACTIVE" }
  });
  assert.equal(deactivate.statusCode, 200, deactivate.body);

  for (const headers of [adminAuth, parentAuth]) {
    const blocked = await app.inject({ method: "GET", url: "/v1/auth/me", headers });
    assert.equal(blocked.statusCode, 401, blocked.body);
    assert.equal(blocked.json<{ error: string }>().error, "session_invalid");
  }
  const blockedContact = await app.inject({
    method: "GET", url: "/v1/school/admin-contact", headers: parentAuth
  });
  assert.equal(blockedContact.statusCode, 401, blockedContact.body);
  const blockedRefresh = await app.inject({
    method: "POST", url: "/v1/auth/refresh",
    payload: { refreshToken: active.refreshToken }
  });
  assert.equal(blockedRefresh.statusCode, 401, blockedRefresh.body);
  const blockedNewLogin = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { schoolId, username: "inactiveparent20", password: "InactiveParent20!",
      expectedRole: "PARENT" }
  });
  assert.equal(blockedNewLogin.statusCode, 401, blockedNewLogin.body);

  const reactivate = await app.inject({
    method: "PATCH", url: `/v1/platform/schools/${schoolId}/status`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { status: "ACTIVE" }
  });
  assert.equal(reactivate.statusCode, 200, reactivate.body);
  const restored = await app.inject({ method: "GET", url: "/v1/auth/me", headers: parentAuth });
  assert.equal(restored.statusCode, 200, restored.body);
  const rotated = await app.inject({
    method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: active.refreshToken }
  });
  assert.equal(rotated.statusCode, 200, rotated.body);
  const resumed = rotated.json<{ accessToken: string; refreshToken: string }>();

  // The existing session authenticator rejects archived accounts and inactive
  // schools as invalid sessions; neither may reuse cached credentials.
  await client.query("UPDATE users SET status = 'ARCHIVED' WHERE school_id = $1 AND id = $2",
    [schoolId, parent.user.id]);
  const archivedMe = await app.inject({
    method: "GET", url: "/v1/auth/me",
    headers: { authorization: `Bearer ${resumed.accessToken}` }
  });
  assert.equal(archivedMe.statusCode, 401, archivedMe.body);
  assert.equal(archivedMe.json<{ error: string }>().error, "session_invalid");
  const archivedRefresh = await app.inject({
    method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: resumed.refreshToken }
  });
  assert.equal(archivedRefresh.statusCode, 401, archivedRefresh.body);
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


test("Phase 4 account lifecycle confirms reasons, rejects invalid transitions, and isolates audit by school", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const a = await provisionSchool(app, "AUDIT-LIFECYCLE-A");
  const b = await provisionSchool(app, "AUDIT-LIFECYCLE-B");
  const adminA = await bootstrapAdmin(app, a);
  const adminB = await bootstrapAdmin(app, b);
  const authA = { authorization: `Bearer ${adminA}` };
  const authB = { authorization: `Bearer ${adminB}` };
  const created = await app.inject({
    method: "POST", url: "/v1/admin/users", headers: authA,
    payload: { username: "teacherlifecycle", role: "TEACHER" }
  });
  assert.equal(created.statusCode, 201);
  const target = created.json<{ user: { id: string } }>().user.id;
  const invalidReason = await app.inject({
    method: "POST", url: `/v1/admin/users/${target}/suspend`, headers: authA, payload: { reason: "x" }
  });
  assert.equal(invalidReason.statusCode, 400);
  assert.equal(invalidReason.json<{ error: string }>().error, "validation_error");

  const firstAudit = await app.inject({
    method: "GET", url: `/v1/admin/users/${target}/audit`, headers: authA
  });
  assert.equal(firstAudit.statusCode, 200);
  assert.ok(firstAudit.json<{ logs: Array<{ action: string }> }>().logs.some((event) => event.action === "user.created"));

  const crossSchool = await app.inject({
    method: "GET", url: `/v1/admin/users/${target}/audit`, headers: authB
  });
  assert.equal(crossSchool.statusCode, 404);
  const nonExisting = await app.inject({
    method: "GET", url: "/v1/admin/users/not-a-uuid/audit", headers: authA
  });
  assert.equal(nonExisting.statusCode, 400);

  const suspended = await app.inject({
    method: "POST", url: `/v1/admin/users/${target}/suspend`, headers: authA,
    payload: { reason: "  Staff member requested account review.  " }
  });
  assert.equal(suspended.statusCode, 200);
  assert.equal(suspended.json<{ user: { status: string } }>().user.status, "SUSPENDED");
  const audit = await app.inject({
    method: "GET", url: `/v1/admin/users/${target}/audit?limit=25`, headers: authA
  });
  assert.equal(audit.statusCode, 200);
  const rows = audit.json<{ logs: Array<{ action: string; reason: string | null; actorUserId: string | null; metadata?: unknown }> }>().logs;
  assert.ok(rows.some((entry) => entry.action === "user.suspended" && entry.reason === "Staff member requested account review."));
  assert.ok(rows.every((entry) => !("metadata" in entry)));
  const repeatedSuspend = await app.inject({
    method: "POST", url: `/v1/admin/users/${target}/suspend`, headers: authA
  });
  assert.equal(repeatedSuspend.statusCode, 409);
  const reactivated = await app.inject({
    method: "POST", url: `/v1/admin/users/${target}/reactivate`, headers: authA
  });
  assert.equal(reactivated.statusCode, 200);
  assert.equal(reactivated.json<{ user: { status: string } }>().user.status, "INVITED");
  const repeatedReactivate = await app.inject({
    method: "POST", url: `/v1/admin/users/${target}/reactivate`, headers: authA
  });
  assert.equal(repeatedReactivate.statusCode, 409);
  const lifecycleAudit = await app.inject({
    method: "GET", url: `/v1/admin/users/${target}/audit`, headers: authA
  });
  assert.ok(lifecycleAudit.json<{ logs: Array<{ action: string }> }>().logs.some(x => x.action === "user.reactivated"));

  // Foreign-school administrators may not suspend or inspect another school's accounts.
  const foreignSuspend = await app.inject({
    method: "POST", url: `/v1/admin/users/${target}/suspend`, headers: authB
  });
  assert.equal(foreignSuspend.statusCode, 404);
  const denied = await app.inject({
    method: "GET", url: `/v1/admin/users/${target}/audit?limit=999`, headers: authA
  });
  assert.equal(denied.statusCode, 400);
});


test("Phase 5 directory endpoint pages and sorts school records with validated filters and summaries", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "PAGE-ADMIN-A");
  const schoolB = await provisionSchool(app, "PAGE-ADMIN-B");
  const adminA = await bootstrapAdmin(app, schoolA);
  const adminB = await bootstrapAdmin(app, schoolB);
  const authA = { authorization: `Bearer ${adminA}` };
  const authB = { authorization: `Bearer ${adminB}` };

  const createdIds: string[] = [];
  for (const [username, role] of [
    ["zzteacher", "TEACHER"], ["aaparent", "SCHOOL_STAFF"], ["bbteacher", "TEACHER"]
  ] as const) {
    const response = await app.inject({
      method: "POST", url: "/v1/admin/users", headers: authA,
      payload: { username, role }
    });
    assert.equal(response.statusCode, 201);
    createdIds.push(response.json<{ user: { id: string } }>().user.id);
  }
  const foreignCreated = await app.inject({
    method: "POST", url: "/v1/admin/users", headers: authB,
    payload: { username: "foreignteacher", role: "TEACHER" }
  });
  assert.equal(foreignCreated.statusCode, 201);

  const response = await app.inject({
    method: "GET", url: "/v1/admin/users/directory?page=1&pageSize=10&group=TEACHER&sortBy=username&order=desc",
    headers: authA
  });
  assert.equal(response.statusCode, 200);
  const directory = response.json<{
    users: Array<{ id: string; username: string; passwordHash?: string }>;
    total: number; page: number; pages: number;
    counts: { total: number; teacher: number; active: number; pending: number };
  }>();
  assert.equal(directory.total, 2);
  assert.deepEqual(directory.users.map(x => x.username), ["zzteacher", "bbteacher"]);
  assert.equal(directory.counts.total, 4);
  assert.equal(directory.counts.teacher, 2);
  assert.ok(directory.counts.pending >= 2);
  assert.ok(directory.users.every(x => !("passwordHash" in x)));

  const search = await app.inject({
    method: "GET", url: "/v1/admin/users/directory?query=teacher&pageSize=10&sortBy=createdAt",
    headers: authA
  });
  assert.equal(search.statusCode, 200);
  assert.equal(search.json<{ total: number }>().total, 2);
  const sortPaginated = await app.inject({
    method: "GET", url: "/v1/admin/users/directory?page=2&pageSize=10",
    headers: authA
  });
  assert.equal(sortPaginated.statusCode, 200);
  assert.equal(sortPaginated.json<{ total: number; users: unknown[] }>().total, 4);
  assert.deepEqual(sortPaginated.json<{ users: unknown[] }>().users, []);

  const validUsername = await app.inject({
    method: "GET", url: "/v1/admin/users/username-check?username=ZZTEACHER", headers: authA
  });
  assert.equal(validUsername.statusCode, 200);
  assert.equal(validUsername.json<{ available: boolean }>().available, false);
  const otherSchoolCheck = await app.inject({
    method: "GET", url: "/v1/admin/users/username-check?username=zzteacher", headers: authB
  });
  assert.equal(otherSchoolCheck.statusCode, 200);
  assert.equal(otherSchoolCheck.json<{ available: boolean }>().available, true);
  for (const invalid of [
    "/v1/admin/users/directory?sortBy=passwordHash",
    "/v1/admin/users/directory?pageSize=500",
    "/v1/admin/users/directory?group=OWNER",
    "/v1/admin/users/directory?page=-1",
    "/v1/admin/users/username-check?username=x"
  ]) {
    const denied = await app.inject({ method: "GET", url: invalid, headers: authA });
    assert.equal(denied.statusCode, 400, invalid);
  }
  const secondSchool = await app.inject({
    method: "GET", url: "/v1/admin/users/directory?pageSize=10", headers: authB
  });
  assert.equal(secondSchool.statusCode, 200);
  assert.equal(secondSchool.json<{ total: number }>().total, 2);
});

test("Phase 5 bulk API enforces school scope, eligibility, size, atomicity and audited transitions", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "BULK-API-A");
  const schoolB = await provisionSchool(app, "BULK-API-B");
  const adminA = await bootstrapAdmin(app, schoolA);
  const adminB = await bootstrapAdmin(app, schoolB);
  const authA = { authorization: `Bearer ${adminA}` };
  const authB = { authorization: `Bearer ${adminB}` };

  const create = async (username: string, role: "TEACHER" | "SCHOOL_ADMIN", auth: typeof authA) => {
    const response = await app.inject({
      method: "POST", url: "/v1/admin/users", headers: auth,
      payload: { username, role }
    });
    assert.equal(response.statusCode, 201);
    return response.json<{ user: { id: string } }>().user.id;
  };
  const first = await create("bulkone", "TEACHER", authA);
  const second = await create("bulktwo", "TEACHER", authA);
  const protectedAdmin = await create("protectedadmin", "SCHOOL_ADMIN", authA);
  const foreign = await create("foreignbulk", "TEACHER", authB);
  const url = "/v1/admin/users/bulk-status";
  const make = (ids: string[], action: "suspend" | "reactivate", auth = authA, reason?: string) =>
    app.inject({ method: "POST", url, headers: auth,
      payload: { action, userIds: ids, ...(reason ? { reason } : {}) } });

  assert.equal((await make([first, first], "suspend")).statusCode, 400);
  assert.equal((await make([first], "suspend", authA, "x")).statusCode, 400);
  assert.equal((await make([first, foreign], "suspend")).statusCode, 409);
  assert.equal((await make([first, protectedAdmin], "suspend")).statusCode, 409);
  assert.equal((await make([first, second], "suspend", authB)).statusCode, 409);

  const listBefore = await app.inject({ method: "GET", url: "/v1/admin/users/directory?status=INVITED&pageSize=10", headers: authA });
  assert.equal(listBefore.statusCode, 200);
  assert.ok(listBefore.json<{ users: Array<{ id: string }> }>().users.some(x=>x.id===first));

  const confirmed = await make([first, second], "suspend", authA, "Administrative review requested");
  assert.equal(confirmed.statusCode, 200);
  assert.equal(confirmed.json<{ updated: number }>().updated, 2);
  const allSuspended = await app.inject({ method: "GET", url: "/v1/admin/users/directory?status=SUSPENDED&pageSize=10", headers: authA });
  assert.deepEqual(allSuspended.json<{ users: Array<{ id: string }> }>().users.map(x=>x.id).sort(), [first,second].sort());
  const audit = await app.inject({ method: "GET", url: `/v1/admin/users/${first}/audit`, headers: authA });
  assert.equal(audit.statusCode, 200);
  assert.ok(audit.json<{ logs: Array<{ action: string; reason: string | null }> }>().logs
    .some(x=>x.action==="user.suspended" && x.reason==="Administrative review requested"));

  assert.equal((await make([first, second], "suspend")).statusCode, 409);
  const reactivated = await make([first, second], "reactivate");
  assert.equal(reactivated.statusCode, 200);
  assert.ok(reactivated.json<{ users: Array<{ status: string }> }>().users.every(x=>x.status==="INVITED"));
  assert.equal((await make([first, second], "reactivate")).statusCode, 409);
  const foreignList = await app.inject({ method: "GET", url: "/v1/admin/users/directory?pageSize=10", headers: authB });
  assert.equal(foreignList.json<{ counts: { total: number } }>().counts.total, 2);
});


test("Phase 6 Accounts: role denial, temporary-password restriction, and school-only operations", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "P6-ROLE-A");
  const schoolB = await provisionSchool(app, "P6-ROLE-B");
  const adminToken = await bootstrapAdmin(app, schoolA);
  const otherSchoolAdmin = await bootstrapAdmin(app, schoolB);
  const adminAuth = { authorization: `Bearer ${adminToken}` };
  const foreignAuth = { authorization: `Bearer ${otherSchoolAdmin}` };
  const created = await app.inject({
    method: "POST", url: "/v1/admin/users", headers: adminAuth,
    payload: { role: "TEACHER", username: "teacherphase6" }
  });
  assert.equal(created.statusCode, 201);
  const { user, temporaryPassword } = created.json<{ user: { id: string }, temporaryPassword: string }>();

  const login = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { schoolId: schoolA, expectedRole: "TEACHER", username: "teacherphase6", password: temporaryPassword }
  });
  assert.equal(login.statusCode, 200);
  const teacherTemporary = login.json<{ accessToken: string }>().accessToken;

  const readEndpoints = [
    "/v1/admin/users",
    "/v1/admin/users/directory?group=TEACHER&pageSize=20",
    "/v1/admin/users/username-check?username=teacherphase6",
    `/v1/admin/users/${user.id}/audit`
  ];
  for (const url of readEndpoints) {
    const temporary = await app.inject({
      method: "GET", url, headers: { authorization: `Bearer ${teacherTemporary}` }
    });
    assert.equal(temporary.statusCode, 403, `Temporary teacher access: ${url}`);
    const missing = await app.inject({ method: "GET", url });
    assert.equal(missing.statusCode, 401, `Unauthenticated access: ${url}`);
  }
  const changed = await app.inject({
    method: "POST", url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${teacherTemporary}` },
    payload: { newPassword: "TeacherPhase6Secure2026!" }
  });
  assert.equal(changed.statusCode, 200);
  const teacherToken = changed.json<{ accessToken: string }>().accessToken;
  for (const url of readEndpoints) {
    const denied = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${teacherToken}` } });
    assert.equal(denied.statusCode, 403, `Teacher role must not administer accounts: ${url}`);
  }
  // A staff account is not a school administrator even after completing its first login.
  const staffResponse = await app.inject({
    method: "POST", url: "/v1/admin/users", headers: adminAuth,
    payload: { role: "SCHOOL_STAFF", username: "staffphase6" }
  });
  assert.equal(staffResponse.statusCode, 201);
  const staffCredential = staffResponse.json<{ temporaryPassword: string }>();
  const staffLogin = await app.inject({
    method: "POST", url: "/v1/auth/login",
    payload: { schoolId: schoolA, expectedRole: "SCHOOL_STAFF",
      username: "staffphase6", password: staffCredential.temporaryPassword }
  });
  assert.equal(staffLogin.statusCode, 200);
  const staffInitialToken = staffLogin.json<{ accessToken: string }>().accessToken;
  const staffChanged = await app.inject({
    method: "POST", url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${staffInitialToken}` },
    payload: { newPassword: "StaffPhase6Secure2026!" }
  });
  assert.equal(staffChanged.statusCode, 200);
  const staffToken = staffChanged.json<{ accessToken: string }>().accessToken;
  for (const url of readEndpoints) {
    const denied = await app.inject({
      method: "GET", url, headers: { authorization: `Bearer ${staffToken}` }
    });
    assert.equal(denied.statusCode, 403, `Staff may not manage accounts: ${url}`);
  }
  const staffDeniedBulk = await app.inject({
    method: "POST", url: "/v1/admin/users/bulk-status",
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { action: "suspend", userIds: [user.id] }
  });
  assert.equal(staffDeniedBulk.statusCode, 403);

  const deniedBulk = await app.inject({
    method: "POST", url: "/v1/admin/users/bulk-status",
    headers: { authorization: `Bearer ${teacherToken}` },
    payload: { action: "suspend", userIds: [user.id] }
  });
  assert.equal(deniedBulk.statusCode, 403);
  const invalidBulk = await app.inject({
    method: "POST", url: "/v1/admin/users/bulk-status",
    payload: { action: "suspend", userIds: [user.id] }
  });
  assert.equal(invalidBulk.statusCode, 401);

  for (const url of ["/v1/admin/users/directory?query=teacherphase6",
    `/v1/admin/users/${user.id}/audit`]) {
    const foreign = await app.inject({ method: "GET", url, headers: foreignAuth });
    assert.equal(foreign.statusCode, url.includes("/audit") ? 404 : 200);
    if (url.includes("/directory")) {
      assert.equal(foreign.json<{ total: number }>().total, 0);
    }
  }
  const crossSchoolWrite = await app.inject({
    method: "POST", url: "/v1/admin/users/bulk-status",
    headers: foreignAuth,
    payload: { action: "suspend", userIds: [user.id] }
  });
  assert.equal(crossSchoolWrite.statusCode, 409);
});

test("Phase 6 Accounts: bulk bounds, unknown fields, escaped search and no partial writes", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolId = await provisionSchool(app, "P6-VALIDATION");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const headers = { authorization: `Bearer ${adminToken}` };

  const create = async (username: string) => {
    const res = await app.inject({ method: "POST", url: "/v1/admin/users", headers,
      payload: { role: "TEACHER", username } });
    assert.equal(res.statusCode, 201);
    return res.json<{ user: { id: string } }>().user.id;
  };
  const first = await create("phase6_teacher_one");
  const second = await create("phase6_teacher_two");
  const ids = Array.from({ length: 21 }, (_, index) =>
    `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
  const route = "/v1/admin/users/bulk-status";
  const invalid = [
    { action: "suspend", userIds: ids },
    { action: "suspend", userIds: [] },
    { action: "suspend", userIds: [first, first] },
    { action: "delete", userIds: [first] },
    { action: "reactivate", userIds: [first], reason: "Should be rejected" },
    { action: "suspend", userIds: [first], extra: "forbidden" },
    { action: "suspend", userIds: [first], reason: "xx" },
    { action: "suspend", userIds: [first], reason: "r".repeat(501) }
  ];
  for (const payload of invalid) {
    const res = await app.inject({ method: "POST", url: route, headers, payload });
    assert.equal(res.statusCode, 400, JSON.stringify(payload).slice(0, 150));
  }
  const badSearches = [
    "/v1/admin/users/directory?query=" + "q".repeat(121),
    "/v1/admin/users/directory?sortBy=passwordHash",
    "/v1/admin/users/directory?status=REMOVED",
    "/v1/admin/users/directory?pageSize=21",
    "/v1/admin/users/directory?page=0",
    "/v1/admin/users/directory?order=random"
  ];
  for (const url of badSearches) {
    const res = await app.inject({ method: "GET", url, headers });
    assert.equal(res.statusCode, 400, url);
  }
  const literal = await app.inject({ method: "GET", url: "/v1/admin/users/directory?query=%25", headers });
  assert.equal(literal.statusCode, 200);
  assert.equal(literal.json<{ total: number }>().total, 0);
  const before = await app.inject({
    method: "GET", url: "/v1/admin/users/directory?status=INVITED&pageSize=10", headers
  });
  assert.ok(before.json<{ users: Array<{ id: string }> }>().users.some(u => u.id === first));
  const mixed = await app.inject({
    method: "POST", url: route, headers, payload: { action: "suspend", userIds: [first, ids[0]] }
  });
  assert.equal(mixed.statusCode, 409);
  const after = await app.inject({
    method: "GET", url: "/v1/admin/users/directory?status=INVITED&pageSize=10", headers
  });
  assert.ok(after.json<{ users: Array<{ id: string }> }>().users.some(u => u.id === first));
  assert.ok(after.json<{ users: Array<{ id: string }> }>().users.some(u => u.id === second));
});


test("Pilot Phase 2 coverage endpoints require a school admin and validate bounded issue pagination", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });

  const schoolA = await provisionSchool(app, "PILOT-P2-A");
  const schoolB = await provisionSchool(app, "PILOT-P2-B");
  const tokenA = await bootstrapAdmin(app, schoolA);
  const tokenB = await bootstrapAdmin(app, schoolB);
  const a = { authorization: "Bearer " + tokenA };
  const b = { authorization: "Bearer " + tokenB };

  const guest = await app.inject({ method: "GET", url: "/v1/admin/pilot/readiness/advanced" });
  assert.equal(guest.statusCode, 401);

  const resultA = await app.inject({ method: "GET", url: "/v1/admin/pilot/readiness/advanced", headers: a });
  assert.equal(resultA.statusCode, 200, resultA.body);
  const readiness = resultA.json<{ ready: boolean; metrics: Array<{
    key: string; percentage: number | null; status: string; total: number
  }> }>();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.metrics.find((m) => m.key === "teaching")?.percentage, null);
  assert.equal(readiness.metrics.find((m) => m.key === "family_links")?.status, "not_applicable");

  const resultB = await app.inject({ method: "GET", url: "/v1/admin/pilot/readiness/advanced", headers: b });
  assert.equal(resultB.statusCode, 200);
  const allowed = await app.inject({
    method: "GET", url: "/v1/admin/pilot/readiness/issues?metric=teaching&limit=1&offset=0", headers: a
  });
  assert.equal(allowed.statusCode, 200, allowed.body);
  assert.deepEqual(allowed.json<{ rows: unknown[] }>().rows, []);
  assert.equal(
    (await app.inject({ method: "GET", url: "/v1/admin/pilot/readiness/issues?metric=teaching" })).statusCode,
    401
  );

  for (const params of [
    "metric=wrong", "metric=teaching&limit=51", "metric=family_links&limit=0",
    "metric=teaching&offset=-1", "metric=timetable&offset=1000001", "metric=teaching&unexpected=1"
  ]) {
    const invalid = await app.inject({
      method: "GET", url: "/v1/admin/pilot/readiness/issues?" + params, headers: a
    });
    assert.equal(invalid.statusCode, 400, params + ": " + invalid.body);
  }
  // Operational readiness is scoped to the authenticated school, and cannot
  // be used by anonymous callers or queried with arbitrary school identifiers.
  const operationalUrl = "/v1/admin/pilot/readiness/operational";
  assert.equal((await app.inject({ method: "GET", url: operationalUrl })).statusCode, 401);
  const operationalA = await app.inject({ method: "GET", url: operationalUrl, headers: a });
  const operationalB = await app.inject({ method: "GET", url: operationalUrl, headers: b });
  assert.equal(operationalA.statusCode, 200, operationalA.body);
  assert.equal(operationalB.statusCode, 200, operationalB.body);
  const opA = operationalA.json<{ evaluatedPeriods: number; ready: boolean; metrics: Array<{
    key: string; total: number; status: string;
  }> }>();
  assert.equal(opA.evaluatedPeriods, 0);
  assert.equal(opA.ready, false);
  assert.equal(opA.metrics.find((m) => m.key === "teacher_overlap")?.status, "not_applicable");

  const issuesUrl = "/v1/admin/pilot/readiness/operational/issues";
  const accepted = await app.inject({
    method: "GET", url: issuesUrl + "?metric=class_overlap&limit=10&offset=0", headers: a
  });
  assert.equal(accepted.statusCode, 200, accepted.body);
  assert.deepEqual(accepted.json<{ rows: unknown[] }>().rows, []);
  assert.equal((await app.inject({
    method: "GET", url: issuesUrl + "?metric=class_overlap"
  })).statusCode, 401);
  for (const query of [
    "metric=nope", "metric=class_overlap&limit=51", "metric=class_overlap&limit=0",
    "metric=teacher_overlap&offset=-1", "metric=invalid_period&offset=1000001",
    "metric=teacher_overlap&schoolId=" + schoolB, "metric=teacher_overlap&extra=1"
  ]) {
    const invalid = await app.inject({
      method: "GET", url: issuesUrl + "?" + query, headers: a
    });
    assert.equal(invalid.statusCode, 400, query + ": " + invalid.body);
  }
});

test("Pilot Operations Phase 8 all read-only workspaces reject parent roles and preserve suspension read access", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolId = await provisionSchool(app, "PILOT-PHASE8");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const admin = { authorization: "Bearer " + adminToken };
  const parentCreation = await app.inject({
    method: "POST", url: "/v1/admin/families/parents", headers: admin,
    payload: { username: "pilotparent8", fullName: "Pilot Parent Eight" }
  });
  assert.equal(parentCreation.statusCode, 201, parentCreation.body);
  const temporaryPassword = parentCreation.json<{ temporaryPassword: string }>().temporaryPassword;
  const parentToken = await activateRoleLogin(
    app, schoolId, "PARENT", "pilotparent8", temporaryPassword, "PilotParent2026!"
  );
  const parent = { authorization: "Bearer " + parentToken };
  const paths = [
    "/v1/admin/subscription",
    "/v1/admin/pilot/readiness",
    "/v1/admin/pilot/readiness/advanced",
    "/v1/admin/pilot/adoption?window=7d",
    "/v1/admin/pilot/service-health",
    "/v1/admin/pilot/oversight?window=30d",
    "/v1/admin/pilot/release-readiness",
    "/v1/admin/pilot/audit",
    "/v1/admin/pilot/launch",
    "/v1/admin/pilot/support"
  ];
  for (const url of paths) {
    const missing = await app.inject({ method: "GET", url });
    assert.equal(missing.statusCode, 401, url + ": unauthenticated");
    const denied = await app.inject({ method: "GET", url, headers: parent });
    assert.equal(denied.statusCode, 403, url + ": parent must not access school operations");
  }
  for (const url of [
    "/v1/admin/pilot/adoption?window=7d",
    "/v1/admin/pilot/service-health",
    "/v1/admin/pilot/oversight?window=30d",
    "/v1/admin/pilot/release-readiness"
  ]) {
    const ok = await app.inject({ method: "GET", url, headers: admin });
    assert.equal(ok.statusCode, 200, url + ": " + ok.body);
    assert.equal(ok.headers["cache-control"], "no-store", url + ": no-store");
  }
  const suspended = await app.inject({
    method: "PATCH", url: "/v1/platform/schools/" + schoolId + "/subscription",
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { status: "SUSPENDED" }
  });
  assert.equal(suspended.statusCode, 200, suspended.body);
  // A disabled subscription must not hide billing/support diagnostics.
  for (const url of ["/v1/admin/subscription", "/v1/admin/pilot/service-health",
    "/v1/admin/pilot/release-readiness", "/v1/admin/pilot/support"]) {
    const response = await app.inject({ method: "GET", url, headers: admin });
    assert.equal(response.statusCode, 200, url + ": " + response.body);
  }
  const support = await app.inject({
    method: "POST", url: "/v1/admin/pilot/support", headers: admin,
    payload: { subject: "Subscription issue", description: "Request subscription assistance",
      category: "BILLING", priority: "NORMAL" }
  });
  assert.equal(support.statusCode, 201, support.body);
});

test("Pilot refinement Phase 6 oversight timeline enforces school, filters, paging and privacy", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "OVERSIGHT-A");
  const schoolB = await provisionSchool(app, "OVERSIGHT-B");
  const a = { authorization: "Bearer " + await bootstrapAdmin(app, schoolA) };
  const b = { authorization: "Bearer " + await bootstrapAdmin(app, schoolB) };
  const endpoint = "/v1/admin/pilot/oversight";
  assert.equal((await app.inject({ method: "GET", url: endpoint })).statusCode, 401);
  for (const query of [
    "kind=UNKNOWN", "window=today", "limit=31", "limit=0",
    "offset=-1", "offset=999999", "schoolId=" + schoolB
  ]) {
    const response = await app.inject({ method: "GET", url: endpoint + "?" + query, headers: a });
    assert.equal(response.statusCode, 400, query + ": " + response.body);
  }

  const now = Date.now();
  const recent = new Date(now - 24 * 60 * 60_000).toISOString();
  const days10 = new Date(now - 10 * 86_400_000).toISOString();
  const days100 = new Date(now - 100 * 86_400_000).toISOString();
  const ids = (n: number) => "20000000-0000-4000-8000-" + String(n).padStart(12, "0");

  const ticketA = await app.inject({
    method: "POST", url: "/v1/admin/pilot/support", headers: a,
    payload: { subject: "Private support issue", description: "Highly confidential private note",
      category: "TECHNICAL", priority: "NORMAL" }
  });
  assert.equal(ticketA.statusCode, 201, ticketA.body);
  const ticketB = await app.inject({
    method: "POST", url: "/v1/admin/pilot/support", headers: b,
    payload: { subject: "Another school issue", description: "Other school private note",
      category: "TECHNICAL", priority: "HIGH" }
  });
  assert.equal(ticketB.statusCode, 201, ticketB.body);

  await client.query(`INSERT INTO audit_logs(id,school_id,action,entity_type,metadata,created_at)
    VALUES ($1,$2,'pilot.evidence_submitted','pilot_launch_evidence',
      '{"passwordHash":"never-expose-passwords"}',$3),
      ($4,$2,'pilot.exported','school', '{"private":"never-expose-exports"}',$3),
      ($5,$6,'pilot.evidence_reviewed','pilot_launch_evidence','{}',$3)`,
    [ids(6001),schoolA,recent,ids(6002),ids(6003),schoolB]);
  await client.query(`INSERT INTO pilot_launch_decision_history
    (id,school_id,status,operator_label,note,created_at)
    VALUES ($1,$2,'NOT_APPROVED','operator','private operator comment',$3)`,
    [ids(6004),schoolA,recent]);
  await client.query(`INSERT INTO family_import_batches
    (id,school_id,idempotency_key,entity_type,row_count,status,reason,created_at)
    VALUES ($1,$2,$3,'PARENT',1,'FAILED','confidential error',$4),
      ($5,$2,$6,'PARENT',1,'REJECTED','old confidential error',$7),
      ($8,$9,$10,'PARENT',1,'COMPLETED','private other school',$4)`,
    [ids(6005),schoolA,ids(6006),days10,ids(6007),ids(6008),days100,
      ids(6009),schoolB,ids(6010)]);

  const recentResponse = await app.inject({ method: "GET",
    url: endpoint + "?window=7d", headers: a });
  assert.equal(recentResponse.statusCode, 200, recentResponse.body);
  assert.equal(recentResponse.headers["cache-control"], "no-store");
  const recentPage = recentResponse.json<{
    events: Array<{ id: string; kind: string; action: string; occurredAt: string }>;
    limit: number; offset: number; hasMore: boolean; window: string;
    timeZone: string; startAt: string; endAt: string;
  }>();
  assert.equal(recentPage.window, "7d");
  assert.equal(recentPage.timeZone, "Asia/Kabul");
  assert.equal(recentPage.events.some((event) => event.kind === "SUPPORT"), true);
  assert.equal(recentPage.events.some((event) => event.action === "EVIDENCE_SUBMITTED"), true);
  assert.equal(recentPage.events.some((event) => event.action === "PILOT_NOT_APPROVED"), true);
  assert.equal(recentPage.events.some((event) => event.action === "SCHOOL_DATA_EXPORTED"), true);
  assert.equal(recentPage.events.some((event) => event.kind === "IMPORT"), false);
  assert.equal(recentPage.events.some((event) => event.id === ids(6003)), false);
  assert.equal(recentResponse.body.includes("never-expose-passwords"), false);
  assert.equal(recentResponse.body.includes("Highly confidential"), false);
  assert.equal(recentResponse.body.includes("private operator"), false);
  assert.equal(recentResponse.body.includes("operatorLabel"), false);
  assert.equal(recentResponse.body.includes("actorUserId"), false);
  assert.equal(recentPage.events.every((event, index, all) =>
    index === 0 || Date.parse(all[index - 1]!.occurredAt) >= Date.parse(event.occurredAt)), true);

  const imports = await app.inject({ method: "GET", headers: a,
    url: endpoint + "?window=30d&kind=IMPORT" });
  assert.equal(imports.statusCode, 200, imports.body);
  const importEvents = imports.json<typeof recentPage>().events;
  assert.deepEqual(importEvents.map((event) => event.action), ["IMPORT_FAILED"]);
  assert.deepEqual(importEvents.map((event) => event.id), [ids(6005)]);

  const other = await app.inject({ method: "GET", headers: b,
    url: endpoint + "?window=30d&kind=IMPORT" });
  assert.deepEqual(other.json<typeof recentPage>().events.map((event) => event.id),
    [ids(6009)], "School B must receive only B's import activity");

  const evidence = await app.inject({ method: "GET", headers: a,
    url: endpoint + "?window=7d&kind=EVIDENCE" });
  assert.deepEqual(evidence.json<typeof recentPage>().events.map((event) => event.action),
    ["EVIDENCE_SUBMITTED"]);

  const first = await app.inject({ method: "GET", headers: a,
    url: endpoint + "?window=30d&limit=1&offset=0" });
  const firstPage = first.json<typeof recentPage>();
  assert.equal(firstPage.events.length, 1);
  assert.equal(firstPage.hasMore, true);
  const second = await app.inject({ method: "GET", headers: a,
    url: endpoint + "?window=30d&limit=1&offset=1" });
  const secondPage = second.json<typeof recentPage>();
  assert.equal(secondPage.events.length, 1);
  assert.notEqual(firstPage.events[0]?.id, secondPage.events[0]?.id);

  const release = await app.inject({ method: "GET", url: "/v1/admin/pilot/release-readiness", headers: a });
  assert.equal(release.statusCode, 200, release.body);
  assert.equal(release.json<{productionDecision:string}>().productionDecision, "NO_GO");
});

test("Pilot refinement Phase 5 school service checks are isolated and advisory", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "PILOT-SERVICE-A");
  const schoolB = await provisionSchool(app, "PILOT-SERVICE-B");
  const a = { authorization: "Bearer " + await bootstrapAdmin(app, schoolA) };
  const b = { authorization: "Bearer " + await bootstrapAdmin(app, schoolB) };
  const uri = "/v1/admin/pilot/service-health";

  assert.equal((await app.inject({ method: "GET", url: uri })).statusCode, 401);
  assert.equal((await app.inject({
    method: "GET", url: uri + "?schoolId=" + schoolB, headers: a
  })).statusCode, 400, "Report must reject caller-supplied school scope");

  const aUser = (await client.query<{ id: string }>(
    "SELECT id FROM users WHERE school_id=$1 AND role='SCHOOL_ADMIN' LIMIT 1", [schoolA]
  )).rows[0]?.id;
  assert.ok(aUser);

  const now = Date.now();
  const beforeTwoHours = new Date(now - 2 * 60 * 60_000).toISOString();
  const current = new Date(now - 4 * 60_000).toISOString();
  const recentWeek = new Date(now - 2 * 86_400_000).toISOString();

  await client.query(`INSERT INTO notifications(id,school_id,user_id,type,title,message,
    dedup_key,delivery_status,created_at) VALUES
    ('20000000-0000-4000-8000-000000000051',$1,$2,'REMINDER','test','test','phase5-pending','PENDING',$3),
    ('20000000-0000-4000-8000-000000000052',$1,$2,'REMINDER','test','test','phase5-failed','FAILED',$4)`,
    [schoolA,aUser,beforeTwoHours,current]);
  await client.query(`INSERT INTO pilot_support_tickets
    (id,school_id,subject,description,category,priority,status) VALUES
    ('20000000-0000-4000-8000-000000000053',$1,'Service issue','Needs platform review','TECHNICAL','CRITICAL','OPEN'),
    ('20000000-0000-4000-8000-000000000054',$1,'Resolved','Completed issue','TECHNICAL','CRITICAL','RESOLVED')`,
    [schoolA]);
  await client.query(`INSERT INTO family_import_batches
    (id,school_id,idempotency_key,entity_type,row_count,status,created_at) VALUES
    ('20000000-0000-4000-8000-000000000055',$1,
     '20000000-0000-4000-8000-000000000056','PARENT',1,'FAILED',$2)`,
    [schoolA,recentWeek]);

  const snapshot = await app.inject({ method: "GET", url: uri, headers: a });
  assert.equal(snapshot.statusCode, 200, snapshot.body);
  assert.equal(snapshot.headers["cache-control"], "no-store");
  const first = snapshot.json<{
    report: {
      api: string; database: string; notificationQueue: {
        pending: number; stalePending: number; failed: number; status: string;
      };
      support: { unresolved: number; unresolvedCritical: number; status: string };
      imports: { failedLast7Days: number }; unverified: string[];
    };
    subscription: { status: string };
  }>();
  assert.equal(first.report.api, "responding");
  assert.equal(first.report.database, "query_succeeded");
  assert.deepEqual([first.report.notificationQueue.pending,
    first.report.notificationQueue.stalePending,
    first.report.notificationQueue.failed], [1, 1, 1]);
  assert.deepEqual([first.report.support.unresolved,
    first.report.support.unresolvedCritical], [1,1]);
  assert.equal(first.report.imports.failedLast7Days, 1);
  assert.equal(first.report.notificationQueue.status, "attention");
  assert.equal(first.report.support.status, "attention");
  assert.equal(first.report.unverified.includes("push_delivery"), true);
  assert.equal(first.subscription.status, "TRIAL");
  assert.equal(snapshot.body.includes("Needs platform review"), false,
    "Ticket content must not leak into service reports");

  const other = await app.inject({ method: "GET", url: uri, headers: b });
  assert.equal(other.statusCode, 200, other.body);
  const second = other.json<typeof first>();
  assert.equal(second.report.notificationQueue.pending, 0);
  assert.equal(second.report.notificationQueue.failed, 0);
  assert.equal(second.report.support.unresolvedCritical, 0);
  assert.equal(second.report.imports.failedLast7Days, 0);
});

test("Pilot refinement Phase 4 usage reporting is school-scoped and validates period", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "PILOT-ADOPTION-A");
  const schoolB = await provisionSchool(app, "PILOT-ADOPTION-B");
  const a = { authorization: "Bearer " + await bootstrapAdmin(app, schoolA) };
  const b = { authorization: "Bearer " + await bootstrapAdmin(app, schoolB) };
  const route = "/v1/admin/pilot/adoption";
  assert.equal((await app.inject({ method: "GET", url: route })).statusCode, 401);
  const response = await app.inject({ method: "GET", url: route + "?window=7d", headers: a });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers["cache-control"], "no-store");
  const report = response.json<{ window: string; timeZone: string;
    roles: Array<{role: string; eligible: number; signedInPercent: number | null}>;
    activities: { homeworkPublished: number; attendanceClassDays: number };
  }>();
  assert.equal(report.window, "7d");
  assert.equal(report.timeZone, "Asia/Kabul");
  assert.deepEqual(report.roles.map((metric) => metric.role), ["TEACHER", "PARENT", "STUDENT"]);
  assert.equal(report.roles.every((metric) => metric.eligible === 0 && metric.signedInPercent === null), true);
  assert.equal(report.activities.homeworkPublished, 0);
  const other = await app.inject({ method: "GET", url: route + "?window=30d", headers: b });
  assert.equal(other.statusCode, 200, other.body);
  assert.equal(other.json<{ activities: {attendanceClassDays: number} }>().activities.attendanceClassDays, 0);
  for (const query of ["window=wrong", "window=7d&schoolId=" + schoolB,
    "window=30d&limit=100", "unexpected=1"]) {
    const invalid = await app.inject({ method: "GET", url: route + "?" + query, headers: a });
    assert.equal(invalid.statusCode, 400, invalid.body);
  }
});

test("Pilot Phase 3 school import history, replay protection and rejected validation stay tenant-scoped", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });

  const first = await provisionSchool(app, "IMPORT-HISTORY-A");
  const second = await provisionSchool(app, "IMPORT-HISTORY-B");
  const firstAuth = { authorization: "Bearer " + await bootstrapAdmin(app, first) };
  const secondAuth = { authorization: "Bearer " + await bootstrapAdmin(app, second) };
  const key = "3b3561d2-1f5c-4cda-949b-6459f3145b30";
  const payload = {
    idempotencyKey: key,
    entityType: "PARENT",
    rows: [{ username: "pilotparent2026", fullName: "Pilot Parent", phone: "0700111222" }]
  };
  const route = "/v1/admin/families/import/commit";
  const initial = await app.inject({ method: "POST", url: route, headers: firstAuth, payload });
  assert.equal(initial.statusCode, 201, initial.body);
  const firstBody = initial.json<{
    importedCount: number; alreadyCommitted: boolean;
    credentials: Array<{ username: string; temporaryPassword: string }>
  }>();
  assert.equal(firstBody.importedCount, 1);
  assert.equal(firstBody.alreadyCommitted, false);
  assert.equal(firstBody.credentials.length, 1);
  assert.ok(firstBody.credentials[0]?.temporaryPassword);

  const replay = await app.inject({ method: "POST", url: route, headers: firstAuth, payload });
  assert.equal(replay.statusCode, 200, replay.body);
  const replayBody = replay.json<{
    importedCount: number; credentials: unknown[]; alreadyCommitted: boolean;
    requiresCredentialReset: boolean
  }>();
  assert.equal(replayBody.importedCount, 1);
  assert.equal(replayBody.alreadyCommitted, true);
  assert.equal(replayBody.requiresCredentialReset, true);
  assert.deepEqual(replayBody.credentials, []);
  assert.equal(replay.body.includes(firstBody.credentials[0]!.temporaryPassword), false);

  const conflicting = await app.inject({
    method: "POST", url: route, headers: firstAuth,
    payload: { ...payload, rows: [{ ...payload.rows[0], fullName: "Changed Parent" }] }
  });
  assert.equal(conflicting.statusCode, 409);
  assert.equal(conflicting.json<{ error: string }>().error, "import_key_conflict");

  const validation = await app.inject({
    method: "POST", url: "/v1/admin/families/import/validate", headers: firstAuth,
    payload: {
      entityType: "PARENT",
      rows: [{ username: "pilotparent2026", fullName: "Pilot Parent" }],
      mapping: { username: "username", fullName: "fullName" }
    }
  });
  assert.equal(validation.statusCode, 200, validation.body);
  assert.equal(validation.json<{ valid: boolean }>().valid, false);

  const historyUrl = "/v1/admin/families/import/history?limit=20&offset=0";
  const history = await app.inject({ method: "GET", url: historyUrl, headers: firstAuth });
  assert.equal(history.statusCode, 200, history.body);
  const historyBody = history.json<{
    rows: Array<{ status: string; entityType: string; importedCount: number; rejectedCount: number }>;
    hasMore: boolean
  }>();
  assert.equal(historyBody.rows.filter(row => row.status === "COMPLETED").length, 1);
  assert.equal(historyBody.rows.filter(row => row.status === "REJECTED").length, 1);
  assert.equal(historyBody.rows.find(row => row.status === "COMPLETED")?.importedCount, 1);
  assert.equal(historyBody.rows.find(row => row.status === "REJECTED")?.rejectedCount, 1);
  assert.equal(history.body.includes("temporaryPassword"), false);
  assert.equal(history.body.includes("fingerprint"), false);
  assert.equal(history.body.includes("passwordHash"), false);
  assert.equal(history.body.includes("0700111222"), false);

  const historyPage1 = await app.inject({
    method: "GET", url: "/v1/admin/families/import/history?limit=1&offset=0", headers: firstAuth
  });
  assert.equal(historyPage1.statusCode, 200);
  assert.equal(historyPage1.json<{ rows: unknown[]; hasMore: boolean }>().rows.length, 1);
  assert.equal(historyPage1.json<{ hasMore: boolean }>().hasMore, true);
  const historyPage2 = await app.inject({
    method: "GET", url: "/v1/admin/families/import/history?limit=1&offset=1", headers: firstAuth
  });
  assert.equal(historyPage2.statusCode, 200);
  assert.equal(historyPage2.json<{ rows: unknown[]; hasMore: boolean }>().rows.length, 1);
  assert.equal(historyPage2.json<{ hasMore: boolean }>().hasMore, false);
  const filtered = await app.inject({
    method: "GET", url: "/v1/admin/families/import/history?entityType=TEACHER", headers: firstAuth
  });
  assert.deepEqual(filtered.json<{ rows: unknown[] }>().rows, []);

  // Pilot Operations Data Onboarding refinement: server-side filters must work
  // BEFORE pagination, be school-scoped and disclose no password material.
  const completedOnly = await app.inject({
    method: "GET", url: historyUrl + "&status=COMPLETED", headers: firstAuth
  });
  assert.equal(completedOnly.statusCode, 200, completedOnly.body);
  assert.equal(completedOnly.json<{ rows: Array<{ status: string }> }>().rows.length, 1);
  assert.equal(completedOnly.json<{ rows: Array<{ status: string }> }>().rows[0]?.status, "COMPLETED");
  const failedOnly = await app.inject({
    method: "GET", url: historyUrl + "&status=FAILED", headers: firstAuth
  });
  assert.deepEqual(failedOnly.json<{ rows: unknown[] }>().rows, []);

  const createdBy = history.json<{ rows: Array<{ actorUsername: string | null }> }>()
    .rows.find((row) => row.actorUsername)?.actorUsername;
  assert.ok(createdBy, "Expected an actor for a school-admin import");
  const actorOnly = await app.inject({
    method: "GET", url: historyUrl + "&actor=" + encodeURIComponent(createdBy),
    headers: firstAuth
  });
  assert.equal(actorOnly.statusCode, 200, actorOnly.body);
  assert.equal(actorOnly.json<{ rows: unknown[] }>().rows.length, 2);
  const mismatchedActor = await app.inject({
    method: "GET", url: historyUrl + "&actor=nobody_matches_this_actor",
    headers: firstAuth
  });
  assert.deepEqual(mismatchedActor.json<{ rows: unknown[] }>().rows, []);
  const historicalDates = await app.inject({
    method: "GET", url: historyUrl + "&dateFrom=2000-01-01&dateTo=2000-12-31",
    headers: firstAuth
  });
  assert.deepEqual(historicalDates.json<{ rows: unknown[] }>().rows, []);
  const inclusiveRange = await app.inject({
    method: "GET", url: historyUrl + "&dateFrom=2000-01-01&dateTo=2099-12-31",
    headers: firstAuth
  });
  assert.equal(inclusiveRange.json<{ rows: unknown[] }>().rows.length, 2);
  assert.equal(inclusiveRange.headers["cache-control"], "no-store");

  for (const invalid of [
    "status=OTHER", "actor=x", "actor=" + "a".repeat(65),
    "dateFrom=2026-02-30", "dateTo=2026-13-01",
    "dateFrom=2026-10-20&dateTo=2026-10-01"
  ]) {
    const response = await app.inject({
      method: "GET", url: historyUrl + "&" + invalid, headers: firstAuth
    });
    assert.equal(response.statusCode, 400, invalid + ": " + response.body);
  }

  const otherSchool = await app.inject({ method: "GET", url: historyUrl, headers: secondAuth });
  assert.equal(otherSchool.statusCode, 200);
  assert.deepEqual(otherSchool.json<{ rows: unknown[] }>().rows, []);
  const noAuth = await app.inject({ method: "GET", url: historyUrl });
  assert.equal(noAuth.statusCode, 401);
  for (const invalid of ["limit=0", "limit=51", "offset=-1", "entityType=OTHER", "unexpected=true"]) {
    const response = await app.inject({
      method: "GET", url: "/v1/admin/families/import/history?" + invalid, headers: firstAuth
    });
    assert.equal(response.statusCode, 400, invalid);
  }

  // Same key in a different school is independent; history/credentials never cross tenants.
  const inOtherSchool = await app.inject({ method: "POST", url: route, headers: secondAuth, payload });
  assert.equal(inOtherSchool.statusCode, 201, inOtherSchool.body);
  const after = await app.inject({ method: "GET", url: historyUrl, headers: secondAuth });
  assert.equal(after.json<{ rows: unknown[] }>().rows.length, 1);
});

test("Pilot Phase 4 filters, exports and safe metadata stay school scoped", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });

  const schoolA = await provisionSchool(app, "AUDIT-PH4-A");
  const schoolB = await provisionSchool(app, "AUDIT-PH4-B");
  const a = { authorization: "Bearer " + await bootstrapAdmin(app, schoolA) };
  const b = { authorization: "Bearer " + await bootstrapAdmin(app, schoolB) };

  const actorA = (await client.query<{ id: string }>(
    "SELECT id FROM users WHERE school_id = $1 AND role = 'SCHOOL_ADMIN' LIMIT 1", [schoolA]
  )).rows[0]!.id;
  const actorB = (await client.query<{ id: string }>(
    "SELECT id FROM users WHERE school_id = $1 AND role = 'SCHOOL_ADMIN' LIMIT 1", [schoolB]
  )).rows[0]!.id;
  const secret = "DO-NOT-LEAK-AUDIT-SECRET";
  await client.query(
    `INSERT INTO audit_logs(id,school_id,actor_user_id,action,entity_type,entity_id,metadata,created_at)
     VALUES ('4f11fbea-9970-4461-bd9b-c9ed17493631',$1,$2,'user.suspended','user',$2,$3::jsonb,'2026-10-14T12:00:00Z'),
            ('4f11fbea-9970-4461-bd9b-c9ed17493632',$4,$5,'user.reactivated','user',$5,$6::jsonb,'2026-10-14T12:00:00Z')`,
    [schoolA, actorA,
      JSON.stringify({ reason:"=SUM(1+1)", authToken:secret, phone:"0700000000", nested:{ secret } }),
      schoolB, actorB, JSON.stringify({ authToken: secret })]
  );

  assert.equal((await app.inject({ method:"GET", url:"/v1/admin/pilot/audit" })).statusCode,401);
  const query = "/v1/admin/pilot/audit?category=accounts&search=suspended&dateFrom=2026-10-14&dateTo=2026-10-14&limit=20";
  const response = await app.inject({ method:"GET", url:query, headers:a });
  assert.equal(response.statusCode,200,response.body);
  const body=response.json<{logs:Array<{
    action:string;category:string;metadata:Record<string,unknown>;
    actorUsername:string|null;targetLabel:string|null
  }> }>();
  assert.equal(body.logs.length,1,response.body);
  assert.equal(body.logs[0]?.action,"user.suspended");
  assert.equal(body.logs[0]?.category,"accounts");
  assert.equal(body.logs[0]?.metadata.reason,"=SUM(1+1)");
  assert.ok(body.logs[0]?.actorUsername);
  assert.ok(body.logs[0]?.targetLabel);
  assert.equal(response.body.includes(secret),false);
  assert.equal(response.body.includes("0700000000"),false);

  for(const invalid of [
    "category=secret", "offset=-1", "limit=101", "actorUserId=invalid",
    "dateFrom=2026-02-30", "dateFrom=2026-10-16&dateTo=2026-10-14",
    "search=x", "search=ok&unexpected=1"
  ]) {
    const failed=await app.inject({method:"GET",url:"/v1/admin/pilot/audit?"+invalid,headers:a});
    assert.equal(failed.statusCode,400,failed.body);
  }
  const filteredB=await app.inject({method:"GET",url:query,headers:b});
  assert.equal(filteredB.statusCode,200);
  assert.equal(filteredB.json<{logs:unknown[]}>().logs.length,0);

  const csv=await app.inject({method:"GET",url:"/v1/admin/pilot/audit/export?search=suspended",headers:a});
  assert.equal(csv.statusCode,200,csv.body);
  assert.match(csv.headers["content-type"] as string,/text\/csv/);
  assert.match(csv.body,/user\.suspended/);
  assert.match(csv.body,/'=SUM\(1\+1\)/,"CSV formulas must be inert");
  assert.equal(csv.body.includes(secret),false);

  const exported=await app.inject({method:"GET",url:"/v1/admin/pilot/export",headers:a});
  assert.equal(exported.statusCode,200,exported.body);
  assert.equal(exported.headers["cache-control"],"no-store");
  assert.equal(exported.body.includes(secret),false);
  assert.equal(exported.body.includes("0700000000"),false);
  assert.equal(exported.body.includes("passwordHash"),false);

  const legacy=await app.inject({method:"GET",url:"/v1/admin/audit?limit=100",headers:a});
  assert.equal(legacy.statusCode,200);
  assert.equal(legacy.body.includes(secret),false);
  const audited=await client.query<{action:string;actor_user_id:string|null}>(
    "SELECT action, actor_user_id FROM audit_logs WHERE school_id=$1 AND action IN ('pilot.exported','pilot.audit_exported') ORDER BY created_at",
    [schoolA]
  );
  assert.deepEqual(audited.rows.map(x=>x.action).sort(),["pilot.audit_exported","pilot.exported"]);
  assert.ok(audited.rows.every(x=>x.actor_user_id===actorA));
  const other=await app.inject({method:"GET",url:"/v1/admin/pilot/export",headers:b});
  assert.equal(other.statusCode,200);
  assert.equal(other.body.includes("user.suspended"),false);
  assert.equal(other.body.includes(schoolA),false);
});

test("Pilot Phase 5 subscription health is read-only, school-scoped and matches platform subscription status", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });

  const a = await provisionSchool(app, "PILOT-SUB-5-A");
  const b = await provisionSchool(app, "PILOT-SUB-5-B");
  const tokenA = await bootstrapAdmin(app, a);
  const tokenB = await bootstrapAdmin(app, b);
  const headersA = { authorization: `Bearer ${tokenA}` };
  const headersB = { authorization: `Bearer ${tokenB}` };
  const url = "/v1/admin/pilot/subscription/health";
  assert.equal((await app.inject({ method: "GET", url })).statusCode, 401);

  const before = await app.inject({ method: "GET", url, headers: headersA });
  assert.equal(before.statusCode, 200, before.body);
  assert.equal(before.headers["cache-control"], "no-store");
  assert.ok(before.json<{ health: { evaluatedOn: string } }>().health.evaluatedOn);
  assert.equal(before.body.includes("supportNotes"), false);
  assert.equal(before.body.includes("priceAfn"), false);
  assert.equal(before.body.includes("schoolId"), false);

  const dateInTwoDays = new Date(Date.parse(
    before.json<{ health: { evaluatedOn: string } }>().health.evaluatedOn + "T00:00:00Z") + 2 * 86_400_000
  ).toISOString().slice(0, 10);
  const update = await app.inject({
    method: "PATCH", url: `/v1/platform/schools/${a}/subscription`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { status: "ACTIVE", expiresOn: dateInTwoDays }
  });
  assert.equal(update.statusCode, 200, update.body);
  const healthA = await app.inject({ method: "GET", url, headers: headersA });
  assert.equal(healthA.statusCode, 200, healthA.body);
  const snapshot = healthA.json<{ health: { code: string; daysUntilExpiry: number;
    operationalWritesBlocked: boolean; nextReminderDays: number | null } }>().health;
  assert.equal(snapshot.code, "EXPIRES_SOON");
  assert.equal(snapshot.daysUntilExpiry, 2);
  assert.equal(snapshot.operationalWritesBlocked, false);
  assert.equal(snapshot.nextReminderDays, 1);

  const healthB = await app.inject({ method: "GET", url, headers: headersB });
  assert.equal(healthB.statusCode, 200);
  assert.notEqual(healthB.json<{ health: { daysUntilExpiry: number } }>().health.daysUntilExpiry, 2);

  const suspend = await app.inject({
    method: "PATCH", url: `/v1/platform/schools/${a}/subscription`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { status: "SUSPENDED" }
  });
  assert.equal(suspend.statusCode, 200, suspend.body);
  const blocked = await app.inject({ method: "GET", url, headers: headersA });
  assert.equal(blocked.statusCode, 200);
  assert.equal(blocked.json<{ health: { operationalWritesBlocked: boolean } }>().health.operationalWritesBlocked, true);

  const unchanged = await app.inject({ method: "GET", url: "/v1/admin/subscription", headers: headersA });
  assert.equal(unchanged.statusCode, 200);
  assert.equal(unchanged.json<{ subscription: { status: string } }>().subscription.status, "SUSPENDED");
  // Health endpoint must never modify the stored subscription.
  assert.equal((await client.query<{ status: string }>(
    "SELECT status FROM subscriptions WHERE school_id=$1", [a]
  )).rows[0]?.status, "SUSPENDED");
});

test("Pilot Phase 6 launch evidence requires operator verification, blocks premature approval and scopes schools", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "PHASE6-A");
  const schoolB = await provisionSchool(app, "PHASE6-B");
  const adminA = { authorization: `Bearer ${await bootstrapAdmin(app, schoolA)}` };
  const adminB = { authorization: `Bearer ${await bootstrapAdmin(app, schoolB)}` };
  const platform = { "x-platform-provisioning-key": provisioningKey };
  const schoolLaunchUrl = "/v1/admin/pilot/launch";
  const operatorBase = `/v1/platform/pilot/schools/${schoolA}`;

  assert.equal((await app.inject({ method:"GET", url:schoolLaunchUrl })).statusCode, 401);
  assert.equal((await app.inject({ method:"GET", url:operatorBase+"/launch", headers:adminA })).statusCode, 401);
  assert.equal((await app.inject({ method:"PUT", url:schoolLaunchUrl+"/evidence",
    headers:adminA, payload:{category:"DATABASE",reference:"x",note:"short"} })).statusCode, 400);

  const created = await app.inject({
    method:"PUT",url:schoolLaunchUrl+"/evidence",headers:adminA,
    payload:{category:"DATABASE",reference:"internal-report-2026-10",note:"Neon staging migration check saved in operator vault"}
  });
  assert.equal(created.statusCode, 200,created.body);
  assert.equal(created.json<{evidence:{status:string}}>().evidence.status,"SUBMITTED");
  const sameSchool = await app.inject({method:"GET",url:schoolLaunchUrl,headers:adminA});
  assert.equal(sameSchool.statusCode,200);
  assert.equal(sameSchool.json<{verifiedCount:number;evidence:unknown[]}>().verifiedCount,0);
  assert.equal(sameSchool.json<{verifiedCount:number;evidence:unknown[]}>().evidence.length,1);
  const foreign = await app.inject({method:"GET",url:schoolLaunchUrl,headers:adminB});
  assert.equal(foreign.statusCode,200);
  assert.equal(foreign.json<{evidence:unknown[]}>().evidence.length,0);

  const premature = await app.inject({
    method:"POST",url:operatorBase+"/launch/decision",headers:platform,
    payload:{status:"APPROVED",operatorLabel:"Ops reviewer",note:"Attempt before verified release checks"}
  });
  assert.equal(premature.statusCode,409,premature.body);
  const wrongMethod = await app.inject({method:"PATCH",url:operatorBase+"/evidence/DATABASE",headers:adminA,
    payload:{status:"VERIFIED",operatorLabel:"not operator",note:"Fake approval attempted"}});
  assert.equal(wrongMethod.statusCode,401);

  const verified = await app.inject({
    method:"PATCH",url:operatorBase+"/evidence/DATABASE",headers:platform,
    payload:{status:"VERIFIED",operatorLabel:"Ops reviewer",note:"Reviewed evidence in operator evidence storage"}
  });
  assert.equal(verified.statusCode,200,verified.body);
  assert.equal(verified.json<{evidence:{status:string}}>().evidence.status,"VERIFIED");

  const resubmit = await app.inject({
    method:"PUT",url:schoolLaunchUrl+"/evidence",headers:adminA,
    payload:{category:"DATABASE",reference:"internal-report-updated",note:"Replaced with newer database evidence reference"}
  });
  assert.equal(resubmit.statusCode,200,resubmit.body);
  assert.equal(resubmit.json<{evidence:{status:string;reviewedAt:string|null}}>().evidence.status,"SUBMITTED");
  assert.equal(resubmit.json<{evidence:{status:string;reviewedAt:string|null}}>().evidence.reviewedAt,null);
  const again = await app.inject({method:"GET",url:schoolLaunchUrl,headers:adminA});
  assert.equal(again.json<{verifiedCount:number}>().verifiedCount,0);

  const rejection = await app.inject({
    method:"PATCH",url:operatorBase+"/evidence/DATABASE",headers:platform,
    payload:{status:"REJECTED",operatorLabel:"Ops reviewer",note:"Database connectivity evidence is incomplete"}
  });
  assert.equal(rejection.statusCode,200,rejection.body);
  assert.equal(rejection.json<{evidence:{status:string}}>().evidence.status,"REJECTED");
  assert.equal((await client.query<{count:string}>("SELECT count(*)::text AS count FROM pilot_launch_evidence WHERE school_id=$1",
    [schoolA])).rows[0]?.count,"1");
});

test("Pilot Phase 6 school support tickets have school-only threads, privileged triage, pagination and suspended write exception", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "PHASE6-SUP-A");
  const schoolB = await provisionSchool(app, "PHASE6-SUP-B");
  const adminA = { authorization: `Bearer ${await bootstrapAdmin(app, schoolA)}` };
  const adminB = { authorization: `Bearer ${await bootstrapAdmin(app, schoolB)}` };
  const platform = { "x-platform-provisioning-key": provisioningKey };
  const base = "/v1/admin/pilot/support";
  const request = await app.inject({method:"POST",url:base,headers:adminA,
    payload:{subject:"Push notifications delayed",description:"Mobile pilot message delivery fails repeatedly",
      category:"TECHNICAL",priority:"CRITICAL"}});
  assert.equal(request.statusCode,201,request.body);
  const id=request.json<{ticket:{id:string}}>().ticket.id;
  assert.equal((await app.inject({method:"GET",url:base+"?limit=0",headers:adminA})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:base+"/"+id,headers:adminB})).statusCode,404);
  assert.equal((await app.inject({method:"POST",url:base+"/"+id+"/replies",headers:adminB,
    payload:{note:"Other school should not be able to reply."}})).statusCode,404);
  const scoped=await app.inject({method:"GET",url:base,headers:adminB});
  assert.equal(scoped.statusCode,200);
  assert.equal(scoped.json<{tickets:unknown[]}>().tickets.length,0);

  const operatorBase=`/v1/platform/pilot/schools/${schoolA}/support/${id}`;
  assert.equal((await app.inject({method:"PATCH",url:operatorBase,headers:adminA,
    payload:{status:"RESOLVED",operatorLabel:"Not platform",note:"Attempt unauthorized update"}})).statusCode,401);
  const updated=await app.inject({method:"PATCH",url:operatorBase,headers:platform,
    payload:{status:"IN_PROGRESS",operatorLabel:"Support operator",note:"Investigating Expo delivery and job logs"}});
  assert.equal(updated.statusCode,200,updated.body);

  const reply=await app.inject({method:"POST",url:base+"/"+id+"/replies",headers:adminA,
    payload:{note:"Thank you; app screenshots are stored in our private ticket system."}});
  assert.equal(reply.statusCode,200,reply.body);
  const thread=await app.inject({method:"GET",url:base+"/"+id,headers:adminA});
  assert.equal(thread.statusCode,200);
  assert.equal(thread.json<{updates:unknown[]}>().updates.length,3);
  assert.equal(thread.json<{ticket:{status:string}}>().ticket.status,"IN_PROGRESS");
  const closure=await app.inject({method:"PATCH",url:operatorBase,headers:platform,
    payload:{status:"CLOSED",operatorLabel:"Support operator",note:"Operator closed this ticket after triage"}});
  assert.equal(closure.statusCode,200);
  assert.equal((await app.inject({method:"POST",url:base+"/"+id+"/replies",headers:adminA,
    payload:{note:"Another reply attempted"}})).statusCode,409);

  const suspended=await app.inject({method:"PATCH",url:`/v1/platform/schools/${schoolA}/subscription`,
    headers:platform,payload:{status:"SUSPENDED"}});
  assert.equal(suspended.statusCode,200);
  const more=await app.inject({method:"POST",url:base,headers:adminA,
    payload:{subject:"Subscription help needed",description:"School billing requires platform assistance",
      category:"BILLING",priority:"NORMAL"}});
  assert.equal(more.statusCode,201,more.body);
  const list=await app.inject({method:"GET",url:base+"?limit=1&offset=0",headers:adminA});
  assert.equal(list.statusCode,200);
  assert.equal(list.json<{tickets:unknown[];hasMore:boolean}>().tickets.length,1);
  assert.equal(list.json<{tickets:unknown[];hasMore:boolean}>().hasMore,true);
  assert.equal((await app.inject({method:"PUT",url:"/v1/admin/pilot/launch/evidence",headers:adminA,
    payload:{category:"CROSS_ROLE",reference:"evidence-reference-001",
      note:"Attempted after suspended status to verify blocked operational writes"}})).statusCode,403);

  assert.equal((await client.query<{count:string}>(
    "SELECT count(*)::text AS count FROM pilot_support_tickets WHERE school_id=$1",[schoolA]
  )).rows[0]?.count,"2");
});

test("Pilot Phase 6 verified evidence enables explicit platform decision and later school changes revoke it", async (t) => {
  const { app, client, pilotLaunchStore } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolId = await provisionSchool(app, "PHASE6-GATE");
  const admin = { authorization: `Bearer ${await bootstrapAdmin(app, schoolId)}` };
  const platform = { "x-platform-provisioning-key": provisioningKey };
  const schoolUrl = "/v1/admin/pilot/launch";
  const platformBase = `/v1/platform/pilot/schools/${schoolId}`;
  const categories = ["CROSS_ROLE","DATABASE","BACKUP_RESTORE","NOTIFICATIONS_JOBS","ACCESSIBILITY_RTL"];

  for (const category of categories) {
    const submit = await app.inject({method:"PUT",url:schoolUrl+"/evidence",headers:admin,
      payload:{category,reference:"operator-vault-"+category, note:"Independent operator review references are stored securely"}});
    assert.equal(submit.statusCode,200,submit.body);
    const review = await app.inject({method:"PATCH",url:platformBase+"/evidence/"+category,headers:platform,
      payload:{status:"VERIFIED",operatorLabel:"Pilot operator",note:"Reviewed matching evidence in controlled operator vault"}});
    assert.equal(review.statusCode,200,review.body);
  }
  const overview = await app.inject({method:"GET",url:schoolUrl,headers:admin});
  assert.equal(overview.statusCode,200);
  assert.equal(overview.json<{verifiedCount:number}>().verifiedCount,5);

  // The public platform route still checks real core/advanced readiness. This
  // isolated store test supplies the simulated verified configuration gate
  // to exercise persistence and revocation after operator signoff.
  const approved = await pilotLaunchStore.decideLaunch(
    schoolId, "APPROVED", "Pilot operator", "All five independent evidence bundles were reviewed", true
  );
  assert.equal(approved.status,"APPROVED");

  const adminLaunch = await app.inject({method:"GET",url:schoolUrl,headers:admin});
  assert.equal(adminLaunch.json<{decision:{status:string}}>().decision.status,"APPROVED");
  const evidenceChange = await app.inject({method:"PUT",url:schoolUrl+"/evidence",headers:admin,
    payload:{category:"DATABASE",reference:"operator-vault-DATABASE-v2",
      note:"Updated migration report requires another independent verification"}});
  assert.equal(evidenceChange.statusCode,200,evidenceChange.body);
  const revoked = await app.inject({method:"GET",url:schoolUrl,headers:admin});
  assert.equal(revoked.json<{decision:{status:string};decisionHistory:unknown[]}>().decision.status,"NOT_APPROVED");
  assert.equal(revoked.json<{decision:{status:string};decisionHistory:unknown[]}>().decisionHistory.length,2);

  // Re-verify and re-approve, then open a critical ticket to ensure automatic invalidation.
  const rereview = await app.inject({method:"PATCH",url:platformBase+"/evidence/DATABASE",headers:platform,
    payload:{status:"VERIFIED",operatorLabel:"Pilot operator",note:"Reviewed new database migration report"}});
  assert.equal(rereview.statusCode,200,rereview.body);
  const secondApproval = await pilotLaunchStore.decideLaunch(
    schoolId, "APPROVED", "Pilot operator", "Reverified all five evidence categories", true
  );
  assert.equal(secondApproval.status,"APPROVED");
  const ticket = await app.inject({method:"POST",url:"/v1/admin/pilot/support",headers:admin,
    payload:{subject:"Critical production issue",description:"A critical readiness issue is blocking launch",
      category:"TECHNICAL",priority:"CRITICAL"}});
  assert.equal(ticket.statusCode,201,ticket.body);
  const invalidated = await app.inject({method:"GET",url:schoolUrl,headers:admin});
  assert.equal(invalidated.json<{decision:{status:string};openCriticalTickets:number}>().decision.status,"NOT_APPROVED");
  assert.equal(invalidated.json<{decision:{status:string};openCriticalTickets:number}>().openCriticalTickets,1);
});

test("Pilot Phase 7 release acceptance is authenticated, school-scoped and never silently marks external checks passed", async (t) => {
  const { app, client, pilotLaunchStore } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "PILOT-PHASE7-A");
  const schoolB = await provisionSchool(app, "PILOT-PHASE7-B");
  const adminA = { authorization: `Bearer ${await bootstrapAdmin(app, schoolA)}` };
  const adminB = { authorization: `Bearer ${await bootstrapAdmin(app, schoolB)}` };
  const platform = { "x-platform-provisioning-key": provisioningKey };
  const url = "/v1/admin/pilot/release-readiness";

  assert.equal((await app.inject({ method:"GET", url })).statusCode, 401);
  assert.equal((await app.inject({ method:"GET", url, headers:platform })).statusCode, 401);
  const initial = await app.inject({ method:"GET", url, headers:adminA });
  assert.equal(initial.statusCode,200,initial.body);
  assert.equal(initial.headers["cache-control"],"no-store");
  const initialBody = initial.json<{
    productionDecision:string;effectivePilotApproval:boolean;
    missingExternalGates:string[];checks:Array<{id:string;status:string}>;
  }>();
  assert.equal(initialBody.productionDecision,"NO_GO");
  assert.equal(initialBody.effectivePilotApproval,false);
  assert.equal(initialBody.checks.length,20);
  assert.equal(initialBody.checks[19]?.status,"NO_GO");
  assert.ok(initialBody.checks.slice(0,19).every((check)=>check.status==="UNVERIFIED"));
  assert.equal(initialBody.missingExternalGates.length,11);
  assert.equal(initial.body.includes("passwordHash"),false);
  assert.equal(initial.body.includes("schoolId"),false);

  const submitted = await app.inject({
    method:"PUT",url:"/v1/admin/pilot/launch/evidence",headers:adminA,
    payload:{category:"CROSS_ROLE",reference:"vault-role-test-suite",
      note:"Recorded role test references for independent operator review"}
  });
  assert.equal(submitted.statusCode,200,submitted.body);
  const after = await app.inject({ method:"GET", url, headers:adminA });
  assert.equal(after.statusCode,200);
  assert.equal(after.json<{productionDecision:string}>().productionDecision,"NO_GO");
  const foreign = await app.inject({ method:"GET", url, headers:adminB });
  assert.equal(foreign.statusCode,200);
  assert.equal(foreign.json<{productionDecision:string;effectivePilotApproval:boolean}>().effectivePilotApproval,false);
  assert.equal(foreign.json<{productionDecision:string}>().productionDecision,"NO_GO");

  const state = await app.inject({
    method:"PATCH",url:`/v1/platform/schools/${schoolA}/subscription`,headers:platform,
    payload:{status:"SUSPENDED"}
  });
  assert.equal(state.statusCode,200);
  const suspended = await app.inject({ method:"GET", url, headers:adminA });
  assert.equal(suspended.statusCode,200,suspended.body);
  assert.equal(suspended.json<{productionDecision:string}>().productionDecision,"NO_GO");
  assert.equal(suspended.json<{effectivePilotApproval:boolean}>().effectivePilotApproval,false);

  // Historical approval from Phase 6 is not a production release decision.
  // A simulated store-only approval exercises the invariant without pretending
  // that externally verified readiness exists in this disposable test school.
  await assert.rejects(
    () => pilotLaunchStore.decideLaunch(schoolA, "APPROVED", "Pilot operator",
      "Cannot approve with missing pilot evidence", true),
    /five launch evidence/
  );
  const unchanged = await app.inject({ method:"GET", url, headers:adminA });
  assert.equal(unchanged.json<{productionDecision:string}>().productionDecision,"NO_GO");
});


test("Parent Phase 7 authenticated child isolation and password rotation", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });

  const schoolId = await provisionSchool(app, "PARENT-PHASE7");
  const adminToken = await bootstrapAdmin(app, schoolId);
  const admin = { authorization: `Bearer ${adminToken}` };
  const year = await app.inject({ method:"POST", url:"/v1/admin/academics/years",
    headers:admin, payload:{name:"1405",startDate:"2026-03-21",endDate:"2027-03-20"} });
  assert.equal(year.statusCode,201,year.body);
  const yearId = year.json<{academicYear:{id:string}}>().academicYear.id;
  const grade = await app.inject({ method:"POST",url:"/v1/admin/academics/grades",
    headers:admin,payload:{code:"P7G7",name:"Grade 7",sortOrder:7} });
  assert.equal(grade.statusCode,201,grade.body);
  const classResponse = await app.inject({method:"POST",url:"/v1/admin/academics/classes",
    headers:admin,payload:{academicYearId:yearId,gradeLevelId:grade.json<{grade:{id:string}}>().grade.id,
      code:"P7A",name:"Class P7 A"} });
  assert.equal(classResponse.statusCode,201,classResponse.body);
  const classId=classResponse.json<{class:{id:string}}>().class.id;

  const parents=[] as Array<{user:{id:string};temporaryPassword:string}>;
  for (const [username,fullName] of [["parent7a","Parent A"],["parent7b","Parent B"]]) {
    const response = await app.inject({method:"POST",url:"/v1/admin/families/parents",
      headers:admin,payload:{username,fullName}});
    assert.equal(response.statusCode,201,response.body);
    parents.push(response.json<{user:{id:string};temporaryPassword:string}>());
  }
  const studentIds=[] as string[];
  for(let i=0;i<2;i++){
    const response=await app.inject({method:"POST",url:"/v1/admin/families/students",
      headers:admin,payload:{parentUserId:parents[i]!.user.id,
        studentCode:"PHASE7-"+i,fullName:"Child "+i,academicYearId:yearId,classId} });
    assert.equal(response.statusCode,201,response.body);
    studentIds.push(response.json<{student:{id:string}}>().student.id);
  }
  const parentTokens=await Promise.all(
    [0,1].map(i=>activateRoleLogin(app,schoolId,"PARENT","parent7"+(i?"b":"a"),
      parents[i]!.temporaryPassword,"ParentSecure2026!"))
  );
  const own = {authorization:`Bearer ${parentTokens[0]}`};
  const unrelated = {authorization:`Bearer ${parentTokens[1]}`};
  const home=await app.inject({method:"GET",url:"/v1/parent/home",headers:own});
  assert.equal(home.statusCode,200,home.body);
  const children=home.json<{children:Array<{student:{id:string}}>} >().children;
  assert.deepEqual(children.map(x=>x.student.id),[studentIds[0]]);
  const otherHome=await app.inject({method:"GET",url:"/v1/parent/home",headers:unrelated});
  assert.deepEqual(otherHome.json<{children:Array<{student:{id:string}}>} >().children
    .map(x=>x.student.id),[studentIds[1]]);

  for(const suffix of ["timetable","learning","attendance","fees"]){
    const url=`/v1/parent/children/${studentIds[1]}/${suffix}`;
    const blocked=await app.inject({method:"GET",url,headers:own});
    assert.equal(blocked.statusCode,404,blocked.body);
  }

  // Draft invoices are not parent-visible; issued invoices never leak to another parent.
  const invoice=await app.inject({method:"POST",url:"/v1/admin/fees/invoices",
    headers:admin,payload:{studentId:studentIds[0],amount:1250,
      dueDate:"2099-12-31",description:"School fee"}});
  assert.equal(invoice.statusCode,201,invoice.body);
  const invoiceId=invoice.json<{invoice:{id:string}}>().invoice.id;
  const ownUrl=`/v1/parent/children/${studentIds[0]}/fees`;
  const draft=await app.inject({method:"GET",url:ownUrl,headers:own});
  assert.equal(draft.statusCode,200,draft.body);
  assert.equal(draft.json<{invoices:unknown[]}>().invoices.length,0);
  const issue=await app.inject({method:"POST",url:`/v1/admin/fees/invoices/${invoiceId}/issue`,
    headers:admin});
  assert.equal(issue.statusCode,200,issue.body);
  const visible=await app.inject({method:"GET",url:ownUrl,headers:own});
  assert.equal(visible.statusCode,200,visible.body);
  assert.equal(visible.json<{invoices:Array<{outstanding:number}>}>().invoices[0]?.outstanding,1250);
  assert.equal((await app.inject({method:"GET",url:ownUrl,headers:unrelated})).statusCode,404);
  assert.equal((await app.inject({method:"POST",url:`/v1/admin/fees/invoices/${invoiceId}/issue`,
    headers:own})).statusCode,403);

  // Both password and active session are rotated by the existing audited API.
  const wrong=await app.inject({method:"POST",url:"/v1/auth/change-password",
    headers:own,payload:{currentPassword:"WrongSecure2026!",newPassword:"NextSecure2026!"}});
  assert.equal(wrong.statusCode,401,wrong.body);
  const same=await app.inject({method:"POST",url:"/v1/auth/change-password",
    headers:own,payload:{currentPassword:"ParentSecure2026!",newPassword:"ParentSecure2026!"}});
  assert.equal(same.statusCode,400,same.body);
  const changed=await app.inject({method:"POST",url:"/v1/auth/change-password",
    headers:own,payload:{currentPassword:"ParentSecure2026!",newPassword:"NextSecure2026!"}});
  assert.equal(changed.statusCode,200,changed.body);
  const newToken=changed.json<{accessToken:string}>().accessToken;
  assert.notEqual(newToken,parentTokens[0]);
  assert.equal((await app.inject({method:"GET",url:"/v1/parent/home",headers:own})).statusCode,401);
  assert.equal((await app.inject({method:"GET",url:"/v1/parent/home",
    headers:{authorization:`Bearer ${newToken}`}})).statusCode,200);
  assert.equal((await app.inject({method:"GET",url:"/v1/parent/home",headers:unrelated})).statusCode,200);
  const oldLogin=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId,expectedRole:"PARENT",username:"parent7a",password:"ParentSecure2026!"}});
  assert.equal(oldLogin.statusCode,401);
  const newLogin=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId,expectedRole:"PARENT",username:"parent7a",password:"NextSecure2026!"}});
  assert.equal(newLogin.statusCode,200,newLogin.body);
});


test("Admin fee invoice Phase 3 school numbers, list filters, draft edits and immutable issue", async t => {
  const {app,client}=await createTestApp();
  t.after(async()=>{await app.close();await client.close();});
  const schoolId=await provisionSchool(app,"FEE-PHASE3");
  const otherSchool=await provisionSchool(app,"FEE-PHASE3-OTHER");
  const adminToken=await bootstrapAdmin(app,schoolId);
  const otherToken=await bootstrapAdmin(app,otherSchool);
  const admin={authorization:`Bearer ${adminToken}`};
  const otherAdmin={authorization:`Bearer ${otherToken}`};
  const year=await app.inject({method:"POST",url:"/v1/admin/academics/years",
    headers:admin,payload:{name:"1405",startDate:"2026-03-21",endDate:"2027-03-20"}});
  assert.equal(year.statusCode,201,year.body);
  const yearId=year.json<{academicYear:{id:string}}>().academicYear.id;
  const grade=await app.inject({method:"POST",url:"/v1/admin/academics/grades",
    headers:admin,payload:{name:"Grade 8",code:"FEEG8",sortOrder:8}});
  assert.equal(grade.statusCode,201,grade.body);
  const cl=await app.inject({method:"POST",url:"/v1/admin/academics/classes",
    headers:admin,payload:{name:"Fee Class",code:"FEECL",gradeLevelId:grade.json<{grade:{id:string}}>().grade.id,
      academicYearId:yearId}});
  assert.equal(cl.statusCode,201,cl.body);
  const classId=cl.json<{class:{id:string}}>().class.id;
  const parent=await app.inject({method:"POST",url:"/v1/admin/families/parents",
    headers:admin,payload:{username:"feephaseparent",fullName:"Fee Phase Parent"}});
  assert.equal(parent.statusCode,201,parent.body);
  const student=await app.inject({method:"POST",url:"/v1/admin/families/students",
    headers:admin,payload:{studentCode:"FEE-STUD-1",fullName:"Fee Test Student",
      parentUserId:parent.json<{user:{id:string}}>().user.id,academicYearId:yearId,classId}});
  assert.equal(student.statusCode,201,student.body);
  const studentId=student.json<{student:{id:string}}>().student.id;
  const created=[] as Array<{id:string;invoiceNumber:number;updatedAt:string}>;
  for(let i=0;i<21;i++){
    const res=await app.inject({method:"POST",url:"/v1/admin/fees/invoices",
      headers:admin,payload:{studentId,amount:100+i,dueDate:"2099-12-31",
        description:"Fee phase invoice "+i}});
    assert.equal(res.statusCode,201,res.body);
    created.push(res.json<{invoice:{id:string;invoiceNumber:number;updatedAt:string}}>().invoice);
  }
  assert.deepEqual(created.map(row=>row.invoiceNumber),Array.from({length:21},(_,i)=>i+1));

  const page1=await app.inject({method:"GET",url:"/v1/admin/fees/invoices?page=1",headers:admin});
  const page2=await app.inject({method:"GET",url:"/v1/admin/fees/invoices?page=2",headers:admin});
  assert.equal(page1.statusCode,200,page1.body);
  assert.equal(page2.statusCode,200,page2.body);
  assert.equal(page1.json<{total:number;invoices:unknown[]}>().total,21);
  assert.equal(page1.json<{invoices:unknown[]}>().invoices.length,20);
  assert.equal(page2.json<{invoices:unknown[]}>().invoices.length,1);
  const filtered=await app.inject({method:"GET",url:
    `/v1/admin/fees/invoices?q=invoice%2017&status=DRAFT&academicYearId=${yearId}&classId=${classId}`,
    headers:admin});
  assert.equal(filtered.statusCode,200,filtered.body);
  assert.equal(filtered.json<{total:number}>().total,1);
  const byNumber=await app.inject({method:"GET",url:"/v1/admin/fees/invoices?q=19",headers:admin});
  assert.equal(byNumber.statusCode,200,byNumber.body);
  assert.ok(byNumber.json<{invoices:Array<{invoice:{invoiceNumber:number}}>} >().invoices
    .some(x=>x.invoice.invoiceNumber===19));

  const draft=created[0]!;
  const payload={studentId,amount:870,dueDate:"2099-12-28",description:"Updated fee",
    expectedUpdatedAt:draft.updatedAt};
  assert.equal((await app.inject({method:"PATCH",url:`/v1/admin/fees/invoices/${draft.id}`,
    headers:otherAdmin,payload})).statusCode,404);
  const changed=await app.inject({method:"PATCH",url:`/v1/admin/fees/invoices/${draft.id}`,
    headers:admin,payload});
  assert.equal(changed.statusCode,200,changed.body);
  const newDraft=changed.json<{invoice:{invoiceNumber:number;amount:number;updatedAt:string}}>().invoice;
  assert.equal(newDraft.invoiceNumber,1);
  assert.equal(newDraft.amount,870);
  assert.equal((await app.inject({method:"PATCH",url:`/v1/admin/fees/invoices/${draft.id}`,
    headers:admin,payload})).statusCode,409);
  const issue=await app.inject({method:"POST",url:`/v1/admin/fees/invoices/${draft.id}/issue`,
    headers:admin});
  assert.equal(issue.statusCode,200,issue.body);
  assert.equal((await app.inject({method:"PATCH",url:`/v1/admin/fees/invoices/${draft.id}`,
    headers:admin,payload:{...payload,expectedUpdatedAt:newDraft.updatedAt}})).statusCode,409);
  const issued=await app.inject({method:"GET",url:"/v1/admin/fees/invoices?status=ISSUED",
    headers:admin});
  assert.equal(issued.json<{total:number}>().total,1);
  assert.equal((await app.inject({method:"GET",url:"/v1/admin/fees/invoices",
    headers:otherAdmin})).json<{total:number}>().total,0);
  const nextSchoolInvoice=await app.inject({method:"POST",url:"/v1/admin/fees/invoices",
    headers:otherAdmin,payload:{studentId,amount:100,dueDate:"2099-12-31"}});
  assert.equal(nextSchoolInvoice.statusCode,404,nextSchoolInvoice.body);
  const otherRole=await activateRoleLogin(app,schoolId,"PARENT","feephaseparent",
    parent.json<{temporaryPassword:string}>().temporaryPassword,"FeePhase2026!");
  const parentAuth={authorization:`Bearer ${otherRole}`};
  assert.equal((await app.inject({method:"GET",url:"/v1/admin/fees/invoices",
    headers:parentAuth})).statusCode,403);
  assert.equal((await app.inject({method:"PATCH",url:`/v1/admin/fees/invoices/${draft.id}`,
    headers:parentAuth,payload})).statusCode,403);
  const family=await app.inject({method:"GET",url:`/v1/parent/children/${studentId}/fees`,
    headers:parentAuth});
  assert.equal(family.statusCode,200,family.body);
  assert.equal(family.json<{invoices:Array<{invoice:{invoiceNumber:number;amount:number}}>} >()
    .invoices[0]?.invoice.invoiceNumber,1);
  const audits=await client.query<{action:string}>(
    "SELECT action FROM audit_logs WHERE school_id=$1 AND entity_id=$2 ORDER BY created_at",
    [schoolId,draft.id]);
  assert.equal(audits.rows.filter(x=>x.action==="fee_invoice.draft_updated").length,1);
});


test("Admin Fees Phase 4 records and reverses immutable payments with scoped receipts and student balances", async t => {
  const {app,client} = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolId = await provisionSchool(app,"FEE-PHASE4");
  const otherSchool = await provisionSchool(app,"FEE-PHASE4-OTHER");
  const token = await bootstrapAdmin(app,schoolId);
  const otherToken = await bootstrapAdmin(app,otherSchool);
  const admin = {authorization:`Bearer ${token}`};
  const other = {authorization:`Bearer ${otherToken}`};
  const year = await app.inject({method:"POST",url:"/v1/admin/academics/years",headers:admin,
    payload:{name:"Phase4 year",startDate:"2026-03-21",endDate:"2027-03-20"}});
  assert.equal(year.statusCode,201,year.body);
  const yearId = year.json<{academicYear:{id:string}}>().academicYear.id;
  const grade = await app.inject({method:"POST",url:"/v1/admin/academics/grades",headers:admin,
    payload:{name:"Grade 8",code:"FEE4G8",sortOrder:8}});
  assert.equal(grade.statusCode,201,grade.body);
  const classroom = await app.inject({method:"POST",url:"/v1/admin/academics/classes",headers:admin,
    payload:{name:"Fee Class",code:"FEE4CL",
      gradeLevelId:grade.json<{grade:{id:string}}>().grade.id,academicYearId:yearId}});
  assert.equal(classroom.statusCode,201,classroom.body);
  const parent = await app.inject({method:"POST",url:"/v1/admin/families/parents",headers:admin,
    payload:{username:"fee4parent",fullName:"Fee Fourth Parent"}});
  assert.equal(parent.statusCode,201,parent.body);
  const student = await app.inject({method:"POST",url:"/v1/admin/families/students",headers:admin,
    payload:{studentCode:"FEE4-STUD-1",fullName:"Fee Fourth Student",
      parentUserId:parent.json<{user:{id:string}}>().user.id,academicYearId:yearId,
      classId:classroom.json<{class:{id:string}}>().class.id}});
  assert.equal(student.statusCode,201,student.body);
  const studentId = student.json<{student:{id:string}}>().student.id;
  const makeInvoice = async (amount: number, issue = true) => {
    const newInvoice = await app.inject({method:"POST",url:"/v1/admin/fees/invoices",headers:admin,
      payload:{studentId,amount,dueDate:"2099-12-31",description:"Phase4 tuition"}});
    assert.equal(newInvoice.statusCode,201,newInvoice.body);
    const invoice = newInvoice.json<{invoice:{id:string;invoiceNumber:number}}>().invoice;
    if(issue){
      const issued=await app.inject({method:"POST",
        url:`/v1/admin/fees/invoices/${invoice.id}/issue`,headers:admin});
      assert.equal(issued.statusCode,200,issued.body);
    }
    return invoice;
  };
  const invoice=await makeInvoice(1200);
  await makeInvoice(900,false);
  const payment=await app.inject({method:"POST",url:`/v1/admin/fees/invoices/${invoice.id}/payments`,
    headers:admin,payload:{amount:500,method:"CASH",transactionReference:"test-cash",idempotencyKey:"d021d5a7-71f5-4941-989e-23b4f2d0b71e"}});
  assert.equal(payment.statusCode,201,payment.body);
  const otherPayment=await app.inject({method:"POST",url:`/v1/admin/fees/invoices/${invoice.id}/payments`,
    headers:admin,payload:{amount:200,method:"BANK_TRANSFER",transactionReference:"bank-01"}});
  assert.equal(otherPayment.statusCode,201,otherPayment.body);

  const rows=await app.inject({method:"GET",url:`/v1/admin/fees/payments?studentId=${studentId}&method=CASH&page=1`,
    headers:admin});
  assert.equal(rows.statusCode,200,rows.body);
  const listing=rows.json<{total:number;payments:Array<{payment:{id:string;amount:number;kind:string};invoiceNumber:number;studentCode:string;recordedByUsername:string}>}>();
  assert.equal(listing.total,1);
  assert.equal(listing.payments[0]?.payment.amount,500);
  assert.equal(listing.payments[0]?.invoiceNumber,invoice.invoiceNumber);
  assert.equal(listing.payments[0]?.studentCode,"FEE4-STUD-1");
  const paymentId=listing.payments[0]!.payment.id;
  assert.equal((await app.inject({method:"GET",url:"/v1/admin/fees/payments?method=NOT_A_METHOD",
    headers:admin})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:"/v1/admin/fees/payments?from=2026-10-10&to=2026-10-01",
    headers:admin})).statusCode,400);

  const receiptUrl=`/v1/admin/fees/payments/${paymentId}/receipt`;
  const originalReceipt=await app.inject({method:"GET",url:receiptUrl,headers:admin});
  assert.equal(originalReceipt.statusCode,200,originalReceipt.body);
  const receipt=originalReceipt.json<{receipt:{payment:{id:string;amount:number;method:string};
    schoolName:string;invoiceNumber:number;currentOutstanding:number;reversed:boolean}}>().receipt;
  assert.equal(receipt.payment.id,paymentId);
  assert.equal(receipt.payment.method,"CASH");
  assert.equal(receipt.currentOutstanding,500);
  assert.equal(receipt.reversed,false);
  assert.equal(receipt.schoolName,"School FEE-PHASE4");

  const balanceUrl=`/v1/admin/fees/students/${studentId}/balance`;
  const before=await app.inject({method:"GET",url:balanceUrl,headers:admin});
  assert.equal(before.statusCode,200,before.body);
  const financial=before.json<{billed:number;paid:number;outstanding:number;overdue:number;invoices:unknown[]}>();
  assert.equal(financial.billed,1200,"Draft invoices must not count");
  assert.equal(financial.paid,700);
  assert.equal(financial.outstanding,500);
  assert.equal(financial.invoices.length,1);

  const reverse=await app.inject({method:"POST",url:`/v1/admin/fees/payments/${paymentId}/reverse`,
    headers:admin,payload:{reason:"Cash counting correction"}});
  assert.equal(reverse.statusCode,201,reverse.body);
  const after=await app.inject({method:"GET",url:balanceUrl,headers:admin});
  assert.equal(after.statusCode,200,after.body);
  const newBalance=after.json<{billed:number;paid:number;outstanding:number}>();
  assert.equal(newBalance.billed,1200);
  assert.equal(newBalance.paid,200);
  assert.equal(newBalance.outstanding,1000);
  const voidReceipt=await app.inject({method:"GET",url:receiptUrl,headers:admin});
  assert.equal(voidReceipt.statusCode,200,voidReceipt.body);
  assert.equal(voidReceipt.json<{receipt:{reversed:boolean;currentOutstanding:number}}>().receipt.reversed,true);
  assert.equal(voidReceipt.json<{receipt:{currentOutstanding:number}}>().receipt.currentOutstanding,1000);
  const reversalRows=await app.inject({method:"GET",
    url:`/v1/admin/fees/payments?studentId=${studentId}&kind=REVERSAL`,headers:admin});
  assert.equal(reversalRows.statusCode,200,reversalRows.body);
  assert.equal(reversalRows.json<{total:number}>().total,1);

  for(const url of [
    "/v1/admin/fees/payments",
    balanceUrl,
    receiptUrl
  ]){
    const otherResponse=await app.inject({method:"GET",url,headers:other});
    assert.equal(otherResponse.statusCode,url==="/v1/admin/fees/payments" ? 200 : 404);
    if(url==="/v1/admin/fees/payments") assert.equal(otherResponse.json<{total:number}>().total,0);
  }
  const familyToken=await activateRoleLogin(app,schoolId,"PARENT","fee4parent",
    parent.json<{temporaryPassword:string}>().temporaryPassword,"SecureParent4!");
  for(const url of ["/v1/admin/fees/payments",balanceUrl,receiptUrl]){
    const result=await app.inject({method:"GET",url,headers:{authorization:`Bearer ${familyToken}`}});
    assert.equal(result.statusCode,403,url);
  }
  const ledger=await client.query<{kind:string}>(
    "SELECT kind FROM fee_payments WHERE school_id=$1 AND invoice_id=$2 ORDER BY recorded_at",
    [schoolId,invoice.id]);
  assert.deepEqual(ledger.rows.map(row=>row.kind).sort(),["PAYMENT","PAYMENT","REVERSAL"].sort());
});



test("Admin Communication/Fees Phase 7 requires platform key and scopes delivery monitor", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async () => { await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "C7-SCHOOL-A");
  const schoolB = await provisionSchool(app, "C7-SCHOOL-B");
  const tokenA = await bootstrapAdmin(app, schoolA, "c7.admin");
  const tokenB = await bootstrapAdmin(app, schoolB, "c7.admin");
  const adminA = { authorization: `Bearer ${tokenA}` };
  const adminB = { authorization: `Bearer ${tokenB}` };
  const job = "/v1/platform/jobs/communication/run";
  assert.equal((await app.inject({ method: "POST", url: job })).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: job,
    headers: { "x-platform-provisioning-key": "not-valid" } })).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: job,
    headers: { "x-platform-provisioning-key": provisioningKey } })).statusCode, 200);
  const monitor = "/v1/admin/notifications/delivery";
  assert.equal((await app.inject({ method: "GET", url: monitor })).statusCode, 401);
  for (const headers of [adminA, adminB]) {
    const response = await app.inject({ method: "GET", url: monitor, headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(response.json<{ scheduler: { lastSuccessAt: string | null } }>()
      .scheduler.lastSuccessAt);
  }
  const invalid = await app.inject({ method: "POST",
    url: "/v1/admin/notifications/invalid-id/retry", headers: adminA });
  assert.equal(invalid.statusCode, 400);
});

test("Admin Fees Phase 6 reporting routes restrict schools, reject bad filters and preview without mutation", async (t) => {
  const { app, client } = await createTestApp();
  t.after(async()=>{ await app.close(); await client.close(); });
  const schoolA = await provisionSchool(app, "FEE-REPORT-A");
  const schoolB = await provisionSchool(app, "FEE-REPORT-B");
  const tokenA = await bootstrapAdmin(app, schoolA, "reports.admin");
  const tokenB = await bootstrapAdmin(app, schoolB, "reports.admin");
  const adminA = { authorization: `Bearer ${tokenA}` };
  const adminB = { authorization: `Bearer ${tokenB}` };

  const reportA = await app.inject({ method: "GET", url:"/v1/admin/fees/reports", headers:adminA });
  assert.equal(reportA.statusCode,200,reportA.body);
  assert.equal(reportA.json<{report:{billed:number;statement:{grossPayments:number}}}>().report.billed,0);
  const exportA = await app.inject({ method:"GET",
    url:"/v1/admin/fees/reports/export?kind=outstanding", headers:adminA });
  assert.equal(exportA.statusCode,200,exportA.body);
  assert.ok(exportA.json<{csv:string}>().csv.includes("invoice_number"));
  const reportB = await app.inject({ method:"GET", url:"/v1/admin/fees/reports", headers:adminB });
  assert.equal(reportB.statusCode,200);
  assert.equal(reportB.json<{report:{billed:number}}>().report.billed,0);

  const invalidRange = await app.inject({ method:"GET",
    url:"/v1/admin/fees/reports?from=2026-10-16&to=2026-10-14",headers:adminA });
  assert.equal(invalidRange.statusCode,400);
  const badKind = await app.inject({ method:"GET",
    url:"/v1/admin/fees/reports/export?kind=private",headers:adminA });
  assert.equal(badKind.statusCode,400);
  const badPreview = await app.inject({ method:"POST",
    url:"/v1/admin/fees/invoices/bulk-preview", headers:adminA,payload:{invoices:[]} });
  assert.equal(badPreview.statusCode,400);

  const otherStudentId="11111111-1111-4111-8111-111111111111";
  const preview = await app.inject({ method:"POST",url:"/v1/admin/fees/invoices/bulk-preview",
    headers:adminA,payload:{invoices:[{studentId:otherStudentId,amount:100,dueDate:"2026-10-30",description:"Test"}]} });
  assert.equal(preview.statusCode,200,preview.body);
  assert.equal(preview.json<{created:boolean;ready:number;unavailable:number}>().created,false);
  assert.equal(preview.json<{unavailable:number}>().unavailable,1);
  const noMutation = await app.inject({ method:"GET",url:"/v1/admin/fees/invoices",headers:adminA });
  assert.equal(noMutation.statusCode,200);
  assert.equal(noMutation.json<{total:number}>().total,0);

  const foreignPayment = await app.inject({ method:"PATCH",headers:adminB,
    url:"/v1/admin/fees/payments/11111111-1111-4111-8111-111111111111/reconciliation",
    payload:{status:"RECONCILED",reference:"BANK-X"} });
  assert.equal(foreignPayment.statusCode,404);
  const unauth = await app.inject({method:"GET",url:"/v1/admin/fees/reports"});
  assert.equal(unauth.statusCode,401);
});

test("Standalone web staff role: first-login setup, scoped directory, and admin isolation", async(t) => {
  const {app,client}=await createTestApp();
  t.after(async()=>{await app.close();await client.close();});
  const schoolA=await provisionSchool(app,"STAFF-WEB-A");
  const schoolB=await provisionSchool(app,"STAFF-WEB-B");
  const adminToken=await bootstrapAdmin(app,schoolA);
  const adminB=await bootstrapAdmin(app,schoolB);
  const adminHeaders={authorization:`Bearer ${adminToken}`};

  const staffCreated=await app.inject({
    method:"POST",url:"/v1/admin/users",headers:adminHeaders,
    payload:{username:"frontdesk2026",role:"SCHOOL_STAFF"}
  });
  assert.equal(staffCreated.statusCode,201);
  const created=staffCreated.json<{
    user:{id:string;role:string;mustChangePassword:boolean};
    temporaryPassword:string
  }>();
  assert.equal(created.user.role,"SCHOOL_STAFF");
  assert.equal(created.user.mustChangePassword,true);

  // Directory is permission-gated. The school admin explicitly assigns it
  // before the staff session is activated, never from job title alone.
  const configured=await app.inject({
    method:"PUT",url:`/v1/admin/staff/${created.user.id}/profile`,headers:adminHeaders,
    payload:{fullName:"Front Desk Staff",employeeCode:"FD-001",
      position:"RECEPTIONIST",department:"Front Desk",permissions:["DIRECTORY_VIEW"]}
  });
  assert.equal(configured.statusCode,200,configured.body);

  const teacherA=await app.inject({
    method:"POST",url:"/v1/admin/users",headers:adminHeaders,
    payload:{username:"teacherstaffa",role:"TEACHER"}
  });
  assert.equal(teacherA.statusCode,201);
  const teacherB=await app.inject({
    method:"POST",url:"/v1/admin/users",
    headers:{authorization:`Bearer ${adminB}`},
    payload:{username:"teacherotherb",role:"TEACHER"}
  });
  assert.equal(teacherB.statusCode,201);

  const wrongRole=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId:schoolA,expectedRole:"SCHOOL_ADMIN",
      username:"frontdesk2026",password:created.temporaryPassword}});
  assert.equal(wrongRole.statusCode,403);
  const foreignSchool=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId:schoolB,expectedRole:"SCHOOL_STAFF",
      username:"frontdesk2026",password:created.temporaryPassword}});
  assert.equal(foreignSchool.statusCode,401);
  const login=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId:schoolA,expectedRole:"SCHOOL_STAFF",
      username:"frontdesk2026",password:created.temporaryPassword}});
  assert.equal(login.statusCode,200);
  const initial=login.json<{accessToken:string;mustChangePassword:boolean}>();
  assert.equal(initial.mustChangePassword,true);
  const before=await app.inject({method:"GET",url:"/v1/staff/me",
    headers:{authorization:`Bearer ${initial.accessToken}`}});
  assert.equal(before.statusCode,403);
  assert.equal(before.json<{error:string}>().error,"password_change_required");
  const changed=await app.inject({method:"POST",url:"/v1/auth/change-temporary-password",
    headers:{authorization:`Bearer ${initial.accessToken}`},
    payload:{newPassword:"StaffFirstSetup2026!"}});
  assert.equal(changed.statusCode,200);
  const staffToken=changed.json<{accessToken:string;user:{role:string}}>();
  assert.equal(staffToken.user.role,"SCHOOL_STAFF");
  const headers={authorization:`Bearer ${staffToken.accessToken}`};
  const me=await app.inject({method:"GET",url:"/v1/staff/me",headers});
  assert.equal(me.statusCode,200);
  assert.equal(me.headers["cache-control"],"no-store");
  assert.equal(me.json<{user:{role:string};school:{id:string}}>().school.id,schoolA);

  const forbidden=await app.inject({method:"GET",url:"/v1/admin/users",headers});
  assert.equal(forbidden.statusCode,403);
  const notAdmin=await app.inject({method:"POST",url:"/v1/admin/users",
    headers,payload:{username:"staff-created",role:"SCHOOL_ADMIN"}});
  assert.equal(notAdmin.statusCode,403);
  const adminNotStaff=await app.inject({method:"GET",url:"/v1/staff/me",headers:adminHeaders});
  assert.equal(adminNotStaff.statusCode,403);
  const unauthed=await app.inject({method:"GET",url:"/v1/staff/directory?query=teacher"});
  assert.equal(unauthed.statusCode,401);
  const blankSearch=await app.inject({method:"GET",url:"/v1/staff/directory?query=a",headers});
  assert.equal(blankSearch.statusCode,400);
  const illegalRole=await app.inject({method:"GET",url:"/v1/staff/directory?query=teacher&group=SCHOOL_ADMIN",headers});
  assert.equal(illegalRole.statusCode,400);
  const found=await app.inject({method:"GET",
    url:"/v1/staff/directory?query=teacher&group=TEACHER&page=1",headers});
  assert.equal(found.statusCode,200);
  assert.equal(found.headers["cache-control"],"no-store");
  const search=found.json<{entries:Array<Record<string,unknown>>;total:number}>();
  assert.equal(search.total,1);
  assert.equal(search.entries.length,1);
  assert.equal(search.entries[0]?.username,"teacherstaffa");
  for (const hidden of ["passwordHash","schoolId","phone","email","refreshToken",
    "accessToken","userId","id","lastLoginAt"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(search.entries[0],hidden),false,
      "Staff must never receive private account data: "+hidden);
  }
  const cannotSeeOtherSchool=await app.inject({method:"GET",
    url:"/v1/staff/directory?query=teacherotherb&group=TEACHER",headers});
  assert.equal(cannotSeeOtherSchool.statusCode,200);
  assert.equal(cannotSeeOtherSchool.json<{total:number}>().total,0);
  const suspend=await app.inject({method:"POST",
    url:`/v1/admin/users/${created.user.id}/suspend`,headers:adminHeaders,
    payload:{reason:"Testing staff security"}});
  assert.equal(suspend.statusCode,200);
  const nowForbidden=await app.inject({method:"GET",url:"/v1/staff/me",headers});
  // Suspension revokes the issued session, so the prior token is invalid (401),
  // rather than reaching the live-role guard (403).
  assert.equal(nowForbidden.statusCode,401);
});

test("Staff Phase 1: job profiles are school-scoped, grants explicit, admin-only and session-revoking", async(t) => {
  const {app,client}=await createTestApp();
  t.after(async()=>{await app.close();await client.close();});
  const schoolA=await provisionSchool(app,"STAFF-JOB-A");
  const schoolB=await provisionSchool(app,"STAFF-JOB-B");
  const adminA=await bootstrapAdmin(app,schoolA);
  const adminB=await bootstrapAdmin(app,schoolB);
  const headerA={authorization:`Bearer ${adminA}`};
  const headerB={authorization:`Bearer ${adminB}`};
  const create=await app.inject({method:"POST",url:"/v1/admin/users",headers:headerA,
    payload:{username:"staffphaseone",role:"SCHOOL_STAFF"}});
  assert.equal(create.statusCode,201);
  const {user,temporaryPassword}=create.json<{user:{id:string};temporaryPassword:string}>();
  const profileUrl=`/v1/admin/staff/${user.id}/profile`;
  const noProfile=await app.inject({method:"GET",url:profileUrl,headers:headerA});
  assert.equal(noProfile.statusCode,200);
  assert.equal(noProfile.json<{profile:unknown}>().profile,null);
  for(const headers of [headerB,{}]) {
    const forbidden=await app.inject({method:"GET",url:profileUrl,headers});
    assert.ok([401,404].includes(forbidden.statusCode));
  }
  const attempt=await app.inject({method:"PUT",url:profileUrl,headers:headerA,
    payload:{fullName:"Office Staff",employeeCode:"OFF-001",department:"Reception",
      position:"RECEPTIONIST",permissions:["ADMIN_ALL"]}});
  assert.equal(attempt.statusCode,400);
  const duplicate=await app.inject({method:"PUT",url:profileUrl,headers:headerA,
    payload:{fullName:"Office Staff",employeeCode:"OFF-001",department:"Reception",
      position:"RECEPTIONIST",permissions:["DIRECTORY_VIEW","DIRECTORY_VIEW"]}});
  assert.equal(duplicate.statusCode,400);
  const crossSchool=await app.inject({method:"PUT",url:profileUrl,headers:headerB,
    payload:{fullName:"Foreign",employeeCode:null,department:"Office",
      position:"RECEPTIONIST",permissions:["DIRECTORY_VIEW"]}});
  assert.equal(crossSchool.statusCode,404);
  const staffLogin=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId:schoolA,expectedRole:"SCHOOL_STAFF",
      username:"staffphaseone",password:temporaryPassword}});
  assert.equal(staffLogin.statusCode,200);
  const setup=await app.inject({method:"POST",url:"/v1/auth/change-temporary-password",
    headers:{authorization:`Bearer ${staffLogin.json<{accessToken:string}>().accessToken}`},
    payload:{newPassword:"StaffJobPhase1New2026!"}});
  assert.equal(setup.statusCode,200);
  const token=setup.json<{accessToken:string}>().accessToken;
  const myHeaders={authorization:`Bearer ${token}`};
  const me=await app.inject({method:"GET",url:"/v1/staff/me",headers:myHeaders});
  assert.equal(me.statusCode,200);
  assert.equal(me.json<{profile:unknown}>().profile,null);
  const denied=await app.inject({method:"GET",
    url:"/v1/staff/directory?query=student",headers:myHeaders});
  assert.equal(denied.statusCode,403);
  assert.equal(denied.json<{error:string}>().error,"permission_denied");
  const staffAttempt=await app.inject({method:"PUT",url:profileUrl,headers:myHeaders,
    payload:{fullName:"Office Staff",employeeCode:"OFF-001",department:"Reception",
      position:"RECEPTIONIST",permissions:["DIRECTORY_VIEW"]}});
  assert.equal(staffAttempt.statusCode,403);
  const valid=await app.inject({method:"PUT",url:profileUrl,headers:headerA,
    payload:{fullName:"Office Staff",employeeCode:"OFF-001",department:"Reception",
      position:"RECEPTIONIST",permissions:["DIRECTORY_VIEW","TASKS_VIEW"]}});
  assert.equal(valid.statusCode,200,valid.body);
  assert.deepEqual(valid.json<{profile:{permissions:string[]}}>().profile.permissions,
    ["DIRECTORY_VIEW","TASKS_VIEW"]);
  const staffDirectory=await app.inject({method:"GET",
    url:"/v1/admin/users/directory?group=STAFF&query=OFF-001",headers:headerA});
  assert.equal(staffDirectory.statusCode,200,staffDirectory.body);
  const named=staffDirectory.json<{users:Array<{profile:{fullName:string;code:string|null}}>}>().users;
  assert.equal(named.length,1);
  assert.equal(named[0]?.profile.fullName,"Office Staff");
  assert.equal(named[0]?.profile.code,"OFF-001");
  const revoked=await app.inject({method:"GET",url:"/v1/staff/me",headers:myHeaders});
  assert.equal(revoked.statusCode,401);
  const repeat=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId:schoolA,expectedRole:"SCHOOL_STAFF",
      username:"staffphaseone",password:"StaffJobPhase1New2026!"}});
  assert.equal(repeat.statusCode,200);
  const newToken=repeat.json<{accessToken:string}>().accessToken;
  const meAgain=await app.inject({method:"GET",url:"/v1/staff/me",
    headers:{authorization:`Bearer ${newToken}`}});
  assert.equal(meAgain.statusCode,200);
  assert.equal(meAgain.json<{profile:{position:string;employeeCode:string}}>().profile.employeeCode,"OFF-001");
  const allowed=await app.inject({method:"GET",
    url:"/v1/staff/directory?query=staff&group=TEACHER",
    headers:{authorization:`Bearer ${newToken}`}});
  assert.equal(allowed.statusCode,200);
  const audited=await app.inject({method:"GET",url:`/v1/admin/users/${user.id}/audit`,
    headers:headerA});
  assert.equal(audited.statusCode,200);
  assert.ok(audited.json<{logs:Array<{action:string}>}>().logs.some(row=>
    row.action==="staff.profile_updated"));
});


test("Staff Phase 3: directory filtering, privacy boundaries and read-only details", async(t) => {
  const {app,client}=await createTestApp();
  t.after(async()=>{await app.close();await client.close();});
  const schoolA=await provisionSchool(app,"STAFF-SEARCH-A");
  const schoolB=await provisionSchool(app,"STAFF-SEARCH-B");
  const adminA=await bootstrapAdmin(app,schoolA);
  const adminB=await bootstrapAdmin(app,schoolB);
  const adminHeaders={authorization:`Bearer ${adminA}`};
  const created=await app.inject({method:"POST",url:"/v1/admin/users",
    headers:adminHeaders,payload:{username:"staffsearch",role:"SCHOOL_STAFF"}});
  assert.equal(created.statusCode,201);
  const staff=created.json<{user:{id:string};temporaryPassword:string}>();
  for (const username of ["teacheralpha","teacheromega"]) {
    const added=await app.inject({method:"POST",url:"/v1/admin/users",
      headers:adminHeaders,payload:{username,role:"TEACHER"}});
    assert.equal(added.statusCode,201);
  }
  const foreign=await app.inject({method:"POST",url:"/v1/admin/users",
    headers:{authorization:`Bearer ${adminB}`},
    payload:{username:"teacherother",role:"TEACHER"}});
  assert.equal(foreign.statusCode,201);

  const initial=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId:schoolA,expectedRole:"SCHOOL_STAFF",
      username:"staffsearch",password:staff.temporaryPassword}});
  assert.equal(initial.statusCode,200);
  const changed=await app.inject({method:"POST",
    url:"/v1/auth/change-temporary-password",
    headers:{authorization:`Bearer ${initial.json<{accessToken:string}>().accessToken}`},
    payload:{newPassword:"StaffSearchAccess2026!"}});
  assert.equal(changed.statusCode,200);
  let token=changed.json<{accessToken:string}>().accessToken;
  let headers={authorization:`Bearer ${token}`};
  const denied=await app.inject({method:"GET",
    url:"/v1/staff/directory?query=teacher&status=INVITED",headers});
  assert.equal(denied.statusCode,403);
  const configured=await app.inject({method:"PUT",
    url:`/v1/admin/staff/${staff.user.id}/profile`,headers:adminHeaders,
    payload:{fullName:"Staff Searcher",employeeCode:"SS-001",
      department:"Front desk",position:"RECEPTIONIST",permissions:["DIRECTORY_VIEW"]}});
  assert.equal(configured.statusCode,200);
  const revoked=await app.inject({method:"GET",url:"/v1/staff/me",headers});
  assert.equal(revoked.statusCode,401);
  const reLogin=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId:schoolA,expectedRole:"SCHOOL_STAFF",
      username:"staffsearch",password:"StaffSearchAccess2026!"}});
  assert.equal(reLogin.statusCode,200);
  token=reLogin.json<{accessToken:string}>().accessToken;
  headers={authorization:`Bearer ${token}`};

  const list=await app.inject({method:"GET",
    url:"/v1/staff/directory?query=teacher&group=TEACHER&status=INVITED&sortBy=username&order=desc&pageSize=10",
    headers});
  assert.equal(list.statusCode,200,list.body);
  const found=list.json<{total:number;entries:Array<Record<string,unknown>>;pageSize:number}>();
  assert.equal(found.total,2);
  assert.equal(found.entries.length,2);
  assert.equal(found.entries[0]?.username,"teacheromega");
  assert.equal(found.entries[1]?.username,"teacheralpha");
  assert.equal(found.pageSize,10);
  for(const row of found.entries)
    for(const hidden of ["id","phone","email","passwordHash","accessToken","schoolId","lastLoginAt"]) {
      assert.equal(Object.hasOwn(row,hidden),false,
        "Staff response must be redacted: "+hidden);
    }

  const empty=await app.inject({method:"GET",
    url:"/v1/staff/directory?query=teacher&group=TEACHER&status=ACTIVE",headers});
  assert.equal(empty.statusCode,200);
  assert.equal(empty.json<{total:number}>().total,0);
  const privateField=await app.inject({method:"GET",
    url:"/v1/staff/directory?query=INVITED&group=TEACHER",headers});
  assert.equal(privateField.statusCode,200);
  assert.equal(privateField.json<{total:number}>().total,0,
    "Hidden status strings must never work as staff free-text search");
  const otherSchool=await app.inject({method:"GET",
    url:"/v1/staff/directory?query=teacherother&group=TEACHER",headers});
  assert.equal(otherSchool.statusCode,200);
  assert.equal(otherSchool.json<{total:number}>().total,0);
  for(const url of [
    "/v1/staff/directory?query=teacher&group=SCHOOL_ADMIN",
    "/v1/staff/directory?query=teacher&status=OTHER",
    "/v1/staff/directory?query=teacher&sortBy=lastLoginAt",
    "/v1/staff/directory?query=teacher&order=wrong",
    "/v1/staff/directory?query=teacher&pageSize=500"
  ]) {
    const invalid=await app.inject({method:"GET",url,headers});
    assert.equal(invalid.statusCode,400,url);
  }
});
