import { z } from "zod";

export const languageCodeSchema = z.enum(["fa-AF", "ps-AF", "en"]);
export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const schoolStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type SchoolStatus = z.infer<typeof schoolStatusSchema>;

export const subscriptionStatusSchema = z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED"]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const billingCycleSchema = z.enum(["MONTHLY", "ANNUAL"]);
export type BillingCycle = z.infer<typeof billingCycleSchema>;

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

export const attendanceStatusSchema = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

export const homeworkStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]);
export type HomeworkStatus = z.infer<typeof homeworkStatusSchema>;

export const examStatusSchema = z.enum(["DRAFT", "SCHEDULED", "IN_PROGRESS", "RESULTS_READY", "PUBLISHED", "ARCHIVED"]);
export type ExamStatus = z.infer<typeof examStatusSchema>;

export const gradeRecordStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);
export type GradeRecordStatus = z.infer<typeof gradeRecordStatusSchema>;

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

const familyUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(
    /^[A-Za-z0-9]+$/,
    "Username may contain only English letters and digits. Spaces and special characters are not allowed."
  )
  .transform((value) => value.toLowerCase());

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/)
  .transform((value) => value.toUpperCase());

const academicCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(
    /^[\p{L}\p{N}._ -]+$/u,
    "Academic code may use Dari, Pashto, or English letters and numbers, plus spaces, dots, underscores, and hyphens."
  )
  .transform((value) => value.replace(/ +/g, " ").toUpperCase());

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm in 24-hour time.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.")
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one number.")
  .regex(/[^A-Za-z0-9\s]/, "Password must include at least one special character.");

export const createSchoolInputSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9-]+$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  province: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  imageUrl: z.string().trim().url().max(2048).nullable().optional(),
  defaultLanguage: languageCodeSchema.default("fa-AF")
});
export type CreateSchoolInput = z.infer<typeof createSchoolInputSchema>;

export const updateSchoolStatusSchema = z.object({
  status: schoolStatusSchema
});
export type UpdateSchoolStatusInput = z.infer<typeof updateSchoolStatusSchema>;

export const updateSubscriptionSchema = z
  .object({
    planCode: z.string().trim().min(1).max(64).optional(),
    status: subscriptionStatusSchema.optional(),
    billingCycle: billingCycleSchema.optional(),
    priceAfn: z.number().int().min(0).max(100000000).optional(),
    setupFeeAfn: z.number().int().min(0).max(100000000).optional(),
    startsOn: isoDateSchema.nullable().optional(),
    expiresOn: isoDateSchema.nullable().optional(),
    graceEndsOn: isoDateSchema.nullable().optional(),
    supportNotes: z.string().trim().max(2000).nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.startsOn && value.expiresOn && value.startsOn > value.expiresOn) {
      context.addIssue({ code: "custom", path: ["expiresOn"], message: "Subscription expiry cannot be before its start date." });
    }
    if (value.expiresOn && value.graceEndsOn && value.expiresOn > value.graceEndsOn) {
      context.addIssue({ code: "custom", path: ["graceEndsOn"], message: "Grace end cannot be before subscription expiry." });
    }
  });
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export const pilotOnboardSchoolSchema = z.object({
  school: createSchoolInputSchema,
  adminUsername: usernameSchema,
  subscription: updateSubscriptionSchema.optional()
});
export type PilotOnboardSchoolInput = z.infer<typeof pilotOnboardSchoolSchema>;

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
  code: academicCodeSchema,
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(100).default(0)
});
export type CreateGradeLevelInput = z.infer<typeof createGradeLevelSchema>;

export const createClassSectionSchema = z.object({
  academicYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  code: academicCodeSchema,
  name: z.string().trim().min(1).max(80)
});
export type CreateClassSectionInput = z.infer<typeof createClassSectionSchema>;

export const createSubjectSchema = z.object({
  code: academicCodeSchema,
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

export const updateAcademicYearSchema = createAcademicYearSchema;
export type UpdateAcademicYearInput = CreateAcademicYearInput;

export const updateGradeLevelSchema = createGradeLevelSchema;
export type UpdateGradeLevelInput = CreateGradeLevelInput;

export const updateClassSectionSchema = createClassSectionSchema;
export type UpdateClassSectionInput = CreateClassSectionInput;

export const updateSubjectSchema = createSubjectSchema;
export type UpdateSubjectInput = CreateSubjectInput;

export const updateTeacherProfileSchema = createTeacherProfileSchema.omit({ userId: true });
export type UpdateTeacherProfileInput = z.infer<typeof updateTeacherProfileSchema>;

export const updateTeacherAssignmentSchema = createTeacherAssignmentSchema;
export type UpdateTeacherAssignmentInput = CreateTeacherAssignmentInput;

export const updateNegaranAssignmentSchema = createNegaranAssignmentSchema;
export type UpdateNegaranAssignmentInput = CreateNegaranAssignmentInput;

export const updateTimetablePeriodSchema = createTimetablePeriodSchema;
export type UpdateTimetablePeriodInput = CreateTimetablePeriodInput;


export const createParentAccountSchema = z.object({
  username: familyUsernameSchema,
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


export const attendanceEntrySchema = z.object({
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
  note: z.string().trim().max(240).optional()
});
export type AttendanceEntryInput = z.infer<typeof attendanceEntrySchema>;

export const submitDailyAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: isoDateSchema,
  entries: z.array(attendanceEntrySchema).min(1).max(300)
});
export type SubmitDailyAttendanceInput = z.infer<typeof submitDailyAttendanceSchema>;

export const correctAttendanceSchema = z.object({
  status: attendanceStatusSchema,
  note: z.string().trim().max(240).optional()
});
export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;

export const attendanceDateRangeSchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional()
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Attendance date range is invalid.",
    path: ["to"]
  });


export const createStudentAccountSchema = z.object({
  username: familyUsernameSchema
});
export type CreateStudentAccountInput = z.infer<typeof createStudentAccountSchema>;

export const createHomeworkSchema = z.object({
  assignmentId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  content: z.string().trim().min(1).max(5000),
  dueAt: z.string().datetime({ offset: true }),
  attachmentUrl: z.string().url().max(500).optional()
});
export type CreateHomeworkInput = z.infer<typeof createHomeworkSchema>;

export const updateHomeworkSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  content: z.string().trim().min(1).max(5000).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  attachmentUrl: z.string().url().max(500).nullable().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "Provide at least one homework field to update."
});
export type UpdateHomeworkInput = z.infer<typeof updateHomeworkSchema>;

export const createExamSchema = z.object({
  academicYearId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  type: z.string().trim().min(2).max(80)
});
export type CreateExamInput = z.infer<typeof createExamSchema>;

export const createExamSubjectSchema = z.object({
  examId: z.string().uuid(),
  subjectId: z.string().uuid(),
  classId: z.string().uuid(),
  maxScore: z.number().int().min(1).max(10000)
});
export type CreateExamSubjectInput = z.infer<typeof createExamSubjectSchema>;

export const setExamStatusSchema = z.object({
  status: examStatusSchema
});
export type SetExamStatusInput = z.infer<typeof setExamStatusSchema>;

export const gradeEntrySchema = z.object({
  studentId: z.string().uuid(),
  score: z.number().int().min(0).max(10000),
  remark: z.string().trim().max(500).optional()
});
export type GradeEntryInput = z.infer<typeof gradeEntrySchema>;

export const saveGradeEntriesSchema = z.object({
  entries: z.array(gradeEntrySchema).min(1).max(300)
});
export type SaveGradeEntriesInput = z.infer<typeof saveGradeEntriesSchema>;

export const correctPublishedGradeSchema = z.object({
  score: z.number().int().min(0).max(10000),
  remark: z.string().trim().max(500).optional(),
  reason: z.string().trim().min(2).max(500)
});
export type CorrectPublishedGradeInput = z.infer<typeof correctPublishedGradeSchema>;


export const announcementAudienceScopeSchema = z.enum(["SCHOOL", "CLASS", "ROLE"]);
export type AnnouncementAudienceScope = z.infer<typeof announcementAudienceScopeSchema>;

export const announcementAudienceRoleSchema = z.enum(["TEACHER", "PARENT", "STUDENT"]);
export type AnnouncementAudienceRole = z.infer<typeof announcementAudienceRoleSchema>;

export const feeInvoiceStatusSchema = z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]);
export type FeeInvoiceStatus = z.infer<typeof feeInvoiceStatusSchema>;

export const devicePlatformSchema = z.enum(["ANDROID", "IOS"]);
export type DevicePlatform = z.infer<typeof devicePlatformSchema>;

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    content: z.string().trim().min(1).max(10000),
    audienceScope: announcementAudienceScopeSchema,
    classId: z.string().uuid().optional(),
    audienceRole: announcementAudienceRoleSchema.optional(),
    publishAt: z.string().datetime({ offset: true }).optional()
  })
  .superRefine((value, context) => {
    if (value.audienceScope === "CLASS" && !value.classId) {
      context.addIssue({ code: "custom", path: ["classId"], message: "Class audience requires a class." });
    }
    if (value.audienceScope !== "CLASS" && value.classId) {
      context.addIssue({ code: "custom", path: ["classId"], message: "Class may be set only for CLASS audience." });
    }
    if (value.audienceScope === "ROLE" && !value.audienceRole) {
      context.addIssue({ code: "custom", path: ["audienceRole"], message: "Role audience requires a role." });
    }
    if (value.audienceScope !== "ROLE" && value.audienceRole) {
      context.addIssue({ code: "custom", path: ["audienceRole"], message: "Audience role may be set only for ROLE audience." });
    }
  });
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const createFeeInvoiceSchema = z.object({
  studentId: z.string().uuid(),
  amount: z.number().int().min(1).max(100000000),
  dueDate: isoDateSchema,
  description: z.string().trim().max(240).optional()
});
export type CreateFeeInvoiceInput = z.infer<typeof createFeeInvoiceSchema>;

export const recordFeePaymentSchema = z.object({
  amount: z.number().int().min(1).max(100000000),
  method: z.string().trim().min(2).max(50),
  transactionReference: z.string().trim().max(120).optional()
});
export type RecordFeePaymentInput = z.infer<typeof recordFeePaymentSchema>;

export const reverseFeePaymentSchema = z.object({
  reason: z.string().trim().min(2).max(240)
});
export type ReverseFeePaymentInput = z.infer<typeof reverseFeePaymentSchema>;

export const registerPushDeviceSchema = z.object({
  pushToken: z.string().trim().min(10).max(512),
  platform: devicePlatformSchema
});
export type RegisterPushDeviceInput = z.infer<typeof registerPushDeviceSchema>;

export const updateFeeReminderSettingsSchema = z.object({
  daysBeforeDue: z.array(z.number().int().min(1).max(90)).min(1).max(6)
    .transform((days) => Array.from(new Set(days)).sort((a, b) => b - a))
});
export type UpdateFeeReminderSettingsInput = z.infer<typeof updateFeeReminderSettingsSchema>;
