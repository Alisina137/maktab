import assert from "node:assert/strict";
import test from "node:test";
import { createSchoolInputSchema } from "./index.js";

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
