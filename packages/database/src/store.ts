import { randomUUID } from "node:crypto";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import type {
  CreateSchoolInput,
  SubscriptionStatus,
  UpdateSchoolSettingsInput,
  UpdateSubscriptionInput
} from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  notificationPushDeliveries,
  notifications,
  schoolSettings,
  schools,
  subscriptions,
  users,
  type School,
  type SchoolSettings,
  type Subscription
} from "./schema.js";

export interface SchoolContext {
  school: School;
  settings: SchoolSettings;
  subscription: Subscription;
}

export interface PublicSchool {
  id: string;
  code: string;
  name: string;
  province: string;
  city: string;
  defaultLanguage: "fa-AF" | "ps-AF" | "en";
}

export interface PlatformOperationalSummary {
  database: "ok";
  schools: number;
  subscriptions: Record<SubscriptionStatus, number>;
  failedPushDeliveries: number;
}

export interface PlatformSchoolStore {
  createSchool(input: CreateSchoolInput): Promise<SchoolContext>;
  listSchools(): Promise<School[]>;
  listPublicSchools(query?: string): Promise<PublicSchool[]>;
  getSchoolContext(schoolId: string): Promise<SchoolContext | null>;
  updateSchoolSettings(schoolId: string, input: UpdateSchoolSettingsInput): Promise<SchoolContext | null>;
  updateSchoolStatus(schoolId: string, status: "ACTIVE" | "INACTIVE"): Promise<SchoolContext | null>;
  updateSubscription(schoolId: string, input: UpdateSubscriptionInput): Promise<SchoolContext | null>;
  runSubscriptionLifecycle(today?: string): Promise<{ transitioned: number; remindersCreated: number }>;
  healthCheck(): Promise<boolean>;
  getOperationalSummary(): Promise<PlatformOperationalSummary>;
}

export class SchoolConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchoolConflictError";
  }
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function utcDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) /
      86_400_000
  );
}

export function createSchoolStore(db: FoundationDatabase): PlatformSchoolStore {
  async function context(schoolId: string) {
    const rows = await db
      .select({ school: schools, settings: schoolSettings, subscription: subscriptions })
      .from(schools)
      .innerJoin(schoolSettings, eq(schoolSettings.schoolId, schools.id))
      .innerJoin(subscriptions, eq(subscriptions.schoolId, schools.id))
      .where(and(eq(schools.id, schoolId), eq(schoolSettings.schoolId, schoolId), eq(subscriptions.schoolId, schoolId)))
      .limit(1);
    return rows[0] ?? null;
  }

  return {
    async createSchool(input) {
      const id = randomUUID();
      const today = utcDate();
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

          if (!school) throw new Error("School insert did not return a row.");

          const [settings] = await tx
            .insert(schoolSettings)
            .values({ schoolId: school.id, defaultLanguage: input.defaultLanguage })
            .returning();

          if (!settings) throw new Error("School settings insert did not return a row.");

          const [subscription] = await tx
            .insert(subscriptions)
            .values({
              schoolId: school.id,
              planCode: "PILOT",
              status: "TRIAL",
              billingCycle: "ANNUAL",
              priceAfn: 0,
              setupFeeAfn: 0,
              startsOn: today,
              expiresOn: addDays(today, 30),
              graceEndsOn: addDays(today, 44)
            })
            .returning();

          if (!subscription) throw new Error("School subscription insert did not return a row.");
          return { school, settings, subscription };
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

    async listPublicSchools(query) {
      const base = db
        .select({
          id: schools.id,
          code: schools.code,
          name: schools.name,
          province: schools.province,
          city: schools.city,
          defaultLanguage: schoolSettings.defaultLanguage
        })
        .from(schools)
        .innerJoin(schoolSettings, eq(schoolSettings.schoolId, schools.id));

      const normalized = query?.trim();
      if (!normalized) {
        return base.where(eq(schools.status, "ACTIVE")).orderBy(schools.name).limit(50);
      }

      const pattern = `%${normalized}%`;
      return base
        .where(
          and(
            eq(schools.status, "ACTIVE"),
            or(ilike(schools.name, pattern), ilike(schools.code, pattern), ilike(schools.province, pattern), ilike(schools.city, pattern))
          )
        )
        .orderBy(schools.name)
        .limit(50);
    },

    getSchoolContext: context,

    async updateSchoolSettings(schoolId, input) {
      const changes = {
        ...(input.defaultLanguage ? { defaultLanguage: input.defaultLanguage } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.dateSystem ? { dateSystem: input.dateSystem } : {}),
        updatedAt: new Date()
      };

      await db.update(schoolSettings).set(changes).where(eq(schoolSettings.schoolId, schoolId));
      return context(schoolId);
    },

    async updateSchoolStatus(schoolId, status) {
      await db.update(schools).set({ status, updatedAt: new Date() }).where(eq(schools.id, schoolId));
      return context(schoolId);
    },

    async updateSubscription(schoolId, input) {
      const existing = await context(schoolId);
      if (!existing) return null;
      await db
        .update(subscriptions)
        .set({
          ...(input.planCode !== undefined ? { planCode: input.planCode } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.billingCycle !== undefined ? { billingCycle: input.billingCycle } : {}),
          ...(input.priceAfn !== undefined ? { priceAfn: input.priceAfn } : {}),
          ...(input.setupFeeAfn !== undefined ? { setupFeeAfn: input.setupFeeAfn } : {}),
          ...(input.startsOn !== undefined ? { startsOn: input.startsOn } : {}),
          ...(input.expiresOn !== undefined ? { expiresOn: input.expiresOn } : {}),
          ...(input.graceEndsOn !== undefined ? { graceEndsOn: input.graceEndsOn } : {}),
          ...(input.supportNotes !== undefined ? { supportNotes: input.supportNotes } : {}),
          updatedAt: new Date()
        })
        .where(eq(subscriptions.schoolId, schoolId));
      return context(schoolId);
    },

    async runSubscriptionLifecycle(today = utcDate()) {
      const rows = await db.select().from(subscriptions);
      let transitioned = 0;
      let remindersCreated = 0;

      for (const subscription of rows) {
        let next: SubscriptionStatus | null = null;
        if (
          (subscription.status === "TRIAL" || subscription.status === "ACTIVE") &&
          subscription.expiresOn &&
          subscription.expiresOn < today
        ) {
          next = "PAST_DUE";
        } else if (subscription.status === "PAST_DUE" && subscription.expiresOn && subscription.expiresOn < today) {
          next = "GRACE";
        } else if (
          subscription.status === "GRACE" &&
          subscription.graceEndsOn &&
          subscription.graceEndsOn < today
        ) {
          next = "SUSPENDED";
        }

        if (next) {
          await db
            .update(subscriptions)
            .set({ status: next, updatedAt: new Date() })
            .where(eq(subscriptions.schoolId, subscription.schoolId));
          transitioned += 1;
        }

        if (!subscription.expiresOn || subscription.status === "SUSPENDED" || subscription.status === "CANCELLED") continue;
        const remaining = daysBetween(today, subscription.expiresOn);
        if (![30, 14, 7, 1].includes(remaining)) continue;

        const admins = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.schoolId, subscription.schoolId),
              eq(users.role, "SCHOOL_ADMIN"),
              or(eq(users.status, "ACTIVE"), eq(users.status, "INVITED"))
            )
          );

        for (const admin of admins) {
          const dedupKey = `subscription-expiry:${subscription.schoolId}:${subscription.expiresOn}:${remaining}:${admin.id}`;
          const [existingNotification] = await db
            .select({ id: notifications.id })
            .from(notifications)
            .where(and(eq(notifications.schoolId, subscription.schoolId), eq(notifications.dedupKey, dedupKey)))
            .limit(1);
          if (existingNotification) continue;

          await db.insert(notifications).values({
            id: randomUUID(),
            schoolId: subscription.schoolId,
            userId: admin.id,
            type: "SUBSCRIPTION_EXPIRING",
            title: "Subscription expiring",
            message: `School subscription expires in ${remaining} day${remaining === 1 ? "" : "s"}.`,
            deepLink: "/admin/pilot-readiness",
            dedupKey,
            metadata: {
              expiresOn: subscription.expiresOn,
              daysRemaining: remaining
            },
            deliveryStatus: "PENDING"
          });
          remindersCreated += 1;
        }
      }

      return { transitioned, remindersCreated };
    },

    async healthCheck() {
      try {
        await db.execute(sql`select 1`);
        return true;
      } catch {
        return false;
      }
    },

    async getOperationalSummary() {
      const schoolRows = await db.select({ id: schools.id }).from(schools);
      const subscriptionRows = await db.select({ status: subscriptions.status }).from(subscriptions);
      const pushRows = await db
        .select({ id: notificationPushDeliveries.id })
        .from(notificationPushDeliveries)
        .where(eq(notificationPushDeliveries.status, "FAILED"));

      const subscriptionCounts: Record<SubscriptionStatus, number> = {
        TRIAL: 0,
        ACTIVE: 0,
        PAST_DUE: 0,
        GRACE: 0,
        SUSPENDED: 0,
        CANCELLED: 0
      };
      for (const row of subscriptionRows) subscriptionCounts[row.status] += 1;

      return {
        database: "ok",
        schools: schoolRows.length,
        subscriptions: subscriptionCounts,
        failedPushDeliveries: pushRows.length
      };
    }
  };
}
