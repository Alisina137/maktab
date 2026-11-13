#!/usr/bin/env node
// Phase 12 Step 5 source-based UI regression: keeps navigation and accessibility
// on affected Staff and Teacher pages. Does not replace real browser/Android QA.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");
const checks = {
  "apps/web/app/staff/staff-loading-state.tsx": [
    'role="status"', 'aria-live="polite"', 'aria-busy="true"',
    'aria-hidden="true"', 'staff-loading-spinner'
  ],
  "apps/web/app/staff/staff-work.css": [
    ".staff-loading-state", ".staff-loading-spinner", "prefers-reduced-motion",
    ".staff-error-retry", "flex-wrap:wrap"
  ],
  "apps/web/app/staff/staff-registration-panel.tsx": [
    "StaffLoadingState", 't("Loading registration requests…")', 'role="alert"',
    "setLoading(true);setError", 't("Refresh")', "disabled={loading||busy}",
    "staff-reg-columns"
  ],
  "apps/web/app/staff/staff-work-panel.tsx": [
    "StaffLoadingState", 't("Loading staff work…")', 'role="tablist"',
    'role="tabpanel"', 'role="alert"', 't("Refresh")',
    "friendlyAdminError"
  ],
  "apps/web/app/staff/dashboard/page.tsx": [
    "StaffLoadingState", 't("Checking staff access…")',
    "adminDirection(locale)", "root.dir=adminDirection(locale)",
    "sessionBlocked", "permission_denied", 'role="alert"'
  ],
  "apps/mobile/src/teacher-classes.tsx": [
    "ActivityIndicator", 'accessibilityLiveRegion="polite"', '"common.loading"',
    '"teacher.classResetFilters"', '"action.retry"', "accessibilityState"
  ],
  "apps/mobile/src/teacher-hub.tsx": [
    "TeacherHubLoading", "ActivityIndicator", 'accessibilityLiveRegion="polite"',
    '"common.loading"', '"action.retry"', "getDirection(locale)"
  ],
  "apps/mobile/src/teacher-schedule.tsx": [
    "ActivityIndicator", '"common.loading"', '"action.retry"',
    "onSelectWeekday", "onOpenPeriod", "getDirection(locale)"
  ]
};
for (const [file, needles] of Object.entries(checks)) {
  const content = source(file);
  for (const needle of needles) {
    assert.ok(content.includes(needle), file + " lost a critical Phase 12 user-state: " + needle);
  }
}
const translations = source("apps/web/app/admin/admin-i18n.ts");
for (const key of ['"Refresh":', '"Loading staff work…":',
  '"Checking staff access…":', '"Loading registration requests…":']) {
  assert.ok(translations.includes(key), "Missing localized UI label "+key);
}
console.log("Phase 12 Step 5 source gate PASS: loading, retry, role navigation, keyboard/RTL and translated UI states.");
