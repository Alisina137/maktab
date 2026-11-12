import assert from "node:assert/strict";
import test from "node:test";
import { nextAvailableTeacherEmployeeCode } from "../apps/web/app/admin/teacher-employee-code";

test("starts with T-1 and increments in plain unpadded notation", () => {
  assert.equal(nextAvailableTeacherEmployeeCode([]), "T-1");
  assert.equal(nextAvailableTeacherEmployeeCode(["T-1"]), "T-2");
  assert.equal(nextAvailableTeacherEmployeeCode(["T-1", "T-2"]), "T-3");
  assert.equal(nextAvailableTeacherEmployeeCode(
    Array.from({ length: 12 }, (_, n) => `T-${n + 1}`)
  ), "T-13");
});

test("uses first free numeric suffix, without collisions after deleting a profile", () => {
  assert.equal(nextAvailableTeacherEmployeeCode(["T-1", "T-3"]), "T-2");
  assert.equal(nextAvailableTeacherEmployeeCode(["T-2"]), "T-1");
  assert.equal(nextAvailableTeacherEmployeeCode(["T-3", "T-1", "T-2"]), "T-4");
});

test("treats old padded and lowercase employee codes as occupied numbers", () => {
  assert.equal(nextAvailableTeacherEmployeeCode(["T-001", "t-002", "T-3"]), "T-4");
  assert.equal(nextAvailableTeacherEmployeeCode(["T-0001", "T-1", "T-0002"]), "T-3");
});

test("ignores unrelated, zero, and unsafe old codes when suggesting a number", () => {
  assert.equal(nextAvailableTeacherEmployeeCode(
    ["T-SCOPE", "ABC", "T-0", "T--1", "T-9007199254740993"]
  ), "T-1");
});
