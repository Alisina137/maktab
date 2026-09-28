import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { CreateSchoolInput, UpdateSchoolSettingsInput } from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import { schoolSettings, schools, type School, type SchoolSettings } from "./schema.js";

export interface SchoolContext {
  school: School;
  settings: SchoolSettings;
}

export interface PlatformSchoolStore {
  createSchool(input: CreateSchoolInput): Promise<SchoolContext>;
  listSchools(): Promise<School[]>;
  getSchoolContext(schoolId: string): Promise<SchoolContext | null>;
  updateSchoolSettings(schoolId: string, input: UpdateSchoolSettingsInput): Promise<SchoolContext | null>;
}

export class SchoolConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchoolConflictError";
  }
}

export function createSchoolStore(db: FoundationDatabase): PlatformSchoolStore {
  return {
    async createSchool(input) {
      const id = randomUUID();
      try {
        return await db.transaction(async (tx) => {
          const [school] = await tx
            .insert(schools)
            .values({
              id,
              code: input.code,
              name: input.name,
              slug: input.slug,
              province: input.province,
              city: input.city
            })
            .returning();

          if (!school) {
            throw new Error("School insert did not return a row.");
          }

          const [settings] = await tx
            .insert(schoolSettings)
            .values({
              schoolId: school.id,
              defaultLanguage: input.defaultLanguage
            })
            .returning();

          if (!settings) {
            throw new Error("School settings insert did not return a row.");
          }

          return { school, settings };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/unique|duplicate/i.test(message)) {
          throw new SchoolConflictError("A school with that code or slug already exists.");
        }
        throw error;
      }
    },

    async listSchools() {
      return db.select().from(schools).orderBy(schools.name);
    },

    async getSchoolContext(schoolId) {
      const rows = await db
        .select({ school: schools, settings: schoolSettings })
        .from(schools)
        .innerJoin(schoolSettings, eq(schoolSettings.schoolId, schools.id))
        .where(and(eq(schools.id, schoolId), eq(schoolSettings.schoolId, schoolId)))
        .limit(1);

      return rows[0] ?? null;
    },

    async updateSchoolSettings(schoolId, input) {
      const changes = {
        ...(input.defaultLanguage ? { defaultLanguage: input.defaultLanguage } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.dateSystem ? { dateSystem: input.dateSystem } : {}),
        updatedAt: new Date()
      };

      await db.update(schoolSettings).set(changes).where(eq(schoolSettings.schoolId, schoolId));
      return this.getSchoolContext(schoolId);
    }
  };
}
