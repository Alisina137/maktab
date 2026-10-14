import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import { getDirection, translate, type SupportedLocale, type TranslationKey } from "@maktablink/localization";
import type { ParentChild } from "./api";

export type ParentAcademicsTab = "HOMEWORK" | "RESULTS" | "TIMETABLE";
export type ParentInboxTab = "ANNOUNCEMENTS" | "NOTIFICATIONS";

export function ParentChildSwitcher({
  childrenList, selectedChildId, onSelect, locale
}: {
  childrenList: ParentChild[] | null;
  selectedChildId: string;
  onSelect: (studentId: string) => void;
  locale: SupportedLocale;
}) {
  const [open, setOpen] = useState(false);
  const rtl = getDirection(locale) === "rtl";
  const selected = childrenList?.find((child) => child.student.id === selectedChildId);
  const switchable = (childrenList?.length ?? 0) > 1;

  // Closing a selector on child/session changes prevents an old child list
  // from remaining on top of a newly authenticated user's screen.
  useEffect(() => { setOpen(false); }, [selectedChildId, childrenList]);

  if (!childrenList) {
    return (
      <View style={styles.childCard}>
        <Text style={[styles.muted, rtl && styles.rtlText]}>{translate(locale, "common.loading")}</Text>
      </View>
    );
  }
  if (childrenList.length === 0 || !selected) {
    return (
      <View style={styles.childCard}>
        <Text style={[styles.muted, rtl && styles.rtlText]}>{translate(locale, "parent.noChildren")}</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${translate(locale, "parent.switchChild")}: ${selected.student.fullName}`}
        accessibilityHint={switchable ? translate(locale, "parent.switchChild") : undefined}
        accessibilityState={{ disabled: !switchable }}
        disabled={!switchable}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.childCard, rtl && styles.rtlRow, pressed && styles.pressed]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{selected.student.fullName.slice(0, 1)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.childName, rtl && styles.rtlText]} numberOfLines={1}>{selected.student.fullName}</Text>
          <Text style={[styles.muted, rtl && styles.rtlText]} numberOfLines={1}>
            {selected.classSection.name} · {selected.classSection.code}
          </Text>
        </View>
        {switchable ? <Ionicons name="chevron-down-outline" size={20} color={tokens.color.brandStrong} /> : null}
      </Pressable>
      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}
            accessibilityRole="button" accessibilityLabel={translate(locale, "action.back")} />
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={[styles.sheetHeading, rtl && styles.rtlRow]}>
              <Text style={[styles.sheetTitle, rtl && styles.rtlText]}>
                {translate(locale, "parent.switchChild")}
              </Text>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button"
                accessibilityLabel={translate(locale, "action.back")} style={styles.closeButton}>
                <Ionicons name="close" size={23} color={tokens.color.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.childrenScroll}>
              {childrenList.map((child) => {
                const active = child.student.id === selectedChildId;
                return (
                  <Pressable
                    key={child.student.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${child.student.fullName}, ${child.classSection.name}`}
                    style={({ pressed }) => [
                      styles.option, rtl && styles.rtlRow, active && styles.optionActive,
                      pressed && styles.pressed
                    ]}
                    onPress={() => { setOpen(false); onSelect(child.student.id); }}
                  >
                    <View style={[styles.optionAvatar, active && styles.optionAvatarSelected]}>
                      <Text style={styles.avatarText}>{child.student.fullName.slice(0, 1)}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.childName, rtl && styles.rtlText]}>{child.student.fullName}</Text>
                      <Text style={[styles.muted, rtl && styles.rtlText]}>
                        {child.classSection.name} · {child.classSection.code}
                      </Text>
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={22} color={tokens.color.brandStrong} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function ParentSectionTabs({
  tabs, selected, onSelect, locale
}: {
  tabs: Array<{ key: string; label: TranslationKey }>;
  selected: string;
  onSelect: (key: string) => void;
  locale: SupportedLocale;
}) {
  const rtl = getDirection(locale) === "rtl";
  const scrollable = tabs.length > 3;
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  useEffect(() => {
    if (scrollable && positions.current[selected] !== undefined) {
      scrollRef.current?.scrollTo({
        x: Math.max(0, positions.current[selected]! - 12), animated: true
      });
    }
  }, [selected, locale, scrollable]);

  const items = tabs.map(tab => {
    const active = selected === tab.key;
    return (
      <Pressable key={tab.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={translate(locale, tab.label)}
        onLayout={scrollable ? event => {
          const x = event.nativeEvent.layout.x;
          positions.current[tab.key] = x;
          if (active) scrollRef.current?.scrollTo({ x: Math.max(0,x-12),animated: false });
        } : undefined}
        style={({ pressed }) => [
          styles.tab, scrollable && styles.tabScrollable,
          active && styles.tabSelected, pressed && styles.pressed
        ]}
        onPress={() => onSelect(tab.key)}>
        <Text numberOfLines={1} adjustsFontSizeToFit
          style={[styles.tabLabel, active && styles.tabLabelSelected]}>
          {translate(locale, tab.label)}
        </Text>
      </Pressable>
    );
  });
  return (
    <View accessibilityRole="tablist">
      {scrollable ? (
        <ScrollView horizontal ref={scrollRef} showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabs, styles.scrollTabs, rtl && styles.rtlRow]}>
          {items}
        </ScrollView>
      ) : (
        <View style={[styles.tabs, rtl && styles.rtlRow]}>{items}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.76 },
  childCard: {
    backgroundColor: tokens.color.surface, paddingHorizontal: 14, paddingVertical: 10,
    minHeight: 64, borderRadius: 18, borderWidth: 1, borderColor: "#d9e4f1",
    flexDirection: "row", alignItems: "center", gap: 11
  },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#edf3ff",
    justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontWeight: "800", color: tokens.color.brandStrong },
  childName: { color: tokens.color.text, fontWeight: "800", fontSize: 15 },
  muted: { color: tokens.color.textMuted, fontSize: 12.5, lineHeight: 19 },
  overlay: {
    flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)"
  },
  sheet: {
    maxHeight: "70%", backgroundColor: tokens.color.surface, padding: 18,
    paddingBottom: 26, borderTopLeftRadius: 24, borderTopRightRadius: 24
  },
  sheetHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: tokens.color.text, flex: 1 },
  closeButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  childrenScroll: { marginTop: 10 },
  option: { flexDirection: "row", gap: 11, alignItems: "center", minHeight: 70,
    paddingVertical: 9, paddingHorizontal: 10, borderRadius: 14 },
  optionActive: { backgroundColor: "#eef5ff" },
  optionAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#edf3ff",
    alignItems: "center", justifyContent: "center" },
  optionAvatarSelected: { backgroundColor: "#d4e4ff" },
  tabs: { flexDirection: "row", gap: 4, padding: 4, backgroundColor: "#eef3f9",
    borderColor: "#dae5f2", borderWidth: 1, borderRadius: 14 },
  tab: { flex: 1, minWidth: 0, minHeight: 46, alignItems: "center",
    justifyContent: "center", borderRadius: 10, paddingHorizontal: 5 },
  tabSelected: { backgroundColor: tokens.color.surface, borderColor: "#d3e2f2", borderWidth: 1 },
  scrollTabs: { minWidth: "100%", alignItems: "stretch" },
  tabScrollable: { flexGrow: 0, flexShrink: 0, minWidth: 109, paddingHorizontal: 12 },
  tabLabel: { textAlign: "center", fontSize: 12, fontWeight: "700", color: tokens.color.textMuted },
  tabLabelSelected: { fontWeight: "900", color: tokens.color.brandStrong }
});
