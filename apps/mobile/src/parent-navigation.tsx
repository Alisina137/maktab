import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatAfn,
  formatLocalizedDate,
  formatLocalizedNumber,
  getDirection,
  translate,
  type SupportedLocale,
  type TranslationKey
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

const feeStatusKey: Record<FeeInvoiceViewPayload["invoice"]["status"], TranslationKey> = {
  DRAFT: "fees.statusDraft",
  ISSUED: "fees.statusIssued",
  PARTIALLY_PAID: "fees.statusPartiallyPaid",
  PAID: "fees.statusPaid",
  OVERDUE: "fees.statusOverdue",
  CANCELLED: "fees.statusCancelled"
};

const paymentKindKey: Record<FeeInvoiceViewPayload["payments"][number]["kind"], TranslationKey> = {
  PAYMENT: "fees.payment",
  REVERSAL: "fees.reversal"
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

  return (
    <View style={[styles.bottomBar, rtl && styles.bottomBarRtl]} accessibilityRole="tablist">
      {tabs.map((tab) => {
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
            <View style={[styles.navIconShell, active && styles.navIconShellActive]}>
              <Ionicons
                name={active ? tab.activeIcon : tab.icon}
                size={20}
                color={active ? tokens.color.brandStrong : tokens.color.textMuted}
              />
            </View>
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
  const rtl = getDirection(locale) === "rtl";
  if (!learning) return <ParentLoadingCard locale={locale} />;

  return (
    <View style={styles.card}>
      <View style={[styles.headingRow, rtl && styles.rowRtl]}>
        <View style={styles.iconShell}>
          <Ionicons name="document-text-outline" size={20} color={tokens.color.brandStrong} />
        </View>
        <Text style={[styles.sectionTitle, textDirection]}>
          {translate(locale, "learning.publishedHomework")}
        </Text>
      </View>

      {learning.homework.map((item) => (
        <View key={item.homework.id} style={styles.contentItem}>
          <Text style={[styles.itemTitle, textDirection]}>{item.homework.title}</Text>
          <Text style={[styles.muted, textDirection]}>
            {item.subjectName} · {translate(locale, "learning.due")} {formatLocalizedDate(item.homework.dueAt, locale)}
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

  if (!ready) return <ParentLoadingCard locale={locale} />;

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
        <View key={item.id} style={styles.contentItem}>
          <View style={[styles.contentMetaRow, rtl && styles.rowRtl]}>
            <View style={styles.miniIconShell}>
              <Ionicons name="megaphone-outline" size={15} color={tokens.color.brandStrong} />
            </View>
            <Text style={[styles.itemTitle, styles.flex, textDirection]}>{item.title}</Text>
          </View>
          <Text style={[styles.body, textDirection]}>{item.content}</Text>
          <View style={[styles.datePill, rtl && styles.selfEndRtl]}>
            <Ionicons name="calendar-outline" size={13} color={tokens.color.textMuted} />
            <Text style={styles.datePillText}>{formatLocalizedDate(item.publishAt, locale)}</Text>
          </View>
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
          <View key={item.grade.id} style={[styles.resultCard, rtl && styles.rowRtl]}>
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
                {formatLocalizedNumber(item.grade.score, locale)}/{formatLocalizedNumber(item.examSubject.maxScore, locale)}
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
              {translate(locale, "fees.outstanding")} · {formatAfn(outstanding, locale)}
            </Text>
          </View>
        </View>

        {!communicationReady ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color={tokens.color.brand} />
            <Text style={styles.inlineLoadingText}>{translate(locale, "common.loading")}</Text>
          </View>
        ) : null}
        {communicationReady ? fees.map((item) => (
          <View key={item.invoice.id} style={styles.contentItem}>
            <View style={[styles.headingRow, rtl && styles.rowRtl]}>
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, textDirection]}>
                  {item.invoice.description || translate(locale, "fees.invoice")}
                </Text>
                <Text style={[styles.muted, textDirection]}>
                  {translate(locale, "fees.due")} {formatLocalizedDate(item.invoice.dueDate, locale)} · {translate(locale, feeStatusKey[item.invoice.status])}
                </Text>
              </View>
              <Text style={styles.amountText}>{formatAfn(item.outstanding, locale)}</Text>
            </View>
            <View style={[styles.moneyRow, rtl && styles.rowRtl]}>
              <Text style={[styles.muted, textDirection]}>
                {translate(locale, "fees.amount")} {formatAfn(item.invoice.amount, locale)}
              </Text>
              <Text style={[styles.muted, textDirection]}>
                {translate(locale, "fees.paid")} {formatAfn(item.paid, locale)}
              </Text>
            </View>
            {item.payments.length > 0 ? (
              <View style={styles.paymentList}>
                {item.payments.map((payment) => (
                  <View key={payment.id} style={[styles.paymentRow, rtl && styles.rowRtl]}>
                    <View style={styles.flex}>
                      <Text style={[styles.paymentKind, textDirection]}>
                        {translate(locale, paymentKindKey[payment.kind])}
                      </Text>
                      <Text style={[styles.muted, textDirection]}>
                        {formatLocalizedDate(payment.recordedAt, locale)} · {payment.method}
                      </Text>
                    </View>
                    <Text style={styles.paymentAmount}>{formatAfn(payment.amount, locale)}</Text>
                  </View>
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

function ParentLoadingCard({ locale }: { locale: SupportedLocale }) {
  const rtl = getDirection(locale) === "rtl";
  return (
    <View style={styles.loadingCard}>
      <View style={[styles.inlineLoading, rtl && styles.rowRtl]}>
        <ActivityIndicator size="small" color={tokens.color.brand} />
        <Text style={styles.inlineLoadingText}>{translate(locale, "common.loading")}</Text>
      </View>
      <View style={styles.loadingLineWide} />
      <View style={styles.loadingLineShort} />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 9,
    gap: 3,
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    shadowColor: "#172033",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: 12
  },
  bottomBarRtl: { flexDirection: "row-reverse" },
  bottomTab: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 16
  },
  bottomTabActive: {
    backgroundColor: "#f3f6fc"
  },
  navIconShell: {
    width: 32,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  navIconShellActive: {
    backgroundColor: "#e7efff"
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
    padding: 17,
    backgroundColor: tokens.color.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    gap: 13,
    shadowColor: "#172033",
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1
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
  contentItem: {
    gap: 8,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8edf4",
    backgroundColor: "#f9fbfe"
  },
  contentMetaRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  miniIconShell: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  datePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#eef2f7"
  },
  selfEndRtl: { alignSelf: "flex-end" },
  datePillText: { color: tokens.color.textMuted, fontSize: 11, fontWeight: "700" },
  linkText: { color: tokens.color.brandStrong, fontSize: 12, fontWeight: "700" },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8edf4",
    backgroundColor: "#f9fbfe"
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
  paymentList: { gap: 6, paddingTop: 5 },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#eef1f5"
  },
  paymentKind: { color: tokens.color.text, fontSize: 12.5, fontWeight: "800" },
  paymentAmount: { color: tokens.color.brandStrong, fontSize: 12, fontWeight: "900" },
  inlineLoading: { flexDirection: "row", alignItems: "center", gap: 9 },
  inlineLoadingText: { color: tokens.color.textMuted, fontSize: 12.5, fontWeight: "700" },
  loadingCard: {
    padding: 17,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    gap: 11
  },
  loadingLineWide: { height: 11, width: "78%", borderRadius: 999, backgroundColor: "#edf1f6" },
  loadingLineShort: { height: 11, width: "48%", borderRadius: 999, backgroundColor: "#edf1f6" },
  pressed: { opacity: 0.72 }
});
