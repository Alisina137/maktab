import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type {
  CreateAnnouncementInput,
  UpdateScheduledAnnouncementInput,
  CreateFeeInvoiceInput,
  UpdateDraftFeeInvoiceInput,
  AdminFeeInvoiceQuery,
  DevicePlatform,
  FeeInvoiceStatus,
  RecordFeePaymentInput,
  ReverseFeePaymentInput,
  UserRole
} from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  announcements,
  auditLogs,
  classSections,
  communicationSettings,
  devices,
  feeInvoices,
  feeInvoiceCounters,
  feePayments,
  negaranAssignments,
  notificationPushDeliveries,
  notifications,
  schoolSettings,
  students,
  teacherAssignments,
  users,
  type Announcement,
  type Device,
  type FeeInvoice,
  type FeePayment,
  type Notification
} from "./schema.js";

export interface FeeInvoiceView {
  invoice: FeeInvoice;
  studentName: string;
  studentCode: string;
  paid: number;
  outstanding: number;
  payments: FeePayment[];
}

export interface CommunicationOverview {
  announcements: Announcement[];
  invoices: FeeInvoiceView[];
  feeReminderDays: number[];
}

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface PushProvider {
  send(message: PushMessage): Promise<PushResult>;
}

export interface CommunicationStore {
  createAnnouncement(schoolId: string, actorUserId: string, input: CreateAnnouncementInput): Promise<Announcement>;
  createNegaranAnnouncement(schoolId: string, teacherUserId: string, input: CreateAnnouncementInput): Promise<Announcement>;
  archiveAnnouncement(schoolId: string, actorUserId: string, announcementId: string): Promise<Announcement>;
  updateScheduledAnnouncement(schoolId: string, actorUserId: string, announcementId: string, input: UpdateScheduledAnnouncementInput): Promise<Announcement>;
  hasActiveStudentEnrollment(schoolId: string, userId: string): Promise<boolean>;
  getAnnouncementsForUser(schoolId: string, userId: string, role: UserRole): Promise<Announcement[]>;
  getAdminOverview(schoolId: string): Promise<CommunicationOverview>;
  previewAnnouncementAudience(schoolId: string, input: Pick<CreateAnnouncementInput,
    "audienceScope" | "classId" | "audienceRole">): Promise<{ recipientCount: number; schoolTimezone: string }>;
  listAdminFeeInvoices(schoolId: string, query: AdminFeeInvoiceQuery): Promise<{
    invoices: FeeInvoiceView[]; total: number; page: number; pageSize: number;
  }>;
  updateDraftFeeInvoice(schoolId: string, actorUserId: string, invoiceId: string,
    input: UpdateDraftFeeInvoiceInput): Promise<FeeInvoice>;
  createFeeInvoice(schoolId: string, actorUserId: string, input: CreateFeeInvoiceInput): Promise<FeeInvoice>;
  issueFeeInvoice(schoolId: string, invoiceId: string, actorUserId?: string): Promise<FeeInvoice>;
  cancelFeeInvoice(schoolId: string, invoiceId: string, actorUserId?: string): Promise<FeeInvoice>;
  recordFeePayment(schoolId: string, actorUserId: string, invoiceId: string, input: RecordFeePaymentInput): Promise<FeeInvoiceView>;
  reverseFeePayment(schoolId: string, actorUserId: string, paymentId: string, input: ReverseFeePaymentInput): Promise<FeeInvoiceView>;
  getParentFees(schoolId: string, parentUserId: string, studentId: string): Promise<FeeInvoiceView[]>;
  getStudentFees(schoolId: string, studentUserId: string): Promise<FeeInvoiceView[]>;
  updateFeeReminderDays(schoolId: string, days: number[]): Promise<number[]>;
  runScheduledNotifications(now?: Date): Promise<{ announcementNotifications: number; feeReminders: number; overdueInvoices: number }>;
  registerDevice(schoolId: string, userId: string, pushToken: string, platform: DevicePlatform): Promise<Device>;
  deactivateDevice(schoolId: string, userId: string, pushToken: string): Promise<void>;
  getUserNotifications(schoolId: string, userId: string): Promise<Notification[]>;
  markNotificationRead(schoolId: string, userId: string, notificationId: string): Promise<Notification | null>;
  markAllNotificationsRead(schoolId: string, userId: string): Promise<number>;
  getUnreadNotificationCount(schoolId: string, userId: string): Promise<number>;
  deliverPendingPush(provider: PushProvider, limit?: number): Promise<{ sent: number; failed: number; skipped: number }>;
}

export class CommunicationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunicationValidationError";
  }
}
export class CommunicationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunicationConflictError";
  }
}
export class CommunicationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunicationNotFoundError";
  }
}

function dayDiff(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not resolve school-local date.");
  return `${year}-${month}-${day}`;
}

export function createExpoPushProvider(fetchImpl: typeof fetch = fetch): PushProvider {
  return {
    async send(message) {
      try {
        const response = await fetchImpl("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            to: message.token,
            title: message.title,
            body: message.body,
            data: message.data ?? {},
            sound: "default"
          })
        });
        if (!response.ok) return { ok: false, error: `Expo push HTTP ${response.status}` };
        const body = await response.json() as { data?: { status?: string; id?: string; message?: string } };
        if (body.data?.status === "ok") return { ok: true, providerMessageId: body.data.id };
        return { ok: false, error: body.data?.message ?? "Expo push rejected the message." };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Push delivery failed." };
      }
    }
  };
}

export function createCommunicationStore(db: FoundationDatabase): CommunicationStore {
  async function getUser(schoolId: string, userId: string) {
    const [user] = await db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, userId))).limit(1);
    if (!user) throw new CommunicationNotFoundError("User not found.");
    return user;
  }

  async function getStudent(schoolId: string, studentId: string) {
    const [student] = await db.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.id, studentId))).limit(1);
    if (!student) throw new CommunicationNotFoundError("Student not found.");
    return student;
  }

  async function schoolDateAt(schoolId: string, instant = new Date()) {
    const [settings] = await db
      .select({ timezone: schoolSettings.timezone })
      .from(schoolSettings)
      .where(eq(schoolSettings.schoolId, schoolId))
      .limit(1);
    return localDate(instant, settings?.timezone ?? "Asia/Kabul");
  }

  async function classIdsForUser(schoolId: string, userId: string, role: UserRole): Promise<Set<string>> {
    if (role === "PARENT") {
      const rows = await db.select({ classId: students.classId }).from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.parentUserId, userId), eq(students.status, "ACTIVE")));
      return new Set(rows.map((row) => row.classId));
    }
    if (role === "STUDENT") {
      const rows = await db.select({ classId: students.classId }).from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.userId, userId), eq(students.status, "ACTIVE")));
      return new Set(rows.map((row) => row.classId));
    }
    if (role === "TEACHER") {
      const today = await schoolDateAt(schoolId);
      const [assigned, supervised] = await Promise.all([
        db.select({ classId: teacherAssignments.classId }).from(teacherAssignments)
          .where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.teacherUserId, userId))),
        db.select({ classId: negaranAssignments.classId }).from(negaranAssignments)
          .where(and(
            eq(negaranAssignments.schoolId, schoolId),
            eq(negaranAssignments.teacherUserId, userId),
            lte(negaranAssignments.startDate, today),
            or(isNull(negaranAssignments.endDate), sql`${negaranAssignments.endDate} >= ${today}`)
          ))
      ]);
      return new Set([...assigned, ...supervised].map((row) => row.classId));
    }
    return new Set();
  }

  async function eligibleAudienceUserIds(
    schoolId: string,
    recipients: Array<{ id: string; role: string }>
  ): Promise<string[]> {
    const studentUserIds = recipients.filter((row) => row.role === "STUDENT").map((row) => row.id);
    if (studentUserIds.length === 0) return recipients.map((row) => row.id);
    const active = await db.select({ userId: students.userId }).from(students)
      .where(and(
        eq(students.schoolId, schoolId),
        eq(students.status, "ACTIVE"),
        inArray(students.userId, studentUserIds)
      ));
    const activeStudentIds = new Set(active.map((row) => row.userId));
    return recipients
      .filter((row) => row.role !== "STUDENT" || activeStudentIds.has(row.id))
      .map((row) => row.id);
  }

  async function announcementRecipients(announcement: Announcement, effectiveAt = new Date()): Promise<string[]> {
    if (announcement.audienceScope === "SCHOOL") {
      const rows = await db.select({ id: users.id, role: users.role }).from(users)
        .where(and(eq(users.schoolId, announcement.schoolId), ne(users.status, "ARCHIVED"), ne(users.status, "SUSPENDED")));
      return eligibleAudienceUserIds(announcement.schoolId, rows);
    }
    if (announcement.audienceScope === "ROLE") {
      if (!announcement.audienceRole) return [];
      const rows = await db.select({ id: users.id, role: users.role }).from(users)
        .where(and(
          eq(users.schoolId, announcement.schoolId),
          eq(users.role, announcement.audienceRole),
          ne(users.status, "ARCHIVED"),
          ne(users.status, "SUSPENDED")
        ));
      return eligibleAudienceUserIds(announcement.schoolId, rows);
    }
    if (!announcement.classId) return [];
    const [targetClass] = await db.select({ academicYearId: classSections.academicYearId })
      .from(classSections).where(and(
        eq(classSections.schoolId, announcement.schoolId),
        eq(classSections.id, announcement.classId)
      )).limit(1);
    if (!targetClass) return [];
    const effectiveDate = await schoolDateAt(announcement.schoolId, effectiveAt);
    const [studentRows, teacherRows, negaranRows] = await Promise.all([
      db.select({ parentUserId: students.parentUserId, userId: students.userId }).from(students)
        .where(and(eq(students.schoolId, announcement.schoolId), eq(students.classId, announcement.classId),
          eq(students.academicYearId, targetClass.academicYearId),
          eq(students.status, "ACTIVE"))),
      db.select({ userId: teacherAssignments.teacherUserId }).from(teacherAssignments)
        .where(and(eq(teacherAssignments.schoolId, announcement.schoolId),
            eq(teacherAssignments.classId, announcement.classId),
            eq(teacherAssignments.academicYearId, targetClass.academicYearId))),
      db.select({ userId: negaranAssignments.teacherUserId }).from(negaranAssignments)
        .where(and(
          eq(negaranAssignments.schoolId, announcement.schoolId),
          eq(negaranAssignments.classId, announcement.classId),
          lte(negaranAssignments.startDate, effectiveDate),
          or(isNull(negaranAssignments.endDate), sql`${negaranAssignments.endDate} >= ${effectiveDate}`)
        ))
    ]);
    const all = Array.from(new Set([
      ...studentRows.flatMap(row => row.userId ? [row.parentUserId, row.userId] : [row.parentUserId]),
      ...teacherRows.map(row => row.userId),
      ...negaranRows.map(row => row.userId)
    ]));
    if (all.length === 0) return [];
    const permitted = await db.select({ id: users.id, role: users.role }).from(users).where(and(
      eq(users.schoolId, announcement.schoolId),
      inArray(users.id, all),
      ne(users.status, "SUSPENDED"), ne(users.status, "ARCHIVED")
    ));
    // CLASS+role means intersection, never union. A teacher cannot receive
    // a parent-only notice merely because they teach this class.
    return permitted.filter(row =>
      !announcement.audienceRole || row.role === announcement.audienceRole
    ).map(row => row.id);
  }

  async function materializeAnnouncement(announcement: Announcement, effectiveNow = new Date()): Promise<number> {
    if (announcement.archivedAt || announcement.publishAt.getTime() > effectiveNow.getTime()) return 0;
    const recipients = await announcementRecipients(announcement, effectiveNow);
    let created = 0;
    for (const userId of recipients) {
      const dedupKey = `announcement:${announcement.id}:${userId}`;
      const inserted = await db.insert(notifications).values({
        id: randomUUID(),
        schoolId: announcement.schoolId,
        userId,
        type: "ANNOUNCEMENT",
        title: announcement.title,
        message: announcement.content,
        deepLink: "/announcements",
        dedupKey,
        metadata: { announcementId: announcement.id, audienceScope: announcement.audienceScope,
          classId: announcement.classId, audienceRole: announcement.audienceRole }
      }).onConflictDoNothing().returning({ id: notifications.id });
      created += inserted.length;
    }
    return created;
  }

  async function paymentTotals(schoolId: string, invoiceId: string) {
    const rows = await db.select().from(feePayments)
      .where(and(eq(feePayments.schoolId, schoolId), eq(feePayments.invoiceId, invoiceId)))
      .orderBy(asc(feePayments.recordedAt));
    const paid = rows.reduce((sum, row) => sum + (row.kind === "PAYMENT" ? row.amount : -row.amount), 0);
    return { rows, paid };
  }

  // Balance and status are always calculated from the append-only ledger.
  // The invoice row lock in each mutation serializes payment/cancel/reversal.
  function balanceStatus(invoice: FeeInvoice, paid: number, today: string): FeeInvoiceStatus {
    if (paid >= invoice.amount) return "PAID";
    if (invoice.dueDate < today) return "OVERDUE";
    return paid > 0 ? "PARTIALLY_PAID" : "ISSUED";
  }

  async function cancelFeeAlerts(schoolId: string, invoiceId: string, tx: Parameters<Parameters<FoundationDatabase["transaction"]>[0]>[0]) {
    await tx.update(notifications).set({ deliveryStatus: "CANCELLED", updatedAt: new Date() })
      .where(and(eq(notifications.schoolId, schoolId),
        sql`${notifications.dedupKey} LIKE ${`fee-reminder:${invoiceId}:%`}`,
        ne(notifications.deliveryStatus, "CANCELLED")));
  }

  async function feeAlertIsVisible(row: Notification): Promise<boolean> {
    if (row.type !== "FEE_DUE" && row.type !== "FEE_OVERDUE") return true;
    const [guardian] = await db.select({ id: users.id }).from(users).where(and(
      eq(users.id, row.userId), eq(users.schoolId, row.schoolId),
      eq(users.role, "PARENT"), ne(users.status, "SUSPENDED"), ne(users.status, "ARCHIVED")
    )).limit(1);
    if (!guardian) return false;
    const invoiceId = row.metadata.invoiceId;
    const studentId = row.metadata.studentId;
    if (typeof invoiceId !== "string" || typeof studentId !== "string") return false;
    const [invoice] = await db.select().from(feeInvoices).where(and(
      eq(feeInvoices.schoolId, row.schoolId), eq(feeInvoices.id, invoiceId),
      eq(feeInvoices.studentId, studentId)
    )).limit(1);
    if (!invoice || invoice.status === "CANCELLED" || invoice.status === "DRAFT") return false;
    const [student] = await db.select().from(students).where(and(
      eq(students.schoolId, row.schoolId), eq(students.id, studentId),
      eq(students.parentUserId, row.userId), eq(students.status, "ACTIVE")
    )).limit(1);
    if (!student) return false;
    const totals = await paymentTotals(row.schoolId, invoice.id);
    return totals.paid < invoice.amount;
  }

  async function invoiceView(invoice: FeeInvoice): Promise<FeeInvoiceView> {
    const student = await getStudent(invoice.schoolId, invoice.studentId);
    const totals = await paymentTotals(invoice.schoolId, invoice.id);
    // The UI must still show overdue if the scheduled job has not run today.
    // This is a read-only projection; the scheduler persists the OVERDUE state.
    const status = invoice.status === "DRAFT" || invoice.status === "CANCELLED"
      ? invoice.status
      : balanceStatus(invoice, totals.paid, await schoolDateAt(invoice.schoolId));
    return {
      invoice: status === invoice.status ? invoice : { ...invoice, status },
      studentName: student.fullName,
      studentCode: student.studentCode,
      paid: totals.paid,
      outstanding: Math.max(0, invoice.amount - totals.paid),
      payments: totals.rows
    };
  }

  async function createNotificationOnce(input: {
    schoolId: string; userId: string; type: string; title: string; message: string;
    deepLink: string; dedupKey: string; metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    const inserted = await db.insert(notifications).values({
      id: randomUUID(), schoolId: input.schoolId, userId: input.userId,
      type: input.type, title: input.title, message: input.message, deepLink: input.deepLink,
      dedupKey: input.dedupKey, metadata: input.metadata ?? {}
    }).onConflictDoNothing().returning({ id: notifications.id });
    return inserted.length > 0;
  }

  return {
    async previewAnnouncementAudience(schoolId, input) {
      if (input.classId) {
        const [targetClass] = await db.select({ id: classSections.id })
          .from(classSections).where(and(eq(classSections.schoolId, schoolId),
            eq(classSections.id, input.classId))).limit(1);
        if (!targetClass) throw new CommunicationNotFoundError("Class not found.");
      }
      const [settings] = await db.select({ timezone: schoolSettings.timezone })
        .from(schoolSettings).where(eq(schoolSettings.schoolId, schoolId)).limit(1);
      const schoolTimezone = settings?.timezone ?? "Asia/Kabul";
      const now = new Date();
      // Use the exact same recipient resolver as announcement publication.
      // This preview is a current snapshot, not a reservation or delivery guarantee.
      const announcement = {
        id: randomUUID(), schoolId, createdBy: "", title: "", content: "",
        audienceScope: input.audienceScope, classId: input.classId ?? null,
        audienceRole: input.audienceRole ?? null, publishAt: now,
        archivedAt: null, createdAt: now, updatedAt: now
      } satisfies Announcement;
      const ids = await announcementRecipients(announcement, now);
      return { recipientCount: new Set(ids).size, schoolTimezone };
    },
    async createAnnouncement(schoolId, actorUserId, input) {
      await getUser(schoolId, actorUserId);
      if (input.classId) {
        const [classRow] = await db.select({ id: classSections.id }).from(classSections)
          .where(and(eq(classSections.schoolId, schoolId), eq(classSections.id, input.classId))).limit(1);
        if (!classRow) throw new CommunicationNotFoundError("Class not found.");
      }
      const announcementId = randomUUID();
      const publishAt = input.publishAt ? new Date(input.publishAt) : new Date();
      const preview: Announcement = {
        id: announcementId, schoolId, createdBy: actorUserId,
        title: input.title, content: input.content, audienceScope: input.audienceScope,
        classId: input.classId ?? null, audienceRole: input.audienceRole ?? null,
        publishAt, archivedAt: null, createdAt: new Date(), updatedAt: new Date()
      };
      const recipients = publishAt.getTime() <= Date.now()
        ? await announcementRecipients(preview) : [];
      return db.transaction(async tx => {
      const [created] = await tx.insert(announcements).values({
        id: announcementId, schoolId, createdBy: actorUserId, title: input.title, content: input.content,
        audienceScope: input.audienceScope, classId: input.classId ?? null,
        audienceRole: input.audienceRole ?? null,
        publishAt
      }).returning();
      if (!created) throw new Error("Announcement insert did not return a row.");
      if (recipients.length) {
        for (const userId of recipients) {
          await tx.insert(notifications).values({
            id: randomUUID(), schoolId, userId, type: "ANNOUNCEMENT",
            title: created.title, message: created.content, deepLink: "/announcements",
            dedupKey: `announcement:${created.id}:${userId}`,
            metadata: { announcementId: created.id, classId: created.classId,
              audienceScope: created.audienceScope, audienceRole: created.audienceRole }
          }).onConflictDoNothing();
        }
      }
      await tx.insert(auditLogs).values({
        id: randomUUID(), schoolId, actorUserId, action: "announcement.created",
        entityType: "announcement", entityId: created.id,
        metadata: { audienceScope: created.audienceScope, classId: created.classId,
          audienceRole: created.audienceRole, publishAt: created.publishAt.toISOString() }
      });
      return created;
      });
    },

    async createNegaranAnnouncement(schoolId, teacherUserId, input) {
      if (input.audienceScope !== "CLASS" || !input.classId) {
        throw new CommunicationValidationError("Negaran announcements must target the supervised class.");
      }
      const now = await schoolDateAt(schoolId);
      const [assignment] = await db.select({ id: negaranAssignments.id }).from(negaranAssignments)
        .where(and(
          eq(negaranAssignments.schoolId, schoolId),
          eq(negaranAssignments.teacherUserId, teacherUserId),
          eq(negaranAssignments.classId, input.classId),
          lte(negaranAssignments.startDate, now),
          or(isNull(negaranAssignments.endDate), sql`${negaranAssignments.endDate} >= ${now}`)
        )).limit(1);
      if (!assignment) throw new CommunicationValidationError("Only the active Negaran may announce to this class.");
      return this.createAnnouncement(schoolId, teacherUserId, input);
    },

    async updateScheduledAnnouncement(schoolId, actorUserId, announcementId, input) {
      return db.transaction(async tx => {
        const [current] = await tx.select().from(announcements).where(and(
          eq(announcements.schoolId, schoolId), eq(announcements.id, announcementId)
        )).limit(1).for("update");
        if (!current) throw new CommunicationNotFoundError("Announcement not found.");
        if (current.archivedAt || current.publishAt.getTime() <= Date.now()) {
          throw new CommunicationConflictError("Only scheduled, unpublished announcements can be edited.");
        }
        const next = {
          title: input.title ?? current.title, content: input.content ?? current.content,
          audienceScope: input.audienceScope ?? current.audienceScope,
          classId: input.classId === undefined ? current.classId : input.classId,
          audienceRole: input.audienceRole === undefined ? current.audienceRole : input.audienceRole,
          publishAt: input.publishAt ? new Date(input.publishAt) : current.publishAt
        };
        if (next.publishAt.getTime() <= Date.now()) {
          throw new CommunicationValidationError("Scheduled publication must remain in the future.");
        }
        if ((next.audienceScope === "CLASS") !== Boolean(next.classId) ||
          (next.audienceScope === "ROLE" && !next.audienceRole) ||
          (next.audienceScope === "SCHOOL" && !!next.audienceRole)) {
          throw new CommunicationValidationError("Announcement audience fields do not match its scope.");
        }
        if (next.classId) {
          const [classRow] = await tx.select({ id: classSections.id }).from(classSections)
            .where(and(eq(classSections.schoolId, schoolId), eq(classSections.id, next.classId))).limit(1);
          if (!classRow) throw new CommunicationNotFoundError("Class not found.");
        }
        const [updated] = await tx.update(announcements).set({ ...next, updatedAt: new Date() })
          .where(and(eq(announcements.schoolId, schoolId), eq(announcements.id, announcementId),
            isNull(announcements.archivedAt))).returning();
        if (!updated) throw new CommunicationConflictError("Announcement changed.");
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId, action: "announcement.scheduled_updated",
          entityType: "announcement", entityId: announcementId,
          metadata: { previousPublishAt: current.publishAt.toISOString(),
            publishAt: updated.publishAt.toISOString() }
        });
        return updated;
      });
    },

    async archiveAnnouncement(schoolId, actorUserId, announcementId) {
      return db.transaction(async tx => {
        const [current] = await tx.select({ archivedAt: announcements.archivedAt })
          .from(announcements).where(and(eq(announcements.schoolId, schoolId),
            eq(announcements.id, announcementId))).limit(1).for("update");
        if (!current) throw new CommunicationNotFoundError("Announcement not found.");
        if (current.archivedAt) throw new CommunicationConflictError("Announcement already archived.");
        const [updated] = await tx.update(announcements).set({
          archivedAt: new Date(), updatedAt: new Date()
        }).where(and(eq(announcements.schoolId, schoolId),
          eq(announcements.id, announcementId),
          isNull(announcements.archivedAt))).returning();
        if (!updated) throw new CommunicationConflictError("Announcement is already archived or missing.");
        await tx.update(notifications).set({
          deliveryStatus: "CANCELLED", updatedAt: new Date()
        }).where(and(eq(notifications.schoolId, schoolId),
          sql`${notifications.dedupKey} LIKE ${`announcement:${announcementId}:%`}`));
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId, action: "announcement.archived",
          entityType: "announcement", entityId: announcementId,
          metadata: { audienceScope: updated.audienceScope }
        });
        return updated;
      });
    },

    async hasActiveStudentEnrollment(schoolId, userId) {
      const [row] = await db.select({ id: students.id }).from(students)
        .where(and(
          eq(students.schoolId, schoolId),
          eq(students.userId, userId),
          eq(students.status, "ACTIVE")
        )).limit(1);
      return Boolean(row);
    },

    async getAnnouncementsForUser(schoolId, userId, role) {
      const classes = await classIdsForUser(schoolId, userId, role);
      const rows = await db.select().from(announcements)
        .where(and(eq(announcements.schoolId, schoolId), isNull(announcements.archivedAt), lte(announcements.publishAt, new Date())))
        .orderBy(desc(announcements.publishAt));
      return rows.filter((item) =>
        item.audienceScope === "SCHOOL" ||
        (item.audienceScope === "ROLE" && item.audienceRole === role) ||
        (item.audienceScope === "CLASS" && item.classId !== null && classes.has(item.classId) && (!item.audienceRole || item.audienceRole === role))
      );
    },

    async getAdminOverview(schoolId) {
      const [announcementRows, invoiceRows, settings] = await Promise.all([
        db.select().from(announcements).where(eq(announcements.schoolId, schoolId)).orderBy(desc(announcements.publishAt)),
        db.select().from(feeInvoices).where(eq(feeInvoices.schoolId, schoolId)).orderBy(desc(feeInvoices.createdAt)),
        db.select().from(communicationSettings).where(eq(communicationSettings.schoolId, schoolId)).limit(1)
      ]);
      return {
        announcements: announcementRows,
        invoices: await Promise.all(invoiceRows.map(invoiceView)),
        feeReminderDays: settings[0]?.feeReminderDays ?? [7, 1]
      };
    },

    async listAdminFeeInvoices(schoolId, query) {
      const pageSize = 20;
      const schoolToday = await schoolDateAt(schoolId);
      const overdue = and(
        inArray(feeInvoices.status, ["ISSUED", "PARTIALLY_PAID", "OVERDUE"]),
        sql`${feeInvoices.dueDate} < ${schoolToday}`
      );
      const statusFilter = query.status === "ALL" ? undefined
        : query.status === "OVERDUE" ? overdue
        : query.status === "ISSUED" || query.status === "PARTIALLY_PAID"
          ? and(eq(feeInvoices.status, query.status), sql`${feeInvoices.dueDate} >= ${schoolToday}`)
          : eq(feeInvoices.status, query.status);
      const search = query.q.trim();
      const where = and(
        eq(feeInvoices.schoolId, schoolId),
        eq(students.schoolId, schoolId),
        eq(feeInvoices.studentId, students.id),
        query.studentId ? eq(feeInvoices.studentId, query.studentId) : undefined,
        query.classId ? eq(students.classId, query.classId) : undefined,
        query.academicYearId ? eq(students.academicYearId, query.academicYearId) : undefined,
        statusFilter,
        search ? or(
          ilike(students.fullName, `%${search}%`),
          ilike(students.studentCode, `%${search}%`),
          ilike(feeInvoices.description, `%${search}%`),
          sql`${feeInvoices.invoiceNumber}::text LIKE ${`%${search}%`}`
        ) : undefined
      );
      const [countRows, invoiceRows] = await Promise.all([
        db.select({ value: sql<number>`count(*)::integer` }).from(feeInvoices)
          .innerJoin(students, and(eq(feeInvoices.studentId, students.id), eq(feeInvoices.schoolId, students.schoolId)))
          .where(where),
        db.select({ invoice: feeInvoices }).from(feeInvoices)
          .innerJoin(students, and(eq(feeInvoices.studentId, students.id), eq(feeInvoices.schoolId, students.schoolId)))
          .where(where)
          .orderBy(desc(feeInvoices.createdAt), desc(feeInvoices.id))
          .limit(pageSize).offset((query.page-1)*pageSize)
      ]);
      return {
        invoices: await Promise.all(invoiceRows.map(row => invoiceView(row.invoice))),
        total: countRows[0]?.value ?? 0, page: query.page, pageSize
      };
    },

    async updateDraftFeeInvoice(schoolId, actorUserId, invoiceId, input) {
      return db.transaction(async tx => {
        const [original] = await tx.select().from(feeInvoices).where(and(
          eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId)
        )).limit(1).for("update");
        if (!original) throw new CommunicationNotFoundError("Fee invoice not found.");
        if (original.status !== "DRAFT")
          throw new CommunicationConflictError("Only draft invoices may be edited.");
        if (original.updatedAt.getTime() !== Date.parse(input.expectedUpdatedAt))
          throw new CommunicationConflictError("This draft changed. Refresh before editing it again.");
        const [targetStudent] = await tx.select({ status: students.status }).from(students)
          .where(and(eq(students.schoolId, schoolId),eq(students.id,input.studentId))).limit(1);
        if (!targetStudent) throw new CommunicationNotFoundError("Student not found.");
        if (targetStudent.status !== "ACTIVE")
          throw new CommunicationConflictError("A withdrawn student cannot receive an invoice.");
        const [payment] = await tx.select({ id: feePayments.id }).from(feePayments)
          .where(and(eq(feePayments.schoolId,schoolId),eq(feePayments.invoiceId,invoiceId))).limit(1);
        if(payment) throw new CommunicationConflictError("A draft with ledger transactions cannot be edited.");
        const [updated] = await tx.update(feeInvoices).set({
          studentId: input.studentId, amount: input.amount, dueDate: input.dueDate,
          description: input.description ?? null, updatedAt: new Date()
        }).where(and(eq(feeInvoices.schoolId,schoolId),eq(feeInvoices.id,invoiceId),
          eq(feeInvoices.status,"DRAFT"))).returning();
        if(!updated)throw new CommunicationConflictError("Draft changed during editing.");
        await tx.insert(auditLogs).values({
          id: randomUUID(),schoolId,actorUserId,
          action:"fee_invoice.draft_updated",entityType:"fee_invoice",entityId:invoiceId,
          metadata:{before:{studentId:original.studentId,amount:original.amount,
            dueDate:original.dueDate,description:original.description},
            after:{studentId:updated.studentId,amount:updated.amount,
              dueDate:updated.dueDate,description:updated.description}}
        });
        return updated;
      });
    },

    async createFeeInvoice(schoolId, actorUserId, input) {
      const student = await getStudent(schoolId, input.studentId);
      if (student.status !== "ACTIVE") throw new CommunicationValidationError("Cannot bill a withdrawn student.");
      return db.transaction(async tx => {
        // The UPSERT serializes numbering independently within each school.
        const [counter] = await tx.insert(feeInvoiceCounters)
          .values({ schoolId, lastNumber: 1 })
          .onConflictDoUpdate({
            target: feeInvoiceCounters.schoolId,
            set: { lastNumber: sql`${feeInvoiceCounters.lastNumber} + 1` }
          }).returning();
        if (!counter || counter.lastNumber > 2147483647)
          throw new CommunicationConflictError("Invoice number range exhausted.");
        const [invoice] = await tx.insert(feeInvoices).values({
          id: randomUUID(), schoolId, studentId: input.studentId, invoiceNumber: counter.lastNumber, amount: input.amount,
          dueDate: input.dueDate, description: input.description ?? null, createdBy: actorUserId
        }).returning();
        if (!invoice) throw new Error("Fee invoice insert did not return a row.");
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId, action: "fee_invoice.created",
          entityType: "fee_invoice", entityId: invoice.id,
          metadata: { invoiceNumber: invoice.invoiceNumber, studentId: invoice.studentId, amount: invoice.amount, dueDate: invoice.dueDate }
        });
        return invoice;
      });
    },

    async issueFeeInvoice(schoolId, invoiceId, actorUserId) {
      return db.transaction(async tx => {
        const [current] = await tx.select().from(feeInvoices)
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId)))
          .limit(1).for("update");
        if (!current) throw new CommunicationNotFoundError("Fee invoice not found.");
        if (current.status !== "DRAFT") throw new CommunicationConflictError("Only a draft fee invoice can be issued.");
        const [student] = await tx.select({ status: students.status }).from(students)
          .where(and(eq(students.schoolId, schoolId), eq(students.id, current.studentId))).limit(1);
        if (!student || student.status !== "ACTIVE")
          throw new CommunicationConflictError("A withdrawn student cannot receive a new invoice.");
        const [updated] = await tx.update(feeInvoices)
          .set({ status: "ISSUED", issuedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId),
            eq(feeInvoices.status, "DRAFT"))).returning();
        if (!updated) throw new CommunicationConflictError("Invoice changed while issuing.");
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId: actorUserId ?? current.createdBy,
          action: "fee_invoice.issued", entityType: "fee_invoice", entityId: invoiceId,
          metadata: { status: updated.status }
        });
        return updated;
      });
    },

    async cancelFeeInvoice(schoolId, invoiceId, actorUserId) {
      return db.transaction(async tx => {
        const [current] = await tx.select().from(feeInvoices)
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId)))
          .limit(1).for("update");
        if (!current) throw new CommunicationNotFoundError("Fee invoice not found.");
        const payments = await tx.select().from(feePayments)
          .where(and(eq(feePayments.schoolId, schoolId), eq(feePayments.invoiceId, invoiceId)));
        const paid = payments.reduce((sum, p) => sum + (p.kind === "PAYMENT" ? p.amount : -p.amount), 0);
        if (paid !== 0) throw new CommunicationConflictError("Reverse recorded payments before cancelling this invoice.");
        if (current.status === "PAID" || current.status === "CANCELLED")
          throw new CommunicationConflictError("This invoice cannot be cancelled.");
        const [updated] = await tx.update(feeInvoices)
          .set({ status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() })
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId),
            ne(feeInvoices.status, "CANCELLED"))).returning();
        if (!updated) throw new CommunicationConflictError("Invoice changed while cancelling.");
        await cancelFeeAlerts(schoolId, invoiceId, tx);
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId: actorUserId ?? current.createdBy,
          action: "fee_invoice.cancelled", entityType: "fee_invoice", entityId: invoiceId,
          metadata: { status: updated.status }
        });
        return updated;
      });
    },

    async recordFeePayment(schoolId, actorUserId, invoiceId, input) {
      const today = await schoolDateAt(schoolId);
      const updatedInvoice = await db.transaction(async tx => {
        const [invoice] = await tx.select().from(feeInvoices)
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId)))
          .limit(1).for("update");
        if (!invoice) throw new CommunicationNotFoundError("Fee invoice not found.");
        if (input.idempotencyKey) {
          const [prior] = await tx.select().from(feePayments).where(and(
            eq(feePayments.schoolId, schoolId), eq(feePayments.invoiceId, invoiceId),
            eq(feePayments.idempotencyKey, input.idempotencyKey)
          )).limit(1);
          if (prior) {
            if (prior.kind !== "PAYMENT" || prior.amount !== input.amount ||
                prior.method !== input.method || (prior.transactionReference ?? "") !== (input.transactionReference ?? ""))
              throw new CommunicationConflictError("This payment retry key was already used with different details.");
            return invoice; // Network retry: do not append a second ledger/audit entry.
          }
        }
        if (!["ISSUED","PARTIALLY_PAID","OVERDUE"].includes(invoice.status))
          throw new CommunicationConflictError("Payment can be recorded only against an issued unpaid invoice.");
        const payments = await tx.select().from(feePayments).where(and(
          eq(feePayments.schoolId, schoolId), eq(feePayments.invoiceId, invoiceId)
        ));
        const paid = payments.reduce((sum, p) => sum + (p.kind === "PAYMENT" ? p.amount : -p.amount), 0);
        if (input.amount > invoice.amount - paid)
          throw new CommunicationValidationError("Payment amount exceeds the outstanding balance.");
        const paymentId = randomUUID();
        await tx.insert(feePayments).values({
          id: paymentId, schoolId, invoiceId, kind: "PAYMENT", amount: input.amount,
          method: input.method, transactionReference: input.transactionReference ?? null,
          idempotencyKey: input.idempotencyKey ?? null, recordedBy: actorUserId
        });
        const status = balanceStatus(invoice, paid + input.amount, today);
        const [updated] = await tx.update(feeInvoices).set({ status, updatedAt: new Date() })
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId))).returning();
        if (!updated) throw new Error("Fee invoice update did not return a row.");
        if (status === "PAID") await cancelFeeAlerts(schoolId, invoiceId, tx);
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId, action: "fee_payment.recorded",
          entityType: "fee_payment", entityId: paymentId,
          metadata: { invoiceId, amount: input.amount, method: input.method,
            transactionReference: input.transactionReference ?? null }
        });
        return updated;
      });
      return invoiceView(updatedInvoice);
    },

    async reverseFeePayment(schoolId, actorUserId, paymentId, input) {
      const [prior] = await db.select({ invoiceId: feePayments.invoiceId })
        .from(feePayments).where(and(eq(feePayments.schoolId, schoolId),
          eq(feePayments.id, paymentId), eq(feePayments.kind, "PAYMENT"))).limit(1);
      if (!prior) throw new CommunicationNotFoundError("Payment transaction not found.");
      const today = await schoolDateAt(schoolId);
      const updatedInvoice = await db.transaction(async tx => {
        const [invoice] = await tx.select().from(feeInvoices)
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, prior.invoiceId)))
          .limit(1).for("update");
        if (!invoice) throw new CommunicationNotFoundError("Fee invoice not found.");
        const [payment] = await tx.select().from(feePayments)
          .where(and(eq(feePayments.schoolId, schoolId), eq(feePayments.id, paymentId),
            eq(feePayments.invoiceId, invoice.id), eq(feePayments.kind, "PAYMENT"))).limit(1);
        if (!payment) throw new CommunicationNotFoundError("Payment transaction not found.");
        const [existing] = await tx.select({ id: feePayments.id }).from(feePayments).where(and(
          eq(feePayments.schoolId, schoolId), eq(feePayments.reversalOfPaymentId, payment.id)
        )).limit(1);
        if (existing) throw new CommunicationConflictError("This payment has already been reversed.");
        const reversalId = randomUUID();
        await tx.insert(feePayments).values({
          id: reversalId, schoolId, invoiceId: invoice.id, kind: "REVERSAL",
          amount: payment.amount, method: "REVERSAL",
          transactionReference: payment.transactionReference, reversalOfPaymentId: payment.id,
          reversalReason: input.reason, recordedBy: actorUserId
        });
        const ledger = await tx.select().from(feePayments).where(and(
          eq(feePayments.schoolId, schoolId), eq(feePayments.invoiceId, invoice.id)
        ));
        const paid = ledger.reduce((sum, row) => sum + (row.kind === "PAYMENT" ? row.amount : -row.amount), 0);
        const [updated] = await tx.update(feeInvoices)
          .set({ status: balanceStatus(invoice, paid, today), updatedAt: new Date() })
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoice.id))).returning();
        if (!updated) throw new Error("Fee invoice update did not return a row.");
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId, action: "fee_payment.reversed",
          entityType: "fee_payment", entityId: reversalId,
          metadata: { originalPaymentId: payment.id, invoiceId: invoice.id,
            amount: payment.amount, reason: input.reason }
        });
        return updated;
      });
      return invoiceView(updatedInvoice);
    },

    async getParentFees(schoolId, parentUserId, studentId) {
      const student = await getStudent(schoolId, studentId);
      if (student.parentUserId !== parentUserId || student.status !== "ACTIVE") {
        throw new CommunicationNotFoundError("Student not found for this parent account.");
      }
      const rows = await db.select().from(feeInvoices)
        .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.studentId, studentId), ne(feeInvoices.status, "DRAFT")))
        .orderBy(desc(feeInvoices.dueDate));
      return Promise.all(rows.map(invoiceView));
    },

    async getStudentFees(schoolId, studentUserId) {
      const [student] = await db.select().from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.userId, studentUserId))).limit(1);
      if (!student) throw new CommunicationNotFoundError("Student profile not found.");
      return this.getParentFees(schoolId, student.parentUserId, student.id);
    },

    async updateFeeReminderDays(schoolId, days) {
      const clean = Array.from(new Set(days)).sort((a,b) => b-a);
      const [updated] = await db
        .insert(communicationSettings)
        .values({ schoolId, feeReminderDays: clean })
        .onConflictDoUpdate({
          target: communicationSettings.schoolId,
          set: { feeReminderDays: clean, updatedAt: new Date() }
        })
        .returning();
      if (!updated) throw new CommunicationNotFoundError("Communication settings could not be saved.");
      return updated.feeReminderDays;
    },

    async runScheduledNotifications(now = new Date()) {
      let announcementNotifications = 0;
      let feeReminders = 0;
      let overdueInvoices = 0;
      const schoolRows = await db.select().from(schoolSettings);
      for (const settings of schoolRows) {
        const [communicationConfig] = await db
          .select()
          .from(communicationSettings)
          .where(eq(communicationSettings.schoolId, settings.schoolId))
          .limit(1);
        const reminderDays = communicationConfig?.feeReminderDays ?? [7, 1];
        const today = localDate(now, settings.timezone);
        const dueAnnouncements = await db.select().from(announcements)
          .where(and(eq(announcements.schoolId, settings.schoolId), isNull(announcements.archivedAt), lte(announcements.publishAt, now)));
        for (const announcement of dueAnnouncements) announcementNotifications += await materializeAnnouncement(announcement, now);

        const invoices = await db.select().from(feeInvoices)
          .where(and(
            eq(feeInvoices.schoolId, settings.schoolId),
            inArray(feeInvoices.status, ["ISSUED","PARTIALLY_PAID","OVERDUE"])
          ));
        for (let invoice of invoices) {
          const student = await getStudent(settings.schoolId, invoice.studentId);
          if (student.status !== "ACTIVE") continue; // Never remind a withdrawn family.
          const totals = await paymentTotals(settings.schoolId, invoice.id);
          const outstanding = Math.max(0, invoice.amount - totals.paid);
          if (outstanding <= 0) continue;
          const daysUntil = dayDiff(today, invoice.dueDate);
          if (daysUntil < 0 && invoice.status !== "OVERDUE") {
            const [updated] = await db.update(feeInvoices).set({ status: "OVERDUE", updatedAt: now })
              .where(and(eq(feeInvoices.schoolId, settings.schoolId), eq(feeInvoices.id, invoice.id))).returning();
            if (updated) invoice = updated;
            overdueInvoices += 1;
          }
          if (reminderDays.includes(daysUntil)) {
            if (await createNotificationOnce({
              schoolId: settings.schoolId, userId: student.parentUserId, type: "FEE_DUE",
              title: "Fee payment due", message: `${student.fullName} has AFN ${outstanding} due on ${invoice.dueDate}.`,
              deepLink: `/parent/children/${student.id}/fees`,
              dedupKey: `fee-reminder:${invoice.id}:before:${daysUntil}`,
              metadata: { invoiceId: invoice.id, studentId: student.id, dueDate: invoice.dueDate, outstanding }
            })) feeReminders += 1;
          }
          if (daysUntil < 0) {
            if (await createNotificationOnce({
              schoolId: settings.schoolId, userId: student.parentUserId, type: "FEE_OVERDUE",
              title: "Fee payment overdue", message: `${student.fullName} has AFN ${outstanding} overdue.`,
              deepLink: `/parent/children/${student.id}/fees`,
              dedupKey: `fee-reminder:${invoice.id}:overdue`,
              metadata: { invoiceId: invoice.id, studentId: student.id, dueDate: invoice.dueDate, outstanding }
            })) feeReminders += 1;
          }
        }
      }
      return { announcementNotifications, feeReminders, overdueInvoices };
    },

    async registerDevice(schoolId, userId, pushToken, platform) {
      await getUser(schoolId, userId);
      const [existing] = await db.select().from(devices).where(eq(devices.pushToken, pushToken)).limit(1);
      if (existing) {
        if (existing.schoolId !== schoolId || existing.userId !== userId) {
          throw new CommunicationConflictError("This push token is already registered to another account.");
        }
        const [updated] = await db.update(devices).set({ platform, active: true, lastSeenAt: new Date(), updatedAt: new Date() })
          .where(eq(devices.id, existing.id)).returning();
        return updated ?? existing;
      }
      const [created] = await db.insert(devices).values({
        id: randomUUID(), schoolId, userId, pushToken, platform
      }).returning();
      if (!created) throw new Error("Device insert did not return a row.");
      return created;
    },

    async deactivateDevice(schoolId, userId, pushToken) {
      await db.update(devices).set({ active: false, updatedAt: new Date() })
        .where(and(eq(devices.schoolId, schoolId), eq(devices.userId, userId), eq(devices.pushToken, pushToken)));
    },

    async getUserNotifications(schoolId, userId) {
      const [person] = await db.select({ role: users.role, status: users.status })
        .from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, userId))).limit(1);
      if (!person || person.status === "SUSPENDED" || person.status === "ARCHIVED") return [];
      const rows = await db.select().from(notifications).where(and(
        eq(notifications.schoolId, schoolId), eq(notifications.userId, userId),
        ne(notifications.deliveryStatus, "CANCELLED")
      )).orderBy(desc(notifications.createdAt));
      const visible: Notification[] = [];
      for (const row of rows) {
        if (!(await feeAlertIsVisible(row))) continue;
        if (row.type === "ANNOUNCEMENT") {
          const id = row.metadata.announcementId;
          if (typeof id !== "string") continue;
          const [item] = await db.select().from(announcements).where(and(
            eq(announcements.schoolId, schoolId), eq(announcements.id, id),
            isNull(announcements.archivedAt), lte(announcements.publishAt, new Date())
          )).limit(1);
          if (!item || !(await announcementRecipients(item)).includes(userId)) continue;
        }
        visible.push(row);
      }
      return visible;
    },

    async getUnreadNotificationCount(schoolId, userId) {
      const rows = await this.getUserNotifications(schoolId, userId);
      return rows.filter(item => !item.readAt).length;
    },

    async markNotificationRead(schoolId, userId, notificationId) {
      const allowed = await this.getUserNotifications(schoolId, userId);
      if (!allowed.some(item => item.id === notificationId)) return null;
      const [updated] = await db.update(notifications).set({
        readAt: new Date(), updatedAt: new Date()
      }).where(and(eq(notifications.schoolId, schoolId),
        eq(notifications.userId, userId), eq(notifications.id, notificationId),
        isNull(notifications.readAt), ne(notifications.deliveryStatus, "CANCELLED"))).returning();
      return updated ?? allowed.find(item => item.id === notificationId) ?? null;
    },

    async markAllNotificationsRead(schoolId, userId) {
      const allowed = (await this.getUserNotifications(schoolId, userId))
        .filter(item => !item.readAt).map(item => item.id);
      if (allowed.length === 0) return 0;
      const changed = await db.update(notifications).set({
        readAt: new Date(), updatedAt: new Date()
      }).where(and(eq(notifications.schoolId, schoolId),
        eq(notifications.userId, userId), inArray(notifications.id, allowed),
        isNull(notifications.readAt),
        ne(notifications.deliveryStatus, "CANCELLED"))).returning({ id: notifications.id });
      return changed.length;
    },

    async deliverPendingPush(provider, limit = 100) {
      const pending = await db.select().from(notifications)
        .where(or(eq(notifications.deliveryStatus, "PENDING"), eq(notifications.deliveryStatus, "FAILED")))
        .orderBy(asc(notifications.createdAt)).limit(limit);
      let sent = 0;
      let failed = 0;
      let skipped = 0;
      for (const notification of pending) {
        if (!(await feeAlertIsVisible(notification))) {
          await db.update(notifications).set({ deliveryStatus: "CANCELLED", updatedAt: new Date() })
            .where(and(eq(notifications.schoolId, notification.schoolId), eq(notifications.id, notification.id)));
          skipped += 1;
          continue;
        }
        if (notification.type === "ANNOUNCEMENT") {
          const id = notification.metadata.announcementId;
          const [item] = typeof id === "string"
            ? await db.select().from(announcements).where(and(
                eq(announcements.schoolId, notification.schoolId),
                eq(announcements.id, id), isNull(announcements.archivedAt),
                lte(announcements.publishAt, new Date())
              )).limit(1) : [];
          if (!item || !(await announcementRecipients(item)).includes(notification.userId)) {
            await db.update(notifications).set({
              deliveryStatus: "CANCELLED", updatedAt: new Date()
            }).where(and(eq(notifications.schoolId, notification.schoolId),
              eq(notifications.id, notification.id)));
            skipped += 1;
            continue;
          }
        }
        const [recipient] = await db.select({ role: users.role, status: users.status }).from(users)
          .where(and(eq(users.id, notification.userId), eq(users.schoolId, notification.schoolId)))
          .limit(1);
        // INVITED accounts may already have school-issued push registrations.
        // Only suspended/archived identities or withdrawn Students lose delivery.
        const permitted = !!recipient &&
          recipient.status !== "SUSPENDED" && recipient.status !== "ARCHIVED" &&
          (recipient.role !== "STUDENT" ||
            await this.hasActiveStudentEnrollment(notification.schoolId, notification.userId));
        if (!permitted) {
          // A queued notification must never reach a withdrawn/suspended user.
          await db.update(notifications).set({ deliveryStatus: "CANCELLED", updatedAt: new Date() })
            .where(and(eq(notifications.id, notification.id), eq(notifications.schoolId, notification.schoolId)));
          skipped += 1;
          continue;
        }
        const userDevices = await db.select().from(devices)
          .where(and(eq(devices.schoolId, notification.schoolId), eq(devices.userId, notification.userId), eq(devices.active, true)));
        if (userDevices.length === 0) {
          skipped += 1;
          continue;
        }
        let anySent = false;
        let anyFailed = false;
        for (const device of userDevices) {
          let [delivery] = await db.select().from(notificationPushDeliveries)
            .where(and(eq(notificationPushDeliveries.notificationId, notification.id), eq(notificationPushDeliveries.deviceId, device.id))).limit(1);
          if (delivery?.status === "SENT") {
            anySent = true;
            continue;
          }
          if (!delivery) {
            [delivery] = await db.insert(notificationPushDeliveries).values({
              id: randomUUID(), schoolId: notification.schoolId, notificationId: notification.id, deviceId: device.id
            }).returning();
          }
          const result = await provider.send({
            token: device.pushToken,
            title: notification.title,
            body: notification.message,
            data: { notificationId: notification.id, deepLink: notification.deepLink, ...notification.metadata }
          });
          if (result.ok) {
            anySent = true;
            sent += 1;
            await db.update(notificationPushDeliveries).set({
              status: "SENT", attempts: (delivery?.attempts ?? 0) + 1,
              providerMessageId: result.providerMessageId ?? null, lastError: null,
              lastAttemptAt: new Date(), updatedAt: new Date()
            }).where(eq(notificationPushDeliveries.id, delivery!.id));
          } else {
            anyFailed = true;
            failed += 1;
            await db.update(notificationPushDeliveries).set({
              status: "FAILED", attempts: (delivery?.attempts ?? 0) + 1,
              lastError: (result.error ?? "Push delivery failed.").slice(0, 500),
              lastAttemptAt: new Date(), updatedAt: new Date()
            }).where(eq(notificationPushDeliveries.id, delivery!.id));
          }
        }
        await db.update(notifications).set({
          deliveryStatus: anySent ? "SENT" : anyFailed ? "FAILED" : notification.deliveryStatus,
          updatedAt: new Date()
        }).where(eq(notifications.id, notification.id));
      }
      return { sent, failed, skipped };
    }
  };
}
