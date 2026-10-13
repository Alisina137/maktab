import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import { api, type NegaranAttendanceHistoryPayload } from "./api";
import { appErrorFromCause, type AppErrorKind } from "./error-message";
import { calendarCells, monthRange, shiftMonth } from "./negaran-attendance-utils";

type Direction = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
const STATUS_KEYS = [
  ["present", "attendance.present"],
  ["absent", "attendance.absent"],
  ["late", "attendance.late"],
  ["excused", "attendance.excused"]
] as const;

export function NegaranHistoryPanel({
  accessToken, classId, today, locale, textDirection, reconnectEpoch, onOpenDay, onError
}: {
  accessToken: string;
  classId: string;
  today: string;
  locale: SupportedLocale;
  textDirection: Direction;
  reconnectEpoch: number;
  onOpenDay: (day: string) => void;
  onError: (key: TranslationKey, kind?: AppErrorKind) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [history, setHistory] = useState<NegaranAttendanceHistoryPayload | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const range = monthRange(month, today);
  const upcoming = !monthRange(shiftMonth(month, 1), today);
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2024, 0, 6 + index, 12));
    return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date);
  });
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long", year: "numeric", timeZone: "UTC", calendar: "gregory"
  }).format(new Date(month + "-15T12:00:00Z"));

  useEffect(() => {
    const current = ++generation.current;
    setReady(false);
    setError(false);
    setHistory(null);
    if (!range) {
      setReady(true);
      return;
    }
    void api.teacherAttendanceHistory(accessToken, classId, range.from, range.to)
      .then((result) => {
        if (current === generation.current) setHistory(result);
      })
      .catch((cause: unknown) => {
        if (current !== generation.current) return;
        setError(true);
        const failure = appErrorFromCause(cause);
        onError(failure.key, failure.kind);
      })
      .finally(() => {
        if (current === generation.current) setReady(true);
      });
    return () => { generation.current += 1; };
  }, [accessToken, classId, month, today, reconnectEpoch, refresh]);

  const byDate = new Map((history?.days ?? []).map((day) => [day.date, day]));
  const cells = calendarCells(month);
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const summary = history?.summary;

  return (
    <View style={styles.card} testID="negaran-attendance-history">
      <View style={[styles.header, rtl && styles.rowRtl]}>
        <Ionicons name="calendar-outline" color={tokens.color.brandStrong} size={23} />
        <Text style={[styles.title, textDirection]}>{translate(locale, "attendance.historyTitle")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "action.retry")}
          onPress={() => setRefresh((value) => value + 1)} style={styles.iconButton}>
          <Ionicons name="refresh-outline" color={tokens.color.brandStrong} size={20} />
        </Pressable>
      </View>
      <View style={[styles.monthHeader, rtl && styles.rowRtl]}>
        <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "learning.previousMonth")}
          style={styles.iconButton} onPress={() => setMonth((old) => shiftMonth(old, -1))}>
          <Ionicons name="chevron-back" size={23} color={tokens.color.brandStrong} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "learning.nextMonth")}
          disabled={upcoming} style={[styles.iconButton, upcoming && styles.disabled]}
          onPress={() => setMonth((old) => shiftMonth(old, 1))}>
          <Ionicons name="chevron-forward" size={23} color={tokens.color.brandStrong} />
        </Pressable>
      </View>
      {!ready ? <ActivityIndicator color={tokens.color.brand} /> : null}
      {ready && error ? (
        <Text style={[styles.muted, textDirection]}>{translate(locale, "attendance.historyError")}</Text>
      ) : null}
      {ready && history ? (
        <>
          <View style={[styles.statistics, rtl && styles.rowRtl]}>
            <View style={styles.metric}>
              <Text style={styles.metricNumber}>{formatLocalizedNumber(summary?.submittedDays ?? 0, locale)}</Text>
              <Text style={styles.metricLabel}>{translate(locale, "attendance.submittedDays")}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricNumber}>
                {summary?.attendancePercent === null ? "—" :
                  `${formatLocalizedNumber(summary?.attendancePercent ?? 0, locale)}%`}
              </Text>
              <Text style={styles.metricLabel}>{translate(locale, "attendance.attendanceRate")}</Text>
            </View>
          </View>
          <Text style={[styles.explanation, textDirection]}>{translate(locale, "attendance.rateHint")}</Text>
          <View style={[styles.totals, rtl && styles.rowRtl]}>
            {STATUS_KEYS.map(([key, label]) => (
              <View style={styles.totalChip} key={key}>
                <Text style={styles.totalNumber}>{formatLocalizedNumber(summary?.[key] ?? 0, locale)}</Text>
                <Text style={styles.totalLabel}>{translate(locale, label)}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.weekRow, rtl && styles.rowRtl]}>
            {weekdays.map((label, index) => (
              <Text key={index} numberOfLines={1} style={styles.weekday}>{label}</Text>
            ))}
          </View>
          {rows.map((row, index) => (
            <View style={[styles.weekRow, rtl && styles.rowRtl]} key={index}>
              {row.map((date, dayIndex) => {
                const found = date ? byDate.get(date) : null;
                const isToday = date === today;
                return (
                  <View style={styles.dayCell} key={date ?? `empty-${index}-${dayIndex}`}>
                    {date ? (
                      <Pressable accessibilityRole="button"
                        accessibilityLabel={found
                          ? `${formatLocalizedDate(date, locale)}: ${translate(locale, "attendance.submitted")}`
                          : formatLocalizedDate(date, locale)}
                        disabled={!found}
                        onPress={() => date && onOpenDay(date)}
                        style={[styles.dayButton, isToday && styles.todayDay, found && styles.submittedDay]}>
                        <Text style={[styles.dayText, found && styles.submittedText]}>
                          {formatLocalizedNumber(Number(date.slice(-2)), locale)}
                        </Text>
                        {found ? <View style={styles.dayDot} /> : null}
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
          {history.days.length ? (
            <View style={styles.dayList}>
              {history.days.map((day) => (
                <Pressable key={day.date} accessibilityRole="button"
                  onPress={() => onOpenDay(day.date)}
                  style={[styles.dayItem, rtl && styles.rowRtl]}>
                  <View style={styles.flex}>
                    <Text style={[styles.dayTitle, textDirection]}>{formatLocalizedDate(day.date, locale)}</Text>
                    <Text style={[styles.muted, textDirection]}>
                      {translate(locale, "attendance.present")}: {formatLocalizedNumber(day.present, locale)} ·{" "}
                      {translate(locale, "attendance.absent")}: {formatLocalizedNumber(day.absent, locale)} ·{" "}
                      {translate(locale, "attendance.late")}: {formatLocalizedNumber(day.late, locale)} ·{" "}
                      {translate(locale, "attendance.excused")}: {formatLocalizedNumber(day.excused, locale)}
                    </Text>
                  </View>
                  <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={19} color={tokens.color.brandStrong} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[styles.muted, textDirection]}>{translate(locale, "attendance.noHistory")}</Text>
          )}
          <Text style={[styles.explanation, textDirection]}>{translate(locale, "attendance.historyReadOnly")}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", padding: 15, borderRadius: 19, borderWidth: 1, borderColor: "#dce5f2", gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowRtl: { flexDirection: "row-reverse" },
  title: { color: tokens.color.text, fontSize: 16, fontWeight: "900", flex: 1 },
  iconButton: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthLabel: { fontSize: 16, fontWeight: "800", color: tokens.color.text, textAlign: "center" },
  disabled: { opacity: 0.35 },
  muted: { color: tokens.color.textMuted, fontSize: 12, lineHeight: 19 },
  explanation: { color: tokens.color.textMuted, fontSize: 11, lineHeight: 16 },
  statistics: { flexDirection: "row", gap: 9 },
  metric: { flex: 1, padding: 12, backgroundColor: "#f1f6ff", borderRadius: 13, alignItems: "center", gap: 6 },
  metricNumber: { color: tokens.color.brandStrong, fontWeight: "900", fontSize: 21 },
  metricLabel: { color: tokens.color.textMuted, fontSize: 11, textAlign: "center" },
  totals: { flexDirection: "row", gap: 5 },
  totalChip: { flex: 1, minWidth: 0, paddingVertical: 11, backgroundColor: "#f8fafc",
    borderRadius: 11, alignItems: "center", gap: 5 },
  totalNumber: { fontSize: 15, fontWeight: "900", color: tokens.color.text },
  totalLabel: { fontSize: 10, color: tokens.color.textMuted },
  weekRow: { flexDirection: "row", width: "100%" },
  weekday: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "800",
    color: tokens.color.textMuted, paddingVertical: 8 },
  dayCell: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center" },
  dayButton: { width: 39, maxWidth: "100%", minHeight: 39, alignItems: "center", justifyContent: "center",
    borderRadius: 12, gap: 1 },
  todayDay: { borderWidth: 1, borderColor: tokens.color.brand },
  submittedDay: { backgroundColor: "#e6f0ff" },
  dayText: { fontSize: 12, fontWeight: "700", color: tokens.color.textMuted },
  submittedText: { color: tokens.color.brandStrong, fontWeight: "900" },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: tokens.color.brandStrong },
  dayList: { gap: 6 },
  dayItem: { flexDirection: "row", paddingVertical: 11, alignItems: "center", gap: 8,
    borderTopColor: "#e9eef5", borderTopWidth: 1, minHeight: 56 },
  flex: { flex: 1 },
  dayTitle: { color: tokens.color.text, fontSize: 13, fontWeight: "800", paddingBottom: 3 }
});
