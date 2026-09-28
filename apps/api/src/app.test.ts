import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createAcademicStore,
  createAccountStore,
  createAttendanceStore,
  createFamilyStore,
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
    "0002_phase3_academic_structure.sql",
    "0003_phase4_student_family.sql",
    "0004_phase4_parent_profile_backfill.sql",
    "0005_phase5_attendance.sql"
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
    familyStore: createFamilyStore(db),
    attendanceStore: createAttendanceStore(db),
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

  const genericParent = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: { authorization: `Bearer ${adminAccessToken}` },
    payload: { username: "legacy.parent", role: "PARENT" }
  });
  assert.equal(genericParent.statusCode, 400);
  assert.equal(genericParent.json<{ error: string }>().error, "parent_family_workflow_required");

  const createParent = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: { authorization: `Bearer ${adminAccessToken}` },
    payload: { username: "parent.one", fullName: "Parent One" }
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

  const parentResponse = await app.inject({
    method: "POST",
    url: "/v1/admin/families/parents",
    headers: auth,
    payload: { username: "family.parent", fullName: "Family Parent", phone: "0700000000" }
  });
  assert.equal(parentResponse.statusCode, 201);
  const parent = parentResponse.json<{
    user: { id: string };
    temporaryPassword: string;
  }>();

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
  }

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId,
      expectedRole: "PARENT",
      username: "family.parent",
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
    payload: { username: "import.parent", fullName: "Import Parent" }
  });
  assert.equal(parentResponse.statusCode, 201);

  const rows = [
    { code: "IMP-001", name: "Student One", parent: "import.parent", year: "1405", class: "8A" },
    { code: "IMP-001", name: "Student Duplicate", parent: "import.parent", year: "1405", class: "8A" }
  ];
  const validation = await app.inject({
    method: "POST",
    url: "/v1/admin/families/import/validate",
    headers: auth,
    payload: {
      entityType: "STUDENT",
      rows,
      mapping: {
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
    payload: { username: "attendance.parent", fullName: "Attendance Parent" }
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
      username: "attendance.parent",
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
