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

test("Staff Phase 7 — scoped assignments, draft review, notifications and settings",async t=>{
  const {app,client}=await createTestApp();
  t.after(async()=>{await app.close();await client.close();});
  const a=await provisionSchool(app,"WORK-P7-A");
  const b=await provisionSchool(app,"WORK-P7-B");
  const adminA={authorization:`Bearer ${await bootstrapAdmin(app,a)}`};
  const adminB={authorization:`Bearer ${await bootstrapAdmin(app,b)}`};
  const made=await app.inject({method:"POST",url:"/v1/admin/users",
    headers:adminA,payload:{username:"staffphase7",role:"SCHOOL_STAFF"}});
  assert.equal(made.statusCode,201,made.body);
  const {user,temporaryPassword}=made.json<{user:{id:string};temporaryPassword:string}>();
  const first=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId:a,username:"staffphase7",expectedRole:"SCHOOL_STAFF",password:temporaryPassword}});
  assert.equal(first.statusCode,200,first.body);
  const changed=await app.inject({method:"POST",url:"/v1/auth/change-temporary-password",
    headers:{authorization:`Bearer ${first.json<{accessToken:string}>().accessToken}`},
    payload:{newPassword:"PhaseSevenSecure2026!"}});
  assert.equal(changed.statusCode,200,changed.body);
  const before={authorization:`Bearer ${changed.json<{accessToken:string}>().accessToken}`};
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/tasks",headers:before})).statusCode,403);
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/message-drafts",headers:before})).statusCode,403);
  const granted=await app.inject({method:"PUT",url:`/v1/admin/staff/${user.id}/profile`,
    headers:adminA,payload:{fullName:"Operations Staff",employeeCode:"OPS-7",position:"ADMIN_ASSISTANT",
      department:"Office",permissions:["TASKS_VIEW","COMMUNICATION_DRAFT"]}});
  assert.equal(granted.statusCode,200,granted.body);
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/tasks",headers:before})).statusCode,401);
  const login=await app.inject({method:"POST",url:"/v1/auth/login",
    payload:{schoolId:a,username:"staffphase7",expectedRole:"SCHOOL_STAFF",password:"PhaseSevenSecure2026!"}});
  assert.equal(login.statusCode,200,login.body);
  const staff={authorization:`Bearer ${login.json<{accessToken:string}>().accessToken}`};

  const directory=await app.inject({method:"GET",url:"/v1/admin/staff-work/tasks",headers:adminA});
  assert.equal(directory.statusCode,200,directory.body);
  assert.equal(directory.json<{staff:Array<{id:string}>}>().staff[0]?.id,user.id);
  assert.equal((await app.inject({method:"GET",url:"/v1/admin/staff-work/tasks",headers:staff})).statusCode,403);
  const url="/v1/admin/staff-work/tasks";
  const create={assignedTo:user.id,title:"Check school enrollment folders",details:"Verify missing signatures",
    priority:"HIGH",dueDate:"2026-11-10"};
  assert.equal((await app.inject({method:"POST",url,headers:adminB,payload:create})).statusCode,400);
  assert.equal((await app.inject({method:"POST",url,headers:staff,payload:create})).statusCode,403);
  const taskCreated=await app.inject({method:"POST",url,headers:adminA,payload:create});
  assert.equal(taskCreated.statusCode,201,taskCreated.body);
  const task=taskCreated.json<{task:{id:string;status:string;updatedAt:string}}>().task;
  assert.equal(task.status,"TODO");
  const staffTasks=await app.inject({method:"GET",url:"/v1/staff/tasks",headers:staff});
  assert.equal(staffTasks.statusCode,200,staffTasks.body);
  assert.equal(staffTasks.headers["cache-control"],"no-store");
  assert.equal(staffTasks.json<{tasks:Array<{id:string}>}>().tasks[0]?.id,task.id);
  assert.equal((await app.inject({method:"GET",url:"/v1/admin/staff-work/tasks",headers:adminB})).json<{tasks:unknown[]}>().tasks.length,0);
  const transition=await app.inject({method:"PATCH",url:`/v1/staff/tasks/${task.id}`,headers:staff,
    payload:{status:"IN_PROGRESS",expectedUpdatedAt:task.updatedAt}});
  assert.equal(transition.statusCode,200,transition.body);
  assert.equal(transition.json<{task:{status:string}}>().task.status,"IN_PROGRESS");
  assert.equal((await app.inject({method:"PATCH",url:`/v1/staff/tasks/${task.id}`,headers:staff,
    payload:{status:"DONE",expectedUpdatedAt:task.updatedAt}})).statusCode,409);
  assert.equal((await app.inject({method:"PATCH",url:`/v1/staff/tasks/${randomUUID()}`,headers:staff,
    payload:{status:"DONE",expectedUpdatedAt:task.updatedAt}})).statusCode,404);

  const own=await app.inject({method:"GET",url:"/v1/staff/work-preferences",headers:staff});
  assert.equal(own.statusCode,200,own.body);
  assert.equal(own.json<{preferences:{showNotificationBadge:boolean}}>().preferences.showNotificationBadge,true);
  const saved=await app.inject({method:"PUT",url:"/v1/staff/work-preferences",headers:staff,
    payload:{showNotificationBadge:false,compactTaskView:true}});
  assert.equal(saved.statusCode,200,saved.body);
  assert.equal((await app.inject({method:"GET",url:"/v1/staff/work-preferences",headers:staff}))
    .json<{preferences:{compactTaskView:boolean}}>().preferences.compactTaskView,true);
  assert.equal((await app.inject({method:"PUT",url:"/v1/staff/work-preferences",headers:staff,
    payload:{showNotificationBadge:false,compactTaskView:true,isAdmin:true}})).statusCode,400);

  const draftInput={title:"Parent event reminder",content:"School sports day is next week.",
    audienceScope:"ROLE",audienceRole:"PARENT"};
  const draftCreated=await app.inject({method:"POST",url:"/v1/staff/message-drafts",
    headers:staff,payload:draftInput});
  assert.equal(draftCreated.statusCode,201,draftCreated.body);
  const draft=draftCreated.json<{draft:{id:string;updatedAt:string;status:string}}>().draft;
  assert.equal(draft.status,"DRAFT");
  assert.equal((await app.inject({method:"POST",url:"/v1/staff/message-drafts",
    headers:staff,payload:{...draftInput,audienceScope:"SCHOOL",audienceRole:"PARENT"}})).statusCode,400);
  const edit=await app.inject({method:"PUT",url:`/v1/staff/message-drafts/${draft.id}`,
    headers:staff,payload:{...draftInput,content:"School sports day will be on Saturday.",
      expectedUpdatedAt:draft.updatedAt}});
  assert.equal(edit.statusCode,200,edit.body);
  const submitted=await app.inject({method:"POST",
    url:`/v1/staff/message-drafts/${draft.id}/submit`,headers:staff});
  assert.equal(submitted.statusCode,200,submitted.body);
  assert.equal(submitted.json<{draft:{status:string}}>().draft.status,"SUBMITTED");
  assert.equal((await app.inject({method:"POST",url:`/v1/staff/message-drafts/${draft.id}/submit`,headers:staff})).statusCode,409);
  assert.equal((await app.inject({method:"PUT",url:`/v1/staff/message-drafts/${draft.id}`,
    headers:staff,payload:{...draftInput,expectedUpdatedAt:edit.json<{draft:{updatedAt:string}}>().draft.updatedAt}})).statusCode,409);
  assert.equal((await app.inject({method:"GET",url:"/v1/admin/staff-work/drafts",headers:adminB})).json<{drafts:unknown[]}>().drafts.length,0);
  assert.equal((await app.inject({method:"POST",url:`/v1/admin/staff-work/drafts/${draft.id}/decision`,
    headers:adminB,payload:{action:"APPROVE",note:""}})).statusCode,409);
  assert.equal((await app.inject({method:"POST",url:`/v1/admin/staff-work/drafts/${draft.id}/decision`,
    headers:staff,payload:{action:"APPROVE",note:""}})).statusCode,403);
  const approved=await app.inject({method:"POST",
    url:`/v1/admin/staff-work/drafts/${draft.id}/decision`,headers:adminA,
    payload:{action:"APPROVE",note:"Ready for administrator publication"}});
  assert.equal(approved.statusCode,200,approved.body);
  assert.equal(approved.json<{draft:{status:string}}>().draft.status,"APPROVED");
  assert.equal((await app.inject({method:"POST",
    url:`/v1/admin/staff-work/drafts/${draft.id}/decision`,headers:adminA,
    payload:{action:"APPROVE",note:""}})).statusCode,409);
  const overview=await app.inject({method:"GET",url:"/v1/admin/communication",headers:adminA});
  assert.equal(overview.statusCode,200,overview.body);
  // Approving a staff draft MUST NOT publish any school announcement.
  assert.ok(!overview.body.includes("School sports day will be on Saturday."));

  const notices=await app.inject({method:"GET",url:"/v1/staff/work-notifications",headers:staff});
  assert.equal(notices.statusCode,200,notices.body);
  const {notifications}=notices.json<{notifications:Array<{id:string;readAt:string|null}>}>();
  assert.ok(notifications.length>=2);
  assert.ok(notifications.every(x=>x.readAt===null));
  const marked=await app.inject({method:"POST",
    url:`/v1/staff/work-notifications/${notifications[0]!.id}/read`,headers:staff});
  assert.equal(marked.statusCode,200,marked.body);
  const denied=await app.inject({method:"POST",
    url:`/v1/staff/work-notifications/${randomUUID()}/read`,headers:staff});
  assert.equal(denied.statusCode,404,denied.body);
});
