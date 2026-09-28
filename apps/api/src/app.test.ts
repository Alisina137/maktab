import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createAccountStore,
  createSchoolStore,
  databaseSchema,
  type FoundationDatabase
} from "@maktablink/database";
import { buildApp } from "./app.js";

const provisioningKey = "phase-2-test-provisioning-key";

async function createTestApp() {
  const client = new PGlite();
  for (const file of ["0000_phase1_foundation.sql", "0001_phase2_auth_accounts.sql"]) {
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

  const bootstrap = await app.inject({
    method: "POST",
    url: `/v1/platform/schools/${schoolA}/admin`,
    headers: { "x-platform-provisioning-key": provisioningKey },
    payload: { username: "admin" }
  });
  assert.equal(bootstrap.statusCode, 201);
  const adminTemporaryPassword = bootstrap.json<{ temporaryPassword: string }>().temporaryPassword;

  const adminLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: {
      schoolId: schoolA,
      expectedRole: "SCHOOL_ADMIN",
      username: "admin",
      password: adminTemporaryPassword
    }
  });
  assert.equal(adminLogin.statusCode, 200);
  const adminLoginBody = adminLogin.json<{ accessToken: string; mustChangePassword: boolean }>();
  assert.equal(adminLoginBody.mustChangePassword, true);

  const adminChange = await app.inject({
    method: "POST",
    url: "/v1/auth/change-temporary-password",
    headers: { authorization: `Bearer ${adminLoginBody.accessToken}` },
    payload: { newPassword: "AdminSecure2026!" }
  });
  assert.equal(adminChange.statusCode, 200);
  const adminSession = adminChange.json<{ accessToken: string }>();

  const createParent = await app.inject({
    method: "POST",
    url: "/v1/admin/users",
    headers: { authorization: `Bearer ${adminSession.accessToken}` },
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
    headers: { authorization: `Bearer ${adminSession.accessToken}` }
  });
  assert.equal(suspend.statusCode, 200);

  const meAfterSuspend = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: { authorization: `Bearer ${parentSession.accessToken}` }
  });
  assert.equal(meAfterSuspend.statusCode, 401);
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
