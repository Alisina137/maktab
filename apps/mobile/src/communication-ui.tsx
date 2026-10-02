import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  getDirection,
  translate,
  type SupportedLocale,
  type TranslationKey
} from "@maktablink/localization";
import {
  api,
  type AnnouncementPayload,
  type FeeInvoiceViewPayload,
  type ParentNotification
} from "./api";
import { appErrorFromCause, type AppErrorKind } from "./error-message";

type TextDirectionStyle = {
  textAlign: "right" | "left";
  writingDirection: "rtl" | "ltr";
};

type Props = {
  accessToken: string;
  mode: "PARENT" | "TEACHER" | "STUDENT";
  studentId?: string;
  selectedClassId?: string;
  supervisedClasses?: Array<{ classId: string; className: string; classCode: string }>;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
  onError: (key: TranslationKey | null, kind?: AppErrorKind) => void;
  onNotice: (message: string | null) => void;
  onLoaded?: (data: { announcements: AnnouncementPayload[]; fees: FeeInvoiceViewPayload[] }) => void;
};

export function CommunicationPanel({
  accessToken,
  mode,
  studentId,
  selectedClassId,
  supervisedClasses = [],
  locale,
  textDirection,
  onError,
  onNotice,
  onLoaded
}: Props) {
  const rtl = getDirection(locale) === "rtl";
  const [announcements, setAnnouncements] = useState<AnnouncementPayload[]>([]);
  const [fees, setFees] = useState<FeeInvoiceViewPayload[]>([]);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const loadRequestId = useRef(0);

  useEffect(() => {
    const requestId = ++loadRequestId.current;
    void load(requestId);
    return () => {
      if (loadRequestId.current === requestId) loadRequestId.current += 1;
    };
  }, [accessToken, mode, studentId]);

  useEffect(() => {
    if (mode === "TEACHER") {
      setClassId((current) =>
        supervisedClasses.some((item) => item.classId === current)
          ? current
          : supervisedClasses[0]?.classId ?? ""
      );
    }
  }, [mode, supervisedClasses.map((item) => item.classId).join("|")]);

  async function load(requestId: number) {
    setBusy(true);
    try {
      let loadedAnnouncements: AnnouncementPayload[] = [];
      let loadedFees: FeeInvoiceViewPayload[] = [];
      const tasks: Array<Promise<unknown>> = [
        api.announcements(accessToken).then((result) => {
          loadedAnnouncements = result.announcements;
        })
      ];
      if (mode === "PARENT" && studentId) {
        tasks.push(
          api.parentFees(accessToken, studentId).then((result) => {
            loadedFees = result.invoices;
          })
        );
      }
      if (mode === "STUDENT") {
        tasks.push(
          api.studentFees(accessToken).then((result) => {
            loadedFees = result.invoices;
          })
        );
      }
      let loadedNotifications: ParentNotification[] | null = null;
      if (mode !== "PARENT") {
        tasks.push(
          api.notifications(accessToken).then((result) => {
            loadedNotifications = result.notifications;
          })
        );
      }
      await Promise.all(tasks);
      if (requestId !== loadRequestId.current) return;
      setAnnouncements(loadedAnnouncements);
      setFees(loadedFees);
      if (loadedNotifications) setNotifications(loadedNotifications);
      onLoaded?.({ announcements: loadedAnnouncements, fees: loadedFees });
    } catch (cause) {
      if (requestId !== loadRequestId.current) return;
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      if (requestId === loadRequestId.current) setBusy(false);
    }
  }

  async function postAnnouncement() {
    if (!classId || !title.trim() || !content.trim()) {
      onError("communication.completeAnnouncement");
      return;
    }
    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      await api.createTeacherAnnouncement(accessToken, {
        classId,
        title: title.trim(),
        content: content.trim()
      });
      setTitle("");
      setContent("");
      onNotice(translate(locale, "communication.announcementSent"));
      await load(++loadRequestId.current);
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
    }
  }

  async function markRead(notificationId: string) {
    try {
      const result = await api.markNotificationRead(accessToken, notificationId);
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? result.notification : item))
      );
    } catch {
      // A read marker can be retried on refresh; it must not block the screen.
    }
  }

  const feeTotals = useMemo(
    () => fees.reduce(
      (total, item) => ({
        amount: total.amount + item.invoice.amount,
        paid: total.paid + item.paid,
        outstanding: total.outstanding + item.outstanding
      }),
      { amount: 0, paid: 0, outstanding: 0 }
    ),
    [fees]
  );

  const visibleAnnouncements = useMemo(
    () =>
      mode === "PARENT" && selectedClassId
        ? announcements.filter(
            (item) => item.audienceScope !== "CLASS" || item.classId === selectedClassId
          )
        : announcements,
    [announcements, mode, selectedClassId]
  );

  return (
    <View style={styles.stack}>
      {mode === "TEACHER" && supervisedClasses.length > 0 ? (
        <View style={styles.card}>
          <View style={[styles.headingRow, rtl && styles.rowRtl]}>
            <View style={styles.iconShell}>
              <Ionicons name="megaphone-outline" size={20} color={tokens.color.brandStrong} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "communication.classAnnouncement")}</Text>
              <Text style={[styles.muted, textDirection]}>{translate(locale, "communication.negaranOnly")}</Text>
            </View>
          </View>
          <View style={[styles.chips, rtl && styles.rowRtl]}>
            {supervisedClasses.map((item) => (
              <Pressable
                key={item.classId}
                onPress={() => setClassId(item.classId)}
                style={[styles.chip, classId === item.classId && styles.chipActive]}
              >
                <Text style={classId === item.classId ? styles.chipTextActive : styles.chipText}>
                  {item.classCode}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={translate(locale, "communication.title")}
            style={[styles.input, textDirection]}
          />
          <TextInput
            multiline
            value={content}
            onChangeText={setContent}
            placeholder={translate(locale, "communication.message")}
            style={[styles.input, styles.multiline, textDirection]}
          />
          <Pressable
            disabled={busy}
            onPress={() => void postAnnouncement()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.primaryText}>{translate(locale, "communication.publish")}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}>
            <Ionicons name="megaphone-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "communication.announcements")}</Text>
        </View>
        {visibleAnnouncements.slice(0, 10).map((item) => (
          <View key={item.id} style={styles.listItem}>
            <Text style={[styles.itemTitle, textDirection]}>{item.title}</Text>
            <Text style={[styles.body, textDirection]}>{item.content}</Text>
            <Text style={[styles.muted, textDirection]}>{item.publishAt.slice(0, 10)}</Text>
          </View>
        ))}
        {visibleAnnouncements.length === 0 ? (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "communication.noAnnouncements")}</Text>
        ) : null}
      </View>

      {mode !== "TEACHER" ? (
        <View style={styles.card}>
          <View style={[styles.headingRow, rtl && styles.rowRtl]}>
            <View style={styles.iconShell}>
              <Ionicons name="wallet-outline" size={20} color={tokens.color.brandStrong} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "fees.title")}</Text>
              <Text style={[styles.muted, textDirection]}>
                {translate(locale, "fees.outstanding")} · AFN {feeTotals.outstanding}
              </Text>
            </View>
          </View>
          {fees.map((item) => (
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
                <Text style={[styles.muted, textDirection]}>{translate(locale, "fees.amount")} AFN {item.invoice.amount}</Text>
                <Text style={[styles.muted, textDirection]}>{translate(locale, "fees.paid")} AFN {item.paid}</Text>
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
          ))}
          {fees.length === 0 ? (
            <Text style={[styles.muted, textDirection]}>{translate(locale, "fees.none")}</Text>
          ) : null}
        </View>
      ) : null}

      {mode !== "PARENT" ? (
        <View style={styles.card}>
          <View style={[styles.headingRow, rtl && styles.rowRtl]}>
            <View style={styles.iconShell}>
              <Ionicons name="notifications-outline" size={20} color={tokens.color.brandStrong} />
            </View>
            <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "notifications.title")}</Text>
          </View>
          {notifications.slice(0, 8).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => void markRead(item.id)}
              style={[styles.notification, !item.readAt && styles.notificationUnread]}
            >
              <View style={[styles.headingRow, rtl && styles.rowRtl]}>
                <View style={styles.flex}>
                  <Text style={[styles.itemTitle, textDirection]}>{item.title}</Text>
                  <Text style={[styles.body, textDirection]}>{item.message}</Text>
                </View>
                {!item.readAt ? <View style={styles.unreadDot} /> : null}
              </View>
            </Pressable>
          ))}
          {notifications.length === 0 ? (
            <Text style={[styles.muted, textDirection]}>{translate(locale, "communication.noNotifications")}</Text>
          ) : null}
        </View>
      ) : null}

      {busy ? <ActivityIndicator color={tokens.color.brand} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  flex: { flex: 1, gap: 3 },
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
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    backgroundColor: "#fbfcfe",
    color: tokens.color.text
  },
  multiline: { minHeight: 92, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#dbe3ee" },
  chipActive: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand },
  chipText: { color: tokens.color.text, fontWeight: "800", fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "900", fontSize: 12 },
  primaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: tokens.color.brand },
  primaryText: { color: "#fff", fontWeight: "900" },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  amountText: { color: tokens.color.brandStrong, fontSize: 13, fontWeight: "900" },
  moneyRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  paymentList: { gap: 3, paddingTop: 5 },
  notification: { padding: 10, borderRadius: 13, borderWidth: 1, borderColor: "#edf0f4" },
  notificationUnread: { backgroundColor: "#f0f5ff", borderColor: "#d8e5ff" },
  unreadDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: tokens.color.brand }
});
