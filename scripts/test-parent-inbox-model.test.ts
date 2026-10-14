import assert from "node:assert/strict";
import test from "node:test";
import {
  INBOX_PAGE_SIZE, authorizedNotificationChild, filterParentAnnouncements,
  filterParentNotifications, inboxPage, parentInboxTarget
} from "../apps/mobile/src/parent-inbox-model";
import type { AnnouncementPayload, ParentChild, ParentNotification } from "../apps/mobile/src/api";

const ids = {
  first: "12345678-1234-1234-1234-123456789001",
  second: "12345678-1234-1234-1234-123456789002",
  other: "12345678-1234-1234-1234-123456789003",
  homework: "12345678-1234-1234-1234-123456789004",
  exam: "12345678-1234-1234-1234-123456789005",
  announcement: "12345678-1234-1234-1234-123456789006"
};

function notice(index: number, type = "ANNOUNCEMENT", read = false): ParentNotification {
  return {
    id: ids.first + "-" + String(index), type,
    title: "Update " + index, message: "Information for parent",
    deepLink: "/announcements",
    deliveryStatus: "SENT", readAt: read ? "2026-10-14T05:00:00Z" : null,
    createdAt: new Date(Date.UTC(2026,9,14,4,index)).toISOString(),
    metadata: { announcementId: ids.announcement }
  };
}

function announcement(
  id: string, scope: AnnouncementPayload["audienceScope"], classId: string | null,
  audienceRole: AnnouncementPayload["audienceRole"] = null, archivedAt: string | null = null
): AnnouncementPayload {
  return { id, title: "Teacher update " + id, content: "School news",
    schoolId: "school-a", audienceScope: scope, classId, audienceRole,
    publishAt: "2026-10-14T10:00:00Z", createdAt: "2026-10-14T07:00:00Z", archivedAt };
}

function child(id: string, classId: string): ParentChild {
  return { student: { id, studentCode: "ST" + id, fullName: "Child",
    status: "ACTIVE", parentUserId: "parent", academicYearId: "year", classId },
    classSection: { id: classId, code: classId, name: "Class", academicYearId: "year" },
    academicYear: { id: "year", name: "1405", status: "ACTIVE" } };
}

test("Unread/read and subject-category filters search all authorized notification rows, not first page", () => {
  const rows = Array.from({ length: 47 }, (_,i) => notice(i,
    i % 3 === 0 ? "HOMEWORK_PUBLISHED" : i % 3 === 1 ? "FEE_DUE" : "ATTENDANCE_ABSENT", i % 2 === 0));
  const unread = filterParentNotifications(rows, { query: "", read: "UNREAD", topic: "ALL" });
  assert.equal(unread.length, 23);
  assert.ok(unread.every(item => item.readAt === null));
  assert.equal(filterParentNotifications(rows, { query: "UPDATE 4", read: "ALL", topic: "ALL" }).length, 8);
  assert.ok(filterParentNotifications(rows, { query: "", read: "ALL", topic: "FEES" })
    .every(item => item.type === "FEE_DUE"));
  assert.ok(filterParentNotifications(rows, { query: "", read: "ALL", topic: "ACADEMICS" })
    .every(item => item.type === "HOMEWORK_PUBLISHED"));
  assert.equal(filterParentNotifications(rows, { query: "bad", read: "ALL", topic: "ALL" }).length,0);
  const first = inboxPage(unread, INBOX_PAGE_SIZE, item => item.id);
  assert.equal(first.visible.length,20);
  assert.equal(first.hasMore,true);
  assert.equal(inboxPage(unread, 40, item => item.id).visible.length,23);
  assert.equal(inboxPage(unread, 40, item => item.id).hasMore,false);
  const focused = inboxPage(rows,20,item => item.id,rows[8]!.id);
  assert.equal(focused.visible.length,40);
  assert.equal(focused.visible.filter(item=>item.id===rows[8]!.id).length,1);
});

test("Announcements respect selected child's class and parent role, hide archived/wrong-class", () => {
  const rows = [
    announcement("school","SCHOOL",null),
    announcement("own","CLASS","class-a"),
    announcement("sibling","CLASS","class-b"),
    announcement("parents","ROLE",null,"PARENT"),
    announcement("students","ROLE",null,"STUDENT"),
    announcement("teacher","CLASS","class-a","TEACHER"),
    announcement("archived","SCHOOL",null,null,"2026-10-14T10:02:00Z")
  ];
  const visible = filterParentAnnouncements(rows, { classId:"class-a",query:"",audience:"ALL" });
  assert.deepEqual(visible.map(item => item.id).sort(), ["school","own","parents"].sort());
  assert.deepEqual(filterParentAnnouncements(rows,{classId:"class-a",query:"",audience:"CLASS"})
    .map(item=>item.id),["own"]);
  assert.deepEqual(filterParentAnnouncements(rows,{classId:"class-a",query:"",audience:"PARENT"})
    .map(item=>item.id),["parents"]);
  assert.equal(filterParentAnnouncements(rows,{classId:"class-a",query:"news",audience:"ALL"}).length,3);
  assert.equal(filterParentAnnouncements(rows,{classId:"class-a",query:"unknown",audience:"ALL"}).length,0);
});

test("Notification routes use only whitelisted patterns and linked children, not arbitrary target IDs", () => {
  const linked = [child(ids.first,"class-a"),child(ids.second,"class-b")];
  const a = { ...notice(0), metadata: { announcementId: ids.announcement, classId: "class-b" } };
  const targetAnnouncement = parentInboxTarget(a);
  assert.deepEqual(targetAnnouncement, { section:"ANNOUNCEMENTS",announcementId:ids.announcement });
  assert.ok(targetAnnouncement);
  assert.equal(authorizedNotificationChild(targetAnnouncement!, linked, ids.first,a.metadata),ids.second);

  const hw = { ...notice(0,"HOMEWORK_PUBLISHED"), deepLink:"/homework/"+ids.homework,
    metadata: { classId:"class-b" } };
  const targetHomework = parentInboxTarget(hw);
  assert.deepEqual(targetHomework, { section:"HOMEWORK",homeworkId:ids.homework });
  assert.equal(authorizedNotificationChild(targetHomework!,linked,ids.first,hw.metadata),ids.second);

  const result = { ...notice(0,"RESULTS_PUBLISHED"),deepLink:"/results/"+ids.exam,metadata:{examId:ids.exam} };
  assert.deepEqual(parentInboxTarget(result),{section:"RESULTS",examId:ids.exam});
  const fee = { ...notice(0,"FEE_DUE"),deepLink:`/parent/children/${ids.second}/fees`,
    metadata: { studentId:ids.second } };
  const targetFee = parentInboxTarget(fee)!;
  assert.deepEqual(targetFee,{section:"FEES",studentId:ids.second});
  assert.equal(authorizedNotificationChild(targetFee,linked,ids.first,fee.metadata),ids.second);
  assert.equal(authorizedNotificationChild(targetFee,[child(ids.first,"class-a")],ids.first,fee.metadata),null);
  assert.equal(parentInboxTarget({ ...fee, deepLink:"https://example.com" }),null);
  assert.equal(parentInboxTarget({ ...hw, deepLink:"/homework/" + ids.homework + "/../fees" }),null);
  const attendance = { ...notice(0,"ATTENDANCE_ABSENT"),
    deepLink:`/parent/children/${ids.second}/attendance`,
    metadata: { studentId:ids.second,date:"2026-10-13" } };
  const targetAttendance = parentInboxTarget(attendance)!;
  assert.deepEqual(targetAttendance,{section:"ATTENDANCE",date:"2026-10-13"});
  assert.equal(authorizedNotificationChild(targetAttendance,linked,ids.first,attendance.metadata),ids.second);
  assert.equal(authorizedNotificationChild(targetAttendance,[child(ids.first,"class-a")],ids.first,attendance.metadata),null);
});
