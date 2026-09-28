import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type {
  CreateAnnouncementInput,
  CreateFeeInvoiceInput,
  DevicePlatform,
  FeeInvoiceStatus,
  RecordFeePaymentInput,
  ReverseFeePaymentInput,
  UserRole
} from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  announcements,
  classSections,
  communicationSettings,
  devices,
  feeInvoices,
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
  archiveAnnouncement(schoolId: string, announcementId: string): Promise<Announcement>;
  getAnnouncementsForUser(schoolId: string, userId: string, role: UserRole): Promise<Announcement[]>;
  getAdminOverview(schoolId: string): Promise<CommunicationOverview>;
  createFeeInvoice(schoolId: string, actorUserId: string, input: CreateFeeInvoiceInput): Promise<FeeInvoice>;
  issueFeeInvoice(schoolId: string, invoiceId: string): Promise<FeeInvoice>;
  cancelFeeInvoice(schoolId: string, invoiceId: string): Promise<FeeInvoice>;
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
      const [assigned, supervised] = await Promise.all([
        db.select({ classId: teacherAssignments.classId }).from(teacherAssignments)
          .where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.teacherUserId, userId))),
        db.select({ classId: negaranAssignments.classId }).from(negaranAssignments)
          .where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.teacherUserId, userId)))
      ]);
      return new Set([...assigned, ...supervised].map((row) => row.classId));
    }
    return new Set();
  }

  async function announcementRecipients(announcement: Announcement): Promise<string[]> {
    if (announcement.audienceScope === "SCHOOL") {
      const rows = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.schoolId, announcement.schoolId), ne(users.status, "ARCHIVED"), ne(users.status, "SUSPENDED")));
      return rows.map((row) => row.id);
    }
    if (announcement.audienceScope === "ROLE") {
      if (!announcement.audienceRole) return [];
      const rows = await db.select({ id: users.id }).from(users)
        .where(and(
          eq(users.schoolId, announcement.schoolId),
          eq(users.role, announcement.audienceRole),
          ne(users.status, "ARCHIVED"),
          ne(users.status, "SUSPENDED")
        ));
      return rows.map((row) => row.id);
    }
    if (!announcement.classId) return [];
    const [studentRows, teacherRows, negaranRows] = await Promise.all([
      db.select({ parentUserId: students.parentUserId, userId: students.userId }).from(students)
        .where(and(eq(students.schoolId, announcement.schoolId), eq(students.classId, announcement.classId), eq(students.status, "ACTIVE"))),
      db.select({ userId: teacherAssignments.teacherUserId }).from(teacherAssignments)
        .where(and(eq(teacherAssignments.schoolId, announcement.schoolId), eq(teacherAssignments.classId, announcement.classId))),
      db.select({ userId: negaranAssignments.teacherUserId }).from(negaranAssignments)
        .where(and(eq(negaranAssignments.schoolId, announcement.schoolId), eq(negaranAssignments.classId, announcement.classId)))
    ]);
    return Array.from(new Set([
      ...studentRows.flatMap((row) => row.userId ? [row.parentUserId, row.userId] : [row.parentUserId]),
      ...teacherRows.map((row) => row.userId),
      ...negaranRows.map((row) => row.userId)
    ]));
  }

  async function materializeAnnouncement(announcement: Announcement): Promise<number> {
    if (announcement.archivedAt || announcement.publishAt.getTime() > Date.now()) return 0;
    const recipients = await announcementRecipients(announcement);
    let created = 0;
    for (const userId of recipients) {
      const dedupKey = `announcement:${announcement.id}:${userId}`;
      const [existing] = await db.select({ id: notifications.id }).from(notifications)
        .where(and(eq(notifications.schoolId, announcement.schoolId), eq(notifications.dedupKey, dedupKey))).limit(1);
      if (existing) continue;
      await db.insert(notifications).values({
        id: randomUUID(),
        schoolId: announcement.schoolId,
        userId,
        type: "ANNOUNCEMENT",
        title: announcement.title,
        message: announcement.content,
        deepLink: "/announcements",
        dedupKey,
        metadata: { announcementId: announcement.id, audienceScope: announcement.audienceScope, classId: announcement.classId }
      });
      created += 1;
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

  async function refreshInvoiceStatus(invoice: FeeInvoice): Promise<FeeInvoice> {
    if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") return invoice;
    const { paid } = await paymentTotals(invoice.schoolId, invoice.id);
    const [settings] = await db.select().from(schoolSettings).where(eq(schoolSettings.schoolId, invoice.schoolId)).limit(1);
    const today = localDate(new Date(), settings?.timezone ?? "Asia/Kabul");
    let status: FeeInvoiceStatus =
      paid >= invoice.amount ? "PAID" :
      paid > 0 ? "PARTIALLY_PAID" :
      invoice.dueDate < today ? "OVERDUE" : "ISSUED";
    const [updated] = await db.update(feeInvoices).set({ status, updatedAt: new Date() })
      .where(and(eq(feeInvoices.schoolId, invoice.schoolId), eq(feeInvoices.id, invoice.id))).returning();
    return updated ?? invoice;
  }

  async function invoiceView(invoice: FeeInvoice): Promise<FeeInvoiceView> {
    const student = await getStudent(invoice.schoolId, invoice.studentId);
    const totals = await paymentTotals(invoice.schoolId, invoice.id);
    return {
      invoice,
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
    const [existing] = await db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.schoolId, input.schoolId), eq(notifications.dedupKey, input.dedupKey))).limit(1);
    if (existing) return false;
    await db.insert(notifications).values({
      id: randomUUID(), schoolId: input.schoolId, userId: input.userId,
      type: input.type, title: input.title, message: input.message, deepLink: input.deepLink,
      dedupKey: input.dedupKey, metadata: input.metadata ?? {}
    });
    return true;
  }

  return {
    async createAnnouncement(schoolId, actorUserId, input) {
      await getUser(schoolId, actorUserId);
      if (input.classId) {
        const [classRow] = await db.select({ id: classSections.id }).from(classSections)
          .where(and(eq(classSections.schoolId, schoolId), eq(classSections.id, input.classId))).limit(1);
        if (!classRow) throw new CommunicationNotFoundError("Class not found.");
      }
      const [created] = await db.insert(announcements).values({
        id: randomUUID(), schoolId, createdBy: actorUserId, title: input.title, content: input.content,
        audienceScope: input.audienceScope, classId: input.classId ?? null,
        audienceRole: input.audienceRole ?? null,
        publishAt: input.publishAt ? new Date(input.publishAt) : new Date()
      }).returning();
      if (!created) throw new Error("Announcement insert did not return a row.");
      await materializeAnnouncement(created);
      return created;
    },

    async createNegaranAnnouncement(schoolId, teacherUserId, input) {
      if (input.audienceScope !== "CLASS" || !input.classId) {
        throw new CommunicationValidationError("Negaran announcements must target the supervised class.");
      }
      const now = new Date().toISOString().slice(0, 10);
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

    async archiveAnnouncement(schoolId, announcementId) {
      const [updated] = await db.update(announcements).set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(announcements.schoolId, schoolId), eq(announcements.id, announcementId))).returning();
      if (!updated) throw new CommunicationNotFoundError("Announcement not found.");
      return updated;
    },

    async getAnnouncementsForUser(schoolId, userId, role) {
      const classes = await classIdsForUser(schoolId, userId, role);
      const rows = await db.select().from(announcements)
        .where(and(eq(announcements.schoolId, schoolId), isNull(announcements.archivedAt), lte(announcements.publishAt, new Date())))
        .orderBy(desc(announcements.publishAt));
      return rows.filter((item) =>
        item.audienceScope === "SCHOOL" ||
        (item.audienceScope === "ROLE" && item.audienceRole === role) ||
        (item.audienceScope === "CLASS" && item.classId !== null && classes.has(item.classId))
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

    async createFeeInvoice(schoolId, actorUserId, input) {
      await getStudent(schoolId, input.studentId);
      const [invoice] = await db.insert(feeInvoices).values({
        id: randomUUID(), schoolId, studentId: input.studentId, amount: input.amount,
        dueDate: input.dueDate, description: input.description ?? null, createdBy: actorUserId
      }).returning();
      if (!invoice) throw new Error("Fee invoice insert did not return a row.");
      return invoice;
    },

    async issueFeeInvoice(schoolId, invoiceId) {
      const [current] = await db.select().from(feeInvoices)
        .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId))).limit(1);
      if (!current) throw new CommunicationNotFoundError("Fee invoice not found.");
      if (current.status !== "DRAFT") throw new CommunicationConflictError("Only a draft fee invoice can be issued.");
      const [updated] = await db.update(feeInvoices).set({ status: "ISSUED", issuedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId))).returning();
      if (!updated) throw new Error("Fee invoice update did not return a row.");
      return updated;
    },

    async cancelFeeInvoice(schoolId, invoiceId) {
      const [current] = await db.select().from(feeInvoices)
        .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId))).limit(1);
      if (!current) throw new CommunicationNotFoundError("Fee invoice not found.");
      const { paid } = await paymentTotals(schoolId, invoiceId);
      if (paid !== 0) throw new CommunicationConflictError("Reverse recorded payments before cancelling this invoice.");
      if (current.status === "PAID" || current.status === "CANCELLED") throw new CommunicationConflictError("This invoice cannot be cancelled.");
      const [updated] = await db.update(feeInvoices).set({ status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() })
        .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId))).returning();
      if (!updated) throw new Error("Fee invoice update did not return a row.");
      return updated;
    },

    async recordFeePayment(schoolId, actorUserId, invoiceId, input) {
      const [invoice] = await db.select().from(feeInvoices)
        .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, invoiceId))).limit(1);
      if (!invoice) throw new CommunicationNotFoundError("Fee invoice not found.");
      if (!["ISSUED","PARTIALLY_PAID","OVERDUE"].includes(invoice.status)) {
        throw new CommunicationConflictError("Payment can be recorded only against an issued unpaid invoice.");
      }
      const totals = await paymentTotals(schoolId, invoiceId);
      const outstanding = invoice.amount - totals.paid;
      if (input.amount > outstanding) throw new CommunicationValidationError("Payment amount exceeds the outstanding balance.");
      await db.insert(feePayments).values({
        id: randomUUID(), schoolId, invoiceId, kind: "PAYMENT", amount: input.amount,
        method: input.method, transactionReference: input.transactionReference ?? null, recordedBy: actorUserId
      });
      return invoiceView(await refreshInvoiceStatus(invoice));
    },

    async reverseFeePayment(schoolId, actorUserId, paymentId, input) {
      const [payment] = await db.select().from(feePayments)
        .where(and(eq(feePayments.schoolId, schoolId), eq(feePayments.id, paymentId))).limit(1);
      if (!payment || payment.kind !== "PAYMENT") throw new CommunicationNotFoundError("Payment transaction not found.");
      const [existing] = await db.select({ id: feePayments.id }).from(feePayments)
        .where(and(eq(feePayments.schoolId, schoolId), eq(feePayments.reversalOfPaymentId, payment.id))).limit(1);
      if (existing) throw new CommunicationConflictError("This payment has already been reversed.");
      await db.insert(feePayments).values({
        id: randomUUID(), schoolId, invoiceId: payment.invoiceId, kind: "REVERSAL", amount: payment.amount,
        method: "REVERSAL", transactionReference: payment.transactionReference,
        reversalOfPaymentId: payment.id, reversalReason: input.reason, recordedBy: actorUserId
      });
      const [invoice] = await db.select().from(feeInvoices)
        .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, payment.invoiceId))).limit(1);
      if (!invoice) throw new CommunicationNotFoundError("Fee invoice not found.");
      return invoiceView(await refreshInvoiceStatus(invoice));
    },

    async getParentFees(schoolId, parentUserId, studentId) {
      const student = await getStudent(schoolId, studentId);
      if (student.parentUserId !== parentUserId) throw new CommunicationNotFoundError("Student not found for this parent account.");
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
        for (const announcement of dueAnnouncements) announcementNotifications += await materializeAnnouncement(announcement);

        const invoices = await db.select().from(feeInvoices)
          .where(and(
            eq(feeInvoices.schoolId, settings.schoolId),
            inArray(feeInvoices.status, ["ISSUED","PARTIALLY_PAID","OVERDUE"])
          ));
        for (let invoice of invoices) {
          const student = await getStudent(settings.schoolId, invoice.studentId);
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
      return db.select().from(notifications)
        .where(and(eq(notifications.schoolId, schoolId), eq(notifications.userId, userId), ne(notifications.deliveryStatus, "CANCELLED")))
        .orderBy(desc(notifications.createdAt));
    },

    async markNotificationRead(schoolId, userId, notificationId) {
      const [updated] = await db.update(notifications).set({ readAt: new Date(), updatedAt: new Date() })
        .where(and(eq(notifications.schoolId, schoolId), eq(notifications.userId, userId), eq(notifications.id, notificationId))).returning();
      return updated ?? null;
    },

    async deliverPendingPush(provider, limit = 100) {
      const pending = await db.select().from(notifications)
        .where(or(eq(notifications.deliveryStatus, "PENDING"), eq(notifications.deliveryStatus, "FAILED")))
        .orderBy(asc(notifications.createdAt)).limit(limit);
      let sent = 0;
      let failed = 0;
      let skipped = 0;
      for (const notification of pending) {
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
