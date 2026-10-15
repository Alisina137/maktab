import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { AdminFeeReportQuery, BulkFeePreviewInput, SetFeeReconciliationInput } from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  auditLogs, feeInvoices, feePayments, feePaymentReconciliations, schoolSettings,
  students, users, type FeeInvoice, type FeePayment
} from "./schema.js";
import { CommunicationConflictError, CommunicationNotFoundError, CommunicationValidationError } from "./communication-store.js";

const MAX_REPORT_ROWS = 5000;
const METHODS = ["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"] as const;
type Method = typeof METHODS[number];

export type FeeReportRow = {
  paymentId: string; invoiceNumber: number; studentCode: string; studentName: string;
  kind: "PAYMENT" | "REVERSAL"; amount: number; method: string;
  recordedAt: Date; transactionReference: string | null;
  recordedBy: string; reconciliation: "PENDING" | "RECONCILED" | "REVERSED" | "NOT_APPLICABLE";
};

export interface FeeFinancialReport {
  asOf: string; schoolTimezone: string; from: string | null; to: string | null;
  billed: number; paid: number; outstanding: number; overdue: number;
  aging: { notDue: number; days1to30: number; days31to60: number; days61to90: number; daysOver90: number };
  statement: {
    grossPayments: number; reversals: number; netCollections: number;
    methods: Array<{ method: Method; gross: number; reversals: number; net: number;
      pendingCount: number; reconciledCount: number; pendingAmount: number; reconciledAmount: number }>;
  };
  rows: FeeReportRow[];
  invoices: Array<{ invoiceNumber: number; studentCode: string; studentName: string; dueDate: string;
    amount: number; paid: number; outstanding: number; daysOverdue: number }>;
}

export interface FeeBulkPreview {
  total: number; ready: number; duplicates: number; unavailable: number;
  rows: Array<{ index: number; studentId: string; status:
    "READY" | "DUPLICATE_BATCH" | "EXISTING_INVOICE" | "STUDENT_UNAVAILABLE";
    existingInvoiceNumber: number | null }>;
  created: false;
}

export interface FeeFinancialStore {
  getFeeFinancialReport(schoolId: string, query: AdminFeeReportQuery): Promise<FeeFinancialReport>;
  previewBulkFeeInvoices(schoolId: string, actorUserId: string, input: BulkFeePreviewInput): Promise<FeeBulkPreview>;
  setFeePaymentReconciliation(schoolId: string, actorUserId: string, paymentId: string, input: SetFeeReconciliationInput):
    Promise<{ paymentId: string; status: "PENDING" | "RECONCILED"; reference: string | null }>;
}

function schoolDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = (name: string) => parts.find(row => row.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
}

/** Bounded report reads fail closed, never return a misleading truncated financial summary. */
async function bounded<T>(request: Promise<T[]>, label: string): Promise<T[]> {
  const rows = await request;
  if (rows.length > MAX_REPORT_ROWS)
    throw new CommunicationValidationError(`${label} exceeds the 5000-row report limit; narrow the school data before exporting.`);
  return rows;
}

function safeMethod(raw: string): Method {
  return METHODS.includes(raw as Method) ? raw as Method : "OTHER";
}

export function createFeeFinancialStore(db: FoundationDatabase): FeeFinancialStore {
  return {
    async getFeeFinancialReport(schoolId, query) {
      const [settings] = await db.select({ timezone: schoolSettings.timezone })
        .from(schoolSettings).where(eq(schoolSettings.schoolId, schoolId)).limit(1);
      if (!settings) throw new CommunicationNotFoundError("School settings not found.");
      const timezone = settings.timezone;
      const asOf = schoolDate(new Date(), timezone);
      const [invoiceRows, paymentRows, recRows] = await Promise.all([
        bounded(db.select().from(feeInvoices).where(and(
          eq(feeInvoices.schoolId, schoolId), ne(feeInvoices.status, "DRAFT"),
          ne(feeInvoices.status, "CANCELLED")
        )).orderBy(asc(feeInvoices.id)).limit(MAX_REPORT_ROWS + 1), "Issued invoices"),
        bounded(db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId))
          .orderBy(asc(feePayments.id)).limit(MAX_REPORT_ROWS + 1), "Ledger payments"),
        bounded(db.select().from(feePaymentReconciliations).where(eq(feePaymentReconciliations.schoolId, schoolId))
          .limit(MAX_REPORT_ROWS + 1), "Reconciliation records")
      ]);
      const invoiceById = new Map(invoiceRows.map(row => [row.id, row]));
      const netByInvoice = new Map<string, number>();
      const paymentsById = new Map(paymentRows.map(row => [row.id, row]));
      const reversed = new Set(paymentRows.filter(row => row.kind === "REVERSAL")
        .map(row => row.reversalOfPaymentId).filter((value): value is string => Boolean(value)));
      const reconciliation = new Map(recRows.map(row => [row.paymentId, row]));
      for (const row of paymentRows) {
        if (!invoiceById.has(row.invoiceId)) continue;
        netByInvoice.set(row.invoiceId, (netByInvoice.get(row.invoiceId) ?? 0) +
          (row.kind === "PAYMENT" ? row.amount : -row.amount));
      }
      const aging = { notDue: 0, days1to30: 0, days31to60: 0, days61to90: 0, daysOver90: 0 };
      let billed = 0, paid = 0, outstanding = 0, overdue = 0;
      const invoiceSnapshots: FeeFinancialReport["invoices"] = [];
      for (const invoice of invoiceRows) {
        const net = netByInvoice.get(invoice.id) ?? 0;
        const balance = Math.max(0, invoice.amount - net);
        billed += invoice.amount;
        paid += net;
        outstanding += balance;
        const lateDays = daysBetween(invoice.dueDate, asOf);
        invoiceSnapshots.push({ invoiceNumber: invoice.invoiceNumber, studentCode: "", studentName: "",
          dueDate: invoice.dueDate, amount: invoice.amount, paid: net,
          outstanding: balance, daysOverdue: Math.max(0, lateDays) });
        if (lateDays <= 0) aging.notDue += balance;
        else {
          overdue += balance;
          if (lateDays <= 30) aging.days1to30 += balance;
          else if (lateDays <= 60) aging.days31to60 += balance;
          else if (lateDays <= 90) aging.days61to90 += balance;
          else aging.daysOver90 += balance;
        }
      }

      const methods = METHODS.map(method => ({
        method, gross: 0, reversals: 0, net: 0,
        pendingCount: 0, reconciledCount: 0, pendingAmount: 0, reconciledAmount: 0
      }));
      const byMethod = new Map(methods.map(value => [value.method, value]));
      const [studentRows, recorderRows] = await Promise.all([
        db.select({ id: students.id, fullName: students.fullName, studentCode: students.studentCode })
          .from(students).where(eq(students.schoolId, schoolId)),
        db.select({ id: users.id, username: users.username }).from(users)
          .where(eq(users.schoolId, schoolId))
      ]);
      const studentById = new Map(studentRows.map(item => [item.id, item]));
      const recorderById = new Map(recorderRows.map(item => [item.id, item.username]));
      for (let index = 0; index < invoiceSnapshots.length; index += 1) {
        const student = studentById.get(invoiceRows[index]!.studentId);
        invoiceSnapshots[index]!.studentName = student?.fullName ?? "";
        invoiceSnapshots[index]!.studentCode = student?.studentCode ?? "";
      }
      const filtered = paymentRows.filter(row => {
        const day = schoolDate(row.recordedAt, timezone);
        return invoiceById.has(row.invoiceId) && (!query.from || day >= query.from) && (!query.to || day <= query.to);
      });
      let grossPayments = 0, reversals = 0;
      const rows: FeeReportRow[] = filtered.map(payment => {
        const invoice = invoiceById.get(payment.invoiceId)!;
        const student = studentById.get(invoice.studentId);
        const original = payment.kind === "REVERSAL" && payment.reversalOfPaymentId
          ? paymentsById.get(payment.reversalOfPaymentId) : payment;
        const bucket = byMethod.get(safeMethod(original?.method ?? payment.method))!;
        if (payment.kind === "PAYMENT") {
          bucket.gross += payment.amount;
          grossPayments += payment.amount;
          if (!reversed.has(payment.id)) {
            const isReconciled = reconciliation.has(payment.id);
            if (isReconciled) {
              bucket.reconciledCount += 1;
              bucket.reconciledAmount += payment.amount;
            } else if (bucket.method === "CASH" || bucket.method === "BANK_TRANSFER") {
              bucket.pendingCount += 1;
              bucket.pendingAmount += payment.amount;
            }
          }
        } else {
          bucket.reversals += payment.amount;
          reversals += payment.amount;
        }
        return {
          paymentId: payment.id, invoiceNumber: invoice.invoiceNumber,
          studentCode: student?.studentCode ?? "", studentName: student?.fullName ?? "",
          kind: payment.kind, amount: payment.amount, method: payment.method,
          recordedAt: payment.recordedAt, transactionReference: payment.transactionReference,
          recordedBy: recorderById.get(payment.recordedBy) ?? "",
          reconciliation: payment.kind === "REVERSAL" ? "NOT_APPLICABLE"
            : reversed.has(payment.id) ? "REVERSED"
            : reconciliation.has(payment.id) ? "RECONCILED" : "PENDING"
        };
      }).sort((a,b) => b.recordedAt.getTime()-a.recordedAt.getTime() || b.paymentId.localeCompare(a.paymentId));
      for (const bucket of methods) bucket.net = bucket.gross - bucket.reversals;
      return {
        asOf, schoolTimezone: timezone, from: query.from ?? null, to: query.to ?? null,
        billed, paid, outstanding, overdue, aging,
        statement: { grossPayments, reversals, netCollections: grossPayments - reversals, methods },
        rows, invoices: invoiceSnapshots.sort((a,b) => a.invoiceNumber-b.invoiceNumber)
      };
    },

    async setFeePaymentReconciliation(schoolId, actorUserId, paymentId, input) {
      return db.transaction(async tx => {
        const [payment] = await tx.select().from(feePayments).where(and(
          eq(feePayments.schoolId, schoolId), eq(feePayments.id, paymentId),
          eq(feePayments.kind, "PAYMENT")
        )).limit(1);
        if (!payment) throw new CommunicationNotFoundError("Payment not found.");
        const [invoice] = await tx.select({ id: feeInvoices.id }).from(feeInvoices)
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.id, payment.invoiceId)))
          .limit(1).for("update");
        if (!invoice) throw new CommunicationNotFoundError("Invoice not found.");
        if (payment.method !== "CASH" && payment.method !== "BANK_TRANSFER")
          throw new CommunicationConflictError("Only cash and bank payments can be reconciled here.");
        const [reversal] = await tx.select({ id: feePayments.id }).from(feePayments).where(and(
          eq(feePayments.schoolId, schoolId), eq(feePayments.reversalOfPaymentId, paymentId)
        )).limit(1);
        if (reversal) throw new CommunicationConflictError("Reversed payments cannot be reconciled.");
        const [prior] = await tx.select().from(feePaymentReconciliations).where(and(
          eq(feePaymentReconciliations.schoolId, schoolId),
          eq(feePaymentReconciliations.paymentId, paymentId)
        )).limit(1);
        if (input.status === "RECONCILED") {
          await tx.insert(feePaymentReconciliations).values({
            paymentId, schoolId, reconciledBy: actorUserId,
            reference: input.reference ?? null
          }).onConflictDoUpdate({
            target: feePaymentReconciliations.paymentId,
            set: { reconciledBy: actorUserId, reference: input.reference ?? null, reconciledAt: new Date() }
          });
        } else if (prior) {
          await tx.delete(feePaymentReconciliations).where(and(
            eq(feePaymentReconciliations.paymentId, paymentId),
            eq(feePaymentReconciliations.schoolId, schoolId)
          ));
        }
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId, action: "fee_payment.reconciliation_updated",
          entityType: "fee_payment", entityId: paymentId,
          metadata: { invoiceId: payment.invoiceId, from: prior ? "RECONCILED" : "PENDING",
            to: input.status, reference: input.reference ?? null }
        });
        return { paymentId, status: input.status, reference: input.status === "RECONCILED" ? input.reference ?? null : null };
      });
    },

    async previewBulkFeeInvoices(schoolId, actorUserId, input) {
      const ids = Array.from(new Set(input.invoices.map(row => row.studentId)));
      const [studentRows, existing] = await Promise.all([
        db.select({ id: students.id, status: students.status }).from(students)
          .where(and(eq(students.schoolId, schoolId), inArray(students.id, ids))),
        bounded(db.select().from(feeInvoices)
          .where(and(eq(feeInvoices.schoolId, schoolId),
            inArray(feeInvoices.studentId, ids), ne(feeInvoices.status, "CANCELLED")))
          .limit(MAX_REPORT_ROWS + 1), "Candidate students' existing invoices")
      ]);
      const active = new Set(studentRows.filter(row => row.status === "ACTIVE").map(row => row.id));
      const matchKey = (studentId: string, dueDate: string, description: string | undefined) =>
        `${studentId}|${dueDate}|${(description ?? "").trim().toLowerCase().replace(/\s+/g, " ")}`;
      const existingByKey = new Map(existing.map(row => [
        matchKey(row.studentId, row.dueDate, row.description ?? undefined), row.invoiceNumber
      ]));
      const seen = new Set<string>();
      const rows: FeeBulkPreview["rows"] = input.invoices.map((row,index) => {
        const key = matchKey(row.studentId,row.dueDate,row.description);
        const status = !active.has(row.studentId) ? "STUDENT_UNAVAILABLE"
          : seen.has(key) ? "DUPLICATE_BATCH"
          : existingByKey.has(key) ? "EXISTING_INVOICE" : "READY";
        seen.add(key);
        return { index: index + 1, studentId: row.studentId, status,
          existingInvoiceNumber: status === "EXISTING_INVOICE" ? existingByKey.get(key) ?? null : null };
      });
      const result: FeeBulkPreview = {
        total: rows.length, ready: rows.filter(row => row.status === "READY").length,
        duplicates: rows.filter(row => row.status === "DUPLICATE_BATCH" || row.status === "EXISTING_INVOICE").length,
        unavailable: rows.filter(row => row.status === "STUDENT_UNAVAILABLE").length,
        rows, created: false
      };
      await db.insert(auditLogs).values({
        id: randomUUID(), schoolId, actorUserId, action: "fee_invoice.bulk_previewed",
        entityType: "school", entityId: schoolId,
        metadata: { total: result.total, ready: result.ready, duplicates: result.duplicates, unavailable: result.unavailable }
      });
      return result;
    }
  };
}
