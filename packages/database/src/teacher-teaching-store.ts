import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, lte, inArray, or } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears, classSections, subjects, teacherAssignments, curriculumUnits,
  teacherUnitProgress, teacherLessonPlans, homeworks, continuousAssessments
} from "./schema.js";

export class TeachingNotFoundError extends Error {}
export class TeachingValidationError extends Error {}
export class TeachingConflictError extends Error {}

export type LessonState = "PLANNED" | "COMPLETED" | "POSTPONED";
export type UnitState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type LessonInput = {
  lessonDate: string; topic: string; objective: string;
  materials: string; notes: string; unitId?: string | null;
};
export type LessonPatch = Partial<LessonInput> & { status?: LessonState };
export type UnitInput = {
  academicYearId: string; classId: string; subjectId: string;
  title: string; sortOrder: number;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function summarizeTeaching(
  lessons: Array<{ status: string }>,
  units: Array<{ status: UnitState }>,
  homework: Array<{ status: string }>,
  assessmentCount: number
) {
  return {
    lessonPlanned: lessons.filter((item) => item.status === "PLANNED").length,
    lessonCompleted: lessons.filter((item) => item.status === "COMPLETED").length,
    lessonPostponed: lessons.filter((item) => item.status === "POSTPONED").length,
    unitsTotal: units.length,
    unitsCompleted: units.filter((item) => item.status === "COMPLETED").length,
    unitsInProgress: units.filter((item) => item.status === "IN_PROGRESS").length,
    homeworksPublished: homework.filter((item) => item.status === "PUBLISHED" || item.status === "CLOSED").length,
    homeworkDrafts: homework.filter((item) => item.status === "DRAFT").length,
    assessmentCount
  };
}

export interface TeacherTeachingStore {
  listCurriculum(schoolId: string, yearId: string, classId: string, subjectId: string): Promise<Array<typeof curriculumUnits.$inferSelect>>;
  addCurriculumUnit(schoolId: string, adminId: string, input: UnitInput): Promise<typeof curriculumUnits.$inferSelect>;
  updateCurriculumUnit(schoolId: string, unitId: string, input: { title?: string; sortOrder?: number }): Promise<typeof curriculumUnits.$inferSelect>;
  deleteCurriculumUnit(schoolId: string, unitId: string): Promise<void>;
  teacherWorkspace(schoolId: string, teacherId: string, assignmentId: string): Promise<{
    lessons: Array<typeof teacherLessonPlans.$inferSelect>;
    units: Array<{ unit: typeof curriculumUnits.$inferSelect; status: UnitState }>;
    summary: ReturnType<typeof summarizeTeaching>;
  }>;
  createLesson(schoolId: string, teacherId: string, assignmentId: string, input: LessonInput): Promise<typeof teacherLessonPlans.$inferSelect>;
  updateLesson(schoolId: string, teacherId: string, assignmentId: string, lessonId: string, input: LessonPatch): Promise<typeof teacherLessonPlans.$inferSelect>;
  updateUnit(schoolId: string, teacherId: string, assignmentId: string, unitId: string, status: UnitState): Promise<{ status: UnitState }>;
  report(schoolId: string, teacherId: string, assignmentId: string, from: string, to: string): Promise<{
    from: string; to: string; summary: ReturnType<typeof summarizeTeaching>;
    lessons: Array<typeof teacherLessonPlans.$inferSelect>;
    units: Array<{ unit: typeof curriculumUnits.$inferSelect; status: UnitState }>;
  }>;
}

export function createTeacherTeachingStore(db: FoundationDatabase): TeacherTeachingStore {
  async function activeAssignment(schoolId: string, teacherId: string, assignmentId: string) {
    const [row] = await db.select({ assignment: teacherAssignments })
      .from(teacherAssignments)
      .innerJoin(academicYears, and(
        eq(academicYears.id, teacherAssignments.academicYearId),
        eq(academicYears.schoolId, schoolId),
        eq(academicYears.status, "ACTIVE")
      ))
      .where(and(
        eq(teacherAssignments.id, assignmentId),
        eq(teacherAssignments.schoolId, schoolId),
        eq(teacherAssignments.teacherUserId, teacherId)
      )).limit(1);
    if (!row) throw new TeachingNotFoundError("Active assigned subject not found.");
    return row.assignment;
  }
  async function checkUnit(schoolId: string, assignment: typeof teacherAssignments.$inferSelect, unitId: string) {
    const [unit] = await db.select().from(curriculumUnits).where(and(
      eq(curriculumUnits.id, unitId), eq(curriculumUnits.schoolId, schoolId),
      eq(curriculumUnits.academicYearId, assignment.academicYearId),
      eq(curriculumUnits.classId, assignment.classId),
      eq(curriculumUnits.subjectId, assignment.subjectId)
    )).limit(1);
    if (!unit) throw new TeachingNotFoundError("Curriculum unit not assigned to this class and subject.");
    return unit;
  }
  async function unitOverview(schoolId: string, assignment: typeof teacherAssignments.$inferSelect) {
    const rows = await db.select({ unit: curriculumUnits, progress: teacherUnitProgress })
      .from(curriculumUnits)
      .leftJoin(teacherUnitProgress, and(
        eq(teacherUnitProgress.unitId, curriculumUnits.id),
        eq(teacherUnitProgress.assignmentId, assignment.id),
        eq(teacherUnitProgress.schoolId, schoolId)
      ))
      .where(and(
        eq(curriculumUnits.schoolId, schoolId),
        eq(curriculumUnits.academicYearId, assignment.academicYearId),
        eq(curriculumUnits.classId, assignment.classId),
        eq(curriculumUnits.subjectId, assignment.subjectId)
      )).orderBy(asc(curriculumUnits.sortOrder));
    return rows.map((row) => ({
      unit: row.unit, status: (row.progress?.status ?? "NOT_STARTED") as UnitState
    }));
  }
  async function ownLessons(schoolId: string, assignmentId: string) {
    return db.select().from(teacherLessonPlans).where(and(
      eq(teacherLessonPlans.schoolId, schoolId),
      eq(teacherLessonPlans.assignmentId, assignmentId)
    )).orderBy(desc(teacherLessonPlans.lessonDate), desc(teacherLessonPlans.createdAt));
  }
  async function ownSummary(schoolId: string, assignment: typeof teacherAssignments.$inferSelect,
    lessons: Awaited<ReturnType<typeof ownLessons>>,
    units: Awaited<ReturnType<typeof unitOverview>>) {
    const [homework, assessments] = await Promise.all([
      db.select({ status: homeworks.status }).from(homeworks)
        .where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.assignmentId, assignment.id))),
      db.select({ id: continuousAssessments.id }).from(continuousAssessments)
        .where(and(eq(continuousAssessments.schoolId, schoolId), eq(continuousAssessments.assignmentId, assignment.id)))
    ]);
    return summarizeTeaching(lessons, units, homework, assessments.length);
  }
  return {
    async listCurriculum(schoolId, yearId, classId, subjectId) {
      return db.select().from(curriculumUnits).where(and(
        eq(curriculumUnits.schoolId, schoolId),
        eq(curriculumUnits.academicYearId, yearId),
        eq(curriculumUnits.classId, classId),
        eq(curriculumUnits.subjectId, subjectId)
      )).orderBy(asc(curriculumUnits.sortOrder));
    },
    async addCurriculumUnit(schoolId, adminId, input) {
      const [target] = await db.select({ yearId: academicYears.id }).from(classSections)
        .innerJoin(academicYears, and(
          eq(academicYears.id, classSections.academicYearId),
          eq(academicYears.schoolId, schoolId),
          eq(academicYears.status, "ACTIVE")
        ))
        .innerJoin(subjects, and(
          eq(subjects.id, input.subjectId), eq(subjects.schoolId, schoolId)
        ))
        .where(and(
          eq(classSections.id, input.classId),
          eq(classSections.schoolId, schoolId),
          eq(classSections.academicYearId, input.academicYearId)
        )).limit(1);
      if (!target || target.yearId !== input.academicYearId) {
        throw new TeachingNotFoundError("Active class, year and subject not found.");
      }
      const [unit] = await db.insert(curriculumUnits).values({
        id: randomUUID(), schoolId, createdBy: adminId, ...input
      }).onConflictDoNothing().returning();
      if (!unit) throw new TeachingConflictError("This curriculum position is already assigned.");
      return unit;
    },
    async updateCurriculumUnit(schoolId, unitId, input) {
      const [existing] = await db.select({ unit: curriculumUnits }).from(curriculumUnits)
        .innerJoin(academicYears, and(
          eq(academicYears.id, curriculumUnits.academicYearId),
          eq(academicYears.schoolId, schoolId),
          eq(academicYears.status, "ACTIVE")
        ))
        .where(and(eq(curriculumUnits.schoolId, schoolId), eq(curriculumUnits.id, unitId)))
        .limit(1);
      if (!existing) throw new TeachingNotFoundError("Active curriculum unit not found.");
      if (input.sortOrder !== undefined && input.sortOrder !== existing.unit.sortOrder) {
        const [occupied] = await db.select({ id: curriculumUnits.id }).from(curriculumUnits)
          .where(and(
            eq(curriculumUnits.schoolId, schoolId),
            eq(curriculumUnits.academicYearId, existing.unit.academicYearId),
            eq(curriculumUnits.classId, existing.unit.classId),
            eq(curriculumUnits.subjectId, existing.unit.subjectId),
            eq(curriculumUnits.sortOrder, input.sortOrder)
          )).limit(1);
        if (occupied) throw new TeachingConflictError("The curriculum chapter position is already used.");
      }
      const [updated] = await db.update(curriculumUnits).set(input)
        .where(and(eq(curriculumUnits.schoolId, schoolId), eq(curriculumUnits.id, unitId)))
        .returning();
      if (!updated) throw new TeachingNotFoundError("Curriculum unit no longer exists.");
      return updated;
    },
    async deleteCurriculumUnit(schoolId, unitId) {
      const [unit] = await db.select({ id: curriculumUnits.id }).from(curriculumUnits)
        .innerJoin(academicYears, and(
          eq(academicYears.id, curriculumUnits.academicYearId),
          eq(academicYears.schoolId, schoolId), eq(academicYears.status, "ACTIVE")
        ))
        .where(and(eq(curriculumUnits.schoolId, schoolId), eq(curriculumUnits.id, unitId)))
        .limit(1);
      if (!unit) throw new TeachingNotFoundError("Active curriculum unit not found.");
      const [progress, lesson] = await Promise.all([
        db.select({ id: teacherUnitProgress.id }).from(teacherUnitProgress).where(and(
          eq(teacherUnitProgress.schoolId, schoolId), eq(teacherUnitProgress.unitId, unitId)
        )).limit(1),
        db.select({ id: teacherLessonPlans.id }).from(teacherLessonPlans).where(and(
          eq(teacherLessonPlans.schoolId, schoolId), eq(teacherLessonPlans.unitId, unitId)
        )).limit(1)
      ]);
      if (progress.length || lesson.length) {
        throw new TeachingConflictError("Curriculum unit is used by lesson plans or teaching progress.");
      }
      await db.delete(curriculumUnits).where(and(
        eq(curriculumUnits.id, unitId), eq(curriculumUnits.schoolId, schoolId)
      ));
    },
    async teacherWorkspace(schoolId, teacherId, assignmentId) {
      const assignment = await activeAssignment(schoolId, teacherId, assignmentId);
      const [lessons, units] = await Promise.all([
        ownLessons(schoolId, assignment.id),
        unitOverview(schoolId, assignment)
      ]);
      return { lessons, units, summary: await ownSummary(schoolId, assignment, lessons, units) };
    },
    async createLesson(schoolId, teacherId, assignmentId, input) {
      const assignment = await activeAssignment(schoolId, teacherId, assignmentId);
      if (!validDate(input.lessonDate)) throw new TeachingValidationError("Invalid lesson date.");
      if (input.unitId) await checkUnit(schoolId, assignment, input.unitId);
      const [lesson] = await db.insert(teacherLessonPlans).values({
        id: randomUUID(), schoolId, assignmentId, lessonDate: input.lessonDate,
        topic: input.topic, objective: input.objective, materials: input.materials,
        notes: input.notes, unitId: input.unitId ?? null
      }).returning();
      if (!lesson) throw new Error("Lesson creation failed.");
      return lesson;
    },
    async updateLesson(schoolId, teacherId, assignmentId, lessonId, input) {
      const assignment = await activeAssignment(schoolId, teacherId, assignmentId);
      const [existing] = await db.select().from(teacherLessonPlans).where(and(
        eq(teacherLessonPlans.id, lessonId),
        eq(teacherLessonPlans.schoolId, schoolId),
        eq(teacherLessonPlans.assignmentId, assignment.id)
      )).limit(1);
      if (!existing) throw new TeachingNotFoundError("Lesson plan not found in this assignment.");
      if (input.lessonDate !== undefined && !validDate(input.lessonDate)) {
        throw new TeachingValidationError("Invalid lesson date.");
      }
      if (input.unitId) await checkUnit(schoolId, assignment, input.unitId);
      const [lesson] = await db.update(teacherLessonPlans).set({
        ...input, updatedAt: new Date()
      }).where(and(
        eq(teacherLessonPlans.id, lessonId), eq(teacherLessonPlans.schoolId, schoolId),
        eq(teacherLessonPlans.assignmentId, assignment.id)
      )).returning();
      if (!lesson) throw new TeachingNotFoundError("Lesson not found.");
      return lesson;
    },
    async updateUnit(schoolId, teacherId, assignmentId, unitId, status) {
      const assignment = await activeAssignment(schoolId, teacherId, assignmentId);
      await checkUnit(schoolId, assignment, unitId);
      const [progress] = await db.insert(teacherUnitProgress).values({
        id: randomUUID(), schoolId, assignmentId, unitId, status, updatedBy: teacherId
      }).onConflictDoUpdate({
        target: [teacherUnitProgress.assignmentId, teacherUnitProgress.unitId],
        set: { status, updatedBy: teacherId, updatedAt: new Date() }
      }).returning();
      if (!progress) throw new Error("Curriculum update failed.");
      return { status: progress.status as UnitState };
    },
    async report(schoolId, teacherId, assignmentId, from, to) {
      const assignment = await activeAssignment(schoolId, teacherId, assignmentId);
      if (!validDate(from) || !validDate(to) || from > to) {
        throw new TeachingValidationError("Choose valid chronological report dates.");
      }
      const days = Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86_400_000) + 1;
      if (days > 366) throw new TeachingValidationError("Reports are limited to one year.");
      const [lessons, units, homework, assessments] = await Promise.all([
        db.select().from(teacherLessonPlans).where(and(
          eq(teacherLessonPlans.schoolId, schoolId),
          eq(teacherLessonPlans.assignmentId, assignment.id),
          gte(teacherLessonPlans.lessonDate, from), lte(teacherLessonPlans.lessonDate, to)
        )).orderBy(desc(teacherLessonPlans.lessonDate)),
        unitOverview(schoolId, assignment),
        db.select({ status: homeworks.status }).from(homeworks).where(and(
          eq(homeworks.schoolId, schoolId), eq(homeworks.assignmentId, assignment.id),
          or(
            // Publication counts belong to the date they were published,
            // not when the original homework draft was first created.
            and(inArray(homeworks.status, ["PUBLISHED", "CLOSED"]),
              gte(homeworks.publishedAt, new Date(from + "T00:00:00+04:30")),
              lte(homeworks.publishedAt, new Date(to + "T23:59:59.999+04:30"))),
            and(eq(homeworks.status, "DRAFT"),
              gte(homeworks.createdAt, new Date(from + "T00:00:00+04:30")),
              lte(homeworks.createdAt, new Date(to + "T23:59:59.999+04:30")))
          )
        )),
        db.select({ id: continuousAssessments.id }).from(continuousAssessments).where(and(
          eq(continuousAssessments.schoolId, schoolId),
          eq(continuousAssessments.assignmentId, assignment.id),
          gte(continuousAssessments.assessedOn, from),
          lte(continuousAssessments.assessedOn, to)
        ))
      ]);
      return { from, to, lessons, units, summary: summarizeTeaching(lessons, units, homework, assessments.length) };
    }
  };
}
