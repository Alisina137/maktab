import assert from "node:assert/strict";
import test from "node:test";
import { validateAccountCreation, type AccountCreationDraft } from "../../web/app/admin/account-create-rules.js";

const base: AccountCreationDraft = {
  role: "TEACHER",
  username: "teacher001",
  parentFullName: "",
  parentPhone: "",
  studentRecordId: ""
};

const validate = (override: Partial<AccountCreationDraft>, existing: string[] = [], eligible: string[] = []) =>
  validateAccountCreation({ ...base, ...override }, existing, eligible);

test("Phase 2: parent and student usernames must use English letters and numbers", () => {
  for (const role of ["PARENT", "STUDENT"] as const) {
    const linked = role === "STUDENT" ? { studentRecordId: "student-1" } : { parentFullName: "Test Parent" };
    assert.equal(validate({ role, username: "parent.001", ...linked }, [], ["student-1"]).username,
      "Parent and student usernames may contain English letters and numbers only.");
    assert.equal(validate({ role, username: "parent001", ...linked }, [], ["student-1"]).username, undefined);
  }
});

test("Phase 2: administrator and teacher usernames retain approved special characters", () => {
  assert.equal(validate({ username: "teacher.one+1@example" }).username, undefined);
  assert.equal(validate({ username: "teacher with space" }).username, "This username contains unsupported characters.");
  assert.equal(validate({ username: "ab" }).username, "Username must contain between 3 and 64 characters.");
  assert.equal(validate({ username: "a".repeat(65) }).username, "Username must contain between 3 and 64 characters.");
});

test("Phase 2: duplicate username guidance is case-insensitive and school-scoped", () => {
  assert.equal(validate({ username: "Teacher001" }, ["teacher001"]).username,
    "That username already exists in this school.");
  assert.equal(validate({ username: "Teacher001" }, ["unrelated"]).username, undefined);
});

test("Phase 2: parent information requires a real name but phone is optional", () => {
  assert.ok(validate({ role: "PARENT", parentFullName: " " }).parentFullName);
  assert.equal(validate({ role: "PARENT", parentFullName: "Proper Parent", parentPhone: "" }).parentFullName, undefined);
  assert.ok(validate({ role: "PARENT", parentFullName: "Proper Parent", parentPhone: "0".repeat(33) }).parentPhone);
});

test("Phase 2: student selection must reference an eligible active unlinked student", () => {
  const data: Partial<AccountCreationDraft> = { role: "STUDENT", studentRecordId: "student-1" };
  assert.ok(validate(data, [], []).studentRecordId);
  assert.ok(validate(data, [], ["student-2"]).studentRecordId);
  assert.equal(validate(data, [], ["student-1"]).studentRecordId, undefined);
});
