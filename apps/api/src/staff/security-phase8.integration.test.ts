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
  createStaffWorkflowStore,
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
    "0030_staff_attendance_corrections.sql",
    "0031_staff_workflow.sql"
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
    staffWorkflowStore: createStaffWorkflowStore(db),
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

test("Staff Phase 8 — full school isolation, denial matrix and resubmission notification integrity",async t=>{
  const {app,client}=await createTestApp();
  t.after(async()=>{await app.close();await client.close();});
  const schoolA=await provisionSchool(app,"STAFF8-A");
  const schoolB=await provisionSchool(app,"STAFF8-B");
  const adminA={authorization:`Bearer ${await bootstrapAdmin(app,schoolA)}`};
  const adminB={authorization:`Bearer ${await bootstrapAdmin(app,schoolB)}`};
  const makeStaff=async(schoolId:string,admin:typeof adminA,username:string)=>{
    const created=await app.inject({method:"POST",url:"/v1/admin/users",headers:admin,
      payload:{username,role:"SCHOOL_STAFF"}});
    assert.equal(created.statusCode,201,created.body);
    const {user,temporaryPassword}=created.json<{user:{id:string};temporaryPassword:string}>();
    const login=await app.inject({method:"POST",url:"/v1/auth/login",
      payload:{schoolId,username,expectedRole:"SCHOOL_STAFF",password:temporaryPassword}});
    assert.equal(login.statusCode,200,login.body);
    const changed=await app.inject({method:"POST",url:"/v1/auth/change-temporary-password",
      headers:{authorization:`Bearer ${login.json<{accessToken:string}>().accessToken}`},
      payload:{newPassword:"PhaseEightSecure2026!"}});
    assert.equal(changed.statusCode,200,changed.body);
    const initial={authorization:`Bearer ${changed.json<{accessToken:string}>().accessToken}`};
    assert.equal((await app.inject({method:"GET",url:"/v1/staff/tasks",headers:initial})).statusCode,403);
    // The administrator must explicitly grant tasks and communication rights.
    const updated=await app.inject({method:"PUT",url:`/v1/admin/staff/${user.id}/profile`,headers:admin,
      payload:{fullName:"Phase Eight "+username,employeeCode:username,position:"ADMIN_ASSISTANT",
        department:"Operations",permissions:["TASKS_VIEW","COMMUNICATION_DRAFT"]}});
    assert.equal(updated.statusCode,200,updated.body);
    assert.equal((await app.inject({method:"GET",url:"/v1/staff/tasks",headers:initial})).statusCode,401);
    const reauth=await app.inject({method:"POST",url:"/v1/auth/login",payload:{
      schoolId,username,password:"PhaseEightSecure2026!",expectedRole:"SCHOOL_STAFF"
    }});
    assert.equal(reauth.statusCode,200,reauth.body);
    return {id:user.id,headers:{authorization:`Bearer ${reauth.json<{accessToken:string}>().accessToken}`}};
  };
  const a=await makeStaff(schoolA,adminA,"staff8a");
  const b=await makeStaff(schoolB,adminB,"staff8b");
  const noAuth=await app.inject({method:"GET",url:"/v1/staff/work-notifications"});
  assert.equal(noAuth.statusCode,401);
  assert.equal((await app.inject({method:"GET",url:"/v1/admin/staff-work/tasks",headers:a.headers})).statusCode,403);
  assert.equal((await app.inject({method:"POST",url:"/v1/admin/announcements",headers:a.headers,
    payload:{title:"Unauthorized",content:"Cannot publish",audienceScope:"SCHOOL"}})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/tasks",headers:adminA})).statusCode,403);

  const taskCreate=await app.inject({method:"POST",url:"/v1/admin/staff-work/tasks",
    headers:adminA,payload:{assignedTo:a.id,title:"Check school rosters",
      details:"Verify enrollments for October.",priority:"HIGH",dueDate:"2026-10-23"}});
  assert.equal(taskCreate.statusCode,201,taskCreate.body);
  const task=taskCreate.json<{task:{id:string;updatedAt:string}}>().task;
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/tasks",headers:a.headers}))
    .json<{tasks:Array<{id:string}>}>().tasks[0]?.id,task.id);
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/tasks",headers:b.headers}))
    .json<{tasks:unknown[]}>().tasks.length,0);
  assert.equal((await app.inject({method:"PATCH",url:`/v1/staff/tasks/${task.id}`,headers:b.headers,
    payload:{status:"DONE",expectedUpdatedAt:task.updatedAt}})).statusCode,404);
  assert.equal((await app.inject({method:"POST",
    url:`/v1/admin/staff-work/tasks/${task.id}/cancel`,headers:adminB})).statusCode,404);
  assert.equal((await app.inject({method:"PATCH",url:`/v1/staff/tasks/${task.id}`,headers:a.headers,
    payload:{status:"CANCELLED",expectedUpdatedAt:task.updatedAt}})).statusCode,400);
  const cancelled=await app.inject({method:"POST",
    url:`/v1/admin/staff-work/tasks/${task.id}/cancel`,headers:adminA});
  assert.equal(cancelled.statusCode,200,cancelled.body);
  assert.equal(cancelled.json<{task:{status:string}}>().task.status,"CANCELLED");
  assert.equal((await app.inject({method:"PATCH",url:`/v1/staff/tasks/${task.id}`,headers:a.headers,
    payload:{status:"DONE",expectedUpdatedAt:task.updatedAt}})).statusCode,409);

  const incoming=await app.inject({method:"POST",url:"/v1/staff/message-drafts",headers:a.headers,
    payload:{title:"Class meeting reminder",content:"Parents meeting this week in the school office.",
      audienceScope:"ROLE",audienceRole:"PARENT"}});
  assert.equal(incoming.statusCode,201,incoming.body);
  const draft=incoming.json<{draft:{id:string;updatedAt:string}}>().draft;
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/message-drafts",headers:b.headers}))
    .json<{drafts:unknown[]}>().drafts.length,0);
  assert.equal((await app.inject({method:"PUT",url:`/v1/staff/message-drafts/${draft.id}`,headers:b.headers,
    payload:{title:"Takeover",content:"Attempted cross school edit.",audienceScope:"SCHOOL",
      audienceRole:null,expectedUpdatedAt:draft.updatedAt}})).statusCode,404);
  assert.equal((await app.inject({method:"POST",url:`/v1/staff/message-drafts/${draft.id}/submit`,
    headers:b.headers})).statusCode,409);
  assert.equal((await app.inject({method:"POST",url:`/v1/admin/staff-work/drafts/${draft.id}/decision`,
    headers:adminB,payload:{action:"APPROVE",note:""}})).statusCode,409);
  assert.equal((await app.inject({method:"POST",url:"/v1/staff/message-drafts",headers:a.headers,
    payload:{title:"Bad audience",content:"This should not be saved",
      audienceScope:"ROLE",audienceRole:null}})).statusCode,400);
  const submitted=await app.inject({method:"POST",url:`/v1/staff/message-drafts/${draft.id}/submit`,
    headers:a.headers});
  assert.equal(submitted.statusCode,200,submitted.body);
  const initialAdminAlert=await client.query<{id:string,dedup_key:string}>(
    `SELECT id,dedup_key FROM notifications WHERE school_id='${schoolA}'
       AND dedup_key LIKE 'staff-message:%' AND type='STAFF_WORKFLOW'`);
  assert.equal(initialAdminAlert.rows.length,1);
  const rejection=await app.inject({method:"POST",
    url:`/v1/admin/staff-work/drafts/${draft.id}/decision`,headers:adminA,
    payload:{action:"REJECT",note:"Please include the meeting date"}});
  assert.equal(rejection.statusCode,200,rejection.body);
  const rejected=rejection.json<{draft:{updatedAt:string;status:string}}>().draft;
  assert.equal(rejected.status,"REJECTED");
  const revision=await app.inject({method:"PUT",
    url:`/v1/staff/message-drafts/${draft.id}`,headers:a.headers,
    payload:{title:"Class meeting reminder",content:"Parents meeting on Saturday 24 October.",
      audienceScope:"ROLE",audienceRole:"PARENT",expectedUpdatedAt:rejected.updatedAt}});
  assert.equal(revision.statusCode,200,revision.body);
  const again=await app.inject({method:"POST",url:`/v1/staff/message-drafts/${draft.id}/submit`,
    headers:a.headers});
  assert.equal(again.statusCode,200,again.body);
  const nextAdminAlert=await client.query<{id:string,dedup_key:string}>(
    `SELECT id,dedup_key FROM notifications WHERE school_id='${schoolA}'
      AND dedup_key LIKE 'staff-message:%' AND type='STAFF_WORKFLOW'`);
  assert.equal(nextAdminAlert.rows.length,2,
    "A resubmitted draft must create a new administrator notification.");
  assert.notEqual(nextAdminAlert.rows[0]!.dedup_key,nextAdminAlert.rows[1]!.dedup_key);
  const approved=await app.inject({method:"POST",
    url:`/v1/admin/staff-work/drafts/${draft.id}/decision`,headers:adminA,
    payload:{action:"APPROVE",note:"Copy reviewed."}});
  assert.equal(approved.statusCode,200,approved.body);
  const staffAlerts=await app.inject({method:"GET",url:"/v1/staff/work-notifications",headers:a.headers});
  assert.equal(staffAlerts.statusCode,200,staffAlerts.body);
  const notices=staffAlerts.json<{notifications:Array<{id:string;title:string}>}>().notifications;
  assert.ok(notices.filter(x=>x.title==="Communication draft reviewed").length>=2,
    "Both rejection and subsequent approval should notify the author.");
  const foreignNotices=await app.inject({method:"GET",url:"/v1/staff/work-notifications",headers:b.headers});
  assert.equal(foreignNotices.statusCode,200,foreignNotices.body);
  assert.ok(!foreignNotices.body.includes("Class meeting reminder"));
  assert.equal((await app.inject({method:"POST",
    url:`/v1/staff/work-notifications/${notices[0]!.id}/read`,headers:b.headers})).statusCode,404);
  const overview=await app.inject({method:"GET",url:"/v1/admin/communication",headers:adminA});
  assert.equal(overview.statusCode,200);
  assert.ok(!overview.body.includes("Parents meeting on Saturday 24 October."));
  const revoked=await app.inject({method:"POST",url:`/v1/admin/users/${a.id}/suspend`,
    headers:adminA,payload:{reason:"Phase 8 security test"}});
  assert.equal(revoked.statusCode,200,revoked.body);
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/work-preferences",headers:a.headers})).statusCode,401);
});
