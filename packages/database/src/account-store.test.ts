import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createAccountStore,
  createSchoolStore,
  type FoundationDatabase
} from "./index.js";
import * as schema from "./schema.js";

async function createTestDatabase() {
  const client = new PGlite();
  for (const file of ["0000_phase1_foundation.sql", "0001_phase2_auth_accounts.sql", "0008_phase8_pilot_readiness.sql",
    "0009_school_image.sql"]) {
    const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    await client.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }
  const db = drizzle(client, { schema });
  return {
    client,
    db: db as unknown as FoundationDatabase
  };
}

test("the same username can exist in different schools but not twice in one school", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());

  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const schoolA = await schools.createSchool({
    code: "A",
    name: "School A",
    slug: "school-a",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });
  const schoolB = await schools.createSchool({
    code: "B",
    name: "School B",
    slug: "school-b",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "ps-AF"
  });

  const userA = await accounts.createUser({
    schoolId: schoolA.school.id,
    username: "parent.one",
    passwordHash: "test-hash-a",
    role: "PARENT"
  });
  const userB = await accounts.createUser({
    schoolId: schoolB.school.id,
    username: "parent.one",
    passwordHash: "test-hash-b",
    role: "PARENT"
  });

  assert.notEqual(userA.id, userB.id);
  assert.equal((await accounts.findUserForLogin(schoolA.school.id, "parent.one"))?.user.id, userA.id);
  assert.equal((await accounts.findUserForLogin(schoolB.school.id, "parent.one"))?.user.id, userB.id);

  await assert.rejects(
    accounts.createUser({
      schoolId: schoolA.school.id,
      username: "parent.one",
      passwordHash: "duplicate",
      role: "PARENT"
    }),
    /already exists/i
  );
});

test("status transitions revoke sessions including across reactivation", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());

  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const school = await schools.createSchool({
    code: "SESSION",
    name: "Session School",
    slug: "session-school",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });
  const user = await accounts.createUser({
    schoolId: school.school.id,
    username: "teacher.one",
    passwordHash: "test-hash",
    role: "TEACHER"
  });

  await accounts.createSession({
    schoolId: school.school.id,
    userId: user.id,
    accessTokenHash: "a".repeat(64),
    refreshTokenHash: "b".repeat(64),
    accessExpiresAt: new Date(Date.now() + 60_000),
    refreshExpiresAt: new Date(Date.now() + 120_000)
  });

  assert.ok(await accounts.findByAccessTokenHash("a".repeat(64)));
  await accounts.setUserStatus(school.school.id, user.id, "SUSPENDED");
  assert.equal(await accounts.findByAccessTokenHash("a".repeat(64)), null);
  assert.equal(await accounts.findByRefreshTokenHash("b".repeat(64)), null);
  await accounts.createSession({
    schoolId: school.school.id,
    userId: user.id,
    accessTokenHash: "c".repeat(64),
    refreshTokenHash: "d".repeat(64),
    accessExpiresAt: new Date(Date.now() + 60_000),
    refreshExpiresAt: new Date(Date.now() + 120_000)
  });
  await accounts.setUserStatus(school.school.id, user.id, "ACTIVE");
  assert.equal(await accounts.findByAccessTokenHash("c".repeat(64)), null);
  assert.equal(await accounts.findByRefreshTokenHash("d".repeat(64)), null);
});

test("admin status transition stores suspension reason and tenant-filtered account audit", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());
  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const schoolA = await schools.createSchool({
    code: "AUD-A", name: "Audit School A", slug: "audit-school-a", province: "Kabul", city: "Kabul", defaultLanguage: "fa-AF"
  });
  const schoolB = await schools.createSchool({
    code: "AUD-B", name: "Audit School B", slug: "audit-school-b", province: "Kabul", city: "Kabul", defaultLanguage: "fa-AF"
  });
  const userA = await accounts.createUser({
    schoolId: schoolA.school.id, username: "student-a", passwordHash: "hash-a", role: "STUDENT"
  });
  const userB = await accounts.createUser({
    schoolId: schoolB.school.id, username: "student-b", passwordHash: "hash-b", role: "STUDENT"
  });
  await accounts.writeAudit({
    schoolId: schoolA.school.id, actorUserId: userA.id, action: "user.created", entityType: "user", entityId: userA.id
  });
  await accounts.writeAudit({
    schoolId: schoolB.school.id, actorUserId: userB.id, action: "user.created", entityType: "user", entityId: userB.id
  });
  await accounts.createSession({
    schoolId: schoolA.school.id, userId: userA.id, accessTokenHash: "e".repeat(64), refreshTokenHash: "f".repeat(64),
    accessExpiresAt: new Date(Date.now() + 60_000), refreshExpiresAt: new Date(Date.now() + 120_000)
  });
  await accounts.setUserStatusAsAdmin(schoolA.school.id, userA.id, "SUSPENDED", userA.id, "user.suspended", "Needs review");
  assert.equal(await accounts.findByAccessTokenHash("e".repeat(64)), null);
  const logs = await accounts.listAccountAuditLogs(schoolA.school.id, userA.id);
  assert.ok(logs.some((row) => row.action === "user.suspended" && row.reason === "Needs review"));
  assert.ok(logs.some((row) => row.action === "user.created"));
  assert.ok(logs.every((row) => row.action !== "password_hash" && row.reason !== "hash-a"));
  assert.deepEqual(await accounts.listAccountAuditLogs(schoolB.school.id, userA.id), []);
  assert.deepEqual(await accounts.listAccountAuditLogs(schoolA.school.id, userB.id), []);
  await accounts.createSession({
    schoolId: schoolA.school.id, userId: userA.id, accessTokenHash: "1".repeat(64), refreshTokenHash: "2".repeat(64),
    accessExpiresAt: new Date(Date.now() + 60_000), refreshExpiresAt: new Date(Date.now() + 120_000)
  });
  await accounts.setUserStatusAsAdmin(schoolA.school.id, userA.id, "ACTIVE", userA.id, "user.reactivated");
  assert.equal(await accounts.findByAccessTokenHash("1".repeat(64)), null);
  assert.equal(await accounts.findByRefreshTokenHash("2".repeat(64)), null);
});
