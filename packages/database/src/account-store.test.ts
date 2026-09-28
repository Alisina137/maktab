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
  for (const file of ["0000_phase1_foundation.sql", "0001_phase2_auth_accounts.sql"]) {
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

test("suspending a user revokes existing sessions", async (t) => {
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
});
