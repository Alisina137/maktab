import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { UserRole, UserStatus } from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  auditLogs,
  authSessions,
  schools,
  users,
  type AuthSession,
  type School,
  type User
} from "./schema.js";

export interface UserLoginContext {
  user: User;
  school: School;
}

export interface AuthenticatedSessionContext {
  session: AuthSession;
  user: User;
  school: School;
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

export interface AccountStore {
  createUser(input: CreateAccountInput): Promise<User>;
  listUsers(schoolId: string): Promise<User[]>;
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
      .select({ session: authSessions, user: users, school: schools })
      .from(authSessions)
      .innerJoin(users, and(eq(users.id, authSessions.userId), eq(users.schoolId, authSessions.schoolId)))
      .innerJoin(schools, eq(schools.id, users.schoolId))
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

    async findUserForLogin(schoolId, username) {
      const rows = await db
        .select({ user: users, school: schools })
        .from(users)
        .innerJoin(schools, eq(schools.id, users.schoolId))
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
    }
  };
}
