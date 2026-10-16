import {
  boolean,
  foreignKey,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const schoolStatusEnum = pgEnum("school_status", ["ACTIVE", "INACTIVE"]);
export const languageCodeEnum = pgEnum("language_code", ["fa-AF", "ps-AF", "en"]);
export const userRoleEnum = pgEnum("user_role", ["SCHOOL_ADMIN", "SCHOOL_STAFF", "TEACHER", "PARENT", "STUDENT"]);
export const userStatusEnum = pgEnum("user_status", ["INVITED", "ACTIVE", "SUSPENDED", "ARCHIVED"]);
export const academicYearStatusEnum = pgEnum("academic_year_status", ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]);
export const studentStatusEnum = pgEnum("student_status", ["ACTIVE", "WITHDRAWN"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
export const attendanceRecordStatusEnum = pgEnum("attendance_record_status", ["SUBMITTED", "CORRECTED"]);
export const followupStatusEnum = pgEnum("attendance_followup_status", ["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"]);
export const followupActivityEnum = pgEnum("attendance_followup_activity", [
  "OPENED", "NOTE", "CALL", "MEETING", "MESSAGE", "STATUS_CHANGE", "ASSIGNMENT"
]);
export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", ["PENDING", "SENT", "FAILED", "CANCELLED"]);
export const homeworkStatusEnum = pgEnum("homework_status", ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]);
export const examStatusEnum = pgEnum("exam_status", ["DRAFT", "SCHEDULED", "IN_PROGRESS", "RESULTS_READY", "PUBLISHED", "ARCHIVED"]);
export const gradeRecordStatusEnum = pgEnum("grade_record_status", ["DRAFT", "PUBLISHED"]);
export const announcementAudienceScopeEnum = pgEnum("announcement_audience_scope", ["SCHOOL", "CLASS", "ROLE"]);
export const feeInvoiceStatusEnum = pgEnum("fee_invoice_status", ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]);
export const feePaymentKindEnum = pgEnum("fee_payment_kind", ["PAYMENT", "REVERSAL"]);
export const devicePlatformEnum = pgEnum("device_platform", ["ANDROID", "IOS"]);
export const pushDeliveryStatusEnum = pgEnum("push_delivery_status", ["PENDING", "SENT", "FAILED"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED"]);
export const billingCycleEnum = pgEnum("billing_cycle", ["MONTHLY", "ANNUAL"]);
export const weekdayEnum = pgEnum("weekday", [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY"
]);

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  province: varchar("province", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  imageUrl: text("image_url"),
  status: schoolStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    schoolId: uuid("school_id")
      .primaryKey()
      .references(() => schools.id, { onDelete: "cascade" }),
    planCode: varchar("plan_code", { length: 64 }).notNull().default("PILOT"),
    status: subscriptionStatusEnum("status").notNull().default("TRIAL"),
    billingCycle: billingCycleEnum("billing_cycle").notNull().default("ANNUAL"),
    priceAfn: integer("price_afn").notNull().default(0),
    setupFeeAfn: integer("setup_fee_afn").notNull().default(0),
    startsOn: date("starts_on"),
    expiresOn: date("expires_on"),
    graceEndsOn: date("grace_ends_on"),
    supportNotes: text("support_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_expiry_idx").on(table.expiresOn)
  ]
);

export const schoolSettings = pgTable("school_settings", {
  schoolId: uuid("school_id")
    .primaryKey()
    .references(() => schools.id, { onDelete: "cascade" }),
  defaultLanguage: languageCodeEnum("default_language").notNull().default("fa-AF"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kabul"),
  dateSystem: varchar("date_system", { length: 32 }).notNull().default("solar-hijri"),
  weekStartsOn: integer("week_starts_on").notNull().default(6),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 64 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    status: userStatusEnum("status").notNull().default("INVITED"),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("users_school_username_unique").on(table.schoolId, table.username),
    uniqueIndex("users_school_user_compound_unique").on(table.schoolId, table.id),
    index("users_school_role_idx").on(table.schoolId, table.role),
    index("users_school_status_idx").on(table.schoolId, table.status)
  ]
);

/** School-staff-specific identity and explicit, least-privilege grants.
 * A staff user without a configured profile has NO operational permissions. */
export const staffProfiles = pgTable("staff_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  employeeCode: varchar("employee_code", { length: 32 }),
  position: varchar("position", { length: 40 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("staff_profiles_school_code_unique").on(table.schoolId, table.employeeCode),
  index("staff_profiles_school_idx").on(table.schoolId),
  foreignKey({
    name: "staff_profiles_user_school_fk",
    columns: [table.schoolId, table.userId],
    foreignColumns: [users.schoolId, users.id]
  }).onDelete("cascade")
]);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessTokenHash: varchar("access_token_hash", { length: 64 }).notNull(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("auth_sessions_access_hash_unique").on(table.accessTokenHash),
    uniqueIndex("auth_sessions_refresh_hash_unique").on(table.refreshTokenHash),
    index("auth_sessions_user_idx").on(table.schoolId, table.userId)
  ]
);

export const adminPasswordVerifications = pgTable(
  "admin_password_verifications",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailCodeHash: varchar("email_code_hash", { length: 64 }).notNull(),
    smsCodeHash: varchar("sms_code_hash", { length: 64 }).notNull(),
    verificationTokenHash: varchar("verification_token_hash", { length: 64 }),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("admin_password_verifications_user_idx").on(table.schoolId, table.userId),
    uniqueIndex("admin_password_verifications_token_unique").on(table.verificationTokenHash)
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("audit_logs_school_created_idx").on(table.schoolId, table.createdAt)]
);

export const academicYears = pgTable(
  "academic_years",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: academicYearStatusEnum("status").notNull().default("DRAFT"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("academic_years_school_name_unique").on(table.schoolId, table.name),
    index("academic_years_school_status_idx").on(table.schoolId, table.status)
  ]
);

export const gradeLevels = pgTable(
  "grade_levels",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("grade_levels_school_code_unique").on(table.schoolId, table.code),
    uniqueIndex("grade_levels_school_name_unique").on(table.schoolId, table.name)
  ]
);

export const classSections = pgTable(
  "class_sections",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    gradeLevelId: uuid("grade_level_id")
      .notNull()
      .references(() => gradeLevels.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("class_sections_school_year_code_unique").on(table.schoolId, table.academicYearId, table.code),
    index("class_sections_school_year_idx").on(table.schoolId, table.academicYearId),
    index("class_sections_grade_idx").on(table.gradeLevelId)
  ]
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("subjects_school_code_unique").on(table.schoolId, table.code),
    uniqueIndex("subjects_school_name_unique").on(table.schoolId, table.name)
  ]
);

export const parentProfiles = pgTable(
  "parent_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("parent_profiles_school_idx").on(table.schoolId)]
);

export const adminProfiles = pgTable(
  "admin_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    jobTitle: varchar("job_title", { length: 120 }),
    imageUrl: text("image_url"),
    email: varchar("email", { length: 254 }),
    twoFactorEmail: varchar("two_factor_email", { length: 254 }),
    whatsapp: varchar("whatsapp", { length: 32 }),
    phone: varchar("phone", { length: 32 }),
    twoFactorPhone: varchar("two_factor_phone", { length: 32 }),
    officeLocation: varchar("office_location", { length: 200 }),
    officeHours: varchar("office_hours", { length: 160 }),
    bio: text("bio"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("admin_profiles_school_idx").on(table.schoolId)]
);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    parentUserId: uuid("parent_user_id")
      .notNull()
      .references(() => parentProfiles.userId, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    studentCode: varchar("student_code", { length: 32 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    status: studentStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("students_school_code_unique").on(table.schoolId, table.studentCode),
    uniqueIndex("students_user_unique").on(table.userId),
    index("students_school_class_idx").on(table.schoolId, table.classId),
    index("students_parent_idx").on(table.parentUserId)
  ]
);

export const studentClassHistory = pgTable(
  "student_class_history",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true })
  },
  (table) => [
    index("student_class_history_student_idx").on(table.schoolId, table.studentId),
    index("student_class_history_class_idx").on(table.schoolId, table.classId)
  ]
);

export const teacherProfiles = pgTable(
  "teacher_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    employeeCode: varchar("employee_code", { length: 32 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("teacher_profiles_school_employee_unique").on(table.schoolId, table.employeeCode),
    index("teacher_profiles_school_idx").on(table.schoolId)
  ]
);

export const teacherAssignments = pgTable(
  "teacher_assignments",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "restrict" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("teacher_assignments_unique").on(
      table.schoolId,
      table.academicYearId,
      table.classId,
      table.subjectId
    ),
    index("teacher_assignments_teacher_idx").on(table.schoolId, table.teacherUserId),
    index("teacher_assignments_class_idx").on(table.schoolId, table.classId)
  ]
);

export const negaranAssignments = pgTable(
  "negaran_assignments",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("negaran_assignments_class_idx").on(table.schoolId, table.academicYearId, table.classId),
    index("negaran_assignments_teacher_idx").on(table.schoolId, table.teacherUserId)
  ]
);

export const timetablePeriods = pgTable(
  "timetable_periods",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "restrict" }),
    weekday: weekdayEnum("weekday").notNull(),
    startsAt: varchar("starts_at", { length: 5 }).notNull(),
    endsAt: varchar("ends_at", { length: 5 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("timetable_periods_class_day_idx").on(table.schoolId, table.academicYearId, table.classId, table.weekday),
    index("timetable_periods_teacher_day_idx").on(table.schoolId, table.academicYearId, table.teacherUserId, table.weekday)
  ]
);

export const attendanceClosures = pgTable(
  "attendance_closures",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id").notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    reason: varchar("reason", { length: 160 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("attendance_closures_school_year_date_unique")
      .on(table.schoolId, table.academicYearId, table.date),
    index("attendance_closures_school_date_idx").on(table.schoolId, table.date)
  ]
);

export const dailyAttendances = pgTable(
  "daily_attendances",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    status: attendanceRecordStatusEnum("status").notNull().default("SUBMITTED"),
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("daily_attendances_school_class_date_unique").on(table.schoolId, table.classId, table.date),
    index("daily_attendances_school_date_idx").on(table.schoolId, table.date),
    index("daily_attendances_class_date_idx").on(table.schoolId, table.classId, table.date)
  ]
);

export const studentAttendances = pgTable(
  "student_attendances",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    attendanceId: uuid("attendance_id")
      .notNull()
      .references(() => dailyAttendances.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    status: attendanceStatusEnum("status").notNull(),
    note: varchar("note", { length: 240 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("student_attendances_attendance_student_unique").on(table.attendanceId, table.studentId),
    index("student_attendances_student_idx").on(table.schoolId, table.studentId),
    index("student_attendances_status_idx").on(table.schoolId, table.status)
  ]
);


/** One follow-up per submitted student mark, never one per unsubmitted day. */
export const attendanceFollowupCases = pgTable(
  "attendance_followup_cases",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
    studentAttendanceId: uuid("student_attendance_id").notNull()
      .references(() => studentAttendances.id, { onDelete: "restrict" }),
    sourceStatus: attendanceStatusEnum("source_status").notNull(),
    status: followupStatusEnum("status").notNull().default("OPEN"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    dueOn: date("due_on"),
    openingNote: varchar("opening_note", { length: 500 }).notNull(),
    resolutionNote: varchar("resolution_note", { length: 500 }),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  table => [
    uniqueIndex("attendance_followup_mark_unique").on(table.studentAttendanceId),
    index("attendance_followup_school_year_status_idx").on(table.schoolId, table.academicYearId, table.status),
    index("attendance_followup_school_due_idx").on(table.schoolId, table.dueOn)
  ]
);

export const attendanceFollowupActivities = pgTable(
  "attendance_followup_activities",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    caseId: uuid("case_id").notNull().references(() => attendanceFollowupCases.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    kind: followupActivityEnum("kind").notNull(),
    details: varchar("details", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  table => [index("attendance_followup_activity_case_date_idx").on(table.schoolId, table.caseId, table.createdAt)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    deepLink: varchar("deep_link", { length: 240 }),
    dedupKey: varchar("dedup_key", { length: 180 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    deliveryStatus: notificationDeliveryStatusEnum("delivery_status").notNull().default("PENDING"),
    pushClaimToken: uuid("push_claim_token"),
    pushClaimUntil: timestamp("push_claim_until", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("notifications_school_dedup_unique").on(table.schoolId, table.dedupKey),
    index("notifications_user_created_idx").on(table.schoolId, table.userId, table.createdAt)
  ]
);

export const homeworks = pgTable(
  "homeworks",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => teacherAssignments.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "restrict" }),
    title: varchar("title", { length: 160 }).notNull(),
    content: text("content").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    attachmentUrl: varchar("attachment_url", { length: 500 }),
    attachmentFileId: uuid("attachment_file_id"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    status: homeworkStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("homeworks_teacher_idx").on(table.schoolId, table.teacherUserId),
    index("homeworks_class_due_idx").on(table.schoolId, table.classId, table.dueAt),
    index("homeworks_status_idx").on(table.schoolId, table.status)
  ]
);

export const learningFiles = pgTable("learning_files", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  fileName: varchar("file_name", { length: 160 }).notNull(),
  mimeType: varchar("mime_type", { length: 80 }).notNull(),
  byteCount: integer("byte_count").notNull(),
  base64Data: text("base64_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("learning_files_school_uploader_idx").on(table.schoolId, table.uploadedBy)]);

export const homeworkSubmissions = pgTable("homework_submissions", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  homeworkId: uuid("homework_id").notNull().references(() => homeworks.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
  answer: text("answer").notNull(),
  attachmentFileId: uuid("attachment_file_id").references(() => learningFiles.id, { onDelete: "set null" }),
  status: varchar("status", { length: 24 }).notNull().default("SUBMITTED"),
  feedback: varchar("feedback", { length: 2000 }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("homework_submissions_unique").on(table.homeworkId, table.studentId),
  index("homework_submissions_class_idx").on(table.schoolId, table.homeworkId)
]);

export const curriculumUnits = pgTable("curriculum_units", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  classId: uuid("class_id").notNull().references(() => classSections.id, { onDelete: "restrict" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 160 }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("curriculum_unit_order_unique").on(table.schoolId, table.academicYearId, table.classId, table.subjectId, table.sortOrder),
  index("curriculum_unit_class_idx").on(table.schoolId, table.academicYearId, table.classId)
]);

export const teacherUnitProgress = pgTable("teacher_unit_progress", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  assignmentId: uuid("assignment_id").notNull().references(() => teacherAssignments.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").notNull().references(() => curriculumUnits.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("NOT_STARTED"),
  updatedBy: uuid("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("teacher_unit_progress_unique").on(table.assignmentId, table.unitId)
]);

export const teacherTasks = pgTable("teacher_tasks", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  teacherUserId: uuid("teacher_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  details: varchar("details", { length: 1500 }).notNull().default(""),
  priority: varchar("priority", { length: 12 }).notNull().default("NORMAL"),
  status: varchar("status", { length: 12 }).notNull().default("OPEN"),
  dueOn: date("due_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("teacher_tasks_owner_status_idx").on(table.schoolId, table.teacherUserId, table.status),
  index("teacher_tasks_due_idx").on(table.schoolId, table.teacherUserId, table.dueOn)
]);

export const teacherLessonPlans = pgTable("teacher_lesson_plans", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  assignmentId: uuid("assignment_id").notNull().references(() => teacherAssignments.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").references(() => curriculumUnits.id, { onDelete: "set null" }),
  lessonDate: date("lesson_date").notNull(),
  topic: varchar("topic", { length: 160 }).notNull(),
  objective: text("objective").notNull(),
  materials: varchar("materials", { length: 500 }).notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("PLANNED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("teacher_lesson_plans_assignment_date_idx").on(table.schoolId, table.assignmentId, table.lessonDate)
]);

export const continuousAssessments = pgTable("continuous_assessments", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  assignmentId: uuid("assignment_id").notNull().references(() => teacherAssignments.id, { onDelete: "restrict" }),
  teacherUserId: uuid("teacher_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 160 }).notNull(),
  category: varchar("category", { length: 24 }).notNull(),
  maxScore: integer("max_score").notNull(),
  assessedOn: date("assessed_on").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("continuous_assessments_assignment_idx").on(table.schoolId, table.assignmentId)]);

export const continuousScores = pgTable("continuous_scores", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  assessmentId: uuid("assessment_id").notNull().references(() => continuousAssessments.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
  score: integer("score").notNull(),
  remark: varchar("remark", { length: 500 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("continuous_scores_unique").on(table.assessmentId, table.studentId),
  index("continuous_scores_school_idx").on(table.schoolId, table.assessmentId)
]);

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    type: varchar("type", { length: 80 }).notNull(),
    status: examStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("exams_school_year_name_unique").on(table.schoolId, table.academicYearId, table.name),
    index("exams_school_status_idx").on(table.schoolId, table.status)
  ]
);

export const examSubjects = pgTable(
  "exam_subjects",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "restrict" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classSections.id, { onDelete: "restrict" }),
    maxScore: integer("max_score").notNull(),
    examDate: date("exam_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("exam_subjects_unique").on(table.schoolId, table.examId, table.classId, table.subjectId),
    index("exam_subjects_exam_idx").on(table.schoolId, table.examId),
    index("exam_subjects_class_idx").on(table.schoolId, table.classId),
    index("exam_subjects_date_idx").on(table.schoolId, table.examDate)
  ]
);

export const gradeRecords = pgTable(
  "grade_records",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    examSubjectId: uuid("exam_subject_id")
      .notNull()
      .references(() => examSubjects.id, { onDelete: "restrict" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    score: integer("score").notNull(),
    remark: varchar("remark", { length: 500 }),
    status: gradeRecordStatusEnum("status").notNull().default("DRAFT"),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("grade_records_subject_student_unique").on(table.examSubjectId, table.studentId),
    index("grade_records_student_idx").on(table.schoolId, table.studentId),
    index("grade_records_status_idx").on(table.schoolId, table.status)
  ]
);

export const communicationSettings = pgTable(
  "communication_settings",
  {
    schoolId: uuid("school_id")
      .primaryKey()
      .references(() => schools.id, { onDelete: "cascade" }),
    feeReminderDays: jsonb("fee_reminder_days").$type<number[]>().notNull().default([7, 1]),
    schedulerLastAttemptAt: timestamp("scheduler_last_attempt_at", { withTimezone: true }),
    schedulerLastSuccessAt: timestamp("scheduler_last_success_at", { withTimezone: true }),
    schedulerLastError: varchar("scheduler_last_error", { length: 240 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  }
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    content: text("content").notNull(),
    audienceScope: announcementAudienceScopeEnum("audience_scope").notNull(),
    classId: uuid("class_id").references(() => classSections.id, { onDelete: "restrict" }),
    audienceRole: userRoleEnum("audience_role"),
    publishAt: timestamp("publish_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("announcements_school_publish_idx").on(table.schoolId, table.publishAt),
    index("announcements_class_idx").on(table.schoolId, table.classId)
  ]
);

export const feeInvoiceCounters = pgTable("fee_invoice_counters", {
  schoolId: uuid("school_id").primaryKey().references(() => schools.id, { onDelete: "cascade" }),
  lastNumber: integer("last_number").notNull().default(0)
});

export const feeInvoices = pgTable(
  "fee_invoices",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
    invoiceNumber: integer("invoice_number").notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("AFN"),
    description: varchar("description", { length: 240 }),
    dueDate: date("due_date").notNull(),
    status: feeInvoiceStatusEnum("status").notNull().default("DRAFT"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("fee_invoices_school_number_unique").on(table.schoolId, table.invoiceNumber),
    index("fee_invoices_student_idx").on(table.schoolId, table.studentId),
    index("fee_invoices_due_idx").on(table.schoolId, table.dueDate),
    index("fee_invoices_status_idx").on(table.schoolId, table.status)
  ]
);

export const feePayments = pgTable(
  "fee_payments",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull().references(() => feeInvoices.id, { onDelete: "restrict" }),
    kind: feePaymentKindEnum("kind").notNull().default("PAYMENT"),
    amount: integer("amount").notNull(),
    method: varchar("method", { length: 50 }).notNull(),
    transactionReference: varchar("transaction_reference", { length: 120 }),
    reversalOfPaymentId: uuid("reversal_of_payment_id"),
    idempotencyKey: uuid("idempotency_key"),
    reversalReason: varchar("reversal_reason", { length: 240 }),
    recordedBy: uuid("recorded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("fee_payments_invoice_idx").on(table.schoolId, table.invoiceId),
    uniqueIndex("fee_payments_reversal_unique").on(table.schoolId, table.reversalOfPaymentId),
    uniqueIndex("fee_payments_idempotency_unique").on(table.schoolId, table.invoiceId, table.idempotencyKey)
  ]
);

/** Reconciliation is separate from the immutable ledger. Unmarking is audited; the payment is never modified. */
export const feePaymentReconciliations = pgTable(
  "fee_payment_reconciliations",
  {
    paymentId: uuid("payment_id").primaryKey().references(() => feePayments.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 120 }),
    reconciledBy: uuid("reconciled_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }).notNull().defaultNow()
  },
  table => [index("fee_payment_reconciliations_school_idx").on(table.schoolId)]
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    pushToken: varchar("push_token", { length: 512 }).notNull(),
    platform: devicePlatformEnum("platform").notNull(),
    active: boolean("active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("devices_push_token_unique").on(table.pushToken),
    index("devices_user_idx").on(table.schoolId, table.userId)
  ]
);

export const notificationPushDeliveries = pgTable(
  "notification_push_deliveries",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    notificationId: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    status: pushDeliveryStatusEnum("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: varchar("provider_message_id", { length: 160 }),
    lastError: varchar("last_error", { length: 500 }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("notification_push_delivery_unique").on(table.notificationId, table.deviceId),
    index("notification_push_status_idx").on(table.schoolId, table.status)
  ]
);


export const familyImportBatches = pgTable(
  "family_import_batches",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    entityType: varchar("entity_type", { length: 16 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 64 }),
    rowCount: integer("row_count").notNull(),
    importedCount: integer("imported_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    status: varchar("status", { length: 16 }).notNull(),
    reason: varchar("reason", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("family_import_batches_school_key_unique").on(table.schoolId, table.idempotencyKey),
    index("family_import_batches_school_time_idx").on(table.schoolId, table.createdAt)
  ]
);

export const pilotLaunchEvidence = pgTable(
  "pilot_launch_evidence",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 40 }).notNull(),
    reference: varchar("reference", { length: 500 }).notNull(),
    note: varchar("note", { length: 2000 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("SUBMITTED"),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    reviewedBy: varchar("reviewed_by", { length: 80 }),
    reviewNote: varchar("review_note", { length: 1000 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("pilot_launch_evidence_school_category_unique").on(table.schoolId, table.category)
  ]
);

export const pilotSupportTickets = pgTable(
  "pilot_support_tickets",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    subject: varchar("subject", { length: 160 }).notNull(),
    description: varchar("description", { length: 3000 }).notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    priority: varchar("priority", { length: 16 }).notNull().default("NORMAL"),
    status: varchar("status", { length: 24 }).notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("pilot_support_tickets_school_time_idx").on(table.schoolId, table.createdAt)]
);

export const pilotSupportUpdates = pgTable("pilot_support_updates", {
  id: uuid("id").primaryKey(),
  ticketId: uuid("ticket_id").notNull().references(() => pilotSupportTickets.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  authorKind: varchar("author_kind", { length: 16 }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  note: varchar("note", { length: 2000 }).notNull(),
  statusAfter: varchar("status_after", { length: 24 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("pilot_support_updates_ticket_time_idx").on(table.ticketId, table.createdAt)]);

export const pilotLaunchDecisions = pgTable("pilot_launch_decisions", {
  schoolId: uuid("school_id").primaryKey().references(() => schools.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 24 }).notNull().default("NOT_APPROVED"),
  operatorLabel: varchar("operator_label", { length: 80 }),
  note: varchar("note", { length: 1000 }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const pilotLaunchDecisionHistory = pgTable("pilot_launch_decision_history", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 24 }).notNull(),
  operatorLabel: varchar("operator_label", { length: 80 }).notNull(),
  note: varchar("note", { length: 1000 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("pilot_launch_decision_history_school_idx").on(table.schoolId, table.createdAt)]);

/** School-scoped staff intake; only an approved review creates a student. */
export const registrationRequests = pgTable("staff_registration_requests", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull().references(()=>schools.id,{onDelete:"cascade"}),
  createdBy: uuid("created_by").notNull().references(()=>users.id,{onDelete:"restrict"}),
  fullName: varchar("full_name",{length:160}).notNull(),
  studentCode: varchar("student_code",{length:32}).notNull(),
  parentName: varchar("parent_name",{length:160}).notNull(),
  academicYearId: uuid("academic_year_id").notNull().references(()=>academicYears.id,{onDelete:"restrict"}),
  gradeLevelId: uuid("grade_level_id").notNull().references(()=>gradeLevels.id,{onDelete:"restrict"}),
  documents: jsonb("documents").$type<{identityChecked:boolean;consentChecked:boolean;priorRecordChecked:boolean}>().notNull().default({identityChecked:false,consentChecked:false,priorRecordChecked:false}),
  notes: varchar("notes",{length:1000}).notNull().default(""),
  status: varchar("status",{length:24}).$type<"DRAFT"|"SUBMITTED"|"UNDER_REVIEW"|"APPROVED"|"REJECTED">().notNull().default("DRAFT"),
  reviewedBy: uuid("reviewed_by").references(()=>users.id,{onDelete:"set null"}),
  reviewNote: varchar("review_note",{length:1000}),
  approvedStudentId: uuid("approved_student_id").references(()=>students.id,{onDelete:"restrict"}),
  submittedAt: timestamp("submitted_at",{withTimezone:true}),
  decidedAt: timestamp("decided_at",{withTimezone:true}),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
}, table=>[
  index("staff_registration_school_status_idx").on(table.schoolId,table.status,table.updatedAt)
]);


/** Staff Phase 5 requests are immutable proposals until an admin decides. */
export const staffAttendanceCorrectionRequests = pgTable("staff_attendance_correction_requests",{
  id:uuid("id").primaryKey(),
  schoolId:uuid("school_id").notNull().references(()=>schools.id,{onDelete:"cascade"}),
  attendanceId:uuid("attendance_id").notNull().references(()=>dailyAttendances.id,{onDelete:"restrict"}),
  studentId:uuid("student_id").notNull().references(()=>students.id,{onDelete:"restrict"}),
  createdBy:uuid("created_by").notNull().references(()=>users.id,{onDelete:"restrict"}),
  originalStatus:attendanceStatusEnum("original_status").notNull(),
  requestedStatus:attendanceStatusEnum("requested_status").notNull(),
  expectedUpdatedAt:timestamp("expected_updated_at",{withTimezone:true}).notNull(),
  reason:varchar("reason",{length:500}).notNull(),
  status:varchar("status",{length:16}).$type<"PENDING"|"APPROVED"|"REJECTED">().notNull().default("PENDING"),
  reviewedBy:uuid("reviewed_by").references(()=>users.id,{onDelete:"set null"}),
  reviewNote:varchar("review_note",{length:500}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  decidedAt:timestamp("decided_at",{withTimezone:true})
},table=>[index("staff_attendance_requests_school_status_idx").on(table.schoolId,table.status,table.createdAt)]);


/** Phase 7: staff can update only their assigned task state; assignment is administrator-owned. */
export const staffWorkTasks = pgTable("staff_work_tasks", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull(),
  assignedTo: uuid("assigned_to").notNull(),
  createdBy: uuid("created_by").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  details: varchar("details", { length: 2000 }).notNull().default(""),
  priority: varchar("priority", { length: 12 }).$type<"LOW" | "NORMAL" | "HIGH">().notNull().default("NORMAL"),
  status: varchar("status", { length: 20 }).$type<"TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED">().notNull().default("TODO"),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, table => [
  index("staff_work_assignee_idx").on(table.schoolId, table.assignedTo, table.status, table.dueDate),
  foreignKey({ name:"staff_work_assignee_school_fk", columns:[table.schoolId, table.assignedTo],
    foreignColumns:[users.schoolId,users.id] }).onDelete("cascade"),
  foreignKey({ name:"staff_work_creator_school_fk", columns:[table.schoolId, table.createdBy],
    foreignColumns:[users.schoolId,users.id] }).onDelete("restrict")
]);

/** Staff authored copy is never a published announcement until an administrator publishes separately. */
export const staffMessageDrafts = pgTable("staff_message_drafts", {
  id: uuid("id").primaryKey(),
  schoolId: uuid("school_id").notNull(),
  createdBy: uuid("created_by").notNull(),
  title: varchar("title", {length:160}).notNull(),
  content: text("content").notNull(),
  audienceScope: varchar("audience_scope",{length:16}).$type<"SCHOOL"|"ROLE">().notNull().default("SCHOOL"),
  audienceRole: varchar("audience_role",{length:16}).$type<"TEACHER"|"PARENT"|"STUDENT">(),
  status: varchar("status",{length:16}).$type<"DRAFT"|"SUBMITTED"|"APPROVED"|"REJECTED">().notNull().default("DRAFT"),
  reviewedBy: uuid("reviewed_by"),
  reviewNote: varchar("review_note",{length:500}),
  reviewedAt: timestamp("reviewed_at",{withTimezone:true}),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
}, table => [
  index("staff_message_review_idx").on(table.schoolId,table.status,table.createdAt),
  foreignKey({name:"staff_message_author_school_fk",columns:[table.schoolId,table.createdBy],
    foreignColumns:[users.schoolId,users.id]}).onDelete("cascade"),
  foreignKey({name:"staff_message_reviewer_school_fk",columns:[table.schoolId,table.reviewedBy],
    foreignColumns:[users.schoolId,users.id]}).onDelete("set null")
]);

export const staffWorkspacePreferences = pgTable("staff_workspace_preferences", {
  schoolId: uuid("school_id").notNull(),
  userId: uuid("user_id").notNull(),
  showNotificationBadge: boolean("show_notification_badge").notNull().default(true),
  compactTaskView: boolean("compact_task_view").notNull().default(false),
  updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
}, table => [
  primaryKey({columns:[table.schoolId,table.userId]}),
  foreignKey({name:"staff_workspace_owner_fk",columns:[table.schoolId,table.userId],
    foreignColumns:[users.schoolId,users.id]}).onDelete("cascade")
]);

export const databaseSchema = {
  staffWorkTasks,
  staffMessageDrafts,
  staffWorkspacePreferences,
  staffAttendanceCorrectionRequests,
  registrationRequests,
  pilotLaunchEvidence,
  pilotSupportTickets,
  pilotSupportUpdates,
  pilotLaunchDecisions,
  pilotLaunchDecisionHistory,
  familyImportBatches,
  schools,
  subscriptions,
  schoolSettings,
  users,
  authSessions,
  adminPasswordVerifications,
  auditLogs,
  academicYears,
  gradeLevels,
  classSections,
  subjects,
  parentProfiles,
  adminProfiles,
  students,
  studentClassHistory,
  teacherProfiles,
  teacherAssignments,
  negaranAssignments,
  timetablePeriods,
  dailyAttendances,
  studentAttendances,
  attendanceFollowupCases,
  attendanceFollowupActivities,
  notifications,
  homeworks,
  learningFiles,
  homeworkSubmissions,
  continuousAssessments,
  continuousScores,
  curriculumUnits,
  teacherUnitProgress,
  teacherLessonPlans,
  teacherTasks,
  exams,
  examSubjects,
  gradeRecords,
  communicationSettings,
  announcements,
  feeInvoices,
  feeInvoiceCounters,
  feePayments,
  devices,
  notificationPushDeliveries
};

export type School = typeof schools.$inferSelect;
export type SchoolSettings = typeof schoolSettings.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type AdminPasswordVerification = typeof adminPasswordVerifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AcademicYear = typeof academicYears.$inferSelect;
export type GradeLevel = typeof gradeLevels.$inferSelect;
export type ClassSection = typeof classSections.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type ParentProfile = typeof parentProfiles.$inferSelect;
export type AdminProfile = typeof adminProfiles.$inferSelect;
export type Student = typeof students.$inferSelect;
export type RegistrationRequest = typeof registrationRequests.$inferSelect;
export type StudentClassHistory = typeof studentClassHistory.$inferSelect;
export type TeacherProfile = typeof teacherProfiles.$inferSelect;
export type TeacherAssignment = typeof teacherAssignments.$inferSelect;
export type NegaranAssignment = typeof negaranAssignments.$inferSelect;
export type TimetablePeriod = typeof timetablePeriods.$inferSelect;

export type DailyAttendance = typeof dailyAttendances.$inferSelect;
export type StudentAttendance = typeof studentAttendances.$inferSelect;
export type AttendanceFollowupCase = typeof attendanceFollowupCases.$inferSelect;
export type AttendanceFollowupActivity = typeof attendanceFollowupActivities.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export type Homework = typeof homeworks.$inferSelect;
export type LearningFile = typeof learningFiles.$inferSelect;
export type HomeworkSubmission = typeof homeworkSubmissions.$inferSelect;
export type ContinuousAssessment = typeof continuousAssessments.$inferSelect;
export type CurriculumUnit = typeof curriculumUnits.$inferSelect;
export type TeacherUnitProgress = typeof teacherUnitProgress.$inferSelect;
export type TeacherLessonPlan = typeof teacherLessonPlans.$inferSelect;
export type TeacherTask = typeof teacherTasks.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type ExamSubject = typeof examSubjects.$inferSelect;
export type GradeRecord = typeof gradeRecords.$inferSelect;

export type Announcement = typeof announcements.$inferSelect;
export type FeeInvoice = typeof feeInvoices.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type NotificationPushDelivery = typeof notificationPushDeliveries.$inferSelect;
export type CommunicationSettings = typeof communicationSettings.$inferSelect;

export type FamilyImportBatch = typeof familyImportBatches.$inferSelect;

export type PilotLaunchEvidence = typeof pilotLaunchEvidence.$inferSelect;
export type PilotSupportTicket = typeof pilotSupportTickets.$inferSelect;
export type PilotSupportUpdate = typeof pilotSupportUpdates.$inferSelect;
export type PilotLaunchDecision = typeof pilotLaunchDecisions.$inferSelect;

export type StaffAttendanceCorrectionRequest = typeof staffAttendanceCorrectionRequests.$inferSelect;

export type StaffWorkTask = typeof staffWorkTasks.$inferSelect;
export type StaffMessageDraft = typeof staffMessageDrafts.$inferSelect;
export type StaffWorkspacePreference = typeof staffWorkspacePreferences.$inferSelect;
