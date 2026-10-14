import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app = read("apps/mobile/App.tsx");
const shell = read("apps/mobile/src/parent-shell.tsx");
const attendance = read("apps/mobile/src/parent-attendance.tsx");
const academics = read("apps/mobile/src/parent-academics.tsx");
const inbox = read("apps/mobile/src/parent-inbox.tsx");
const more = read("apps/mobile/src/parent-more.tsx");
const model = read("apps/mobile/src/parent-session-guard.ts");
const server = read("apps/api/src/app.test.ts");
const acceptance = read("scripts/parent-phase7-acceptance.mjs");
const parentPlan = read("docs/PARENT-EXPERIENCE-PHASES.md");
const state = read("docs/PROJECT-STATE.md");

for (const item of [
  '<ParentChildSwitcher', 'parentTab === "HOME"', 'parentTab === "ACADEMICS"',
  'parentTab === "ATTENDANCE"', 'parentTab === "INBOX"', 'parentTab === "MORE"',
  'parentAcademicsTab === "HOMEWORK"', 'parentAcademicsTab === "RESULTS"',
  'key: "TIMETABLE"', 'parentInboxTab === "ANNOUNCEMENTS"',
  'key: "NOTIFICATIONS"', 'parentMoreTab === "FEES"',
  'parentMoreTab === "PROFILE"', 'parentMoreTab === "SCHOOL"',
  '<ParentFeesPanel', '<ParentPreferencesPanel',
  'parentDataChildId === selectedChildId', 'resetParentNotificationFocus()',
  'logoutInProgressRef.current', 'sameSessionEpoch(sessionRef.current, active',
  'sameSessionEpoch(sessionRef.current, activeSession',
  'retryParentResource("fees")','retryParentResource("notifications")',
  'saveStoredSession({ auth: changed, school: activeSchool })',
  'if (sessionRef.current?.accessToken === accessToken)',
  'setAdminContact(result.contact)'
]) assert.ok(app.includes(item),"Parent Phase 7 journey/identity guard missing: "+item);

for (const item of [
  'tabs.length > 3', 'ref={scrollRef}', 'scrollTo(',
  'getDirection(locale)', 'accessibilityRole="tab"','accessibilityState={{ selected: active }}'
]) assert.ok(shell.includes(item),"Adaptive tabs/RTL/a11y regression: "+item);

assert.ok(model.includes('current.accessToken === starting.accessToken') &&
  model.includes('current.refreshToken === starting.refreshToken') &&
  model.includes('current.user.schoolId === starting.user.schoolId') &&
  model.includes('currentSchool.id === startingSchool.id'),
  "Stale password responses from same account/school must not overwrite rotated tokens");
assert.ok(more.includes("accessibilityState={{selected:code===locale}}") &&
  more.includes("secureTextEntry={!show}") &&
  more.includes("ParentFeesPanel") &&
  more.includes("ParentSchoolPanel") &&
  more.includes("parentPasswordValidation("));
assert.ok(academics.includes("filterParentHomework") &&
  academics.includes("filterParentResults") &&
  academics.includes("filterParentTimetable"));
assert.ok(attendance.includes("summarizeAttendance") && attendance.includes("attendanceMonth("));
assert.ok(inbox.includes("filterParentAnnouncements") &&
  inbox.includes("filterParentNotifications") &&
  inbox.includes("await onMarkAllRead()"));
assert.ok(server.includes('test("Parent Phase 7 authenticated child isolation and password rotation"') &&
  server.includes("WrongSecure2026!") &&
  server.includes('for(const suffix of ["timetable","learning","attendance","fees"])'),
  "Parent Phase 7 must include real authenticated API integration tests");
assert.ok(acceptance.includes('productionDecision:"NO_GO"') &&
  acceptance.includes('READY_FOR_INDEPENDENT_REVIEW') &&
  acceptance.includes('PARENT_GATES') &&
  acceptance.includes('!forbidden.test(reference)'),
  "Android evidence must not be inferred or silently marked GO");
assert.ok(parentPlan.includes("## Phase 7") && parentPlan.includes("NO-GO"));
assert.ok(state.includes("Parent Experience — Phase 7"));
console.log("Parent Phase 7 cross-tab/child isolation, session-epoch security, accessibility and external evidence guards passed.");
