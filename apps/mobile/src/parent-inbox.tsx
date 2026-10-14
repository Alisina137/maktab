import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, translate,
  type SupportedLocale
} from "@maktablink/localization";
import type { ParentNotification } from "./api";

export function ParentNotificationsContent({
  notifications, locale, onOpen, onMarkAllRead
}: {
  notifications: ParentNotification[];
  locale: SupportedLocale;
  onOpen: (item: ParentNotification) => void;
  onMarkAllRead: () => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const ordered = [...notifications].sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  return (
    <View style={styles.card}>
      <View style={[styles.heading, rtl && styles.rtlRow]}>
        <Text style={[styles.title, rtl && styles.rtlText]}>
          {translate(locale, "notifications.title")}
          {unreadCount ? ` (${formatLocalizedNumber(unreadCount, locale)})` : ""}
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={onMarkAllRead} accessibilityRole="button" style={styles.markButton}>
            <Text style={styles.markText}>{translate(locale, "teacher.markAllRead")}</Text>
          </Pressable>
        ) : null}
      </View>
      {ordered.map((item) => (
        <Pressable
          key={item.id} accessibilityRole="button" accessibilityLabel={item.title}
          onPress={() => onOpen(item)}
          style={({ pressed }) => [
            styles.item, rtl && styles.rtlRow, !item.readAt && styles.unread, pressed && styles.pressed
          ]}
        >
          <Ionicons name={item.readAt?"notifications-outline":"notifications"} size={19}
            color={tokens.color.brandStrong} />
          <View style={styles.flex}>
            <Text style={[styles.itemTitle,rtl && styles.rtlText]}>{item.title}</Text>
            <Text style={[styles.muted,rtl && styles.rtlText]}>{item.message}</Text>
            <Text style={[styles.date,rtl && styles.rtlText]}>
              {formatLocalizedDate(item.createdAt, locale)}
            </Text>
          </View>
          {!item.readAt ? <View style={styles.dot} /> : null}
        </Pressable>
      ))}
      {!ordered.length ? (
        <Text style={[styles.muted,rtl && styles.rtlText]}>
          {translate(locale, "notifications.empty")}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: tokens.color.surface, borderColor:"#e1e7f0",
    borderWidth:1, borderRadius:20, padding:15, gap:12 },
  flex: { flex:1, minWidth:0 },
  rtlRow: { flexDirection:"row-reverse" },
  rtlText: { textAlign:"right", writingDirection:"rtl" },
  heading: { flexDirection:"row", gap:12, alignItems:"center", justifyContent:"space-between" },
  title: { fontSize:16, fontWeight:"900", color:tokens.color.text, flex:1 },
  item: { flexDirection:"row", alignItems:"flex-start", minHeight:64, gap:10,
    padding:12, borderRadius:14, borderWidth:1, borderColor:"#edf0f5" },
  unread: { borderColor:"#c8defc", backgroundColor:"#f2f7ff" },
  pressed: { opacity:0.75 },
  itemTitle: { fontWeight:"800", fontSize:14, color:tokens.color.text },
  muted: { fontSize:13, color:tokens.color.textMuted, lineHeight:19 },
  date: { fontSize:11.5, color:tokens.color.textMuted, paddingTop:4 },
  dot: { width:8, height:8, borderRadius:4, backgroundColor:tokens.color.brandStrong, marginTop:5 },
  markButton: { minHeight:44, justifyContent:"center", paddingHorizontal:8 },
  markText: { color:tokens.color.brandStrong, fontSize:12, fontWeight:"800" }
});
