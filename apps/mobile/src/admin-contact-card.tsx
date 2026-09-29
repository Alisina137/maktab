import { useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  getDirection,
  translate,
  type SupportedLocale
} from "@maktablink/localization";
import type { AdminContactPayload } from "./api";

function whatsappUrl(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

export function AdminContactCard({
  contact,
  locale
}: {
  contact: AdminContactPayload | null;
  locale: SupportedLocale;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const direction = getDirection(locale);
  const textDirection = {
    textAlign: direction === "rtl" ? ("right" as const) : ("left" as const),
    writingDirection: direction
  };
  const rowDirection = direction === "rtl" ? styles.rowRtl : undefined;

  if (!contact) {
    return (
      <View style={styles.card}>
        <View style={[styles.header, rowDirection]}>
          <View style={styles.iconShell}>
            <Ionicons name="help-buoy-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, textDirection]}>{translate(locale, "contact.adminTitle")}</Text>
            <Text style={[styles.muted, textDirection]}>{translate(locale, "contact.noDetails")}</Text>
          </View>
        </View>
      </View>
    );
  }

  const hasActions = Boolean(contact.email || contact.whatsapp || contact.phone);
  const whatsapp = contact.whatsapp ? whatsappUrl(contact.whatsapp) : "";

  return (
    <View style={styles.card}>
      <View style={[styles.header, rowDirection]}>
        <View style={styles.avatar}>
          {contact.imageUrl && !imageFailed ? (
            <Image
              source={{ uri: contact.imageUrl }}
              style={styles.avatarImage}
              onError={() => setImageFailed(true)}
              accessibilityLabel={contact.fullName}
            />
          ) : (
            <Text style={styles.avatarText}>{contact.fullName.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, textDirection]}>{translate(locale, "contact.adminTitle")}</Text>
          <Text style={[styles.name, textDirection]}>{contact.fullName}</Text>
          {contact.jobTitle ? <Text style={[styles.titleText, textDirection]}>{contact.jobTitle}</Text> : null}
        </View>
      </View>

      {contact.bio ? <Text style={[styles.bio, textDirection]}>{contact.bio}</Text> : null}

      {(contact.officeLocation || contact.officeHours) ? (
        <View style={styles.details}>
          {contact.officeLocation ? (
            <View style={[styles.detailRow, rowDirection]}>
              <Ionicons name="location-outline" size={17} color={tokens.color.textMuted} />
              <Text style={[styles.detailText, textDirection]}>
                {translate(locale, "contact.office")}: {contact.officeLocation}
              </Text>
            </View>
          ) : null}
          {contact.officeHours ? (
            <View style={[styles.detailRow, rowDirection]}>
              <Ionicons name="time-outline" size={17} color={tokens.color.textMuted} />
              <Text style={[styles.detailText, textDirection]}>
                {translate(locale, "contact.hours")}: {contact.officeHours}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {hasActions ? (
        <View style={[styles.actions, rowDirection]}>
          {contact.email ? (
            <ContactButton
              icon="mail-outline"
              label={translate(locale, "contact.email")}
              onPress={() => void Linking.openURL(`mailto:${contact.email}`)}
            />
          ) : null}
          {whatsapp ? (
            <ContactButton
              icon="logo-whatsapp"
              label={translate(locale, "contact.whatsapp")}
              onPress={() => void Linking.openURL(whatsapp)}
            />
          ) : null}
          {contact.phone ? (
            <ContactButton
              icon="call-outline"
              label={translate(locale, "contact.phone")}
              onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
            />
          ) : null}
        </View>
      ) : (
        <Text style={[styles.muted, textDirection]}>{translate(locale, "contact.adminHint")}</Text>
      )}
    </View>
  );
}

function ContactButton({
  icon,
  label,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={tokens.color.brandStrong} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    gap: 13
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  rowRtl: {
    flexDirection: "row-reverse"
  },
  iconShell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef3ff"
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 19,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8efff"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarText: {
    color: tokens.color.brandStrong,
    fontSize: 22,
    fontWeight: "900"
  },
  copy: {
    flex: 1,
    gap: 2
  },
  eyebrow: {
    color: tokens.color.brandStrong,
    fontSize: 11,
    fontWeight: "800"
  },
  name: {
    color: tokens.color.text,
    fontSize: 17,
    fontWeight: "900"
  },
  title: {
    color: tokens.color.text,
    fontSize: 15,
    fontWeight: "900"
  },
  titleText: {
    color: tokens.color.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  muted: {
    color: tokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  bio: {
    color: tokens.color.text,
    fontSize: 12.5,
    lineHeight: 20
  },
  details: {
    gap: 8
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  detailText: {
    flex: 1,
    color: tokens.color.textMuted,
    fontSize: 12
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  action: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#dce5f5",
    backgroundColor: "#f7f9ff",
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  actionPressed: {
    opacity: 0.7
  },
  actionText: {
    color: tokens.color.brandStrong,
    fontSize: 12,
    fontWeight: "800"
  }
});
