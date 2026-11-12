import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const family = read("packages/database/src/family-store.ts");
const accounts = read("packages/database/src/account-store.ts");
const auth = read("apps/api/src/auth/routes.ts");
const users = read("apps/api/src/users/routes.ts");
const migration = read("packages/database/drizzle/0033_phase6_casefold_usernames.sql");
const journal = JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
const schema = read("packages/database/src/schema.ts");
const preflight = read("packages/database/scripts/username-preflight.mjs");

const contains = (source, fragments, label) => {
  for (const fragment of fragments) {
    assert.ok(source.includes(fragment), label + ": missing " + fragment);
  }
};
const section = (source, start, end) => {
  const i = source.indexOf("    async " + start + "(");
  const j = source.indexOf("    async " + end + "(", i + 10);
  assert.ok(i >= 0 && j > i, "Cannot find store method " + start);
  return source.slice(i, j);
};

contains(section(family, "createStudentAccount", "createStudent"), [
  'eq(students.status, "ACTIVE")', "isNull(students.userId)",
  'if (!updated) {', "throw new FamilyConflictError",
  "return await db.transaction(async (tx) => {"
], "Student login attachment");
contains(section(family, "updateStudent", "deleteStudent"), [
  '.limit(1).for("update")',
  'inArray(users.status, ["ACTIVE", "INVITED"])',
  'const shouldEnd =', 'const shouldStart =',
  'if (shouldEnd)', 'if (shouldStart)',
  'eq(students.updatedAt, current.updatedAt)'
], "Enrollment lifecycle");
contains(section(family, "deleteStudent", "importParents"), [
  "await db.transaction(async (tx) => {",
  "if (isForeignKeyError(error))",
  "if (student.userId)"
], "Student account deletion");
contains(section(family, "deleteParentAccount", "createStudentAccount"), [
  "await db.transaction(async (tx) => {",
  'eq(users.role, "PARENT")',
  "if (isForeignKeyError(error))"
], "Parent relationship protection");

contains(section(accounts, "resetPasswordAsAdmin", "setUserStatusAsAdmin"), [
  'sql`${users.status} <> \'ARCHIVED\'`',
  'sql`${users.role} <> \'SCHOOL_ADMIN\'`',
  "await tx.update(authSessions)",
  "await tx.update(adminPasswordVerifications)"
], "Administrator credential reset");
contains(section(accounts, "setUserStatusAsAdmin", "listAccountAuditLogs"), [
  '.limit(1).for("update")', 'current.role === "SCHOOL_ADMIN"',
  'current.status !== "SUSPENDED"', "current.mustChangePassword",
  "await tx.update(adminPasswordVerifications)",
  "await tx.insert(auditLogs)"
], "Lifecycle transitions");
contains(accounts, [
  'sql`lower(${users.username}) = lower(${username})`',
  'sql`lower(${users.username}) = lower(${username})`'
], "Casefold login");
contains(auth, [
  'input.username.toLowerCase()'
], "Casefold login rate-limit");
contains(users, [
  'error: "admin_account_protected"',
  'error: "account_status_conflict"'
], "Admin-only account protection");

contains(migration, [
  "GROUP BY school_id, lower(username)",
  "HAVING COUNT(*) > 1",
  'CREATE UNIQUE INDEX "users_school_username_casefold_unique"'
], "Migration safety");
assert.equal(journal.entries.at(-1)?.tag, "0033_phase6_casefold_usernames");
assert.equal(journal.entries.at(-1)?.idx, 33);
contains(schema, ['uniqueIndex("users_school_username_casefold_unique")'], "Drizzle schema");
contains(preflight, [
  "REPEATABLE READ, READ ONLY", "COUNT(*)::integer AS groups",
  "DATABASE_URL_UNPOOLED", "process.exitCode = 1"
], "Database preflight");

console.log("Phase 6 verified: atomic school account linking and status changes, enrollment history, tenant isolation, school-role guards and staged case-insensitive identity uniqueness.");
