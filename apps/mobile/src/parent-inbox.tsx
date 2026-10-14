import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import type { AnnouncementPayload, ParentNotification } from "./api";
import {
  INBOX_PAGE_SIZE, filterParentAnnouncements, filterParentNotifications,
  inboxPage, type AnnouncementAudience, type NotificationReadFilter, type NotificationTopic
} from "./parent-inbox-model";

type ResourceStatus = "idle" | "loading" | "ready" | "error";
type ChipOption = { key: string; label: TranslationKey };

function SearchAndFilters({
  query, onQuery, label, filter, onFilter, choices, locale
}: {
  query: string; onQuery: (value: string) => void; label: TranslationKey;
  filter: string; onFilter: (value: string) => void; choices: ChipOption[]; locale: SupportedLocale;
}) {
  const rtl = getDirection(locale) === "rtl";
  return (
    <View style={styles.filters}>
      <View style={[styles.search, rtl && styles.rtlRow]}>
        <Ionicons name="search-outline" size={19} color={tokens.color.textMuted} />
        <TextInput value={query} onChangeText={onQuery} autoCorrect={false}
          placeholder={translate(locale, "parent.inboxSearch")} placeholderTextColor={tokens.color.textMuted}
          accessibilityLabel={translate(locale, "parent.inboxSearch")}
          style={[styles.input, rtl && styles.rtlText]} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "action.dismiss")}
          onPress={() => onQuery("")} hitSlop={10}>
          <Ionicons name="close-circle" size={19} color={tokens.color.textMuted} />
        </Pressable> : null}
      </View>
      <Text style={[styles.filterLabel, rtl && styles.rtlText]}>{translate(locale, label)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.chips, rtl && styles.rtlRow]}>
        {choices.map(choice => (
          <Pressable key={choice.key} accessibilityRole="button"
            accessibilityLabel={translate(locale, choice.label)}
            accessibilityState={{ selected: filter === choice.key }}
            onPress={() => onFilter(choice.key)}
            style={({ pressed }) => [
              styles.chip, filter === choice.key && styles.chipSelected, pressed && styles.pressed
            ]}>
            <Text style={[styles.chipText, filter === choice.key && styles.chipTextSelected]}>
              {translate(locale, choice.label)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ResourceState({
  status, locale, onRetry
}: { status: ResourceStatus; locale: SupportedLocale; onRetry: () => void }) {
  const rtl = getDirection(locale) === "rtl";
  return <View style={styles.message}>
    {status === "loading" || status === "idle" ? (
      <ActivityIndicator color={tokens.color.brand} />
    ) : <Ionicons name="cloud-offline-outline" size={24} color={tokens.color.textMuted} />}
    <Text style={[styles.muted, rtl && styles.rtlText]}>
      {translate(locale, status === "error" ? "parent.unavailable" : "common.loading")}
    </Text>
    {status === "error" ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.action}>
      <Text style={styles.actionText}>{translate(locale, "parent.tryAgain")}</Text>
    </Pressable> : null}
  </View>;
}

function Paginator({
  shown, total, onMore, locale
}: { shown: number; total: number; onMore: () => void; locale: SupportedLocale }) {
  if (!total) return null;
  return <View style={styles.pagination}>
    <Text style={styles.muted}>
      {translate(locale, "parent.inboxShowing")} {formatLocalizedNumber(shown, locale)}
      {" / "}{formatLocalizedNumber(total, locale)}
    </Text>
    {shown < total ? <Pressable accessibilityRole="button" onPress={onMore} style={styles.action}>
      <Text style={styles.actionText}>{translate(locale, "parent.inboxLoadMore")}</Text>
      <Ionicons name="chevron-down" size={18} color={tokens.color.brandStrong} />
    </Pressable> : null}
  </View>;
}

function promoteFocused<T>(items: T[], focusId: string | null, key: (value: T) => string): T[] {
  if (!focusId) return items;
  const index = items.findIndex(row => key(row) === focusId);
  return index < 1 ? items : [items[index]!, ...items.slice(0,index), ...items.slice(index+1)];
}

const readChoices: ChipOption[] = [
  { key: "ALL", label: "parent.inboxAll" }, { key: "UNREAD", label: "parent.inboxUnread" },
  { key: "READ", label: "parent.inboxRead" }
];
const topicChoices: ChipOption[] = [
  { key: "ALL", label: "parent.inboxAll" }, { key: "SCHOOL", label: "parent.inboxSchool" },
  { key: "ACADEMICS", label: "parent.inboxAcademics" },
  { key: "ATTENDANCE", label: "parent.navAttendance" },
  { key: "FEES", label: "parent.inboxFees" }
];
const audienceChoices: ChipOption[] = [
  { key: "ALL", label: "parent.inboxAll" }, { key: "SCHOOL", label: "parent.inboxSchool" },
  { key: "CLASS", label: "parent.inboxClass" }, { key: "PARENT", label: "parent.inboxParents" }
];

export function ParentAnnouncementsInbox({
  announcements, classId, locale, status, onRetry, focusedId
}: {
  announcements: AnnouncementPayload[]; classId: string; locale: SupportedLocale;
  status: ResourceStatus; onRetry: () => void; focusedId: string | null;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("ALL");
  const [visibleCount, setVisibleCount] = useState(INBOX_PAGE_SIZE);
  const [expanded, setExpanded] = useState<string | null>(focusedId);

  useEffect(() => {
    if (!focusedId) return;
    setQuery("");
    setAudience("ALL");
    setExpanded(focusedId);
    setVisibleCount(INBOX_PAGE_SIZE);
  }, [focusedId]);
  const matches = useMemo(() => filterParentAnnouncements(announcements, {
    classId, query, audience
  }), [announcements, classId, query, audience]);
  const rows = promoteFocused(matches, focusedId, item => item.id);
  const page = inboxPage(rows, visibleCount, item => item.id);
  const focusedMissing = Boolean(focusedId && status === "ready" &&
    !matches.some(item => item.id === focusedId));

  return <View style={styles.card}>
    <View style={[styles.heading, rtl && styles.rtlRow]}>
      <View style={styles.headingIcon}>
        <Ionicons name="megaphone-outline" size={21} color={tokens.color.brandStrong} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.title, rtl && styles.rtlText]}>{translate(locale, "communication.announcements")}</Text>
        <Text style={[styles.muted, rtl && styles.rtlText]}>{translate(locale, "parent.inboxChildAudience")}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "parent.academicRefresh")}
        style={styles.refresh} onPress={onRetry}>
        <Ionicons name="refresh-outline" color={tokens.color.brandStrong} size={20} />
      </Pressable>
    </View>
    <SearchAndFilters query={query} onQuery={value => { setQuery(value); setVisibleCount(INBOX_PAGE_SIZE); }}
      label="parent.inboxAudience" filter={audience}
      onFilter={value => { setAudience(value as AnnouncementAudience); setVisibleCount(INBOX_PAGE_SIZE); }}
      choices={audienceChoices} locale={locale} />
    {status !== "ready" ? <ResourceState status={status} locale={locale} onRetry={onRetry} /> : (
      <>
        {focusedMissing ? <Text style={[styles.notice, rtl && styles.rtlText]}>
          {translate(locale, "parent.inboxTargetUnavailable")}
        </Text> : null}
        {page.visible.map(item => {
          const open = item.id === expanded;
          return (
            <View key={item.id} style={[styles.item, item.id === focusedId && styles.focused]}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
                accessibilityLabel={item.title}
                onPress={() => setExpanded(open ? null : item.id)}
                style={[styles.itemHeading, rtl && styles.rtlRow]}>
                <View style={styles.flex}>
                  <Text style={[styles.itemTitle, rtl && styles.rtlText]}>{item.title}</Text>
                  <Text style={[styles.muted, rtl && styles.rtlText]}>
                    {formatLocalizedDate(item.publishAt, locale)} · {translate(locale,
                      item.audienceScope === "SCHOOL" ? "parent.inboxSchool" :
                      item.audienceScope === "CLASS" ? "parent.inboxClass" : "parent.inboxParents")}
                  </Text>
                </View>
                <Ionicons name={open ? "chevron-up" : "chevron-down"}
                  size={20} color={tokens.color.textMuted} />
              </Pressable>
              {open ? <Text style={[styles.body, rtl && styles.rtlText]}>{item.content}</Text> :
                <Text numberOfLines={2} style={[styles.muted, rtl && styles.rtlText]}>{item.content}</Text>}
            </View>
          );
        })}
        {!matches.length ? <Text style={[styles.muted, rtl && styles.rtlText]}>
          {translate(locale, query || audience !== "ALL" ? "parent.inboxNoMatches" : "communication.noAnnouncements")}
        </Text> : null}
        <Paginator shown={page.showing} total={rows.length} locale={locale}
          onMore={() => setVisibleCount(value => value + INBOX_PAGE_SIZE)} />
      </>
    )}
  </View>;
}

export function ParentNotificationsContent({
  notifications, locale, onOpen, onMarkAllRead, status = "ready",
  onRetry = () => {}, focusedId = null
}: {
  notifications: ParentNotification[];
  locale: SupportedLocale;
  onOpen: (item: ParentNotification) => void;
  onMarkAllRead: () => void;
  status?: ResourceStatus; onRetry?: () => void; focusedId?: string | null;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [query, setQuery] = useState("");
  const [read, setRead] = useState<NotificationReadFilter>("ALL");
  const [topic, setTopic] = useState<NotificationTopic>("ALL");
  const [visibleCount, setVisibleCount] = useState(INBOX_PAGE_SIZE);
  const [markingAll, setMarkingAll] = useState(false);
  useEffect(() => {
    if (!focusedId) return;
    setQuery(""); setRead("ALL"); setTopic("ALL"); setVisibleCount(INBOX_PAGE_SIZE);
  }, [focusedId]);
  const matches = useMemo(() => filterParentNotifications(notifications, {
    query, read, topic
  }), [notifications, query, read, topic]);
  const rows = promoteFocused(matches, focusedId, item => item.id);
  const page = inboxPage(rows, visibleCount, item => item.id);
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const markReadAll = () => {
    if (markingAll) return;
    setMarkingAll(true);
    onMarkAllRead();
    // Requests in App are independently guarded and the server remains authoritative.
    setTimeout(() => setMarkingAll(false), 1200);
  };

  return (
    <View style={styles.card}>
      <View style={[styles.heading, rtl && styles.rtlRow]}>
        <View style={styles.headingIcon}>
          <Ionicons name="notifications-outline" size={22} color={tokens.color.brandStrong} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, rtl && styles.rtlText]}>
            {translate(locale, "notifications.title")}
            {unreadCount ? ` (${formatLocalizedNumber(unreadCount, locale)})` : ""}
          </Text>
          <Text style={[styles.muted, rtl && styles.rtlText]}>{translate(locale, "parent.inboxAccountWide")}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={translate(locale, "parent.academicRefresh")}
          onPress={onRetry} style={styles.refresh}>
          <Ionicons name="refresh-outline" color={tokens.color.brandStrong} size={19} />
        </Pressable>
      </View>
      {unreadCount > 0 && status === "ready" ? (
        <Pressable onPress={markReadAll} disabled={markingAll} accessibilityRole="button"
          accessibilityState={{ disabled: markingAll }} style={[styles.action, markingAll && styles.disabled]}>
          <Text style={styles.actionText}>{translate(locale, "teacher.markAllRead")}</Text>
        </Pressable>
      ) : null}
      <SearchAndFilters query={query} onQuery={value => { setQuery(value); setVisibleCount(INBOX_PAGE_SIZE); }}
        label="parent.inboxReadFilter" filter={read}
        onFilter={value => { setRead(value as NotificationReadFilter); setVisibleCount(INBOX_PAGE_SIZE); }}
        choices={readChoices} locale={locale} />
      <SearchAndFilters query="" onQuery={() => {}} label="parent.inboxTopic" filter={topic}
        onFilter={value => { setTopic(value as NotificationTopic); setVisibleCount(INBOX_PAGE_SIZE); }}
        choices={topicChoices} locale={locale} />
      {status !== "ready" ? <ResourceState status={status} locale={locale} onRetry={onRetry} /> : (
        <>
          {page.visible.map((item) => (
            <Pressable
              key={item.id} accessibilityRole="button" accessibilityLabel={item.title}
              onPress={() => onOpen(item)}
              style={({ pressed }) => [
                styles.item, !item.readAt && styles.unread,
                item.id === focusedId && styles.focused, pressed && styles.pressed
              ]}
            >
              <View style={[styles.itemHeading, rtl && styles.rtlRow]}>
                <Ionicons name={item.readAt ? "notifications-outline" : "notifications"} size={19}
                  color={tokens.color.brandStrong} />
                <View style={styles.flex}>
                  <Text style={[styles.itemTitle, rtl && styles.rtlText]}>{item.title}</Text>
                  <Text style={[styles.muted, rtl && styles.rtlText]}>{item.message}</Text>
                  <Text style={[styles.date, rtl && styles.rtlText]}>
                    {formatLocalizedDate(item.createdAt, locale)}
                  </Text>
                </View>
                {!item.readAt ? <View style={styles.dot} /> : null}
              </View>
            </Pressable>
          ))}
          {!matches.length ? (
            <Text style={[styles.muted, rtl && styles.rtlText]}>
              {translate(locale, query || read !== "ALL" || topic !== "ALL"
                ? "parent.inboxNoMatches" : "notifications.empty")}
            </Text>
          ) : null}
          <Paginator shown={page.showing} total={rows.length} locale={locale}
            onMore={() => setVisibleCount(value => value + INBOX_PAGE_SIZE)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border,
    borderWidth: 1, borderRadius: 21, padding: 15, gap: 14 },
  flex: { flex: 1, minWidth: 0 },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  headingIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center",
    justifyContent: "center", backgroundColor: "#edf3ff" },
  title: { color: tokens.color.text, fontSize: 16, fontWeight: "900" },
  muted: { fontSize: 12.5, color: tokens.color.textMuted, lineHeight: 19 },
  body: { fontSize: 13.5, color: tokens.color.text, lineHeight: 21 },
  date: { fontSize: 11.5, color: tokens.color.textMuted, paddingTop: 5 },
  refresh: { width: 44, height: 44, borderRadius: 12, alignItems: "center",
    justifyContent: "center", backgroundColor: tokens.color.surfaceMuted },
  filters: { gap: 9 },
  search: { flexDirection: "row", minHeight: 48, borderWidth: 1, borderColor: tokens.color.border,
    borderRadius: 13, backgroundColor: "#f7f9fe", paddingHorizontal: 11, gap: 9, alignItems: "center" },
  input: { flex: 1, minWidth: 0, color: tokens.color.text, fontSize: 14, paddingVertical: 9 },
  filterLabel: { fontSize: 12, fontWeight: "800", color: tokens.color.textMuted },
  chips: { flexDirection: "row", gap: 7, paddingBottom: 2, paddingRight: 3 },
  chip: { minHeight: 42, paddingHorizontal: 13, justifyContent: "center",
    borderRadius: 13, borderWidth: 1, borderColor: "transparent",
    backgroundColor: tokens.color.surfaceMuted },
  chipSelected: { borderColor: tokens.color.brandStrong, backgroundColor: "#eaf1ff" },
  chipText: { fontSize: 12.5, fontWeight: "700", color: tokens.color.textMuted },
  chipTextSelected: { color: tokens.color.brandStrong, fontWeight: "900" },
  item: { padding: 12, borderRadius: 15, gap: 9,
    borderWidth: 1, borderColor: "#e6ebf3", backgroundColor: "#fbfcff" },
  itemHeading: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  unread: { borderColor: "#c5dafa", backgroundColor: "#f2f7ff" },
  focused: { borderColor: tokens.color.brandStrong, borderWidth: 1.5 },
  itemTitle: { color: tokens.color.text, fontSize: 14, fontWeight: "800" },
  dot: { width: 8, height: 8, borderRadius: 4,
    backgroundColor: tokens.color.brandStrong, marginTop: 5 },
  pagination: { alignItems: "center", gap: 9, paddingTop: 3 },
  action: { minHeight: 44, borderRadius: 13, alignItems: "center",
    justifyContent: "center", flexDirection: "row", gap: 7,
    paddingHorizontal: 14, backgroundColor: "#edf3ff", alignSelf: "center" },
  actionText: { color: tokens.color.brandStrong, fontSize: 12.5, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  notice: { color: tokens.color.warning, fontSize: 12.5, lineHeight: 20 },
  message: { paddingVertical: 15, gap: 10, alignItems: "center" },
  pressed: { opacity: 0.75 }
});
