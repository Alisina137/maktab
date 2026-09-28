import assert from "node:assert/strict";
import test from "node:test";
import { parseTabularFile } from "./import-file.js";

test("CSV import preview preserves quoted values and headers", () => {
  const csv = 'username,fullName,phone\nparent.1,"Parent, One",0700000000\n';
  const preview = parseTabularFile("parents.csv", Buffer.from(csv).toString("base64"));
  assert.deepEqual(preview.headers, ["username", "fullName", "phone"]);
  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0]?.fullName, "Parent, One");
});
