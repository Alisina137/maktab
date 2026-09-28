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
  | "foundation.design"
  | "auth.chooseRole"
  | "auth.chooseRoleHint"
  | "role.parent"
  | "role.teacher"
  | "role.student"
  | "school.choose"
  | "school.chooseHint"
  | "school.search"
  | "school.noResults"
  | "login.title"
  | "login.hint"
  | "field.username"
  | "field.password"
  | "auth.signIn"
  | "passwordChange.title"
  | "passwordChange.hint"
  | "field.newPassword"
  | "field.confirmPassword"
  | "action.save"
  | "action.back"
  | "action.retry"
  | "home.title"
  | "home.phase2"
  | "home.pending"
  | "parent.homeTitle"
  | "parent.homeSubtitle"
  | "parent.switchChild"
  | "parent.noChildren"
  | "parent.studentCode"
  | "parent.class"
  | "parent.academicYear"
  | "auth.logout"
  | "common.loading"
  | "common.networkError";

const en: Record<TranslationKey, string> = {
  "app.name": "MaktabLink",
  "foundation.eyebrow": "Phase 1 · Product Foundation",
  "foundation.title": "The foundation is ready for school-safe growth.",
  "foundation.subtitle": "Multi-tenant boundaries, localization, shared design tokens, and the base API are established before academic features begin.",
  "foundation.tenant": "Tenant isolation",
  "foundation.localization": "Dari · Pashto · English",
  "foundation.api": "Provisioning API",
  "foundation.design": "Shared design system",
  "auth.chooseRole": "Who are you?",
  "auth.chooseRoleHint": "Choose your role. Your school account still decides what you are allowed to access.",
  "role.parent": "Parent",
  "role.teacher": "Teacher",
  "role.student": "Student",
  "school.choose": "Choose your school",
  "school.chooseHint": "Search for the school that issued your username and temporary password.",
  "school.search": "Search schools",
  "school.noResults": "No active schools found.",
  "login.title": "Sign in",
  "login.hint": "Use the username and password provided by your school.",
  "field.username": "Username",
  "field.password": "Password",
  "auth.signIn": "Sign in",
  "passwordChange.title": "Create your private password",
  "passwordChange.hint": "Your temporary password can only get you this far. Choose a new password that your school cannot see.",
  "field.newPassword": "New password",
  "field.confirmPassword": "Confirm password",
  "action.save": "Save",
  "action.back": "Back",
  "action.retry": "Retry",
  "home.title": "Account ready",
  "home.phase2": "Your school account is authenticated. Academic features will appear in the next phases.",
  "home.pending": "Your school account is authenticated. Features for this role will appear in the relevant implementation phase.",
  "parent.homeTitle": "Parent home",
  "parent.homeSubtitle": "See the students linked to this school account and switch between siblings.",
  "parent.switchChild": "Choose child",
  "parent.noChildren": "No student is linked to your account. Please contact the school administration.",
  "parent.studentCode": "Student code",
  "parent.class": "Class",
  "parent.academicYear": "Academic year",
  "auth.logout": "Log out",
  "common.loading": "Loading…",
  "common.networkError": "Could not connect to the MaktabLink API. Make sure the API is running and your phone can reach this computer."
};

const dari: Record<TranslationKey, string> = {
  "app.name": "MaktabLink",
  "foundation.eyebrow": "مرحله ۱ · زیربنای محصول",
  "foundation.title": "زیربنای برنامه برای رشد امن مکاتب آماده است.",
  "foundation.subtitle": "جداسازی اطلاعات مکاتب، چندزبانه‌بودن، توکن‌های مشترک طراحی و API پایه قبل از آغاز قابلیت‌های درسی ایجاد شده‌اند.",
  "foundation.tenant": "جداسازی اطلاعات مکاتب",
  "foundation.localization": "دری · پشتو · انگلیسی",
  "foundation.api": "API ایجاد مکتب",
  "foundation.design": "سیستم مشترک طراحی",
  "auth.chooseRole": "شما کی هستید؟",
  "auth.chooseRoleHint": "نقش خود را انتخاب کنید. صلاحیت واقعی شما توسط حساب مکتب تعیین می‌شود.",
  "role.parent": "والدین",
  "role.teacher": "استاد",
  "role.student": "شاگرد",
  "school.choose": "مکتب خود را انتخاب کنید",
  "school.chooseHint": "مکتبی را جستجو کنید که نام کاربری و رمز موقت را برای شما داده است.",
  "school.search": "جستجوی مکاتب",
  "school.noResults": "هیچ مکتب فعال یافت نشد.",
  "login.title": "ورود",
  "login.hint": "از نام کاربری و رمز عبوری که مکتب داده است استفاده کنید.",
  "field.username": "نام کاربری",
  "field.password": "رمز عبور",
  "auth.signIn": "ورود",
  "passwordChange.title": "رمز خصوصی خود را بسازید",
  "passwordChange.hint": "رمز موقت فقط برای اولین ورود است. رمزی انتخاب کنید که مکتب آن را نمی‌بیند.",
  "field.newPassword": "رمز جدید",
  "field.confirmPassword": "تکرار رمز",
  "action.save": "ذخیره",
  "action.back": "برگشت",
  "action.retry": "تلاش دوباره",
  "home.title": "حساب آماده است",
  "home.phase2": "حساب مکتب شما تأیید شد. امکانات درسی در مراحل بعدی اضافه می‌شوند.",
  "home.pending": "حساب مکتب شما تأیید شده است. امکانات این نقش در مرحله مربوط آن اضافه می‌شوند.",
  "parent.homeTitle": "خانه والدین",
  "parent.homeSubtitle": "شاگردانی را که به حساب این مکتب شما متصل اند ببینید و میان فرزندان جابه‌جا شوید.",
  "parent.switchChild": "انتخاب فرزند",
  "parent.noChildren": "هیچ شاگردی به حساب شما متصل نشده است. لطفاً با اداره مکتب تماس بگیرید.",
  "parent.studentCode": "کد شاگرد",
  "parent.class": "صنف",
  "parent.academicYear": "سال تعلیمی",
  "auth.logout": "خروج",
  "common.loading": "در حال بارگذاری…",
  "common.networkError": "ارتباط با API برقرار نشد. مطمئن شوید API روشن است و موبایل به این کمپیوتر دسترسی دارد."
};

const pashto: Record<TranslationKey, string> = {
  "app.name": "MaktabLink",
  "foundation.eyebrow": "لومړی پړاو · د محصول بنسټ",
  "foundation.title": "د ښوونځیو د خوندي ودې لپاره بنسټ چمتو دی.",
  "foundation.subtitle": "د ښوونځیو د معلوماتو جلاوالی، ژبې، ګډ ډیزاین توکنونه او بنسټیز API د درسي بڼو له پیل مخکې جوړ شوي دي.",
  "foundation.tenant": "د ښوونځیو د معلوماتو جلاوالی",
  "foundation.localization": "دري · پښتو · انګلیسي",
  "foundation.api": "د ښوونځي جوړولو API",
  "foundation.design": "ګډ ډیزاین سیستم",
  "auth.chooseRole": "تاسو څوک یاست؟",
  "auth.chooseRoleHint": "خپل رول وټاکئ. ستاسو اصلي واک د ښوونځي د حساب له خوا ټاکل کېږي.",
  "role.parent": "مور او پلار",
  "role.teacher": "ښوونکی",
  "role.student": "زده کوونکی",
  "school.choose": "خپل ښوونځی وټاکئ",
  "school.chooseHint": "هغه ښوونځی ولټوئ چې کارن نوم او لنډمهاله پټنوم یې درکړی دی.",
  "school.search": "ښوونځي ولټوئ",
  "school.noResults": "فعال ښوونځی ونه موندل شو.",
  "login.title": "ننوتل",
  "login.hint": "د خپل ښوونځي له خوا ورکړل شوی کارن نوم او پټنوم وکاروئ.",
  "field.username": "کارن نوم",
  "field.password": "پټنوم",
  "auth.signIn": "ننوتل",
  "passwordChange.title": "خپل شخصي پټنوم جوړ کړئ",
  "passwordChange.hint": "لنډمهاله پټنوم یوازې د لومړي ځل لپاره دی. داسې نوی پټنوم وټاکئ چې ښوونځی یې نه ویني.",
  "field.newPassword": "نوی پټنوم",
  "field.confirmPassword": "پټنوم بیا ولیکئ",
  "action.save": "ساتل",
  "action.back": "شاته",
  "action.retry": "بیا هڅه",
  "home.title": "حساب چمتو دی",
  "home.phase2": "ستاسو د ښوونځي حساب تایید شو. درسي ځانګړتیاوې به په راتلونکو پړاوونو کې اضافه شي.",
  "home.pending": "ستاسو د ښوونځي حساب تایید شوی دی. د دې رول ځانګړتیاوې به په اړوند پړاو کې اضافه شي.",
  "parent.homeTitle": "د مور او پلار کور",
  "parent.homeSubtitle": "له دې ښوونځي حساب سره تړلي زده کوونکي وګورئ او د خپلو ماشومانو ترمنځ واوړئ.",
  "parent.switchChild": "ماشوم وټاکئ",
  "parent.noChildren": "ستاسو له حساب سره هېڅ زده کوونکی نه دی تړل شوی. مهرباني وکړئ د ښوونځي له ادارې سره اړیکه ونیسئ.",
  "parent.studentCode": "د زده کوونکي کوډ",
  "parent.class": "ټولګی",
  "parent.academicYear": "تعلیمي کال",
  "auth.logout": "وتل",
  "common.loading": "بارېږي…",
  "common.networkError": "له MaktabLink API سره اړیکه ونه شوه. ډاډ ترلاسه کړئ چې API چلېږي او موبایل دې کمپیوټر ته لاسرسی لري."
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
