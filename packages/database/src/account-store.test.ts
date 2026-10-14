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
  for (const file of ["0000_phase1_foundation.sql", "0001_phase2_auth_accounts.sql",
    "0002_phase3_academic_structure.sql", "0003_phase4_student_family.sql",
    "0004_phase4_parent_profile_backfill.sql", "0008_phase8_pilot_readiness.sql",
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


test("Phase 5 directory paging, school counts, server filters and sorting are isolated", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());
  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const a = await schools.createSchool({
    code: "PAGED-A", name: "Paged School A", slug: "paged-a", province: "Kabul", city: "Kabul", defaultLanguage: "en"
  });
  const b = await schools.createSchool({
    code: "PAGED-B", name: "Paged School B", slug: "paged-b", province: "Kabul", city: "Kabul", defaultLanguage: "en"
  });
  const school = a.school.id, foreign = b.school.id;
  const add = (username: string, role: "TEACHER" | "PARENT" | "SCHOOL_STAFF" | "STUDENT", schoolId = school) =>
    accounts.createUser({ schoolId, username, role, passwordHash: "hash" });
  const teacher = await add("teacher001", "TEACHER");
  await add("parent001", "PARENT");
  await add("staff001", "SCHOOL_STAFF");
  await add("student001", "STUDENT");
  await add("teacher001", "TEACHER", foreign);
  await accounts.setUserStatus(school, teacher.id, "ACTIVE");
  const query = {
    query: "", group: "ALL" as const, status: "ALL" as const, highlight: "ALL" as const,
    sortBy: "username" as const, order: "asc" as const, page: 1, pageSize: 2
  };
  const first = await accounts.searchUserDirectory(school, query);
  assert.equal(first.total, 4);
  assert.equal(first.pages, 2);
  assert.equal(first.entries.length, 2);
  assert.deepEqual(first.entries.map(x => x.user.username), ["parent001", "staff001"]);
  assert.deepEqual(first.counts, {
    total: 4, active: 1, pending: 4, suspended: 0,
    parent: 1, teacher: 1, student: 1, staff: 1
  });
  assert.equal((await accounts.searchUserDirectory(school, { ...query, page: 2 })).entries.length, 2);
  assert.deepEqual((await accounts.searchUserDirectory(school, { ...query, order: "desc" })).entries.map(x => x.user.username),
    ["teacher001", "student001"]);
  assert.deepEqual((await accounts.searchUserDirectory(school, { ...query, group: "TEACHER" })).entries.map(x => x.user.id),
    [teacher.id]);
  assert.equal((await accounts.searchUserDirectory(school, { ...query, group: "STAFF" })).total, 1);
  assert.equal((await accounts.searchUserDirectory(school, { ...query, highlight: "PENDING" })).total, 4);
  assert.equal((await accounts.searchUserDirectory(school, { ...query, query: "student001" })).total, 1);
  assert.equal((await accounts.searchUserDirectory(school, { ...query, query: "%" })).total, 0);
  assert.equal((await accounts.searchUserDirectory(foreign, query)).total, 1);
  assert.equal(await accounts.usernameExists(school, "TEACHER001"), true);
  assert.equal(await accounts.usernameExists(foreign, "parent001"), false);
});

test("Phase 5 batch actions are atomic, bounded, audited and protect other schools and admins", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());
  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const a = await schools.createSchool({
    code: "BATCH-A", name: "Batch School A", slug: "batch-a", province: "Kabul", city: "Kabul", defaultLanguage: "en"
  });
  const b = await schools.createSchool({
    code: "BATCH-B", name: "Batch School B", slug: "batch-b", province: "Kabul", city: "Kabul", defaultLanguage: "en"
  });
  const school = a.school.id, foreign = b.school.id;
  const add = (username: string, role: "TEACHER" | "PARENT" | "SCHOOL_ADMIN", schoolId = school) =>
    accounts.createUser({ schoolId, username, role, passwordHash: "hash" });
  const admin = await add("admin-batch", "SCHOOL_ADMIN");
  const one = await add("teacher-batch", "TEACHER");
  const two = await add("parent-batch", "PARENT");
  const foreignUser = await add("foreign-batch", "TEACHER", foreign);
  await accounts.createSession({
    schoolId: school, userId: one.id, accessTokenHash: "a".repeat(64), refreshTokenHash: "b".repeat(64),
    accessExpiresAt: new Date(Date.now()+60000), refreshExpiresAt: new Date(Date.now()+120000)
  });
  await assert.rejects(
    accounts.bulkSetUserStatusAsAdmin(school, [one.id, foreignUser.id], "suspend", admin.id),
    /eligible/i
  );
  assert.equal((await accounts.findUserById(school, one.id))?.status, "INVITED");
  await assert.rejects(accounts.bulkSetUserStatusAsAdmin(school, [admin.id], "suspend", admin.id), /eligible/i);
  await assert.rejects(accounts.bulkSetUserStatusAsAdmin(school, [one.id, one.id], "suspend", admin.id), /distinct/i);
  const updated = await accounts.bulkSetUserStatusAsAdmin(
    school, [one.id, two.id], "suspend", admin.id, "Approved administrative account review"
  );
  assert.equal(updated.length, 2);
  assert.ok(updated.every(u=>u.status==="SUSPENDED"));
  assert.equal(await accounts.findByAccessTokenHash("a".repeat(64)), null);
  const logs = await accounts.listAccountAuditLogs(school, one.id);
  assert.ok(logs.some(l=>l.action==="user.suspended" && l.reason==="Approved administrative account review"));
  await assert.rejects(accounts.bulkSetUserStatusAsAdmin(school, [one.id, two.id], "suspend", admin.id), /eligible/i);
  const returned = await accounts.bulkSetUserStatusAsAdmin(school, [one.id,two.id], "reactivate", admin.id);
  assert.equal(returned.length,2);
  assert.ok(returned.every(u=>u.status==="INVITED"));
  assert.equal((await accounts.findUserById(foreign, foreignUser.id))?.status,"INVITED");
});
