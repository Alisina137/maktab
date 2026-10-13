import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  getDirection,
  translate,
  type SupportedLocale
} from "@maktablink/localization";
import type { AnnouncementPayload, ParentNotification } from "./api";

export type StudentCommunicationTab = "ANNOUNCEMENTS" | "NOTIFICATIONS";

type TextDirectionStyle = {
  textAlign: "right" | "left";
  writingDirection: "rtl" | "ltr";
};

export function StudentCommunicationContent({
  announcements,
  notifications,
  classId,
  ready,
  activeTab,
  locale,
  textDirection,
  onSelectTab,
  onMarkRead
}: {
  announcements: AnnouncementPayload[];
  notifications: ParentNotification[];
  classId: string | null;
  ready: boolean;
  activeTab: StudentCommunicationTab;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
  onSelectTab: (tab: StudentCommunicationTab) => void;
  onMarkRead: (notificationId: string) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Server enforces audience scope; the active class is checked here as well
  // to avoid showing outdated class announcements after a class transfer.
  const visibleAnnouncements = announcements
    .filter((item) => item.audienceScope !== "CLASS" || (classId !== null && item.classId === classId))
    .sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt));
  const orderedNotifications = [...notifications].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
  const unreadCount = orderedNotifications.filter((item) => !item.readAt).length;
  const visibleNotifications = unreadOnly
    ? orderedNotifications.filter((item) => !item.readAt)
    : orderedNotifications;
  const tabs: Array<{
    key: StudentCommunicationTab;
    label: "student.announcementsTitle" | "student.notificationsTitle";
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { key: "ANNOUNCEMENTS", label: "student.announcementsTitle", icon: "megaphone-outline" },
    { key: "NOTIFICATIONS", label: "student.notificationsTitle", icon: "notifications-outline" }
  ];

  return (
    <View style={styles.stack}>
      <View accessibilityRole="tablist" style={[styles.tabs, rtl && styles.rowRtl]}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={translate(locale, tab.label)}
              onPress={() => onSelectTab(tab.key)}
              style={({ pressed }) => [
                styles.tab,
                active && styles.activeTab,
                pressed && styles.pressed
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={17}
                color={active ? tokens.color.brandStrong : tokens.color.textMuted}
              />
              <Text style={[styles.tabText, active && styles.activeTabText]}>
                {translate(locale, tab.label)}
              </Text>
              {tab.key === "NOTIFICATIONS" && unreadCount > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{formatLocalizedNumber(unreadCount, locale)}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {!ready ? (
        <View style={[styles.emptyCard, rtl && styles.rowRtl]}>
          <ActivityIndicator color={tokens.color.brand} />
          <Text style={[styles.muted, styles.flex, textDirection]}>
            {translate(locale, "common.loading")}
          </Text>
        </View>
      ) : activeTab === "ANNOUNCEMENTS" ? (
        <View style={styles.stack}>
          {visibleAnnouncements.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={[styles.itemHeading, rtl && styles.rowRtl]}>
                <View style={styles.iconShell}>
                  <Ionicons name="megaphone-outline" size={18} color={tokens.color.brandStrong} />
                </View>
                <Text style={[styles.itemTitle, styles.flex, textDirection]}>{item.title}</Text>
              </View>
              <Text style={[styles.body, textDirection]}>{item.content}</Text>
              <View style={[styles.metaRow, rtl && styles.rowRtl]}>
                <Text style={styles.metaText}>{formatLocalizedDate(item.publishAt, locale)}</Text>
                <Text style={styles.metaText}>
                  {translate(locale, item.audienceScope === "CLASS"
                    ? "student.classAnnouncement"
                    : item.audienceScope === "ROLE"
                      ? "student.studentAnnouncement"
                      : "student.schoolAnnouncement")}
                </Text>
              </View>
            </View>
          ))}
          {visibleAnnouncements.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="megaphone-outline" size={23} color={tokens.color.textMuted} />
              <Text style={[styles.muted, textDirection]}>
                {translate(locale, "student.noAnnouncements")}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.stack}>
          <View style={[styles.filterBar, rtl && styles.rowRtl]}>
            <Text style={[styles.muted, styles.flex, textDirection]}>
              {formatLocalizedNumber(unreadCount, locale)} {translate(locale, "student.unreadNotifications")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: unreadOnly }}
              onPress={() => setUnreadOnly((value) => !value)}
              style={({ pressed }) => [
                styles.filterButton, unreadOnly && styles.filterActive, pressed && styles.pressed
              ]}
            >
              <Text style={styles.filterText}>
                {translate(locale, unreadOnly ? "student.showAll" : "student.unreadOnly")}
              </Text>
            </Pressable>
          </View>
          {visibleNotifications.map((item) => (
            <View key={item.id} style={[styles.itemCard, !item.readAt && styles.unreadCard]}>
              <View style={[styles.itemHeading, rtl && styles.rowRtl]}>
                <View style={[styles.iconShell, !item.readAt && styles.unreadIcon]}>
                  <Ionicons
                    name={item.readAt ? "notifications-outline" : "notifications"}
                    size={18}
                    color={tokens.color.brandStrong}
                  />
                </View>
                <Text style={[styles.itemTitle, styles.flex, textDirection]}>{item.title}</Text>
                {!item.readAt ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={[styles.body, textDirection]}>{item.message}</Text>
              <View style={[styles.metaRow, rtl && styles.rowRtl]}>
                <Text style={styles.metaText}>{formatLocalizedDate(item.createdAt, locale)}</Text>
                {!item.readAt ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate(locale, "student.markRead")}
                    onPress={() => onMarkRead(item.id)}
                    style={({ pressed }) => [styles.markRead, pressed && styles.pressed]}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={tokens.color.brandStrong} />
                    <Text style={styles.markReadText}>{translate(locale, "student.markRead")}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.metaText}>{translate(locale, "student.read")}</Text>
                )}
              </View>
            </View>
          ))}
          {visibleNotifications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-off-outline" size={23} color={tokens.color.textMuted} />
              <Text style={[styles.muted, textDirection]}>
                {translate(locale, unreadOnly
                  ? "student.noUnreadNotifications"
                  : "communication.noNotifications")}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  rowRtl: { flexDirection: "row-reverse" },
  tabs: { flexDirection: "row", borderWidth: 1, borderColor: "#dae5f2", borderRadius: 16, padding: 4, backgroundColor: "#edf3fa", gap: 4 },
  tab: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 7, minHeight: 46, borderRadius: 12 },
  activeTab: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cddbed" },
  tabText: { color: tokens.color.textMuted, fontSize: 12, fontWeight: "600", flexShrink: 1 },
  activeTabText: { color: tokens.color.brandStrong },
  countBadge: { borderRadius: 10, backgroundColor: "#dceafa", minWidth: 19, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
  countText: { color: tokens.color.brandStrong, fontSize: 10, fontWeight: "700" },
  itemCard: { borderRadius: 17, borderWidth: 1, borderColor: "#dfe7f2", padding: 15, backgroundColor: "#fff", gap: 10 },
  unreadCard: { borderColor: "#b6d6f1", backgroundColor: "#f7fbff" },
  itemHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconShell: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#ecf4fc", alignItems: "center", justifyContent: "center" },
  unreadIcon: { backgroundColor: "#deedff" },
  itemTitle: { color: tokens.color.text, fontSize: 15, fontWeight: "700" },
  body: { color: tokens.color.text, fontSize: 13, lineHeight: 21 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  metaText: { color: tokens.color.textMuted, fontSize: 11 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.color.brand },
  filterBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterButton: { borderWidth: 1, borderColor: "#d6e4f3", borderRadius: 12, minHeight: 40, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "#fff" },
  filterActive: { borderColor: tokens.color.brand, backgroundColor: "#ecf4fc" },
  filterText: { color: tokens.color.brandStrong, fontSize: 12, fontWeight: "700" },
  markRead: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40 },
  markReadText: { color: tokens.color.brandStrong, fontSize: 12, fontWeight: "700" },
  emptyCard: { borderWidth: 1, borderColor: "#e1eaf4", borderRadius: 17, backgroundColor: "#f8faff", minHeight: 100, padding: 18, justifyContent: "center", alignItems: "center", gap: 10 },
  muted: { color: tokens.color.textMuted, fontSize: 13 },
  pressed: { opacity: 0.73 }
});
