import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { UserRole, UserStatus } from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  adminProfiles,
  auditLogs,
  authSessions,
  parentProfiles,
  schools,
  students,
  subscriptions,
  teacherProfiles,
  users,
  type AuthSession,
  type School,
  type Subscription,
  type User
} from "./schema.js";

export interface UserLoginContext {
  user: User;
  school: School;
  subscription: Subscription;
}

export interface AuthenticatedSessionContext {
  session: AuthSession;
  user: User;
  school: School;
  subscription: Subscription;
}

export interface CreateAccountInput {
  schoolId: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

export interface CreateSessionInput {
  schoolId: string;
  userId: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export interface AuditInput {
  schoolId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UserDirectoryEntry {
  user: User;
  profile: {
    fullName: string | null;
    phone: string | null;
    code: string | null;
  };
}

export interface AdminContactProfile {
  fullName: string;
  jobTitle: string | null;
  imageUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  officeLocation: string | null;
  officeHours: string | null;
  bio: string | null;
}

export interface SchoolAdminContact extends AdminContactProfile {
  username: string;
}

export interface AccountStore {
  createUser(input: CreateAccountInput): Promise<User>;
  listUsers(schoolId: string): Promise<User[]>;
  listUserDirectory(schoolId: string): Promise<UserDirectoryEntry[]>;
  getAdminProfile(schoolId: string, userId: string): Promise<AdminContactProfile | null>;
  getSchoolAdminContact(schoolId: string): Promise<SchoolAdminContact | null>;
  upsertAdminProfile(
    schoolId: string,
    userId: string,
    input: AdminContactProfile
  ): Promise<AdminContactProfile>;
  resetPasswordAsAdmin(schoolId: string, userId: string, passwordHash: string, actorUserId: string): Promise<User | null>;
  setUserStatusAsAdmin(
    schoolId: string,
    userId: string,
    status: UserStatus,
    actorUserId: string,
    auditAction: "user.suspended" | "user.reactivated"
  ): Promise<User | null>;
  findUserForLogin(schoolId: string, username: string): Promise<UserLoginContext | null>;
  findUserById(schoolId: string, userId: string): Promise<User | null>;
  updateLastLogin(schoolId: string, userId: string): Promise<void>;
  activateUserWithPassword(schoolId: string, userId: string, passwordHash: string): Promise<User | null>;
  resetPassword(schoolId: string, userId: string, passwordHash: string): Promise<User | null>;
  setUserStatus(schoolId: string, userId: string, status: UserStatus): Promise<User | null>;
  createSession(input: CreateSessionInput): Promise<AuthSession>;
  findByAccessTokenHash(accessTokenHash: string): Promise<AuthenticatedSessionContext | null>;
  findByRefreshTokenHash(refreshTokenHash: string): Promise<AuthenticatedSessionContext | null>;
  rotateSession(sessionId: string, input: Omit<CreateSessionInput, "schoolId" | "userId">): Promise<AuthSession | null>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(schoolId: string, userId: string): Promise<void>;
  writeAudit(input: AuditInput): Promise<void>;
  listAuditLogs(
    schoolId: string,
    input?: { limit?: number; offset?: number }
  ): Promise<{ logs: Array<{
    id: string;
    schoolId: string;
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }>; limit: number; offset: number; hasMore: boolean }>;
}

export class AccountConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountConflictError";
  }
}

export function createAccountStore(db: FoundationDatabase): AccountStore {
  const sessionContext = async (where: ReturnType<typeof eq>) => {
    const rows = await db
      .select({ session: authSessions, user: users, school: schools, subscription: subscriptions })
      .from(authSessions)
      .innerJoin(users, and(eq(users.id, authSessions.userId), eq(users.schoolId, authSessions.schoolId)))
      .innerJoin(schools, eq(schools.id, users.schoolId))
      .innerJoin(subscriptions, eq(subscriptions.schoolId, users.schoolId))
      .where(and(where, isNull(authSessions.revokedAt)))
      .limit(1);
    return rows[0] ?? null;
  };

  return {
    async createUser(input) {
      try {
        const [user] = await db
          .insert(users)
          .values({
            id: randomUUID(),
            schoolId: input.schoolId,
            username: input.username,
            passwordHash: input.passwordHash,
            role: input.role,
            status: "INVITED",
            mustChangePassword: true
          })
          .returning();
        if (!user) throw new Error("User insert did not return a row.");
        return user;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/unique|duplicate/i.test(message)) {
          throw new AccountConflictError("That username already exists in this school.");
        }
        throw error;
      }
    },

    async listUsers(schoolId) {
      return db.select().from(users).where(eq(users.schoolId, schoolId)).orderBy(users.username);
    },

    async listUserDirectory(schoolId) {
      const rows = await db
        .select({
          user: users,
          parentFullName: parentProfiles.fullName,
          parentPhone: parentProfiles.phone,
          teacherFullName: teacherProfiles.fullName,
          teacherPhone: teacherProfiles.phone,
          employeeCode: teacherProfiles.employeeCode,
          studentFullName: students.fullName,
          studentCode: students.studentCode
        })
        .from(users)
        .leftJoin(
          parentProfiles,
          and(eq(parentProfiles.userId, users.id), eq(parentProfiles.schoolId, schoolId))
        )
        .leftJoin(
          teacherProfiles,
          and(eq(teacherProfiles.userId, users.id), eq(teacherProfiles.schoolId, schoolId))
        )
        .leftJoin(
          students,
          and(eq(students.userId, users.id), eq(students.schoolId, schoolId))
        )
        .where(eq(users.schoolId, schoolId))
        .orderBy(users.username);

      return rows.map((row) => ({
        user: row.user,
        profile:
          row.user.role === "PARENT"
            ? { fullName: row.parentFullName, phone: row.parentPhone, code: null }
            : row.user.role === "TEACHER"
              ? { fullName: row.teacherFullName, phone: row.teacherPhone, code: row.employeeCode }
              : row.user.role === "STUDENT"
                ? { fullName: row.studentFullName, phone: null, code: row.studentCode }
                : { fullName: null, phone: null, code: null }
      }));
    },

    async getAdminProfile(schoolId, userId) {
      const rows = await db
        .select({
          fullName: adminProfiles.fullName,
          jobTitle: adminProfiles.jobTitle,
          imageUrl: adminProfiles.imageUrl,
          email: adminProfiles.email,
          whatsapp: adminProfiles.whatsapp,
          phone: adminProfiles.phone,
          officeLocation: adminProfiles.officeLocation,
          officeHours: adminProfiles.officeHours,
          bio: adminProfiles.bio
        })
        .from(adminProfiles)
        .where(and(eq(adminProfiles.schoolId, schoolId), eq(adminProfiles.userId, userId)))
        .limit(1);
      return rows[0] ?? null;
    },

    async getSchoolAdminContact(schoolId) {
      const rows = await db
        .select({
          username: users.username,
          fullName: adminProfiles.fullName,
          jobTitle: adminProfiles.jobTitle,
          imageUrl: adminProfiles.imageUrl,
          email: adminProfiles.email,
          whatsapp: adminProfiles.whatsapp,
          phone: adminProfiles.phone,
          officeLocation: adminProfiles.officeLocation,
          officeHours: adminProfiles.officeHours,
          bio: adminProfiles.bio
        })
        .from(adminProfiles)
        .innerJoin(
          users,
          and(
            eq(users.id, adminProfiles.userId),
            eq(users.schoolId, adminProfiles.schoolId),
            eq(users.role, "SCHOOL_ADMIN")
          )
        )
        .where(and(eq(adminProfiles.schoolId, schoolId), eq(users.status, "ACTIVE")))
        .orderBy(desc(adminProfiles.updatedAt))
        .limit(1);
      return rows[0] ?? null;
    },

    async upsertAdminProfile(schoolId, userId, input) {
      const values = {
        fullName: input.fullName,
        jobTitle: input.jobTitle ?? null,
        imageUrl: input.imageUrl ?? null,
        email: input.email ?? null,
        whatsapp: input.whatsapp ?? null,
        phone: input.phone ?? null,
        officeLocation: input.officeLocation ?? null,
        officeHours: input.officeHours ?? null,
        bio: input.bio ?? null
      };

      const [profile] = await db
        .insert(adminProfiles)
        .values({
          userId,
          schoolId,
          ...values
        })
        .onConflictDoUpdate({
          target: adminProfiles.userId,
          set: {
            ...values,
            updatedAt: new Date()
          }
        })
        .returning({
          fullName: adminProfiles.fullName,
          jobTitle: adminProfiles.jobTitle,
          imageUrl: adminProfiles.imageUrl,
          email: adminProfiles.email,
          whatsapp: adminProfiles.whatsapp,
          phone: adminProfiles.phone,
          officeLocation: adminProfiles.officeLocation,
          officeHours: adminProfiles.officeHours,
          bio: adminProfiles.bio
        });
      if (!profile) throw new Error("Admin profile upsert did not return a row.");
      return profile;
    },

    async resetPasswordAsAdmin(schoolId, userId, passwordHash, actorUserId) {
      return db.transaction(async (tx) => {
        await tx
          .update(authSessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(authSessions.schoolId, schoolId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));

        const [user] = await tx
          .update(users)
          .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
          .where(and(eq(users.schoolId, schoolId), eq(users.id, userId)))
          .returning();

        if (!user) return null;

        await tx.insert(auditLogs).values({
          id: randomUUID(),
          schoolId,
          actorUserId,
          action: "user.password_reset",
          entityType: "user",
          entityId: user.id,
          metadata: {}
        });

        return user;
      });
    },

    async setUserStatusAsAdmin(schoolId, userId, status, actorUserId, auditAction) {
      return db.transaction(async (tx) => {
        if (status === "SUSPENDED" || status === "ARCHIVED") {
          await tx
            .update(authSessions)
            .set({ revokedAt: new Date() })
            .where(and(eq(authSessions.schoolId, schoolId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
        }

        const [user] = await tx
          .update(users)
          .set({ status, updatedAt: new Date() })
          .where(and(eq(users.schoolId, schoolId), eq(users.id, userId)))
          .returning();

        if (!user) return null;

        await tx.insert(auditLogs).values({
          id: randomUUID(),
          schoolId,
          actorUserId,
          action: auditAction,
          entityType: "user",
          entityId: user.id,
          metadata: {}
        });

        return user;
      });
    },

    async findUserForLogin(schoolId, username) {
      const rows = await db
        .select({ user: users, school: schools, subscription: subscriptions })
        .from(users)
        .innerJoin(schools, eq(schools.id, users.schoolId))
        .innerJoin(subscriptions, eq(subscriptions.schoolId, users.schoolId))
        .where(and(eq(users.schoolId, schoolId), eq(users.username, username)))
        .limit(1);
      return rows[0] ?? null;
    },

    async findUserById(schoolId, userId) {
      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.schoolId, schoolId), eq(users.id, userId)))
        .limit(1);
      return rows[0] ?? null;
    },

    async updateLastLogin(schoolId, userId) {
      await db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(and(eq(users.schoolId, schoolId), eq(users.id, userId)));
    },

    async activateUserWithPassword(schoolId, userId, passwordHash) {
      return db.transaction(async (tx) => {
        await tx
          .update(authSessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(authSessions.schoolId, schoolId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));

        const [user] = await tx
          .update(users)
          .set({
            passwordHash,
            status: "ACTIVE",
            mustChangePassword: false,
            updatedAt: new Date()
          })
          .where(and(eq(users.schoolId, schoolId), eq(users.id, userId)))
          .returning();
        return user ?? null;
      });
    },

    async resetPassword(schoolId, userId, passwordHash) {
      return db.transaction(async (tx) => {
        await tx
          .update(authSessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(authSessions.schoolId, schoolId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));

        const [user] = await tx
          .update(users)
          .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
          .where(and(eq(users.schoolId, schoolId), eq(users.id, userId)))
          .returning();
        return user ?? null;
      });
    },

    async setUserStatus(schoolId, userId, status) {
      return db.transaction(async (tx) => {
        if (status === "SUSPENDED" || status === "ARCHIVED") {
          await tx
            .update(authSessions)
            .set({ revokedAt: new Date() })
            .where(and(eq(authSessions.schoolId, schoolId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
        }

        const [user] = await tx
          .update(users)
          .set({ status, updatedAt: new Date() })
          .where(and(eq(users.schoolId, schoolId), eq(users.id, userId)))
          .returning();
        return user ?? null;
      });
    },

    async createSession(input) {
      const [session] = await db
        .insert(authSessions)
        .values({ id: randomUUID(), ...input })
        .returning();
      if (!session) throw new Error("Session insert did not return a row.");
      return session;
    },

    async findByAccessTokenHash(accessTokenHash) {
      return sessionContext(eq(authSessions.accessTokenHash, accessTokenHash));
    },

    async findByRefreshTokenHash(refreshTokenHash) {
      return sessionContext(eq(authSessions.refreshTokenHash, refreshTokenHash));
    },

    async rotateSession(sessionId, input) {
      const [session] = await db
        .update(authSessions)
        .set({
          accessTokenHash: input.accessTokenHash,
          refreshTokenHash: input.refreshTokenHash,
          accessExpiresAt: input.accessExpiresAt,
          refreshExpiresAt: input.refreshExpiresAt,
          rotatedAt: new Date()
        })
        .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)))
        .returning();
      return session ?? null;
    },

    async revokeSession(sessionId) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
    },

    async revokeAllUserSessions(schoolId, userId) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.schoolId, schoolId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
    },

    async writeAudit(input) {
      await db.insert(auditLogs).values({
        id: randomUUID(),
        schoolId: input.schoolId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? {}
      });
    },

    async listAuditLogs(schoolId, input = {}) {
      const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
      const offset = Math.max(input.offset ?? 0, 0);
      const rows = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.schoolId, schoolId))
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(limit + 1)
        .offset(offset);
      return {
        logs: rows.slice(0, limit),
        limit,
        offset,
        hasMore: rows.length > limit
      };
    }
  };
}
