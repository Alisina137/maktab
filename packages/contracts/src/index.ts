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

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9._@+-]+$/)
  .transform((value) => value.toLowerCase());

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
