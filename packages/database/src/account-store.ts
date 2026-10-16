import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { categorizeAuditAction, safeAuditMetadata, type AuditCategory } from "./audit-safe.js";
import type { UserRole, UserStatus } from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import { isUniqueConstraintViolation } from "./db-errors.js";
import { normalizeStaffPermissions, type StaffProfile, type StaffProfileInput } from "./staff-permissions.js";
import {
  adminPasswordVerifications,
  adminProfiles,
  staffProfiles,
  auditLogs,
  authSessions,
  parentProfiles,
  schools,
  students,
  subscriptions,
  teacherProfiles,
  users,
  type AdminPasswordVerification,
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

export interface UserDirectoryQuery {
  query: string;
  group: "ALL" | "PARENT" | "TEACHER" | "STUDENT" | "STAFF";
  status: "ALL" | UserStatus;
  highlight: "ALL" | "ACTIVE" | "PENDING" | "SUSPENDED";
  sortBy: "name" | "username" | "role" | "status" | "createdAt" | "lastLoginAt";
  order: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface UserDirectoryPage {
  entries: UserDirectoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  counts: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    parent: number;
    teacher: number;
    student: number;
    staff: number;
  };
}

export class AccountBatchConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountBatchConflictError";
  }
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

export interface AdminPasswordVerificationContacts {
  email: string;
}

export interface CreateAdminPasswordVerificationInput {
  id: string;
  schoolId: string;
  userId: string;
  emailCodeHash: string;
  smsCodeHash: string;
  expiresAt: Date;
}

export interface AccountStore {
  createUser(input: CreateAccountInput): Promise<User>;
  listUsers(schoolId: string): Promise<User[]>;
  listUserDirectory(schoolId: string): Promise<UserDirectoryEntry[]>;
  searchUserDirectory(schoolId: string, input: UserDirectoryQuery): Promise<UserDirectoryPage>;
  usernameExists(schoolId: string, username: string): Promise<boolean>;
  bulkSetUserStatusAsAdmin(
    schoolId: string,
    ids: string[],
    action: "suspend" | "reactivate",
    actorUserId: string,
    reason?: string
  ): Promise<User[]>;
  getStaffProfile(schoolId: string, userId: string): Promise<StaffProfile | null>;
  upsertStaffProfile(schoolId: string, userId: string, input: StaffProfileInput, actorUserId: string):
    Promise<StaffProfile | null>;
  getAdminProfile(schoolId: string, userId: string): Promise<AdminContactProfile | null>;
  getSchoolAdminContact(schoolId: string): Promise<SchoolAdminContact | null>;
  upsertAdminProfile(
    schoolId: string,
    userId: string,
    input: AdminContactProfile
  ): Promise<AdminContactProfile>;
  getAdminPasswordVerificationContacts(
    schoolId: string,
    userId: string
  ): Promise<AdminPasswordVerificationContacts | null>;
  createAdminPasswordVerification(
    input: CreateAdminPasswordVerificationInput
  ): Promise<AdminPasswordVerification>;
  findAdminPasswordVerification(
    schoolId: string,
    userId: string,
    verificationId: string
  ): Promise<AdminPasswordVerification | null>;
  incrementAdminPasswordVerificationAttempts(
    schoolId: string,
    userId: string,
    verificationId: string
  ): Promise<AdminPasswordVerification | null>;
  markAdminPasswordVerificationVerified(
    schoolId: string,
    userId: string,
    verificationId: string,
    verificationTokenHash: string
  ): Promise<AdminPasswordVerification | null>;
  consumeAdminPasswordVerification(
    schoolId: string,
    userId: string,
    verificationTokenHash: string
  ): Promise<AdminPasswordVerification | null>;
  cancelAdminPasswordVerification(
    schoolId: string,
    userId: string,
    verificationId: string
  ): Promise<void>;
  resetPasswordAsAdmin(schoolId: string, userId: string, passwordHash: string, actorUserId: string): Promise<User | null>;
  setUserStatusAsAdmin(
    schoolId: string,
    userId: string,
    status: UserStatus,
    actorUserId: string,
    auditAction: "user.suspended" | "user.reactivated",
    reason?: string
  ): Promise<User | null>;
  listAccountAuditLogs(schoolId: string, userId: string, limit?: number): Promise<Array<{
    id: string;
    action: string;
    actorUserId: string | null;
    actorUsername: string | null;
    reason: string | null;
    createdAt: Date;
  }>>;
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
  listPilotAuditEvents(schoolId: string, input: {
    limit: number; offset: number; category?: AuditCategory;
    dateFrom?: Date; dateTo?: Date; actorUserId?: string; search?: string;
  }): Promise<{ logs: Array<{
    id: string; actorUsername: string | null; action: string;
    category: string; entityType: string; targetLabel: string | null;
    metadata: Record<string, string | number | boolean>; createdAt: Date;
  }>; limit: number; offset: number; hasMore: boolean }>;
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
        if (isUniqueConstraintViolation(error)) {
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


    async searchUserDirectory(schoolId, input) {
      const nameExpr = sql<string>`coalesce(
        case ${users.role}
          when 'PARENT' then ${parentProfiles.fullName}
          when 'TEACHER' then ${teacherProfiles.fullName}
          when 'STUDENT' then ${students.fullName}
          else null
        end, ${users.username}
      )`;
      const phoneExpr = sql<string>`coalesce(
        case ${users.role}
          when 'PARENT' then ${parentProfiles.phone}
          when 'TEACHER' then ${teacherProfiles.phone}
          else null
        end, ''
      )`;
      const codeExpr = sql<string>`coalesce(
        case ${users.role}
          when 'TEACHER' then ${teacherProfiles.employeeCode}
          when 'STUDENT' then ${students.studentCode}
          else null
        end, ''
      )`;
      const conditions: SQL[] = [eq(users.schoolId, schoolId)];
      if (input.group === "STAFF") conditions.push(inArray(users.role, ["SCHOOL_ADMIN", "SCHOOL_STAFF"]));
      else if (input.group !== "ALL") conditions.push(eq(users.role, input.group));
      if (input.status !== "ALL") conditions.push(eq(users.status, input.status));
      if (input.highlight === "ACTIVE") conditions.push(eq(users.status, "ACTIVE"));
      else if (input.highlight === "SUSPENDED") conditions.push(eq(users.status, "SUSPENDED"));
      else if (input.highlight === "PENDING") {
        conditions.push(or(eq(users.status, "INVITED"),
          and(eq(users.status, "ACTIVE"), eq(users.mustChangePassword, true)))!);
      }
      const escaped = input.query.trim().replace(/[\\%_]/g, (character) => "\\" + character);
      if (escaped) {
        const pattern = `%${escaped}%`;
        conditions.push(or(
          ilike(users.username, pattern),
          ilike(nameExpr, pattern),
          ilike(phoneExpr, pattern),
          ilike(codeExpr, pattern),
          ilike(sql<string>`${users.role}::text`, pattern),
          ilike(sql<string>`${users.status}::text`, pattern)
        )!);
      }
      const where = and(...conditions)!;
      const baseSelect = () => db.select({
        user: users,
        parentFullName: parentProfiles.fullName,
        parentPhone: parentProfiles.phone,
        teacherFullName: teacherProfiles.fullName,
        teacherPhone: teacherProfiles.phone,
        employeeCode: teacherProfiles.employeeCode,
        studentFullName: students.fullName,
        studentCode: students.studentCode
      }).from(users)
        .leftJoin(parentProfiles, and(eq(parentProfiles.userId, users.id), eq(parentProfiles.schoolId, schoolId)))
        .leftJoin(teacherProfiles, and(eq(teacherProfiles.userId, users.id), eq(teacherProfiles.schoolId, schoolId)))
        .leftJoin(students, and(eq(students.userId, users.id), eq(students.schoolId, schoolId)));
      const sortField = input.sortBy === "name" ? nameExpr :
        input.sortBy === "role" ? users.role :
        input.sortBy === "status" ? users.status :
        input.sortBy === "createdAt" ? users.createdAt :
        input.sortBy === "lastLoginAt" ? users.lastLoginAt : users.username;
      const sort = input.order === "asc" ? asc : desc;
      const [matches, countRows, summary] = await Promise.all([
        baseSelect().where(where).orderBy(sort(sortField), asc(users.id))
          .limit(input.pageSize).offset((input.page - 1) * input.pageSize),
        db.select({ value: count() }).from(users)
          .leftJoin(parentProfiles, and(eq(parentProfiles.userId, users.id), eq(parentProfiles.schoolId, schoolId)))
          .leftJoin(teacherProfiles, and(eq(teacherProfiles.userId, users.id), eq(teacherProfiles.schoolId, schoolId)))
          .leftJoin(students, and(eq(students.userId, users.id), eq(students.schoolId, schoolId)))
          .where(where),
        db.select({
          total: count(),
          active: sql<number>`count(*) filter (where ${users.status} = 'ACTIVE')`,
          pending: sql<number>`count(*) filter (where ${users.status} = 'INVITED'
            or (${users.status} = 'ACTIVE' and ${users.mustChangePassword} = true))`,
          suspended: sql<number>`count(*) filter (where ${users.status} = 'SUSPENDED')`,
          parent: sql<number>`count(*) filter (where ${users.role} = 'PARENT')`,
          teacher: sql<number>`count(*) filter (where ${users.role} = 'TEACHER')`,
          student: sql<number>`count(*) filter (where ${users.role} = 'STUDENT')`,
          staff: sql<number>`count(*) filter (where ${users.role} in ('SCHOOL_ADMIN', 'SCHOOL_STAFF'))`
        }).from(users).where(eq(users.schoolId, schoolId))
      ]);
      const total = Number(countRows[0]?.value ?? 0);
      const tally = summary[0];
      return {
        entries: matches.map((row) => ({
          user: row.user,
          profile: row.user.role === "PARENT"
            ? { fullName: row.parentFullName, phone: row.parentPhone, code: null }
            : row.user.role === "TEACHER"
              ? { fullName: row.teacherFullName, phone: row.teacherPhone, code: row.employeeCode }
              : row.user.role === "STUDENT"
                ? { fullName: row.studentFullName, phone: null, code: row.studentCode }
                : { fullName: null, phone: null, code: null }
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        pages: Math.max(1, Math.ceil(total / input.pageSize)),
        counts: {
          total: Number(tally?.total ?? 0),
          active: Number(tally?.active ?? 0),
          pending: Number(tally?.pending ?? 0),
          suspended: Number(tally?.suspended ?? 0),
          parent: Number(tally?.parent ?? 0),
          teacher: Number(tally?.teacher ?? 0),
          student: Number(tally?.student ?? 0),
          staff: Number(tally?.staff ?? 0)
        }
      };
    },

    async usernameExists(schoolId, username) {
      const row = await db.select({ id: users.id }).from(users).where(and(
        eq(users.schoolId, schoolId),
        sql`lower(${users.username}) = lower(${username})`
      )).limit(1);
      return row.length > 0;
    },

    async bulkSetUserStatusAsAdmin(schoolId, ids, action, actorUserId, reason) {
      return db.transaction(async (tx) => {
        const unique = [...new Set(ids)];
        if (unique.length !== ids.length || unique.length === 0 || unique.length > 20) {
          throw new AccountBatchConflictError("Select between 1 and 20 distinct accounts.");
        }
        const current = await tx.select().from(users).where(and(
          eq(users.schoolId, schoolId), inArray(users.id, unique)
        ));
        const validStatus = action === "suspend" ? ["ACTIVE", "INVITED"] : ["SUSPENDED"];
        if (current.length !== unique.length || current.some((user) =>
          user.id === actorUserId || user.role === "SCHOOL_ADMIN" || !validStatus.includes(user.status)
        )) {
          throw new AccountBatchConflictError("Some accounts are unavailable or no longer eligible. Refresh and try again.");
        }
        const now = new Date();
        const updated = await tx.update(users).set(
          action === "suspend"
            ? { status: "SUSPENDED", updatedAt: now }
            : { status: sql`(case when ${users.mustChangePassword} then 'INVITED' else 'ACTIVE' end)::user_status`, updatedAt: now }
        ).where(and(
          eq(users.schoolId, schoolId),
          inArray(users.id, unique),
          inArray(users.status, action === "suspend" ? ["ACTIVE", "INVITED"] : ["SUSPENDED"]),
          sql`${users.role} <> 'SCHOOL_ADMIN'`,
          sql`${users.id} <> ${actorUserId}`
        )).returning();
        if (updated.length !== unique.length) {
          throw new AccountBatchConflictError("Accounts changed during this request. No accounts were updated.");
        }
        await tx.update(authSessions).set({ revokedAt: now }).where(and(
          eq(authSessions.schoolId, schoolId), inArray(authSessions.userId, unique), isNull(authSessions.revokedAt)
        ));
        await tx.insert(auditLogs).values(updated.map((user) => ({
          id: randomUUID(),
          schoolId,
          actorUserId,
          entityType: "user",
          entityId: user.id,
          action: action === "suspend" ? "user.suspended" : "user.reactivated",
          metadata: reason && action === "suspend" ? { reason, bulk: true } : { bulk: true }
        })));
        return updated;
      });
    },

    async getStaffProfile(schoolId, userId) {
      const [row] = await db.select().from(staffProfiles)
        .innerJoin(users, and(eq(users.id, staffProfiles.userId),
          eq(users.schoolId, staffProfiles.schoolId), eq(users.role, "SCHOOL_STAFF")))
        .where(and(eq(staffProfiles.schoolId, schoolId),
          eq(staffProfiles.userId, userId))).limit(1);
      if (!row) return null;
      const normalized = normalizeStaffPermissions(row.staff_profiles.permissions);
      return { ...row.staff_profiles, permissions: normalized } as StaffProfile;
    },

    async upsertStaffProfile(schoolId, userId, input, actorUserId) {
      // One transaction: reject non-staff/cross-school targets, persist changes,
      // invalidate prior access/refresh tokens and keep school-scoped audit.
      const permissions = normalizeStaffPermissions(input.permissions);
      return db.transaction(async (tx) => {
        const [user] = await tx.select({ id: users.id }).from(users)
          .where(and(eq(users.schoolId, schoolId), eq(users.id, userId),
            eq(users.role, "SCHOOL_STAFF"), sql`${users.status} <> 'ARCHIVED'`)).limit(1);
        if (!user) return null;
        const [updated] = await tx.insert(staffProfiles).values({
          userId, schoolId, fullName: input.fullName,
          employeeCode: input.employeeCode, department: input.department,
          position: input.position, permissions, updatedAt: new Date()
        }).onConflictDoUpdate({ target: staffProfiles.userId, set: {
          fullName: input.fullName, employeeCode: input.employeeCode,
          department: input.department, position: input.position,
          permissions, updatedAt: new Date()
        }}).returning();
        if (!updated) throw new Error("Staff profile update failed.");
        await tx.update(authSessions).set({ revokedAt: new Date() })
          .where(and(eq(authSessions.schoolId, schoolId),
            eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId, entityType: "user",
          entityId: userId, action: "staff.profile_updated",
          metadata: { position: input.position, permissions }
        });
        return { ...updated, permissions } as StaffProfile;
      });
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

    async getAdminPasswordVerificationContacts(schoolId, userId) {
      const rows = await db
        .select({
          email: adminProfiles.email,
          phone: adminProfiles.phone,
          twoFactorEmail: adminProfiles.twoFactorEmail,
          twoFactorPhone: adminProfiles.twoFactorPhone
        })
        .from(adminProfiles)
        .where(and(eq(adminProfiles.schoolId, schoolId), eq(adminProfiles.userId, userId)))
        .limit(1);

      const profile = rows[0];
      if (!profile) return null;

      const email = (profile.twoFactorEmail ?? profile.email)?.trim() ?? "";
      if (!email) return null;

      if (!profile.twoFactorEmail) {
        await db
          .update(adminProfiles)
          .set({
            twoFactorEmail: email,
            updatedAt: new Date()
          })
          .where(and(eq(adminProfiles.schoolId, schoolId), eq(adminProfiles.userId, userId)));
      }

      return { email };
    },

    async createAdminPasswordVerification(input) {
      const now = new Date();
      await db
        .update(adminPasswordVerifications)
        .set({ consumedAt: now })
        .where(
          and(
            eq(adminPasswordVerifications.schoolId, input.schoolId),
            eq(adminPasswordVerifications.userId, input.userId),
            isNull(adminPasswordVerifications.consumedAt)
          )
        );

      const [verification] = await db
        .insert(adminPasswordVerifications)
        .values({
          id: input.id,
          schoolId: input.schoolId,
          userId: input.userId,
          emailCodeHash: input.emailCodeHash,
          smsCodeHash: input.smsCodeHash,
          expiresAt: input.expiresAt
        })
        .returning();
      if (!verification) throw new Error("Admin password verification insert did not return a row.");
      return verification;
    },

    async findAdminPasswordVerification(schoolId, userId, verificationId) {
      const rows = await db
        .select()
        .from(adminPasswordVerifications)
        .where(
          and(
            eq(adminPasswordVerifications.schoolId, schoolId),
            eq(adminPasswordVerifications.userId, userId),
            eq(adminPasswordVerifications.id, verificationId)
          )
        )
        .limit(1);
      return rows[0] ?? null;
    },

    async incrementAdminPasswordVerificationAttempts(schoolId, userId, verificationId) {
      const current = await this.findAdminPasswordVerification(schoolId, userId, verificationId);
      if (!current) return null;
      const [updated] = await db
        .update(adminPasswordVerifications)
        .set({ attempts: current.attempts + 1 })
        .where(
          and(
            eq(adminPasswordVerifications.schoolId, schoolId),
            eq(adminPasswordVerifications.userId, userId),
            eq(adminPasswordVerifications.id, verificationId),
            isNull(adminPasswordVerifications.consumedAt)
          )
        )
        .returning();
      return updated ?? null;
    },

    async markAdminPasswordVerificationVerified(schoolId, userId, verificationId, verificationTokenHash) {
      const [updated] = await db
        .update(adminPasswordVerifications)
        .set({
          verificationTokenHash,
          verifiedAt: new Date()
        })
        .where(
          and(
            eq(adminPasswordVerifications.schoolId, schoolId),
            eq(adminPasswordVerifications.userId, userId),
            eq(adminPasswordVerifications.id, verificationId),
            isNull(adminPasswordVerifications.consumedAt)
          )
        )
        .returning();
      return updated ?? null;
    },

    async consumeAdminPasswordVerification(schoolId, userId, verificationTokenHash) {
      const [updated] = await db
        .update(adminPasswordVerifications)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(adminPasswordVerifications.schoolId, schoolId),
            eq(adminPasswordVerifications.userId, userId),
            eq(adminPasswordVerifications.verificationTokenHash, verificationTokenHash),
            isNotNull(adminPasswordVerifications.verifiedAt),
            isNull(adminPasswordVerifications.consumedAt),
            gt(adminPasswordVerifications.expiresAt, new Date())
          )
        )
        .returning();
      return updated ?? null;
    },

    async cancelAdminPasswordVerification(schoolId, userId, verificationId) {
      await db
        .update(adminPasswordVerifications)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(adminPasswordVerifications.schoolId, schoolId),
            eq(adminPasswordVerifications.userId, userId),
            eq(adminPasswordVerifications.id, verificationId),
            isNull(adminPasswordVerifications.consumedAt)
          )
        );
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

    async setUserStatusAsAdmin(schoolId, userId, status, actorUserId, auditAction, reason) {
      return db.transaction(async (tx) => {
        if (status === "ARCHIVED" || status === "SUSPENDED" || status === "ACTIVE" || status === "INVITED") {
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
          metadata: reason ? { reason } : {}
        });

        return user;
      });
    },

    async listAccountAuditLogs(schoolId, userId, limit = 25) {
      const auditActor = alias(users, "audit_actor");
      const bounded = Math.min(Math.max(limit, 1), 50);
      const rows = await db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorUserId: auditLogs.actorUserId,
        actorUsername: auditActor.username,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt
      }).from(auditLogs).leftJoin(
        auditActor,
        and(eq(auditActor.id, auditLogs.actorUserId), eq(auditActor.schoolId, schoolId))
      ).where(and(
        eq(auditLogs.schoolId, schoolId),
        or(
          and(eq(auditLogs.entityId, userId),
            inArray(auditLogs.entityType, ["user", "parent_profile"])),
          and(eq(auditLogs.entityType, "student"),
            sql`${auditLogs.metadata} ->> 'userId' = ${userId}`)
        )
      )).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(bounded);
      return rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorUserId: row.actorUserId,
        actorUsername: row.actorUsername,
        reason: typeof row.metadata?.reason === "string" ? row.metadata.reason : null,
        createdAt: row.createdAt
      }));
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
        if (status === "ARCHIVED" || status === "SUSPENDED" || status === "ACTIVE" || status === "INVITED") {
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

    async listPilotAuditEvents(schoolId, input) {
      const auditActor = alias(users, "pilot_audit_actor");
      const affectedUser = alias(users, "pilot_audit_target_user");
      const filters: SQL[] = [eq(auditLogs.schoolId, schoolId)];
      if (input.actorUserId) filters.push(eq(auditLogs.actorUserId, input.actorUserId));
      if (input.dateFrom) filters.push(sql`${auditLogs.createdAt} >= ${input.dateFrom}`);
      if (input.dateTo) filters.push(sql`${auditLogs.createdAt} < ${input.dateTo}`);
      if (input.search) {
        // Search only indexed/safe categorical fields, never secret-containing metadata.
        const escaped = input.search.replace(/[\\%_]/g, (c) => "\\" + c);
        filters.push(or(
          ilike(auditLogs.action, `%${escaped}%`),
          ilike(auditLogs.entityType, `%${escaped}%`),
          ilike(auditActor.username, `%${escaped}%`),
          ilike(affectedUser.username, `%${escaped}%`)
        )!);
      }
      // Filtering is done in SQL before paging; category comes from a strictly
      // delimited set of action prefixes and is not based on user metadata.
      if (input.category && input.category !== "all") {
        const categoryPatterns: Record<string, string[]> = {
          accounts: ["user.", "admin.", "auth.", "parent.", "student.", "teacher."],
          academics: ["academic.", "class.", "subject.", "timetable.", "assignment.", "negaran."],
          attendance: ["attendance."],
          learning: ["homework.", "exam.", "grade.", "result.", "learning."],
          communication: ["announcement.", "notification.", "communication."],
          fees: ["fee.", "payment.", "invoice."],
          operations: ["school.", "subscription.", "pilot.", "export.", "import."]
        };
        if (input.category !== "operations") {
          filters.push(or(...(categoryPatterns[input.category] ?? []).map((p) =>
            ilike(auditLogs.action, p + "%")
          ))!);
        } else {
          const nonOperations = Object.entries(categoryPatterns)
            .filter(([name]) => name !== "operations")
            .flatMap(([, prefixes]) => prefixes);
          filters.push(sql`NOT (${sql.join(nonOperations.map(p =>
            sql`lower(${auditLogs.action}) LIKE ${p.toLowerCase() + "%"}`), sql` OR `)})`);
        }
      }
      const bounded = Math.min(Math.max(input.limit, 1), 501);
      const offset = Math.max(input.offset, 0);
      const rows = await db.select({
        id: auditLogs.id, action: auditLogs.action,
        actorUsername: auditActor.username, entityType: auditLogs.entityType,
        targetUsername: affectedUser.username, metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt
      }).from(auditLogs)
        .leftJoin(auditActor, and(eq(auditActor.id, auditLogs.actorUserId),
          eq(auditActor.schoolId, schoolId)))
        .leftJoin(affectedUser, and(eq(affectedUser.id, auditLogs.entityId),
          eq(affectedUser.schoolId, schoolId)))
        .where(and(...filters))
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(bounded + 1).offset(offset);
      return {
        logs: rows.slice(0, bounded).map(row => ({
          id: row.id, action: row.action,
          category: categorizeAuditAction(row.action),
          actorUsername: row.actorUsername,
          entityType: row.entityType,
          targetLabel: row.targetUsername,
          metadata: safeAuditMetadata(row.metadata),
          createdAt: row.createdAt
        })),
        limit: bounded, offset, hasMore: rows.length > bounded
      };
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
        logs: rows.slice(0, limit).map(row => ({ ...row, metadata: safeAuditMetadata(row.metadata) })),
        limit,
        offset,
        hasMore: rows.length > limit
      };
    }
  };
}
