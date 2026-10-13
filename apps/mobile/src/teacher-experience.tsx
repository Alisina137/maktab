import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
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
import type { TeacherTodayPayload, TeacherAcademicsPayload, AdminContactPayload } from "./api";
import { AdminContactCard } from "./admin-contact-card";
import { TeacherLearningPanel } from "./learning-ui";
import { CommunicationPanel } from "./communication-ui";
import type { AppErrorKind } from "./error-message";

export type TeacherTab = "TODAY" | "SCHEDULE" | "CLASSES" | "WORKFLOWS";
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
    { id: "WORKFLOWS", label: "teacher.navWorkflows", icon: "briefcase-outline", activeIcon: "briefcase" }
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
      <View style={styles.timeChip}><Text style={styles.timeText}>{formatLocalizedTime(item.startsAt, locale)}</Text></View>
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
  tab, today, academics, todayReady, academicsReady, schoolName, username, locale,
  textDirection, accessToken, adminContact, reconnectEpoch, onSelect, onAttendance,
  onRetry, onError, onNotice, onLogout
}: {
  tab: TeacherTab;
  today: TeacherTodayPayload | null;
  academics: TeacherAcademicsPayload | null;
  todayReady: boolean;
  academicsReady: boolean;
  schoolName: string;
  username: string;
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

  return (
    <View style={styles.stack}>
      <View style={[styles.hero, rtl && styles.rowRtl]}>
        <View style={styles.heroIcon}><Ionicons name="school-outline" size={24} color={tokens.color.brandStrong} /></View>
        <View style={styles.flex}>
          <Text style={[styles.heroTitle, textDirection]}>{translate(locale, "teacher.workspace")}</Text>
          <Text style={[styles.muted, textDirection]}>{today?.teacher.fullName ?? username}</Text>
          <Text style={[styles.context, textDirection]}>{schoolName}</Text>
        </View>
      </View>

      {tab === "TODAY" ? (
        <>
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
                    onPress={() => onSelect("WORKFLOWS")}
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
      ) : null}

      {tab === "WORKFLOWS" ? (
        <>
          <View style={styles.card}>
            <SectionHeading icon="briefcase-outline" title={translate(locale, "teacher.navWorkflows")} rtl={rtl} textDirection={textDirection} />
            <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.workflowsHint")}</Text>
          </View>
          <TeacherLearningPanel
            key={`teacher-learning-${reconnectEpoch}`}
            accessToken={accessToken} locale={locale}
            textDirection={textDirection} onError={onError} onNotice={onNotice}
          />
          <CommunicationPanel
            key={`teacher-communication-${reconnectEpoch}`}
            accessToken={accessToken} mode="TEACHER"
            supervisedClasses={activeSupervisions}
            locale={locale} textDirection={textDirection}
            onError={onError} onNotice={onNotice}
          />
          <AdminContactCard contact={adminContact} locale={locale} />
          <Pressable accessibilityRole="button" style={styles.logout} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={18} color={tokens.color.brandStrong} />
            <Text style={styles.linkText}>{translate(locale, "auth.logout")}</Text>
          </Pressable>
        </>
      ) : null}

      {(tab === "TODAY" && todayReady && !today) ||
        (tab === "SCHEDULE" && academicsReady && !academics) ||
        (tab === "CLASSES" && ((todayReady && !today) || (academicsReady && !academics))) ? (
        <Pressable accessibilityRole="button" style={styles.retry} onPress={onRetry}>
          <Ionicons name="refresh-outline" color={tokens.color.brandStrong} size={18} />
          <Text style={styles.linkText}>{translate(locale, "action.retry")}</Text>
        </Pressable>
      ) : null}
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
  bottomBar: { flexDirection: "row", alignItems: "stretch", paddingHorizontal: 10, paddingTop: 7, paddingBottom: 9, gap: 3, backgroundColor: tokens.color.surface, borderTopWidth: 1, borderTopColor: "#e2e8f0", elevation: 12, shadowColor: "#172033", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -5 } },
  bottomTab: { flex: 1, minHeight: 58, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 16 },
  activeBottomTab: { backgroundColor: "#f3f6fc" },
  navIcon: { width: 32, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  navIconActive: { backgroundColor: "#e7efff" },
  navLabel: { color: tokens.color.textMuted, fontSize: 10.5, fontWeight: "700" },
  activeNavLabel: { color: tokens.color.brandStrong, fontWeight: "900" },
  pressed: { opacity: 0.75 }
});
