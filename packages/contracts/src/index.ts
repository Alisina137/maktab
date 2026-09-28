import { z } from "zod";

export const languageCodeSchema = z.enum(["fa-AF", "ps-AF", "en"]);
export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const schoolStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type SchoolStatus = z.infer<typeof schoolStatusSchema>;

export const userRoleSchema = z.enum(["SCHOOL_ADMIN", "SCHOOL_STAFF", "TEACHER", "PARENT", "STUDENT"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const mobileRoleSchema = z.enum(["TEACHER", "PARENT", "STUDENT"]);
export type MobileRole = z.infer<typeof mobileRoleSchema>;

export const userStatusSchema = z.enum(["INVITED", "ACTIVE", "SUSPENDED", "ARCHIVED"]);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const academicYearStatusSchema = z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]);
export type AcademicYearStatus = z.infer<typeof academicYearStatusSchema>;

export const studentStatusSchema = z.enum(["ACTIVE", "WITHDRAWN"]);
export type StudentStatus = z.infer<typeof studentStatusSchema>;

export const weekdaySchema = z.enum([
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY"
]);
export type Weekday = z.infer<typeof weekdaySchema>;

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9._@+-]+$/)
  .transform((value) => value.toLowerCase());

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/)
  .transform((value) => value.toUpperCase());

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm in 24-hour time.");

export const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
    message: "Password must include at least one letter and one number."
  });

export const createSchoolInputSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9-]+$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  province: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  defaultLanguage: languageCodeSchema.default("fa-AF")
});
export type CreateSchoolInput = z.infer<typeof createSchoolInputSchema>;

export const updateSchoolSettingsSchema = z.object({
  defaultLanguage: languageCodeSchema.optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  dateSystem: z.enum(["solar-hijri", "gregorian"]).optional()
});
export type UpdateSchoolSettingsInput = z.infer<typeof updateSchoolSettingsSchema>;

export const loginInputSchema = z.object({
  schoolId: z.string().uuid(),
  expectedRole: userRoleSchema,
  username: usernameSchema,
  password: z.string().min(1).max(128)
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const changeTemporaryPasswordSchema = z.object({
  newPassword: passwordSchema
});
export type ChangeTemporaryPasswordInput = z.infer<typeof changeTemporaryPasswordSchema>;

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(32).max(256)
});
export type RefreshSessionInput = z.infer<typeof refreshSessionSchema>;

export const createSchoolUserSchema = z.object({
  username: usernameSchema,
  role: userRoleSchema
});
export type CreateSchoolUserInput = z.infer<typeof createSchoolUserSchema>;

export const bootstrapSchoolAdminSchema = z.object({
  username: usernameSchema
});
export type BootstrapSchoolAdminInput = z.infer<typeof bootstrapSchoolAdminSchema>;

export const createAcademicYearSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    startDate: isoDateSchema,
    endDate: isoDateSchema
  })
  .refine((value) => value.startDate < value.endDate, {
    message: "Academic year end date must be after its start date.",
    path: ["endDate"]
  });
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;

export const createGradeLevelSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(100).default(0)
});
export type CreateGradeLevelInput = z.infer<typeof createGradeLevelSchema>;

export const createClassSectionSchema = z.object({
  academicYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  code: codeSchema,
  name: z.string().trim().min(1).max(80)
});
export type CreateClassSectionInput = z.infer<typeof createClassSectionSchema>;

export const createSubjectSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1).max(120)
});
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const createTeacherProfileSchema = z.object({
  userId: z.string().uuid(),
  employeeCode: codeSchema,
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(32).optional()
});
export type CreateTeacherProfileInput = z.infer<typeof createTeacherProfileSchema>;

export const createTeacherAssignmentSchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherUserId: z.string().uuid()
});
export type CreateTeacherAssignmentInput = z.infer<typeof createTeacherAssignmentSchema>;

export const createNegaranAssignmentSchema = z
  .object({
    academicYearId: z.string().uuid(),
    classId: z.string().uuid(),
    teacherUserId: z.string().uuid(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.optional()
  })
  .refine((value) => !value.endDate || value.startDate <= value.endDate, {
    message: "Negaran end date cannot be before its start date.",
    path: ["endDate"]
  });
export type CreateNegaranAssignmentInput = z.infer<typeof createNegaranAssignmentSchema>;

export const endNegaranAssignmentSchema = z.object({
  endDate: isoDateSchema
});
export type EndNegaranAssignmentInput = z.infer<typeof endNegaranAssignmentSchema>;

export const createTimetablePeriodSchema = z
  .object({
    academicYearId: z.string().uuid(),
    classId: z.string().uuid(),
    subjectId: z.string().uuid(),
    teacherUserId: z.string().uuid(),
    weekday: weekdaySchema,
    startsAt: timeSchema,
    endsAt: timeSchema
  })
  .refine((value) => value.startsAt < value.endsAt, {
    message: "Timetable period end time must be after its start time.",
    path: ["endsAt"]
  });
export type CreateTimetablePeriodInput = z.infer<typeof createTimetablePeriodSchema>;


export const createParentAccountSchema = z.object({
  username: usernameSchema,
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(32).optional()
});
export type CreateParentAccountInput = z.infer<typeof createParentAccountSchema>;

export const createStudentSchema = z.object({
  parentUserId: z.string().uuid(),
  studentCode: codeSchema,
  fullName: z.string().trim().min(2).max(160),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid()
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  parentUserId: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(160).optional(),
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  status: studentStatusSchema.optional()
}).refine(
  (value) => (value.academicYearId ? Boolean(value.classId) : true) && (value.classId ? Boolean(value.academicYearId) : true),
  {
    message: "Academic year and class must be changed together.",
    path: ["classId"]
  }
);
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const teacherImportRowSchema = z.object({
  username: usernameSchema,
  employeeCode: codeSchema,
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(32).optional()
});
export type TeacherImportRow = z.infer<typeof teacherImportRowSchema>;

export const bulkImportEntitySchema = z.enum(["PARENT", "STUDENT", "TEACHER"]);
export type BulkImportEntity = z.infer<typeof bulkImportEntitySchema>;
