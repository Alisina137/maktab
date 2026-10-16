import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  formatLocalizedTime,
  getDirection,
  translate,
  type SupportedLocale,
  type TranslationKey
} from "@maktablink/localization";
import { api, type TeacherTodayPayload, type TeacherAcademicsPayload, type AdminContactPayload, type TeacherLearningPayload, type ParentNotification, type AnnouncementPayload } from "./api";
import { TeacherTodayInsights, TeacherInboxModal, type TeacherWorkflowSection } from "./teacher-hub";
import { notificationDestination } from "./notification-destination";
import { teacherTime12 } from "./teacher-hub-data";
import { TeacherClassDetailPage, type TeacherClassSection, type TeacherClassLearningSection } from "./teacher-class-detail";
import { TeacherMorePanel, type TeacherMoreSection } from "./teacher-more";
import { TeacherLearningPanel } from "./learning-ui";
import { TeacherTasksPanel } from "./teacher-tasks";
import { CommunicationPanel } from "./communication-ui";
import type { AppErrorKind } from "./error-message";

export type TeacherTab = "TODAY" | "SCHEDULE" | "CLASSES" | "WORK" | "MORE";
type Direction = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
type Icon = keyof typeof Ionicons.glyphMap;
type Period = TeacherAcademicsPayload["schedule"][number];

const weekdays = [
  "SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"
] as const;
const weekdayLabels: Record<(typeof weekdays)[number], TranslationKey> = {
  SATURDAY: "weekday.saturday", SUNDAY: "weekday.sunday",
  MONDAY: "weekday.monday", TUESDAY: "weekday.tuesday",
  WEDNESDAY: "weekday.wednesday", THURSDAY: "weekday.thursday"
};

export function TeacherBottomNavigation({
  tab, locale, onSelect
}: {
  tab: TeacherTab;
  locale: SupportedLocale;
  onSelect: (tab: TeacherTab) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const items: Array<{ id: TeacherTab; label: TranslationKey; icon: Icon; activeIcon: Icon }> = [
    { id: "TODAY", label: "teacher.todayTitle", icon: "today-outline", activeIcon: "today" },
    { id: "SCHEDULE", label: "teacher.navSchedule", icon: "calendar-outline", activeIcon: "calendar" },
    { id: "CLASSES", label: "teacher.navClasses", icon: "people-outline", activeIcon: "people" },
    { id: "WORK", label: "teacher.navWork", icon: "briefcase-outline", activeIcon: "briefcase" },
    { id: "MORE", label: "teacher.navMore", icon: "ellipsis-horizontal-circle-outline", activeIcon: "ellipsis-horizontal-circle" }
  ];
  return (
    <View style={[styles.bottomBar, rtl && styles.rowRtl]} accessibilityRole="tablist">
      {items.map((item) => {
        const active = tab === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={translate(locale, item.label)}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [styles.bottomTab, active && styles.activeBottomTab, pressed && styles.pressed]}
          >
            <View style={[styles.navIcon, active && styles.navIconActive]}>
              <Ionicons name={active ? item.activeIcon : item.icon} size={20} color={active ? tokens.color.brandStrong : tokens.color.textMuted} />
            </View>
            <Text style={[styles.navLabel, active && styles.activeNavLabel]}>{translate(locale, item.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionHeading({ icon, title, rtl, textDirection }: {
  icon: Icon; title: string; rtl: boolean; textDirection: Direction;
}) {
  return (
    <View style={[styles.heading, rtl && styles.rowRtl]}>
      <View style={styles.iconShell}><Ionicons name={icon} size={20} color={tokens.color.brandStrong} /></View>
      <Text style={[styles.headingText, styles.flex, textDirection]}>{title}</Text>
    </View>
  );
}

function PeriodRow({ item, locale, textDirection, rtl }: {
  item: Period; locale: SupportedLocale; textDirection: Direction; rtl: boolean;
}) {
  return (
    <View style={[styles.periodRow, rtl && styles.rowRtl]}>
      <View style={styles.timeChip}><Text style={styles.timeText}>{teacherTime12(item.startsAt)}</Text></View>
      <View style={styles.flex}>
        <Text style={[styles.itemTitle, textDirection]}>{item.subjectName}</Text>
        <Text style={[styles.muted, textDirection]}>{item.className} · {item.classCode}</Text>
      </View>
    </View>
  );
}

function LoadingCard({ locale }: { locale: SupportedLocale }) {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator color={tokens.color.brand} />
      <Text style={styles.muted}>{translate(locale, "common.loading")}</Text>
    </View>
  );
}

function Empty({ message, rtl, textDirection }: { message: string; rtl: boolean; textDirection: Direction }) {
  return (
    <View style={[styles.empty, rtl && styles.rowRtl]}>
      <Ionicons name="information-circle-outline" size={21} color={tokens.color.textMuted} />
      <Text style={[styles.muted, styles.flex, textDirection]}>{message}</Text>
    </View>
  );
}

export function TeacherExperience({
  tab, today, academics, todayReady, academicsReady, schoolName, username, teacherUserId, schoolId, locale,
  textDirection, accessToken, adminContact, reconnectEpoch, onSelect, onAttendance,
  onRetry, onError, onNotice, onLogout, onScrollTop, onLocaleChange, externalNavigation
}: {
  tab: TeacherTab;
  today: TeacherTodayPayload | null;
  academics: TeacherAcademicsPayload | null;
  todayReady: boolean;
  academicsReady: boolean;
  schoolName: string;
  username: string;
  teacherUserId: string;
  schoolId: string;
  locale: SupportedLocale;
  textDirection: Direction;
  accessToken: string;
  adminContact: AdminContactPayload | null;
  reconnectEpoch: number;
  onSelect: (tab: TeacherTab) => void;
  onAttendance: (classId: string, date: string) => void;
  onRetry: () => void;
  onError: (key: TranslationKey | null, kind?: AppErrorKind) => void;
  onNotice: (message: string | null) => void;
  onLogout: () => void;
  onScrollTop: () => void;
  onLocaleChange: (locale: SupportedLocale) => void;
  externalNavigation?: { id: number; target: "HOMEWORK" | "GRADES" | "ANNOUNCEMENTS" } | null;
}) {
  const rtl = getDirection(locale) === "rtl";
  const statusKey = (status: "PENDING" | "SUBMITTED") =>
    status === "PENDING" ? "attendance.pending" : "attendance.submitted";
  const todaySchedule = [...(today?.schedule ?? [])].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.className.localeCompare(b.className)
  );
  const schedule = academics?.schedule ?? [];
  const assignments = academics?.assignmentDetails ?? [];
  const uniqueClassCount = new Set(assignments.map((item) => item.classId)).size;
  const currentWeekday = today?.weekday;
  const activeSupervisions = today?.supervisedClasses ?? [];
  const [workflowSection, setWorkflowSection] = useState<TeacherWorkflowSection>("HOMEWORK");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [classSection, setClassSection] = useState<TeacherClassSection>("OVERVIEW");
  const [classLearningSection, setClassLearningSection] = useState<TeacherClassLearningSection>("HOMEWORK");
  const [moreSection, setMoreSection] = useState<TeacherMoreSection>("HOME");
  const [inboxOpen, setInboxOpen] = useState(false);
  const [hubLearning, setHubLearning] = useState<TeacherLearningPayload | null>(null);
  const [hubAnnouncements, setHubAnnouncements] = useState<AnnouncementPayload[]>([]);
  const [hubNotifications, setHubNotifications] = useState<ParentNotification[]>([]);
  const [hubReady, setHubReady] = useState({ learning: false, announcements: false, notifications: false });
  const [hubRefresh, setHubRefresh] = useState(0);
  const hubRequestId = useRef(0);
  const currentToken = useRef(accessToken);
  const previousTab = useRef(tab);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setHubRefresh((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (previousTab.current === "WORK" && tab === "TODAY") {
      setHubRefresh((value) => value + 1);
    }
    previousTab.current = tab;
  }, [tab]);

  useEffect(() => {
    const requestId = ++hubRequestId.current;
    currentToken.current = accessToken;
    // Keep last successful data visible while a refresh is in flight.
    // A single failed ngrok request must not erase an otherwise valid inbox.
    const read = async () => {
      const [learning, announcements, notifications] = await Promise.allSettled([
        api.teacherLearning(accessToken),
        api.announcements(accessToken),
        api.notifications(accessToken)
      ] as const);
      if (hubRequestId.current !== requestId) return;
      if (learning.status === "fulfilled") setHubLearning(learning.value);
      if (announcements.status === "fulfilled") setHubAnnouncements(announcements.value.announcements);
      if (notifications.status === "fulfilled") setHubNotifications(notifications.value.notifications);
      setHubReady({ learning: true, announcements: true, notifications: true });
    };
    void read();
    return () => { hubRequestId.current += 1; };
  }, [accessToken, reconnectEpoch, hubRefresh]);

  async function markAllTeacherNotificationsRead() {
    try {
      await api.teacherMarkAllNotificationsRead(accessToken);
      const now = new Date().toISOString();
      setHubNotifications((items) => items.map((item) => item.readAt ? item : { ...item, readAt: now }));
      setHubRefresh((count) => count + 1);
    } catch {
      // Never pretend an offline or unauthorized update was successful.
    }
  }

  function openInbox() {
    setInboxOpen(true);
    setHubRefresh((count) => count + 1);
  }

  async function markTeacherNotificationRead(notificationId: string) {
    try {
      const token = accessToken;
      const result = await api.markNotificationRead(token, notificationId);
      if (currentToken.current !== token) return;
      setHubNotifications((current) => current.map((item) =>
        item.id === notificationId ? result.notification : item
      ));
    } catch {
      // Leave the notification unread so it can be acknowledged after reconnect.
    }
  }

  function goToWorkflow(section: TeacherWorkflowSection | "ANNOUNCEMENTS") {
    if (section === "ANNOUNCEMENTS") {
      setMoreSection("ANNOUNCEMENTS");
      onSelect("MORE");
    } else {
      setWorkflowSection(section);
      onSelect("WORK");
    }
    onScrollTop();
  }
  // An external notification must open its nested destination, not the
  // previously selected Work or More subtab.
  useEffect(() => {
    if (!externalNavigation) return;
    if (externalNavigation.target === "ANNOUNCEMENTS") setMoreSection("ANNOUNCEMENTS");
    else setWorkflowSection(externalNavigation.target);
  }, [externalNavigation?.id]);

  const unreadCount = hubNotifications.filter((item) => !item.readAt).length;

  return (
    <View style={styles.stack}>
      <View style={[styles.hero, rtl && styles.rowRtl]}>
        <View style={styles.heroIcon}><Ionicons name="school-outline" size={24} color={tokens.color.brandStrong} /></View>
        <View style={styles.flex}>
          <Text style={[styles.heroTitle, textDirection]}>{translate(locale, "teacher.workspace")}</Text>
          <Text style={[styles.muted, textDirection]}>{today?.teacher.fullName ?? username}</Text>
          <Text style={[styles.context, textDirection]}>{schoolName}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate(locale, "teacher.notificationsCenter")}
          onPress={openInbox}
          style={styles.inboxButton}
          testID="teacher-inbox-button"
        >
          <Ionicons name="notifications-outline" size={23} color={tokens.color.brandStrong} />
          {unreadCount > 0 ? (
            <View style={styles.inboxBadge}>
              <Text style={styles.inboxBadgeText}>{unreadCount > 99 ? "99+" : formatLocalizedNumber(unreadCount, locale)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {tab === "TODAY" ? (
        <>
          <TeacherTodayInsights
            today={today}
            learning={hubLearning}
            learningReady={hubReady.learning}
            announcements={hubAnnouncements}
            announcementsReady={hubReady.announcements}
            notifications={hubNotifications}
            locale={locale}
            textDirection={textDirection}
            onSchedule={() => onSelect("SCHEDULE")}
            onClasses={() => onSelect("CLASSES")}
            onHomework={() => goToWorkflow("HOMEWORK")}
            onGrades={() => goToWorkflow("GRADES")}
            onAnnouncements={() => goToWorkflow("ANNOUNCEMENTS")}
            onNotifications={openInbox}
            onAttendance={onAttendance}
            onRetry={() => setHubRefresh((value) => value + 1)}
          />
          <Pressable accessibilityRole="button" style={[styles.actionRow, rtl && styles.rowRtl]}
            onPress={() => goToWorkflow("TASKS")}>
            <Ionicons name="checkbox-outline" color={tokens.color.brandStrong} size={22} />
            <Text style={[styles.itemTitle, styles.flex, textDirection]}>
              {translate(locale, "productivity.title")}
            </Text>
            <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={18} color={tokens.color.textMuted}/>
          </Pressable>
          <View style={styles.card}>
            <SectionHeading icon="today-outline" title={translate(locale, "teacher.todayTitle")} rtl={rtl} textDirection={textDirection} />
            <Text style={[styles.date, textDirection]}>
              {today ? `${formatLocalizedDate(today.date, locale)} · ${weekdayLabels[today.weekday as keyof typeof weekdayLabels] ? translate(locale, weekdayLabels[today.weekday as keyof typeof weekdayLabels]) : today.weekday}` : "—"}
            </Text>
            {!todayReady ? <LoadingCard locale={locale} /> : (
              <>
                <Text style={[styles.muted, textDirection]}>
                  {translate(locale, "teacher.periodCount")}: {formatLocalizedNumber(todaySchedule.length, locale)}
                </Text>
                {todaySchedule.map((item) => <PeriodRow key={item.id} item={{ ...item, weekday: today?.weekday as Period["weekday"] }} locale={locale} textDirection={textDirection} rtl={rtl} />)}
                {todaySchedule.length === 0 ? <Empty message={translate(locale, "teacher.noClassesToday")} rtl={rtl} textDirection={textDirection} /> : null}
                <Pressable accessibilityRole="button" style={styles.link} onPress={() => onSelect("SCHEDULE")}>
                  <Text style={styles.linkText}>{translate(locale, "teacher.viewFullSchedule")}</Text>
                  <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} color={tokens.color.brandStrong} size={18} />
                </Pressable>
              </>
            )}
          </View>
          <View style={styles.card}>
            <SectionHeading icon="checkmark-done-outline" title={translate(locale, "teacher.supervisedClass")} rtl={rtl} textDirection={textDirection} />
            {!todayReady ? <LoadingCard locale={locale} /> : (
              <>
                {activeSupervisions.map((item) => (
                  <Pressable key={item.assignmentId} accessibilityRole="button"
                    accessibilityLabel={`${item.className} · ${translate(locale, statusKey(item.attendanceStatus))}`}
                    onPress={() => today && onAttendance(item.classId, today.date)}
                    style={({ pressed }) => [styles.actionRow, rtl && styles.rowRtl, pressed && styles.pressed]}
                  >
                    <Ionicons name="people-outline" color={tokens.color.brandStrong} size={20} />
                    <View style={styles.flex}>
                      <Text style={[styles.itemTitle, textDirection]}>{item.className}</Text>
                      <Text style={[styles.muted, textDirection]}>{translate(locale, statusKey(item.attendanceStatus))}</Text>
                    </View>
                    <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} color={tokens.color.textMuted} size={18} />
                  </Pressable>
                ))}
                {activeSupervisions.length === 0 ? <Empty message={translate(locale, "teacher.noSupervisedClass")} rtl={rtl} textDirection={textDirection} /> : null}
              </>
            )}
          </View>
          <Pressable onPress={() => onSelect("CLASSES")} accessibilityRole="button" style={styles.link}>
            <Text style={styles.linkText}>{translate(locale, "teacher.viewAssignments")}</Text>
            <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} color={tokens.color.brandStrong} size={18} />
          </Pressable>
        </>
      ) : null}

      {tab === "SCHEDULE" ? (
        <View style={styles.card}>
          <SectionHeading icon="calendar-outline" title={translate(locale, "teacher.fullSchedule")} rtl={rtl} textDirection={textDirection} />
          {!academicsReady ? <LoadingCard locale={locale} /> : weekdays.map((weekday) => {
            const items = schedule.filter((item) => item.weekday === weekday)
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.className.localeCompare(b.className));
            return (
              <View key={weekday} style={[styles.dayCard, weekday === currentWeekday && styles.todayDay]}>
                <View style={[styles.dayHeader, rtl && styles.rowRtl]}>
                  <Text style={[styles.dayLabel, textDirection]}>{translate(locale, weekdayLabels[weekday])}</Text>
                  {weekday === currentWeekday ? <Text style={styles.todayBadge}>{translate(locale, "student.today")}</Text> : null}
                  <Text style={styles.dayCount}>{formatLocalizedNumber(items.length, locale)}</Text>
                </View>
                {items.map((item) => <PeriodRow key={item.id} item={item} locale={locale} textDirection={textDirection} rtl={rtl} />)}
                {items.length === 0 ? <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noClassesForDay")}</Text> : null}
              </View>
            );
          })}
          {academicsReady && schedule.filter((item) => item.weekday !== "FRIDAY").length === 0 ? (
            <Empty message={translate(locale, "teacher.noSchedule")} rtl={rtl} textDirection={textDirection} />
          ) : null}
        </View>
      ) : null}

      {tab === "CLASSES" ? (
        selectedAssignmentId ? (
          <TeacherClassDetailPage
            key={selectedAssignmentId}
            assignmentId={selectedAssignmentId}
            accessToken={accessToken}
            reconnectEpoch={reconnectEpoch}
            locale={locale}
            textDirection={textDirection}
            teacherToday={today}
            onBack={() => { setSelectedAssignmentId(null); setClassSection("OVERVIEW"); onScrollTop(); }}
            section={classSection} onSectionChange={setClassSection}
            learningSection={classLearningSection} onLearningSectionChange={setClassLearningSection}
            onAttendance={onAttendance}
            onError={onError}
            onNotice={onNotice}
            onScrollTop={onScrollTop}
          />
        ) : (
        <>
          <View style={styles.card}>
            <SectionHeading icon="book-outline" title={translate(locale, "teacher.myAssignments")} rtl={rtl} textDirection={textDirection} />
            {!academicsReady ? <LoadingCard locale={locale} /> : (
              <>
                <Text style={[styles.muted, textDirection]}>
                  {formatLocalizedNumber(uniqueClassCount, locale)} {translate(locale, "teacher.classesCount")} · {formatLocalizedNumber(assignments.length, locale)} {translate(locale, "teacher.subjectsCount")}
                </Text>
                {assignments.map((item) => (
                  <Pressable key={item.assignmentId} accessibilityRole="button"
                    accessibilityLabel={`${item.className} · ${item.subjectName}`}
                    onPress={() => { if (selectedAssignmentId !== item.assignmentId) {
                      setClassSection("OVERVIEW"); setClassLearningSection("HOMEWORK");
                    } setSelectedAssignmentId(item.assignmentId); onScrollTop(); }}
                    style={({ pressed }) => [styles.actionRow, rtl && styles.rowRtl, pressed && styles.pressed]}>
                    <Ionicons name="book-outline" color={tokens.color.brandStrong} size={20} />
                    <View style={styles.flex}>
                      <Text style={[styles.itemTitle, textDirection]}>{item.className} · {item.classCode}</Text>
                      <Text style={[styles.muted, textDirection]}>{item.subjectName}</Text>
                    </View>
                    <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} color={tokens.color.textMuted} size={18} />
                  </Pressable>
                ))}
                {assignments.length === 0 ? <Empty message={translate(locale, "teacher.noAssignments")} rtl={rtl} textDirection={textDirection} /> : null}
              </>
            )}
          </View>
          <View style={styles.card}>
            <SectionHeading icon="shield-checkmark-outline" title={translate(locale, "teacher.supervisedClass")} rtl={rtl} textDirection={textDirection} />
            <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.negaranHint")}</Text>
            {!todayReady ? <LoadingCard locale={locale} /> : (
              <>
                {activeSupervisions.map((item) => (
                  <Pressable key={item.assignmentId}
                    accessibilityRole="button"
                    onPress={() => today && onAttendance(item.classId, today.date)}
                    style={({ pressed }) => [styles.actionRow, rtl && styles.rowRtl, pressed && styles.pressed]}
                  >
                    <Ionicons name="checkmark-circle-outline" color={tokens.color.brandStrong} size={20} />
                    <View style={styles.flex}>
                      <Text style={[styles.itemTitle, textDirection]}>{item.className} · {item.classCode}</Text>
                      <Text style={[styles.muted, textDirection]}>{translate(locale, statusKey(item.attendanceStatus))}</Text>
                    </View>
                    <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} color={tokens.color.textMuted} size={18} />
                  </Pressable>
                ))}
                {activeSupervisions.length === 0 ? <Empty message={translate(locale, "teacher.noSupervisedClass")} rtl={rtl} textDirection={textDirection} /> : null}
              </>
            )}
          </View>
        </>
        )
      ) : null}

      {tab === "WORK" ? (
        <>
          <View style={styles.card}>
            <SectionHeading icon="briefcase-outline" title={translate(locale, "teacher.navWork")} rtl={rtl} textDirection={textDirection} />
            <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.workflowsHint")}</Text>
            <View style={[styles.workflowTabs, rtl && styles.rowRtl]} accessibilityRole="tablist">
              {([
                ["HOMEWORK", "teacher.workflowHomework", "document-text-outline"],
                ["GRADES", "teacher.workflowGrades", "stats-chart-outline"],
                ["TASKS", "productivity.title", "checkbox-outline"]
              ] as const).map(([id, label, icon]) => (
                <Pressable key={id} accessibilityRole="tab"
                  accessibilityLabel={translate(locale, label)}
                  accessibilityState={{ selected: workflowSection === id }}
                  onPress={() => { setWorkflowSection(id); onScrollTop(); }}
                  style={({ pressed }) => [
                    styles.workflowTab, workflowSection === id && styles.workflowTabActive, pressed && styles.pressed
                  ]}>
                  <Ionicons name={icon} size={18} color={workflowSection === id ? tokens.color.brandStrong : tokens.color.textMuted} />
                  <Text numberOfLines={2} style={[styles.workflowTabText, workflowSection === id && styles.workflowTabTextActive]}>
                    {translate(locale, label)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {workflowSection === "TASKS" ? (
            <TeacherTasksPanel
              accessToken={accessToken} schoolId={schoolId} teacherUserId={teacherUserId}
              locale={locale} textDirection={textDirection} reconnectEpoch={reconnectEpoch}
              onError={onError} onNotice={onNotice}
            />
          ) : (
            <TeacherLearningPanel
              key={`teacher-learning-${reconnectEpoch}-${workflowSection}`}
              section={workflowSection}
              onScrollTop={onScrollTop}
              accessToken={accessToken} locale={locale}
              textDirection={textDirection} onError={onError} onNotice={onNotice}
            />
          )}
        </>
      ) : null}

      {tab === "MORE" ? (
        <TeacherMorePanel
          section={moreSection}
          schoolName={schoolName}
          username={username}
          fullName={today?.teacher.fullName ?? username}
          unreadCount={unreadCount}
          locale={locale}
          textDirection={textDirection}
          contact={adminContact}
          onSectionChange={(next) => { setMoreSection(next); onScrollTop(); }}
          onNotifications={openInbox}
          onChangeLocale={onLocaleChange}
          onLogout={onLogout}
          announcementContent={moreSection === "ANNOUNCEMENTS" ? (
            <CommunicationPanel
              key={`teacher-communication-${reconnectEpoch}`}
              accessToken={accessToken} mode="TEACHER" teacherSection="ANNOUNCEMENTS"
              supervisedClasses={activeSupervisions}
              locale={locale} textDirection={textDirection}
              onError={onError} onNotice={onNotice}
            />
          ) : null}
        />
      ) : null}

      {(tab === "TODAY" && todayReady && !today) ||
        (tab === "SCHEDULE" && academicsReady && !academics) ||
        (tab === "CLASSES" && ((todayReady && !today) || (academicsReady && !academics))) ? (
        <Pressable accessibilityRole="button" style={styles.retry} onPress={onRetry}>
          <Ionicons name="refresh-outline" color={tokens.color.brandStrong} size={18} />
          <Text style={styles.linkText}>{translate(locale, "action.retry")}</Text>
        </Pressable>
      ) : null}
      <TeacherInboxModal
        open={inboxOpen}
        locale={locale}
        notifications={hubNotifications}
        announcements={hubAnnouncements}
        notificationsReady={hubReady.notifications}
        announcementsReady={hubReady.announcements}
        textDirection={textDirection}
        onClose={() => setInboxOpen(false)}
        onMarkRead={(notificationId) => void markTeacherNotificationRead(notificationId)}
        onOpenNotification={(item) => {
          void markTeacherNotificationRead(item.id);
          setInboxOpen(false);
          const target = notificationDestination("TEACHER", item);
          if (target === "TEACHER_ANNOUNCEMENTS") goToWorkflow("ANNOUNCEMENTS");
          else if (target === "TEACHER_HOMEWORK") goToWorkflow("HOMEWORK");
          else if (target === "TEACHER_GRADES") goToWorkflow("GRADES");
          else if (target === "TEACHER_TODAY") onSelect("TODAY");
        }}
        onMarkAllRead={() => void markAllTeacherNotificationsRead()}
        onRetry={() => setHubRefresh((value) => value + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  flex: { flex: 1, minWidth: 0 },
  rowRtl: { flexDirection: "row-reverse" },
  hero: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: "#dbe7f5", backgroundColor: "#f7faff" },
  heroIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: "#e3effe", justifyContent: "center", alignItems: "center" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: tokens.color.text },
  context: { fontSize: 12, marginTop: 3, color: tokens.color.brandStrong },
  card: { padding: 16, borderWidth: 1, borderColor: "#e1e7f0", borderRadius: 21, backgroundColor: tokens.color.surface, gap: 13 },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconShell: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#edf3ff" },
  headingText: { fontSize: 16, fontWeight: "800", color: tokens.color.text },
  date: { fontSize: 15, fontWeight: "800", color: tokens.color.brandStrong },
  muted: { color: tokens.color.textMuted, fontSize: 12.5, lineHeight: 19 },
  itemTitle: { fontSize: 14, fontWeight: "800", color: tokens.color.text },
  periodRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 10, backgroundColor: "#f7faff", borderRadius: 13 },
  timeChip: { minWidth: 69, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, paddingVertical: 9, borderRadius: 10, backgroundColor: "#e8f1fc" },
  timeText: { fontSize: 12, fontWeight: "800", color: tokens.color.brandStrong },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#e5ecf5", borderRadius: 13, backgroundColor: "#f9fbff", padding: 12, minHeight: 55 },
  link: { padding: 13, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", borderRadius: 13, backgroundColor: "#edf4ff" },
  linkText: { fontSize: 13, fontWeight: "800", color: tokens.color.brandStrong },
  loadingCard: { paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  empty: { padding: 14, backgroundColor: "#f6f8fb", borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  dayCard: { padding: 12, borderWidth: 1, borderColor: "#e1e8f2", borderRadius: 15, gap: 9 },
  todayDay: { borderWidth: 2, borderColor: tokens.color.brand, backgroundColor: "#f1f7ff" },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayLabel: { flex: 1, fontSize: 14, fontWeight: "800", color: tokens.color.text },
  dayCount: { minWidth: 24, textAlign: "center", color: tokens.color.brandStrong, fontWeight: "800" },
  todayBadge: { fontSize: 11, fontWeight: "800", color: tokens.color.brandStrong },
  retry: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#dae6f5", padding: 15, gap: 8, borderRadius: 14 },
  logout: { minHeight: 49, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, borderWidth: 1, borderColor: "#dce5f1", borderRadius: 13, backgroundColor: "#f8faff" },
  bottomBar: { flexDirection: "row", alignItems: "stretch", paddingHorizontal: 6, paddingTop: 7, paddingBottom: 9, gap: 2, backgroundColor: tokens.color.surface, borderTopWidth: 1, borderTopColor: "#e2e8f0", elevation: 12, shadowColor: "#172033", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -5 } },
  bottomTab: { flex: 1, minHeight: 58, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 16 },
  activeBottomTab: { backgroundColor: "#f3f6fc" },
  navIcon: { width: 32, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  navIconActive: { backgroundColor: "#e7efff" },
  navLabel: { color: tokens.color.textMuted, fontSize: 10, fontWeight: "700", textAlign: "center" },
  activeNavLabel: { color: tokens.color.brandStrong, fontWeight: "900" },
  inboxButton: { width: 49, height: 49, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#e7efff" },
  inboxBadge: { position: "absolute", top: 1, right: 0, minWidth: 20, height: 20, paddingHorizontal: 3, borderRadius: 11, backgroundColor: "#c53549", alignItems: "center", justifyContent: "center" },
  inboxBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  workflowTabs: { flexDirection: "row", gap: 6, paddingTop: 4 },
  workflowTab: { flex: 1, minHeight: 59, gap: 3, borderRadius: 13, alignItems: "center", justifyContent: "center", padding: 7, borderWidth: 1, borderColor: "#e3e9f3", backgroundColor: "#f9fbfe" },
  workflowTabActive: { borderColor: "#a7c2f3", backgroundColor: "#eaf2ff" },
  workflowTabText: { color: tokens.color.textMuted, fontSize: 11, textAlign: "center", fontWeight: "700" },
  workflowTabTextActive: { color: tokens.color.brandStrong, fontWeight: "900" },
  pressed: { opacity: 0.75 }
});
