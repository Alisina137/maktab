import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readMobileApiUrl,
  syncMobileApiUrl
} from "./mobile-api-env.mjs";

const folder = mkdtempSync(
  path.join(os.tmpdir(), "maktablink-mobile-api-env-")
);
const file = path.join(folder, ".env.local");

try {
  writeFileSync(
    file,
    "# Existing Expo preferences\r\n" +
      "EXPO_PUBLIC_SUPPORT_EMAIL=help@example.test\r\n" +
      "EXPO_PUBLIC_API_URL=https://old.example.test\r\n" +
      "# keep custom keys\r\n" +
      "EXPO_PUBLIC_API_URL=https://older.example.test\r\n",
    "utf8"
  );

  assert.equal(
    readMobileApiUrl(file),
    "https://older.example.test"
  );
  assert.equal(
    syncMobileApiUrl(file, "https://current.example.test/"),
    true
  );

  const body = readFileSync(file, "utf8");
  assert.ok(
    body.includes("EXPO_PUBLIC_SUPPORT_EMAIL=help@example.test")
  );
  assert.ok(body.includes("# keep custom keys"));
  assert.ok(body.includes("\r\n"), "Preserve Windows CRLF style");
  assert.equal(
    (body.match(/EXPO_PUBLIC_API_URL=/g) || []).length,
    1
  );
  assert.equal(
    readMobileApiUrl(file),
    "https://current.example.test"
  );
  assert.equal(
    syncMobileApiUrl(file, "https://current.example.test/"),
    false
  );

  for (const unsafe of [
    "http://insecure.example.test",
    "https://user:pass@host.test",
    "https://host.test/subpath",
    "https://host.test?secret=yes"
  ]) {
    assert.throws(() => syncMobileApiUrl(file, unsafe));
  }

  assert.equal(
    readMobileApiUrl(file),
    "https://current.example.test"
  );

  console.log(
    "Expo API tunnel URL synchronization verified: preserve settings, dedupe, atomic, HTTPS-only."
  );
} finally {
  rmSync(folder, { recursive: true, force: true });
}
