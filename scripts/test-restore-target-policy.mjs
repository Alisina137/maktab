import assert from "node:assert/strict";
import test from "node:test";
import { validateRestoreTarget } from "./restore-target-policy.mjs";

const original = "postgresql://admin:secret@primary-pooler.us-east.neon.tech/main?sslmode=require";
const separate = "postgresql://admin:separate@staging.us-east.neon.tech/maktab_staging?sslmode=require";

const valid = {
  CONFIRM_RESTORE: "YES",
  RESTORE_TARGET: "staging",
  DATABASE_URL: original,
  RESTORE_DATABASE_URL: separate,
  CONFIRM_RESTORE_DATABASE: "maktab_staging"
};

test("Final audit Phase 10: only explicitly isolated staging target may be restored", () => {
  assert.equal(validateRestoreTarget(valid), separate);
  for (const changes of [
    { CONFIRM_RESTORE: undefined },
    { CONFIRM_RESTORE: "yes" },
    { RESTORE_TARGET: "production" },
    { RESTORE_TARGET: undefined },
    { RESTORE_DATABASE_URL: undefined },
    { RESTORE_DATABASE_URL: original },
    { RESTORE_DATABASE_URL: "postgresql://other@primary.us-east.neon.tech/main" },
    { RESTORE_DATABASE_URL: "postgresql://other@primary-pooler.us-east.neon.tech/main" },
    { CONFIRM_RESTORE_DATABASE: "main" },
    { CONFIRM_RESTORE_DATABASE: "MAKTAB_STAGING" },
    { DATABASE_URL: undefined },
    { DATABASE_URL: "not-a-url" },
    { RESTORE_DATABASE_URL: "https://staging.us-east.neon.tech/maktab_staging" },
    { RESTORE_DATABASE_URL: "postgresql://staging.us-east.neon.tech/" }
  ]) {
    assert.throws(() => validateRestoreTarget({ ...valid, ...changes }), /restore|database|DATABASE_URL|PostgreSQL|staging/i,
      "Unsafe restore environment was not rejected: " + Object.keys(changes));
  }
});

test("Final audit Phase 10: staging credentials and exact database name are preserved", () => {
  const target = validateRestoreTarget(valid);
  assert.equal(new URL(target).pathname, "/maktab_staging");
  assert.ok(!target.includes("primary-pooler"));
});
