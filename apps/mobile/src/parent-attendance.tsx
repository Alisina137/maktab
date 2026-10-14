import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, localizeDigits,
  translate, type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import { api, type AttendanceStatus, type ParentAttendanceDay } from "./api";
import { adjacentAttendanceMonth, attendanceMonth, summarizeAttendance } from "./parent-attendance-model";

type LoadState = "loading" | "ready" | "error";
const statuses: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
const statusKeys: Record<AttendanceStatus, TranslationKey> = {
  PRESENT: "attendance.present", ABSENT: "attendance.absent",
  LATE: "attendance.late", EXCUSED: "attendance.excused"
};
const statusColors: Record<AttendanceStatus, string> = {
  PRESENT: tokens.color.success, ABSENT: tokens.color.danger,
  LATE: tokens.color.warning, EXCUSED: tokens.color.brand
};

function weekdays(locale: SupportedLocale) {
  // October 17, 2026 is a Saturday, the first weekday in Afghanistan.
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 9, 17 + i, 12));
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, {
      weekday: "short", timeZone: "UTC"
    }).format(date);
  });
}

export function ParentAttendanceContent({
  accessToken, studentId, today, locale, onSensitiveError, focusedDate = null
}: {
  accessToken: string;
  studentId: string;
  today: string;
  focusedDate?: string | null;
  locale: SupportedLocale;
  onSensitiveError: (cause: unknown) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const validFocus = focusedDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(focusedDate) &&
    focusedDate <= today ? focusedDate : null;
  const [anchor, setAnchor] = useState(validFocus ?? today);
  const [selectedDay, setSelectedDay] = useState(validFocus ?? today);
  useEffect(() => {
    if (validFocus) {
      setAnchor(validFocus);
      setSelectedDay(validFocus);
    }
  }, [validFocus]);
  const [load, setLoad] = useState<{
    key: string; status: LoadState; days: ParentAttendanceDay[];
  }>({ key: "", status: "loading", days: [] });
  const [retry, setRetry] = useState(0);
  const onSensitiveErrorRef = useRef(onSensitiveError);
  onSensitiveErrorRef.current = onSensitiveError;
  const month = useMemo(() => attendanceMonth(anchor, locale), [anchor, locale]);
  const queryKey = studentId + "/" + accessToken + "/" + month.from + "/" + month.to;
  const current = load.key === queryKey;
  const status = current ? load.status : "loading";

  useEffect(() => {
    let active = true;
    setLoad({ key: queryKey, status: "loading", days: [] });
    void api.parentAttendance(accessToken, studentId, month.from, month.to)
      .then((value) => {
        if (active) setLoad({ key: queryKey, status: "ready", days: value.days });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLoad({ key: queryKey, status: "error", days: [] });
        onSensitiveErrorRef.current(cause);
      });
    return () => { active = false; };
  }, [accessToken, studentId, month.from, month.to, queryKey, retry]);

  const days = current && status === "ready" ? load.days : [];
  const byDay = useMemo(() => {
    const result = new Map<string, ParentAttendanceDay>();
    for (const item of days) {
      if (!result.has(item.date) && item.date >= month.from && item.date <= month.to)
        result.set(item.date, item);
    }
    return result;
  }, [days, month.from, month.to]);
  const summary = useMemo(
    () => summarizeAttendance(days, month.from, month.to),
    [days, month.from, month.to]
  );
  const selected = selectedDay >= month.from && selectedDay <= month.to ? selectedDay : (
    today >= month.from && today <= month.to ? today : month.to
  );
  const selectedMark = byDay.get(selected);
  const history = useMemo(() =>
    [...byDay.values()].filter((row) => row.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [byDay, today]
  );
  const dayIsFuture = selected > today;

  const go = (direction: -1 | 1) => {
    const next = adjacentAttendanceMonth(anchor, locale, direction);
    if (next > today) return;
    setAnchor(next);
    setSelectedDay("");
  };

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={[styles.header, rtl && styles.rtlRow]}>
          <View style={styles.headingIcon}>
            <Ionicons name="calendar-outline" color={tokens.color.brandStrong} size={21} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.title, rtl && styles.rtlText]}>
              {translate(locale, "parent.attendanceCalendar")}
            </Text>
            <Text style={[styles.caption, rtl && styles.rtlText]}>
              {translate(locale, "parent.attendanceCalendarHelp")}
            </Text>
          </View>
        </View>
        <View style={[styles.monthControls, rtl && styles.rtlRow]}>
          <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "parent.attendancePrevious")}
            hitSlop={8} onPress={() => go(-1)} style={styles.arrow}>
            <Ionicons name={rtl ? "chevron-forward" : "chevron-back"}
              size={22} color={tokens.color.brandStrong} />
          </Pressable>
          <Text style={styles.monthTitle} accessibilityRole="header">{month.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "parent.attendanceNext")}
            accessibilityState={{ disabled: month.to >= today }}
            disabled={month.to >= today} onPress={() => go(1)}
            style={[styles.arrow, month.to >= today && styles.disabled]}>
            <Ionicons name={rtl ? "chevron-back" : "chevron-forward"}
              size={22} color={tokens.color.brandStrong} />
          </Pressable>
        </View>
        <View style={[styles.calendar, rtl && styles.rtlRow]}>
          {weekdays(locale).map((label, index) => (
            <View key={index} style={styles.calendarCell}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.weekday}>{label}</Text>
            </View>
          ))}
          {Array.from({ length: month.offset }, (_, index) => (
            <View key={"gap-" + index} style={styles.calendarCell} />
          ))}
          {month.dates.map(({ iso, day }) => {
            const record = byDay.get(iso);
            const isFuture = iso > today;
            const isActive = iso === selected;
            return (
              <View key={iso} style={styles.calendarCell}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={formatLocalizedDate(iso, locale) + ", " +
                    (isFuture ? translate(locale, "parent.attendanceFuture") :
                      record ? translate(locale, statusKeys[record.status]) :
                        translate(locale, "attendance.notRecorded"))}
                  accessibilityState={{ selected: isActive, disabled: isFuture }}
                  disabled={isFuture} onPress={() => setSelectedDay(iso)}
                  style={[styles.day, isActive && styles.selectedDay, isFuture && styles.disabled]}>
                  <Text style={[styles.dayText, isActive && styles.selectedDayText]}>
                    {localizeDigits(day, locale)}
                  </Text>
                  {record && !isFuture ? (
                    <View style={[styles.dot, { backgroundColor: statusColors[record.status] }]} />
                  ) : <View style={styles.dotSpacer} />}
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={[styles.legend, rtl && styles.rtlRow]}>
          {statuses.map((s) => (
            <View key={s} style={[styles.legendItem, rtl && styles.rtlRow]}>
              <View style={[styles.legendDot, { backgroundColor: statusColors[s] }]} />
              <Text style={styles.legendText}>{translate(locale, statusKeys[s])}</Text>
            </View>
          ))}
        </View>
        {status === "loading" ? (
          <View style={styles.message}>
            <ActivityIndicator color={tokens.color.brand} />
            <Text style={styles.caption}>{translate(locale, "common.loading")}</Text>
          </View>
        ) : status === "error" ? (
          <View style={styles.message}>
            <Text style={styles.caption}>{translate(locale, "parent.attendanceLoadError")}</Text>
            <Pressable accessibilityRole="button" style={styles.retry}
              onPress={() => setRetry((value) => value + 1)}>
              <Ionicons name="refresh-outline" size={16} color={tokens.color.brandStrong} />
              <Text style={styles.retryText}>{translate(locale, "parent.tryAgain")}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {status === "ready" ? (
        <>
          <View style={styles.card}>
            <Text style={[styles.title, rtl && styles.rtlText]}>
              {translate(locale, "parent.attendanceSummary")}
            </Text>
            <View style={[styles.statsGrid, rtl && styles.rtlRow]}>
              {statuses.map((s) => (
                <View key={s} style={styles.statCard}>
                  <Text style={[styles.statValue, { color: statusColors[s] }]}>
                    {formatLocalizedNumber(summary.counts[s], locale)}
                  </Text>
                  <Text style={styles.statLabel}>{translate(locale, statusKeys[s])}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.rateRow, rtl && styles.rtlRow]}>
              <Text style={[styles.rateLabel, rtl && styles.rtlText]}>
                {translate(locale, "parent.attendanceRate")}
              </Text>
              <Text style={styles.rateValue}>
                {summary.rate === null ? "—" : formatLocalizedNumber(summary.rate, locale) + "%"}
              </Text>
            </View>
            <Text style={[styles.caption, rtl && styles.rtlText]}>
              {translate(locale, "parent.attendanceRateHelp")}
            </Text>
            <Text style={[styles.caption, rtl && styles.rtlText]}>
              {translate(locale, "parent.attendanceRecorded")}: {formatLocalizedNumber(summary.recorded, locale)}
            </Text>
            {summary.recorded === 0 ? (
              <Text style={[styles.emptyText, rtl && styles.rtlText]}>
                {translate(locale, "parent.attendanceMonthEmpty")}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={[styles.title, rtl && styles.rtlText]}>
              {translate(locale, "parent.attendanceDayDetail")}
            </Text>
            <Text style={[styles.detailDate, rtl && styles.rtlText]}>
              {formatLocalizedDate(selected, locale)}
            </Text>
            {selectedMark && !dayIsFuture ? (
              <View style={styles.detailBody}>
                <View style={[styles.detailStatus, rtl && styles.rtlRow]}>
                  <View style={[styles.legendDot, { backgroundColor: statusColors[selectedMark.status] }]} />
                  <Text style={styles.detailValue}>{translate(locale, statusKeys[selectedMark.status])}</Text>
                </View>
                <Text style={[styles.caption, rtl && styles.rtlText]}>{selectedMark.className}</Text>
                {selectedMark.note ? (
                  <Text style={[styles.note, rtl && styles.rtlText]}>{selectedMark.note}</Text>
                ) : (
                  <Text style={[styles.caption, rtl && styles.rtlText]}>
                    {translate(locale, "parent.attendanceNoNote")}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={[styles.emptyText, rtl && styles.rtlText]}>
                {translate(locale, dayIsFuture ? "parent.attendanceFuture" : "parent.attendanceUnrecorded")}
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={[styles.title, rtl && styles.rtlText]}>
              {translate(locale, "parent.attendanceHistory")}
            </Text>
            {history.length ? history.map((row) => (
              <Pressable key={row.date} accessibilityRole="button"
                accessibilityLabel={formatLocalizedDate(row.date, locale) + ", " +
                  translate(locale, statusKeys[row.status])}
                accessibilityState={{ selected: row.date === selected }}
                onPress={() => setSelectedDay(row.date)}
                style={[styles.historyRow, row.date === selected && styles.selectedDay]}>
                <View style={[styles.historyHeading, rtl && styles.rtlRow]}>
                  <View style={[styles.legendDot, { backgroundColor: statusColors[row.status] }]} />
                  <Text style={[styles.historyDate, rtl && styles.rtlText]}>
                    {formatLocalizedDate(row.date, locale)}
                  </Text>
                  <Text style={[styles.historyStatus, rtl && styles.rtlText]}>
                    {translate(locale, statusKeys[row.status])}
                  </Text>
                </View>
                {row.note ? (
                  <Text numberOfLines={2} style={[styles.caption, rtl && styles.rtlText]}>
                    {row.note}
                  </Text>
                ) : null}
              </Pressable>
            )) : (
              <Text style={[styles.emptyText, rtl && styles.rtlText]}>
                {translate(locale, "parent.attendanceMonthEmpty")}
              </Text>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, paddingBottom: 10 },
  card: { backgroundColor: tokens.color.surface, borderRadius: 20, borderWidth: 1,
    borderColor: tokens.color.border, padding: 16, gap: 13 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headingIcon: { width: 44, height: 44, backgroundColor: "#eaf1ff",
    borderRadius: 14, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, minWidth: 0 },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  title: { fontSize: 17, fontWeight: "800", color: tokens.color.text },
  caption: { fontSize: 12.5, lineHeight: 19, color: tokens.color.textMuted },
  monthControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  arrow: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center",
    borderRadius: 13, backgroundColor: tokens.color.surfaceMuted },
  disabled: { opacity: 0.3 },
  monthTitle: { color: tokens.color.text, fontWeight: "800", fontSize: 16, textAlign: "center",
    flex: 1 },
  calendar: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: { width: "14.2857%", padding: 2, minWidth: 0 },
  weekday: { textAlign: "center", fontSize: 11, fontWeight: "700",
    color: tokens.color.textMuted, paddingVertical: 8 },
  day: { minHeight: 47, borderRadius: 12, paddingVertical: 5, alignItems: "center",
    justifyContent: "center", borderWidth: 1.5, borderColor: "transparent" },
  selectedDay: { borderColor: tokens.color.brand, backgroundColor: "#edf3ff" },
  dayText: { fontSize: 13, fontWeight: "600", color: tokens.color.text },
  selectedDayText: { color: tokens.color.brandStrong, fontWeight: "900" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  dotSpacer: { height: 9 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11.5, fontWeight: "600", color: tokens.color.textMuted },
  message: { paddingVertical: 12, justifyContent: "center", alignItems: "center", gap: 9 },
  retry: { flexDirection: "row", gap: 6, alignItems: "center", padding: 12,
    minHeight: 44, borderRadius: 12, backgroundColor: "#edf3ff" },
  retryText: { color: tokens.color.brandStrong, fontWeight: "800", fontSize: 13 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { flex: 1, minWidth: 67, paddingVertical: 12, paddingHorizontal: 5,
    alignItems: "center", backgroundColor: tokens.color.surfaceMuted, borderRadius: 12 },
  statValue: { fontSize: 21, fontWeight: "900" },
  statLabel: { fontSize: 11, color: tokens.color.textMuted, textAlign: "center" },
  rateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rateLabel: { fontWeight: "700", fontSize: 14, color: tokens.color.text, flex: 1 },
  rateValue: { fontSize: 20, fontWeight: "900", color: tokens.color.brandStrong },
  emptyText: { color: tokens.color.textMuted, fontSize: 13, paddingVertical: 4 },
  detailDate: { fontSize: 15, color: tokens.color.brandStrong, fontWeight: "800" },
  detailBody: { gap: 10 },
  detailStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  detailValue: { color: tokens.color.text, fontWeight: "800", fontSize: 15 },
  note: { fontSize: 13, lineHeight: 20, color: tokens.color.text, backgroundColor: "#f6f8fb",
    padding: 12, borderRadius: 12 },
  historyRow: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: tokens.color.border, gap: 6, minHeight: 48 },
  historyHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyDate: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "700", color: tokens.color.text },
  historyStatus: { fontSize: 12, fontWeight: "700", color: tokens.color.textMuted }
});
