import assert from "node:assert/strict";
import test from "node:test";
import {
  createClassSectionSchema,
  createGradeLevelSchema,
  createSchoolInputSchema,
  createSchoolUserSchema,
  createSubjectSchema,
  passwordSchema
} from "./index.js";

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

test("password policy requires 8+ characters, a letter, a number, and a special character", () => {
  assert.equal(passwordSchema.safeParse("Short1!").success, false);
  assert.equal(passwordSchema.safeParse("12345678!").success, false);
  assert.equal(passwordSchema.safeParse("MaktabPass!").success, false);
  assert.equal(passwordSchema.safeParse("Maktab2026").success, false);
  assert.equal(passwordSchema.safeParse("Maktab1!").success, true);
});


test("academic codes support Dari, Pashto, English, and localized digits", () => {
  const grade = createGradeLevelSchema.parse({
    code: "پایه ۷",
    name: "پایه هفتم",
    sortOrder: 7
  });
  assert.equal(grade.code, "پایه ۷");

  const classSection = createClassSectionSchema.parse({
    academicYearId: "11111111-1111-4111-8111-111111111111",
    gradeLevelId: "22222222-2222-4222-8222-222222222222",
    code: "صنف-۷-الف",
    name: "صنف هفتم الف"
  });
  assert.equal(classSection.code, "صنف-۷-الف");

  const subject = createSubjectSchema.parse({
    code: "ریاضی ۷",
    name: "ریاضی"
  });
  assert.equal(subject.code, "ریاضی ۷");

  const invalid = createClassSectionSchema.safeParse({
    academicYearId: "11111111-1111-4111-8111-111111111111",
    gradeLevelId: "22222222-2222-4222-8222-222222222222",
    code: "7/A",
    name: "Grade 7 A"
  });
  assert.equal(invalid.success, false);
});
