import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  getDirection,
  translate,
  type SupportedLocale
} from "@maktablink/localization";
import type {
  AnnouncementPayload,
  FeeInvoiceViewPayload,
  LearnerAcademicPayload
} from "./api";

export type ParentTab = "HOME" | "HOMEWORK" | "ANNOUNCEMENTS" | "MORE";

type TextDirectionStyle = {
  textAlign: "right" | "left";
  writingDirection: "rtl" | "ltr";
};

export function ParentBottomNavigation({
  activeTab,
  locale,
  onSelect
}: {
  activeTab: ParentTab;
  locale: SupportedLocale;
  onSelect: (tab: ParentTab) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const tabs: Array<{
    key: ParentTab;
    label: "parent.navHome" | "parent.navHomework" | "parent.navAnnouncements" | "parent.navMore";
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  }> = [
    { key: "HOME", label: "parent.navHome", icon: "home-outline", activeIcon: "home" },
    { key: "HOMEWORK", label: "parent.navHomework", icon: "document-text-outline", activeIcon: "document-text" },
    { key: "ANNOUNCEMENTS", label: "parent.navAnnouncements", icon: "megaphone-outline", activeIcon: "megaphone" },
    { key: "MORE", label: "parent.navMore", icon: "grid-outline", activeIcon: "grid" }
  ];

  const ordered = rtl ? [...tabs].reverse() : tabs;

  return (
    <View style={styles.bottomBar} accessibilityRole="tablist">
      {ordered.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={translate(locale, tab.label)}
            onPress={() => onSelect(tab.key)}
            style={({ pressed }) => [
              styles.bottomTab,
              active && styles.bottomTabActive,
              pressed && styles.pressed
            ]}
          >
            <Ionicons
              name={active ? tab.activeIcon : tab.icon}
              size={21}
              color={active ? tokens.color.brandStrong : tokens.color.textMuted}
            />
            <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>
              {translate(locale, tab.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ParentHomeworkContent({
  learning,
  locale,
  textDirection
}: {
  learning: LearnerAcademicPayload | null;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  if (!learning) return <ActivityIndicator color={tokens.color.brand} />;

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.iconShell}>
          <Ionicons name="document-text-outline" size={20} color={tokens.color.brandStrong} />
        </View>
        <Text style={[styles.sectionTitle, textDirection]}>
          {translate(locale, "learning.publishedHomework")}
        </Text>
      </View>

      {learning.homework.map((item) => (
        <View key={item.homework.id} style={styles.listItem}>
          <Text style={[styles.itemTitle, textDirection]}>{item.homework.title}</Text>
          <Text style={[styles.muted, textDirection]}>
            {item.subjectName} · {translate(locale, "learning.due")} {item.homework.dueAt.slice(0, 10)}
          </Text>
          <Text style={[styles.body, textDirection]}>{item.homework.content}</Text>
          {item.homework.attachmentUrl ? (
            <Text style={[styles.linkText, textDirection]}>{item.homework.attachmentUrl}</Text>
          ) : null}
        </View>
      ))}

      {learning.homework.length === 0 ? (
        <Text style={[styles.muted, textDirection]}>
          {translate(locale, "learning.noPublishedHomework")}
        </Text>
      ) : null}
    </View>
  );
}

export function ParentAnnouncementsContent({
  announcements,
  classId,
  ready,
  locale,
  textDirection
}: {
  announcements: AnnouncementPayload[];
  classId: string;
  ready: boolean;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  const rtl = getDirection(locale) === "rtl";
  const visible = announcements.filter(
    (item) => item.audienceScope !== "CLASS" || item.classId === classId
  );

  if (!ready) return <ActivityIndicator color={tokens.color.brand} />;

  return (
    <View style={styles.card}>
      <View style={[styles.headingRow, rtl && styles.rowRtl]}>
        <View style={styles.iconShell}>
          <Ionicons name="megaphone-outline" size={20} color={tokens.color.brandStrong} />
        </View>
        <Text style={[styles.sectionTitle, textDirection]}>
          {translate(locale, "communication.announcements")}
        </Text>
      </View>

      {visible.slice(0, 20).map((item) => (
        <View key={item.id} style={styles.listItem}>
          <Text style={[styles.itemTitle, textDirection]}>{item.title}</Text>
          <Text style={[styles.body, textDirection]}>{item.content}</Text>
          <Text style={[styles.muted, textDirection]}>{item.publishAt.slice(0, 10)}</Text>
        </View>
      ))}

      {visible.length === 0 ? (
        <Text style={[styles.muted, textDirection]}>
          {translate(locale, "communication.noAnnouncements")}
        </Text>
      ) : null}
    </View>
  );
}

export function ParentMoreAcademicContent({
  learning,
  fees,
  communicationReady,
  locale,
  textDirection
}: {
  learning: LearnerAcademicPayload | null;
  fees: FeeInvoiceViewPayload[];
  communicationReady: boolean;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  const rtl = getDirection(locale) === "rtl";
  const outstanding = fees.reduce((sum, item) => sum + item.outstanding, 0);

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}>
            <Ionicons name="ribbon-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <Text style={[styles.sectionTitle, textDirection]}>
            {translate(locale, "learning.publishedResults")}
          </Text>
        </View>

        {!learning ? <ActivityIndicator color={tokens.color.brand} /> : null}
        {learning?.results.map((item) => (
          <View key={item.grade.id} style={[styles.resultRow, rtl && styles.rowRtl]}>
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, textDirection]}>
                {item.exam.name} · {item.subjectName}
              </Text>
              <Text style={[styles.muted, textDirection]}>{item.className}</Text>
              {item.grade.remark ? (
                <Text style={[styles.body, textDirection]}>{item.grade.remark}</Text>
              ) : null}
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>
                {item.grade.score}/{item.examSubject.maxScore}
              </Text>
            </View>
          </View>
        ))}
        {learning && learning.results.length === 0 ? (
          <Text style={[styles.muted, textDirection]}>
            {translate(locale, "learning.noPublishedResults")}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}>
            <Ionicons name="wallet-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "fees.title")}</Text>
            <Text style={[styles.muted, textDirection]}>
              {translate(locale, "fees.outstanding")} · AFN {outstanding}
            </Text>
          </View>
        </View>

        {!communicationReady ? <ActivityIndicator color={tokens.color.brand} /> : null}
        {communicationReady ? fees.map((item) => (
          <View key={item.invoice.id} style={styles.listItem}>
            <View style={[styles.headingRow, rtl && styles.rowRtl]}>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, textDirection]}>
                  {item.invoice.description || translate(locale, "fees.invoice")}
                </Text>
                <Text style={[styles.muted, textDirection]}>
                  {translate(locale, "fees.due")} {item.invoice.dueDate} · {item.invoice.status}
                </Text>
              </View>
              <Text style={styles.amountText}>AFN {item.outstanding}</Text>
            </View>
            <View style={[styles.moneyRow, rtl && styles.rowRtl]}>
              <Text style={[styles.muted, textDirection]}>
                {translate(locale, "fees.amount")} AFN {item.invoice.amount}
              </Text>
              <Text style={[styles.muted, textDirection]}>
                {translate(locale, "fees.paid")} AFN {item.paid}
              </Text>
            </View>
            {item.payments.length > 0 ? (
              <View style={styles.paymentList}>
                {item.payments.map((payment) => (
                  <Text key={payment.id} style={[styles.muted, textDirection]}>
                    {payment.recordedAt.slice(0, 10)} · {payment.kind} · AFN {payment.amount} · {payment.method}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        )) : null}
        {communicationReady && fees.length === 0 ? (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "fees.none")}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: "#dfe6f0",
    shadowColor: "#172033",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10
  },
  bottomTab: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 14
  },
  bottomTabActive: {
    backgroundColor: "#edf3ff"
  },
  bottomTabText: {
    color: tokens.color.textMuted,
    fontSize: 10.5,
    fontWeight: "700"
  },
  bottomTabTextActive: {
    color: tokens.color.brandStrong,
    fontWeight: "900"
  },
  stack: { gap: 14 },
  card: {
    padding: 16,
    backgroundColor: tokens.color.surface,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    gap: 12
  },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowRtl: { flexDirection: "row-reverse" },
  iconShell: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  sectionTitle: { color: tokens.color.text, fontSize: 16, fontWeight: "900" },
  itemTitle: { color: tokens.color.text, fontSize: 14.5, fontWeight: "900" },
  body: { color: tokens.color.text, fontSize: 13.5, lineHeight: 20 },
  muted: { color: tokens.color.textMuted, fontSize: 12.5, lineHeight: 18 },
  listItem: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#eef1f5" },
  linkText: { color: tokens.color.brandStrong, fontSize: 12, fontWeight: "700" },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#edf0f5"
  },
  flex: { flex: 1, gap: 3 },
  scoreBadge: {
    minWidth: 65,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#edf3ff",
    alignItems: "center"
  },
  scoreText: { color: tokens.color.brandStrong, fontWeight: "900", fontSize: 13 },
  amountText: { color: tokens.color.brandStrong, fontSize: 13, fontWeight: "900" },
  moneyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8
  },
  paymentList: { gap: 3, paddingTop: 5 },
  pressed: { opacity: 0.72 }
});
