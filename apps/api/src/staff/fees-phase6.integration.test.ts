import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  createRegistrationStore,
  createStaffFeeReadStore,
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
import { buildApp } from "../app.js";
import type { AdminPasswordVerificationDelivery } from "../auth/admin-password-2fa.js";

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
    "0028_staff_profiles_permissions.sql",
    "0029_staff_registration_requests.sql",
    "0030_staff_attendance_corrections.sql"
  ]) {
    const sql = await readFile(
      new URL(`../../../../packages/database/drizzle/${file}`, import.meta.url),
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
    registrationStore: createRegistrationStore(db),
    staffFeeReadStore: createStaffFeeReadStore(db),
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

test("Staff Phase 6 — collection permissions, tenant isolation, idempotency, receipt and read-only roles",async(t)=>{
  const {app,client}=await createTestApp();
  t.after(async()=>{await app.close();await client.close();});
  const schoolId=await provisionSchool(app,"STFFEE6");
  const admin={authorization:`Bearer ${await bootstrapAdmin(app,schoolId)}`};
  const year=await app.inject({method:"POST",url:"/v1/admin/academics/years",
    headers:admin,payload:{name:"2026 Staff Fees",startDate:"2026-01-01",endDate:"2026-12-31"}});
  assert.equal(year.statusCode,201,year.body);
  const yearId=year.json<{academicYear:{id:string}}>().academicYear.id;
  const activated=await app.inject({method:"POST",url:`/v1/admin/academics/years/${yearId}/activate`,headers:admin});
  assert.equal(activated.statusCode,200,activated.body);
  const grade=await app.inject({method:"POST",url:"/v1/admin/academics/grades",
    headers:admin,payload:{code:"FEE6",name:"Fee Six",sortOrder:6}});
  assert.equal(grade.statusCode,201,grade.body);
  const gradeId=grade.json<{grade:{id:string}}>().grade.id;
  const klass=await app.inject({method:"POST",url:"/v1/admin/academics/classes",
    headers:admin,payload:{academicYearId:yearId,gradeLevelId:gradeId,code:"FEE6A",name:"Fee Six A"}});
  assert.equal(klass.statusCode,201,klass.body);
  const classId=klass.json<{class:{id:string}}>().class.id;
  const parent=await app.inject({method:"POST",url:"/v1/admin/families/parents",
    headers:admin,payload:{username:"fee6parent",fullName:"Fee Parent"}});
  assert.equal(parent.statusCode,201,parent.body);
  const parentUserId=parent.json<{user:{id:string}}>().user.id;
  const student=await app.inject({method:"POST",url:"/v1/admin/families/students",
    headers:admin,payload:{parentUserId,studentCode:"S-FEE6",fullName:"Fee Student",
      academicYearId:yearId,classId}});
  assert.equal(student.statusCode,201,student.body);
  const studentId=student.json<{student:{id:string}}>().student.id;
  const draft=await app.inject({method:"POST",url:"/v1/admin/fees/invoices",headers:admin,
    payload:{studentId,amount:1500,dueDate:"2026-12-01",description:"School tuition"}});
  assert.equal(draft.statusCode,201,draft.body);
  const invoiceId=draft.json<{invoice:{id:string}}>().invoice.id;
  const issued=await app.inject({method:"POST",url:`/v1/admin/fees/invoices/${invoiceId}/issue`,headers:admin});
  assert.equal(issued.statusCode,200,issued.body);

  const staffUser=await app.inject({method:"POST",url:"/v1/admin/users",headers:admin,
    payload:{username:"fee6cashier",role:"SCHOOL_STAFF"}});
  assert.equal(staffUser.statusCode,201,staffUser.body);
  const {user,temporaryPassword}=staffUser.json<{user:{id:string};temporaryPassword:string}>();
  const login=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId,username:"fee6cashier",expectedRole:"SCHOOL_STAFF",password:temporaryPassword}});
  assert.equal(login.statusCode,200);
  const activatedStaff=await app.inject({method:"POST",url:"/v1/auth/change-temporary-password",
    headers:{authorization:`Bearer ${login.json<{accessToken:string}>().accessToken}`},
    payload:{newPassword:"CashierPhase6Password!"}});
  assert.equal(activatedStaff.statusCode,200,activatedStaff.body);
  const ungranted={authorization:`Bearer ${activatedStaff.json<{accessToken:string}>().accessToken}`};
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/fees/invoices",headers:ungranted})).statusCode,403);
  const profile=await app.inject({method:"PUT",url:`/v1/admin/staff/${user.id}/profile`,headers:admin,
    payload:{fullName:"Staff Cashier",employeeCode:"CASH6",position:"ACCOUNTANT",
      department:"Finance",permissions:["FEES_COLLECT"]}});
  assert.equal(profile.statusCode,200,profile.body);
  // Profile edits revoke existing tokens.
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/fees/invoices",headers:ungranted})).statusCode,401);
  const staffLogin=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId,username:"fee6cashier",expectedRole:"SCHOOL_STAFF",password:"CashierPhase6Password!"}});
  assert.equal(staffLogin.statusCode,200,staffLogin.body);
  const staff={authorization:`Bearer ${staffLogin.json<{accessToken:string}>().accessToken}`};
  const invoices=await app.inject({method:"GET",url:"/v1/staff/fees/invoices?q=Fee%20Student",headers:staff});
  assert.equal(invoices.statusCode,200,invoices.body);
  assert.equal(invoices.headers["cache-control"],"no-store");
  assert.equal(invoices.json<{invoices:Array<{id:string;outstanding:number}>}>().invoices[0]?.id,invoiceId);
  assert.equal(invoices.json<{invoices:Array<{outstanding:number}>}>().invoices[0]?.outstanding,1500);
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/fees/invoices?status=DRAFT",headers:staff})).statusCode,400);
  assert.equal((await app.inject({method:"GET",url:"/v1/admin/fees/invoices",headers:staff})).statusCode,403);
  const paymentUrl=`/v1/staff/fees/invoices/${invoiceId}/payments`;
  const missingKey=await app.inject({method:"POST",url:paymentUrl,headers:staff,
    payload:{amount:200,method:"CASH"}});
  assert.equal(missingKey.statusCode,400,missingKey.body);
  const key=randomUUID(),payment={amount:500,method:"CASH",transactionReference:"CASH6-001",idempotencyKey:key};
  const paid=await app.inject({method:"POST",url:paymentUrl,headers:staff,payload:payment});
  assert.equal(paid.statusCode,201,paid.body);
  const receiptId=paid.json<{receipt:{id:string;amount:number}}>().receipt.id;
  assert.equal(paid.json<{receipt:{id:string;amount:number}}>().receipt.amount,500);
  const retry=await app.inject({method:"POST",url:paymentUrl,headers:staff,payload:payment});
  assert.equal(retry.statusCode,201,retry.body);
  assert.equal(retry.json<{receipt:{id:string}}>().receipt.id,receiptId);
  assert.equal((await app.inject({method:"POST",url:paymentUrl,headers:staff,
    payload:{...payment,amount:100}})).statusCode,409);
  const ledger=await app.inject({method:"GET",url:"/v1/staff/fees/payments",headers:staff});
  assert.equal(ledger.statusCode,200,ledger.body);
  assert.equal(ledger.json<{total:number}>().total,1);
  const receipt=await app.inject({method:"GET",url:`/v1/staff/fees/receipts/${receiptId}`,headers:staff});
  assert.equal(receipt.statusCode,200,receipt.body);
  assert.equal(receipt.json<{receipt:{amount:number}}>().receipt.amount,500);
  const foreign=await app.inject({method:"POST",
    url:`/v1/staff/fees/invoices/${randomUUID()}/payments`,headers:staff,
    payload:{...payment,idempotencyKey:randomUUID()}});
  assert.equal(foreign.statusCode,404,foreign.body);
  const adminPayment=await app.inject({method:"GET",url:"/v1/admin/fees/payments",headers:admin});
  assert.equal(adminPayment.statusCode,200,adminPayment.body);
  assert.equal(adminPayment.json<{total:number}>().total,1);
  const staffCannotReverse=await app.inject({method:"POST",
    url:`/v1/admin/fees/payments/${receiptId}/reverse`,headers:staff,payload:{reason:"Attempt"}});
  assert.equal(staffCannotReverse.statusCode,403);
  const updatedProfile=await app.inject({method:"PUT",url:`/v1/admin/staff/${user.id}/profile`,headers:admin,
    payload:{fullName:"Staff Cashier",employeeCode:"CASH6",position:"ACCOUNTANT",
      department:"Finance",permissions:["FEES_VIEW"]}});
  assert.equal(updatedProfile.statusCode,200,updatedProfile.body);
  const relogin=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId,username:"fee6cashier",expectedRole:"SCHOOL_STAFF",password:"CashierPhase6Password!"}});
  assert.equal(relogin.statusCode,200,relogin.body);
  const viewer={authorization:`Bearer ${relogin.json<{accessToken:string}>().accessToken}`};
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/fees/invoices",headers:viewer})).statusCode,200);
  assert.equal((await app.inject({method:"GET",url:`/v1/staff/fees/receipts/${receiptId}`,headers:viewer})).statusCode,200);
  assert.equal((await app.inject({method:"POST",url:paymentUrl,headers:viewer,
    payload:{...payment,idempotencyKey:randomUUID()}})).statusCode,403);
});
