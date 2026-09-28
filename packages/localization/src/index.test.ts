import assert from "node:assert/strict";
import test from "node:test";
import { getDirection, messages, supportedLocales } from "./index.js";

test("Dari and Pashto are RTL while English is LTR", () => {
  assert.equal(getDirection("fa-AF"), "rtl");
  assert.equal(getDirection("ps-AF"), "rtl");
  assert.equal(getDirection("en"), "ltr");
});

test("all locales expose the same translation keys", () => {
  const baseline = Object.keys(messages.en).sort();
  for (const locale of supportedLocales) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), baseline);
  }
});
