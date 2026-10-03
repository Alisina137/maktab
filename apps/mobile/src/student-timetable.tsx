import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedNumber,
  formatLocalizedTimeRange,
  getDirection,
  translate,
  type SupportedLocale,
  type TranslationKey
} from "@maktablink/localization";
import type { StudentTimetablePayload } from "./api";

type TextDirectionStyle = {
  textAlign: "right" | "left";
  writingDirection: "rtl" | "ltr";
};

type Weekday = StudentTimetablePayload["periods"][number]["period"]["weekday"];

const schoolWeek: Weekday[] = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY"
];

const weekdayKey: Record<Exclude<Weekday, "FRIDAY">, TranslationKey> = {
  SATURDAY: "weekday.saturday",
  SUNDAY: "weekday.sunday",
  MONDAY: "weekday.monday",
  TUESDAY: "weekday.tuesday",
  WEDNESDAY: "weekday.wednesday",
  THURSDAY: "weekday.thursday"
};

function currentAfghanistanWeekday(): Weekday {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul",
    weekday: "long"
  })
    .format(new Date())
    .toUpperCase() as Weekday;
  return label;
}

export function StudentTimetableAgenda({
  timetable,
  ready,
  locale,
  textDirection
}: {
  timetable: StudentTimetablePayload | null;
  ready: boolean;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  const rtl = getDirection(locale) === "rtl";
  const today = currentAfghanistanWeekday();

  if (!ready && !timetable) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={tokens.color.brand} />
        <Text style={[styles.muted, textDirection]}>{translate(locale, "common.loading")}</Text>
      </View>
    );
  }

  if (!timetable || timetable.periods.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <Ionicons name="calendar-clear-outline" size={24} color={tokens.color.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, textDirection]}>
          {translate(locale, "student.noTimetable")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={[styles.contextCard, rtl && styles.rowRtl]}>
        <View style={styles.contextIcon}>
          <Ionicons name="school-outline" size={21} color={tokens.color.brandStrong} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.contextTitle, textDirection]}>
            {timetable.classSection.name}
          </Text>
          <Text style={[styles.muted, textDirection]}>
            {timetable.academicYear.name}
          </Text>
        </View>
      </View>

      {schoolWeek.map((day) => {
        const periods = timetable.periods
          .filter((item) => item.period.weekday === day)
          .sort((a, b) => a.period.startsAt.localeCompare(b.period.startsAt));
        const isToday = day === today;

        return (
          <View key={day} style={[styles.dayCard, isToday && styles.dayCardToday]}>
            <View style={[styles.dayHeading, rtl && styles.rowRtl]}>
              <View style={[styles.dayIcon, isToday && styles.dayIconToday]}>
                <Ionicons
                  name={isToday ? "today" : "calendar-outline"}
                  size={18}
                  color={isToday ? tokens.color.brandStrong : tokens.color.textMuted}
                />
              </View>
              <Text style={[styles.dayTitle, textDirection]}>
                {translate(locale, weekdayKey[day])}
              </Text>
              <View style={styles.countPill}>
                <Text style={styles.countText}>
                  {formatLocalizedNumber(periods.length, locale)}
                </Text>
              </View>
            </View>

            {periods.length > 0 ? (
              <View style={styles.periodList}>
                {periods.map((item, index) => (
                  <View
                    key={item.period.id}
                    style={[
                      styles.periodRow,
                      index > 0 && styles.periodRowBorder,
                      rtl && styles.rowRtl
                    ]}
                  >
                    <View style={styles.timePill}>
                      <Text style={styles.timeText}>
                        {formatLocalizedTimeRange(
                          item.period.startsAt,
                          item.period.endsAt,
                          locale
                        )}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.subjectName, textDirection]}>
                        {item.subjectName}
                      </Text>
                      <Text style={[styles.teacherName, textDirection]}>
                        {item.teacherName}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noClassesRow}>
                <Ionicons name="remove-circle-outline" size={17} color={tokens.color.textMuted} />
                <Text style={[styles.muted, textDirection]}>
                  {translate(locale, "student.noClassesForDay")}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  rowRtl: { flexDirection: "row-reverse" },
  flex: { flex: 1, minWidth: 0 },
  loadingCard: {
    minHeight: 90,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  emptyCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    alignItems: "center",
    gap: 10
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f4f8"
  },
  emptyTitle: {
    color: tokens.color.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "700"
  },
  contextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dfe7f2",
    backgroundColor: "#f8faff"
  },
  contextIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf1ff"
  },
  contextTitle: { color: tokens.color.text, fontSize: 15, fontWeight: "900" },
  dayCard: {
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    gap: 12
  },
  dayCardToday: {
    borderColor: "#cfdfff",
    backgroundColor: "#fbfdff"
  },
  dayHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  dayIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f4f7"
  },
  dayIconToday: { backgroundColor: "#eaf1ff" },
  dayTitle: {
    flex: 1,
    color: tokens.color.text,
    fontSize: 15,
    fontWeight: "900"
  },
  countPill: {
    minWidth: 30,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  countText: {
    color: tokens.color.brandStrong,
    fontSize: 11.5,
    fontWeight: "900"
  },
  periodList: { gap: 0 },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10
  },
  periodRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#edf0f4"
  },
  timePill: {
    minWidth: 90,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: "#f5f7fa",
    alignItems: "center"
  },
  timeText: {
    color: tokens.color.text,
    fontSize: 11.5,
    fontWeight: "900"
  },
  subjectName: {
    color: tokens.color.text,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: "900"
  },
  teacherName: {
    color: tokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  noClassesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 4
  },
  muted: {
    color: tokens.color.textMuted,
    fontSize: 12.5,
    lineHeight: 18
  }
});
