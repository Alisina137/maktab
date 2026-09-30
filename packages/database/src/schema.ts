import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
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
    index("users_school_role_idx").on(table.schoolId, table.role),
    index("users_school_status_idx").on(table.schoolId, table.status)
  ]
);

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
      table.teacherUserId,
      table.subjectId,
      table.classId
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("exam_subjects_unique").on(table.schoolId, table.examId, table.classId, table.subjectId),
    index("exam_subjects_exam_idx").on(table.schoolId, table.examId),
    index("exam_subjects_class_idx").on(table.schoolId, table.classId)
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

export const feeInvoices = pgTable(
  "fee_invoices",
  {
    id: uuid("id").primaryKey(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
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
    reversalReason: varchar("reversal_reason", { length: 240 }),
    recordedBy: uuid("recorded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("fee_payments_invoice_idx").on(table.schoolId, table.invoiceId),
    uniqueIndex("fee_payments_reversal_unique").on(table.schoolId, table.reversalOfPaymentId)
  ]
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

export const databaseSchema = {
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
  notifications,
  homeworks,
  exams,
  examSubjects,
  gradeRecords,
  communicationSettings,
  announcements,
  feeInvoices,
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
export type StudentClassHistory = typeof studentClassHistory.$inferSelect;
export type TeacherProfile = typeof teacherProfiles.$inferSelect;
export type TeacherAssignment = typeof teacherAssignments.$inferSelect;
export type NegaranAssignment = typeof negaranAssignments.$inferSelect;
export type TimetablePeriod = typeof timetablePeriods.$inferSelect;

export type DailyAttendance = typeof dailyAttendances.$inferSelect;
export type StudentAttendance = typeof studentAttendances.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export type Homework = typeof homeworks.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type ExamSubject = typeof examSubjects.$inferSelect;
export type GradeRecord = typeof gradeRecords.$inferSelect;

export type Announcement = typeof announcements.$inferSelect;
export type FeeInvoice = typeof feeInvoices.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type NotificationPushDelivery = typeof notificationPushDeliveries.$inferSelect;
export type CommunicationSettings = typeof communicationSettings.$inferSelect;
