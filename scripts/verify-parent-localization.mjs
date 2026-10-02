import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const app = read("apps/mobile/App.tsx");
const navigation = read("apps/mobile/src/parent-navigation.tsx");
const dashboard = read("apps/mobile/src/parent-dashboard.tsx");
const localization = read("packages/localization/src/index.ts");

const requireText = (source, marker, message) => {
  if (!source.includes(marker)) throw new Error(message + ": " + marker);
};

const forbidText = (source, marker, message) => {
  if (source.includes(marker)) throw new Error(message + ": " + marker);
};

requireText(app, 'useState<SupportedLocale>("fa-AF")', "Dari first-run default is missing");
requireText(app, "loadPreferredLocale()", "Saved locale restore is missing");
requireText(app, "savePreferredLocale(value)", "Locale persistence is missing");
requireText(app, "formatLocalizedDate(day.date, locale)", "Parent attendance date localization is missing");
requireText(app, "identifierValue: { writingDirection: \"ltr\"", "LTR identifier protection is missing");

requireText(navigation, "bottomBarRtl", "Direction-aware Parent bottom navigation is missing");
forbidText(navigation, "[...tabs].reverse()", "Parent tabs must not be manually array-reversed");
requireText(navigation, "formatLocalizedDate(item.homework.dueAt, locale)", "Homework due-date localization is missing");
requireText(navigation, "formatLocalizedDate(item.publishAt, locale)", "Announcement date localization is missing");
requireText(navigation, "feeStatusKey[item.invoice.status]", "Localized fee status mapping is missing");
requireText(navigation, "paymentKindKey[payment.kind]", "Localized fee payment kind mapping is missing");
requireText(navigation, "formatAfn(", "Localized AFN display is missing");
forbidText(navigation, "· {item.invoice.status}", "Raw fee enum leaked into Parent UI");
forbidText(navigation, "· {payment.kind}", "Raw payment enum leaked into Parent UI");

requireText(dashboard, "formatLocalizedTimeRange(", "Dashboard timetable localization is missing");
requireText(dashboard, "formatLocalizedNumber(", "Dashboard number localization is missing");
requireText(dashboard, "formatLocalizedDate(", "Dashboard date localization is missing");
requireText(dashboard, "formatAfn(", "Dashboard AFN localization is missing");

for (const marker of [
  '"fees.statusDraft"',
  '"fees.statusIssued"',
  '"fees.statusPartiallyPaid"',
  '"fees.statusPaid"',
  '"fees.statusOverdue"',
  '"fees.statusCancelled"',
  '"fees.payment"',
  '"fees.reversal"'
]) {
  requireText(localization, marker, "Required fee localization key is missing");
}
requireText(localization, 'calendar = locale === "en" ? "gregory" : "persian"', "Solar Hijri display calendar rule is missing");

console.log("Parent localization verified: Dari default, persisted language choice, RTL-aware navigation, Solar Hijri RTL dates, localized numbers/AFN, protected identifiers, and no raw fee enums.");
