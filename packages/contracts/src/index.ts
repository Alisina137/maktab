import { z } from "zod";

export const languageCodeSchema = z.enum(["fa-AF", "ps-AF", "en"]);
export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const schoolStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type SchoolStatus = z.infer<typeof schoolStatusSchema>;

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
