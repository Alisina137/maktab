import { formatAdminHijriDateTime } from "./admin-hijri-date-picker";
import type { AdminLocale } from "./admin-i18n";

// Pilot Operations always displays the same Kabul civil instant.
// English: Gregorian with AM/PM. Dari/Pashto: Solar Hijri in RTL.
export function formatPilotTimestamp(locale: AdminLocale, input: string): string {
  if (!input) return "";
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return "";
  if (locale !== "en") return formatAdminHijriDateTime(locale, input, "Asia/Kabul");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul", dateStyle: "medium",
    timeStyle: "short", hour12: true
  }).format(parsed);
}
