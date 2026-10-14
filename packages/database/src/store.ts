import { randomUUID } from "node:crypto";
import { kabulCivilDate } from "./subscription-health.js";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import type {
  CreateSchoolInput,
  PilotOnboardSchoolInput,
  SubscriptionStatus,
  UpdateSchoolSettingsInput,
  UpdateSubscriptionInput
} from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import { isUniqueConstraintViolation } from "./db-errors.js";
import {
  auditLogs,
  notificationPushDeliveries,
  notifications,
  schoolSettings,
  schools,
  subscriptions,
  users,
  type School,
  type SchoolSettings,
  type Subscription,
  type User
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
  imageUrl: string | null;
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
  onboardPilotSchool(input: PilotOnboardSchoolInput, passwordHash: string): Promise<SchoolContext & { admin: User }>;
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
  // Lifecycle date must match the school-facing Kabul-local calculation.
  return kabulCivilDate();
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
              city: input.city,
              imageUrl: input.imageUrl ?? null
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
        if (isUniqueConstraintViolation(error)) {
          throw new SchoolConflictError("A school with that code or slug already exists.");
        }
        throw error;
      }
    },

    // Pilot creation must be all-or-nothing: no orphan school can remain if
    // its admin, subscription customization, or audit insert fails.
    async onboardPilotSchool(input, passwordHash) {
      const schoolId = randomUUID();
      const today = utcDate();
      const defaultExpiry = addDays(today, 30);
      const defaultGrace = addDays(today, 44);
      const overrides = input.subscription;
      const startsOn = overrides?.startsOn === undefined ? today : overrides.startsOn;
      const expiresOn = overrides?.expiresOn === undefined ? defaultExpiry : overrides.expiresOn;
      const graceEndsOn = overrides?.graceEndsOn === undefined ? defaultGrace : overrides.graceEndsOn;
      if ((startsOn && expiresOn && startsOn > expiresOn) ||
          (expiresOn && graceEndsOn && expiresOn > graceEndsOn)) {
        throw new SchoolConflictError("Subscription dates must follow start, expiry, then grace end.");
      }
      try {
        return await db.transaction(async tx => {
          const [school] = await tx.insert(schools).values({
            id: schoolId, code: input.school.code, name: input.school.name,
            slug: input.school.slug, province: input.school.province,
            city: input.school.city, imageUrl: input.school.imageUrl ?? null
          }).returning();
          if (!school) throw new Error("School insert did not return a row.");
          const [settings] = await tx.insert(schoolSettings).values({
            schoolId, defaultLanguage: input.school.defaultLanguage
          }).returning();
          if (!settings) throw new Error("School settings insert did not return a row.");
          const [subscription] = await tx.insert(subscriptions).values({
            schoolId,
            planCode: overrides?.planCode ?? "PILOT",
            status: overrides?.status ?? "TRIAL",
            billingCycle: overrides?.billingCycle ?? "ANNUAL",
            priceAfn: overrides?.priceAfn ?? 0,
            setupFeeAfn: overrides?.setupFeeAfn ?? 0,
            startsOn, expiresOn, graceEndsOn,
            supportNotes: overrides?.supportNotes ?? null
          }).returning();
          if (!subscription) throw new Error("Subscription insert did not return a row.");
          const [admin] = await tx.insert(users).values({
            id: randomUUID(), schoolId, username: input.adminUsername,
            passwordHash, role: "SCHOOL_ADMIN", status: "INVITED",
            mustChangePassword: true
          }).returning();
          if (!admin) throw new Error("Admin insert did not return a row.");
          await tx.insert(auditLogs).values({
            id: randomUUID(), schoolId, actorUserId: null,
            action: "pilot.school_onboarded", entityType: "school",
            entityId: schoolId,
            metadata: {
              code: school.code,
              adminUsername: admin.username,
              subscriptionStatus: subscription.status
            }
          });
          return { school, settings, subscription, admin };
        });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
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
          imageUrl: schools.imageUrl,
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
      if (existing.subscription.status === "CANCELLED" &&
          input.status !== undefined && input.status !== "CANCELLED") {
        throw new SchoolConflictError("Cancelled subscriptions cannot be reactivated.");
      }
      // Validate the effective persisted date range, not only pairs of fields
      // sent together in one PATCH. Otherwise a partial edit can create
      // impossible start/expiry/grace ordering.
      const startsOn = input.startsOn === undefined ? existing.subscription.startsOn : input.startsOn;
      const expiresOn = input.expiresOn === undefined ? existing.subscription.expiresOn : input.expiresOn;
      const graceEndsOn = input.graceEndsOn === undefined ? existing.subscription.graceEndsOn : input.graceEndsOn;
      if ((startsOn && expiresOn && startsOn > expiresOn) ||
          (expiresOn && graceEndsOn && expiresOn > graceEndsOn)) {
        throw new SchoolConflictError("Subscription dates must follow start, expiry, then grace end.");
      }
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
          const changed = await db
            .update(subscriptions)
            .set({ status: next, updatedAt: new Date() })
            .where(and(eq(subscriptions.schoolId, subscription.schoolId),
              eq(subscriptions.status, subscription.status)))
            .returning({ schoolId: subscriptions.schoolId });
          transitioned += changed.length;
        }

        if (!subscription.expiresOn || subscription.status === "SUSPENDED" || subscription.status === "CANCELLED") continue;
        const remaining = daysBetween(today, subscription.expiresOn);
        if (![30, 14, 7, 1].includes(remaining)) continue;

        const admins = await db
          .select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.schoolId, subscription.schoolId),
            eq(users.role, "SCHOOL_ADMIN"),
            eq(users.status, "ACTIVE")
          ));

        for (const admin of admins) {
          const dedupKey = `subscription-expiry:${subscription.schoolId}:${subscription.expiresOn}:${remaining}:${admin.id}`;
          // Concurrent scheduler invocations must not race the read-before-
          // insert check and abort the whole job on a unique-key conflict.
          const inserted = await db.insert(notifications).values({
            id: randomUUID(),
            schoolId: subscription.schoolId,
            userId: admin.id,
            type: "SUBSCRIPTION_EXPIRING",
            title: "Subscription expiring",
            message: `School subscription expires in ${remaining} day${remaining === 1 ? "" : "s"}.`,
            deepLink: "/admin/pilot/subscription",
            dedupKey,
            metadata: {
              expiresOn: subscription.expiresOn,
              daysRemaining: remaining
            },
            deliveryStatus: "PENDING"
          }).onConflictDoNothing().returning({ id: notifications.id });
          remindersCreated += inserted.length;
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
