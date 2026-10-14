import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedTimeRange, getDirection, translate, type SupportedLocale
} from "@maktablink/localization";
import type { ParentTimetablePeriod } from "./api";

const weekdays = ["SATURDAY","SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"] as const;
const weekdayLabels: Record<(typeof weekdays)[number], string> = {
  SATURDAY: "2026-10-17", SUNDAY: "2026-10-18", MONDAY: "2026-10-19",
  TUESDAY: "2026-10-20", WEDNESDAY: "2026-10-21", THURSDAY: "2026-10-22",
  FRIDAY: "2026-10-23"
};

export function ParentTimetableContent({
  periods, ready, locale
}: { periods: ParentTimetablePeriod[]; ready: boolean; locale: SupportedLocale }) {
  const rtl = getDirection(locale) === "rtl";
  if (!ready) return (
    <View style={styles.card}>
      <Text style={[styles.muted, rtl && styles.rtlText]}>{translate(locale, "common.loading")}</Text>
    </View>
  );
  if (!periods.length) return (
    <View style={styles.card}>
      <Text style={[styles.muted, rtl && styles.rtlText]}>{translate(locale, "parent.noTimetable")}</Text>
    </View>
  );
  const formatWeekday = (day: (typeof weekdays)[number]) => {
    const iso = weekdayLabels[day];
    return new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : locale === "fa-AF" ? "fa-AF" : "ps-AF",
      { weekday: "long", timeZone: "UTC" }
    ).format(new Date(`${iso}T12:00:00Z`));
  };
  return (
    <View style={styles.card}>
      {weekdays.map((day) => {
        const items = periods.filter((item) => item.period.weekday === day)
          .sort((a,b) => a.period.startsAt.localeCompare(b.period.startsAt));
        if (!items.length) return null;
        return (
          <View key={day} style={styles.day}>
            <Text style={[styles.dayTitle, rtl && styles.rtlText]}>{formatWeekday(day)}</Text>
            {items.map((item) => (
              <View key={item.period.id} style={[styles.row, rtl && styles.rtlRow]}>
                <Ionicons name="time-outline" size={20} color={tokens.color.brandStrong} />
                <View style={styles.flex}>
                  <Text style={[styles.subject, rtl && styles.rtlText]}>{item.subjectName}</Text>
                  <Text style={[styles.muted, rtl && styles.rtlText]}>{item.teacherName}</Text>
                </View>
                <Text style={styles.time}>
                  {formatLocalizedTimeRange(item.period.startsAt,item.period.endsAt,locale)}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: "#e1e7f0", borderRadius: 20,
    backgroundColor: tokens.color.surface, padding: 14, gap: 15 },
  day: { gap: 8 },
  dayTitle: { fontSize: 15, fontWeight: "900", color: tokens.color.text },
  row: { flexDirection: "row", gap: 10, padding: 12, alignItems: "center",
    borderWidth: 1, borderColor: "#edf1f6", borderRadius: 14 },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  flex: { flex: 1, minWidth: 0 },
  subject: { color: tokens.color.text, fontSize: 14, fontWeight: "800" },
  muted: { color: tokens.color.textMuted, fontSize: 12.5 },
  time: { color: tokens.color.brandStrong, fontSize: 12, fontWeight: "800" }
});
