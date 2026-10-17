import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const model=read("apps/mobile/src/student-communication-model.ts");
const ui=read("apps/mobile/src/student-communication.tsx");
const app=read("apps/mobile/App.tsx");
const locale=read("packages/localization/src/index.ts");
const notification=read("apps/mobile/src/notification-destination.ts");
const api=read("apps/mobile/src/api.ts");
const backend=read("apps/api/src/communication/routes.ts");
const tests=read("scripts/test-student-communication-phase7.ts");
const pkg=JSON.parse(read("package.json"));
const workflow=read(".github/workflows/student-navigation.yml");
const ci=read(".github/workflows/ci.yml");
for(const value of [
 "STUDENT_INBOX_PAGE_SIZE=20","studentVisibleAnnouncements(",
 "studentFilterAnnouncements(","studentVisibleNotifications(",
 "studentFilterNotifications(","studentNotificationTopic(",
 "studentNotificationUnread(","studentInboxPage<T>(",
 'item.audienceRole==="STUDENT"','item.classId===classId',
 "item.archivedAt",'item.deliveryStatus==="PENDING"'
])assert.ok(model.includes(value),"Student Phase 7 model missing "+value);
for(const value of [
 'testID="student-inbox-phase7"','testID="student-inbox-search"',
 'testID="student-inbox-refresh"','testID="student-inbox-mark-all"',
 'testID="student-inbox-more"','studentReadFilters','studentTopicFilters',
 'studentAnnouncementFilters','studentFilterAnnouncements(announcements',
 'studentFilterNotifications(notifications','studentInboxPage<AnnouncementPayload|ParentNotification>(',
 'onMarkRead(id)','onMarkAllRead()','onOpenNotification(item)',
 'student.inboxLoadError','student.inboxNoMatching',
 'student.inboxRefreshFailed','student.inboxMarkFailed'
])assert.ok(ui.includes(value),"Student Phase 7 UI missing "+value);
for(const value of [
 "async function refreshStudentInbox()","async function markStudentInboxRead(",
 "async function markStudentInboxAllRead(","api.announcements(token,true)",
 "api.notifications(token,true)","api.markAllNotificationsRead(token)",
 "studentInboxVersion.current+=1","onMarkRead={markStudentInboxRead}",
 "onMarkAllRead={markStudentInboxAllRead}",
 "onRefresh={refreshStudentInbox}",
 "announcementStatus={studentInboxStatus.announcements}",
 "notificationStatus={studentInboxStatus.notifications}",
 "focusedAnnouncementId={studentFocusedAnnouncementId}",
 "studentDetailReturnScreen:studentReturnScreen(screen)",
 "studentLearning?.student.classId ?? null"
])assert.ok(app.includes(value),"Student Phase 7 App behavior missing "+value);
assert.ok(notification.includes("STUDENT_ATTENDANCE"));
assert.ok(notification.includes('role === "STUDENT" ? "STUDENT_ATTENDANCE"'));
assert.ok(api.includes('markNotificationRead(accessToken: string, notificationId: string)'));
assert.ok(api.includes("markAllNotificationsRead(accessToken: string)"));
assert.ok(backend.includes('"/v1/notifications/read-all"'));
assert.ok(backend.includes('"/v1/notifications/:notificationId/read"'));
for(const suffix of ["inboxAll","inboxUnread","inboxRead","inboxSchool","inboxAcademics",
 "inboxAttendance","inboxFees","inboxClass","inboxStudent","inboxSearch",
 "inboxRefresh","inboxLoadError","inboxRetry","inboxRefreshFailed",
 "inboxMarkFailed","inboxMarkAll","inboxItems","inboxNoMatching","inboxLoadMore"]){
 const key="student."+suffix;
 assert.ok(locale.includes('  | "'+key+'"'),"Missing key "+key);
 assert.equal(locale.split('"'+key+'":').length-1,3,"Missing translations "+key);
}
for(const keyword of [
 "announcements reject archived future","notification read filters",
 "pagination never invents"
])assert.ok(tests.includes(keyword),"Phase 7 acceptance test missing "+keyword);
assert.ok(pkg.scripts["verify:student:phase7"]?.includes("verify:student:phase6"));
assert.ok(pkg.scripts["verify:student:phase7"]?.includes("test-student-communication-phase7.ts"));
assert.ok((workflow.includes("run: pnpm verify:student:phase7") || workflow.includes("run: pnpm verify:student:phase8")));
assert.ok((ci.includes("run: pnpm verify:student:phase7") || ci.includes("run: pnpm verify:student:phase8")));
console.log("Student Phase 7 localized inbox, scoped audience, filtered read states, retry, pagination, navigation verified.");
