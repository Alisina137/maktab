export const supportedLocales = ["fa-AF", "ps-AF", "en"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export type TextDirection = "rtl" | "ltr";

export type TranslationKey =
  | "app.name"
  | "foundation.eyebrow"
  | "foundation.title"
  | "foundation.subtitle"
  | "foundation.tenant"
  | "foundation.localization"
  | "foundation.api"
  | "foundation.design";

const en: Record<TranslationKey, string> = {
  "app.name": "MaktabLink",
  "foundation.eyebrow": "Phase 1 · Product Foundation",
  "foundation.title": "The foundation is ready for school-safe growth.",
  "foundation.subtitle": "Multi-tenant boundaries, localization, shared design tokens, and the base API are established before academic features begin.",
  "foundation.tenant": "Tenant isolation",
  "foundation.localization": "Dari · Pashto · English",
  "foundation.api": "Provisioning API",
  "foundation.design": "Shared design system"
};

const dari: Record<TranslationKey, string> = {
  "app.name": "MaktabLink",
  "foundation.eyebrow": "مرحله ۱ · زیربنای محصول",
  "foundation.title": "زیربنای برنامه برای رشد امن مکاتب آماده است.",
  "foundation.subtitle": "جداسازی اطلاعات مکاتب، چندزبانه‌بودن، توکن‌های مشترک طراحی و API پایه قبل از آغاز قابلیت‌های درسی ایجاد شده‌اند.",
  "foundation.tenant": "جداسازی اطلاعات مکاتب",
  "foundation.localization": "دری · پشتو · انگلیسی",
  "foundation.api": "API ایجاد مکتب",
  "foundation.design": "سیستم مشترک طراحی"
};

const pashto: Record<TranslationKey, string> = {
  "app.name": "MaktabLink",
  "foundation.eyebrow": "لومړی پړاو · د محصول بنسټ",
  "foundation.title": "د ښوونځیو د خوندي ودې لپاره بنسټ چمتو دی.",
  "foundation.subtitle": "د ښوونځیو د معلوماتو جلاوالی، ژبې، ګډ ډیزاین توکنونه او بنسټیز API د درسي بڼو له پیل مخکې جوړ شوي دي.",
  "foundation.tenant": "د ښوونځیو د معلوماتو جلاوالی",
  "foundation.localization": "دري · پښتو · انګلیسي",
  "foundation.api": "د ښوونځي جوړولو API",
  "foundation.design": "ګډ ډیزاین سیستم"
};

export const messages: Record<SupportedLocale, Record<TranslationKey, string>> = {
  "fa-AF": dari,
  "ps-AF": pashto,
  en
};

export function getDirection(locale: SupportedLocale): TextDirection {
  return locale === "en" ? "ltr" : "rtl";
}

export function translate(locale: SupportedLocale, key: TranslationKey): string {
  return messages[locale][key];
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}
