/**
 * Final audit Phase 6 — SELECT-only identity preflight.
 *
 * Run on a restored staging copy before applying 0033. The output contains
 * counts only; student/parent usernames or school identifiers are not logged.
 * Existing colliding accounts must be resolved by a school administrator,
 * never silently merged, renamed or dropped by a migration.
 */
import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is not configured.");
  const db = postgres(connectionString, {
    max: 1, prepare: false, connect_timeout: 30, idle_timeout: 5
  });
  try {
    let collisionGroups = 0;
    let affectedUsers = 0;
    await db.begin(async (tx) => {
      await tx.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      const [result] = await tx.unsafe(`
        SELECT COUNT(*)::integer AS groups,
               COALESCE(SUM(size),0)::integer AS users
        FROM (
          SELECT COUNT(*)::integer AS size
          FROM users
          GROUP BY school_id, lower(username)
          HAVING COUNT(*) > 1
        ) AS collisions
      `);
      collisionGroups = Number(result?.groups ?? 0);
      affectedUsers = Number(result?.users ?? 0);
      if (!Number.isSafeInteger(collisionGroups) || collisionGroups < 0 ||
          !Number.isSafeInteger(affectedUsers) || affectedUsers < 0) {
        throw new Error("Preflight count returned an invalid value.");
      }
    });
    console.log(`[account-preflight] username_collision_groups: ${collisionGroups}`);
    console.log(`[account-preflight] accounts_in_collision_groups: ${affectedUsers}`);
    if (collisionGroups > 0) {
      throw new Error("Case-insensitive username duplicates must be resolved before migration 0033.");
    }
    console.log("[account-preflight] PASS: no detected case-fold collisions. Verify a backup before migrating.");
  } finally {
    await db.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((error) => {
  const expectedCollision = error instanceof Error &&
    error.message.includes("Case-insensitive username duplicates");
  console.error("[account-preflight] " + (expectedCollision
    ? "FAIL: duplicate account usernames exist. No rows were modified."
    : "FAIL: could not complete the read-only username check. Review database connectivity. No rows were modified."));
  process.exitCode = 1;
});
