import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import type { AnnouncementPayload, ParentNotification, TeacherLearningPayload, TeacherTodayPayload } from "./api";
import { nextTeacherPeriod, teacherTaskCounts, teacherTime12 } from "./teacher-hub-data";

type Direction = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
type Icon = keyof typeof Ionicons.glyphMap;
export type TeacherWorkflowSection = "HOMEWORK" | "GRADES" | "TEACHING" | "TASKS";

function Action({
  label, icon, onPress, rtl
}: { label: string; icon: Icon; onPress: () => void; rtl: boolean }) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.action, rtl && styles.rowRtl, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={17} color={tokens.color.brandStrong} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Task({
  label, count, icon, rtl, locale, textDirection, onPress
}: { label: string; count: number; icon: Icon; rtl: boolean; locale: SupportedLocale; textDirection: Direction; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      accessibilityLabel={`${label}: ${count}`}
      style={({ pressed }) => [styles.task, rtl && styles.rowRtl, pressed && styles.pressed]}
    >
      <View style={styles.taskIcon}><Ionicons name={icon} size={20} color={tokens.color.brandStrong} /></View>
      <Text style={[styles.taskText, textDirection]}>{label}</Text>
      <Text style={styles.taskCount}>{formatLocalizedNumber(count, locale)}</Text>
      <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={17} color={tokens.color.textMuted} />
    </Pressable>
  );
}

export function TeacherTodayInsights({
  today, learning, learningReady, announcements, announcementsReady, notifications, locale,
  textDirection, onSchedule, onClasses, onHomework, onGrades, onAnnouncements,
  onNotifications, onAttendance, onRetry
}: {
  today: TeacherTodayPayload | null;
  learning: TeacherLearningPayload | null;
  learningReady: boolean;
  announcements: AnnouncementPayload[];
  announcementsReady: boolean;
  notifications: ParentNotification[];
  locale: SupportedLocale;
  textDirection: Direction;
  onSchedule: () => void;
  onClasses: () => void;
  onHomework: () => void;
  onGrades: () => void;
  onAnnouncements: () => void;
  onNotifications: () => void;
  onAttendance: (classId: string, date: string) => void;
  onRetry: () => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const pending = teacherTaskCounts(today, learning);
  const next = nextTeacherPeriod(today);
  const nextSupervision = today?.supervisedClasses.find((item) => item.attendanceStatus === "PENDING");
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const latestAnnouncements = [...announcements].sort((a, b) => b.publishAt.localeCompare(a.publishAt)).slice(0, 2);

  return (
    <View style={styles.stack} testID="teacher-today-dashboard">
      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}>
            <Ionicons name="sunny-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <Text style={[styles.heading, textDirection]}>{translate(locale, "teacher.dayAtGlance")}</Text>
        </View>
        <View style={[styles.metrics, rtl && styles.rowRtl]}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{today ? formatLocalizedNumber(today.schedule.length, locale) : "—"}</Text>
            <Text style={[styles.metricLabel, textDirection]}>{translate(locale, "teacher.periodCount")}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{learning ? formatLocalizedNumber(learning.assignments.length, locale) : "—"}</Text>
            <Text style={[styles.metricLabel, textDirection]}>{translate(locale, "teacher.myAssignments")}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{today ? formatLocalizedNumber(pending.pendingAttendance, locale) : "—"}</Text>
            <Text style={[styles.metricLabel, textDirection]}>{translate(locale, "teacher.attendancePending")}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}><Ionicons name="time-outline" size={21} color={tokens.color.brandStrong} /></View>
          <Text style={[styles.heading, textDirection]}>{translate(locale, "teacher.nextLesson")}</Text>
        </View>
        {next ? (
          <Pressable accessibilityRole="button" onPress={onClasses} style={({ pressed }) => [styles.nextLesson, rtl && styles.rowRtl, pressed && styles.pressed]}>
            <View style={styles.nextTime}>
              <Text style={styles.nextTimeText}>{teacherTime12(next.startsAt)}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.nextTitle, textDirection]}>{next.subjectName}</Text>
              <Text style={[styles.muted, textDirection]}>{next.className} · {next.classCode}</Text>
            </View>
            <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={20} color={tokens.color.brandStrong} />
          </Pressable>
        ) : (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noUpcomingLesson")}</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}><Ionicons name="checkbox-outline" size={21} color={tokens.color.brandStrong} /></View>
          <Text style={[styles.heading, textDirection]}>{translate(locale, "teacher.pendingTasks")}</Text>
        </View>
        {pending.pendingAttendance > 0 && nextSupervision && today ? (
          <Task label={translate(locale, "teacher.attendancePending")} count={pending.pendingAttendance}
            rtl={rtl} locale={locale} icon="checkmark-done-outline" textDirection={textDirection}
            onPress={() => onAttendance(nextSupervision.classId, today.date)} />
        ) : null}
        {learning && pending.homeworkDrafts > 0 ? (
          <Task label={translate(locale, "teacher.draftHomework")} count={pending.homeworkDrafts}
            rtl={rtl} locale={locale} icon="document-text-outline" textDirection={textDirection} onPress={onHomework} />
        ) : null}
        {learning && pending.openGradeSheets > 0 ? (
          <Task label={translate(locale, "teacher.gradesToEnter")} count={pending.openGradeSheets}
            rtl={rtl} locale={locale} icon="stats-chart-outline" textDirection={textDirection} onPress={onGrades} />
        ) : null}
        {unreadCount > 0 ? (
          <Task label={translate(locale, "teacher.unreadNotifications")} count={unreadCount}
            rtl={rtl} locale={locale} icon="notifications-outline" textDirection={textDirection} onPress={onNotifications} />
        ) : null}
        {!learningReady ? (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "common.loading")}</Text>
        ) : null}
        {learningReady && !learning ? (
          <Action label={translate(locale, "action.retry")} icon="refresh-outline" rtl={rtl} onPress={onRetry} />
        ) : null}
        {learningReady && learning && pending.homeworkDrafts === 0 &&
          pending.openGradeSheets === 0 && pending.pendingAttendance === 0 && unreadCount === 0 ? (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noPendingTasks")}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}><Ionicons name="flash-outline" size={21} color={tokens.color.brandStrong} /></View>
          <Text style={[styles.heading, textDirection]}>{translate(locale, "teacher.quickActions")}</Text>
        </View>
        <View style={[styles.actions, rtl && styles.rowRtl]}>
          {learning?.assignments.length ? (
            <Action label={translate(locale, "teacher.newHomework")} icon="create-outline" rtl={rtl} onPress={onHomework} />
          ) : null}
          {pending.openGradeSheets ? (
            <Action label={translate(locale, "teacher.gradesToEnter")} icon="stats-chart-outline" rtl={rtl} onPress={onGrades} />
          ) : null}
          <Action label={translate(locale, "teacher.viewAssignments")} icon="people-outline" rtl={rtl} onPress={onClasses} />
          <Action label={translate(locale, "teacher.viewFullSchedule")} icon="calendar-outline" rtl={rtl} onPress={onSchedule} />
          <Action label={translate(locale, "teacher.notificationsCenter")} icon="notifications-outline" rtl={rtl} onPress={onNotifications} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}><Ionicons name="megaphone-outline" size={21} color={tokens.color.brandStrong} /></View>
          <Text style={[styles.heading, textDirection]}>{translate(locale, "teacher.latestAnnouncements")}</Text>
        </View>
        {!announcementsReady ? <Text style={[styles.muted, textDirection]}>{translate(locale, "common.loading")}</Text>
        : latestAnnouncements.length ? latestAnnouncements.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" onPress={onAnnouncements}
            style={({ pressed }) => [styles.update, pressed && styles.pressed]}>
            <Text style={[styles.nextTitle, textDirection]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.muted, textDirection]} numberOfLines={2}>{item.content}</Text>
            <Text style={[styles.muted, textDirection]}>{formatLocalizedDate(item.publishAt, locale)}</Text>
          </Pressable>
        )) : <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noAnnouncements")}</Text>}
        {latestAnnouncements.length ? (
          <Action label={translate(locale, "teacher.allAnnouncements")} icon="arrow-forward-outline" rtl={rtl} onPress={onAnnouncements} />
        ) : null}
      </View>
    </View>
  );
}

export function TeacherInboxModal({
  open, locale, notifications, announcements, notificationsReady, announcementsReady,
  textDirection, onClose, onMarkRead, onMarkAllRead, onRetry, onOpenNotification
}: {
  open: boolean;
  locale: SupportedLocale;
  notifications: ParentNotification[];
  announcements: AnnouncementPayload[];
  notificationsReady: boolean;
  announcementsReady: boolean;
  textDirection: Direction;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRetry: () => void;
  onOpenNotification: (item: ParentNotification) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const [onlyUnread, setOnlyUnread] = useState(false);
  const listed = notifications.filter((item) => !onlyUnread || !item.readAt);
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal testID="teacher-notifications-center">
          <View style={[styles.modalHeader, rtl && styles.rowRtl]}>
            <View style={styles.flex}>
              <Text style={[styles.modalTitle, textDirection]}>{translate(locale, "teacher.notificationsCenter")}</Text>
              <Text style={[styles.muted, textDirection]}>
                {translate(locale, "teacher.unreadNotifications")}: {formatLocalizedNumber(unreadCount, locale)}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "teacher.closeNotifications")}
              onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={tokens.color.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inboxScroll}>
            <View style={[styles.inboxFooter, rtl && styles.rowRtl]}>
              <Text style={[styles.heading, styles.flex, textDirection]}>{translate(locale, "notifications.title")}</Text>
              <Pressable accessibilityRole="button"
                accessibilityState={{ selected: onlyUnread }}
                onPress={() => setOnlyUnread((old) => !old)} style={styles.readButton}>
                <Text style={styles.actionText}>
                  {translate(locale, onlyUnread ? "teacher.allNotifications" : "teacher.onlyUnread")}
                </Text>
              </Pressable>
            </View>
            {unreadCount > 0 ? (
              <Pressable accessibilityRole="button" onPress={onMarkAllRead} style={styles.readButton}>
                <Text style={styles.actionText}>{translate(locale, "teacher.markAllRead")}</Text>
              </Pressable>
            ) : null}
            {!notificationsReady ? <Text style={[styles.muted, textDirection]}>{translate(locale, "common.loading")}</Text>
              : listed.length === 0 ? <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noNotifications")}</Text>
              : [...listed].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30).map((item) => (
                <View style={[styles.inboxItem, !item.readAt && styles.inboxUnread]} key={item.id}>
                  <Pressable accessibilityRole="button" accessibilityLabel={item.title}
                    onPress={() => onOpenNotification(item)}>
                    <Text style={[styles.nextTitle, textDirection]}>{item.title}</Text>
                    <Text style={[styles.muted, textDirection]}>{item.message}</Text>
                  </Pressable>
                  <View style={[styles.inboxFooter, rtl && styles.rowRtl]}>
                    <Text style={styles.inboxDate}>{formatLocalizedDate(item.createdAt, locale)}</Text>
                    {!item.readAt ? (
                      <Pressable accessibilityRole="button" onPress={() => onMarkRead(item.id)} style={styles.readButton}>
                        <Text style={styles.actionText}>{translate(locale, "teacher.markRead")}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            <Text style={[styles.heading, textDirection]}>{translate(locale, "teacher.latestAnnouncements")}</Text>
            {!announcementsReady ? <Text style={[styles.muted, textDirection]}>{translate(locale, "common.loading")}</Text>
              : announcements.length === 0 ? <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noAnnouncements")}</Text>
              : [...announcements].sort((a, b) => b.publishAt.localeCompare(a.publishAt)).slice(0, 10).map((item) => (
                <View style={styles.inboxItem} key={item.id}>
                  <Text style={[styles.nextTitle, textDirection]}>{item.title}</Text>
                  <Text style={[styles.muted, textDirection]}>{item.content}</Text>
                  <Text style={[styles.inboxDate, textDirection]}>{formatLocalizedDate(item.publishAt, locale)}</Text>
                </View>
              ))}
            <Action label={translate(locale, "action.retry")} icon="refresh-outline" rtl={rtl} onPress={onRetry} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  flex: { flex: 1, minWidth: 0 },
  rowRtl: { flexDirection: "row-reverse" },
  card: { padding: 16, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0e8f2", gap: 12 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconShell: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#edf3ff", justifyContent: "center", alignItems: "center" },
  heading: { flex: 1, fontSize: 16, fontWeight: "900", color: tokens.color.text },
  muted: { fontSize: 12.5, lineHeight: 19, color: tokens.color.textMuted },
  nextTitle: { fontSize: 14, color: tokens.color.text, fontWeight: "800" },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, minWidth: 0, padding: 10, borderRadius: 13, alignItems: "center", gap: 4, backgroundColor: "#f2f6fd" },
  metricValue: { fontSize: 21, fontWeight: "900", color: tokens.color.brandStrong },
  metricLabel: { textAlign: "center", fontSize: 11, color: tokens.color.textMuted, lineHeight: 16 },
  nextLesson: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, backgroundColor: "#f2f7ff", borderRadius: 14 },
  nextTime: { padding: 9, backgroundColor: "#dfeaff", borderRadius: 10 },
  nextTimeText: { fontSize: 12, fontWeight: "900", color: tokens.color.brandStrong },
  task: { flexDirection: "row", minHeight: 53, alignItems: "center", gap: 9, padding: 9, borderRadius: 12, backgroundColor: "#f7faff" },
  taskIcon: { width: 30, alignItems: "center" },
  taskText: { flex: 1, fontSize: 13, fontWeight: "700", color: tokens.color.text },
  taskCount: { fontSize: 15, fontWeight: "900", color: tokens.color.brandStrong },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12,
    paddingVertical: 10, minHeight: 45, borderRadius: 12, backgroundColor: "#edf4ff" },
  actionText: { fontSize: 12.5, color: tokens.color.brandStrong, fontWeight: "800" },
  update: { gap: 4, borderTopWidth: 1, borderTopColor: "#eef1f5", paddingTop: 10 },
  pressed: { opacity: 0.7 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(12,24,44,0.6)" },
  modalCard: { maxHeight: "92%", minHeight: "55%", borderTopLeftRadius: 23, borderTopRightRadius: 23,
    backgroundColor: "#fff", paddingTop: 16, paddingHorizontal: 17 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e1e7f0" },
  modalTitle: { fontSize: 19, fontWeight: "900", color: tokens.color.text },
  closeButton: { minWidth: 45, minHeight: 45, alignItems: "center", justifyContent: "center" },
  inboxScroll: { paddingTop: 16, paddingBottom: 30, gap: 13 },
  inboxItem: { gap: 8, padding: 13, borderWidth: 1, borderColor: "#e1e7f0", borderRadius: 13 },
  inboxUnread: { borderColor: "#a9c9ef", backgroundColor: "#f3f8ff" },
  inboxFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  inboxDate: { color: tokens.color.textMuted, fontSize: 11.5 },
  readButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 11, backgroundColor: "#e9f2ff", borderRadius: 10 }
});
