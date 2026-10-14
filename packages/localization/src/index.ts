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
  | "suspension.title"
  | "suspension.contactHint"
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
  | "parent.refreshHome"
  | "parent.actionRequired"
  | "parent.noAlerts"
  | "parent.someDataUnavailable"
  | "parent.alertAbsent"
  | "parent.alertLate"
  | "parent.alertHomeworkToday"
  | "parent.alertHomeworkTomorrow"
  | "parent.alertFeeOverdue"
  | "parent.alertFeeSoon"
  | "parent.alertUnread"
  | "parent.unavailable"
  | "parent.tryAgain"
  | "parent.viewDetails"
  | "parent.unreadNotifications"
  | "parent.viewAllNotifications"
  | "parent.dashboard"
  | "parent.todaySchedule"
  | "parent.noClassesToday"
  | "parent.homeworkDue"
  | "parent.noHomeworkDue"
  | "parent.nextExam"
  | "parent.examScheduleUnavailable"
  | "parent.latestResult"
  | "parent.noPublishedResult"
  | "parent.feeStatus"
  | "parent.noOutstandingFees"
  | "parent.latestAnnouncement"
  | "parent.noAnnouncements"
  | "parent.moreItems"
  | "parent.navAcademics"
  | "parent.navAttendance"
  | "parent.navInbox"
  | "parent.navTimetable"
  | "parent.noTimetable"
  | "parent.navHome"
  | "parent.navHomework"
  | "parent.navAnnouncements"
  | "parent.navMore"
  | "parent.moreTitle"
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
  | "productivity.title"
  | "productivity.privateHint"
  | "productivity.open"
  | "productivity.done"
  | "productivity.all"
  | "productivity.total"
  | "productivity.edit"
  | "productivity.new"
  | "productivity.taskTitle"
  | "productivity.details"
  | "productivity.dueDate"
  | "productivity.clearDueDate"
  | "productivity.low"
  | "productivity.normal"
  | "productivity.high"
  | "productivity.offlineDraft"
  | "productivity.save"
  | "productivity.cancelEdit"
  | "productivity.list"
  | "productivity.search"
  | "productivity.empty"
  | "productivity.markDone"
  | "productivity.reopen"
  | "productivity.deleteTitle"
  | "productivity.deleteConfirm"
  | "productivity.delete"
  | "productivity.invalid"
  | "productivity.saved"
  | "teacher.markAllRead"
  | "teacher.onlyUnread"
  | "teacher.allNotifications"
  | "teacher.dayAtGlance"
  | "teacher.attendancePending"
  | "teacher.nextLesson"
  | "teacher.noUpcomingLesson"
  | "teacher.pendingTasks"
  | "teacher.draftHomework"
  | "teacher.gradesToEnter"
  | "teacher.unreadNotifications"
  | "teacher.noPendingTasks"
  | "teacher.quickActions"
  | "teacher.newHomework"
  | "teacher.latestAnnouncements"
  | "teacher.noAnnouncements"
  | "teacher.allAnnouncements"
  | "teacher.notificationsCenter"
  | "teacher.noNotifications"
  | "teacher.markRead"
  | "teacher.closeNotifications"
  | "teacher.workflowHomework"
  | "teacher.workflowGrades"
  | "teacher.workflowAnnouncements"
  | "teacher.classOverview"
  | "teacher.classStudents"
  | "teacher.classSupervision"
  | "teacher.backToClasses"
  | "teacher.weeklyPeriods"
  | "teacher.subjectSchedule"
  | "teacher.studentRosterHint"
  | "teacher.studentReadOnly"
  | "teacher.noActiveStudents"
  | "teacher.supervisionHint"
  | "teacher.supervisionUnavailable"
  | "teaching.workspace"
  | "teaching.lessons"
  | "teaching.curriculum"
  | "teaching.report"
  | "teaching.planned"
  | "teaching.completed"
  | "teaching.postponed"
  | "teaching.notStarted"
  | "teaching.inProgress"
  | "teaching.newLesson"
  | "teaching.editLesson"
  | "teaching.topic"
  | "teaching.objective"
  | "teaching.materials"
  | "teaching.notes"
  | "teaching.relatedUnit"
  | "teaching.noUnit"
  | "teaching.saveLesson"
  | "teaching.cancelEdit"
  | "teaching.noLessons"
  | "teaching.invalidLesson"
  | "teaching.lessonSaved"
  | "teaching.progressSaved"
  | "teaching.curriculumHint"
  | "teaching.noUnits"
  | "teaching.unitsComplete"
  | "teaching.reportHint"
  | "teaching.from"
  | "teaching.to"
  | "teaching.generateReport"
  | "teaching.invalidRange"
  | "teaching.homeworkPublished"
  | "teaching.assessments"
  | "teaching.progressAsOfToday"
  | "teacher.workspace"
  | "teacher.navSchedule"
  | "teacher.navClasses"
  | "teacher.navWorkflows"
  | "teacher.periodCount"
  | "teacher.viewFullSchedule"
  | "teacher.viewAssignments"
  | "teacher.fullSchedule"
  | "teacher.noClassesForDay"
  | "teacher.noSchedule"
  | "teacher.myAssignments"
  | "teacher.classesCount"
  | "teacher.subjectsCount"
  | "teacher.noAssignments"
  | "teacher.negaranHint"
  | "teacher.workflowsHint"
  | "teacher.statusDraft"
  | "teacher.statusPublished"
  | "teacher.statusClosed"
  | "teacher.statusArchived"
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
  | "parent.attendanceCalendar"
  | "parent.attendanceCalendarHelp"
  | "parent.attendancePrevious"
  | "parent.attendanceNext"
  | "parent.attendanceFuture"
  | "parent.attendanceLoadError"
  | "parent.attendanceSummary"
  | "parent.attendanceRate"
  | "parent.attendanceRateHelp"
  | "parent.attendanceRecorded"
  | "parent.attendanceMonthEmpty"
  | "parent.attendanceDayDetail"
  | "parent.attendanceNoNote"
  | "parent.attendanceUnrecorded"
  | "parent.attendanceHistory"
  | "parent.academicAll"
  | "parent.academicUpcoming"
  | "parent.academicPast"
  | "parent.academicClosed"
  | "parent.academicHomeworkHint"
  | "parent.academicSearchHomework"
  | "parent.academicStatusFilter"
  | "parent.academicSubjectFilter"
  | "parent.academicAllSubjects"
  | "parent.academicNoMatches"
  | "parent.academicResultHint"
  | "parent.academicExamFilter"
  | "parent.academicAllExams"
  | "parent.academicReportedTotal"
  | "parent.academicTimetableHint"
  | "parent.academicDayFilter"
  | "parent.academicWholeWeek"
  | "parent.academicPeriods"
  | "parent.academicNoPeriods"
  | "parent.academicRefresh"
  | "parent.inboxSearch"
  | "parent.inboxAll"
  | "parent.inboxUnread"
  | "parent.inboxRead"
  | "parent.inboxSchool"
  | "parent.inboxAcademics"
  | "parent.inboxFees"
  | "parent.inboxClass"
  | "parent.inboxParents"
  | "parent.inboxAudience"
  | "parent.inboxReadFilter"
  | "parent.inboxTopic"
  | "parent.inboxChildAudience"
  | "parent.inboxAccountWide"
  | "parent.inboxLoadMore"
  | "parent.inboxShowing"
  | "parent.inboxNoMatches"
  | "parent.inboxTargetUnavailable"
  | "parent.inboxMarkReadError"
  | "parent.moreFees"
  | "parent.moreProfile"
  | "parent.moreSchool"
  | "parent.morePreferences"
  | "parent.moreFeesDescription"
  | "parent.moreBilled"
  | "parent.moreLedgerHint"
  | "parent.moreInvoices"
  | "parent.moreUnpaid"
  | "parent.moreAllInvoices"
  | "parent.morePaid"
  | "parent.moreNoFilteredFees"
  | "parent.moreIssuedOn"
  | "parent.morePaymentHistory"
  | "parent.moreNoPayments"
  | "parent.moreReference"
  | "parent.moreReversalReason"
  | "parent.morePaymentHelp"
  | "parent.moreProfileHint"
  | "parent.moreParentAccount"
  | "parent.moreUsername"
  | "parent.moreNotProvided"
  | "parent.moreManagedBySchool"
  | "parent.moreLinkedChildren"
  | "parent.moreSchoolHint"
  | "parent.moreSchoolCode"
  | "parent.moreProvince"
  | "parent.moreCity"
  | "parent.moreSchoolContactHelp"
  | "parent.moreLanguage"
  | "parent.moreLanguageHint"
  | "parent.moreSecurity"
  | "parent.moreSecurityHint"
  | "parent.moreCurrentPassword"
  | "parent.moreNewPassword"
  | "parent.moreConfirmPassword"
  | "parent.morePasswordRules"
  | "parent.moreCurrentRequired"
  | "parent.moreSamePassword"
  | "parent.morePasswordLength"
  | "parent.moreChangePassword"
  | "parent.morePasswordFailed"
  | "parent.morePasswordChanged"
  | "parent.moreLogoutTitle"
  | "parent.moreLogoutConfirm"
  | "attendance.pending"
  | "attendance.submitted"
  | "attendance.marked"
  | "attendance.markEveryone"
  | "attendance.submit"
  | "attendance.saved"
  | "attendance.noChanges"
  | "attendance.staleSheet"
  | "attendance.markAllPresent"
  | "attendance.bulkHint"
  | "attendance.confirmTitle"
  | "attendance.confirmMessage"
  | "attendance.cancel"
  | "attendance.confirmSubmit"
  | "attendance.historyTitle"
  | "attendance.historyError"
  | "attendance.submittedDays"
  | "attendance.attendanceRate"
  | "attendance.rateHint"
  | "attendance.historyReadOnly"
  | "attendance.dailyTab"
  | "attendance.historyTab"
  | "attendance.countsTitle"
  | "attendance.locked"
  | "notifications.title"
  | "notifications.absent"
  | "notifications.late"
  | "notifications.empty"
  | "notifications.homework"
  | "notifications.results"
  | "student.homeTitle"
  | "student.homeSubtitle"
  | "student.accountUnavailableTitle"
  | "student.dashboard"
  | "student.studentCode"
  | "student.class"
  | "student.academicYear"
  | "student.todaySchedule"
  | "student.noClassesToday"
  | "student.homeworkDue"
  | "student.noHomeworkDue"
  | "student.latestResult"
  | "student.noPublishedResult"
  | "student.latestAnnouncement"
  | "student.noAnnouncements"
  | "student.unreadNotifications"
  | "student.noUnreadNotifications"
  | "student.viewTimetable"
  | "student.timetableTitle"
  | "student.timetableSubtitle"
  | "student.noTimetable"
  | "student.noClassesForDay"
  | "student.today"
  | "student.viewHomework"
  | "student.homeworkTitle"
  | "student.homeworkSubtitle"
  | "student.upcomingHomework"
  | "student.pastHomework"
  | "student.openAttachment"
  | "student.noHomework"
  | "student.viewResults"
  | "student.resultsTitle"
  | "student.resultsSubtitle"
  | "student.examTotal"
  | "student.publishedOn"
  | "student.teacherRemark"
  | "student.noResults"
  | "student.viewAnnouncements"
  | "student.viewNotifications"
  | "student.announcementsTitle"
  | "student.notificationsTitle"
  | "student.announcementsSubtitle"
  | "student.notificationsSubtitle"
  | "student.communicationTitle"
  | "student.communicationSubtitle"
  | "student.schoolAnnouncement"
  | "student.classAnnouncement"
  | "student.studentAnnouncement"
  | "student.markRead"
  | "student.read"
  | "student.unreadOnly"
  | "student.showAll"
  | "weekday.saturday"
  | "weekday.sunday"
  | "weekday.monday"
  | "weekday.tuesday"
  | "weekday.wednesday"
  | "weekday.thursday"
  | "learning.newHomework"
  | "learning.attachmentHint"
  | "learning.searchHomework"
  | "learning.allStatuses"
  | "learning.openAttachment"
  | "learning.useTemplate"
  | "learning.templateReady"
  | "learning.validAttachment"
  | "learning.noMatchingHomework"
  | "learning.noGradeChanges"
  | "learning.marksEntered"
  | "learning.marksMissing"
  | "learning.searchStudents"
  | "learning.showAllStudents"
  | "learning.showMissingOnly"
  | "learning.markRecorded"
  | "learning.markMissing"
  | "learning.noMatchingStudents"
  | "learning.fileAttached"
  | "learning.fileReady"
  | "learning.fileUploadFailed"
  | "learning.removeFile"
  | "learning.selectDeviceFile"
  | "learning.schedulePublication"
  | "learning.publicationTime"
  | "learning.scheduleHint"
  | "learning.invalidSchedule"
  | "learning.hideSubmissions"
  | "learning.reviewSubmissions"
  | "learning.studentSubmissions"
  | "learning.noSubmissions"
  | "learning.feedback"
  | "learning.feedbackRequired"
  | "learning.markReviewed"
  | "learning.requestRevision"
  | "learning.feedbackSaved"
  | "learning.continuousAssessments"
  | "learning.assessmentHint"
  | "learning.assessmentTitle"
  | "learning.assessmentInvalid"
  | "learning.assessmentCreated"
  | "learning.assessmentSaved"
  | "learning.createAssessment"
  | "learning.assessmentList"
  | "learning.noAssessments"
  | "learning.categoryQUIZ"
  | "learning.categoryCLASSWORK"
  | "learning.categoryHOMEWORK"
  | "learning.categoryPARTICIPATION"
  | "learning.categoryMONTHLY"
  | "learning.studentSubmitAction"
  | "learning.submissionStatus"
  | "learning.studentAnswer"
  | "learning.submissionInvalid"
  | "learning.submissionSaved"
  | "learning.submissionFailed"
  | "learning.submissionClosed"
  | "learning.homework"
  | "learning.homeworkHint"
  | "learning.assignments"
  | "learning.createHomework"
  | "learning.editHomework"
  | "learning.homeworkTitle"
  | "learning.instructions"
  | "learning.dueDate"
  | "learning.pickDueDate"
  | "learning.previousMonth"
  | "learning.nextMonth"
  | "learning.closeCalendar"
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
  | "learning.statusChanged"
  | "learning.confirmPublish"
  | "learning.confirmClose"
  | "learning.confirmArchive"
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
  | "fees.statusDraft"
  | "fees.statusIssued"
  | "fees.statusPartiallyPaid"
  | "fees.statusPaid"
  | "fees.statusOverdue"
  | "fees.statusCancelled"
  | "fees.payment"
  | "fees.reversal"
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
  "parent.dashboard": "At a glance",
  "parent.todaySchedule": "Today's schedule",
  "parent.noClassesToday": "No classes scheduled today",
  "parent.homeworkDue": "Homework due",
  "parent.noHomeworkDue": "No upcoming homework",
  "parent.nextExam": "Next exam",
  "parent.examScheduleUnavailable": "Exam dates are not scheduled in the current MVP",
  "parent.latestResult": "Latest result",
  "parent.noPublishedResult": "No published result yet",
  "parent.feeStatus": "Fee status",
  "parent.noOutstandingFees": "No outstanding balance",
  "parent.latestAnnouncement": "Latest announcement",
  "parent.noAnnouncements": "No announcement for this child",
  "parent.moreItems": "more",
  "parent.navAcademics": "Academics",
  "parent.navAttendance": "Attendance",
  "parent.navInbox": "Inbox",
  "parent.navTimetable": "Timetable",
  "parent.noTimetable": "No timetable has been published.",
  "parent.refreshHome": "Refresh Home",
  "parent.actionRequired": "Needs your attention",
  "parent.noAlerts": "No urgent items right now",
  "parent.someDataUnavailable": "Some information could not be loaded. You can retry individual cards.",
  "parent.alertAbsent": "Absent today",
  "parent.alertLate": "Late today",
  "parent.alertHomeworkToday": "Homework due today",
  "parent.alertHomeworkTomorrow": "Homework due tomorrow",
  "parent.alertFeeOverdue": "Outstanding fee is overdue",
  "parent.alertFeeSoon": "Fee payment due soon",
  "parent.alertUnread": "You have unread notifications",
  "parent.unavailable": "Information unavailable",
  "parent.tryAgain": "Try again",
  "parent.viewDetails": "View details",
  "parent.unreadNotifications": "Unread notifications",
  "parent.viewAllNotifications": "View all notifications",
  "parent.navHome": "Home",
  "parent.navHomework": "Homework",
  "parent.navAnnouncements": "Announcements",
  "parent.navMore": "More",
  "parent.moreTitle": "More",
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
  "productivity.title": "My personal tasks",
  "productivity.privateHint": "Private to your teacher account. Not visible to students or other teachers.",
  "productivity.open": "Open",
  "productivity.done": "Done",
  "productivity.all": "All",
  "productivity.total": "Total tasks",
  "productivity.edit": "Edit task",
  "productivity.new": "New task",
  "productivity.taskTitle": "Task title",
  "productivity.details": "Notes (optional)",
  "productivity.dueDate": "Due date (optional)",
  "productivity.clearDueDate": "Clear date",
  "productivity.low": "Low priority",
  "productivity.normal": "Normal priority",
  "productivity.high": "High priority",
  "productivity.offlineDraft": "New task drafts are saved securely on this device. Sending or editing tasks requires internet.",
  "productivity.save": "Save task",
  "productivity.cancelEdit": "Cancel editing",
  "productivity.list": "Tasks",
  "productivity.search": "Search tasks",
  "productivity.empty": "No tasks match this view.",
  "productivity.markDone": "Mark done",
  "productivity.reopen": "Reopen",
  "productivity.deleteTitle": "Delete task?",
  "productivity.deleteConfirm": "This personal task will be permanently deleted.",
  "productivity.delete": "Delete",
  "productivity.invalid": "Enter a task title and use the allowed length limits.",
  "productivity.saved": "Task saved.",
  "teacher.markAllRead": "Mark all read",
  "teacher.onlyUnread": "Unread only",
  "teacher.allNotifications": "All notifications",
  "teacher.dayAtGlance": "Your day at a glance",
  "teacher.attendancePending": "Attendance pending",
  "teacher.nextLesson": "Next lesson",
  "teacher.noUpcomingLesson": "No more scheduled lessons today.",
  "teacher.pendingTasks": "Pending activities",
  "teacher.draftHomework": "Homework drafts",
  "teacher.gradesToEnter": "Exams open for marks",
  "teacher.unreadNotifications": "Unread notifications",
  "teacher.noPendingTasks": "You're all caught up with your current tasks.",
  "teacher.quickActions": "Quick actions",
  "teacher.newHomework": "Create homework",
  "teacher.latestAnnouncements": "Latest school announcements",
  "teacher.noAnnouncements": "No announcements available.",
  "teacher.allAnnouncements": "View all announcements",
  "teacher.notificationsCenter": "Notifications",
  "teacher.noNotifications": "No notifications yet.",
  "teacher.markRead": "Mark as read",
  "teacher.closeNotifications": "Close notifications",
  "teacher.workflowHomework": "Homework",
  "teacher.workflowGrades": "Marks",
  "teacher.workflowAnnouncements": "Announcements",
  "teacher.classOverview": "Overview",
  "teacher.classStudents": "Students",
  "teacher.classSupervision": "Supervision",
  "teacher.backToClasses": "Back to my classes",
  "teacher.weeklyPeriods": "Weekly periods",
  "teacher.subjectSchedule": "Subject timetable",
  "teacher.studentRosterHint": "Active students in this class · names and codes only.",
  "teacher.studentReadOnly": "Read-only student information. Marks are managed by assigned subject.",
  "teacher.noActiveStudents": "No active students in this class.",
  "teacher.supervisionHint": "Only active Negaran assignments can record attendance or publish class announcements.",
  "teacher.supervisionUnavailable": "Supervision permissions are not active for today's date. Refresh or contact the school administrator.",
  "teaching.workspace": "Teaching",
  "teaching.lessons": "Lesson plans",
  "teaching.curriculum": "Curriculum",
  "teaching.report": "Teaching report",
  "teaching.planned": "Planned",
  "teaching.completed": "Completed",
  "teaching.postponed": "Postponed",
  "teaching.notStarted": "Not started",
  "teaching.inProgress": "In progress",
  "teaching.newLesson": "Plan a lesson",
  "teaching.editLesson": "Edit lesson",
  "teaching.topic": "Lesson topic",
  "teaching.objective": "Learning objective",
  "teaching.materials": "Teaching materials",
  "teaching.notes": "Teaching notes",
  "teaching.relatedUnit": "Curriculum unit (optional)",
  "teaching.noUnit": "No unit",
  "teaching.saveLesson": "Save lesson",
  "teaching.cancelEdit": "Cancel editing",
  "teaching.noLessons": "No lesson plans yet.",
  "teaching.invalidLesson": "Enter a valid lesson date, topic and learning objective.",
  "teaching.lessonSaved": "Lesson plan saved.",
  "teaching.progressSaved": "Curriculum progress updated.",
  "teaching.curriculumHint": "Curriculum units are created by your school. Update only your teaching progress.",
  "teaching.noUnits": "No curriculum units for this class and subject. Ask the school administrator to add them.",
  "teaching.unitsComplete": "Units completed",
  "teaching.reportHint": "Select a period to summarize your teaching. Curriculum progress reflects its current status.",
  "teaching.from": "From date",
  "teaching.to": "To date",
  "teaching.generateReport": "Generate report",
  "teaching.invalidRange": "Choose valid report dates, no more than one year apart.",
  "teaching.homeworkPublished": "Homework posted",
  "teaching.assessments": "Assessments",
  "teaching.progressAsOfToday": "Curriculum progress shows the current status; other figures use the selected date range.",
  "teacher.workspace": "Teacher workspace",
  "teacher.navSchedule": "Schedule",
  "teacher.navClasses": "Classes",
  "teacher.navWorkflows": "Workflows",
  "teacher.periodCount": "Classes today",
  "teacher.viewFullSchedule": "View full weekly schedule",
  "teacher.viewAssignments": "View my classes and subjects",
  "teacher.fullSchedule": "My weekly schedule",
  "teacher.noClassesForDay": "No classes on this day.",
  "teacher.noSchedule": "You have no timetable periods in the active academic year.",
  "teacher.myAssignments": "My assigned classes and subjects",
  "teacher.classesCount": "classes",
  "teacher.subjectsCount": "subjects",
  "teacher.noAssignments": "No subjects or classes have been assigned to you for the active year.",
  "teacher.negaranHint": "Only classes assigned to you as Negaran can open daily attendance or post class announcements.",
  "teacher.workflowsHint": "Manage homework and draft grades for your own teaching assignments; class announcements require active Negaran supervision.",
  "teacher.statusDraft": "Draft",
  "teacher.statusPublished": "Published",
  "teacher.statusClosed": "Closed",
  "teacher.statusArchived": "Archived",
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
    "parent.attendanceCalendar": "Attendance calendar",
    "parent.attendanceCalendarHelp": "Select a day to see the school's recorded attendance.",
    "parent.attendancePrevious": "Previous month",
    "parent.attendanceNext": "Next month",
    "parent.attendanceFuture": "Not yet recorded",
    "parent.attendanceLoadError": "Attendance could not be loaded. Check your connection and retry.",
    "parent.attendanceSummary": "Monthly summary",
    "parent.attendanceRate": "Attendance rate",
    "parent.attendanceRateHelp": "Present and late ÷ recorded non-excused days. Excused and unrecorded days are excluded.",
    "parent.attendanceRecorded": "Recorded days",
    "parent.attendanceMonthEmpty": "No attendance has been recorded for this month.",
    "parent.attendanceDayDetail": "Day details",
    "parent.attendanceNoNote": "No note from the school.",
    "parent.attendanceUnrecorded": "No attendance recorded for this date.",
    "parent.attendanceHistory": "Monthly history",
  "parent.academicAll": "All",
  "parent.academicUpcoming": "Upcoming",
  "parent.academicPast": "Past due date",
  "parent.academicClosed": "Closed",
  "parent.academicHomeworkHint": "School-published tasks only. Tap a task for instructions and attachments.",
  "parent.academicSearchHomework": "Search homework",
  "parent.academicStatusFilter": "Due date / status",
  "parent.academicSubjectFilter": "Subject",
  "parent.academicAllSubjects": "All subjects",
  "parent.academicNoMatches": "No items match these filters.",
  "parent.academicResultHint": "Only results released by the school are visible.",
  "parent.academicExamFilter": "Exam",
  "parent.academicAllExams": "All exams",
  "parent.academicReportedTotal": "Total of shown marks",
  "parent.academicTimetableHint": "Weekly classes and teachers assigned by the school.",
  "parent.academicDayFilter": "Day",
  "parent.academicWholeWeek": "Whole week",
  "parent.academicPeriods": "Periods",
  "parent.academicNoPeriods": "No periods match the selected day or subject.",
  "parent.academicRefresh": "Refresh",
  "parent.inboxSearch": "Search messages or updates",
  "parent.inboxAll": "All",
  "parent.inboxUnread": "Unread",
  "parent.inboxRead": "Read",
  "parent.inboxSchool": "School",
  "parent.inboxAcademics": "Academics",
  "parent.inboxFees": "Fees",
  "parent.inboxClass": "Class",
  "parent.inboxParents": "Parents",
  "parent.inboxAudience": "Audience",
  "parent.inboxReadFilter": "Read status",
  "parent.inboxTopic": "Category",
  "parent.inboxChildAudience": "Announcements for the selected child",
  "parent.inboxAccountWide": "Notifications for your parent account and linked children",
  "parent.inboxLoadMore": "Load more",
  "parent.inboxShowing": "Showing",
  "parent.inboxNoMatches": "No messages match these filters.",
  "parent.inboxTargetUnavailable": "This update is no longer available for the selected child.",
  "parent.inboxMarkReadError": "Could not mark notifications as read. Please try again.",
  "parent.moreFees": "Fees",
  "parent.moreProfile": "Profile",
  "parent.moreSchool": "School",
  "parent.morePreferences": "Preferences",
  "parent.moreFeesDescription": "Issued invoices and verified payment history for the selected child.",
  "parent.moreBilled": "Billed",
  "parent.moreLedgerHint": "Balances come from the school's ledger. This app cannot collect or confirm payments.",
  "parent.moreInvoices": "Invoices",
  "parent.moreUnpaid": "Outstanding",
  "parent.moreAllInvoices": "All invoices",
  "parent.morePaid": "Paid",
  "parent.moreNoFilteredFees": "No invoices match this filter.",
  "parent.moreIssuedOn": "Issued on",
  "parent.morePaymentHistory": "Payment history",
  "parent.moreNoPayments": "No payment transactions recorded.",
  "parent.moreReference": "Reference",
  "parent.moreReversalReason": "Reversal reason",
  "parent.morePaymentHelp": "To pay, dispute a balance, or request a receipt, contact the school. Payments here are read-only.",
  "parent.moreProfileHint": "Your school-verified parent account information.",
  "parent.moreParentAccount": "Parent account",
  "parent.moreUsername": "Username",
  "parent.moreNotProvided": "Not provided",
  "parent.moreManagedBySchool": "Name, phone and family links are managed by the school. Contact the administrator to request corrections.",
  "parent.moreLinkedChildren": "Linked children",
  "parent.moreSchoolHint": "School details and authorized administrative contact.",
  "parent.moreSchoolCode": "School code",
  "parent.moreProvince": "Province",
  "parent.moreCity": "City",
  "parent.moreSchoolContactHelp": "Contact this school administrator for account, enrollment, attendance or fee corrections.",
  "parent.moreLanguage": "App language",
  "parent.moreLanguageHint": "Change the language of MaktabLink on this device.",
  "parent.moreSecurity": "Account security",
  "parent.moreSecurityHint": "Change your password using your current password. Never share it with the school.",
  "parent.moreCurrentPassword": "Current password",
  "parent.moreNewPassword": "New password",
  "parent.moreConfirmPassword": "Confirm new password",
  "parent.morePasswordRules": "Use at least 8 characters with a letter, number, and special symbol.",
  "parent.moreCurrentRequired": "Enter your current password.",
  "parent.moreSamePassword": "Choose a new password that differs from your current one.",
  "parent.morePasswordLength": "Your new password must be between 8 and 128 characters.",
  "parent.moreChangePassword": "Change password",
  "parent.morePasswordFailed": "Password not changed. Verify your current password or connection and retry.",
  "parent.morePasswordChanged": "Password changed successfully. Your account session has been refreshed.",
  "parent.moreLogoutTitle": "Log out?",
  "parent.moreLogoutConfirm": "You will need to sign in again to access your school account.",
  "attendance.pending": "Daily attendance pending",
  "attendance.submitted": "Attendance submitted",
  "attendance.marked": "marked",
  "attendance.markEveryone": "Mark every student before submitting attendance.",
  "attendance.submit": "Submit attendance",
  "attendance.saved": "Attendance saved.",
  "attendance.noChanges": "Attendance was already submitted with these states.",
  "attendance.staleSheet": "Attendance changed while you were editing. The latest marks have been loaded. Review them and submit again.",
  "attendance.markAllPresent": "Mark unmarked present",
  "attendance.bulkHint": "Only students without a mark will be changed.",
  "attendance.confirmTitle": "Review attendance",
  "attendance.confirmMessage": "Check these totals before submitting:",
  "attendance.cancel": "Cancel",
  "attendance.confirmSubmit": "Confirm and save",
  "attendance.historyTitle": "Attendance history",
  "attendance.historyError": "Unable to load attendance history. Try refreshing.",
  "attendance.submittedDays": "Submitted days",
  "attendance.attendanceRate": "Attendance rate",
  "attendance.rateHint": "Attendance rate = (Present + Late) ÷ all recorded marks. Excused is counted separately.",
  "attendance.historyReadOnly": "Past attendance is read-only. Contact school administration for corrections.",
  "attendance.dailyTab": "Today",
  "attendance.historyTab": "History",
  "attendance.countsTitle": "Marked students",
  "attendance.locked": "This attendance day is locked. A school administrator can make a correction.",
  "notifications.title": "Notifications",
  "notifications.absent": "Absence alert",
  "notifications.late": "Late arrival alert",
  "notifications.empty": "No notifications.",
  "notifications.homework": "New homework",
  "notifications.results": "Results published",
  "student.homeTitle": "Student home",
  "student.homeSubtitle": "Your academic summary for this school.",
  "student.accountUnavailableTitle": "Student access unavailable",
  "student.dashboard": "At a glance",
  "student.studentCode": "Student code",
  "student.class": "Class",
  "student.academicYear": "Academic year",
  "student.todaySchedule": "Today's schedule",
  "student.noClassesToday": "No classes scheduled today",
  "student.homeworkDue": "Homework due",
  "student.noHomeworkDue": "No upcoming homework",
  "student.latestResult": "Latest result",
  "student.noPublishedResult": "No published result yet",
  "student.latestAnnouncement": "Latest announcement",
  "student.noAnnouncements": "No announcement available",
  "student.unreadNotifications": "Unread notifications",
  "student.noUnreadNotifications": "You're all caught up",
  "student.viewTimetable": "View timetable",
  "student.timetableTitle": "My timetable",
  "student.timetableSubtitle": "Your weekly class agenda.",
  "student.noTimetable": "No timetable has been created for your class yet.",
  "student.noClassesForDay": "No classes",
  "student.today": "Today",
  "student.viewHomework": "View homework",
  "student.homeworkTitle": "My homework",
  "student.homeworkSubtitle": "Published assignments from your teachers.",
  "student.upcomingHomework": "Upcoming",
  "student.pastHomework": "Past",
  "student.openAttachment": "Open attachment",
  "student.noHomework": "No published homework yet.",
  "student.viewResults": "View results",
  "student.resultsTitle": "My results",
  "student.resultsSubtitle": "Published exam results from your school.",
  "student.viewAnnouncements": "View announcements",
  "student.viewNotifications": "View notifications",
  "student.announcementsTitle": "Announcements",
  "student.notificationsTitle": "Notifications",
  "student.announcementsSubtitle": "School and class updates for you.",
  "student.notificationsSubtitle": "Personal alerts and updates.",
  "student.communicationTitle": "School updates",
  "student.communicationSubtitle": "Announcements and personal notifications.",
  "student.schoolAnnouncement": "School-wide",
  "student.classAnnouncement": "My class",
  "student.studentAnnouncement": "Students",
  "student.markRead": "Mark as read",
  "student.read": "Read",
  "student.unreadOnly": "Unread only",
  "student.showAll": "Show all",
  "student.examTotal": "Exam total",
  "student.publishedOn": "Published",
  "student.teacherRemark": "Teacher remark",
  "student.noResults": "No published results yet.",
  "weekday.saturday": "Saturday",
  "weekday.sunday": "Sunday",
  "weekday.monday": "Monday",
  "weekday.tuesday": "Tuesday",
  "weekday.wednesday": "Wednesday",
  "weekday.thursday": "Thursday",
  "learning.newHomework": "New homework draft",
  "learning.attachmentHint": "Optional: paste an HTTPS link to a PDF, image or worksheet. File upload is not available yet.",
  "learning.searchHomework": "Search homework title or instructions",
  "learning.allStatuses": "All statuses",
  "learning.openAttachment": "Open attachment link",
  "learning.useTemplate": "Use as template",
  "learning.templateReady": "Homework copied into a new draft. Select the target class and due date, then save.",
  "learning.validAttachment": "Use a valid HTTPS attachment link (maximum 500 characters).",
  "learning.noMatchingHomework": "No homework matches your filters.",
  "learning.noGradeChanges": "No new or changed marks to save.",
  "learning.marksEntered": "Marks recorded",
  "learning.marksMissing": "Marks missing",
  "learning.searchStudents": "Search students by name or code",
  "learning.showAllStudents": "Show all students",
  "learning.showMissingOnly": "Show missing marks only",
  "learning.markRecorded": "Recorded",
  "learning.markMissing": "Missing",
  "learning.noMatchingStudents": "No students match the filter.",
  "learning.fileAttached": "File attached",
  "learning.fileReady": "File uploaded securely",
  "learning.fileUploadFailed": "Could not upload file. Only PDF/images up to 1 MB are supported.",
  "learning.removeFile": "Remove file",
  "learning.selectDeviceFile": "Choose PDF or image",
  "learning.schedulePublication": "Schedule publication (optional)",
  "learning.publicationTime": "Time HH:mm",
  "learning.scheduleHint": "If set, homework publishes automatically before its due date while the server is running.",
  "learning.invalidSchedule": "Select a future publication time before the due date.",
  "learning.hideSubmissions": "Hide submissions",
  "learning.reviewSubmissions": "Review submissions",
  "learning.studentSubmissions": "Student submissions",
  "learning.noSubmissions": "No student submissions yet.",
  "learning.feedback": "Feedback",
  "learning.feedbackRequired": "Enter feedback first.",
  "learning.markReviewed": "Mark reviewed",
  "learning.requestRevision": "Request revision",
  "learning.feedbackSaved": "Feedback saved.",
  "learning.continuousAssessments": "Continuous assessments",
  "learning.assessmentHint": "Quizzes and classwork are separate from official exam grades.",
  "learning.assessmentTitle": "Assessment title",
  "learning.assessmentInvalid": "Enter a title, valid date and maximum mark.",
  "learning.assessmentCreated": "Assessment created.",
  "learning.assessmentSaved": "Assessment marks saved.",
  "learning.createAssessment": "Create assessment",
  "learning.assessmentList": "My assessments",
  "learning.noAssessments": "No assessments yet.",
  "learning.categoryQUIZ": "Quiz",
  "learning.categoryCLASSWORK": "Classwork",
  "learning.categoryHOMEWORK": "Homework",
  "learning.categoryPARTICIPATION": "Participation",
  "learning.categoryMONTHLY": "Monthly",
  "learning.studentSubmitAction": "Submit homework",
  "learning.submissionStatus": "Submission status",
  "learning.studentAnswer": "Write your answer",
  "learning.submissionInvalid": "Provide an answer or attachment before the deadline.",
  "learning.submissionSaved": "Homework submitted.",
  "learning.submissionFailed": "Could not submit or load homework. Check your connection or deadline.",
  "learning.submissionClosed": "Submission is closed for this homework.",
  "learning.homework": "Homework",
  "learning.homeworkHint": "Create work only for your active subject and class assignments.",
  "learning.assignments": "Teaching assignments",
  "learning.createHomework": "Create homework",
  "learning.editHomework": "Edit draft homework",
  "learning.homeworkTitle": "Homework title",
  "learning.instructions": "Instructions",
  "learning.dueDate": "Select due date",
  "learning.pickDueDate": "Select due date",
  "learning.previousMonth": "Previous month",
  "learning.nextMonth": "Next month",
  "learning.closeCalendar": "Close calendar",
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
  "learning.statusChanged": "This homework changed elsewhere or was published automatically. Its current state has been refreshed.",
  "learning.confirmPublish": "Publish this homework? Parents and students will be notified, and the content can no longer be edited.",
  "learning.confirmClose": "Close this homework? Students will no longer be able to submit answers.",
  "learning.confirmArchive": "Archive this homework? It will leave Parent/Student feeds but remain in teacher history.",
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
  "fees.statusDraft": "Draft",
  "fees.statusIssued": "Issued",
  "fees.statusPartiallyPaid": "Partially paid",
  "fees.statusPaid": "Paid",
  "fees.statusOverdue": "Overdue",
  "fees.statusCancelled": "Cancelled",
  "fees.payment": "Payment",
  "fees.reversal": "Reversal",
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
  "suspension.title": "Account suspended",
  "suspension.contactHint": "Your school features are temporarily inactive. Contact the school administration below to reactivate your account.",
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
  "parent.dashboard": "در یک نگاه",
  "parent.todaySchedule": "برنامه امروز",
  "parent.noClassesToday": "امروز درسی برنامه‌ریزی نشده است",
  "parent.homeworkDue": "کارخانگی پیش‌رو",
  "parent.noHomeworkDue": "کارخانگی پیش‌رو وجود ندارد",
  "parent.nextExam": "امتحان بعدی",
  "parent.examScheduleUnavailable": "تاریخ امتحان در نسخه فعلی MVP برنامه‌ریزی نمی‌شود",
  "parent.latestResult": "آخرین نتیجه",
  "parent.noPublishedResult": "هنوز نتیجه‌ای نشر نشده است",
  "parent.feeStatus": "وضعیت فیس",
  "parent.noOutstandingFees": "باقی‌مانده فیس وجود ندارد",
  "parent.latestAnnouncement": "آخرین اعلان",
  "parent.noAnnouncements": "برای این شاگرد اعلانی وجود ندارد",
  "parent.moreItems": "مورد دیگر",
  "parent.navAcademics": "آموزش",
  "parent.navAttendance": "حاضری",
  "parent.navInbox": "صندوق پیام‌ها",
  "parent.navTimetable": "تقسیم اوقات",
  "parent.noTimetable": "تقسیم اوقات نشر نشده است.",
  "parent.refreshHome": "تازه‌سازی خانه",
  "parent.actionRequired": "نیازمند توجه شما",
  "parent.noAlerts": "فعلاً مورد عاجل وجود ندارد",
  "parent.someDataUnavailable": "بخشی از معلومات بارگذاری نشد؛ کارت‌ها را جداگانه دوباره امتحان کنید.",
  "parent.alertAbsent": "امروز غیرحاضر",
  "parent.alertLate": "امروز ناوقت",
  "parent.alertHomeworkToday": "مهلت کارخانگی امروز است",
  "parent.alertHomeworkTomorrow": "مهلت کارخانگی فردا است",
  "parent.alertFeeOverdue": "فیس پرداخت‌نشده از موعد گذشته است",
  "parent.alertFeeSoon": "مهلت پرداخت فیس نزدیک است",
  "parent.alertUnread": "اطلاعیه‌های ناخوانده دارید",
  "parent.unavailable": "معلومات در دسترس نیست",
  "parent.tryAgain": "دوباره امتحان کنید",
  "parent.viewDetails": "دیدن جزئیات",
  "parent.unreadNotifications": "اطلاعیه‌های ناخوانده",
  "parent.viewAllNotifications": "دیدن همه اطلاعیه‌ها",
  "parent.navHome": "خانه",
  "parent.navHomework": "کارخانگی",
  "parent.navAnnouncements": "اعلانات",
  "parent.navMore": "بیشتر",
  "parent.moreTitle": "بیشتر",
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
  "productivity.title": "کارهای شخصی من",
  "productivity.privateHint": "فقط در حساب استاد شما قابل مشاهده است؛ شاگردان و سایر استادان دسترسی ندارند.",
  "productivity.open": "باز",
  "productivity.done": "انجام‌شده",
  "productivity.all": "همه",
  "productivity.total": "مجموع کارها",
  "productivity.edit": "ویرایش کار",
  "productivity.new": "کار جدید",
  "productivity.taskTitle": "عنوان کار",
  "productivity.details": "یادداشت (اختیاری)",
  "productivity.dueDate": "تاریخ انجام (اختیاری)",
  "productivity.clearDueDate": "حذف تاریخ",
  "productivity.low": "اولویت پایین",
  "productivity.normal": "اولویت عادی",
  "productivity.high": "اولویت بالا",
  "productivity.offlineDraft": "پیش‌نویس کار جدید به‌صورت امن در دستگاه ذخیره می‌شود. ثبت و ویرایش کارها به اینترنت نیاز دارد.",
  "productivity.save": "ذخیره کار",
  "productivity.cancelEdit": "لغو ویرایش",
  "productivity.list": "کارها",
  "productivity.search": "جستجوی کارها",
  "productivity.empty": "در این بخش کاری یافت نشد.",
  "productivity.markDone": "علامت‌گذاری انجام‌شده",
  "productivity.reopen": "بازگشایی",
  "productivity.deleteTitle": "حذف کار؟",
  "productivity.deleteConfirm": "این کار شخصی برای همیشه حذف می‌شود.",
  "productivity.delete": "حذف",
  "productivity.invalid": "عنوان کار را وارد و محدوده متن را رعایت کنید.",
  "productivity.saved": "کار ذخیره شد.",
  "teacher.markAllRead": "همه خوانده شد",
  "teacher.onlyUnread": "فقط خوانده‌نشده",
  "teacher.allNotifications": "همه اعلان‌ها",
  "teacher.dayAtGlance": "نمای کلی روز شما",
  "teacher.attendancePending": "حاضری ثبت‌نشده",
  "teacher.nextLesson": "درس بعدی",
  "teacher.noUpcomingLesson": "برای امروز درس دیگری در پیش نیست.",
  "teacher.pendingTasks": "کارهای باقی‌مانده",
  "teacher.draftHomework": "پیش‌نویس‌های وظیفه",
  "teacher.gradesToEnter": "امتحان‌های آمادهٔ درج نمره",
  "teacher.unreadNotifications": "اطلاعیه‌های ناخوانده",
  "teacher.noPendingTasks": "فعلاً کار باقی‌مانده‌ای ندارید.",
  "teacher.quickActions": "دسترسی سریع",
  "teacher.newHomework": "ایجاد وظیفه",
  "teacher.latestAnnouncements": "آخرین اعلان‌های مکتب",
  "teacher.noAnnouncements": "فعلاً اعلانی موجود نیست.",
  "teacher.allAnnouncements": "دیدن همه اعلان‌ها",
  "teacher.notificationsCenter": "اطلاعیه‌ها",
  "teacher.noNotifications": "هنوز اطلاعیه‌ای ندارید.",
  "teacher.markRead": "نشان‌کردن به‌عنوان خوانده‌شده",
  "teacher.closeNotifications": "بستن اطلاعیه‌ها",
  "teacher.workflowHomework": "وظایف",
  "teacher.workflowGrades": "نمرات",
  "teacher.workflowAnnouncements": "اعلان‌ها",
  "teacher.classOverview": "معرفی صنف",
  "teacher.classStudents": "شاگردان",
  "teacher.classSupervision": "نظارت",
  "teacher.backToClasses": "بازگشت به صنف‌ها",
  "teacher.weeklyPeriods": "ساعات درسی هفته",
  "teacher.subjectSchedule": "تقسیم اوقات مضمون",
  "teacher.studentRosterHint": "شاگردان فعال این صنف · فقط نام و کد.",
  "teacher.studentReadOnly": "معلومات شاگرد فقط برای مشاهده است. نمرات از طریق مضمون سپرده‌شده مدیریت می‌شود.",
  "teacher.noActiveStudents": "در این صنف شاگرد فعال موجود نیست.",
  "teacher.supervisionHint": "فقط نگران فعال می‌تواند حاضری ثبت کند یا اعلان صنفی نشر کند.",
  "teacher.supervisionUnavailable": "اجازه نظارت برای امروز فعال نیست. تازه‌سازی کنید یا با اداره مکتب تماس بگیرید.",
  "teaching.workspace": "تدریس",
  "teaching.lessons": "پلان‌های درسی",
  "teaching.curriculum": "نصاب تعلیمی",
  "teaching.report": "گزارش تدریس",
  "teaching.planned": "برنامه‌ریزی‌شده",
  "teaching.completed": "تکمیل‌شده",
  "teaching.postponed": "به تعویق افتاده",
  "teaching.notStarted": "آغاز نشده",
  "teaching.inProgress": "در جریان",
  "teaching.newLesson": "پلان درس جدید",
  "teaching.editLesson": "ویرایش پلان درس",
  "teaching.topic": "موضوع درس",
  "teaching.objective": "هدف آموزشی",
  "teaching.materials": "مواد تدریسی",
  "teaching.notes": "یادداشت‌های تدریس",
  "teaching.relatedUnit": "بخش نصاب (اختیاری)",
  "teaching.noUnit": "بدون بخش",
  "teaching.saveLesson": "ذخیره پلان درس",
  "teaching.cancelEdit": "لغو ویرایش",
  "teaching.noLessons": "هنوز پلان درسی ایجاد نشده است.",
  "teaching.invalidLesson": "تاریخ، موضوع و هدف آموزشی معتبر وارد کنید.",
  "teaching.lessonSaved": "پلان درسی ذخیره شد.",
  "teaching.progressSaved": "پیشرفت نصاب به‌روزرسانی شد.",
  "teaching.curriculumHint": "بخش‌های نصاب توسط اداره مکتب تعیین می‌شوند. فقط پیشرفت تدریس خود را ثبت کنید.",
  "teaching.noUnits": "برای این صنف و مضمون بخش نصاب تعیین نشده است. از اداره مکتب درخواست کنید.",
  "teaching.unitsComplete": "بخش‌های تکمیل‌شده",
  "teaching.reportHint": "یک دوره انتخاب کنید. پیشرفت نصاب وضعیت فعلی را نشان می‌دهد.",
  "teaching.from": "از تاریخ",
  "teaching.to": "تا تاریخ",
  "teaching.generateReport": "تهیه گزارش",
  "teaching.invalidRange": "تاریخ‌های معتبر در محدوده یک سال انتخاب کنید.",
  "teaching.homeworkPublished": "وظایف نشرشده",
  "teaching.assessments": "ارزیابی‌ها",
  "teaching.progressAsOfToday": "پیشرفت نصاب وضعیت فعلی است؛ سایر ارقام مربوط به دوره انتخاب‌شده اند.",
  "teacher.workspace": "بخش آموزگار",
  "teacher.navSchedule": "تقسیم اوقات",
  "teacher.navClasses": "صنف‌ها",
  "teacher.navWorkflows": "فعالیت‌ها",
  "teacher.periodCount": "دروس امروز",
  "teacher.viewFullSchedule": "دیدن تقسیم اوقات هفته",
  "teacher.viewAssignments": "دیدن صنف‌ها و مضامین من",
  "teacher.fullSchedule": "تقسیم اوقات هفتگی من",
  "teacher.noClassesForDay": "در این روز درسی ندارید.",
  "teacher.noSchedule": "در سال تعلیمی فعال تقسیم اوقاتی برای شما ثبت نشده است.",
  "teacher.myAssignments": "صنف‌ها و مضامین سپرده‌شده به من",
  "teacher.classesCount": "صنف",
  "teacher.subjectsCount": "مضمون",
  "teacher.noAssignments": "در سال تعلیمی فعال صنف یا مضمونی به شما سپرده نشده است.",
  "teacher.negaranHint": "فقط برای صنفی که نگران آن هستید می‌توانید حاضری بگیرید یا اطلاعیهٔ صنفی نشر کنید.",
  "teacher.workflowsHint": "کارخانگی و نمرات مسوده را برای مضامین مربوط خود مدیریت کنید؛ اطلاعیهٔ صنفی فقط برای نگران فعال است.",
  "teacher.statusDraft": "مسوده",
  "teacher.statusPublished": "نشرشده",
  "teacher.statusClosed": "بسته‌شده",
  "teacher.statusArchived": "آرشیف‌شده",
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
    "parent.attendanceCalendar": "تقویم حاضری",
    "parent.attendanceCalendarHelp": "برای دیدن حاضری ثبت‌شده توسط مکتب، یک روز را انتخاب کنید.",
    "parent.attendancePrevious": "ماه قبل",
    "parent.attendanceNext": "ماه بعد",
    "parent.attendanceFuture": "هنوز ثبت نشده",
    "parent.attendanceLoadError": "حاضری بار نشد. اتصال خود را بررسی و دوباره تلاش کنید.",
    "parent.attendanceSummary": "خلاصه ماهانه",
    "parent.attendanceRate": "فیصدی حاضری",
    "parent.attendanceRateHelp": "روزهای حاضر و ناوقت تقسیم بر روزهای ثبت‌شده بدون معذوری؛ روزهای معذور و ثبت‌نشده حساب نمی‌شوند.",
    "parent.attendanceRecorded": "روزهای ثبت‌شده",
    "parent.attendanceMonthEmpty": "برای این ماه هنوز حاضری ثبت نشده است.",
    "parent.attendanceDayDetail": "جزئیات روز",
    "parent.attendanceNoNote": "مکتب یادداشتی ثبت نکرده است.",
    "parent.attendanceUnrecorded": "برای این تاریخ حاضری ثبت نشده است.",
    "parent.attendanceHistory": "تاریخچه حاضری ماهانه",
  "parent.academicAll": "همه",
  "parent.academicUpcoming": "پیش‌رو",
  "parent.academicPast": "تاریخ سپری‌شده",
  "parent.academicClosed": "بسته‌شده",
  "parent.academicHomeworkHint": "فقط کارخانگی‌های نشرشده توسط مکتب. برای دیدن رهنمود و ضمیمه روی کارخانگی بزنید.",
  "parent.academicSearchHomework": "جستجوی کارخانگی",
  "parent.academicStatusFilter": "تاریخ تحویل / وضعیت",
  "parent.academicSubjectFilter": "مضمون",
  "parent.academicAllSubjects": "همه مضامین",
  "parent.academicNoMatches": "هیچ موردی مطابق فیلترها پیدا نشد.",
  "parent.academicResultHint": "فقط نتایج نشرشده توسط مکتب قابل دید است.",
  "parent.academicExamFilter": "امتحان",
  "parent.academicAllExams": "همه امتحانات",
  "parent.academicReportedTotal": "مجموع نمرات نشان‌داده‌شده",
  "parent.academicTimetableHint": "برنامه هفتگی دروس و استادان تعیین‌شده توسط مکتب.",
  "parent.academicDayFilter": "روز",
  "parent.academicWholeWeek": "تمام هفته",
  "parent.academicPeriods": "ساعات درسی",
  "parent.academicNoPeriods": "برای این روز یا مضمون ساعت درسی پیدا نشد.",
  "parent.academicRefresh": "تازه‌سازی",
  "parent.inboxSearch": "جستجوی پیام‌ها و اطلاعیه‌ها",
  "parent.inboxAll": "همه",
  "parent.inboxUnread": "خوانده‌نشده",
  "parent.inboxRead": "خوانده‌شده",
  "parent.inboxSchool": "مکتب",
  "parent.inboxAcademics": "آموزش",
  "parent.inboxFees": "فیس",
  "parent.inboxClass": "صنف",
  "parent.inboxParents": "والدین",
  "parent.inboxAudience": "مخاطبان",
  "parent.inboxReadFilter": "وضعیت خواندن",
  "parent.inboxTopic": "دسته‌بندی",
  "parent.inboxChildAudience": "اطلاعیه‌های مربوط به فرزند انتخاب‌شده",
  "parent.inboxAccountWide": "خبرتیاهای حساب والدین و فرزندان مرتبط با شما",
  "parent.inboxLoadMore": "نمایش بیشتر",
  "parent.inboxShowing": "نمایش",
  "parent.inboxNoMatches": "پیامی مطابق فیلترها پیدا نشد.",
  "parent.inboxTargetUnavailable": "این اطلاعیه برای فرزند انتخاب‌شده دیگر قابل مشاهده نیست.",
  "parent.inboxMarkReadError": "علامت‌گذاری خبرتیاها به‌عنوان خوانده‌شده انجام نشد. دوباره تلاش کنید.",
  "parent.moreFees": "فیس‌ها",
  "parent.moreProfile": "پروفایل",
  "parent.moreSchool": "مکتب",
  "parent.morePreferences": "تنظیمات",
  "parent.moreFeesDescription": "فاکتورهای صادرشده و تاریخچه پرداخت‌های ثبت‌شده برای فرزند انتخاب‌شده.",
  "parent.moreBilled": "مبلغ صادرشده",
  "parent.moreLedgerHint": "مبالغ از دفتر حساب مکتب گرفته می‌شوند. پرداخت و تأیید آن در این برنامه ممکن نیست.",
  "parent.moreInvoices": "فاکتورها",
  "parent.moreUnpaid": "باقی‌مانده",
  "parent.moreAllInvoices": "همه فاکتورها",
  "parent.morePaid": "پرداخت‌شده",
  "parent.moreNoFilteredFees": "فاکتوری مطابق فیلتر پیدا نشد.",
  "parent.moreIssuedOn": "تاریخ صدور",
  "parent.morePaymentHistory": "تاریخچه پرداخت",
  "parent.moreNoPayments": "هیچ پرداختی ثبت نشده است.",
  "parent.moreReference": "شماره مرجع",
  "parent.moreReversalReason": "دلیل برگشت",
  "parent.morePaymentHelp": "برای پرداخت، اعتراض به حساب یا درخواست رسید با اداره مکتب تماس بگیرید. این معلومات تنها قابل مشاهده است.",
  "parent.moreProfileHint": "معلومات تأییدشده حساب والدین توسط مکتب.",
  "parent.moreParentAccount": "حساب والدین",
  "parent.moreUsername": "نام کاربری",
  "parent.moreNotProvided": "ثبت نشده",
  "parent.moreManagedBySchool": "نام، شماره تماس و پیوند فرزندان توسط مکتب مدیریت می‌شوند. برای اصلاح با اداره تماس بگیرید.",
  "parent.moreLinkedChildren": "فرزندان مرتبط",
  "parent.moreSchoolHint": "مشخصات مکتب و راه تماس با اداره مسئول.",
  "parent.moreSchoolCode": "کد مکتب",
  "parent.moreProvince": "ولایت",
  "parent.moreCity": "شهر",
  "parent.moreSchoolContactHelp": "برای اصلاح حساب، ثبت‌نام، حاضری یا فیس با مسئول اداره مکتب تماس بگیرید.",
  "parent.moreLanguage": "زبان برنامه",
  "parent.moreLanguageHint": "زبان مکتب‌لینک را در این دستگاه تغییر دهید.",
  "parent.moreSecurity": "امنیت حساب",
  "parent.moreSecurityHint": "با رمز فعلی خود، رمز حساب را تغییر دهید. آن را در اختیار دیگران قرار ندهید.",
  "parent.moreCurrentPassword": "رمز فعلی",
  "parent.moreNewPassword": "رمز جدید",
  "parent.moreConfirmPassword": "تکرار رمز جدید",
  "parent.morePasswordRules": "حداقل ۸ حرف با حرف انگلیسی، عدد و یک علامت ویژه انتخاب کنید.",
  "parent.moreCurrentRequired": "رمز فعلی را وارد کنید.",
  "parent.moreSamePassword": "رمز جدید باید متفاوت از رمز فعلی باشد.",
  "parent.morePasswordLength": "رمز جدید باید بین ۸ تا ۱۲۸ نویسه باشد.",
  "parent.moreChangePassword": "تغییر رمز",
  "parent.morePasswordFailed": "رمز تغییر نکرد. رمز فعلی یا اتصال را بررسی کرده دوباره تلاش کنید.",
  "parent.morePasswordChanged": "رمز با موفقیت تغییر کرد و نشست حساب تازه شد.",
  "parent.moreLogoutTitle": "خروج از حساب؟",
  "parent.moreLogoutConfirm": "برای دسترسی دوباره به حساب مکتب باید وارد شوید.",
  "attendance.pending": "حاضری روزانه باقی مانده",
  "attendance.submitted": "حاضری ثبت شده",
  "attendance.marked": "علامت‌گذاری شده",
  "attendance.markEveryone": "قبل از ثبت حاضری، وضعیت همه شاگردان را مشخص کنید.",
  "attendance.submit": "ثبت حاضری",
  "attendance.saved": "حاضری ذخیره شد.",
  "attendance.noChanges": "حاضری قبلاً با همین وضعیت‌ها ثبت شده است.",
  "attendance.staleSheet": "حاضری در جریان ویرایش شما تغییر کرده است. وضعیت‌های تازه بار شد؛ لطفاً آن‌ها را بررسی و دوباره ثبت کنید.",
  "attendance.markAllPresent": "علامت‌گذاری باقیمانده‌ها به حاضر",
  "attendance.bulkHint": "فقط شاگردانی که هنوز علامت ندارند حاضر می‌شوند.",
  "attendance.confirmTitle": "تأیید حاضری",
  "attendance.confirmMessage": "قبل از ثبت، این شمارش را بررسی کنید:",
  "attendance.cancel": "لغو",
  "attendance.confirmSubmit": "تأیید و ذخیره",
  "attendance.historyTitle": "تاریخچه حاضری",
  "attendance.historyError": "تاریخچه حاضری بار نشد. دوباره تلاش کنید.",
  "attendance.submittedDays": "روزهای ثبت‌شده",
  "attendance.attendanceRate": "فیصدی حاضری",
  "attendance.rateHint": "فیصدی حاضری = (حاضر + ناوقت) ÷ همه وضعیت‌های ثبت‌شده. معذور جداگانه حساب می‌شود.",
  "attendance.historyReadOnly": "حاضری روزهای گذشته فقط قابل مشاهده است. برای اصلاح به اداره مکتب مراجعه کنید.",
  "attendance.dailyTab": "امروز",
  "attendance.historyTab": "تاریخچه",
  "attendance.countsTitle": "شاگردان علامت‌گذاری‌شده",
  "attendance.locked": "حاضری این روز قفل شده است. مدیر مکتب می‌تواند آن را اصلاح کند.",
  "notifications.title": "اعلان‌ها",
  "notifications.absent": "هشدار غیابت",
  "notifications.late": "هشدار ناوقت رسیدن",
  "notifications.empty": "هیچ اعلانی وجود ندارد.",
  "notifications.homework": "وظیفه جدید",
  "notifications.results": "نتایج نشر شد",
  "student.homeTitle": "خانه شاگرد",
  "student.homeSubtitle": "خلاصه معلومات درسی شما در این مکتب.",
  "student.accountUnavailableTitle": "دسترسی شاگرد غیرفعال است",
  "student.dashboard": "در یک نگاه",
  "student.studentCode": "کد شاگرد",
  "student.class": "صنف",
  "student.academicYear": "سال تعلیمی",
  "student.todaySchedule": "برنامه امروز",
  "student.noClassesToday": "امروز درسی برنامه‌ریزی نشده است",
  "student.homeworkDue": "کارخانگی پیش‌رو",
  "student.noHomeworkDue": "کارخانگی پیش‌رو وجود ندارد",
  "student.latestResult": "آخرین نتیجه",
  "student.noPublishedResult": "هنوز نتیجه‌ای نشر نشده است",
  "student.latestAnnouncement": "آخرین اعلان",
  "student.noAnnouncements": "اعلانی موجود نیست",
  "student.unreadNotifications": "اعلان‌های ناخوانده",
  "student.noUnreadNotifications": "اعلان ناخوانده‌ای ندارید",
  "student.viewTimetable": "دیدن تقسیم اوقات",
  "student.timetableTitle": "تقسیم اوقات من",
  "student.timetableSubtitle": "برنامه هفتگی صنف شما.",
  "student.noTimetable": "هنوز تقسیم اوقاتی برای صنف شما ساخته نشده است.",
  "student.noClassesForDay": "درسی وجود ندارد",
  "student.today": "امروز",
  "student.viewHomework": "دیدن کارخانگی",
  "student.homeworkTitle": "کارخانگی من",
  "student.homeworkSubtitle": "کارهای نشرشده از طرف آموزگاران شما.",
  "student.upcomingHomework": "پیش‌رو",
  "student.pastHomework": "گذشته",
  "student.openAttachment": "باز کردن ضمیمه",
  "student.noHomework": "هنوز کارخانگی نشرشده‌ای وجود ندارد.",
  "student.viewResults": "دیدن نتایج",
  "student.resultsTitle": "نتایج من",
  "student.resultsSubtitle": "نتایج امتحان‌های نشرشده مکتب شما.",
  "student.viewAnnouncements": "دیدن اطلاعیه‌ها",
  "student.viewNotifications": "دیدن خبرتیاها",
  "student.announcementsTitle": "اطلاعیه‌ها",
  "student.notificationsTitle": "خبرتیاها",
  "student.announcementsSubtitle": "تازه‌ترین معلومات مکتب و صنف شما.",
  "student.notificationsSubtitle": "هشدارها و پیام‌های مخصوص شما.",
  "student.communicationTitle": "تازه‌های مکتب",
  "student.communicationSubtitle": "اطلاعیه‌ها و خبرتیاهای شخصی شما.",
  "student.schoolAnnouncement": "تمام مکتب",
  "student.classAnnouncement": "صنف من",
  "student.studentAnnouncement": "شاگردان",
  "student.markRead": "نشان‌کردن به‌عنوان خوانده‌شده",
  "student.read": "خوانده‌شده",
  "student.unreadOnly": "فقط ناخوانده‌ها",
  "student.showAll": "نمایش همه",
  "student.examTotal": "مجموع امتحان",
  "student.publishedOn": "نشرشده",
  "student.teacherRemark": "ملاحظه آموزگار",
  "student.noResults": "هنوز نتیجه‌ای نشر نشده است.",
  "weekday.saturday": "شنبه",
  "weekday.sunday": "یکشنبه",
  "weekday.monday": "دوشنبه",
  "weekday.tuesday": "سه‌شنبه",
  "weekday.wednesday": "چهارشنبه",
  "weekday.thursday": "پنجشنبه",
  "learning.newHomework": "وظیفه جدید",
  "learning.attachmentHint": "اختیاری: لینک HTTPS یک PDF، عکس یا ورق کار را وارد کنید. بارگذاری فایل هنوز فعال نیست.",
  "learning.searchHomework": "جستجوی عنوان یا رهنمای وظیفه",
  "learning.allStatuses": "همه وضعیت‌ها",
  "learning.openAttachment": "بازکردن لینک ضمیمه",
  "learning.useTemplate": "استفاده به‌عنوان نمونه",
  "learning.templateReady": "وظیفه به پیش‌نویس جدید کاپی شد. صنف و تاریخ تحویل را انتخاب و ذخیره کنید.",
  "learning.validAttachment": "لینک معتبر HTTPS برای ضمیمه وارد کنید (حداکثر ۵۰۰ حرف).",
  "learning.noMatchingHomework": "هیچ وظیفه‌ای با این فیلتر مطابقت ندارد.",
  "learning.noGradeChanges": "نمره جدید یا تغییریافته برای ذخیره نیست.",
  "learning.marksEntered": "نمرات ثبت‌شده",
  "learning.marksMissing": "نمرات باقی‌مانده",
  "learning.searchStudents": "جستجوی شاگرد با نام یا کد",
  "learning.showAllStudents": "نمایش همه شاگردان",
  "learning.showMissingOnly": "فقط نمرات باقی‌مانده",
  "learning.markRecorded": "ثبت شده",
  "learning.markMissing": "ثبت نشده",
  "learning.noMatchingStudents": "هیچ شاگردی با فیلتر مطابقت ندارد.",
  "learning.fileAttached": "فایل ضمیمه شد",
  "learning.fileReady": "فایل با موفقیت بارگذاری شد",
  "learning.fileUploadFailed": "فایل بارگذاری نشد. فقط PDF و عکس تا ۱ MB مجاز است.",
  "learning.removeFile": "حذف فایل",
  "learning.selectDeviceFile": "انتخاب PDF یا عکس",
  "learning.schedulePublication": "زمان‌بندی نشر (اختیاری)",
  "learning.publicationTime": "ساعت HH:mm",
  "learning.scheduleHint": "در زمان تعیین‌شده وظیفه پیش از تاریخ تحویل خودکار نشر می‌شود.",
  "learning.invalidSchedule": "زمان نشر را بعد از اکنون و پیش از موعد تحویل انتخاب کنید.",
  "learning.hideSubmissions": "پنهان کردن تسلیمی‌ها",
  "learning.reviewSubmissions": "بررسی تسلیمی‌ها",
  "learning.studentSubmissions": "وظایف سپرده‌شده شاگردان",
  "learning.noSubmissions": "هنوز تسلیمی موجود نیست.",
  "learning.feedback": "نظر معلم",
  "learning.feedbackRequired": "لطفاً نظر خود را بنویسید.",
  "learning.markReviewed": "تأیید بررسی",
  "learning.requestRevision": "درخواست اصلاح",
  "learning.feedbackSaved": "نظر ثبت شد.",
  "learning.continuousAssessments": "ارزیابی‌های دوامدار",
  "learning.assessmentHint": "کوئیز و کار صنفی از نمرات رسمی امتحان جدا هستند.",
  "learning.assessmentTitle": "عنوان ارزیابی",
  "learning.assessmentInvalid": "عنوان، تاریخ و نمره اعظمی معتبر وارد کنید.",
  "learning.assessmentCreated": "ارزیابی ایجاد شد.",
  "learning.assessmentSaved": "نمرات ارزیابی ثبت شد.",
  "learning.createAssessment": "ایجاد ارزیابی",
  "learning.assessmentList": "ارزیابی‌های من",
  "learning.noAssessments": "هنوز ارزیابی موجود نیست.",
  "learning.categoryQUIZ": "کوئیز",
  "learning.categoryCLASSWORK": "کار صنفی",
  "learning.categoryHOMEWORK": "وظیفه خانگی",
  "learning.categoryPARTICIPATION": "اشتراک در صنف",
  "learning.categoryMONTHLY": "ماهانه",
  "learning.studentSubmitAction": "سپردن وظیفه",
  "learning.submissionStatus": "وضعیت تسلیمی",
  "learning.studentAnswer": "پاسخ خود را بنویسید",
  "learning.submissionInvalid": "پیش از موعد پاسخ یا ضمیمه اضافه کنید.",
  "learning.submissionSaved": "وظیفه سپرده شد.",
  "learning.submissionFailed": "سپردن یا دریافت وظیفه ممکن نشد. اتصال یا موعد را بررسی کنید.",
  "learning.submissionClosed": "مهلت سپردن این وظیفه پایان یافته است.",
  "learning.homework": "وظیفه",
  "learning.homeworkHint": "فقط برای مضمون و صنفی که به شما سپرده شده وظیفه بسازید.",
  "learning.assignments": "تکالیف تدریس",
  "learning.createHomework": "ایجاد وظیفه",
  "learning.editHomework": "ویرایش وظیفه پیش‌نویس",
  "learning.homeworkTitle": "عنوان وظیفه",
  "learning.instructions": "دستورالعمل",
  "learning.dueDate": "انتخاب تاریخ تحویل",
  "learning.pickDueDate": "انتخاب تاریخ تحویل",
  "learning.previousMonth": "ماه قبل",
  "learning.nextMonth": "ماه بعد",
  "learning.closeCalendar": "بستن تقویم",
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
  "learning.statusChanged": "این کارخانگی در جای دیگر تغییر کرده یا خودکار نشر شده است. وضعیت تازهٔ آن بار شد.",
  "learning.confirmPublish": "این کارخانگی نشر شود؟ والدین و شاگردان خبر می‌شوند و متن آن دیگر قابل ویرایش نیست.",
  "learning.confirmClose": "این کارخانگی بسته شود؟ شاگردان دیگر نمی‌توانند پاسخ بفرستند.",
  "learning.confirmArchive": "این کارخانگی آرشیف شود؟ از صفحهٔ والدین و شاگردان پنهان می‌شود، ولی در سابقهٔ معلم باقی می‌ماند.",
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
  "fees.statusDraft": "پیش‌نویس",
  "fees.statusIssued": "صادرشده",
  "fees.statusPartiallyPaid": "قسمتاً پرداخت‌شده",
  "fees.statusPaid": "پرداخت‌شده",
  "fees.statusOverdue": "از موعد گذشته",
  "fees.statusCancelled": "لغوشده",
  "fees.payment": "پرداخت",
  "fees.reversal": "برگشت پرداخت",
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
  "suspension.title": "حساب تعلیق شده است",
  "suspension.contactHint": "امکانات مکتب شما موقتاً غیرفعال است. برای فعال‌سازی دوباره حساب، از راه‌های زیر با مدیریت مکتب تماس بگیرید.",
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
  "parent.dashboard": "په یوه نظر",
  "parent.todaySchedule": "د نن ورځې مهالویش",
  "parent.noClassesToday": "نن درس نه دی ټاکل شوی",
  "parent.homeworkDue": "راتلونکی کورنی کار",
  "parent.noHomeworkDue": "راتلونکی کورنی کار نشته",
  "parent.nextExam": "راتلونکې ازموینه",
  "parent.examScheduleUnavailable": "د ازموینو نېټې په اوسني MVP کې نه مهالویش کېږي",
  "parent.latestResult": "وروستۍ پایله",
  "parent.noPublishedResult": "تر اوسه کومه پایله نه ده خپره شوې",
  "parent.feeStatus": "د فیس حالت",
  "parent.noOutstandingFees": "پاتې فیس نشته",
  "parent.latestAnnouncement": "وروستی اعلان",
  "parent.noAnnouncements": "د دې زده‌کوونکي لپاره اعلان نشته",
  "parent.moreItems": "نور",
  "parent.navAcademics": "زده کړې",
  "parent.navAttendance": "حاضري",
  "parent.navInbox": "پیغامونه",
  "parent.navTimetable": "مهالوېش",
  "parent.noTimetable": "مهالوېش لا نه دی خپور شوی.",
  "parent.refreshHome": "کور تازه کړئ",
  "parent.actionRequired": "ستاسو پاملرنې ته اړتیا لري",
  "parent.noAlerts": "اوس مهال بېړنۍ موضوع نشته",
  "parent.someDataUnavailable": "ځینې معلومات بار نه شول؛ کارتونه جلا بیا وازمویئ.",
  "parent.alertAbsent": "نن غیر حاضر",
  "parent.alertLate": "نن ناوخته",
  "parent.alertHomeworkToday": "د کورنۍ دندې وروستۍ ورځ نن ده",
  "parent.alertHomeworkTomorrow": "د کورنۍ دندې وروستۍ ورځ سبا ده",
  "parent.alertFeeOverdue": "د پاتې فیس نېټه تېره شوې ده",
  "parent.alertFeeSoon": "د فیس د ورکړې نېټه رانږدې ده",
  "parent.alertUnread": "تاسو نالوستې خبرتیاوې لرئ",
  "parent.unavailable": "معلومات نشته",
  "parent.tryAgain": "بیا هڅه وکړئ",
  "parent.viewDetails": "تفصیل وګورئ",
  "parent.unreadNotifications": "نالوستې خبرتیاوې",
  "parent.viewAllNotifications": "ټولې خبرتیاوې وګورئ",
  "parent.navHome": "کور",
  "parent.navHomework": "کورنی کار",
  "parent.navAnnouncements": "اعلانونه",
  "parent.navMore": "نور",
  "parent.moreTitle": "نور",
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
  "productivity.title": "زما شخصي کارونه",
  "productivity.privateHint": "یوازې ستاسو د ښوونکي حساب ته ښکاري؛ زده کوونکي او نور ښوونکي یې نه ویني.",
  "productivity.open": "پرانېستي",
  "productivity.done": "بشپړ",
  "productivity.all": "ټول",
  "productivity.total": "ټول کارونه",
  "productivity.edit": "کار سم کړئ",
  "productivity.new": "نوی کار",
  "productivity.taskTitle": "د کار سرلیک",
  "productivity.details": "یادښت (اختیاري)",
  "productivity.dueDate": "د ترسره کولو نېټه (اختیاري)",
  "productivity.clearDueDate": "نېټه پاکه کړئ",
  "productivity.low": "ټیټ لومړیتوب",
  "productivity.normal": "عادي لومړیتوب",
  "productivity.high": "لوړ لومړیتوب",
  "productivity.offlineDraft": "د نوي کار مسوده په دې وسیله کې خوندي ساتل کېږي. د کار ثبت او سمون انټرنېټ ته اړتیا لري.",
  "productivity.save": "کار خوندي کړئ",
  "productivity.cancelEdit": "سمون لغوه کړئ",
  "productivity.list": "کارونه",
  "productivity.search": "کارونه ولټوئ",
  "productivity.empty": "دلته کوم کار ونه موندل شو.",
  "productivity.markDone": "بشپړ په نښه کړئ",
  "productivity.reopen": "بېرته پرانیزئ",
  "productivity.deleteTitle": "کار حذف شي؟",
  "productivity.deleteConfirm": "دا شخصي کار به د تل لپاره حذف شي.",
  "productivity.delete": "حذف",
  "productivity.invalid": "د کار سرلیک او د متن ټاکلي حدود مراعات کړئ.",
  "productivity.saved": "کار خوندي شو.",
  "teacher.markAllRead": "ټول لوستل شوي",
  "teacher.onlyUnread": "یوازې نالوستل شوي",
  "teacher.allNotifications": "ټول خبرتیاوې",
  "teacher.dayAtGlance": "ستاسو د ورځې لنډیز",
  "teacher.attendancePending": "نا ثبت شوې حاضري",
  "teacher.nextLesson": "راتلونکی درس",
  "teacher.noUpcomingLesson": "نن نور ټاکل شوي درسونه نشته.",
  "teacher.pendingTasks": "پاتې چارې",
  "teacher.draftHomework": "د کورنۍ دندې مسودې",
  "teacher.gradesToEnter": "د نمرو لپاره پرانیستې ازموینې",
  "teacher.unreadNotifications": "نه لوستل شوې خبرتیاوې",
  "teacher.noPendingTasks": "ستاسو اوسني کارونه بشپړ دي.",
  "teacher.quickActions": "چټکې چارې",
  "teacher.newHomework": "کورنۍ دنده جوړول",
  "teacher.latestAnnouncements": "د ښوونځي وروستي اعلانونه",
  "teacher.noAnnouncements": "اوس مهال اعلان نشته.",
  "teacher.allAnnouncements": "ټول اعلانونه وګورئ",
  "teacher.notificationsCenter": "خبرتیاوې",
  "teacher.noNotifications": "تراوسه خبرتیا نشته.",
  "teacher.markRead": "د لوستل شوې په توګه نښه کول",
  "teacher.closeNotifications": "خبرتیاوې بندول",
  "teacher.workflowHomework": "کورنۍ دندې",
  "teacher.workflowGrades": "نمرې",
  "teacher.workflowAnnouncements": "اعلانونه",
  "teacher.classOverview": "د ټولګي پېژندنه",
  "teacher.classStudents": "زده کوونکي",
  "teacher.classSupervision": "څارنه",
  "teacher.backToClasses": "بېرته خپلو ټولګیو ته",
  "teacher.weeklyPeriods": "د اونۍ درسي ساعتونه",
  "teacher.subjectSchedule": "د مضمون مهالویش",
  "teacher.studentRosterHint": "د دې ټولګي فعال زده کوونکي · یوازې نوم او کوډ.",
  "teacher.studentReadOnly": "د زده کوونکي معلومات یوازې د لیدو لپاره دي. نمرې د ټاکل شوي مضمون له لارې اداره کېږي.",
  "teacher.noActiveStudents": "په دې ټولګي کې فعال زده کوونکي نشته.",
  "teacher.supervisionHint": "یوازې فعال نګران حاضري ثبتولای او د ټولګي اعلان خپرولای شي.",
  "teacher.supervisionUnavailable": "د نن ورځې د څارنې اجازه فعاله نه ده. تازه یې کړئ یا له ادارې سره اړیکه ونیسئ.",
  "teaching.workspace": "تدریس",
  "teaching.lessons": "درسي پلانونه",
  "teaching.curriculum": "تعلیمي نصاب",
  "teaching.report": "د تدریس راپور",
  "teaching.planned": "پلان شوی",
  "teaching.completed": "بشپړ شوی",
  "teaching.postponed": "ځنډېدلی",
  "teaching.notStarted": "نه دی پیل شوی",
  "teaching.inProgress": "روان دی",
  "teaching.newLesson": "د درس نوی پلان",
  "teaching.editLesson": "د درس پلان سمول",
  "teaching.topic": "د درس موضوع",
  "teaching.objective": "د زده کړې موخه",
  "teaching.materials": "درسي توکي",
  "teaching.notes": "د تدریس یادښتونه",
  "teaching.relatedUnit": "د نصاب برخه (اختیاري)",
  "teaching.noUnit": "بې برخې",
  "teaching.saveLesson": "د درس پلان خوندي کړئ",
  "teaching.cancelEdit": "سمون لغوه کړئ",
  "teaching.noLessons": "تراوسه درسي پلان نشته.",
  "teaching.invalidLesson": "د درس نېټه، موضوع او د زده کړې موخه سمه ولیکئ.",
  "teaching.lessonSaved": "درسي پلان خوندي شو.",
  "teaching.progressSaved": "د نصاب پرمختګ تازه شو.",
  "teaching.curriculumHint": "د نصاب برخې اداره ټاکي. یوازې خپل تدریسي پرمختګ ثبت کړئ.",
  "teaching.noUnits": "د دې ټولګي او مضمون لپاره د نصاب برخې نشته. له ادارې یې وغواړئ.",
  "teaching.unitsComplete": "بشپړې شوې برخې",
  "teaching.reportHint": "یوه موده وټاکئ. د نصاب پرمختګ اوسنی حالت ښيي.",
  "teaching.from": "له نېټې",
  "teaching.to": "تر نېټې",
  "teaching.generateReport": "راپور جوړ کړئ",
  "teaching.invalidRange": "د راپور سمې نېټې وټاکئ، تر یوه کال پورې.",
  "teaching.homeworkPublished": "خپرې شوې دندې",
  "teaching.assessments": "ارزونې",
  "teaching.progressAsOfToday": "د نصاب پرمختګ اوسنی حالت دی؛ نورې شمېرې د ټاکلې مودې دي.",
  "teacher.workspace": "د ښوونکي برخه",
  "teacher.navSchedule": "مهالویش",
  "teacher.navClasses": "ټولګي",
  "teacher.navWorkflows": "چارې",
  "teacher.periodCount": "د نن درسونه",
  "teacher.viewFullSchedule": "د اونۍ بشپړ مهالویش",
  "teacher.viewAssignments": "زما ټولګي او مضمونونه",
  "teacher.fullSchedule": "زما اونیز مهالویش",
  "teacher.noClassesForDay": "په دې ورځ درس نه لرئ.",
  "teacher.noSchedule": "په فعال ښوونیز کال کې ستاسو لپاره مهالویش نشته.",
  "teacher.myAssignments": "زما ټاکل شوي ټولګي او مضمونونه",
  "teacher.classesCount": "ټولګي",
  "teacher.subjectsCount": "مضمونونه",
  "teacher.noAssignments": "په فعال کال کې تاسو ته مضمون یا ټولګی نه دی ټاکل شوی.",
  "teacher.negaranHint": "یوازې هغه ټولګی چې تاسو یې نګران یاست، د حاضري او ټولګي اعلان اجازه لري.",
  "teacher.workflowsHint": "د خپلو درسونو کورنۍ دندې او مسوده نمرې تنظیم کړئ؛ د ټولګي اعلان د فعال نګران لپاره دی.",
  "teacher.statusDraft": "مسوده",
  "teacher.statusPublished": "خپور شوی",
  "teacher.statusClosed": "تړل شوی",
  "teacher.statusArchived": "آرشیف شوی",
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
    "parent.attendanceCalendar": "د حاضرۍ کلیزه",
    "parent.attendanceCalendarHelp": "د ښوونځي ثبت شوې حاضري د لیدلو لپاره ورځ وټاکئ.",
    "parent.attendancePrevious": "تېره میاشت",
    "parent.attendanceNext": "راتلونکې میاشت",
    "parent.attendanceFuture": "لا نه ده ثبت شوې",
    "parent.attendanceLoadError": "حاضري پورته نه شوه. خپله اړیکه وګورئ او بیا هڅه وکړئ.",
    "parent.attendanceSummary": "میاشتنۍ لنډیز",
    "parent.attendanceRate": "د حاضرۍ سلنه",
    "parent.attendanceRateHelp": "حاضر او ناوخته ورځې پر ثبت شویو غیرمعذورو ورځو وېشل کېږي؛ معذورې او ناثبت شوې ورځې نه شمېرل کېږي.",
    "parent.attendanceRecorded": "ثبت شوې ورځې",
    "parent.attendanceMonthEmpty": "په دې میاشت کې تر اوسه حاضري نه ده ثبت شوې.",
    "parent.attendanceDayDetail": "د ورځې جزییات",
    "parent.attendanceNoNote": "ښوونځي هېڅ یادښت نه دی ثبت کړی.",
    "parent.attendanceUnrecorded": "د دې نېټې حاضري نه ده ثبت شوې.",
    "parent.attendanceHistory": "د میاشتې د حاضرۍ تاریخچه",
  "parent.academicAll": "ټول",
  "parent.academicUpcoming": "راتلونکي",
  "parent.academicPast": "نېټه تېره شوې",
  "parent.academicClosed": "تړل شوي",
  "parent.academicHomeworkHint": "یوازې د ښوونځي خپاره شوي کورني کارونه. د لارښوونو او ضمیمو لپاره پر کار کلیک وکړئ.",
  "parent.academicSearchHomework": "د کورني کار لټون",
  "parent.academicStatusFilter": "سپارلو نېټه / حالت",
  "parent.academicSubjectFilter": "مضمون",
  "parent.academicAllSubjects": "ټول مضمونونه",
  "parent.academicNoMatches": "د دې چاڼونو لپاره هېڅ توکي ونه موندل شول.",
  "parent.academicResultHint": "یوازې د ښوونځي خپرې شوې پایلې ښکاري.",
  "parent.academicExamFilter": "ازموینه",
  "parent.academicAllExams": "ټولې ازموینې",
  "parent.academicReportedTotal": "د ښودل شوو نمرو مجموعه",
  "parent.academicTimetableHint": "د ښوونځي له خوا ټاکل شوی اوونیز درسي مهالویش او ښوونکي.",
  "parent.academicDayFilter": "ورځ",
  "parent.academicWholeWeek": "ټوله اونۍ",
  "parent.academicPeriods": "درسي ساعتونه",
  "parent.academicNoPeriods": "د دې ورځې یا مضمون لپاره درسي ساعتونه نشته.",
  "parent.academicRefresh": "بیا تازه کول",
  "parent.inboxSearch": "د پیغامونو او خبرتیاوو لټون",
  "parent.inboxAll": "ټول",
  "parent.inboxUnread": "نالوستل شوي",
  "parent.inboxRead": "لوستل شوي",
  "parent.inboxSchool": "ښوونځی",
  "parent.inboxAcademics": "زده‌کړې",
  "parent.inboxFees": "فیس",
  "parent.inboxClass": "ټولګی",
  "parent.inboxParents": "والدین",
  "parent.inboxAudience": "اورېدونکي",
  "parent.inboxReadFilter": "د لوستلو حالت",
  "parent.inboxTopic": "ډله",
  "parent.inboxChildAudience": "د ټاکل شوي ماشوم خبرتیاوې",
  "parent.inboxAccountWide": "ستاسو د والدینو حساب او تړلو ماشومانو خبرتیاوې",
  "parent.inboxLoadMore": "نور ښکاره کړئ",
  "parent.inboxShowing": "ښودل کېږي",
  "parent.inboxNoMatches": "د فلټر سره سم پیغامونه ونه موندل شول.",
  "parent.inboxTargetUnavailable": "دا خبرتیا د ټاکل شوي ماشوم لپاره نوره نه شته.",
  "parent.inboxMarkReadError": "د خبرتیاوو د لوستل کېدو نښه ونه لګېده. بیا هڅه وکړئ.",
  "parent.moreFees": "فیسونه",
  "parent.moreProfile": "پروفایل",
  "parent.moreSchool": "ښوونځی",
  "parent.morePreferences": "تنظیمات",
  "parent.moreFeesDescription": "د ټاکل شوي ماشوم صادر شوي بلونه او ثبت شوې ورکړې.",
  "parent.moreBilled": "ټول بل شوی",
  "parent.moreLedgerHint": "پیسې د ښوونځي له حسابه اخیستل کېږي. په دې اپ کې د پیسو ورکول یا تاییدول نشته.",
  "parent.moreInvoices": "بلونه",
  "parent.moreUnpaid": "پاتې پیسې",
  "parent.moreAllInvoices": "ټول بلونه",
  "parent.morePaid": "ورکړل شوي",
  "parent.moreNoFilteredFees": "د دې فلټر لپاره بل ونه موندل شو.",
  "parent.moreIssuedOn": "د صدور نېټه",
  "parent.morePaymentHistory": "د ورکړو تاریخچه",
  "parent.moreNoPayments": "هیڅ ورکړه نه ده ثبت شوې.",
  "parent.moreReference": "د حوالې شمېره",
  "parent.moreReversalReason": "د بېرته ګرځولو لامل",
  "parent.morePaymentHelp": "د ورکړې، د حساب د اعتراض یا رسید لپاره د ښوونځي له ادارې سره اړیکه ونیسئ. معلومات یوازې د لوستلو دي.",
  "parent.moreProfileHint": "ستاسو د ښوونځي له خوا تایید شوي د والدینو حساب معلومات.",
  "parent.moreParentAccount": "د والدینو حساب",
  "parent.moreUsername": "کارن نوم",
  "parent.moreNotProvided": "نه دی ورکړل شوی",
  "parent.moreManagedBySchool": "نوم، ټیلیفون او د ماشومانو تړاو د ښوونځي له خوا اداره کېږي. د سمون لپاره له ادارې سره اړیکه ونیسئ.",
  "parent.moreLinkedChildren": "تړلي ماشومان",
  "parent.moreSchoolHint": "د ښوونځي مالومات او د مسؤول ادارې د اړیکې لاره.",
  "parent.moreSchoolCode": "د ښوونځي کوډ",
  "parent.moreProvince": "ولایت",
  "parent.moreCity": "ښار",
  "parent.moreSchoolContactHelp": "د حساب، نوم لیکنې، حاضرۍ یا فیس د سمون لپاره له ادارې سره اړیکه ونیسئ.",
  "parent.moreLanguage": "د اپ ژبه",
  "parent.moreLanguageHint": "په دې وسیله د مکتب‌لینک ژبه بدله کړئ.",
  "parent.moreSecurity": "د حساب امنیت",
  "parent.moreSecurityHint": "د اوسني پټنوم په کارولو نوی پټنوم جوړ کړئ. له نورو سره یې مه شریکوئ.",
  "parent.moreCurrentPassword": "اوسنی پټنوم",
  "parent.moreNewPassword": "نوی پټنوم",
  "parent.moreConfirmPassword": "نوی پټنوم بیا ولیکئ",
  "parent.morePasswordRules": "لږ تر لږه ۸ توري، یو انګلیسي توری، شمېره او ځانګړې نښه پکار دي.",
  "parent.moreCurrentRequired": "اوسنی پټنوم ولیکئ.",
  "parent.moreSamePassword": "نوی پټنوم باید له اوسني سره توپیر ولري.",
  "parent.morePasswordLength": "نوی پټنوم باید د ۸ او ۱۲۸ تورو ترمنځ وي.",
  "parent.moreChangePassword": "پټنوم بدلول",
  "parent.morePasswordFailed": "پټنوم بدل نه شو. خپل اوسنی پټنوم یا اړیکه وګورئ او بیا هڅه وکړئ.",
  "parent.morePasswordChanged": "پټنوم بدل شو او د حساب ناسته تازه شوه.",
  "parent.moreLogoutTitle": "له حسابه ووځئ؟",
  "parent.moreLogoutConfirm": "د ښوونځي حساب ته د بیا ننوتلو لپاره باید لاګین وکړئ.",
  "attendance.pending": "ورځنۍ حاضري پاتې ده",
  "attendance.submitted": "حاضري ثبت شوې",
  "attendance.marked": "نښه شوي",
  "attendance.markEveryone": "د حاضري له ثبتولو مخکې د ټولو زده کوونکو حالت وټاکئ.",
  "attendance.submit": "حاضري ثبت کړئ",
  "attendance.saved": "حاضري خوندي شوه.",
  "attendance.noChanges": "حاضري مخکې له همدې حالتونو سره ثبت شوې ده.",
  "attendance.staleSheet": "ستاسو د سمون پر مهال حاضري بدله شوې ده. وروستي حالتونه بیا پورته شول؛ مهرباني وکړئ ویې ګورئ او بیا یې ثبت کړئ.",
  "attendance.markAllPresent": "نا نښه شوي حاضر کړئ",
  "attendance.bulkHint": "یوازې هغه زده کوونکي حاضر کېږي چې لا نه دي نښه شوي.",
  "attendance.confirmTitle": "د حاضرۍ تایید",
  "attendance.confirmMessage": "له ثبت وړاندې دا شمېرې وګورئ:",
  "attendance.cancel": "لغوه",
  "attendance.confirmSubmit": "تایید او خوندي کول",
  "attendance.historyTitle": "د حاضرۍ مخینه",
  "attendance.historyError": "د حاضرۍ مخینه پورته نه شوه. بیا هڅه وکړئ.",
  "attendance.submittedDays": "ثبت شوې ورځې",
  "attendance.attendanceRate": "د حاضرۍ سلنه",
  "attendance.rateHint": "د حاضرۍ سلنه = (حاضر + ناوخته) ÷ ټولې ثبت شوې نښې. معذور جلا شمېرل کېږي.",
  "attendance.historyReadOnly": "د تېرو ورځو حاضري یوازې د لیدو لپاره ده. د سمون لپاره د ښوونځي ادارې ته ورشئ.",
  "attendance.dailyTab": "نن",
  "attendance.historyTab": "مخینه",
  "attendance.countsTitle": "نښه شوي زده کوونکي",
  "attendance.locked": "د دې ورځې حاضري تړل شوې ده. د ښوونځي مدیر یې اصلاح کولی شي.",
  "notifications.title": "خبرتیاوې",
  "notifications.absent": "د غیابت خبرتیا",
  "notifications.late": "د ناوخته راتګ خبرتیا",
  "notifications.empty": "خبرتیا نشته.",
  "notifications.homework": "نوې کورنۍ دنده",
  "notifications.results": "پایلې خپرې شوې",
  "student.homeTitle": "د زده کوونکي کور",
  "student.homeSubtitle": "په دې ښوونځي کې ستاسو د زده کړو لنډیز.",
  "student.accountUnavailableTitle": "د زده کوونکي لاسرسی فعال نه دی",
  "student.dashboard": "په یوه نظر",
  "student.studentCode": "د زده کوونکي کوډ",
  "student.class": "ټولګی",
  "student.academicYear": "تعلیمي کال",
  "student.todaySchedule": "د نن ورځې مهالویش",
  "student.noClassesToday": "نن درس نشته",
  "student.homeworkDue": "راتلونکې کورنۍ دنده",
  "student.noHomeworkDue": "راتلونکې کورنۍ دنده نشته",
  "student.latestResult": "وروستۍ پایله",
  "student.noPublishedResult": "تر اوسه پایله نه ده خپره شوې",
  "student.latestAnnouncement": "وروستی اعلان",
  "student.noAnnouncements": "اعلان نشته",
  "student.unreadNotifications": "نه لوستل شوې خبرتیاوې",
  "student.noUnreadNotifications": "ټولې خبرتیاوې مو لوستې دي",
  "student.viewTimetable": "مهالویش وګورئ",
  "student.timetableTitle": "زما مهالویش",
  "student.timetableSubtitle": "ستاسو د ټولګي اوونیز مهالویش.",
  "student.noTimetable": "ستاسو د ټولګي لپاره تر اوسه مهالویش نه دی جوړ شوی.",
  "student.noClassesForDay": "درس نشته",
  "student.today": "نن",
  "student.viewHomework": "کورنۍ دنده وګورئ",
  "student.homeworkTitle": "زما کورنۍ دنده",
  "student.homeworkSubtitle": "ستاسو د ښوونکو له خوا خپرې شوې دندې.",
  "student.upcomingHomework": "راتلونکې",
  "student.pastHomework": "تېرې شوې",
  "student.openAttachment": "ضمیمه پرانیزئ",
  "student.noHomework": "تر اوسه خپره شوې کورنۍ دنده نشته.",
  "student.viewResults": "پایلې وګورئ",
  "student.resultsTitle": "زما پایلې",
  "student.resultsSubtitle": "ستاسو د ښوونځي خپرې شوې ازموینې پایلې.",
  "student.viewAnnouncements": "اعلانونه وګورئ",
  "student.viewNotifications": "خبرتیاوې وګورئ",
  "student.announcementsTitle": "اعلانونه",
  "student.notificationsTitle": "خبرتیاوې",
  "student.announcementsSubtitle": "ستاسو د ښوونځي او ټولګي خبرونه.",
  "student.notificationsSubtitle": "ستاسو شخصي خبرتیاوې او تازه معلومات.",
  "student.communicationTitle": "د ښوونځي خبرونه",
  "student.communicationSubtitle": "اعلانونه او شخصي خبرتیاوې.",
  "student.schoolAnnouncement": "ټول ښوونځی",
  "student.classAnnouncement": "زما ټولګی",
  "student.studentAnnouncement": "زده کوونکي",
  "student.markRead": "لوستل شوې وښایئ",
  "student.read": "لوستل شوې",
  "student.unreadOnly": "یوازې نه لوستل شوې",
  "student.showAll": "ټولې وښایئ",
  "student.examTotal": "د ازموینې ټولټال",
  "student.publishedOn": "خپره شوې",
  "student.teacherRemark": "د ښوونکي یادونه",
  "student.noResults": "تر اوسه پایله نه ده خپره شوې.",
  "weekday.saturday": "شنبه",
  "weekday.sunday": "یکشنبه",
  "weekday.monday": "دوشنبه",
  "weekday.tuesday": "سې‌شنبه",
  "weekday.wednesday": "چهارشنبه",
  "weekday.thursday": "پنجشنبه",
  "learning.newHomework": "نوې کورنۍ دنده",
  "learning.attachmentHint": "اختیاري: د PDF، انځور یا کاري پاڼې HTTPS لینک ولیکئ. د فایل پورته کول لا نه دي فعال.",
  "learning.searchHomework": "د کورنۍ دندې سرلیک یا لارښوونې ولټوئ",
  "learning.allStatuses": "ټول حالتونه",
  "learning.openAttachment": "د ضمیمې لینک پرانیزئ",
  "learning.useTemplate": "د بېلګې په توګه کارول",
  "learning.templateReady": "کورنۍ دنده نوې مسودې ته کاپي شوه. ټولګی او د سپارلو نېټه وټاکئ، بیا یې خوندي کړئ.",
  "learning.validAttachment": "د ضمیمې سم HTTPS لینک ورکړئ (تر ۵۰۰ تورو).",
  "learning.noMatchingHomework": "له دې فلټر سره برابره کورنۍ دنده نشته.",
  "learning.noGradeChanges": "د خوندي کولو لپاره نوې یا بدله شوې نمره نشته.",
  "learning.marksEntered": "ثبت شوې نمرې",
  "learning.marksMissing": "پاتې نمرې",
  "learning.searchStudents": "د نوم یا کوډ له مخې زده کوونکي ولټوئ",
  "learning.showAllStudents": "ټول زده کوونکي وښیئ",
  "learning.showMissingOnly": "یوازې پاتې نمرې وښیئ",
  "learning.markRecorded": "ثبت شوې",
  "learning.markMissing": "نه ده ثبت شوې",
  "learning.noMatchingStudents": "له دې فلټر سره زده کوونکی نشته.",
  "learning.fileAttached": "فایل ضمیمه شو",
  "learning.fileReady": "فایل په بریالیتوب پورته شو",
  "learning.fileUploadFailed": "فایل پورته نشو. یوازې PDF او انځور تر ۱ MB پورې منل کېږي.",
  "learning.removeFile": "فایل لرې کول",
  "learning.selectDeviceFile": "PDF یا انځور ټاکل",
  "learning.schedulePublication": "د خپرولو مهالویش (اختیاري)",
  "learning.publicationTime": "وخت HH:mm",
  "learning.scheduleHint": "په ټاکلي وخت کې د سپارلو تر نېټې مخکې دنده په خپله خپرېږي.",
  "learning.invalidSchedule": "د خپرولو وخت باید راتلونکی او د سپارلو له نېټې مخکې وي.",
  "learning.hideSubmissions": "سپارنې پټول",
  "learning.reviewSubmissions": "سپارنې کتل",
  "learning.studentSubmissions": "د زده کوونکو سپارنې",
  "learning.noSubmissions": "تر اوسه کومه سپارنه نشته.",
  "learning.feedback": "د ښوونکي نظر",
  "learning.feedbackRequired": "لومړی خپل نظر ولیکئ.",
  "learning.markReviewed": "کتل شوې نښه کول",
  "learning.requestRevision": "د سمون غوښتنه",
  "learning.feedbackSaved": "نظر خوندي شو.",
  "learning.continuousAssessments": "دوامدارې ارزونې",
  "learning.assessmentHint": "کوېزونه او ټولګیز کارونه له رسمي ازموینو جلا دي.",
  "learning.assessmentTitle": "د ارزونې سرلیک",
  "learning.assessmentInvalid": "سرلیک، نېټه او اعظمي نمره ولیکئ.",
  "learning.assessmentCreated": "ارزونه جوړه شوه.",
  "learning.assessmentSaved": "د ارزونې نمرې خوندي شوې.",
  "learning.createAssessment": "ارزونه جوړول",
  "learning.assessmentList": "زما ارزونې",
  "learning.noAssessments": "تر اوسه ارزونه نشته.",
  "learning.categoryQUIZ": "کوېز",
  "learning.categoryCLASSWORK": "ټولګیز کار",
  "learning.categoryHOMEWORK": "کورنۍ دنده",
  "learning.categoryPARTICIPATION": "ګډون",
  "learning.categoryMONTHLY": "میاشتنۍ",
  "learning.studentSubmitAction": "دنده سپارل",
  "learning.submissionStatus": "د سپارنې حالت",
  "learning.studentAnswer": "خپل ځواب ولیکئ",
  "learning.submissionInvalid": "له وخته مخکې ځواب یا ضمیمه ورکړئ.",
  "learning.submissionSaved": "دنده وسپارل شوه.",
  "learning.submissionFailed": "دنده ونه سپارل شوه. انټرنېټ یا وخت وګورئ.",
  "learning.submissionClosed": "د دې دندې د سپارلو وخت پای ته رسېدلی.",
  "learning.homework": "کورنۍ دنده",
  "learning.homeworkHint": "یوازې د خپلو فعالو مضمون او ټولګي دندو لپاره کار جوړ کړئ.",
  "learning.assignments": "د تدریس دندې",
  "learning.createHomework": "کورنۍ دنده جوړه کړئ",
  "learning.editHomework": "مسوده دنده سمول",
  "learning.homeworkTitle": "د دندې سرلیک",
  "learning.instructions": "لارښوونې",
  "learning.dueDate": "د سپارلو نېټه وټاکئ",
  "learning.pickDueDate": "د سپارلو نېټه وټاکئ",
  "learning.previousMonth": "تېره میاشت",
  "learning.nextMonth": "راتلونکې میاشت",
  "learning.closeCalendar": "کلیز بندول",
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
  "learning.statusChanged": "دا کورنۍ دنده بل ځای بدله شوې یا په اتومات ډول خپره شوې ده. نوی حالت یې بیا پورته شو.",
  "learning.confirmPublish": "دا کورنۍ دنده خپره شي؟ زده کوونکي او والدین به خبر شي او متن به یې نور د سمون وړ نه وي.",
  "learning.confirmClose": "دا کورنۍ دنده وتړل شي؟ زده کوونکي به نور ځوابونه نه شي سپارلی.",
  "learning.confirmArchive": "دا کورنۍ دنده آرشیف شي؟ د والدینو او زده کوونکو له لېست څخه به پټه شي، خو د ښوونکي په تاریخچه کې به پاتې وي.",
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
  "fees.statusDraft": "مسوده",
  "fees.statusIssued": "صادر شوی",
  "fees.statusPartiallyPaid": "یوه برخه ورکړل شوې",
  "fees.statusPaid": "ورکړل شوی",
  "fees.statusOverdue": "له مودې تېر",
  "fees.statusCancelled": "لغوه شوی",
  "fees.payment": "تادیه",
  "fees.reversal": "د تادیې بېرته ګرځول",
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
  "suspension.title": "حساب ځنډول شوی دی",
  "suspension.contactHint": "ستاسو د ښوونځي ځانګړتیاوې لنډمهاله غیرفعاله دي. د حساب د بیا فعالولو لپاره لاندې د ښوونځي له ادارې سره اړیکه ونیسئ.",
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

const latinDigits = "0123456789";
const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";

export function localizeDigits(value: string | number, locale: SupportedLocale): string {
  const text = String(value);
  if (locale === "en") return text;
  return text.replace(/[0-9]/g, (digit) => easternArabicDigits[latinDigits.indexOf(digit)] ?? digit);
}

function dateFromDisplayValue(value: string): Date | null {
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const date = dateOnly
    ? new Date(`${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T12:00:00.000Z`)
    : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalizedDate(value: string, locale: SupportedLocale): string {
  const date = dateFromDisplayValue(value);
  if (!date) return value;

  const calendar = locale === "en" ? "gregory" : "persian";
  const formatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, {
    calendar,
    numberingSystem: locale === "en" ? "latn" : "arabext",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kabul"
  });
  const parts = formatter.formatToParts(date);
  const part = (type: "year" | "month" | "day") =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}/${part("month")}/${part("day")}`;
}

export function formatLocalizedNumber(
  value: number,
  locale: SupportedLocale,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
    numberingSystem: locale === "en" ? "latn" : "arabext",
    ...options
  }).format(value);
}

export function formatAfn(value: number, locale: SupportedLocale): string {
  const amount = formatLocalizedNumber(Math.max(0, value), locale);
  return locale === "en" ? `AFN ${amount}` : `؋ ${amount}`;
}

export function formatLocalizedTime(value: string, locale: SupportedLocale): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  const hoursPart = match?.[1];
  const minutesPart = match?.[2];
  if (!hoursPart || !minutesPart) return localizeDigits(value, locale);
  const hours = localizeDigits(hoursPart.padStart(2, "0"), locale);
  const minutes = localizeDigits(minutesPart, locale);
  return `${hours}:${minutes}`;
}

export function formatLocalizedTimeRange(
  startsAt: string,
  endsAt: string,
  locale: SupportedLocale
): string {
  return `${formatLocalizedTime(startsAt, locale)}–${formatLocalizedTime(endsAt, locale)}`;
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}
