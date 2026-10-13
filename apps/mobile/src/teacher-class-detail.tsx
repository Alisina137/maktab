import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import { formatLocalizedNumber, getDirection, translate, type SupportedLocale, type TranslationKey } from "@maktablink/localization";
import { api, type TeacherClassDetailPayload, type TeacherTodayPayload } from "./api";
import { TeacherLearningPanel } from "./learning-ui";
import { CommunicationPanel } from "./communication-ui";
import { teacherTime12 } from "./teacher-hub-data";
import { NegaranHistoryPanel } from "./negaran-history";
import { TeacherTeachingPanel } from "./teacher-teaching";
import { appErrorFromCause, type AppErrorKind } from "./error-message";

type Section = "OVERVIEW" | "STUDENTS" | "HOMEWORK" | "GRADES" | "TEACHING" | "SUPERVISION";
type Direction = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
type Icon = keyof typeof Ionicons.glyphMap;
const tabs: Array<[Section, TranslationKey, Icon]> = [
  ["OVERVIEW", "teacher.classOverview", "information-circle-outline"],
  ["STUDENTS", "teacher.classStudents", "people-outline"],
  ["HOMEWORK", "teacher.workflowHomework", "document-text-outline"],
  ["GRADES", "teacher.workflowGrades", "stats-chart-outline"],
  ["TEACHING", "teaching.workspace", "school-outline"],
  ["SUPERVISION", "teacher.classSupervision", "shield-checkmark-outline"]
];
const weekdayKey: Record<string, TranslationKey> = {
  SATURDAY: "weekday.saturday", SUNDAY: "weekday.sunday", MONDAY: "weekday.monday",
  TUESDAY: "weekday.tuesday", WEDNESDAY: "weekday.wednesday", THURSDAY: "weekday.thursday"
};

export function TeacherClassDetailPage({
  assignmentId, accessToken, reconnectEpoch, locale, textDirection,
  onBack, onAttendance, onError, onNotice, onScrollTop, teacherToday
}: {
  assignmentId: string; accessToken: string; reconnectEpoch: number;
  locale: SupportedLocale; textDirection: Direction; teacherToday: TeacherTodayPayload | null;
  onBack: () => void; onAttendance: (id: string, day: string) => void;
  onError: (key: TranslationKey | null, kind?: AppErrorKind) => void;
  onNotice: (notice: string | null) => void; onScrollTop: () => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [detail, setDetail] = useState<TeacherClassDetailPayload | null>(null);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState<Section>("OVERVIEW");
  const [studentId, setStudentId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    setDetail(null);
    setReady(false);
    void api.teacherClassDetail(accessToken, assignmentId).then((result) => {
      if (id === requestId.current) setDetail(result);
    }).catch((error: unknown) => {
      if (id !== requestId.current) return;
      const failure = appErrorFromCause(error);
      onError(failure.key, failure.kind);
    }).finally(() => {
      if (id === requestId.current) setReady(true);
    });
    return () => { requestId.current += 1; };
  }, [assignmentId, accessToken, reconnectEpoch, refresh]);

  function openSection(next: Section) {
    setSection(next);
    onScrollTop();
  }
  const current = detail?.assignment;
  const supervision = detail?.canSuperviseToday && teacherToday?.date === detail.today
    ? teacherToday.supervisedClasses.find((item) => item.classId === current?.classId)
    : null;
  return (
    <View style={styles.stack} testID="teacher-class-detail">
      <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "teacher.backToClasses")}
        style={[styles.row, rtl && styles.rtl]} onPress={onBack}>
        <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={19} color={tokens.color.brandStrong} />
        <Text style={styles.link}>{translate(locale, "teacher.backToClasses")}</Text>
      </Pressable>
      {!ready ? <View style={styles.card}>
        <ActivityIndicator color={tokens.color.brand} /><Text style={[styles.muted, textDirection]}>{translate(locale, "common.loading")}</Text>
      </View> : !current || !detail ? (
        <Pressable accessibilityRole="button" style={styles.card} onPress={() => setRefresh((value) => value + 1)}>
          <Text style={styles.link}>{translate(locale, "action.retry")}</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={[styles.title, textDirection]}>{current.className}</Text>
            <Text style={[styles.link, textDirection]}>{current.subjectName} · {current.classCode}</Text>
            <Text style={[styles.muted, textDirection]}>{current.academicYearName}</Text>
            <View style={[styles.metrics, rtl && styles.rtl]}>
              <View style={styles.metric}>
                <Text style={styles.value}>{formatLocalizedNumber(detail.students.length, locale)}</Text>
                <Text style={styles.metricLabel}>{translate(locale, "teacher.classStudents")}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.value}>{formatLocalizedNumber(detail.schedule.length, locale)}</Text>
                <Text style={styles.metricLabel}>{translate(locale, "teacher.weeklyPeriods")}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.tabs, rtl && styles.rtl]} accessibilityRole="tablist">
            {tabs.filter(([id]) => id !== "SUPERVISION" || detail.canSuperviseToday).map(([id, label, icon]) => (
              <Pressable key={id} accessibilityRole="tab" accessibilityLabel={translate(locale, label)}
                accessibilityState={{ selected: section === id }} onPress={() => openSection(id)}
                style={[styles.tab, id === section && styles.activeTab]}>
                <Ionicons name={icon} size={18} color={section === id ? tokens.color.brandStrong : tokens.color.textMuted} />
                <Text style={[styles.tabLabel, section === id && styles.activeLabel]} numberOfLines={2}>{translate(locale, label)}</Text>
              </Pressable>
            ))}
          </View>
          {section === "OVERVIEW" ? (
            <View style={styles.card}>
              <Text style={[styles.title, textDirection]}>{translate(locale, "teacher.subjectSchedule")}</Text>
              {detail.schedule.length ? [...detail.schedule].sort((a,b) => a.startsAt.localeCompare(b.startsAt)).map((period) => (
                <View key={period.id} style={[styles.row, rtl && styles.rtl, styles.listRow]}>
                  <Text style={styles.time}>{teacherTime12(period.startsAt)}</Text>
                  <Text style={[styles.label, textDirection]}>{weekdayKey[period.weekday] ? translate(locale, weekdayKey[period.weekday]!) : period.weekday}</Text>
                </View>
              )) : <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noSchedule")}</Text>}
            </View>
          ) : null}
          {section === "STUDENTS" ? (
            <View style={styles.card}>
              <Text style={[styles.title, textDirection]}>{translate(locale, "teacher.classStudents")}</Text>
              <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.studentRosterHint")}</Text>
              {detail.students.map((student) => (
                <View key={student.id} style={styles.listRow}>
                  <Pressable accessibilityRole="button" accessibilityLabel={student.fullName}
                    onPress={() => setStudentId((currentId) => currentId === student.id ? "" : student.id)}
                    style={[styles.row, rtl && styles.rtl]}>
                    <Ionicons name="person-circle-outline" size={27} color={tokens.color.brandStrong} />
                    <View style={styles.flex}>
                      <Text style={[styles.label, textDirection]}>{student.fullName}</Text>
                      <Text style={[styles.muted, textDirection]}>{student.studentCode}</Text>
                    </View>
                    <Ionicons name={studentId === student.id ? "chevron-up" : "chevron-down"} size={18} color={tokens.color.textMuted} />
                  </Pressable>
                  {studentId === student.id ? (
                    <View style={styles.studentMore}>
                      <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.studentReadOnly")}</Text>
                      <Text style={[styles.label, textDirection]}>{current.subjectName} · {current.className}</Text>
                      <Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => openSection("GRADES")}>
                        <Text style={styles.link}>{translate(locale, "teacher.workflowGrades")}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
              {!detail.students.length ? <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.noActiveStudents")}</Text> : null}
            </View>
          ) : null}
          {section === "HOMEWORK" || section === "GRADES" ? (
            <TeacherLearningPanel key={`${assignmentId}-${section}-${reconnectEpoch}`}
              section={section} assignmentContext={{ assignmentId: current.assignmentId, academicYearId: current.academicYearId,
                classId: current.classId, subjectId: current.subjectId }}
              accessToken={accessToken} locale={locale} textDirection={textDirection} onError={onError} onNotice={onNotice} onScrollTop={onScrollTop} />
          ) : null}
          {section === "TEACHING" ? (
            <TeacherTeachingPanel
              key={`${assignmentId}-teaching-${reconnectEpoch}`}
              accessToken={accessToken}
              assignmentId={current.assignmentId}
              locale={locale}
              textDirection={textDirection}
              reconnectEpoch={reconnectEpoch}
              onError={onError}
              onNotice={onNotice}
            />
          ) : null}
          {section === "SUPERVISION" && detail.canSuperviseToday ? (
            <View style={styles.stack}>
              <View style={styles.card}>
                <Text style={[styles.title, textDirection]}>{translate(locale, "teacher.classSupervision")}</Text>
                <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.supervisionHint")}</Text>
                {supervision ? (
                  <Pressable accessibilityRole="button" style={[styles.primary, rtl && styles.rtl]}
                    onPress={() => onAttendance(current.classId, detail.today)}>
                    <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                    <Text style={styles.primaryText}>{translate(locale, "attendance.dailyTitle")}</Text>
                    <Text style={styles.primaryText}>{translate(locale, supervision.attendanceStatus === "PENDING" ? "attendance.pending" : "attendance.submitted")}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.muted, textDirection]}>{translate(locale, "teacher.supervisionUnavailable")}</Text>
                )}
              </View>
              {supervision ? (
                <NegaranHistoryPanel
                  accessToken={accessToken}
                  classId={current.classId}
                  today={detail.today}
                  locale={locale}
                  textDirection={textDirection}
                  reconnectEpoch={reconnectEpoch}
                  onOpenDay={(day) => onAttendance(current.classId, day)}
                  onError={onError}
                />
              ) : null}
              {supervision ? <CommunicationPanel key={`supervised-${assignmentId}-${reconnectEpoch}`}
                accessToken={accessToken} mode="TEACHER" teacherSection="ANNOUNCEMENTS"
                supervisedClasses={[{ classId: current.classId, classCode: current.classCode, className: current.className }]}
                locale={locale} textDirection={textDirection} onError={onError} onNotice={onNotice} /> : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 }, flex: { flex: 1, minWidth: 0 }, rtl: { flexDirection: "row-reverse" },
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: 9 },
  card: { padding: 16, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1e7f0", gap: 12 },
  hero: { padding: 17, borderWidth: 1, borderColor: "#dbe7f5", backgroundColor: "#f2f7ff", borderRadius: 20, gap: 8 },
  title: { fontSize: 17, fontWeight: "900", color: tokens.color.text },
  link: { fontSize: 13, fontWeight: "800", color: tokens.color.brandStrong },
  muted: { fontSize: 12, color: tokens.color.textMuted, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: "700", color: tokens.color.text },
  metrics: { flexDirection: "row", gap: 10, paddingTop: 8 },
  metric: { flex: 1, backgroundColor: "#fff", borderRadius: 13, padding: 12, alignItems: "center", gap: 5 },
  metricLabel: { fontSize: 12, color: tokens.color.textMuted, textAlign: "center" },
  value: { fontSize: 21, fontWeight: "900", color: tokens.color.brandStrong },
  tabs: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tab: { flexGrow: 1, minWidth: "29%", maxWidth: "48%", gap: 4, minHeight: 61, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e1e7f0", alignItems: "center", justifyContent: "center", padding: 7 },
  activeTab: { backgroundColor: "#eaf2ff", borderColor: "#a0c1f3" },
  tabLabel: { fontSize: 11, fontWeight: "700", color: tokens.color.textMuted, textAlign: "center" },
  activeLabel: { color: tokens.color.brandStrong, fontWeight: "900" },
  listRow: { borderTopWidth: 1, borderTopColor: "#edf0f4", paddingTop: 8, gap: 5 },
  time: { color: tokens.color.brandStrong, fontSize: 12.5, fontWeight: "800", minWidth: 85 },
  studentMore: { gap: 9, backgroundColor: "#f7faff", padding: 12, borderRadius: 12 },
  smallButton: { padding: 8, alignSelf: "flex-start", borderRadius: 10, backgroundColor: "#e9f2ff" },
  primary: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap", minHeight: 50, padding: 13, backgroundColor: tokens.color.brand, borderRadius: 13 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 12.5 }
});
