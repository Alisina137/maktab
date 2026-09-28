import assert from "node:assert/strict";
import test from "node:test";
import { createSchoolInputSchema, createSchoolUserSchema, passwordSchema } from "./index.js";

test("school code is normalized to uppercase", () => {
  const result = createSchoolInputSchema.parse({
    code: "school-a",
    name: "School A",
    slug: "school-a",
    province: "Kabul",
    city: "Kabul"
  });
  assert.equal(result.code, "SCHOOL-A");
  assert.equal(result.defaultLanguage, "fa-AF");
});

test("school usernames are normalized within tenant context", () => {
  const result = createSchoolUserSchema.parse({ username: "Parent.One", role: "PARENT" });
  assert.equal(result.username, "parent.one");
});

test("password policy requires a reasonable minimum plus letters and numbers", () => {
  assert.equal(passwordSchema.safeParse("onlyletters").success, false);
  assert.equal(passwordSchema.safeParse("1234567890").success, false);
  assert.equal(passwordSchema.safeParse("Maktab2026!").success, true);
});
