import assert from "node:assert/strict";
import test from "node:test";
import { isUniqueConstraintViolation } from "./db-errors.js";

test("nested PostgreSQL unique errors are recognized through a Drizzle wrapper", () => {
  const constraintError = Object.assign(new Error("key already exists"), { code: "23505" });
  const wrapped = new Error("Failed query: insert into exams", { cause: constraintError });
  assert.equal(isUniqueConstraintViolation(wrapped), true);
});

test("driver uniqueness messages without codes are recognized", () => {
  assert.equal(
    isUniqueConstraintViolation(new Error("duplicate key value violates unique constraint schools_code_key")),
    true
  );
});

test("unrelated query and connection errors are not classified as conflicts", () => {
  assert.equal(isUniqueConstraintViolation(new Error("Failed query: select 1")), false);
  assert.equal(isUniqueConstraintViolation(Object.assign(new Error("connection reset"), { code: "08006" })), false);
  assert.equal(isUniqueConstraintViolation(Object.assign(new Error("foreign key violation"), { code: "23503" })), false);
});

test("cyclic cause objects are handled safely", () => {
  const error: { message: string; cause?: unknown } = { message: "failed" };
  error.cause = error;
  assert.equal(isUniqueConstraintViolation(error), false);
});
