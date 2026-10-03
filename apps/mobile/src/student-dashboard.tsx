import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  formatLocalizedTimeRange,
  getDirection,
  localizeDigits,
  translate,
  type SupportedLocale
} from "@maktablink/localization";
import type {
  AnnouncementPayload,
  LearnerAcademicPayload,
  ParentNotification,
  StudentTimetablePayload
} from "./api";

type TextDirectionStyle = {
  textAlign: "right" | "left";
  writingDirection: "rtl" | "ltr";
};

type Weekday = StudentTimetablePayload["periods"][number]["period"]["weekday"];

const weekdayByEnglishName: Record<string, Weekday> = {
  SATURDAY: "SATURDAY",
  SUNDAY: "SUNDAY",
  MONDAY: "MONDAY",
  TUESDAY: "TUESDAY",
  WEDNESDAY: "WEDNESDAY",
  THURSDAY: "THURSDAY",
  FRIDAY: "FRIDAY"
};

function currentAfghanistanWeekday(): Weekday {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul",
    weekday: "long"
  })
    .format(new Date())
    .toUpperCase();
  return weekdayByEnglishName[label] ?? "SATURDAY";
}

function LoadingValue({ locale }: { locale: SupportedLocale }) {
  return (
    <View style={styles.loadingValue}>
      <ActivityIndicator size="small" color={tokens.color.brand} />
      <Text style={styles.loadingText}>{translate(locale, "common.loading")}</Text>
    </View>
  );
}

function SummaryCard({
  icon,
  label,
  primary,
  detail,
  loading,
  wide = false,
  rtl,
  locale,
  textDirection
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary: string;
  detail?: string;
  loading: boolean;
  wide?: boolean;
  rtl: boolean;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  return (
    <View style={[styles.summaryCard, wide && styles.summaryCardWide]}>
      <View style={[styles.cardHeading, rtl && styles.rowRtl]}>
        <View style={styles.iconShell}>
          <Ionicons name={icon} size={18} color={tokens.color.brandStrong} />
        </View>
        <Text style={[styles.cardLabel, styles.flex, textDirection]}>{label}</Text>
      </View>
      {loading ? (
        <LoadingValue locale={locale} />
      ) : (
        <>
          <Text style={[styles.cardPrimary, textDirection]} numberOfLines={3}>
            {primary}
          </Text>
          {detail ? (
            <Text style={[styles.cardDetail, textDirection]} numberOfLines={3}>
              {detail}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

export function StudentDashboard({
  timetable,
  timetableReady,
  learning,
  learningReady,
  announcements,
  notifications,
  communicationReady,
  locale,
  textDirection,
  onOpenTimetable,
  onOpenHomework,
  onOpenResults
}: {
  timetable: StudentTimetablePayload | null;
  timetableReady: boolean;
  learning: LearnerAcademicPayload | null;
  learningReady: boolean;
  announcements: AnnouncementPayload[];
  notifications: ParentNotification[];
  communicationReady: boolean;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
  onOpenTimetable: () => void;
  onOpenHomework: () => void;
  onOpenResults: () => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const student = timetable?.student ?? learning?.student ?? null;
  const weekday = currentAfghanistanWeekday();
  const todayPeriods =
    timetable?.periods
      .filter((item) => item.period.weekday === weekday)
      .sort((a, b) => a.period.startsAt.localeCompare(b.period.startsAt)) ?? [];

  const upcomingHomework =
    learning?.homework.find((item) => new Date(item.homework.dueAt).getTime() >= Date.now()) ?? null;
  const latestResult = learning?.results[0] ?? null;
  const latestAnnouncement = announcements[0] ?? null;
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const schedulePrimary =
    todayPeriods.length > 0
      ? todayPeriods[0]?.subjectName ?? translate(locale, "student.noClassesToday")
      : translate(locale, "student.noClassesToday");
  const scheduleDetail =
    todayPeriods.length > 0 && todayPeriods[0]
      ? `${formatLocalizedTimeRange(
          todayPeriods[0].period.startsAt,
          todayPeriods[0].period.endsAt,
          locale
        )} · ${todayPeriods[0].teacherName}${
          todayPeriods.length > 1
            ? ` · +${formatLocalizedNumber(todayPeriods.length - 1, locale)}`
            : ""
        }`
      : undefined;

  const homeworkPrimary =
    upcomingHomework?.homework.title ?? translate(locale, "student.noHomeworkDue");
  const homeworkDetail = upcomingHomework
    ? `${upcomingHomework.subjectName} · ${translate(locale, "learning.due")} ${formatLocalizedDate(
        upcomingHomework.homework.dueAt,
        locale
      )}`
    : undefined;

  const resultPrimary = latestResult
    ? `${latestResult.exam.name} · ${latestResult.subjectName}`
    : translate(locale, "student.noPublishedResult");
  const resultDetail = latestResult
    ? `${formatLocalizedNumber(latestResult.grade.score, locale)}/${formatLocalizedNumber(
        latestResult.examSubject.maxScore,
        locale
      )}`
    : undefined;

  const announcementPrimary =
    latestAnnouncement?.title ?? translate(locale, "student.noAnnouncements");
  const announcementDetail = latestAnnouncement
    ? formatLocalizedDate(latestAnnouncement.publishAt, locale)
    : undefined;

  const notificationPrimary =
    unreadCount > 0
      ? formatLocalizedNumber(unreadCount, locale)
      : translate(locale, "student.noUnreadNotifications");

  return (
    <View style={styles.stack}>
      <View style={styles.heroCard}>
        {student ? (
          <>
            <View style={[styles.identityRow, rtl && styles.rowRtl]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{student.fullName.slice(0, 1)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.studentName, textDirection]}>{student.fullName}</Text>
                <Text style={[styles.studentCode, rtl && styles.studentCodeRtl]}>
                  {student.studentCode}
                </Text>
              </View>
            </View>

            <View style={[styles.metaGrid, rtl && styles.rowRtl]}>
              <View style={styles.metaCell}>
                <Text style={[styles.metaLabel, textDirection]}>
                  {translate(locale, "student.class")}
                </Text>
                <Text style={[styles.metaValue, textDirection]} numberOfLines={2}>
                  {timetable?.classSection.name ?? "—"}
                </Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={[styles.metaLabel, textDirection]}>
                  {translate(locale, "student.studentCode")}
                </Text>
                <Text style={[styles.metaValue, styles.identifierValue, rtl && styles.identifierValueRtl]}>
                  {student.studentCode}
                </Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={[styles.metaLabel, textDirection]}>
                  {translate(locale, "student.academicYear")}
                </Text>
                <Text style={[styles.metaValue, textDirection]} numberOfLines={2}>
                  {timetable ? localizeDigits(timetable.academicYear.name, locale) : "—"}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <LoadingValue locale={locale} />
        )}
      </View>

      <View style={styles.quickActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate(locale, "student.viewTimetable")}
          onPress={onOpenTimetable}
          style={({ pressed }) => [
            styles.timetableAction,
            rtl && styles.rowRtl,
            pressed && styles.pressed
          ]}
        >
          <View style={styles.timetableActionIcon}>
            <Ionicons name="calendar-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.timetableActionTitle, textDirection]}>
              {translate(locale, "student.viewTimetable")}
            </Text>
            <Text style={[styles.timetableActionSubtitle, textDirection]}>
              {translate(locale, "student.timetableSubtitle")}
            </Text>
          </View>
          <Ionicons
            name={rtl ? "chevron-back" : "chevron-forward"}
            size={18}
            color={tokens.color.textMuted}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate(locale, "student.viewHomework")}
          onPress={onOpenHomework}
          style={({ pressed }) => [
            styles.timetableAction,
            rtl && styles.rowRtl,
            pressed && styles.pressed
          ]}
        >
          <View style={styles.timetableActionIcon}>
            <Ionicons name="document-text-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.timetableActionTitle, textDirection]}>
              {translate(locale, "student.viewHomework")}
            </Text>
            <Text style={[styles.timetableActionSubtitle, textDirection]}>
              {translate(locale, "student.homeworkSubtitle")}
            </Text>
          </View>
          <Ionicons
            name={rtl ? "chevron-back" : "chevron-forward"}
            size={18}
            color={tokens.color.textMuted}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate(locale, "student.viewResults")}
          onPress={onOpenResults}
          style={({ pressed }) => [
            styles.timetableAction,
            rtl && styles.rowRtl,
            pressed && styles.pressed
          ]}
        >
          <View style={styles.timetableActionIcon}>
            <Ionicons name="ribbon-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.timetableActionTitle, textDirection]}>
              {translate(locale, "student.viewResults")}
            </Text>
            <Text style={[styles.timetableActionSubtitle, textDirection]}>
              {translate(locale, "student.resultsSubtitle")}
            </Text>
          </View>
          <Ionicons
            name={rtl ? "chevron-back" : "chevron-forward"}
            size={18}
            color={tokens.color.textMuted}
          />
        </Pressable>
      </View>

      <View style={[styles.sectionHeading, rtl && styles.rowRtl]}>
        <View style={styles.sectionIcon}>
          <Ionicons name="grid-outline" size={18} color={tokens.color.brandStrong} />
        </View>
        <Text style={[styles.sectionTitle, textDirection]}>
          {translate(locale, "student.dashboard")}
        </Text>
      </View>

      <View style={styles.grid}>
        <SummaryCard
          icon="calendar-outline"
          label={translate(locale, "student.todaySchedule")}
          primary={schedulePrimary}
          detail={scheduleDetail}
          loading={!timetableReady}
          rtl={rtl}
          locale={locale}
          textDirection={textDirection}
        />
        <SummaryCard
          icon="document-text-outline"
          label={translate(locale, "student.homeworkDue")}
          primary={homeworkPrimary}
          detail={homeworkDetail}
          loading={!learningReady}
          rtl={rtl}
          locale={locale}
          textDirection={textDirection}
        />
        <SummaryCard
          icon="ribbon-outline"
          label={translate(locale, "student.latestResult")}
          primary={resultPrimary}
          detail={resultDetail}
          loading={!learningReady}
          rtl={rtl}
          locale={locale}
          textDirection={textDirection}
        />
        <SummaryCard
          icon="notifications-outline"
          label={translate(locale, "student.unreadNotifications")}
          primary={notificationPrimary}
          loading={!communicationReady}
          rtl={rtl}
          locale={locale}
          textDirection={textDirection}
        />
        <SummaryCard
          icon="megaphone-outline"
          label={translate(locale, "student.latestAnnouncement")}
          primary={announcementPrimary}
          detail={announcementDetail}
          loading={!communicationReady}
          wide
          rtl={rtl}
          locale={locale}
          textDirection={textDirection}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  rowRtl: { flexDirection: "row-reverse" },
  flex: { flex: 1, minWidth: 0 },
  heroCard: {
    padding: 17,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#dfe7f2",
    backgroundColor: "#f8faff",
    gap: 14
  },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.brand
  },
  avatarText: { color: "#fff", fontSize: 21, fontWeight: "900" },
  studentName: { color: tokens.color.text, fontSize: 21, lineHeight: 26, fontWeight: "900" },
  studentCode: {
    color: tokens.color.textMuted,
    fontSize: 12.5,
    marginTop: 2,
    writingDirection: "ltr",
    textAlign: "left"
  },
  studentCodeRtl: { textAlign: "right" },
  metaGrid: { flexDirection: "row", gap: 8 },
  metaCell: {
    flex: 1,
    minHeight: 62,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8edf4",
    backgroundColor: "#fff",
    gap: 4
  },
  metaLabel: { color: tokens.color.textMuted, fontSize: 10.5, fontWeight: "700" },
  metaValue: { color: tokens.color.text, fontSize: 12.5, lineHeight: 17, fontWeight: "900" },
  identifierValue: { writingDirection: "ltr", textAlign: "left" },
  identifierValueRtl: { textAlign: "right" },
  quickActions: { gap: 9 },
  timetableAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 72,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe5f5",
    backgroundColor: "#f7faff"
  },
  timetableActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf1ff"
  },
  timetableActionTitle: {
    color: tokens.color.text,
    fontSize: 14.5,
    fontWeight: "900"
  },
  timetableActionSubtitle: {
    color: tokens.color.textMuted,
    fontSize: 11.5,
    lineHeight: 17
  },
  pressed: { opacity: 0.76 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  sectionTitle: { color: tokens.color.text, fontSize: 17, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 145,
    minHeight: 132,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    gap: 8,
    shadowColor: "#172033",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  summaryCardWide: { flexBasis: "100%" },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  cardLabel: { color: tokens.color.textMuted, fontSize: 11.5, fontWeight: "800" },
  cardPrimary: { color: tokens.color.text, fontSize: 14.5, lineHeight: 20, fontWeight: "900" },
  cardDetail: { color: tokens.color.textMuted, fontSize: 11.5, lineHeight: 17 },
  loadingValue: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  loadingText: { color: tokens.color.textMuted, fontSize: 12, fontWeight: "700" }
});
