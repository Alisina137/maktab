import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import { teacherTasks } from "./schema.js";

export type TeacherTaskPriority = "LOW" | "NORMAL" | "HIGH";
export type TeacherTaskStatus = "OPEN" | "DONE";
export type TeacherTaskInput = {
  title: string; details: string; priority: TeacherTaskPriority;
  dueOn: string | null;
};
export type TeacherTaskUpdate = Partial<TeacherTaskInput> & { status?: TeacherTaskStatus };
export type TeacherTaskRecord = typeof teacherTasks.$inferSelect;

export class TeacherTaskNotFoundError extends Error {}
export class TeacherTaskLimitError extends Error {}

export interface TeacherTasksStore {
  list(schoolId: string, userId: string): Promise<TeacherTaskRecord[]>;
  create(schoolId: string, userId: string, input: TeacherTaskInput): Promise<TeacherTaskRecord>;
  update(schoolId: string, userId: string, id: string, changes: TeacherTaskUpdate): Promise<TeacherTaskRecord>;
  remove(schoolId: string, userId: string, id: string): Promise<void>;
}

export function createTeacherTasksStore(db: FoundationDatabase): TeacherTasksStore {
  return {
    async list(schoolId, userId) {
      return db.select().from(teacherTasks)
        .where(and(eq(teacherTasks.schoolId, schoolId), eq(teacherTasks.teacherUserId, userId)))
        .orderBy(asc(teacherTasks.dueOn), desc(teacherTasks.createdAt));
    },
    async create(schoolId, userId, input) {
      const existing = await db.select({ id: teacherTasks.id }).from(teacherTasks)
        .where(and(eq(teacherTasks.schoolId, schoolId), eq(teacherTasks.teacherUserId, userId)))
        .limit(301);
      if (existing.length >= 300) {
        throw new TeacherTaskLimitError("You have reached 300 tasks. Delete old tasks to create more.");
      }
      const [created] = await db.insert(teacherTasks).values({
        ...input, id: randomUUID(), schoolId, teacherUserId: userId
      }).returning();
      if (!created) throw new Error("Unable to create task.");
      return created;
    },
    async update(schoolId, userId, id, changes) {
      const [updated] = await db.update(teacherTasks).set({
        ...changes, updatedAt: new Date()
      }).where(and(
        eq(teacherTasks.schoolId, schoolId),
        eq(teacherTasks.teacherUserId, userId),
        eq(teacherTasks.id, id)
      )).returning();
      if (!updated) throw new TeacherTaskNotFoundError("Task not found.");
      return updated;
    },
    async remove(schoolId, userId, id) {
      const [removed] = await db.delete(teacherTasks).where(and(
        eq(teacherTasks.schoolId, schoolId),
        eq(teacherTasks.teacherUserId, userId),
        eq(teacherTasks.id, id)
      )).returning({ id: teacherTasks.id });
      if (!removed) throw new TeacherTaskNotFoundError("Task not found.");
    }
  };
}
