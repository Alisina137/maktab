import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
  timetableReady: boolean;
  learning: LearnerAcademicPayload | null;
  announcements: AnnouncementPayload[];
  fees: FeeInvoiceViewPayload[];
  communicationReady: boolean;
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
  timetableReady,
  learning,
  announcements,
  fees,
  communicationReady,
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

  const attendanceLabel = !todayDate
    ? translate(locale, "common.loading")
    : todayAttendance
      ? translate(locale, {
          PRESENT: "attendance.present",
          ABSENT: "attendance.absent",
          LATE: "attendance.late",
          EXCUSED: "attendance.excused"
        }[todayAttendance] as TranslationKey)
      : translate(locale, "attendance.notRecorded");

  const schedulePrimary = !timetableReady
    ? translate(locale, "common.loading")
    : dashboard.todayPeriods[0]
      ? dashboard.todayPeriods[0].subjectName
      : translate(locale, "parent.noClassesToday");
  const scheduleDetail = dashboard.todayPeriods[0]
    ? `${dashboard.todayPeriods[0].period.startsAt}–${dashboard.todayPeriods[0].period.endsAt} · ${dashboard.todayPeriods[0].teacherName}${dashboard.todayPeriods.length > 1 ? ` · +${dashboard.todayPeriods.length - 1} ${translate(locale, "parent.moreItems")}` : ""}`
    : "";

  const homeworkPrimary = !learning
    ? translate(locale, "common.loading")
    : dashboard.homework?.homework.title ?? translate(locale, "parent.noHomeworkDue");
  const homeworkDetail = dashboard.homework
    ? `${dashboard.homework.subjectName} · ${translate(locale, "learning.due")} ${dashboard.homework.homework.dueAt.slice(0, 10)}`
    : "";

  const resultPrimary = !learning
    ? translate(locale, "common.loading")
    : dashboard.latestResult
      ? `${dashboard.latestResult.grade.score}/${dashboard.latestResult.examSubject.maxScore}`
      : translate(locale, "parent.noPublishedResult");
  const resultDetail = dashboard.latestResult
    ? `${dashboard.latestResult.exam.name} · ${dashboard.latestResult.subjectName}`
    : "";

  const feePrimary = !communicationReady
    ? translate(locale, "common.loading")
    : dashboard.outstanding > 0
      ? formatAfn(dashboard.outstanding)
      : translate(locale, "parent.noOutstandingFees");

  const announcementPrimary = !communicationReady
    ? translate(locale, "common.loading")
    : dashboard.latestAnnouncement?.title ?? translate(locale, "parent.noAnnouncements");
  const announcementDetail = dashboard.latestAnnouncement?.publishAt.slice(0, 10) ?? "";

  return (
    <View style={styles.section}>
      <View style={[styles.headingRow, rtl && styles.rowRtl]}>
        <View style={styles.headingIconShell}>
          <Ionicons name="grid-outline" size={18} color={tokens.color.brandStrong} />
        </View>
        <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "parent.dashboard")}</Text>
      </View>

      <View style={styles.grid}>
        <DashboardCard
          icon="calendar-outline"
          label={translate(locale, "attendance.today")}
          primary={attendanceLabel}
          loading={!todayDate}
          tone={
            todayAttendance === "PRESENT"
              ? "success"
              : todayAttendance === "ABSENT"
                ? "danger"
                : todayAttendance === "LATE"
                  ? "warning"
                  : "brand"
          }
          textDirection={textDirection}
        />
        <DashboardCard
          icon="time-outline"
          label={translate(locale, "parent.todaySchedule")}
          primary={schedulePrimary}
          detail={scheduleDetail}
          loading={!timetableReady}
          textDirection={textDirection}
        />
        <DashboardCard
          icon="document-text-outline"
          label={translate(locale, "parent.homeworkDue")}
          primary={homeworkPrimary}
          detail={homeworkDetail}
          loading={!learning}
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
          loading={!learning}
          tone={dashboard.latestResult ? "success" : "brand"}
          textDirection={textDirection}
        />
        <DashboardCard
          icon="wallet-outline"
          label={translate(locale, "parent.feeStatus")}
          primary={feePrimary}
          loading={!communicationReady}
          tone={communicationReady && dashboard.outstanding > 0 ? "warning" : "brand"}
          textDirection={textDirection}
        />
        <DashboardCard
          icon="megaphone-outline"
          label={translate(locale, "parent.latestAnnouncement")}
          primary={announcementPrimary}
          detail={announcementDetail}
          loading={!communicationReady}
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
  loading = false,
  tone = "brand",
  wide = false,
  textDirection
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary: string;
  detail?: string;
  loading?: boolean;
  tone?: "brand" | "success" | "warning" | "danger";
  wide?: boolean;
  textDirection: TextDirectionStyle;
}) {
  const iconStyle =
    tone === "success"
      ? styles.iconShellSuccess
      : tone === "warning"
        ? styles.iconShellWarning
        : tone === "danger"
          ? styles.iconShellDanger
          : styles.iconShellBrand;
  const iconColor =
    tone === "success"
      ? "#207a4c"
      : tone === "warning"
        ? "#9a6500"
        : tone === "danger"
          ? "#b43a3a"
          : tokens.color.brandStrong;

  return (
    <View style={[styles.card, wide && styles.cardWide]}>
      <View style={[styles.cardTopRow, textDirection.writingDirection === "rtl" && styles.rowRtl]}>
        <View style={[styles.iconShell, iconStyle]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={[styles.label, styles.cardLabelFlex, textDirection]}>{label}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={tokens.color.brand} />
            <View style={styles.loadingLinePrimary} />
          </View>
          <View style={styles.loadingLineDetail} />
        </View>
      ) : (
        <>
          <Text style={[styles.primary, textDirection]} numberOfLines={3}>{primary}</Text>
          {detail ? <Text style={[styles.detail, textDirection]} numberOfLines={3}>{detail}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 13 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  rowRtl: { flexDirection: "row-reverse" },
  headingIconShell: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  sectionTitle: { color: tokens.color.text, fontSize: 17, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
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
  cardWide: { flexBasis: "100%" },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardLabelFlex: { flex: 1 },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center"
  },
  iconShellBrand: { backgroundColor: "#edf3ff" },
  iconShellSuccess: { backgroundColor: "#e9f7ef" },
  iconShellWarning: { backgroundColor: "#fff5df" },
  iconShellDanger: { backgroundColor: "#fff0f0" },
  label: { color: tokens.color.textMuted, fontSize: 11.5, fontWeight: "800" },
  primary: { color: tokens.color.text, fontSize: 14.5, lineHeight: 20, fontWeight: "900" },
  detail: { color: tokens.color.textMuted, fontSize: 11.5, lineHeight: 17 },
  loadingBlock: { gap: 9, paddingTop: 3 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingLinePrimary: { height: 11, flex: 1, borderRadius: 999, backgroundColor: "#edf1f6" },
  loadingLineDetail: { height: 9, width: "62%", borderRadius: 999, backgroundColor: "#f0f3f7" }
});
