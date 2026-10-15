import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears, classSections, curriculumUnits, subjects, teacherAssignments,
  teacherLessonPlans, teacherProfiles, teacherUnitProgress
} from "./schema.js";
import { TeachingNotFoundError } from "./teacher-teaching-store.js";

export type AdminTeachingFocus = "ALL" | "NO_CURRICULUM" | "NOT_STARTED" |
  "INCOMPLETE" | "POSTPONED" | "NO_LESSONS";
export type AdminTeachingUnitStatus = "ALL" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type AdminTeachingLessonStatus = "ALL" | "PLANNED" | "COMPLETED" | "POSTPONED";

export type AdminTeachingQuery = {
  academicYearId: string;
  classId?: string; subjectId?: string; teacherUserId?: string;
  search?: string; focus?: AdminTeachingFocus;
  limit: number; offset: number;
};

export type AdminTeachingProgressRow = {
  assignmentId: string;
  classId: string; className: string; classCode: string;
  subjectId: string; subjectName: string;
  teacherUserId: string; teacherName: string;
  unitsTotal: number; unitsCompleted: number; unitsInProgress: number; unitsNotStarted: number;
  lessonPlanned: number; lessonCompleted: number; lessonPostponed: number; lessonTotal: number;
  lastLessonDate: string | null;
  attention: Array<Exclude<AdminTeachingFocus, "ALL">>;
};

export interface AdminTeachingProgressStore {
  listAdminTeachingProgress(schoolId: string, query: AdminTeachingQuery): Promise<{
    rows: AdminTeachingProgressRow[]; total: number; limit: number; offset: number;
    summary: { assignments: number; totalUnits: number; completedUnits: number;
      inProgressUnits: number; noCurriculum: number; postponedLessons: number };
  }>;
  listAdminTeachingUnits(schoolId: string, yearId: string, assignmentId: string,
    status: AdminTeachingUnitStatus, limit: number, offset: number): Promise<{
      rows: Array<{ id: string; title: string; sortOrder: number; status: string; updatedAt: Date | null }>;
      total: number; limit: number; offset: number;
    }>;
  listAdminTeachingLessons(schoolId: string, yearId: string, assignmentId: string,
    status: AdminTeachingLessonStatus, limit: number, offset: number): Promise<{
      rows: Array<{ id: string; lessonDate: string; topic: string; status: string;
        chapterTitle: string | null; updatedAt: Date }>;
      total: number; limit: number; offset: number;
    }>;
}

export function createAdminTeachingProgressStore(db: FoundationDatabase): AdminTeachingProgressStore {
  async function requireAssignment(schoolId: string, yearId: string, assignmentId: string) {
    const [assignment] = await db.select({
      id: teacherAssignments.id, classId: teacherAssignments.classId,
      subjectId: teacherAssignments.subjectId
    }).from(teacherAssignments)
      .innerJoin(academicYears, and(eq(academicYears.id, teacherAssignments.academicYearId),
        eq(academicYears.schoolId, schoolId)))
      .where(and(eq(teacherAssignments.id, assignmentId), eq(teacherAssignments.schoolId, schoolId),
        eq(teacherAssignments.academicYearId, yearId))).limit(1);
    if (!assignment) throw new TeachingNotFoundError("Teaching assignment not found in this academic year.");
    return assignment;
  }

  return {
    async listAdminTeachingProgress(schoolId, query) {
      const [year] = await db.select({ id: academicYears.id }).from(academicYears)
        .where(and(eq(academicYears.schoolId, schoolId),
          eq(academicYears.id, query.academicYearId))).limit(1);
      if (!year) throw new TeachingNotFoundError("Academic year not found.");

      // Every metric is derived from the same school's explicitly assigned
      // class + subject + year. Missing progress means NOT_STARTED, never COMPLETED.
      const unitsTotal = sql<number>`(select count(*)::int from curriculum_units cu
        where cu.school_id = ${teacherAssignments.schoolId}
          and cu.academic_year_id = ${teacherAssignments.academicYearId}
          and cu.class_id = ${teacherAssignments.classId}
          and cu.subject_id = ${teacherAssignments.subjectId})`;
      const unitCount = (status: "COMPLETED" | "IN_PROGRESS") => sql<number>`(
        select count(*)::int from teacher_unit_progress tp
        join curriculum_units cu on cu.id = tp.unit_id
          and cu.school_id = tp.school_id
          and cu.academic_year_id = ${teacherAssignments.academicYearId}
          and cu.class_id = ${teacherAssignments.classId}
          and cu.subject_id = ${teacherAssignments.subjectId}
        where tp.school_id = ${teacherAssignments.schoolId}
          and tp.assignment_id = ${teacherAssignments.id}
          and tp.status = ${status})`;
      const unitsCompleted = unitCount("COMPLETED");
      const unitsInProgress = unitCount("IN_PROGRESS");
      const lessonCount = (status: "PLANNED" | "COMPLETED" | "POSTPONED") => sql<number>`(
        select count(*)::int from teacher_lesson_plans lp
        where lp.school_id = ${teacherAssignments.schoolId}
          and lp.assignment_id = ${teacherAssignments.id}
          and lp.status = ${status})`;
      const lessonPlanned = lessonCount("PLANNED");
      const lessonCompleted = lessonCount("COMPLETED");
      const lessonPostponed = lessonCount("POSTPONED");
      const lessonTotal = sql<number>`(select count(*)::int from teacher_lesson_plans lp
        where lp.school_id = ${teacherAssignments.schoolId}
          and lp.assignment_id = ${teacherAssignments.id})`;
      const lastLessonDate = sql<string | null>`(select max(lp.lesson_date) from teacher_lesson_plans lp
        where lp.school_id = ${teacherAssignments.schoolId}
          and lp.assignment_id = ${teacherAssignments.id}
          and lp.status = 'COMPLETED')`;

      const conditions = [
        eq(teacherAssignments.schoolId, schoolId),
        eq(teacherAssignments.academicYearId, query.academicYearId)
      ];
      if (query.classId) conditions.push(eq(teacherAssignments.classId, query.classId));
      if (query.subjectId) conditions.push(eq(teacherAssignments.subjectId, query.subjectId));
      if (query.teacherUserId) conditions.push(eq(teacherAssignments.teacherUserId, query.teacherUserId));
      if (query.search) {
        const term = "%" + query.search.trim().replace(/[\\%_]/g, value => "\\" + value) + "%";
        conditions.push(or(ilike(teacherProfiles.fullName, term),
          ilike(classSections.name, term), ilike(subjects.name, term))!);
      }
      if (query.focus === "NO_CURRICULUM") conditions.push(eq(unitsTotal, 0));
      if (query.focus === "NOT_STARTED") conditions.push(and(sql`${unitsTotal} > 0`,
        eq(unitsCompleted, 0), eq(unitsInProgress, 0))!);
      if (query.focus === "INCOMPLETE") conditions.push(and(sql`${unitsTotal} > 0`,
        sql`${unitsCompleted} < ${unitsTotal}`)!);
      if (query.focus === "POSTPONED") conditions.push(sql`${lessonPostponed} > 0`);
      if (query.focus === "NO_LESSONS") conditions.push(and(sql`${unitsTotal} > 0`,
        eq(lessonTotal, 0))!);

      const joins = () => db.select({
        assignmentId: teacherAssignments.id, classId: classSections.id,
        className: classSections.name, classCode: classSections.code,
        subjectId: subjects.id, subjectName: subjects.name,
        teacherUserId: teacherProfiles.userId, teacherName: teacherProfiles.fullName,
        unitsTotal, unitsCompleted, unitsInProgress,
        lessonPlanned, lessonCompleted, lessonPostponed, lessonTotal, lastLessonDate
      }).from(teacherAssignments)
        .innerJoin(classSections, and(eq(classSections.id, teacherAssignments.classId),
          eq(classSections.schoolId, schoolId)))
        .innerJoin(subjects, and(eq(subjects.id, teacherAssignments.subjectId),
          eq(subjects.schoolId, schoolId)))
        .innerJoin(teacherProfiles, and(eq(teacherProfiles.userId, teacherAssignments.teacherUserId),
          eq(teacherProfiles.schoolId, schoolId)))
        .where(and(...conditions));
      const [totals, rows, summary] = await Promise.all([
        db.select({ total: count() }).from(teacherAssignments)
          .innerJoin(classSections, and(eq(classSections.id, teacherAssignments.classId),
            eq(classSections.schoolId, schoolId)))
          .innerJoin(subjects, and(eq(subjects.id, teacherAssignments.subjectId),
            eq(subjects.schoolId, schoolId)))
          .innerJoin(teacherProfiles, and(eq(teacherProfiles.userId, teacherAssignments.teacherUserId),
            eq(teacherProfiles.schoolId, schoolId)))
          .where(and(...conditions)),
        joins().orderBy(asc(classSections.name), asc(subjects.name), asc(teacherAssignments.id))
          .limit(query.limit).offset(query.offset),
        db.select({
          assignments: count(),
          totalUnits: sql<number>`coalesce(sum(${unitsTotal}), 0)::int`,
          completedUnits: sql<number>`coalesce(sum(${unitsCompleted}), 0)::int`,
          inProgressUnits: sql<number>`coalesce(sum(${unitsInProgress}), 0)::int`,
          noCurriculum: sql<number>`coalesce(sum(case when ${unitsTotal} = 0 then 1 else 0 end), 0)::int`,
          postponedLessons: sql<number>`coalesce(sum(${lessonPostponed}), 0)::int`
        }).from(teacherAssignments)
          .innerJoin(classSections, and(eq(classSections.id, teacherAssignments.classId),
            eq(classSections.schoolId, schoolId)))
          .innerJoin(subjects, and(eq(subjects.id, teacherAssignments.subjectId),
            eq(subjects.schoolId, schoolId)))
          .innerJoin(teacherProfiles, and(eq(teacherProfiles.userId, teacherAssignments.teacherUserId),
            eq(teacherProfiles.schoolId, schoolId)))
          .where(and(...conditions))
      ]);
      return {
        rows: rows.map(row => {
          const total = Number(row.unitsTotal);
          const completed = Number(row.unitsCompleted);
          const inProgress = Number(row.unitsInProgress);
          const lessons = Number(row.lessonTotal);
          const postponed = Number(row.lessonPostponed);
          const attention: AdminTeachingProgressRow["attention"] = [];
          if (!total) attention.push("NO_CURRICULUM");
          if (total && !completed && !inProgress) attention.push("NOT_STARTED");
          if (total > completed) attention.push("INCOMPLETE");
          if (total && !lessons) attention.push("NO_LESSONS");
          if (postponed) attention.push("POSTPONED");
          return {
            ...row, unitsTotal: total, unitsCompleted: completed, unitsInProgress: inProgress,
            unitsNotStarted: Math.max(0, total - completed - inProgress),
            lessonTotal: lessons, lessonPlanned: Number(row.lessonPlanned),
            lessonCompleted: Number(row.lessonCompleted), lessonPostponed: postponed, attention
          };
        }),
        total: totals[0]?.total ?? 0, limit: query.limit, offset: query.offset,
        summary: {
          assignments: summary[0]?.assignments ?? 0,
          totalUnits: Number(summary[0]?.totalUnits ?? 0),
          completedUnits: Number(summary[0]?.completedUnits ?? 0),
          inProgressUnits: Number(summary[0]?.inProgressUnits ?? 0),
          noCurriculum: Number(summary[0]?.noCurriculum ?? 0),
          postponedLessons: Number(summary[0]?.postponedLessons ?? 0)
        }
      };
    },

    async listAdminTeachingUnits(schoolId, yearId, assignmentId, status, limit, offset) {
      const assignment = await requireAssignment(schoolId, yearId, assignmentId);
      const scope = [
        eq(curriculumUnits.schoolId, schoolId),
        eq(curriculumUnits.academicYearId, yearId),
        eq(curriculumUnits.classId, assignment.classId),
        eq(curriculumUnits.subjectId, assignment.subjectId)
      ];
      if (status === "NOT_STARTED") scope.push(or(isNull(teacherUnitProgress.id),
        eq(teacherUnitProgress.status, "NOT_STARTED"))!);
      if (status === "IN_PROGRESS" || status === "COMPLETED") scope.push(
        eq(teacherUnitProgress.status, status));
      const progressJoin = and(eq(teacherUnitProgress.schoolId, schoolId),
        eq(teacherUnitProgress.assignmentId, assignmentId),
        eq(teacherUnitProgress.unitId, curriculumUnits.id));
      const [totals, rows] = await Promise.all([
        db.select({ total: count() }).from(curriculumUnits)
          .leftJoin(teacherUnitProgress, progressJoin).where(and(...scope)),
        db.select({
          id: curriculumUnits.id, title: curriculumUnits.title,
          sortOrder: curriculumUnits.sortOrder,
          trackedStatus: teacherUnitProgress.status, updatedAt: teacherUnitProgress.updatedAt
        }).from(curriculumUnits).leftJoin(teacherUnitProgress, progressJoin)
          .where(and(...scope))
          .orderBy(asc(curriculumUnits.sortOrder), asc(curriculumUnits.id))
          .limit(limit).offset(offset)
      ]);
      return { rows: rows.map(row => ({
        id: row.id, title: row.title, sortOrder: row.sortOrder,
        status: row.trackedStatus ?? "NOT_STARTED", updatedAt: row.updatedAt
      })), total: totals[0]?.total ?? 0, limit, offset };
    },

    async listAdminTeachingLessons(schoolId, yearId, assignmentId, status, limit, offset) {
      await requireAssignment(schoolId, yearId, assignmentId);
      const scope = [eq(teacherLessonPlans.schoolId, schoolId),
        eq(teacherLessonPlans.assignmentId, assignmentId)];
      if (status !== "ALL") scope.push(eq(teacherLessonPlans.status, status));
      const where = and(...scope);
      const [totals, rows] = await Promise.all([
        db.select({ total: count() }).from(teacherLessonPlans).where(where),
        db.select({
          id: teacherLessonPlans.id, lessonDate: teacherLessonPlans.lessonDate,
          topic: teacherLessonPlans.topic, status: teacherLessonPlans.status,
          chapterTitle: curriculumUnits.title, updatedAt: teacherLessonPlans.updatedAt
        }).from(teacherLessonPlans)
          .leftJoin(curriculumUnits, and(eq(curriculumUnits.id, teacherLessonPlans.unitId),
            eq(curriculumUnits.schoolId, schoolId)))
          .where(where).orderBy(desc(teacherLessonPlans.lessonDate), desc(teacherLessonPlans.id))
          .limit(limit).offset(offset)
      ]);
      return { rows, total: totals[0]?.total ?? 0, limit, offset };
    }
  };
}
