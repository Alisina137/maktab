import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAfn,
  formatLocalizedDate,
  formatLocalizedNumber,
  formatLocalizedTimeRange,
  getDirection,
  localizeDigits,
  messages,
  supportedLocales
} from "./index.js";

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


test("Afghan RTL locales use Solar Hijri dates while English stays Gregorian", () => {
  assert.equal(formatLocalizedDate("2026-10-02", "en"), "2026/10/02");
  assert.equal(formatLocalizedDate("2026-10-02", "fa-AF"), "۱۴۰۵/۰۷/۱۰");
  assert.equal(formatLocalizedDate("2026-10-02", "ps-AF"), "۱۴۰۵/۰۷/۱۰");
});

test("Phase 8: invalid calendar values are never silently displayed as another day", () => {
  assert.equal(formatLocalizedDate("2026-02-31", "en"), "2026-02-31");
  assert.equal(formatLocalizedDate("2026-02-31", "fa-AF"), "2026-02-31");
  assert.equal(formatLocalizedDate("2026-13-02", "ps-AF"), "2026-13-02");
  assert.equal(formatLocalizedDate("2025-02-29", "en"), "2025-02-29");
  assert.notEqual(formatLocalizedDate("2024-02-29", "en"), "2024-02-29");
});

test("numbers, time ranges, and AFN amounts follow the selected locale", () => {
  assert.equal(localizeDigits("S-0005", "fa-AF"), "S-۰۰۰۵");
  assert.equal(formatLocalizedNumber(86, "fa-AF"), "۸۶");
  assert.equal(formatLocalizedTimeRange("08:00", "08:45", "fa-AF"), "۰۸:۰۰–۰۸:۴۵");
  assert.equal(formatAfn(2500, "en"), "AFN 2,500");
  assert.equal(formatAfn(2500, "fa-AF"), "؋ ۲٬۵۰۰");
});
