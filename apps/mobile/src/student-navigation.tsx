import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import { getDirection, translate, type SupportedLocale, type TranslationKey } from "@maktablink/localization";

export type StudentTab = "HOME" | "TIMETABLE" | "HOMEWORK" | "RESULTS" | "MORE";

const tabs: Array<{
  key: StudentTab;
  label: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "HOME", label: "parent.navHome", icon: "home-outline", activeIcon: "home" },
  { key: "TIMETABLE", label: "student.navTimetable", icon: "calendar-outline", activeIcon: "calendar" },
  { key: "HOMEWORK", label: "parent.navHomework", icon: "document-text-outline", activeIcon: "document-text" },
  { key: "RESULTS", label: "student.resultsTitle", icon: "ribbon-outline", activeIcon: "ribbon" },
  { key: "MORE", label: "parent.navMore", icon: "grid-outline", activeIcon: "grid" }
];

export function StudentBottomNavigation({
  activeTab,
  locale,
  onSelect
}: {
  activeTab: StudentTab;
  locale: SupportedLocale;
  onSelect: (tab: StudentTab) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  return (
    <View accessibilityRole="tablist" style={[styles.bar, rtl && styles.barRtl]}>
      {tabs.map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={translate(locale, tab.label)}
            onPress={() => onSelect(tab.key)}
            style={({ pressed }) => [styles.tab, selected && styles.selectedTab, pressed && styles.pressed]}
          >
            <View style={[styles.iconShell, selected && styles.selectedIcon]}>
              <Ionicons
                name={selected ? tab.activeIcon : tab.icon}
                size={20}
                color={selected ? tokens.color.brandStrong : tokens.color.textMuted}
              />
            </View>
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {translate(locale, tab.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "stretch", paddingHorizontal: 6, paddingTop: 7, paddingBottom: 9, gap: 2, backgroundColor: tokens.color.surface, borderTopWidth: 1, borderTopColor: "#e2e8f0", shadowColor: "#172033", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -5 }, elevation: 12 },
  barRtl: { flexDirection: "row-reverse" },
  tab: { flex: 1, minHeight: 58, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 16 },
  selectedTab: { backgroundColor: "#f3f6fc" },
  iconShell: { width: 32, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  selectedIcon: { backgroundColor: "#e7efff" },
  label: { color: tokens.color.textMuted, fontSize: 9.5, fontWeight: "700", textAlign: "center" },
  selectedLabel: { color: tokens.color.brandStrong, fontWeight: "900" },
  pressed: { opacity: 0.72 }
});
