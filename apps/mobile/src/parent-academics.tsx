import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, formatLocalizedTimeRange,
  getDirection, translate, type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import type { LearnerAcademicPayload, ParentTimetablePeriod } from "./api";
import { shareLearningFile } from "./learning-files";
import {
  academicSubjects, defaultTimetableDay, filterParentHomework, filterParentResults,
  filterParentTimetable, groupParentResults, homeworkCategory, parentHomeworkItems,
  schoolWeekdays, type HomeworkView, type Weekday
} from "./parent-academics-model";

type Status = "idle" | "loading" | "ready" | "error";
type TextDirectionStyle = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
type FilterOption = { key: string; label: string };
const homeworkKeys: Record<HomeworkView, TranslationKey> = {
  ALL: "parent.academicAll", UPCOMING: "parent.academicUpcoming",
  PAST: "parent.academicPast", CLOSED: "parent.academicClosed"
};

function ErrorOrLoading({
  status, locale, onRetry
}: { status: Status; locale: SupportedLocale; onRetry: () => void }) {
  const rtl = getDirection(locale) === "rtl";
  if (status === "ready") return null;
  return (
    <View style={styles.card}>
      {status === "loading" || status === "idle" ? (
        <View style={[styles.inline, rtl && styles.rtlRow]}>
          <ActivityIndicator color={tokens.color.brand} />
          <Text style={styles.secondary}>{translate(locale, "common.loading")}</Text>
        </View>
      ) : (
        <View style={styles.message}>
          <Ionicons name="cloud-offline-outline" color={tokens.color.textMuted} size={25} />
          <Text style={[styles.secondary, rtl && styles.rtlText]}>
            {translate(locale, "parent.unavailable")}
          </Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
            <Ionicons name="refresh-outline" color={tokens.color.brandStrong} size={17} />
            <Text style={styles.retryText}>{translate(locale, "parent.tryAgain")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Chips({
  options, selected, onSelect, locale, label
}: {
  options: FilterOption[]; selected: string; onSelect: (value: string) => void;
  locale: SupportedLocale; label: string;
}) {
  const rtl = getDirection(locale) === "rtl";
  return (
    <View style={styles.chipBlock}>
      <Text style={[styles.filterLabel, rtl && styles.rtlText]}>{label}</Text>
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}
        accessibilityLabel={label}
        contentContainerStyle={[styles.chips, rtl && styles.rtlRow]}>
        {options.map(option => (
          <Pressable key={option.key} accessibilityRole="button"
            accessibilityLabel={option.label} accessibilityState={{ selected: selected === option.key }}
            onPress={() => onSelect(option.key)} style={({ pressed }) => [
              styles.chip, selected === option.key && styles.chipActive, pressed && styles.pressed
            ]}>
            <Text style={[styles.chipText, selected === option.key && styles.chipTextActive]}
              numberOfLines={1}>{option.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Empty({ locale, text }: { locale: SupportedLocale; text: string }) {
  const rtl = getDirection(locale) === "rtl";
  return (
    <View style={styles.empty}>
      <Ionicons name="file-tray-outline" size={26} color={tokens.color.textMuted} />
      <Text style={[styles.secondary, rtl && styles.rtlText]}>{text}</Text>
    </View>
  );
}

function academicWeekday(day: Weekday, locale: SupportedLocale) {
  const index = schoolWeekdays.indexOf(day);
  const date = new Date(Date.UTC(2026, 9, 17 + index, 12));
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, {
    weekday: "long", timeZone: "UTC"
  }).format(date);
}

export function ParentAcademicHomework({
  learning, status, accessToken, schoolToday, locale, onRetry
}: {
  learning: LearnerAcademicPayload | null; status: Status; accessToken: string;
  schoolToday: string; locale: SupportedLocale; onRetry: () => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [category, setCategory] = useState<HomeworkView>("ALL");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const items = useMemo(() => parentHomeworkItems(learning), [learning]);
  const subjects = useMemo(() => academicSubjects(items.map(item => ({
    id: item.homework.subjectId, name: item.subjectName
  }))), [items]);
  const filtered = useMemo(() => filterParentHomework(items, {
    category, subjectId, query, today: schoolToday
  }), [items, category, subjectId, query, schoolToday]);

  if (status !== "ready") return <ErrorOrLoading status={status} locale={locale} onRetry={onRetry} />;
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={[styles.heading, rtl && styles.rtlRow]}>
          <Ionicons name="document-text-outline" color={tokens.color.brandStrong} size={21} />
          <View style={styles.flex}>
            <Text style={[styles.title, rtl && styles.rtlText]}>
              {translate(locale, "learning.publishedHomework")}
            </Text>
            <Text style={[styles.secondary, rtl && styles.rtlText]}>
              {translate(locale, "parent.academicHomeworkHint")}
            </Text>
          </View>
          <Text style={styles.total}>{formatLocalizedNumber(filtered.length, locale)}</Text>
        </View>
        <View style={[styles.searchBox, rtl && styles.rtlRow]}>
          <Ionicons name="search-outline" size={18} color={tokens.color.textMuted} />
          <TextInput value={query} onChangeText={setQuery}
            placeholder={translate(locale, "parent.academicSearchHomework")}
            placeholderTextColor={tokens.color.textMuted} accessibilityLabel={translate(locale, "parent.academicSearchHomework")}
            autoCorrect={false} style={[styles.searchInput, rtl && styles.rtlText]} />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "action.dismiss")}
            onPress={() => setQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" color={tokens.color.textMuted} size={20} />
          </Pressable> : null}
        </View>
        <Chips locale={locale} label={translate(locale, "parent.academicStatusFilter")}
          options={(Object.keys(homeworkKeys) as HomeworkView[]).map(key => ({
            key, label: translate(locale, homeworkKeys[key])
          }))}
          selected={category} onSelect={value => setCategory(value as HomeworkView)} />
        {subjects.length > 1 ? <Chips locale={locale} label={translate(locale, "parent.academicSubjectFilter")}
          options={[{ key: "ALL", label: translate(locale, "parent.academicAllSubjects") },
            ...subjects.map(item => ({ key: item.id, label: item.name }))]}
          selected={subjectId ?? "ALL"} onSelect={value => setSubjectId(value === "ALL" ? null : value)} /> : null}
      </View>
      {!items.length ? <Empty locale={locale} text={translate(locale, "learning.noPublishedHomework")} /> :
        !filtered.length ? <Empty locale={locale} text={translate(locale, "parent.academicNoMatches")} /> : null}
      {filtered.map(item => {
        const expanded = expandedId === item.homework.id;
        const tag = homeworkCategory(item, schoolToday);
        return (
          <View key={item.homework.id} style={styles.card}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
              accessibilityLabel={item.homework.title + ", " + translate(locale, homeworkKeys[tag])}
              onPress={() => setExpandedId(expanded ? null : item.homework.id)}
              style={[styles.heading, rtl && styles.rtlRow]}>
              <View style={styles.itemIcon}><Ionicons name="book-outline" size={19} color={tokens.color.brandStrong} /></View>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, rtl && styles.rtlText]}>{item.homework.title}</Text>
                <Text style={[styles.secondary, rtl && styles.rtlText]}>
                  {item.subjectName} · {translate(locale, "learning.due")} {formatLocalizedDate(item.homework.dueAt, locale)}
                </Text>
                <Text style={[styles.statusTag, rtl && styles.rtlText]}>
                  {translate(locale, homeworkKeys[tag])}
                </Text>
              </View>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={tokens.color.textMuted} />
            </Pressable>
            {expanded ? (
              <View style={styles.detail}>
                <Text style={[styles.detailText, rtl && styles.rtlText]}>{item.homework.content}</Text>
                <Text style={[styles.secondary, rtl && styles.rtlText]}>{item.className}</Text>
                {item.homework.attachmentFileId ? (
                  <Pressable accessibilityRole="button" style={[styles.attachment, rtl && styles.rtlRow]}
                    onPress={() => void shareLearningFile(accessToken, item.homework.attachmentFileId!).catch(() =>
                      Alert.alert(translate(locale, "common.errorTitle"), translate(locale, "common.requestFailed")))}>
                    <Ionicons name="attach-outline" color={tokens.color.brandStrong} size={20} />
                    <Text style={styles.link}>{translate(locale, "learning.openAttachment")}</Text>
                  </Pressable>
                ) : null}
                {item.homework.attachmentUrl?.startsWith("https://") ? (
                  <Pressable accessibilityRole="link" style={[styles.attachment, rtl && styles.rtlRow]}
                    onPress={() => void Linking.openURL(item.homework.attachmentUrl!).catch(() =>
                      Alert.alert(translate(locale, "common.errorTitle"), translate(locale, "common.requestFailed")))}>
                    <Ionicons name="open-outline" color={tokens.color.brandStrong} size={19} />
                    <Text style={styles.link}>{translate(locale, "learning.openAttachment")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function ParentAcademicResults({
  learning, status, locale, onRetry
}: {
  learning: LearnerAcademicPayload | null; status: Status;
  locale: SupportedLocale; onRetry: () => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [examId, setExamId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const groups = useMemo(() => groupParentResults(learning), [learning]);
  const subjects = useMemo(() => academicSubjects(groups.flatMap(group => group.rows.map(row => ({
    id: row.examSubject.subjectId, name: row.subjectName
  })))), [groups]);
  const filtered = useMemo(() => filterParentResults(groups, examId, subjectId),
    [groups, examId, subjectId]);

  if (status !== "ready") return <ErrorOrLoading status={status} locale={locale} onRetry={onRetry} />;
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={[styles.heading, rtl && styles.rtlRow]}>
          <Ionicons name="ribbon-outline" size={21} color={tokens.color.brandStrong} />
          <View style={styles.flex}>
            <Text style={[styles.title, rtl && styles.rtlText]}>{translate(locale, "learning.publishedResults")}</Text>
            <Text style={[styles.secondary, rtl && styles.rtlText]}>
              {translate(locale, "parent.academicResultHint")}
            </Text>
          </View>
          <Text style={styles.total}>{formatLocalizedNumber(filtered.length, locale)}</Text>
        </View>
        {groups.length > 1 ? <Chips locale={locale} label={translate(locale, "parent.academicExamFilter")}
          options={[{ key: "ALL", label: translate(locale, "parent.academicAllExams") },
            ...groups.map(group => ({ key: group.id, label: group.name }))]}
          selected={examId ?? "ALL"} onSelect={value => setExamId(value === "ALL" ? null : value)} /> : null}
        {subjects.length > 1 ? <Chips locale={locale} label={translate(locale, "parent.academicSubjectFilter")}
          options={[{ key: "ALL", label: translate(locale, "parent.academicAllSubjects") },
            ...subjects.map(item => ({ key: item.id, label: item.name }))]}
          selected={subjectId ?? "ALL"} onSelect={value => setSubjectId(value === "ALL" ? null : value)} /> : null}
      </View>
      {!groups.length ? <Empty locale={locale} text={translate(locale, "learning.noPublishedResults")} /> :
        !filtered.length ? <Empty locale={locale} text={translate(locale, "parent.academicNoMatches")} /> : null}
      {filtered.map((group, index) => {
        const expanded = expandedIds.includes(group.id) || (index === 0 && !expandedIds.length);
        return (
          <View key={group.id} style={styles.card}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
              accessibilityLabel={group.name}
              onPress={() => setExpandedIds(ids => expanded
                ? [...ids.filter(id => id !== group.id), ...(ids.length ? [] : ["__none__"])]
                : [...ids.filter(id => id !== "__none__"), group.id])}
              style={[styles.heading, rtl && styles.rtlRow]}>
              <View style={styles.itemIcon}><Ionicons name="medal-outline" size={20} color={tokens.color.brandStrong} /></View>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, rtl && styles.rtlText]}>{group.name}</Text>
                {group.type ? <Text style={[styles.secondary, rtl && styles.rtlText]}>{group.type}</Text> : null}
                {group.publishedAt ? <Text style={[styles.secondary, rtl && styles.rtlText]}>
                  {translate(locale, "student.publishedOn")} {formatLocalizedDate(group.publishedAt, locale)}
                </Text> : null}
              </View>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={tokens.color.textMuted} />
            </Pressable>
            <View style={[styles.scoreBand, rtl && styles.rtlRow]}>
              <Text style={[styles.secondary, rtl && styles.rtlText]}>{translate(locale, "parent.academicReportedTotal")}</Text>
              <Text style={styles.scoreText}>{formatLocalizedNumber(group.score, locale)} / {formatLocalizedNumber(group.maximum, locale)}</Text>
            </View>
            {expanded ? group.rows.map(row => (
              <View key={row.grade.id} style={styles.detail}>
                <View style={[styles.heading, rtl && styles.rtlRow]}>
                  <View style={styles.flex}>
                    <Text style={[styles.itemTitle, rtl && styles.rtlText]}>{row.subjectName}</Text>
                    <Text style={[styles.secondary, rtl && styles.rtlText]}>
                      {row.className}{row.examSubject.examDate
                        ? " · " + formatLocalizedDate(row.examSubject.examDate, locale) : ""}
                    </Text>
                  </View>
                  <Text style={styles.scoreText}>{formatLocalizedNumber(row.grade.score, locale)} / {formatLocalizedNumber(row.examSubject.maxScore, locale)}</Text>
                </View>
                {row.grade.remark ? (
                  <View style={[styles.remark, rtl && styles.rtlRow]}>
                    <Ionicons name="chatbubble-outline" size={17} color={tokens.color.textMuted} />
                    <Text style={[styles.detailText, styles.flex, rtl && styles.rtlText]}>{row.grade.remark}</Text>
                  </View>
                ) : null}
              </View>
            )) : null}
          </View>
        );
      })}
    </View>
  );
}

export function ParentAcademicTimetable({
  periods, status, schoolToday, locale, onRetry
}: {
  periods: ParentTimetablePeriod[]; status: Status; schoolToday: string;
  locale: SupportedLocale; onRetry: () => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const initialDay = useMemo(() => defaultTimetableDay(periods, schoolToday), [periods, schoolToday]);
  const [selectedDay, setSelectedDay] = useState<Weekday | "ALL" | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const weekday = selectedDay ?? initialDay;
  const subjects = useMemo(() => academicSubjects(periods.map(item => ({
    id: item.period.subjectId, name: item.subjectName
  }))), [periods]);
  const visible = useMemo(() => filterParentTimetable(periods, weekday, subjectId),
    [periods, weekday, subjectId]);
  const dayLabel = (day: Weekday) => academicWeekday(day, locale);

  if (status !== "ready") return <ErrorOrLoading status={status} locale={locale} onRetry={onRetry} />;
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={[styles.heading, rtl && styles.rtlRow]}>
          <Ionicons name="calendar-outline" size={21} color={tokens.color.brandStrong} />
          <View style={styles.flex}>
            <Text style={[styles.title, rtl && styles.rtlText]}>{translate(locale, "parent.navTimetable")}</Text>
            <Text style={[styles.secondary, rtl && styles.rtlText]}>
              {translate(locale, "parent.academicTimetableHint")}
            </Text>
          </View>
        </View>
        <Chips locale={locale} label={translate(locale, "parent.academicDayFilter")}
          options={[{ key: "ALL", label: translate(locale, "parent.academicWholeWeek") },
            ...schoolWeekdays.map(day => ({ key: day, label: dayLabel(day) }))]}
          selected={weekday} onSelect={value => setSelectedDay(value as Weekday | "ALL")} />
        {subjects.length > 1 ? <Chips locale={locale} label={translate(locale, "parent.academicSubjectFilter")}
          options={[{ key: "ALL", label: translate(locale, "parent.academicAllSubjects") },
            ...subjects.map(item => ({ key: item.id, label: item.name }))]}
          selected={subjectId ?? "ALL"} onSelect={value => setSubjectId(value === "ALL" ? null : value)} /> : null}
        <Text style={[styles.secondary, rtl && styles.rtlText]}>
          {translate(locale, "parent.academicPeriods")}: {formatLocalizedNumber(visible.length, locale)}
        </Text>
      </View>
      {!periods.length ? <Empty locale={locale} text={translate(locale, "parent.noTimetable")} /> :
        !visible.length ? <Empty locale={locale} text={translate(locale, "parent.academicNoPeriods")} /> : null}
      {schoolWeekdays.filter(day => weekday === "ALL" || weekday === day).map(day => {
        const rows = visible.filter(item => item.period.weekday === day);
        if (!rows.length) return null;
        return (
          <View key={day} style={styles.card}>
            <Text style={[styles.title, rtl && styles.rtlText]}>{dayLabel(day)}</Text>
            {rows.map(item => (
              <View key={item.period.id} style={[styles.period, rtl && styles.rtlRow]}>
                <View style={styles.itemIcon}>
                  <Ionicons name="time-outline" size={20} color={tokens.color.brandStrong} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.itemTitle, rtl && styles.rtlText]}>{item.subjectName}</Text>
                  <Text style={[styles.secondary, rtl && styles.rtlText]}>{item.teacherName}</Text>
                  <Text style={[styles.secondary, rtl && styles.rtlText]}>
                    {formatLocalizedTimeRange(item.period.startsAt, item.period.endsAt, locale)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 13, paddingBottom: 10 },
  card: { borderColor: tokens.color.border, borderWidth: 1, borderRadius: 20,
    backgroundColor: tokens.color.surface, padding: 15, gap: 14 },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: "900", color: tokens.color.text },
  itemTitle: { fontSize: 14, lineHeight: 20, fontWeight: "800", color: tokens.color.text },
  secondary: { color: tokens.color.textMuted, fontSize: 12.5, lineHeight: 19 },
  total: { fontSize: 16, fontWeight: "900", color: tokens.color.brandStrong,
    backgroundColor: tokens.color.surfaceMuted, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 10 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 9,
    borderWidth: 1, borderColor: tokens.color.border, backgroundColor: "#f7f9fd",
    borderRadius: 13, paddingHorizontal: 12, minHeight: 48 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 8, fontSize: 14, color: tokens.color.text },
  filterLabel: { fontSize: 12, fontWeight: "800", color: tokens.color.textMuted },
  chipBlock: { gap: 7 },
  chips: { flexDirection: "row", gap: 7, paddingBottom: 2, paddingRight: 3 },
  chip: { minHeight: 42, paddingHorizontal: 13, justifyContent: "center",
    backgroundColor: tokens.color.surfaceMuted, borderRadius: 14,
    borderColor: "transparent", borderWidth: 1 },
  chipActive: { borderColor: tokens.color.brandStrong, backgroundColor: "#eaf1ff" },
  chipText: { fontSize: 12.5, fontWeight: "700", color: tokens.color.textMuted },
  chipTextActive: { color: tokens.color.brandStrong, fontWeight: "900" },
  itemIcon: { width: 39, height: 39, borderRadius: 13, justifyContent: "center",
    alignItems: "center", backgroundColor: "#edf3ff" },
  statusTag: { color: tokens.color.brandStrong, fontSize: 12, fontWeight: "800" },
  detail: { borderTopWidth: 1, borderTopColor: tokens.color.border, paddingTop: 12, gap: 11 },
  detailText: { fontSize: 13.5, lineHeight: 21, color: tokens.color.text },
  attachment: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  link: { color: tokens.color.brandStrong, fontWeight: "800", fontSize: 13 },
  inline: { flexDirection: "row", gap: 8, alignItems: "center" },
  message: { alignItems: "center", gap: 11, padding: 15 },
  retry: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#eaf1ff" },
  retryText: { fontWeight: "800", color: tokens.color.brandStrong },
  empty: { borderRadius: 18, borderWidth: 1, borderColor: tokens.color.border,
    padding: 24, alignItems: "center", gap: 10, backgroundColor: tokens.color.surface },
  pressed: { opacity: 0.74 },
  scoreBand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: tokens.color.surfaceMuted, borderRadius: 12, padding: 11, gap: 9 },
  scoreText: { fontSize: 14, fontWeight: "900", color: tokens.color.brandStrong },
  remark: { flexDirection: "row", gap: 9, backgroundColor: "#f5f8fc", padding: 10, borderRadius: 10 },
  period: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#edf0f5" }
});
