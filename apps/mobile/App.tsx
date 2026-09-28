import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "@maktablink/design-tokens";
import { getDirection, supportedLocales, translate, type SupportedLocale } from "@maktablink/localization";

export default function App() {
  const [locale, setLocale] = useState<SupportedLocale>("fa-AF");
  const direction = getDirection(locale);
  const textStyle = useMemo(() => ({ textAlign: direction === "rtl" ? ("right" as const) : ("left" as const), writingDirection: direction }), [direction]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.languageRow}>
          {supportedLocales.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: item === locale }}
              key={item}
              onPress={() => setLocale(item)}
              style={[styles.languageButton, item === locale && styles.languageButtonActive]}
            >
              <Text style={item === locale ? styles.languageButtonTextActive : styles.languageButtonText}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.eyebrow, textStyle]}>{translate(locale, "foundation.eyebrow")}</Text>
        <Text style={[styles.title, textStyle]}>{translate(locale, "foundation.title")}</Text>
        <Text style={[styles.subtitle, textStyle]}>{translate(locale, "foundation.subtitle")}</Text>

        {["foundation.tenant", "foundation.localization", "foundation.api", "foundation.design"].map((key) => (
          <View key={key} style={styles.card}>
            <Text style={[styles.cardTitle, textStyle]}>{translate(locale, key as Parameters<typeof translate>[1])}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tokens.color.canvas },
  content: { padding: tokens.spacing.xl, gap: tokens.spacing.lg },
  languageRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  languageButton: {
    minHeight: 44,
    paddingHorizontal: tokens.spacing.lg,
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface
  },
  languageButtonActive: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand },
  languageButtonText: { color: tokens.color.text, fontWeight: "600" },
  languageButtonTextActive: { color: "#ffffff", fontWeight: "700" },
  eyebrow: { marginTop: tokens.spacing.lg, color: tokens.color.brandStrong, fontWeight: "800", fontSize: tokens.typography.size.sm },
  title: { color: tokens.color.text, fontWeight: "900", fontSize: tokens.typography.size.xxl, lineHeight: 43 },
  subtitle: { color: tokens.color.textMuted, fontSize: tokens.typography.size.md, lineHeight: 25 },
  card: {
    minHeight: 88,
    justifyContent: "center",
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface
  },
  cardTitle: { color: tokens.color.text, fontSize: tokens.typography.size.lg, fontWeight: "700" }
});
