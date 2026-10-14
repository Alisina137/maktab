import type { AnnouncementPayload, ParentNotification, ParentChild } from "./api";
import { notificationDestination } from "./notification-destination";
import { validIsoDay } from "./parent-attendance-model";

export const INBOX_PAGE_SIZE = 20;
export type NotificationReadFilter = "ALL" | "UNREAD" | "READ";
export type NotificationTopic = "ALL" | "SCHOOL" | "ACADEMICS" | "ATTENDANCE" | "FEES";
export type AnnouncementAudience = "ALL" | "SCHOOL" | "CLASS" | "PARENT";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function filterParentNotifications(
  rows: ParentNotification[],
  options: { query: string; read: NotificationReadFilter; topic: NotificationTopic }
): ParentNotification[] {
  const query = options.query.trim().toLocaleLowerCase();
  const matchesTopic = (item: ParentNotification) => {
    if (options.topic === "ALL") return true;
    if (options.topic === "SCHOOL") return item.type === "ANNOUNCEMENT";
    if (options.topic === "ACADEMICS") return item.type === "HOMEWORK_PUBLISHED" ||
      item.type === "RESULTS_PUBLISHED";
    if (options.topic === "ATTENDANCE") return item.type.startsWith("ATTENDANCE_");
    return item.type === "FEE_DUE" || item.type === "FEE_OVERDUE";
  };
  return rows.filter(item =>
    (options.read === "ALL" || (options.read === "UNREAD" ? !item.readAt : !!item.readAt)) &&
    matchesTopic(item) &&
    (!query || [item.title, item.message].some(value => value.toLocaleLowerCase().includes(query)))
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function filterParentAnnouncements(
  rows: AnnouncementPayload[],
  options: { classId: string; query: string; audience: AnnouncementAudience }
): AnnouncementPayload[] {
  const query = options.query.trim().toLocaleLowerCase();
  return rows.filter(item => !item.archivedAt &&
    (item.audienceScope === "SCHOOL" ||
      (item.audienceScope === "ROLE" && item.audienceRole === "PARENT") ||
      (item.audienceScope === "CLASS" && item.classId === options.classId &&
        (!item.audienceRole || item.audienceRole === "PARENT"))) &&
    (options.audience === "ALL" || item.audienceScope === options.audience ||
      (options.audience === "PARENT" && item.audienceScope === "ROLE" &&
        item.audienceRole === "PARENT")) &&
    (!query || [item.title, item.content].some(value => value.toLocaleLowerCase().includes(query)))
  ).sort((a, b) => b.publishAt.localeCompare(a.publishAt) || b.id.localeCompare(a.id));
}

export function inboxPage<T>(
  rows: T[], limit: number, id: (item: T) => string, focusId?: string | null
): { visible: T[]; hasMore: boolean; showing: number } {
  const focusIndex = focusId ? rows.findIndex(row => id(row) === focusId) : -1;
  // Never fabricate missing or inaccessible targets. Reveal its existing position only.
  const count = Math.min(rows.length, Math.max(INBOX_PAGE_SIZE, limit,
    focusIndex < 0 ? 0 : Math.ceil((focusIndex + 1) / INBOX_PAGE_SIZE) * INBOX_PAGE_SIZE));
  return { visible: rows.slice(0, count), showing: count, hasMore: count < rows.length };
}

export type ParentInboxTarget =
  | { section: "ANNOUNCEMENTS"; announcementId: string | null }
  | { section: "HOMEWORK"; homeworkId: string }
  | { section: "RESULTS"; examId: string }
  | { section: "FEES"; studentId: string | null }
  | { section: "ATTENDANCE"; date: string | null }
  | { section: "HOME" };

export function parentInboxTarget(notification: ParentNotification): ParentInboxTarget | null {
  const destination = notificationDestination("PARENT", notification);
  const url = notification.deepLink ?? "";
  if (destination === "PARENT_ANNOUNCEMENTS") {
    const id = notification.metadata.announcementId;
    return { section: "ANNOUNCEMENTS", announcementId: typeof id === "string" && uuid.test(id) ? id : null };
  }
  if (destination === "PARENT_HOMEWORK") {
    const id = /^\/homework\/([0-9a-f-]{36})$/i.exec(url)?.[1];
    return id && uuid.test(id) ? { section: "HOMEWORK", homeworkId: id } : null;
  }
  if (destination === "PARENT_RESULTS") {
    const id = /^\/results\/([0-9a-f-]{36})$/i.exec(url)?.[1];
    return id && uuid.test(id) ? { section: "RESULTS", examId: id } : null;
  }
  if (destination === "PARENT_FEES") {
    const studentId = /^\/parent\/children\/([0-9a-f-]{36})\/fees$/i.exec(url)?.[1];
    return { section: "FEES", studentId: studentId && uuid.test(studentId) ? studentId : null };
  }
  if (destination === "PARENT_ATTENDANCE") {
    const date = notification.metadata.date;
    return { section: "ATTENDANCE",
      date: typeof date === "string" && validIsoDay(date) ? date : null };
  }
  if (destination === "PARENT_HOME") return { section: "HOME" };
  return null;
}

/** A notification never grants child access. Only already-authorized child IDs may be selected. */
export function authorizedNotificationChild(
  target: ParentInboxTarget, children: ParentChild[], selectedId: string,
  metadata: Record<string, unknown> = {}
): string | null {
  const linked = children.map(child => child.student);
  if (target.section === "FEES") {
    return linked.some(student => student.id === target.studentId) ? target.studentId : null;
  }
  if (target.section === "ATTENDANCE") {
    const id = metadata.studentId;
    return typeof id === "string" && linked.some(student => student.id === id)
      ? id : null;
  }
  if (target.section === "HOMEWORK") {
    const id = metadata.classId;
    if (typeof id !== "string") return linked.some(student => student.id === selectedId) ? selectedId : null;
    return linked.find(student => student.classId === id && student.id === selectedId)?.id ??
      linked.find(student => student.classId === id)?.id ?? null;
  }
  if (target.section === "ANNOUNCEMENTS") {
    const id = metadata.classId;
    if (typeof id === "string") {
      return linked.find(student => student.classId === id && student.id === selectedId)?.id ??
        linked.find(student => student.classId === id)?.id ?? null;
    }
  }
  return linked.some(student => student.id === selectedId) ? selectedId : (linked[0]?.id ?? null);
}
