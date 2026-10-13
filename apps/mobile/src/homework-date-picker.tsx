import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import { getDirection, translate, type SupportedLocale } from "@maktablink/localization";

type Direction = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };

function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function parseDate(value: string): Date | null {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 &&
    date.getDate() === day ? date : null;
}

function monthFrom(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function monthBy(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12);
}

// School weeks begin on Saturday. React Native's getDay() begins on Sunday.
function saturdayOffset(firstDay: Date): number {
  return (firstDay.getDay() + 1) % 7;
}

export function HomeworkDueDatePicker({
  value, onChange, locale, textDirection, disabled
}: {
  value: string;
  onChange: (date: string) => void;
  locale: SupportedLocale;
  textDirection: Direction;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [shownMonth, setShownMonth] = useState(() => monthFrom(parseDate(value) ?? new Date()));
  const rtl = getDirection(locale) === "rtl";
  const language = locale === "en" ? "en-US" : locale;
  const monthLabel = new Intl.DateTimeFormat(language, {
    calendar: "gregory", month: "long", year: "numeric", timeZone: "Asia/Kabul"
  }).format(shownMonth);
  const weekdayFormatter = new Intl.DateTimeFormat(language, {
    calendar: "gregory", weekday: "short", timeZone: "Asia/Kabul"
  });
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    weekdayFormatter.format(new Date(2024, 0, 6 + index, 12))
  );
  const monthLength = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 0).getDate();
  const startingBlanks = saturdayOffset(shownMonth);
  const cellCount = Math.ceil((startingBlanks + monthLength) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - startingBlanks + 1;
    return day >= 1 && day <= monthLength ? day : null;
  });
  const currentDay = isoDate(new Date());
  const rows = Array.from({ length: cellCount / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  const showCalendar = () => {
    if (disabled) return;
    setShownMonth(monthFrom(parseDate(value) ?? new Date()));
    setOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate(locale, "learning.pickDueDate")}
        accessibilityValue={{ text: value || translate(locale, "learning.pickDueDate") }}
        testID="teacher-homework-due-date"
        disabled={disabled}
        onPress={showCalendar}
        style={({ pressed }) => [
          styles.dateField, rtl && styles.rowRtl, pressed && styles.pressed, disabled && styles.disabled
        ]}
      >
        <Ionicons name="calendar-outline" size={19} color={tokens.color.brandStrong} />
        <Text style={[styles.fieldText, !value && styles.placeholder, textDirection]}>
          {value || translate(locale, "learning.pickDueDate")}
        </Text>
        <Ionicons name="chevron-down" size={16} color={tokens.color.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)}
            accessibilityLabel={translate(locale, "learning.closeCalendar")} accessibilityRole="button" />
          <View style={styles.calendarCard} accessibilityViewIsModal testID="teacher-homework-calendar">
            <View style={[styles.dialogHeader, rtl && styles.rowRtl]}>
              <Text style={[styles.dialogTitle, textDirection]}>
                {translate(locale, "learning.pickDueDate")}
              </Text>
              <Pressable accessibilityRole="button"
                accessibilityLabel={translate(locale, "learning.closeCalendar")}
                onPress={() => setOpen(false)} style={styles.iconButton}>
                <Ionicons name="close" size={22} color={tokens.color.text} />
              </Pressable>
            </View>
            <View style={[styles.monthHeader, rtl && styles.rowRtl]}>
              <Pressable style={styles.iconButton} accessibilityRole="button"
                accessibilityLabel={translate(locale, "learning.previousMonth")}
                onPress={() => setShownMonth((current) => monthBy(current, -1))}>
                <Ionicons name="chevron-back" size={23} color={tokens.color.brandStrong} />
              </Pressable>
              <Text style={styles.monthTitle}>{monthLabel}</Text>
              <Pressable style={styles.iconButton} accessibilityRole="button"
                accessibilityLabel={translate(locale, "learning.nextMonth")}
                onPress={() => setShownMonth((current) => monthBy(current, 1))}>
                <Ionicons name="chevron-forward" size={23} color={tokens.color.brandStrong} />
              </Pressable>
            </View>
            <View style={[styles.weekRow, rtl && styles.rowRtl]}>
              {weekdayLabels.map((day, index) =>
                <Text style={styles.weekday} key={index} numberOfLines={1}>{day}</Text>
              )}
            </View>
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={[styles.weekRow, rtl && styles.rowRtl]}>
                {row.map((day, dayIndex) => {
                  if (!day) return <View style={styles.dayCell} key={dayIndex} />;
                  const date = isoDate(new Date(shownMonth.getFullYear(), shownMonth.getMonth(), day, 12));
                  const selected = date === value;
                  const today = date === currentDay;
                  return (
                    <View style={styles.dayCell} key={date}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={date}
                        accessibilityState={{ selected }}
                        onPress={() => { onChange(date); setOpen(false); }}
                        style={({ pressed }) => [
                          styles.dayButton, today && styles.todayButton,
                          selected && styles.selectedButton, pressed && styles.pressed
                        ]}
                      >
                        <Text style={[styles.dayText, today && styles.todayText, selected && styles.selectedText]}>
                          {day}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  rowRtl: { flexDirection: "row-reverse" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  dateField: { flex: 1, flexDirection: "row", minHeight: 48, paddingHorizontal: 12,
    alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1,
    borderColor: "#dbe3ee", backgroundColor: "#fbfcfe" },
  fieldText: { flex: 1, color: tokens.color.text, fontSize: 13, fontWeight: "700" },
  placeholder: { color: tokens.color.textMuted, fontWeight: "400" },
  overlay: { flex: 1, backgroundColor: "rgba(14,26,43,0.55)", justifyContent: "center",
    padding: 18, alignItems: "center" },
  calendarCard: { backgroundColor: "#fff", width: "100%", maxWidth: 415,
    borderRadius: 22, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 18, gap: 6,
    elevation: 14, shadowColor: "#172033", shadowOpacity: 0.13, shadowRadius: 18 },
  dialogHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 6, marginBottom: 4 },
  dialogTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: tokens.color.text },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthTitle: { fontSize: 17, color: tokens.color.text, fontWeight: "900", textAlign: "center" },
  weekRow: { flexDirection: "row", width: "100%" },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700",
    color: tokens.color.textMuted, paddingVertical: 7 },
  dayCell: { flex: 1, height: 43, justifyContent: "center", alignItems: "center" },
  dayButton: { height: 39, width: 39, maxWidth: "100%", borderRadius: 12,
    alignItems: "center", justifyContent: "center" },
  todayButton: { borderWidth: 1, borderColor: tokens.color.brand },
  selectedButton: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand },
  dayText: { fontSize: 13, fontWeight: "700", color: tokens.color.text },
  todayText: { color: tokens.color.brandStrong },
  selectedText: { color: "#fff", fontWeight: "900" }
});
