import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("apps/mobile/App.tsx");
const dashboard=read("apps/mobile/src/parent-dashboard.tsx");
const model=read("apps/mobile/src/parent-home-model.ts");
const tests=read("apps/mobile/src/parent-home-model.test.ts");
const locale=read("packages/localization/src/index.ts");
const prev=read("scripts/verify-parent-experience-phase1.mjs");
const docs=read("docs/PARENT-EXPERIENCE-PHASES.md");
const parentNav=read("apps/mobile/src/parent-navigation.tsx");

for(const nav of ["HOME","ACADEMICS","ATTENDANCE","INBOX","MORE"]) {
  assert.ok(parentNav.includes(`key: "${nav}"`),"Phase 1 main navigation must survive: "+nav);
}
assert.ok(dashboard.includes("buildParentHomeView("),"Dashboard must derive data from verified records");
for(const marker of ["onNavigate={openParentDashboardDestination}",
  "onRetry={retryParentResource}","onRefresh={refreshParentDashboard}",
  "loadParentAttendance(","loadParentTimetable(","loadParentLearningData(",
  "loadParentAnnouncementsData(","loadParentFeesData(","loadParentNotifications(",
  'parentDataChildId === selectedChildId',
  'parentHomeLoadStatus === "error"',
  "resourceRequestCurrent(","parentResourceRequests.current[resource]"
]) assert.ok(app.includes(marker),"Missing Phase 2 action/error/identity invariant "+marker);
for(const marker of [
  'accessibilityRole="button"', "styles.alertSection",
  "parent.actionRequired",
  "parent.unavailable","parent.tryAgain","parent.viewDetails",
  'formatLocalizedDate(todayDate,locale)','formatLocalizedTimeRange(',
  'formatAfn(','formatLocalizedNumber(',
  '"ACADEMICS_RESULTS"','"INBOX_NOTIFICATIONS"'
]) assert.ok(dashboard.includes(marker),"Missing interactive dashboard detail "+marker);
assert.ok(model.includes("parent.alertAbsent") && model.includes("parent.alertFeeOverdue"),
  "Actual-data alert labels must originate in derived view model");
assert.ok(!dashboard.includes("parent.examScheduleUnavailable"),
  "Do not present unverified upcoming exam data as an actionable card");
for(const marker of [
  '"Asia/Kabul"','homework.status==="PUBLISHED"',
  'grade.status==="PUBLISHED"', 'item.invoice.status!=="DRAFT"',
  'input.todayAttendance==="ABSENT"', 'available.attendance',
  "alerts.slice(0,4)", 'return null'
]) assert.ok(model.includes(marker),"Safety model missing "+marker);
for(const marker of ["Kabul civil day", "Actual absent and late",
  "Only published upcoming homework", "Fees require confirmed"])
  assert.ok(tests.includes(marker),"Model unit test missing "+marker);
for(const key of [
  "parent.refreshHome","parent.actionRequired","parent.noAlerts",
  "parent.alertAbsent","parent.alertLate","parent.alertHomeworkToday",
  "parent.alertHomeworkTomorrow","parent.alertFeeOverdue",
  "parent.alertFeeSoon","parent.alertUnread","parent.unavailable",
  "parent.tryAgain","parent.viewDetails","parent.unreadNotifications",
  "parent.viewAllNotifications"
]) assert.equal(locale.split(JSON.stringify(key)+":").length,4,
  "Missing exactly three Parent translations for "+key);
assert.ok(prev.includes('selectedChildIdRef.current === studentId'),
  "Preserve Phase 1 data isolation guard definition");
assert.ok(docs.includes("## Phase 2") && docs.includes("NO-GO"),
  "Document Phase 2 acceptance and ongoing release risks");
console.log("Parent Phase 2 dashboard actions, alert safety, RTL, stale-response and locale source guards passed.");
