#!/usr/bin/env node
// Source guard: do not silently remove Staff/Teacher loading, retry and empty
// states while refining Phase 12 Step 2. This is NOT real-device accessibility.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const teacherClasses = read("apps/mobile/src/teacher-classes.tsx");
const teacherSchedule = read("apps/mobile/src/teacher-schedule.tsx");
const staffDashboard = read("apps/web/app/staff/dashboard/page.tsx");
const staffSessionPolicy = read("apps/web/app/staff/staff-session-policy.ts");
const staffRegistration = read("apps/web/app/staff/staff-registration-panel.tsx");
const staffWork = read("apps/web/app/staff/staff-work-panel.tsx");

for (const [file, source, required] of [
  ["Teacher Classes", teacherClasses, [
    "ActivityIndicator", 'testID="teacher-classes-overview"',
    '"common.loading"', '"action.retry"', '"teacher.classNoMatch"',
    '"teacher.classResetFilters"', "accessibilityLabel",
    "academicsReady", "onOpenAssignment"
  ]],
  ["Teacher Schedule", teacherSchedule, [
    "ActivityIndicator", '"common.loading"', '"action.retry"',
    "onOpenPeriod", "onSelectWeekday"
  ]],
  ["Staff dashboard", staffDashboard, [
    'role="status"', 'role="alert"', 'router.replace("/staff")',
    "staffSessionMustExit(cause,path)", "setWorking", "setMessage"
  ]],
  ["Staff registration", staffRegistration, [
    "setLoading", "setError", 'role="alert"', "friendlyAdminError"
  ]],
  ["Staff work", staffWork, [
    "setLoading", "setError", 'role="alert"', "friendlyAdminError"
  ]]
]) {
  for (const token of required) {
    assert.ok(source.includes(token), file + " lost essential feedback/navigation token: " + token);
  }
}
assert.ok(staffSessionPolicy.includes('code !== "permission_denied"'),
  "A single denied module must not revoke Staff authentication.");
console.log("Phase 12 Step 2 UI source gate: Staff and Teacher loading, error, empty, retry, and navigation states retained.");
