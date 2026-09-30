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
  | "role.parentHint"
  | "role.teacherHint"
  | "role.studentHint"
  | "onboarding.caption"
  | "school.choose"
  | "school.chooseHint"
  | "school.search"
  | "school.searchHint"
  | "school.noResults"
  | "login.title"
  | "login.hint"
  | "login.greetingParent"
  | "login.greetingTeacher"
  | "login.greetingStudent"
  | "field.username"
  | "field.password"
  | "auth.signIn"
  | "auth.loginFailed"
  | "auth.invalidCredentials"
  | "auth.roleMismatch"
  | "auth.accountSuspended"
  | "auth.accountUnavailable"
  | "auth.rateLimited"
  | "passwordChange.title"
  | "passwordChange.hint"
  | "passwordChange.mismatch"
  | "passwordChange.failed"
  | "passwordChange.rulesTitle"
  | "passwordChange.ruleLength"
  | "passwordChange.ruleLetter"
  | "passwordChange.ruleNumber"
  | "passwordChange.ruleSpecial"
  | "passwordChange.tooShort"
  | "passwordChange.missingLetter"
  | "passwordChange.missingNumber"
  | "passwordChange.missingSpecial"
  | "field.newPassword"
  | "field.confirmPassword"
  | "action.save"
  | "action.back"
  | "action.retry"
  | "action.showPassword"
  | "action.hidePassword"
  | "action.dismiss"
  | "action.minimize"
  | "action.expand"
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
  | "common.errorTitle"
  | "common.connectionProblemTitle"
  | "common.networkError"
  | "common.apiUnavailable"
  | "common.apiStillUnavailable"
  | "common.checkingConnection"
  | "common.connectionRestoredTitle"
  | "common.connectionRestored"
  | "common.validationError"
  | "common.requestFailed"
  | "common.cachedOffline"
  | "common.serviceUnavailable"
  | "common.sessionExpired"
  | "teacher.todayTitle"
  | "teacher.supervisedClass"
  | "teacher.schedule"
  | "teacher.noSupervisedClass"
  | "teacher.noClassesToday"
  | "attendance.dailyTitle"
  | "attendance.today"
  | "attendance.recent"
  | "attendance.present"
  | "attendance.absent"
  | "attendance.late"
  | "attendance.excused"
  | "attendance.notRecorded"
  | "attendance.noHistory"
  | "attendance.pending"
  | "attendance.submitted"
  | "attendance.marked"
  | "attendance.markEveryone"
  | "attendance.submit"
  | "attendance.saved"
  | "attendance.noChanges"
  | "attendance.locked"
  | "notifications.title"
  | "notifications.absent"
  | "notifications.late"
  | "notifications.empty"
  | "notifications.homework"
  | "notifications.results"
  | "student.homeTitle"
  | "student.homeSubtitle"
  | "learning.homework"
  | "learning.homeworkHint"
  | "learning.assignments"
  | "learning.createHomework"
  | "learning.editHomework"
  | "learning.homeworkTitle"
  | "learning.instructions"
  | "learning.dueDate"
  | "learning.dueTime"
  | "learning.attachmentUrl"
  | "learning.saveDraft"
  | "learning.edit"
  | "learning.publish"
  | "learning.close"
  | "learning.archive"
  | "learning.due"
  | "learning.noAssignments"
  | "learning.noHomework"
  | "learning.completeHomework"
  | "learning.invalidDueDate"
  | "learning.homeworkSaved"
  | "learning.homeworkPublished"
  | "learning.homeworkUpdated"
  | "learning.marks"
  | "learning.marksHint"
  | "learning.maxScore"
  | "learning.score"
  | "learning.remark"
  | "learning.saveMarks"
  | "learning.noExamSubjects"
  | "learning.validScores"
  | "learning.marksSaved"
  | "learning.marksReadOnly"
  | "learning.publishedHomework"
  | "learning.publishedResults"
  | "learning.noPublishedHomework"
  | "learning.noPublishedResults"
  | "communication.announcements"
  | "communication.noAnnouncements"
  | "communication.classAnnouncement"
  | "communication.negaranOnly"
  | "communication.title"
  | "communication.message"
  | "communication.publish"
  | "communication.completeAnnouncement"
  | "communication.announcementSent"
  | "communication.noNotifications"
  | "fees.title"
  | "fees.invoice"
  | "fees.amount"
  | "fees.paid"
  | "fees.outstanding"
  | "fees.due"
  | "fees.none"
  | "contact.adminTitle"
  | "contact.adminHint"
  | "contact.email"
  | "contact.whatsapp"
  | "contact.phone"
  | "contact.office"
  | "contact.hours"
  | "contact.noDetails";

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
  "role.parentHint": "Follow your children's school day in one place.",
  "role.teacherHint": "Open your classes and school responsibilities.",
  "role.studentHint": "See your school information and academic activity.",
  "onboarding.caption": "School · Family · Learning",
  "school.choose": "Choose your school",
  "school.chooseHint": "Search for the school that issued your username and temporary password.",
  "school.search": "Search schools",
  "school.searchHint": "Search by school name, province, or code",
  "school.noResults": "No active schools found.",
  "login.title": "Sign in",
  "login.hint": "Use the username and password provided by your school.",
  "login.greetingParent": "Dear Parent, welcome. Please sign in with the username and password provided by your school.",
  "login.greetingTeacher": "Dear Teacher, welcome. Please sign in with the username and password provided by your school.",
  "login.greetingStudent": "Dear Student, welcome. Please sign in with the username and password provided by your school.",
  "field.username": "Username",
  "field.password": "Password",
  "auth.signIn": "Sign in",
  "auth.loginFailed": "Sign in could not be completed. Please try again.",
  "auth.invalidCredentials": "The username or password is not correct. Please check your details and try again.",
  "auth.roleMismatch": "This account does not match the role you selected. Please go back and choose the correct role.",
  "auth.accountSuspended": "This account is temporarily suspended. Please contact your school administration.",
  "auth.accountUnavailable": "This account is no longer active. Please contact your school administration.",
  "auth.rateLimited": "There have been too many sign-in attempts. Please wait a few minutes and try again.",
  "passwordChange.title": "Create your private password",
  "passwordChange.hint": "Your temporary password can only get you this far. Choose a new password that your school cannot see.",
  "passwordChange.mismatch": "The two passwords do not match. Please enter the same password in both fields.",
  "passwordChange.failed": "Your password could not be changed. Please try again.",
  "field.newPassword": "New password",
  "field.confirmPassword": "Confirm password",
  "action.save": "Save",
  "action.back": "Back",
  "action.retry": "Retry",
  "action.showPassword": "Show",
  "action.hidePassword": "Hide",
  "action.dismiss": "Close",
  "action.minimize": "Minimize",
  "action.expand": "Expand",
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
  "common.errorTitle": "Something needs your attention",
  "common.connectionProblemTitle": "Connection interrupted",
  "common.apiUnavailable": "MaktabLink cannot reach the school service right now. The app will reconnect automatically when the service is available again.",
  "common.apiStillUnavailable": "The school service is still unavailable. Please wait a moment and try again.",
  "common.checkingConnection": "Checking the connection…",
  "common.connectionRestoredTitle": "Back online",
  "common.connectionRestored": "MaktabLink reconnected successfully and refreshed your information.",
  "common.validationError": "Some of the information entered is not valid. Please review it and try again.",
  "common.requestFailed": "This action could not be completed. Please try again.",
  "teacher.todayTitle": "Today",
  "teacher.supervisedClass": "My supervised class",
  "teacher.schedule": "Today's schedule",
  "teacher.noSupervisedClass": "No supervised class is assigned to you today.",
  "teacher.noClassesToday": "No classes are scheduled for you today.",
  "attendance.dailyTitle": "Daily attendance",
  "attendance.today": "Today's attendance",
  "attendance.recent": "Recent attendance",
  "attendance.present": "Present",
  "attendance.absent": "Absent",
  "attendance.late": "Late",
  "attendance.excused": "Excused",
  "attendance.notRecorded": "Not recorded",
  "attendance.noHistory": "No attendance has been recorded yet.",
  "attendance.pending": "Daily attendance pending",
  "attendance.submitted": "Attendance submitted",
  "attendance.marked": "marked",
  "attendance.markEveryone": "Mark every student before submitting attendance.",
  "attendance.submit": "Submit attendance",
  "attendance.saved": "Attendance saved.",
  "attendance.noChanges": "Attendance was already submitted with these states.",
  "attendance.locked": "This attendance day is locked. A school administrator can make a correction.",
  "notifications.title": "Notifications",
  "notifications.absent": "Absence alert",
  "notifications.late": "Late arrival alert",
  "notifications.empty": "No notifications.",
  "notifications.homework": "New homework",
  "notifications.results": "Results published",
  "student.homeTitle": "Student home",
  "student.homeSubtitle": "Your published homework and results from this school.",
  "learning.homework": "Homework",
  "learning.homeworkHint": "Create work only for your active subject and class assignments.",
  "learning.assignments": "Teaching assignments",
  "learning.createHomework": "Create homework",
  "learning.editHomework": "Edit draft homework",
  "learning.homeworkTitle": "Homework title",
  "learning.instructions": "Instructions",
  "learning.dueDate": "Due date · YYYY-MM-DD",
  "learning.dueTime": "Time · HH:mm",
  "learning.attachmentUrl": "Optional attachment URL",
  "learning.saveDraft": "Save draft",
  "learning.edit": "Edit",
  "learning.publish": "Publish",
  "learning.close": "Close",
  "learning.archive": "Archive",
  "learning.due": "Due",
  "learning.noAssignments": "No active subject/class assignments.",
  "learning.noHomework": "No homework created yet.",
  "learning.completeHomework": "Complete the assignment, title, instructions, due date and time.",
  "learning.invalidDueDate": "Enter the date as YYYY-MM-DD and the time as HH:mm.",
  "learning.homeworkSaved": "Homework draft saved.",
  "learning.homeworkPublished": "Homework published to the class.",
  "learning.homeworkUpdated": "Homework status updated.",
  "learning.marks": "Marks",
  "learning.marksHint": "Enter draft marks only for your assigned subjects and classes.",
  "learning.maxScore": "Max",
  "learning.score": "Score",
  "learning.remark": "Optional remark",
  "learning.saveMarks": "Save draft marks",
  "learning.noExamSubjects": "No exam subjects are currently open for mark entry.",
  "learning.validScores": "Enter at least one whole-number score.",
  "learning.marksSaved": "Draft marks saved. Parents and students still cannot see them.",
  "learning.marksReadOnly": "This exam is no longer open for teacher mark entry.",
  "learning.publishedHomework": "Published homework",
  "learning.publishedResults": "Published results",
  "learning.noPublishedHomework": "No published homework for this student.",
  "learning.noPublishedResults": "No published results for this student.",
  "communication.announcements": "Announcements",
  "communication.noAnnouncements": "No announcements for your audience.",
  "communication.classAnnouncement": "Class announcement",
  "communication.negaranOnly": "As Negaran, publish only to the class you supervise.",
  "communication.title": "Announcement title",
  "communication.message": "Message",
  "communication.publish": "Publish announcement",
  "communication.completeAnnouncement": "Choose the supervised class and complete the title and message.",
  "communication.announcementSent": "Announcement published to the class.",
  "communication.noNotifications": "No notifications.",
  "fees.title": "Fees",
  "fees.invoice": "School fee",
  "fees.amount": "Amount",
  "fees.paid": "Paid",
  "fees.outstanding": "Outstanding",
  "fees.due": "Due",
  "fees.none": "No issued fees for this student.",
  "common.networkError": "MaktabLink cannot reach the school service right now. Please check your connection and try again.",
  "common.cachedOffline": "Internet is unavailable. You are viewing securely saved information from this device.",
  "common.serviceUnavailable": "Your school's MaktabLink service is currently unavailable. Please contact the school administration.",
  "common.sessionExpired": "Your session has expired. Sign in again when a connection is available.",
  "contact.adminTitle": "School administration",
  "contact.adminHint": "Contact your school administration when you need help or have a question.",
  "contact.email": "Email",
  "contact.whatsapp": "WhatsApp",
  "contact.phone": "Call",
  "contact.office": "Office",
  "contact.hours": "Office hours",
  "contact.noDetails": "The school has not published contact details yet.",
  "passwordChange.rulesTitle": "Your password should include:",
  "passwordChange.ruleLength": "At least 8 characters",
  "passwordChange.ruleLetter": "At least one letter",
  "passwordChange.ruleNumber": "At least one number",
  "passwordChange.ruleSpecial": "At least one special character, such as ! @ # $ %",
  "passwordChange.tooShort": "Your password is a little too short. Please use at least 8 characters.",
  "passwordChange.missingLetter": "Please add at least one letter to your password.",
  "passwordChange.missingNumber": "Please add at least one number to your password.",
  "passwordChange.missingSpecial": "Please add at least one special character, such as ! @ # $ %.",
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
  "role.parentHint": "روز مکتب فرزندان خود را در یک جا دنبال کنید.",
  "role.teacherHint": "به صنف‌ها و مسئولیت‌های مکتب خود دسترسی داشته باشید.",
  "role.studentHint": "معلومات مکتب و فعالیت‌های درسی خود را ببینید.",
  "onboarding.caption": "مکتب · خانواده · آموزش",
  "school.choose": "مکتب خود را انتخاب کنید",
  "school.chooseHint": "مکتبی را جستجو کنید که نام کاربری و رمز موقت را برای شما داده است.",
  "school.search": "جستجوی مکاتب",
  "school.searchHint": "جستجو با نام مکتب، ولایت یا کود مکتب",
  "school.noResults": "هیچ مکتب فعال یافت نشد.",
  "login.title": "ورود",
  "login.hint": "از نام کاربری و رمز عبوری که مکتب داده است استفاده کنید.",
  "login.greetingParent": "والدین گرامی، خوش آمدید. لطفاً با نام کاربری و رمز عبوری که مکتب برای شما فراهم کرده است وارد شوید.",
  "login.greetingTeacher": "استاد گرامی، خوش آمدید. لطفاً با نام کاربری و رمز عبوری که مکتب برای شما فراهم کرده است وارد شوید.",
  "login.greetingStudent": "شاگرد عزیز، خوش آمدید. لطفاً با نام کاربری و رمز عبوری که مکتب برای شما فراهم کرده است وارد شوید.",
  "field.username": "نام کاربری",
  "field.password": "رمز عبور",
  "auth.signIn": "ورود",
  "auth.loginFailed": "ورود انجام نشد. لطفاً دوباره کوشش کنید.",
  "auth.invalidCredentials": "نام کاربری یا رمز عبور درست نیست. لطفاً معلومات خود را بررسی کرده و دوباره کوشش کنید.",
  "auth.roleMismatch": "این حساب مربوط به نقشی که انتخاب کرده‌اید نیست. لطفاً برگردید و نقش درست را انتخاب کنید.",
  "auth.accountSuspended": "این حساب موقتاً تعلیق شده است. لطفاً با اداره مکتب تماس بگیرید.",
  "auth.accountUnavailable": "این حساب دیگر فعال نیست. لطفاً با اداره مکتب تماس بگیرید.",
  "auth.rateLimited": "تلاش‌های ورود بیش از حد بوده است. لطفاً چند دقیقه صبر کرده و دوباره کوشش کنید.",
  "passwordChange.title": "رمز خصوصی خود را بسازید",
  "passwordChange.hint": "رمز موقت فقط برای اولین ورود است. رمزی انتخاب کنید که مکتب آن را نمی‌بیند.",
  "passwordChange.mismatch": "دو رمز عبور یکسان نیستند. لطفاً در هر دو بخش یک رمز را وارد کنید.",
  "passwordChange.failed": "رمز عبور تغییر نکرد. لطفاً دوباره کوشش کنید.",
  "field.newPassword": "رمز جدید",
  "field.confirmPassword": "تکرار رمز",
  "action.save": "ذخیره",
  "action.back": "برگشت",
  "action.retry": "تلاش دوباره",
  "action.showPassword": "نمایش",
  "action.hidePassword": "پنهان",
  "action.dismiss": "بستن",
  "action.minimize": "کوچک‌کردن",
  "action.expand": "بازکردن",
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
  "common.errorTitle": "یک مورد نیاز به توجه شما دارد",
  "common.connectionProblemTitle": "ارتباط موقتاً قطع شده است",
  "common.apiUnavailable": "برنامه فعلاً به خدمات مکتب در MaktabLink دسترسی ندارد. پس از فعال شدن دوبارهٔ سرویس، برنامه به‌صورت خودکار وصل می‌شود.",
  "common.apiStillUnavailable": "خدمات مکتب هنوز در دسترس نیست. لطفاً کمی صبر کرده و دوباره کوشش کنید.",
  "common.checkingConnection": "در حال بررسی ارتباط…",
  "common.connectionRestoredTitle": "دوباره آنلاین شدید",
  "common.connectionRestored": "ارتباط MaktabLink دوباره برقرار شد و معلومات شما تازه شد.",
  "common.validationError": "بعضی از معلومات واردشده درست نیست. لطفاً آن‌ها را بررسی کرده و دوباره کوشش کنید.",
  "common.requestFailed": "این کار انجام نشد. لطفاً دوباره کوشش کنید.",
  "teacher.todayTitle": "امروز",
  "teacher.supervisedClass": "صنف تحت نظارت من",
  "teacher.schedule": "برنامه امروز",
  "teacher.noSupervisedClass": "امروز هیچ صنف تحت نظارتی برای شما ثبت نشده است.",
  "teacher.noClassesToday": "امروز صنفی برای شما ثبت نشده است.",
  "attendance.dailyTitle": "حاضری روزانه",
  "attendance.today": "حاضری امروز",
  "attendance.recent": "حاضری اخیر",
  "attendance.present": "حاضر",
  "attendance.absent": "غایب",
  "attendance.late": "ناوقت",
  "attendance.excused": "معذور",
  "attendance.notRecorded": "ثبت نشده",
  "attendance.noHistory": "هنوز حاضری ثبت نشده است.",
  "attendance.pending": "حاضری روزانه باقی مانده",
  "attendance.submitted": "حاضری ثبت شده",
  "attendance.marked": "علامت‌گذاری شده",
  "attendance.markEveryone": "قبل از ثبت حاضری، وضعیت همه شاگردان را مشخص کنید.",
  "attendance.submit": "ثبت حاضری",
  "attendance.saved": "حاضری ذخیره شد.",
  "attendance.noChanges": "حاضری قبلاً با همین وضعیت‌ها ثبت شده است.",
  "attendance.locked": "حاضری این روز قفل شده است. مدیر مکتب می‌تواند آن را اصلاح کند.",
  "notifications.title": "اعلان‌ها",
  "notifications.absent": "هشدار غیابت",
  "notifications.late": "هشدار ناوقت رسیدن",
  "notifications.empty": "هیچ اعلانی وجود ندارد.",
  "notifications.homework": "وظیفه جدید",
  "notifications.results": "نتایج نشر شد",
  "student.homeTitle": "خانه شاگرد",
  "student.homeSubtitle": "وظایف و نتایج نشرشده شما در این مکتب.",
  "learning.homework": "وظیفه",
  "learning.homeworkHint": "فقط برای مضمون و صنفی که به شما سپرده شده وظیفه بسازید.",
  "learning.assignments": "تکالیف تدریس",
  "learning.createHomework": "ایجاد وظیفه",
  "learning.editHomework": "ویرایش وظیفه پیش‌نویس",
  "learning.homeworkTitle": "عنوان وظیفه",
  "learning.instructions": "دستورالعمل",
  "learning.dueDate": "تاریخ تحویل · YYYY-MM-DD",
  "learning.dueTime": "زمان · HH:mm",
  "learning.attachmentUrl": "لینک اختیاری ضمیمه",
  "learning.saveDraft": "ذخیره پیش‌نویس",
  "learning.edit": "ویرایش",
  "learning.publish": "نشر",
  "learning.close": "بستن",
  "learning.archive": "آرشیف",
  "learning.due": "موعد",
  "learning.noAssignments": "هیچ مضمون/صنف فعال به شما سپرده نشده است.",
  "learning.noHomework": "هنوز وظیفه‌ای ساخته نشده است.",
  "learning.completeHomework": "مضمون، عنوان، دستورالعمل، تاریخ و زمان تحویل را تکمیل کنید.",
  "learning.invalidDueDate": "تاریخ را به شکل YYYY-MM-DD و زمان را به شکل HH:mm وارد کنید.",
  "learning.homeworkSaved": "پیش‌نویس وظیفه ذخیره شد.",
  "learning.homeworkPublished": "وظیفه برای صنف نشر شد.",
  "learning.homeworkUpdated": "وضعیت وظیفه به‌روزرسانی شد.",
  "learning.marks": "نمرات",
  "learning.marksHint": "فقط برای مضمون‌ها و صنف‌های سپرده‌شده نمرات پیش‌نویس وارد کنید.",
  "learning.maxScore": "حداکثر",
  "learning.score": "نمره",
  "learning.remark": "ملاحظه اختیاری",
  "learning.saveMarks": "ذخیره نمرات پیش‌نویس",
  "learning.noExamSubjects": "فعلاً هیچ مضمون امتحانی برای درج نمره باز نیست.",
  "learning.validScores": "حداقل یک نمره عدد صحیح وارد کنید.",
  "learning.marksSaved": "نمرات پیش‌نویس ذخیره شد. والدین و شاگردان هنوز آن را نمی‌بینند.",
  "learning.marksReadOnly": "این امتحان دیگر برای درج نمره توسط استاد باز نیست.",
  "learning.publishedHomework": "وظایف نشرشده",
  "learning.publishedResults": "نتایج نشرشده",
  "learning.noPublishedHomework": "برای این شاگرد وظیفه نشرشده‌ای نیست.",
  "learning.noPublishedResults": "برای این شاگرد نتیجه نشرشده‌ای نیست.",
  "communication.announcements": "اعلانات",
  "communication.noAnnouncements": "اعلانی برای مخاطبان شما وجود ندارد.",
  "communication.classAnnouncement": "اعلان صنف",
  "communication.negaranOnly": "به‌عنوان نگران، فقط برای صنف تحت نظارت خود اعلان نشر کنید.",
  "communication.title": "عنوان اعلان",
  "communication.message": "پیام",
  "communication.publish": "نشر اعلان",
  "communication.completeAnnouncement": "صنف تحت نظارت را انتخاب کرده و عنوان و پیام را تکمیل کنید.",
  "communication.announcementSent": "اعلان برای صنف نشر شد.",
  "communication.noNotifications": "اعلانی وجود ندارد.",
  "fees.title": "فیس",
  "fees.invoice": "فیس مکتب",
  "fees.amount": "مبلغ",
  "fees.paid": "پرداخت‌شده",
  "fees.outstanding": "باقی‌مانده",
  "fees.due": "موعد",
  "fees.none": "برای این شاگرد فیس صادرشده‌ای وجود ندارد.",
  "common.networkError": "برنامه فعلاً به خدمات مکتب در MaktabLink دسترسی ندارد. لطفاً اتصال خود را بررسی کرده و دوباره کوشش کنید.",
  "common.cachedOffline": "اینترنت در دسترس نیست. معلومات امن ذخیره‌شده در این دستگاه را مشاهده می‌کنید.",
  "common.serviceUnavailable": "خدمت MaktabLink مکتب شما فعلاً در دسترس نیست. لطفاً با اداره مکتب تماس بگیرید.",
  "common.sessionExpired": "نشست شما پایان یافته است. وقتی اینترنت در دسترس شد دوباره وارد شوید.",
  "contact.adminTitle": "مدیریت مکتب",
  "contact.adminHint": "اگر پرسش یا نیاز به کمک دارید با مدیریت مکتب تماس بگیرید.",
  "contact.email": "ایمیل",
  "contact.whatsapp": "واتساپ",
  "contact.phone": "تماس",
  "contact.office": "دفتر",
  "contact.hours": "ساعات کاری",
  "contact.noDetails": "مکتب هنوز معلومات تماس مدیریت را نشر نکرده است.",
  "passwordChange.rulesTitle": "رمز عبور شما باید شامل این موارد باشد:",
  "passwordChange.ruleLength": "حداقل ۸ نویسه",
  "passwordChange.ruleLetter": "حداقل یک حرف",
  "passwordChange.ruleNumber": "حداقل یک عدد",
  "passwordChange.ruleSpecial": "حداقل یک نویسه ویژه، مانند ! @ # $ %",
  "passwordChange.tooShort": "رمز عبور کمی کوتاه است. لطفاً حداقل ۸ نویسه استفاده کنید.",
  "passwordChange.missingLetter": "لطفاً حداقل یک حرف به رمز عبور اضافه کنید.",
  "passwordChange.missingNumber": "لطفاً حداقل یک عدد به رمز عبور اضافه کنید.",
  "passwordChange.missingSpecial": "لطفاً حداقل یک نویسه ویژه مانند ! @ # $ % به رمز عبور اضافه کنید.",
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
  "role.parentHint": "د خپلو ماشومانو د ښوونځي ورځ په یوه ځای کې تعقیب کړئ.",
  "role.teacherHint": "خپلو ټولګیو او د ښوونځي مسؤلیتونو ته لاسرسی ولرئ.",
  "role.studentHint": "د ښوونځي معلومات او درسي فعالیتونه وګورئ.",
  "onboarding.caption": "ښوونځی · کورنۍ · زده کړه",
  "school.choose": "خپل ښوونځی وټاکئ",
  "school.chooseHint": "هغه ښوونځی ولټوئ چې کارن نوم او لنډمهاله پټنوم یې درکړی دی.",
  "school.search": "ښوونځي ولټوئ",
  "school.searchHint": "د ښوونځي په نوم، ولایت یا کوډ ولټوئ",
  "school.noResults": "فعال ښوونځی ونه موندل شو.",
  "login.title": "ننوتل",
  "login.hint": "د خپل ښوونځي له خوا ورکړل شوی کارن نوم او پټنوم وکاروئ.",
  "login.greetingParent": "ګرانو مور او پلار، ښه راغلاست. مهرباني وکړئ د ښوونځي له خوا درکړل شوي کارن نوم او پټنوم سره ننوځئ.",
  "login.greetingTeacher": "قدرمن ښوونکي، ښه راغلاست. مهرباني وکړئ د ښوونځي له خوا درکړل شوي کارن نوم او پټنوم سره ننوځئ.",
  "login.greetingStudent": "ګرانه زده کوونکي، ښه راغلاست. مهرباني وکړئ د ښوونځي له خوا درکړل شوي کارن نوم او پټنوم سره ننوځئ.",
  "field.username": "کارن نوم",
  "field.password": "پټنوم",
  "auth.signIn": "ننوتل",
  "auth.loginFailed": "ننوتل بشپړ نه شول. مهرباني وکړئ بیا هڅه وکړئ.",
  "auth.invalidCredentials": "کارن نوم یا پټنوم سم نه دی. مهرباني وکړئ معلومات وګورئ او بیا هڅه وکړئ.",
  "auth.roleMismatch": "دا حساب له هغه رول سره سمون نه لري چې تاسو ټاکلی دی. مهرباني وکړئ شاته لاړ شئ او سم رول وټاکئ.",
  "auth.accountSuspended": "دا حساب لنډمهاله ځنډول شوی دی. مهرباني وکړئ د ښوونځي له ادارې سره اړیکه ونیسئ.",
  "auth.accountUnavailable": "دا حساب نور فعال نه دی. مهرباني وکړئ د ښوونځي له ادارې سره اړیکه ونیسئ.",
  "auth.rateLimited": "د ننوتلو هڅې ډېرې شوې دي. مهرباني وکړئ څو دقیقې وروسته بیا هڅه وکړئ.",
  "passwordChange.title": "خپل شخصي پټنوم جوړ کړئ",
  "passwordChange.hint": "لنډمهاله پټنوم یوازې د لومړي ځل لپاره دی. داسې نوی پټنوم وټاکئ چې ښوونځی یې نه ویني.",
  "passwordChange.mismatch": "دواړه پټنومونه یو شان نه دي. مهرباني وکړئ په دواړو ځایونو کې یو شان پټنوم ولیکئ.",
  "passwordChange.failed": "پټنوم بدل نه شو. مهرباني وکړئ بیا هڅه وکړئ.",
  "field.newPassword": "نوی پټنوم",
  "field.confirmPassword": "پټنوم بیا ولیکئ",
  "action.save": "ساتل",
  "action.back": "شاته",
  "action.retry": "بیا هڅه",
  "action.showPassword": "ښودل",
  "action.hidePassword": "پټول",
  "action.dismiss": "تړل",
  "action.minimize": "کوچنی کول",
  "action.expand": "پراخول",
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
  "common.errorTitle": "یو څه ستاسو پاملرنې ته اړتیا لري",
  "common.connectionProblemTitle": "اړیکه لنډمهاله پرې شوې",
  "common.apiUnavailable": "MaktabLink اوس د ښوونځي خدمت ته لاسرسی نه لري. کله چې خدمت بېرته فعال شي، اپ به په اوتومات ډول بیا ونښلي.",
  "common.apiStillUnavailable": "د ښوونځي خدمت لا هم شتون نه لري. مهرباني وکړئ لږ انتظار وکړئ او بیا هڅه وکړئ.",
  "common.checkingConnection": "اړیکه کتل کېږي…",
  "common.connectionRestoredTitle": "بېرته آنلاین شوئ",
  "common.connectionRestored": "د MaktabLink اړیکه بېرته جوړه شوه او ستاسو معلومات تازه شول.",
  "common.validationError": "ځینې داخل شوي معلومات سم نه دي. مهرباني وکړئ یې وګورئ او بیا هڅه وکړئ.",
  "common.requestFailed": "دا کار بشپړ نه شو. مهرباني وکړئ بیا هڅه وکړئ.",
  "teacher.todayTitle": "نن",
  "teacher.supervisedClass": "زما تر څار لاندې ټولګی",
  "teacher.schedule": "د نن ورځې مهالویش",
  "teacher.noSupervisedClass": "نن ستاسو لپاره تر څار لاندې ټولګی نشته.",
  "teacher.noClassesToday": "نن ستاسو لپاره ټولګی نه دی ثبت شوی.",
  "attendance.dailyTitle": "ورځنۍ حاضري",
  "attendance.today": "د نن حاضري",
  "attendance.recent": "وروستۍ حاضري",
  "attendance.present": "حاضر",
  "attendance.absent": "غایب",
  "attendance.late": "ناوخته",
  "attendance.excused": "معذور",
  "attendance.notRecorded": "نه ده ثبت شوې",
  "attendance.noHistory": "تر اوسه حاضري نه ده ثبت شوې.",
  "attendance.pending": "ورځنۍ حاضري پاتې ده",
  "attendance.submitted": "حاضري ثبت شوې",
  "attendance.marked": "نښه شوي",
  "attendance.markEveryone": "د حاضري له ثبتولو مخکې د ټولو زده کوونکو حالت وټاکئ.",
  "attendance.submit": "حاضري ثبت کړئ",
  "attendance.saved": "حاضري خوندي شوه.",
  "attendance.noChanges": "حاضري مخکې له همدې حالتونو سره ثبت شوې ده.",
  "attendance.locked": "د دې ورځې حاضري تړل شوې ده. د ښوونځي مدیر یې اصلاح کولی شي.",
  "notifications.title": "خبرتیاوې",
  "notifications.absent": "د غیابت خبرتیا",
  "notifications.late": "د ناوخته راتګ خبرتیا",
  "notifications.empty": "خبرتیا نشته.",
  "notifications.homework": "نوې کورنۍ دنده",
  "notifications.results": "پایلې خپرې شوې",
  "student.homeTitle": "د زده کوونکي کور",
  "student.homeSubtitle": "په دې ښوونځي کې ستاسو خپرې شوې دندې او پایلې.",
  "learning.homework": "کورنۍ دنده",
  "learning.homeworkHint": "یوازې د خپلو فعالو مضمون او ټولګي دندو لپاره کار جوړ کړئ.",
  "learning.assignments": "د تدریس دندې",
  "learning.createHomework": "کورنۍ دنده جوړه کړئ",
  "learning.editHomework": "مسوده دنده سمول",
  "learning.homeworkTitle": "د دندې سرلیک",
  "learning.instructions": "لارښوونې",
  "learning.dueDate": "د سپارلو نېټه · YYYY-MM-DD",
  "learning.dueTime": "وخت · HH:mm",
  "learning.attachmentUrl": "اختیاري ضمیمه لینک",
  "learning.saveDraft": "مسوده ساتل",
  "learning.edit": "سمول",
  "learning.publish": "خپرول",
  "learning.close": "تړل",
  "learning.archive": "آرشیف",
  "learning.due": "موعد",
  "learning.noAssignments": "فعال مضمون/ټولګي دنده نشته.",
  "learning.noHomework": "تر اوسه کورنۍ دنده نه ده جوړه شوې.",
  "learning.completeHomework": "دنده، سرلیک، لارښوونې، نېټه او وخت بشپړ کړئ.",
  "learning.invalidDueDate": "نېټه د YYYY-MM-DD او وخت د HH:mm په بڼه ولیکئ.",
  "learning.homeworkSaved": "د کورنۍ دندې مسوده وساتل شوه.",
  "learning.homeworkPublished": "کورنۍ دنده ټولګي ته خپره شوه.",
  "learning.homeworkUpdated": "د کورنۍ دندې حالت تازه شو.",
  "learning.marks": "نمرې",
  "learning.marksHint": "یوازې د خپلو ټاکل شوو مضمونونو او ټولګیو لپاره مسوده نمرې ولیکئ.",
  "learning.maxScore": "لوړه نمره",
  "learning.score": "نمره",
  "learning.remark": "اختیاري یادونه",
  "learning.saveMarks": "مسوده نمرې ساتل",
  "learning.noExamSubjects": "اوس د نمرې لپاره ازموینې مضمون نشته.",
  "learning.validScores": "لږ تر لږه یوه بشپړه عددي نمره ولیکئ.",
  "learning.marksSaved": "مسوده نمرې وساتل شوې. مور او پلار او زده کوونکي یې لا نه شي لیدلی.",
  "learning.marksReadOnly": "دا ازموینه نور د ښوونکي د نمرې لپاره خلاصه نه ده.",
  "learning.publishedHomework": "خپرې شوې دندې",
  "learning.publishedResults": "خپرې شوې پایلې",
  "learning.noPublishedHomework": "د دې زده کوونکي لپاره خپره شوې دنده نشته.",
  "learning.noPublishedResults": "د دې زده کوونکي لپاره خپره شوې پایله نشته.",
  "communication.announcements": "اعلانونه",
  "communication.noAnnouncements": "ستاسو د مخاطب لپاره اعلان نشته.",
  "communication.classAnnouncement": "د ټولګي اعلان",
  "communication.negaranOnly": "د نګران په توګه یوازې خپل تر څار لاندې ټولګي ته اعلان خپور کړئ.",
  "communication.title": "د اعلان سرلیک",
  "communication.message": "پیغام",
  "communication.publish": "اعلان خپور کړئ",
  "communication.completeAnnouncement": "تر څار لاندې ټولګی وټاکئ او سرلیک او پیغام بشپړ کړئ.",
  "communication.announcementSent": "اعلان ټولګي ته خپور شو.",
  "communication.noNotifications": "خبرتیا نشته.",
  "fees.title": "فیسونه",
  "fees.invoice": "د ښوونځي فیس",
  "fees.amount": "مبلغ",
  "fees.paid": "ورکړل شوی",
  "fees.outstanding": "پاتې",
  "fees.due": "موعد",
  "fees.none": "د دې زده کوونکي لپاره صادر شوی فیس نشته.",
  "common.networkError": "MaktabLink اوس د ښوونځي خدمت ته لاسرسی نه لري. مهرباني وکړئ خپله اړیکه وګورئ او بیا هڅه وکړئ.",
  "common.cachedOffline": "انټرنېټ نشته. تاسو په دې وسیله کې خوندي شوي معلومات ګورئ.",
  "common.serviceUnavailable": "ستاسو د ښوونځي MaktabLink خدمت اوس شتون نه لري. مهرباني وکړئ د ښوونځي له ادارې سره اړیکه ونیسئ.",
  "common.sessionExpired": "ستاسو ناسته پای ته رسېدلې ده. کله چې انټرنېټ موجود شي بیا ننوځئ.",
  "contact.adminTitle": "د ښوونځي اداره",
  "contact.adminHint": "که پوښتنه یا مرستې ته اړتیا لرئ، د ښوونځي له ادارې سره اړیکه ونیسئ.",
  "contact.email": "برېښنالیک",
  "contact.whatsapp": "واټس‌اپ",
  "contact.phone": "زنګ",
  "contact.office": "دفتر",
  "contact.hours": "کاري ساعتونه",
  "contact.noDetails": "ښوونځي تر اوسه د ادارې د اړیکې معلومات نه دي خپاره کړي.",
  "passwordChange.rulesTitle": "ستاسو پټنوم باید دا شرایط ولري:",
  "passwordChange.ruleLength": "لږ تر لږه ۸ توري",
  "passwordChange.ruleLetter": "لږ تر لږه یو حرف",
  "passwordChange.ruleNumber": "لږ تر لږه یوه شمېره",
  "passwordChange.ruleSpecial": "لږ تر لږه یو ځانګړی نښه، لکه ! @ # $ %",
  "passwordChange.tooShort": "پټنوم لږ لنډ دی. مهرباني وکړئ لږ تر لږه ۸ توري وکاروئ.",
  "passwordChange.missingLetter": "مهرباني وکړئ پټنوم ته لږ تر لږه یو حرف ورزیات کړئ.",
  "passwordChange.missingNumber": "مهرباني وکړئ پټنوم ته لږ تر لږه یوه شمېره ورزیاته کړئ.",
  "passwordChange.missingSpecial": "مهرباني وکړئ پټنوم ته لږ تر لږه یوه ځانګړې نښه لکه ! @ # $ % ورزیاته کړئ.",
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
