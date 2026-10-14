import { randomUUID } from "node:crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import {
  auditLogs, pilotLaunchEvidence, pilotLaunchDecisions, pilotLaunchDecisionHistory,
  pilotSupportTickets, pilotSupportUpdates, schools
} from "./schema.js";

export const PILOT_EVIDENCE_CATEGORIES = [
  "CROSS_ROLE", "DATABASE", "BACKUP_RESTORE", "NOTIFICATIONS_JOBS", "ACCESSIBILITY_RTL"
] as const;
export type PilotEvidenceCategory = typeof PILOT_EVIDENCE_CATEGORIES[number];
export type PilotEvidenceStatus = "SUBMITTED" | "VERIFIED" | "REJECTED";
export type PilotTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type PilotTicketPriority = "NORMAL" | "HIGH" | "CRITICAL";

export class PilotWorkflowConflict extends Error {
  constructor(message: string) { super(message); this.name = "PilotWorkflowConflict"; }
}
export class PilotWorkflowNotFound extends Error {
  constructor(message = "Record not found.") { super(message); this.name = "PilotWorkflowNotFound"; }
}
type Transaction = Parameters<Parameters<FoundationDatabase["transaction"]>[0]>[0];

async function lockSchool(tx: Transaction, schoolId: string) {
  const [school] = await tx.select({ id: schools.id }).from(schools)
    .where(eq(schools.id, schoolId)).for("update");
  if (!school) throw new PilotWorkflowNotFound("School not found.");
}
async function audit(tx: Transaction, schoolId: string, action: string, entityType: string,
  entityId: string | null, actorUserId?: string, metadata: Record<string, unknown> = {}) {
  await tx.insert(auditLogs).values({
    id: randomUUID(), schoolId, action, entityType, entityId, actorUserId: actorUserId ?? null, metadata
  });
}
async function invalidateLaunch(tx: Transaction, schoolId: string, reason: string) {
  const [current] = await tx.select().from(pilotLaunchDecisions)
    .where(eq(pilotLaunchDecisions.schoolId, schoolId));
  if (current?.status !== "APPROVED") return;
  await tx.update(pilotLaunchDecisions).set({
    status: "NOT_APPROVED", operatorLabel: "SYSTEM", note: reason,
    reviewedAt: new Date(), updatedAt: new Date()
  }).where(eq(pilotLaunchDecisions.schoolId, schoolId));
  await tx.insert(pilotLaunchDecisionHistory).values({
    id: randomUUID(), schoolId, status: "NOT_APPROVED", operatorLabel: "SYSTEM", note: reason
  });
  await audit(tx, schoolId, "pilot.launch_invalidated", "school", schoolId, undefined, { reason: "evidence_or_critical_ticket_changed" });
}

export interface PilotLaunchStore {
  getOverview(schoolId: string): Promise<{
    evidence: Array<typeof pilotLaunchEvidence.$inferSelect>;
    decision: typeof pilotLaunchDecisions.$inferSelect | null;
    decisionHistory: Array<typeof pilotLaunchDecisionHistory.$inferSelect>;
    verifiedCount: number; totalRequired: number; openCriticalTickets: number;
  }>;
  submitEvidence(schoolId: string, userId: string, data: {
    category: PilotEvidenceCategory; reference: string; note: string;
  }): Promise<typeof pilotLaunchEvidence.$inferSelect>;
  reviewEvidence(schoolId: string, data: {
    category: PilotEvidenceCategory; status: "VERIFIED" | "REJECTED"; operatorLabel: string; note: string;
  }): Promise<typeof pilotLaunchEvidence.$inferSelect>;
  listTickets(schoolId: string, query: { limit: number; offset: number; status?: PilotTicketStatus }): Promise<{
    tickets: Array<typeof pilotSupportTickets.$inferSelect>; hasMore: boolean; limit: number; offset: number;
  }>;
  getTicket(schoolId: string, ticketId: string): Promise<{
    ticket: typeof pilotSupportTickets.$inferSelect;
    updates: Array<typeof pilotSupportUpdates.$inferSelect>;
  } | null>;
  createTicket(schoolId: string, userId: string, data: {
    subject: string; description: string; category: string; priority: PilotTicketPriority;
  }): Promise<typeof pilotSupportTickets.$inferSelect>;
  schoolReply(schoolId: string, ticketId: string, userId: string, note: string): Promise<void>;
  platformUpdateTicket(schoolId: string, ticketId: string, status: PilotTicketStatus,
    operatorLabel: string, note: string): Promise<void>;
  decideLaunch(schoolId: string, status: "APPROVED" | "NOT_APPROVED",
    operatorLabel: string, note: string, setupReady: boolean): Promise<typeof pilotLaunchDecisions.$inferSelect>;
}

export function createPilotLaunchStore(db: FoundationDatabase): PilotLaunchStore {
  return {
    async getOverview(schoolId) {
      const [evidence, decisionRows, decisionHistory, criticalRows] = await Promise.all([
        db.select().from(pilotLaunchEvidence).where(eq(pilotLaunchEvidence.schoolId, schoolId))
          .orderBy(pilotLaunchEvidence.category),
        db.select().from(pilotLaunchDecisions).where(eq(pilotLaunchDecisions.schoolId, schoolId)).limit(1),
        db.select().from(pilotLaunchDecisionHistory).where(eq(pilotLaunchDecisionHistory.schoolId, schoolId))
          .orderBy(desc(pilotLaunchDecisionHistory.createdAt)).limit(20),
        db.select({ id: pilotSupportTickets.id }).from(pilotSupportTickets).where(and(
          eq(pilotSupportTickets.schoolId, schoolId), eq(pilotSupportTickets.priority, "CRITICAL"),
          ne(pilotSupportTickets.status, "RESOLVED"), ne(pilotSupportTickets.status, "CLOSED")
        ))
      ]);
      return {
        evidence, decision: decisionRows[0] ?? null, decisionHistory,
        verifiedCount: evidence.filter((row) => row.status === "VERIFIED").length,
        totalRequired: PILOT_EVIDENCE_CATEGORIES.length, openCriticalTickets: criticalRows.length
      };
    },
    async submitEvidence(schoolId, userId, data) {
      return db.transaction(async (tx) => {
        await lockSchool(tx, schoolId);
        const [row] = await tx.insert(pilotLaunchEvidence).values({
          id: randomUUID(), schoolId, submittedBy: userId, category: data.category,
          reference: data.reference, note: data.note, status: "SUBMITTED"
        }).onConflictDoUpdate({
          target: [pilotLaunchEvidence.schoolId, pilotLaunchEvidence.category],
          set: { reference: data.reference, note: data.note, submittedBy: userId,
            status: "SUBMITTED", reviewedBy: null, reviewNote: null, reviewedAt: null, updatedAt: new Date() }
        }).returning();
        if (!row) throw new Error("Evidence insertion returned no row.");
        await invalidateLaunch(tx, schoolId, "Evidence was resubmitted after approval.");
        await audit(tx, schoolId, "pilot.evidence_submitted", "pilot_launch_evidence", row.id, userId,
          { category: data.category, status: "SUBMITTED" });
        return row;
      });
    },
    async reviewEvidence(schoolId, data) {
      return db.transaction(async (tx) => {
        await lockSchool(tx, schoolId);
        const [row] = await tx.update(pilotLaunchEvidence).set({
          status: data.status, reviewedBy: data.operatorLabel, reviewNote: data.note,
          reviewedAt: new Date(), updatedAt: new Date()
        }).where(and(eq(pilotLaunchEvidence.schoolId, schoolId),
          eq(pilotLaunchEvidence.category, data.category))).returning();
        if (!row) throw new PilotWorkflowNotFound("Evidence has not been submitted.");
        await invalidateLaunch(tx, schoolId, "Evidence was reviewed again after approval.");
        await audit(tx, schoolId, "pilot.evidence_reviewed", "pilot_launch_evidence", row.id, undefined,
          { category: data.category, status: data.status });
        return row;
      });
    },
    async listTickets(schoolId, query) {
      const where = query.status
        ? and(eq(pilotSupportTickets.schoolId, schoolId), eq(pilotSupportTickets.status, query.status))
        : eq(pilotSupportTickets.schoolId, schoolId);
      const rows = await db.select().from(pilotSupportTickets).where(where)
        .orderBy(desc(pilotSupportTickets.createdAt), desc(pilotSupportTickets.id))
        .limit(query.limit + 1).offset(query.offset);
      return {
        tickets: rows.slice(0, query.limit), hasMore: rows.length > query.limit,
        limit: query.limit, offset: query.offset
      };
    },
    async getTicket(schoolId, ticketId) {
      const [ticket] = await db.select().from(pilotSupportTickets)
        .where(and(eq(pilotSupportTickets.id, ticketId), eq(pilotSupportTickets.schoolId, schoolId))).limit(1);
      if (!ticket) return null;
      const updates = await db.select().from(pilotSupportUpdates).where(and(
        eq(pilotSupportUpdates.schoolId, schoolId), eq(pilotSupportUpdates.ticketId, ticketId)
      )).orderBy(desc(pilotSupportUpdates.createdAt)).limit(100);
      return { ticket, updates };
    },
    async createTicket(schoolId, userId, data) {
      return db.transaction(async (tx) => {
        await lockSchool(tx, schoolId);
        const [ticket] = await tx.insert(pilotSupportTickets).values({
          id: randomUUID(), schoolId, createdBy: userId, ...data
        }).returning();
        if (!ticket) throw new Error("Ticket insertion returned no row.");
        await tx.insert(pilotSupportUpdates).values({
          id: randomUUID(), ticketId: ticket.id, schoolId, authorKind: "SCHOOL",
          actorUserId: userId, note: "Ticket opened.", statusAfter: "OPEN"
        });
        if (ticket.priority === "CRITICAL") {
          await invalidateLaunch(tx, schoolId, "An unresolved critical support ticket was opened.");
        }
        await audit(tx, schoolId, "pilot.support_opened", "pilot_support_ticket", ticket.id, userId,
          { category: data.category, status: "OPEN" });
        return ticket;
      });
    },
    async schoolReply(schoolId, ticketId, userId, note) {
      await db.transaction(async (tx) => {
        await lockSchool(tx, schoolId);
        const [ticket] = await tx.select().from(pilotSupportTickets).where(and(
          eq(pilotSupportTickets.id, ticketId), eq(pilotSupportTickets.schoolId, schoolId)
        )).limit(1);
        if (!ticket) throw new PilotWorkflowNotFound("Support ticket not found.");
        if (ticket.status === "CLOSED") throw new PilotWorkflowConflict("Closed tickets cannot accept replies.");
        await tx.insert(pilotSupportUpdates).values({
          id: randomUUID(), ticketId, schoolId, authorKind: "SCHOOL", actorUserId: userId, note
        });
        await tx.update(pilotSupportTickets).set({ updatedAt: new Date() })
          .where(eq(pilotSupportTickets.id, ticketId));
        await audit(tx, schoolId, "pilot.support_replied", "pilot_support_ticket", ticketId, userId);
      });
    },
    async platformUpdateTicket(schoolId, ticketId, status, operatorLabel, note) {
      await db.transaction(async (tx) => {
        await lockSchool(tx, schoolId);
        const [ticket] = await tx.update(pilotSupportTickets).set({ status, updatedAt: new Date() })
          .where(and(eq(pilotSupportTickets.schoolId, schoolId), eq(pilotSupportTickets.id, ticketId))).returning();
        if (!ticket) throw new PilotWorkflowNotFound("Support ticket not found.");
        await tx.insert(pilotSupportUpdates).values({
          id: randomUUID(), ticketId, schoolId, authorKind: "PLATFORM",
          note: `${operatorLabel}: ${note}`, statusAfter: status
        });
        if (ticket.priority === "CRITICAL" && status !== "RESOLVED" && status !== "CLOSED") {
          await invalidateLaunch(tx, schoolId, "A critical support ticket is unresolved.");
        }
        await audit(tx, schoolId, "pilot.support_updated", "pilot_support_ticket", ticketId, undefined, { status });
      });
    },
    async decideLaunch(schoolId, status, operatorLabel, note, setupReady) {
      return db.transaction(async (tx) => {
        await lockSchool(tx, schoolId);
        if (status === "APPROVED") {
          if (!setupReady) throw new PilotWorkflowConflict("Current school configuration is not ready.");
          const [evidence, critical] = await Promise.all([
            tx.select({ category: pilotLaunchEvidence.category, status: pilotLaunchEvidence.status })
              .from(pilotLaunchEvidence).where(eq(pilotLaunchEvidence.schoolId, schoolId)),
            tx.select({ id: pilotSupportTickets.id }).from(pilotSupportTickets).where(and(
              eq(pilotSupportTickets.schoolId, schoolId), eq(pilotSupportTickets.priority, "CRITICAL"),
              ne(pilotSupportTickets.status, "RESOLVED"), ne(pilotSupportTickets.status, "CLOSED")
            ))
          ]);
          if (critical.length) throw new PilotWorkflowConflict("Unresolved critical support tickets prevent approval.");
          if (PILOT_EVIDENCE_CATEGORIES.some((category) =>
            !evidence.some((row) => row.category === category && row.status === "VERIFIED"))) {
            throw new PilotWorkflowConflict("All five launch evidence categories must be platform-verified.");
          }
        }
        const now = new Date();
        const [decision] = await tx.insert(pilotLaunchDecisions).values({
          schoolId, status, operatorLabel, note, reviewedAt: now, updatedAt: now
        }).onConflictDoUpdate({
          target: pilotLaunchDecisions.schoolId,
          set: { status, operatorLabel, note, reviewedAt: now, updatedAt: now }
        }).returning();
        if (!decision) throw new Error("Launch decision upsert returned no row.");
        await tx.insert(pilotLaunchDecisionHistory).values({
          id: randomUUID(), schoolId, status, operatorLabel, note
        });
        await audit(tx, schoolId, "pilot.launch_decision", "school", schoolId, undefined, { status });
        return decision;
      });
    }
  };
}
