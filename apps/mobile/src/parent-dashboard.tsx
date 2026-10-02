import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  getDirection,
  translate,
  type SupportedLocale,
  type TranslationKey
} from "@maktablink/localization";
import type {
  AnnouncementPayload,
  AttendanceStatus,
  FeeInvoiceViewPayload,
  LearnerAcademicPayload,
  ParentTimetablePeriod
} from "./api";

type TextDirectionStyle = {
  textAlign: "right" | "left";
  writingDirection: "rtl" | "ltr";
};

type Props = {
  classId: string;
  todayDate: string;
  todayAttendance: AttendanceStatus | null;
  timetable: ParentTimetablePeriod[];
  learning: LearnerAcademicPayload | null;
  announcements: AnnouncementPayload[];
  fees: FeeInvoiceViewPayload[];
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
};

type Weekday = ParentTimetablePeriod["period"]["weekday"];

const jsWeekday: Weekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY"
];

function weekdayForDate(value: string): Weekday | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  if (Number.isNaN(date.getTime())) return null;
  return jsWeekday[date.getUTCDay()] ?? null;
}

function formatAfn(value: number) {
  return `AFN ${Math.max(0, value).toLocaleString("en-US")}`;
}

export function ParentDashboardPanel({
  classId,
  todayDate,
  todayAttendance,
  timetable,
  learning,
  announcements,
  fees,
  locale,
  textDirection
}: Props) {
  const rtl = getDirection(locale) === "rtl";

  const dashboard = useMemo(() => {
    const weekday = weekdayForDate(todayDate);
    const todayPeriods = weekday
      ? timetable.filter((item) => item.period.weekday === weekday)
      : [];

    const homework = learning?.homework.find(
      (item) =>
        item.homework.status === "PUBLISHED" &&
        (!todayDate || item.homework.dueAt.slice(0, 10) >= todayDate)
    ) ?? null;

    const latestResult = learning?.results[0] ?? null;
    const outstanding = fees.reduce((sum, item) => sum + item.outstanding, 0);
    const relevantAnnouncements = announcements.filter(
      (item) => item.audienceScope !== "CLASS" || item.classId === classId
    );

    return {
      todayPeriods,
      homework,
      latestResult,
      outstanding,
      latestAnnouncement: relevantAnnouncements[0] ?? null
    };
  }, [announcements, classId, fees, learning, timetable, todayDate]);

  const attendanceLabel = todayAttendance
    ? translate(locale, {
        PRESENT: "attendance.present",
        ABSENT: "attendance.absent",
        LATE: "attendance.late",
        EXCUSED: "attendance.excused"
      }[todayAttendance] as TranslationKey)
    : translate(locale, "attendance.notRecorded");

  const schedulePrimary = dashboard.todayPeriods[0]
    ? dashboard.todayPeriods[0].subjectName
    : translate(locale, "parent.noClassesToday");
  const scheduleDetail = dashboard.todayPeriods[0]
    ? `${dashboard.todayPeriods[0].period.startsAt}–${dashboard.todayPeriods[0].period.endsAt} · ${dashboard.todayPeriods[0].teacherName}${dashboard.todayPeriods.length > 1 ? ` · +${dashboard.todayPeriods.length - 1} ${translate(locale, "parent.moreItems")}` : ""}`
    : "";

  const homeworkPrimary = dashboard.homework?.homework.title ?? translate(locale, "parent.noHomeworkDue");
  const homeworkDetail = dashboard.homework
    ? `${dashboard.homework.subjectName} · ${translate(locale, "learning.due")} ${dashboard.homework.homework.dueAt.slice(0, 10)}`
    : "";

  const resultPrimary = dashboard.latestResult
    ? `${dashboard.latestResult.grade.score}/${dashboard.latestResult.examSubject.maxScore}`
    : translate(locale, "parent.noPublishedResult");
  const resultDetail = dashboard.latestResult
    ? `${dashboard.latestResult.exam.name} · ${dashboard.latestResult.subjectName}`
    : "";

  const feePrimary = dashboard.outstanding > 0
    ? formatAfn(dashboard.outstanding)
    : translate(locale, "parent.noOutstandingFees");

  const announcementPrimary = dashboard.latestAnnouncement?.title ?? translate(locale, "parent.noAnnouncements");
  const announcementDetail = dashboard.latestAnnouncement?.publishAt.slice(0, 10) ?? "";

  return (
    <View style={styles.section}>
      <View style={[styles.headingRow, rtl && styles.rowRtl]}>
        <Ionicons name="grid-outline" size={20} color={tokens.color.brandStrong} />
        <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "parent.dashboard")}</Text>
      </View>

      <View style={styles.grid}>
        <DashboardCard
          icon="calendar-outline"
          label={translate(locale, "attendance.today")}
          primary={attendanceLabel}
          textDirection={textDirection}
        />
        <DashboardCard
          icon="time-outline"
          label={translate(locale, "parent.todaySchedule")}
          primary={schedulePrimary}
          detail={scheduleDetail}
          textDirection={textDirection}
        />
        <DashboardCard
          icon="document-text-outline"
          label={translate(locale, "parent.homeworkDue")}
          primary={homeworkPrimary}
          detail={homeworkDetail}
          textDirection={textDirection}
        />
        <DashboardCard
          icon="school-outline"
          label={translate(locale, "parent.nextExam")}
          primary={translate(locale, "parent.examScheduleUnavailable")}
          textDirection={textDirection}
        />
        <DashboardCard
          icon="ribbon-outline"
          label={translate(locale, "parent.latestResult")}
          primary={resultPrimary}
          detail={resultDetail}
          textDirection={textDirection}
        />
        <DashboardCard
          icon="wallet-outline"
          label={translate(locale, "parent.feeStatus")}
          primary={feePrimary}
          textDirection={textDirection}
        />
        <DashboardCard
          icon="megaphone-outline"
          label={translate(locale, "parent.latestAnnouncement")}
          primary={announcementPrimary}
          detail={announcementDetail}
          wide
          textDirection={textDirection}
        />
      </View>
    </View>
  );
}

function DashboardCard({
  icon,
  label,
  primary,
  detail,
  wide = false,
  textDirection
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary: string;
  detail?: string;
  wide?: boolean;
  textDirection: TextDirectionStyle;
}) {
  return (
    <View style={[styles.card, wide && styles.cardWide]}>
      <View style={styles.iconShell}>
        <Ionicons name={icon} size={18} color={tokens.color.brandStrong} />
      </View>
      <Text style={[styles.label, textDirection]}>{label}</Text>
      <Text style={[styles.primary, textDirection]} numberOfLines={3}>{primary}</Text>
      {detail ? <Text style={[styles.detail, textDirection]} numberOfLines={3}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  rowRtl: { flexDirection: "row-reverse" },
  sectionTitle: { color: tokens.color.text, fontSize: 17, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 145,
    minHeight: 142,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    gap: 6
  },
  cardWide: { flexBasis: "100%" },
  iconShell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  label: { color: tokens.color.textMuted, fontSize: 11.5, fontWeight: "800" },
  primary: { color: tokens.color.text, fontSize: 14, lineHeight: 19, fontWeight: "900" },
  detail: { color: tokens.color.textMuted, fontSize: 11.5, lineHeight: 17 }
});
