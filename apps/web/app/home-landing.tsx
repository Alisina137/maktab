"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Locale = "fa-AF" | "ps-AF" | "en";
type IconName = "school" | "family" | "attendance" | "learning" | "messages" | "fees" | "shield" | "arrow" | "check" | "layers" | "users" | "spark";

const languageOptions: { value: Locale; label: string }[] = [
  { value: "fa-AF", label: "دری" },
  { value: "ps-AF", label: "پښتو" },
  { value: "en", label: "English" }
];

const translations = {
  en: {
    tagline: "School management, made simpler",
    navigationFeatures: "Features",
    navigationHow: "How it works",
    navigationAccess: "Access",
    adminNav: "Admin sign in",
    eyebrow: "A connected school starts here",
    headlineStart: "More clarity for",
    headlineEnd: "every school day.",
    heroText: "Bring school operations, teachers, students and families into one organized workspace — designed around the way your school works.",
    primaryAction: "Go to administration",
    secondaryAction: "Explore the platform",
    trustOne: "Built for schools",
    trustTwo: "School-scoped access",
    trustThree: "Dari, Pashto & English",
    previewEyebrow: "WORKSPACE PREVIEW",
    previewHeading: "Everything in one place",
    previewSubheading: "A glimpse of your daily school workspace",
    previewOverview: "School overview",
    previewToday: "Your daily essentials",
    previewPill: "Illustrative preview",
    previewAcademics: "Academics",
    previewFamilies: "Student & family",
    previewAttendance: "Attendance",
    previewUpdates: "Communication",
    previewStatusOne: "Plan",
    previewStatusTwo: "Organize",
    previewStatusThree: "Monitor",
    previewStatusFour: "Connect",
    previewBanner: "One clear view of school operations.",
    valueLabel: "MADE FOR YOUR WORKFLOW",
    valueTitle: "Less time switching tools. More time supporting learning.",
    valueText: "From the first school day to the final report, keep the essentials connected and easy to find.",
    featureTitle: "One platform. The tools your school needs.",
    featureIntro: "Start with the daily essentials and bring your whole school community together.",
    features: [
      { icon: "school", title: "Academic planning", detail: "Structure academic years, classes, subjects, teaching assignments and timetables." },
      { icon: "family", title: "Students & families", detail: "Manage school records, student enrollment and linked guardian accounts." },
      { icon: "attendance", title: "Attendance", detail: "Track daily attendance and keep authorized families informed." },
      { icon: "learning", title: "Learning & results", detail: "Coordinate homework, exams, published grades and learning progress." },
      { icon: "messages", title: "Announcements", detail: "Reach school, class and role audiences through targeted updates." },
      { icon: "fees", title: "Fees & operations", detail: "Keep fee records, receipts and school readiness information organized." }
    ],
    howEyebrow: "GETTING STARTED",
    howTitle: "A straightforward start for your school.",
    howText: "MaktabLink is for provisioned schools. Use the account provided by your school or platform administrator.",
    steps: [
      { title: "Your school is set up", detail: "A platform administrator provisions your school and its administrator account." },
      { title: "Choose your school", detail: "Select your school on the sign-in page and use your issued credentials." },
      { title: "Manage with confidence", detail: "Open your school dashboard and get started with the tools your role can access." }
    ],
    entryEyebrow: "CHOOSE YOUR WORKSPACE",
    entryTitle: "Ready to get back to school?",
    entryText: "Select the right portal to continue. Access is available only to users with school-issued accounts.",
    adminCardTitle: "School administration",
    adminCardText: "For school administrators managing academics, accounts and day-to-day operations.",
    adminCardAction: "Open admin sign in",
    staffCardTitle: "School staff",
    staffCardText: "For staff members using the dedicated school operations portal.",
    staffCardAction: "Open staff sign in",
    mobileNote: "Parent, teacher and student accounts use the MaktabLink mobile application.",
    footerNote: "Designed for connected schools and informed families.",
    footerPrivacy: "School information is available only to authorized accounts."
  },
  "fa-AF": {
    tagline: "مدیریت مکتب، ساده‌تر از همیشه",
    navigationFeatures: "امکانات",
    navigationHow: "طرز کار",
    navigationAccess: "ورود",
    adminNav: "ورود مدیر",
    eyebrow: "یک مکتب هماهنگ از اینجا آغاز می‌شود",
    headlineStart: "نظم و وضاحت بیشتر",
    headlineEnd: "برای هر روز مکتب.",
    heroText: "امور مکتب، معلمان، شاگردان و خانواده‌ها را در یک فضای کاری منظم و یکپارچه مدیریت کنید؛ مطابق نیازهای روزمرهٔ مکتب شما.",
    primaryAction: "ورود به مدیریت مکتب",
    secondaryAction: "آشنایی با امکانات",
    trustOne: "ویژهٔ مکاتب",
    trustTwo: "دسترسی محدود به هر مکتب",
    trustThree: "دری، پشتو و انگلیسی",
    previewEyebrow: "نمای نمونهٔ فضای کاری",
    previewHeading: "همه چیز در یک جا",
    previewSubheading: "نگاهی به کارهای روزمرهٔ مکتب",
    previewOverview: "نمای عمومی مکتب",
    previewToday: "کارهای مهم روزانه",
    previewPill: "نمای نمایشی",
    previewAcademics: "امور تعلیمی",
    previewFamilies: "شاگردان و خانواده‌ها",
    previewAttendance: "حاضری",
    previewUpdates: "ارتباطات",
    previewStatusOne: "برنامه‌ریزی",
    previewStatusTwo: "تنظیم",
    previewStatusThree: "نظارت",
    previewStatusFour: "هماهنگی",
    previewBanner: "یک نمای روشن از تمام امور مکتب.",
    valueLabel: "ساخته‌شده برای روند کاری شما",
    valueTitle: "زمان کمتر برای ابزارهای مختلف؛ زمان بیشتر برای آموزش.",
    valueText: "از آغاز سال تعلیمی تا گزارش نهایی، همهٔ معلومات مهم را در دسترس و منظم نگه دارید.",
    featureTitle: "یک پلتفرم؛ تمام ابزارهای ضروری مکتب.",
    featureIntro: "کارهای روزانه را ساده کنید و اعضای مکتب را با هم در ارتباط نگه دارید.",
    features: [
      { icon: "school", title: "برنامه‌ریزی تعلیمی", detail: "سال تعلیمی، صنف‌ها، مضامین، وظایف معلمان و تقسیم اوقات را تنظیم کنید." },
      { icon: "family", title: "شاگردان و خانواده‌ها", detail: "ثبت‌نام شاگردان، سوابق مکتب و حساب‌های والدین را مدیریت کنید." },
      { icon: "attendance", title: "حاضری", detail: "حاضری روزانه را ثبت کنید و خانواده‌های مجاز را باخبر سازید." },
      { icon: "learning", title: "آموزش و نتایج", detail: "کارخانگی، امتحانات، نمرات نشرشده و پیشرفت تعلیمی را پیگیری کنید." },
      { icon: "messages", title: "اطلاعیه‌ها", detail: "پیام‌های ویژهٔ مکتب، صنف و گروه‌های مختلف را ارسال کنید." },
      { icon: "fees", title: "فیس و امور مکتب", detail: "سوابق فیس، رسیدها و معلومات آمادگی مکتب را منظم نگه دارید." }
    ],
    howEyebrow: "شروع کار",
    howTitle: "شروعی ساده برای مکتب شما.",
    howText: "مکتب باید از قبل در سیستم ثبت شده باشد. از حسابی استفاده کنید که مسئول مکتب یا پلتفرم در اختیار شما گذاشته است.",
    steps: [
      { title: "مکتب شما ثبت می‌شود", detail: "مسئول پلتفرم، مکتب و حساب مدیر آن را در سیستم ایجاد می‌کند." },
      { title: "مکتب خود را انتخاب کنید", detail: "در صفحهٔ ورود، مکتب خود را انتخاب کرده و معلومات حساب‌تان را وارد کنید." },
      { title: "مدیریت را آغاز کنید", detail: "به پنل مکتب بروید و از امکانات مربوط به نقش خود استفاده کنید." }
    ],
    entryEyebrow: "انتخاب فضای کاری",
    entryTitle: "برای شروع آماده‌اید؟",
    entryText: "برای ادامه، بخش مربوط به خود را انتخاب کنید. ورود تنها با حساب صادرشده از طرف مکتب ممکن است.",
    adminCardTitle: "مدیریت مکتب",
    adminCardText: "برای مدیران مکتب جهت مدیریت امور تعلیمی، حساب‌ها و فعالیت‌های روزمره.",
    adminCardAction: "ورود به پنل مدیر",
    staffCardTitle: "کارمندان مکتب",
    staffCardText: "برای کارمندانی که از پورتال مستقل امور مکتب استفاده می‌کنند.",
    staffCardAction: "ورود کارمندان",
    mobileNote: "والدین، معلمان و شاگردان از اپلیکیشن موبایل مکتب‌لینک استفاده می‌کنند.",
    footerNote: "برای مکاتب هماهنگ و خانواده‌های آگاه.",
    footerPrivacy: "معلومات مکتب تنها برای حساب‌های مجاز قابل دسترسی است."
  },
  "ps-AF": {
    tagline: "د ښوونځي مدیریت، په اسانه بڼه",
    navigationFeatures: "ځانګړنې",
    navigationHow: "څنګه کار کوي",
    navigationAccess: "ننوتل",
    adminNav: "د مدیر ننوتل",
    eyebrow: "یو منظم ښوونځی له همدې ځایه پیلېږي",
    headlineStart: "د ښوونځي هره ورځ",
    headlineEnd: "لا روښانه او منظمه.",
    heroText: "د ښوونځي چارې، ښوونکي، زده‌کوونکي او کورنۍ په یوه منظم کاري چاپېریال کې سره ونښلوئ؛ ستاسو د ښوونځي د اړتیاوو لپاره.",
    primaryAction: "د ښوونځي مدیریت ته ننوتل",
    secondaryAction: "ځانګړنې وپېژنئ",
    trustOne: "د ښوونځیو لپاره",
    trustTwo: "د هر ښوونځي ځانګړی لاسرسی",
    trustThree: "دري، پښتو او انګلیسي",
    previewEyebrow: "د کاري چاپېریال بېلګه",
    previewHeading: "هر څه په یوه ځای کې",
    previewSubheading: "د ښوونځي ورځنیو چارو ته یوه کتنه",
    previewOverview: "د ښوونځي عمومي لید",
    previewToday: "ورځنۍ مهمې چارې",
    previewPill: "بېلګه ییز لید",
    previewAcademics: "تعلیمي چارې",
    previewFamilies: "زده‌کوونکي او کورنۍ",
    previewAttendance: "حاضري",
    previewUpdates: "اړیکې",
    previewStatusOne: "پلان جوړونه",
    previewStatusTwo: "تنظیم",
    previewStatusThree: "څارنه",
    previewStatusFour: "همغږي",
    previewBanner: "د ښوونځي ټولې چارې په یوه روښانه لید کې.",
    valueLabel: "ستاسو د کاري بهیر لپاره",
    valueTitle: "د بېلابېلو وسایلو لپاره لږ وخت؛ زده‌کړې ته ډېر وخت.",
    valueText: "د تعلیمي کال له پیل تر وروستي راپور پورې مهم معلومات منظم او د لاسرسي وړ وساتئ.",
    featureTitle: "یو پلېټفارم؛ د ښوونځي اړین وسایل.",
    featureIntro: "ورځنۍ چارې اسانه کړئ او د ښوونځي ټول غړي سره ونښلوئ.",
    features: [
      { icon: "school", title: "تعلیمي پلان جوړونه", detail: "تعلیمي کلونه، ټولګي، مضمونونه، د ښوونکو دندې او مهال‌وېش تنظیم کړئ." },
      { icon: "family", title: "زده‌کوونکي او کورنۍ", detail: "د زده‌کوونکو نوم‌لیکنه، د ښوونځي ریکارډونه او د کورنیو حسابونه اداره کړئ." },
      { icon: "attendance", title: "حاضري", detail: "ورځنۍ حاضري ثبت کړئ او اړوندو کورنیو ته خبر ورکړئ." },
      { icon: "learning", title: "زده‌کړه او پایلې", detail: "کورني کارونه، ازموینې، خپرې شوې نمرې او تعلیمي پرمختګ وڅارئ." },
      { icon: "messages", title: "خبرتیاوې", detail: "د ښوونځي، ټولګي او بېلابېلو ډلو لپاره ځانګړې خبرتیاوې ولېږئ." },
      { icon: "fees", title: "فیس او اداري چارې", detail: "د فیس ریکارډونه، رسیدونه او د ښوونځي د چمتووالي معلومات تنظیم کړئ." }
    ],
    howEyebrow: "د کار پیل",
    howTitle: "ستاسو د ښوونځي لپاره اسانه پیل.",
    howText: "ښوونځی باید مخکې په سیستم کې ثبت شوی وي. د ښوونځي یا پلېټفارم د مسئول له خوا درکړل شوی حساب وکاروئ.",
    steps: [
      { title: "ستاسو ښوونځی ثبتېږي", detail: "د پلېټفارم مسئول ستاسو ښوونځی او د مدیر حساب جوړوي." },
      { title: "خپل ښوونځی وټاکئ", detail: "د ننوتلو په پاڼه کې ښوونځی وټاکئ او د حساب معلومات ورکړئ." },
      { title: "مدیریت پیل کړئ", detail: "خپل ډشبورډ خلاص کړئ او د خپلې دندې اړوند امکانات وکاروئ." }
    ],
    entryEyebrow: "خپل کاري ځای وټاکئ",
    entryTitle: "پیل ته چمتو یاست؟",
    entryText: "د دوام لپاره اړونده برخه وټاکئ. ننوتل یوازې د ښوونځي په ورکړل شوي حساب کېږي.",
    adminCardTitle: "د ښوونځي مدیریت",
    adminCardText: "د مدیرانو لپاره د تعلیمي چارو، حسابونو او ورځنیو فعالیتونو اداره.",
    adminCardAction: "د مدیر ننوتلو ته لاړ شئ",
    staffCardTitle: "د ښوونځي کارکوونکي",
    staffCardText: "د هغو کارکوونکو لپاره چې ځانګړی اداري پورتال کاروي.",
    staffCardAction: "د کارکوونکو ننوتل",
    mobileNote: "والدین، ښوونکي او زده‌کوونکي د مکتب‌لینک موبایل اپلېکېشن کاروي.",
    footerNote: "د منظمو ښوونځیو او باخبره کورنیو لپاره.",
    footerPrivacy: "د ښوونځي معلومات یوازې مجازو حسابونو ته ښکاري."
  }
} as const;

const iconPaths: Record<IconName, string> = {
  school: "M3 20h18M5 20V8l7-4 7 4v12M9 11h.01M15 11h.01M9 15h.01M15 15h.01M11 20v-3h2v3",
  family: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  attendance: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM8 16l2.5 2.5L16 13",
  learning: "M4 19.5C4 18.1 5 17 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2ZM9 7h7M9 11h5",
  messages: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5ZM8 11h9M8 14h6",
  fees: "M3 7h18v12H3zM3 11h18M7 15h4M6 7V5a2 2 0 0 1 2-2h11",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "M5 12l4 4L19 6",
  layers: "M12 3 2 8l10 5 10-5-10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
  users: "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87",
  spark: "m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 17l.7 1.3L21 19l-1.3.7L19 21l-.7-1.3L17 19l1.3-.7L19 17Z"
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

export default function HomeLanding() {
  const [locale, setLocale] = useState<Locale>("fa-AF");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("maktablink.admin.locale");
      if (saved === "fa-AF" || saved === "ps-AF" || saved === "en") setLocale(saved);
    } catch {
      // Browsers with blocked storage still get the default language.
    }
  }, []);

  function chooseLocale(next: Locale) {
    setLocale(next);
    try {
      window.localStorage.setItem("maktablink.admin.locale", next);
    } catch {
      // Language selection works for the current session without storage.
    }
  }

  const copy = translations[locale];
  const isRtl = locale !== "en";

  return (
    <main id="main-content" className="ml-home" lang={locale === "en" ? "en" : locale === "ps-AF" ? "ps" : "fa"} dir={isRtl ? "rtl" : "ltr"}>
      <div className="ml-home-backdrop" aria-hidden="true" />
      <div className="ml-home-container">
        <header className="ml-home-header">
          <Link className="ml-home-brand" href="/" aria-label="MaktabLink">
            <span className="ml-home-brand-symbol"><Icon name="layers" size={25} /></span>
            <span className="ml-home-brand-copy"><strong>MaktabLink</strong><small>{copy.tagline}</small></span>
          </Link>
          <nav className="ml-home-nav" aria-label="Main navigation">
            <a href="#features">{copy.navigationFeatures}</a>
            <a href="#how-it-works">{copy.navigationHow}</a>
            <a href="#access">{copy.navigationAccess}</a>
          </nav>
          <div className="ml-home-header-actions">
            <label className="ml-home-language">
              <span className="ml-home-sr-only">Language / زبان / ژبه</span>
              <select value={locale} onChange={(event) => chooseLocale(event.target.value as Locale)} aria-label="Language / زبان / ژبه">
                {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <Link className="ml-home-header-login" href="/admin">{copy.adminNav}<Icon name="arrow" size={16} /></Link>
          </div>
        </header>

        <section className="ml-home-hero" aria-labelledby="ml-home-title">
          <div className="ml-home-hero-copy">
            <span className="ml-home-kicker"><span className="ml-home-kicker-dot" />{copy.eyebrow}</span>
            <h1 id="ml-home-title">{copy.headlineStart}<br /><span>{copy.headlineEnd}</span></h1>
            <p>{copy.heroText}</p>
            <div className="ml-home-hero-actions">
              <Link className="ml-home-button ml-home-button-primary" href="/admin">{copy.primaryAction}<Icon name="arrow" size={20} /></Link>
              <a className="ml-home-button ml-home-button-ghost" href="#features">{copy.secondaryAction}</a>
            </div>
            <div className="ml-home-trust">
              <span><Icon name="check" size={16} />{copy.trustOne}</span>
              <span><Icon name="check" size={16} />{copy.trustTwo}</span>
              <span><Icon name="check" size={16} />{copy.trustThree}</span>
            </div>
          </div>
          <div className="ml-home-visual" role="img" aria-label={copy.previewHeading + " — " + copy.previewPill}>
            <div className="ml-home-visual-glow" aria-hidden="true" />
            <div className="ml-home-preview">
              <div className="ml-home-preview-top">
                <div className="ml-home-preview-brand"><span className="ml-home-mini-brand"><Icon name="layers" size={17} /></span><strong>MaktabLink</strong><span className="ml-home-preview-divider" /><small>{copy.previewOverview}</small></div>
                <span className="ml-home-preview-dots" aria-hidden="true"><i /><i /><i /></span>
              </div>
              <div className="ml-home-preview-body">
                <span className="ml-home-preview-kicker">{copy.previewEyebrow}</span>
                <div className="ml-home-preview-heading"><div><h2>{copy.previewHeading}</h2><p>{copy.previewSubheading}</p></div><span className="ml-home-preview-badge">{copy.previewPill}</span></div>
                <div className="ml-home-preview-grid">
                  {[
                    { icon: "school" as const, name: copy.previewAcademics, status: copy.previewStatusOne, color: "blue" },
                    { icon: "users" as const, name: copy.previewFamilies, status: copy.previewStatusTwo, color: "violet" },
                    { icon: "attendance" as const, name: copy.previewAttendance, status: copy.previewStatusThree, color: "mint" },
                    { icon: "messages" as const, name: copy.previewUpdates, status: copy.previewStatusFour, color: "orange" }
                  ].map((item) => (
                    <div className={"ml-home-preview-tile ml-home-tile-" + item.color} key={item.color}>
                      <span className="ml-home-tile-icon"><Icon name={item.icon} size={21} /></span>
                      <strong>{item.name}</strong><small>{item.status}</small>
                      <span className="ml-home-tile-line" aria-hidden="true" />
                    </div>
                  ))}
                </div>
                <div className="ml-home-preview-message"><span className="ml-home-preview-check"><Icon name="check" size={17} /></span><span>{copy.previewBanner}</span><Icon name="arrow" size={17} /></div>
              </div>
            </div>
            <div className="ml-home-floating-note"><Icon name="shield" size={17} />{copy.trustTwo}</div>
          </div>
        </section>

        <section className="ml-home-intro" aria-labelledby="ml-home-value-title">
          <div><span className="ml-home-section-label">{copy.valueLabel}</span><h2 id="ml-home-value-title">{copy.valueTitle}</h2></div>
          <p>{copy.valueText}</p>
        </section>

        <section className="ml-home-features" id="features" aria-labelledby="ml-home-features-title">
          <div className="ml-home-section-head"><div><span className="ml-home-section-label">{copy.navigationFeatures}</span><h2 id="ml-home-features-title">{copy.featureTitle}</h2></div><p>{copy.featureIntro}</p></div>
          <div className="ml-home-feature-grid">
            {copy.features.map((feature, index) => (
              <article className="ml-home-feature-card" key={feature.title}>
                <div className={"ml-home-feature-icon ml-home-feature-icon-" + (index % 3)}><Icon name={feature.icon as IconName} size={25} /></div>
                <h3>{feature.title}</h3><p>{feature.detail}</p>
                <span className="ml-home-feature-number" aria-hidden="true">0{index + 1}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="ml-home-onboarding" id="how-it-works" aria-labelledby="ml-home-how-title">
          <div className="ml-home-onboarding-copy"><span className="ml-home-section-label">{copy.howEyebrow}</span><h2 id="ml-home-how-title">{copy.howTitle}</h2><p>{copy.howText}</p><Link className="ml-home-button ml-home-button-primary" href="/admin">{copy.primaryAction}<Icon name="arrow" size={19} /></Link></div>
          <ol className="ml-home-steps">
            {copy.steps.map((step, index) => <li key={step.title}><span className="ml-home-step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.detail}</p></div></li>)}
          </ol>
        </section>

        <section className="ml-home-access" id="access" aria-labelledby="ml-home-access-title">
          <div className="ml-home-access-heading"><span className="ml-home-section-label">{copy.entryEyebrow}</span><h2 id="ml-home-access-title">{copy.entryTitle}</h2><p>{copy.entryText}</p></div>
          <div className="ml-home-access-grid">
            <Link href="/admin" className="ml-home-access-card"><span className="ml-home-access-icon"><Icon name="school" size={28} /></span><div><h3>{copy.adminCardTitle}</h3><p>{copy.adminCardText}</p><span className="ml-home-access-link">{copy.adminCardAction}<Icon name="arrow" size={19} /></span></div></Link>
            <Link href="/staff" className="ml-home-access-card"><span className="ml-home-access-icon"><Icon name="users" size={28} /></span><div><h3>{copy.staffCardTitle}</h3><p>{copy.staffCardText}</p><span className="ml-home-access-link">{copy.staffCardAction}<Icon name="arrow" size={19} /></span></div></Link>
          </div>
          <p className="ml-home-mobile-note"><Icon name="spark" size={18} />{copy.mobileNote}</p>
        </section>

        <footer className="ml-home-footer">
          <div className="ml-home-footer-brand"><span className="ml-home-brand-symbol"><Icon name="layers" size={21} /></span><div><strong>MaktabLink</strong><p>{copy.footerNote}</p></div></div>
          <span className="ml-home-footer-privacy"><Icon name="shield" size={17} />{copy.footerPrivacy}</span>
        </footer>
      </div>
    </main>
  );
}
