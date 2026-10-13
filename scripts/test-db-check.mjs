import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// This test is intentionally offline: it verifies clear validation and
// protection against leaking the connection string into console diagnostics.
const script = fileURLToPath(new URL("../packages/database/scripts/check-db.mjs", import.meta.url));
const fakeSecret = "this-is-not-a-valid-database-url-secret";
const result = spawnSync(process.execPath, [script], {
  env: { ...process.env, DATABASE_URL: fakeSecret },
  encoding: "utf8",
  timeout: 10_000
});
assert.equal(result.status, 1, "An invalid DATABASE_URL must fail fast");
const output = result.stdout + result.stderr;
assert.match(output, /DATABASE_URL is not a valid PostgreSQL URL/);
assert.doesNotMatch(output, new RegExp(fakeSecret), "The database secret must not appear in diagnostics");
console.log("Database diagnostic validation and secret-redaction smoke test passed.");
