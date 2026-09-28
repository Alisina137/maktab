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
  status: schoolStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

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

export const databaseSchema = {
  schools,
  schoolSettings,
  users,
  authSessions,
  auditLogs,
  academicYears,
  gradeLevels,
  classSections,
  subjects,
  teacherProfiles,
  teacherAssignments,
  negaranAssignments,
  timetablePeriods
};

export type School = typeof schools.$inferSelect;
export type SchoolSettings = typeof schoolSettings.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AcademicYear = typeof academicYears.$inferSelect;
export type GradeLevel = typeof gradeLevels.$inferSelect;
export type ClassSection = typeof classSections.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type TeacherProfile = typeof teacherProfiles.$inferSelect;
export type TeacherAssignment = typeof teacherAssignments.$inferSelect;
export type NegaranAssignment = typeof negaranAssignments.$inferSelect;
export type TimetablePeriod = typeof timetablePeriods.$inferSelect;
