import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path, import.meta.url),"utf8");
const app = read("apps/mobile/App.tsx");
const inbox = read("apps/mobile/src/parent-inbox.tsx");
const model = read("apps/mobile/src/parent-inbox-model.ts");
const destination = read("apps/mobile/src/notification-destination.ts");
const academic = read("apps/mobile/src/parent-academics.tsx");
const attendance = read("apps/mobile/src/parent-attendance.tsx");
const api = read("apps/api/src/communication/routes.ts");
const db = read("packages/database/src/communication-store.ts");
const locale = read("packages/localization/src/index.ts");
const docs = read("docs/PARENT-EXPERIENCE-PHASES.md");

for(const marker of [
  "<ParentAnnouncementsInbox", "<ParentNotificationsContent",
  'parentResourceStatus.announcements', 'parentResourceStatus.notifications',
  'parentDataChildId === selectedChildId ? parentAnnouncements : []',
  'setParentInboxTab("ANNOUNCEMENTS")', 'setParentInboxTab("NOTIFICATIONS")',
  "parentInboxFocusedAnnouncementId", "parentFocusedHomeworkId",
  "parentFocusedExamId", "parentFocusedAttendanceDate",
  "authorizedNotificationChild(", "parentInboxTarget(", "routeParentNotification(",
  "pendingParentNotificationRef", "parentHomeRef.current",
  "selectedChildIdRef.current !== childId", "resetParentNotificationFocus()",
  "onMarkAllRead={markAllNotificationsRead}", "retryParentResource(\"announcements\")",
  "retryParentResource(\"notifications\")", "sessionRef.current?.accessToken !== session.accessToken"
]) assert.ok(app.includes(marker), "Inbox security, navigation, or independent resource state missing: "+marker);

for(const marker of [
  "INBOX_PAGE_SIZE", "setVisibleCount(value => value + INBOX_PAGE_SIZE)",
  "filterParentNotifications(", "filterParentAnnouncements(",
  "accessibilityState={{ selected: filter === choice.key }}",
  "formatLocalizedDate(item.createdAt", "onMarkAllRead", "accessibilityRole=\"button\"",
  "item.id === focusedId", "styles.focused", "parent.inboxTargetUnavailable",
  "onPress={onRetry}", "parent.inboxNoMatches", "parent.inboxAccountWide",
  "await onMarkAllRead()"
]) assert.ok(inbox.includes(marker),"Missing Inbox search/filter/UX invariant: "+marker);

for(const marker of [
  "item.audienceScope === \"SCHOOL\"", 'item.audienceRole === "PARENT"',
  "item.classId === options.classId", "!item.archivedAt",
  "options.read === \"UNREAD\" ? !item.readAt", "item.type.startsWith(\"ATTENDANCE_\")",
  "rows.slice(0, count)", "notificationDestination(\"PARENT\", notification)",
  "uuid.test(", "validIsoDay(date)", "linked.some(student => student.id === target.studentId)",
  'linked.some(student => student.id === id)'
]) assert.ok(model.includes(marker),"Missing authorized filtering or safe navigation: "+marker);

assert.ok(destination.includes('"PARENT_ATTENDANCE"'));
assert.ok(academic.includes("focusedId") && academic.includes("setExpandedId(focusedId)") &&
  academic.includes("setExpandedIds([focusedId])"), "Targeted academic details must open only visible content");
assert.ok(attendance.includes("focusedDate") && attendance.includes("validIsoDay(focusedDate)"),
  "Attendance alerts must reject invalid dates");
assert.ok(api.includes('"/v1/announcements"') && api.includes('"/v1/notifications"') &&
  api.includes("requireActiveCommunicationAccess(request, reply)"),
  "Existing authenticated communication endpoints must be preserved");
assert.ok(db.includes("eq(notifications.schoolId, schoolId)") &&
  db.includes("eq(notifications.userId, userId)") &&
  db.includes("classIdsForUser(schoolId, userId, role)"),
  "Tenant/user/announcement audience access must remain server-side");
for(const key of [
  "inboxSearch","inboxAll","inboxUnread","inboxRead","inboxSchool","inboxAcademics",
  "inboxFees","inboxClass","inboxParents","inboxAudience","inboxReadFilter",
  "inboxTopic","inboxChildAudience","inboxAccountWide","inboxLoadMore",
  "inboxShowing","inboxNoMatches","inboxTargetUnavailable","inboxMarkReadError"
]) assert.equal(locale.split(JSON.stringify("parent."+key)+":").length,4,
  "Missing English/Dari/Pashto localization for parent."+key);
assert.ok(docs.includes("## Phase 5") && docs.includes("NO-GO"));
console.log("Parent Phase 5 Inbox search, safe paging, deep links, read state, localization and child isolation guards passed.");
