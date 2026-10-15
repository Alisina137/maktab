import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears, auditLogs, classSections, teacherAssignments, teacherProfiles,
  subjects, users
} from "./schema.js";
import { LearningNotFoundError } from "./learning-store.js";

export type AdminAcademicReportQuery = {
  academicYearId: string; classId?: string; subjectId?: string;
  search?: string; limit: number; offset: number;
};
export type AdminAcademicReportRow = {
  assignmentId: string;
  classId: string; className: string;
  subjectId: string; subjectName: string;
  teacherName: string;
  examSubjects: number; publishedExamSubjects: number; publishedGrades: number;
  publishedHomework: number; submissionsAwaitingReview: number;
  curriculumUnits: number; completedUnits: number; completedLessons: number;
};
export type AdminAcademicReport = {
  academicYearId: string;
  rows: AdminAcademicReportRow[];
  total: number; limit: number; offset: number;
  summary: {
    assignments: number; examSubjects: number; publishedExamSubjects: number;
    publishedGrades: number; publishedHomework: number; submissionsAwaitingReview: number;
    curriculumUnits: number; completedUnits: number; completedLessons: number;
  };
  coverage: "ASSIGNED_CLASS_SUBJECTS_ONLY";
};

export type LearningAuditCategory = "ALL" | "EXAMS" | "GRADES" | "HOMEWORK" | "CURRICULUM";
export type AdminLearningAuditQuery = {
  academicYearId: string; category: LearningAuditCategory;
  from?: string; to?: string; limit: number; offset: number;
};
export type AdminLearningAudit = {
  rows: Array<{ id: string; createdAt: Date; action: string;
    entityType: string; actorUsername: string | null }>;
  total: number; limit: number; offset: number;
  scope: "MATCHED_LIVE_YEAR_ENTITIES"; timezone: "UTC";
};

export interface AdminLearningReportsStore {
  getAdminAcademicReport(schoolId: string, query: AdminAcademicReportQuery): Promise<AdminAcademicReport>;
  getAdminLearningAudit(schoolId: string, query: AdminLearningAuditQuery): Promise<AdminLearningAudit>;
}

export function createAdminLearningReportsStore(db: FoundationDatabase): AdminLearningReportsStore {
  async function requireYear(schoolId: string, yearId: string) {
    const [year] = await db.select({ id: academicYears.id }).from(academicYears)
      .where(and(eq(academicYears.id, yearId), eq(academicYears.schoolId, schoolId))).limit(1);
    if (!year) throw new LearningNotFoundError("Academic year not found.");
  }
  return {
    async getAdminAcademicReport(schoolId, query) {
      await requireYear(schoolId, query.academicYearId);
      // Correlated aggregates intentionally avoid joins between the many
      // exams, homeworks, chapters and lessons that would inflate totals.
      const examSubjects = sql<number>`(select count(*)::int from exam_subjects es
        join exams ex on ex.id = es.exam_id and ex.school_id = es.school_id
        where es.school_id = ${teacherAssignments.schoolId}
          and ex.academic_year_id = ${teacherAssignments.academicYearId}
          and es.class_id = ${teacherAssignments.classId}
          and es.subject_id = ${teacherAssignments.subjectId})`;
      const publishedExamSubjects = sql<number>`(select count(*)::int from exam_subjects es
        join exams ex on ex.id = es.exam_id and ex.school_id = es.school_id
        where es.school_id = ${teacherAssignments.schoolId}
          and ex.academic_year_id = ${teacherAssignments.academicYearId}
          and es.class_id = ${teacherAssignments.classId}
          and es.subject_id = ${teacherAssignments.subjectId}
          and ex.status in ('PUBLISHED','ARCHIVED'))`;
      const publishedGrades = sql<number>`(select count(*)::int from grade_records gr
        join exam_subjects es on es.id = gr.exam_subject_id and es.school_id = gr.school_id
        join exams ex on ex.id = es.exam_id and ex.school_id = gr.school_id
        where gr.school_id = ${teacherAssignments.schoolId}
          and ex.academic_year_id = ${teacherAssignments.academicYearId}
          and es.class_id = ${teacherAssignments.classId}
          and es.subject_id = ${teacherAssignments.subjectId}
          and gr.status = 'PUBLISHED' and ex.status in ('PUBLISHED','ARCHIVED'))`;
      const publishedHomework = sql<number>`(select count(*)::int from homeworks hw
        where hw.school_id = ${teacherAssignments.schoolId}
          and hw.academic_year_id = ${teacherAssignments.academicYearId}
          and hw.assignment_id = ${teacherAssignments.id}
          and hw.status in ('PUBLISHED','CLOSED','ARCHIVED'))`;
      const submissionsAwaitingReview = sql<number>`(select count(*)::int from homework_submissions hs
        join homeworks hw on hw.id = hs.homework_id and hw.school_id = hs.school_id
        where hs.school_id = ${teacherAssignments.schoolId}
          and hw.academic_year_id = ${teacherAssignments.academicYearId}
          and hw.assignment_id = ${teacherAssignments.id}
          and hw.status in ('PUBLISHED','CLOSED') and hs.status = 'SUBMITTED')`;
      const curriculumUnits = sql<number>`(select count(*)::int from curriculum_units cu
        where cu.school_id = ${teacherAssignments.schoolId}
          and cu.academic_year_id = ${teacherAssignments.academicYearId}
          and cu.class_id = ${teacherAssignments.classId}
          and cu.subject_id = ${teacherAssignments.subjectId})`;
      const completedUnits = sql<number>`(select count(*)::int from teacher_unit_progress tp
        join curriculum_units cu on cu.id = tp.unit_id and cu.school_id = tp.school_id
        where tp.school_id = ${teacherAssignments.schoolId}
          and tp.assignment_id = ${teacherAssignments.id}
          and cu.academic_year_id = ${teacherAssignments.academicYearId}
          and cu.class_id = ${teacherAssignments.classId}
          and cu.subject_id = ${teacherAssignments.subjectId}
          and tp.status = 'COMPLETED')`;
      const completedLessons = sql<number>`(select count(*)::int from teacher_lesson_plans lp
        where lp.school_id = ${teacherAssignments.schoolId}
          and lp.assignment_id = ${teacherAssignments.id}
          and lp.status = 'COMPLETED')`;

      const conditions = [
        eq(teacherAssignments.schoolId, schoolId),
        eq(teacherAssignments.academicYearId, query.academicYearId)
      ];
      if (query.classId) conditions.push(eq(teacherAssignments.classId, query.classId));
      if (query.subjectId) conditions.push(eq(teacherAssignments.subjectId, query.subjectId));
      if (query.search) {
        const escaped = "%" + query.search.trim().replace(/[\\%_]/g, char => "\\" + char) + "%";
        conditions.push(or(ilike(classSections.name, escaped),
          ilike(subjects.name, escaped), ilike(teacherProfiles.fullName, escaped))!);
      }
      const where = and(...conditions);
      const scoped = () => db.select({
        assignmentId: teacherAssignments.id,
        classId: classSections.id, className: classSections.name,
        subjectId: subjects.id, subjectName: subjects.name,
        teacherName: teacherProfiles.fullName,
        examSubjects, publishedExamSubjects, publishedGrades,
        publishedHomework, submissionsAwaitingReview, curriculumUnits,
        completedUnits, completedLessons
      }).from(teacherAssignments)
        .innerJoin(classSections, and(eq(classSections.id, teacherAssignments.classId),
          eq(classSections.schoolId, schoolId)))
        .innerJoin(subjects, and(eq(subjects.id, teacherAssignments.subjectId),
          eq(subjects.schoolId, schoolId)))
        .innerJoin(teacherProfiles, and(eq(teacherProfiles.userId, teacherAssignments.teacherUserId),
          eq(teacherProfiles.schoolId, schoolId)))
        .where(where);
      const [rows, summary] = await Promise.all([
        scoped().orderBy(asc(classSections.name), asc(subjects.name), asc(teacherAssignments.id))
          .limit(query.limit).offset(query.offset),
        db.select({
          assignments: count(),
          examSubjects: sql<number>`coalesce(sum(${examSubjects}),0)::int`,
          publishedExamSubjects: sql<number>`coalesce(sum(${publishedExamSubjects}),0)::int`,
          publishedGrades: sql<number>`coalesce(sum(${publishedGrades}),0)::int`,
          publishedHomework: sql<number>`coalesce(sum(${publishedHomework}),0)::int`,
          submissionsAwaitingReview: sql<number>`coalesce(sum(${submissionsAwaitingReview}),0)::int`,
          curriculumUnits: sql<number>`coalesce(sum(${curriculumUnits}),0)::int`,
          completedUnits: sql<number>`coalesce(sum(${completedUnits}),0)::int`,
          completedLessons: sql<number>`coalesce(sum(${completedLessons}),0)::int`
        }).from(teacherAssignments)
          .innerJoin(classSections, and(eq(classSections.id, teacherAssignments.classId),
            eq(classSections.schoolId, schoolId)))
          .innerJoin(subjects, and(eq(subjects.id, teacherAssignments.subjectId),
            eq(subjects.schoolId, schoolId)))
          .innerJoin(teacherProfiles, and(eq(teacherProfiles.userId, teacherAssignments.teacherUserId),
            eq(teacherProfiles.schoolId, schoolId)))
          .where(where)
      ]);
      const totals = summary[0];
      const number = (v: number | null | undefined) => Number(v ?? 0);
      return {
        academicYearId: query.academicYearId,
        rows: rows.map(item => ({
          ...item, examSubjects: number(item.examSubjects),
          publishedExamSubjects: number(item.publishedExamSubjects),
          publishedGrades: number(item.publishedGrades),
          publishedHomework: number(item.publishedHomework),
          submissionsAwaitingReview: number(item.submissionsAwaitingReview),
          curriculumUnits: number(item.curriculumUnits),
          completedUnits: number(item.completedUnits),
          completedLessons: number(item.completedLessons)
        })),
        total: totals?.assignments ?? 0, limit: query.limit, offset: query.offset,
        summary: {
          assignments: totals?.assignments ?? 0, examSubjects: number(totals?.examSubjects),
          publishedExamSubjects: number(totals?.publishedExamSubjects),
          publishedGrades: number(totals?.publishedGrades),
          publishedHomework: number(totals?.publishedHomework),
          submissionsAwaitingReview: number(totals?.submissionsAwaitingReview),
          curriculumUnits: number(totals?.curriculumUnits),
          completedUnits: number(totals?.completedUnits),
          completedLessons: number(totals?.completedLessons)
        },
        coverage: "ASSIGNED_CLASS_SUBJECTS_ONLY" as const
      };
    },

    async getAdminLearningAudit(schoolId, query) {
      await requireYear(schoolId, query.academicYearId);
      // Audit rows MUST match surviving records for the requested year.
      // Raw metadata may contain scores, contact data or secrets; neither
      // metadata nor student-specific grade history are returned here.
      const examMatch = sql`exists (select 1 from exams ex where ex.id = ${auditLogs.entityId}
        and ex.school_id = ${auditLogs.schoolId} and ex.academic_year_id = ${query.academicYearId})`;
      const subjectMatch = sql`exists (select 1 from exam_subjects es
        join exams ex on ex.id = es.exam_id and ex.school_id = es.school_id
        where es.id = ${auditLogs.entityId} and es.school_id = ${auditLogs.schoolId}
          and ex.academic_year_id = ${query.academicYearId})`;
      const gradeMatch = sql`exists (select 1 from grade_records gr
        join exam_subjects es on es.id = gr.exam_subject_id and es.school_id = gr.school_id
        join exams ex on ex.id = es.exam_id and ex.school_id = es.school_id
        where gr.id = ${auditLogs.entityId} and gr.school_id = ${auditLogs.schoolId}
          and ex.academic_year_id = ${query.academicYearId})`;
      const homeworkMatch = sql`exists (select 1 from homeworks hw where hw.id = ${auditLogs.entityId}
        and hw.school_id = ${auditLogs.schoolId} and hw.academic_year_id = ${query.academicYearId})`;
      const curriculumMatch = sql`exists (select 1 from curriculum_units cu where cu.id = ${auditLogs.entityId}
        and cu.school_id = ${auditLogs.schoolId} and cu.academic_year_id = ${query.academicYearId})`;
      const conditions = [eq(auditLogs.schoolId, schoolId)];
      const categories = {
        EXAMS: or(and(ilike(auditLogs.action, "exam.%"), eq(auditLogs.entityType,"exam"),examMatch),
          and(ilike(auditLogs.action,"exam.%"),eq(auditLogs.entityType,"exam_subject"),subjectMatch)),
        GRADES: or(and(eq(auditLogs.action,"grade.corrected"),eq(auditLogs.entityType,"grade_record"),gradeMatch),
          and(eq(auditLogs.action,"grades.draft_saved"),eq(auditLogs.entityType,"exam_subject"),subjectMatch)),
        HOMEWORK: and(ilike(auditLogs.action,"homework.%"),eq(auditLogs.entityType,"homework"),homeworkMatch),
        CURRICULUM: and(ilike(auditLogs.action,"curriculum.%"),
          eq(auditLogs.entityType,"curriculum_unit"),curriculumMatch)
      };
      if (query.category === "ALL") conditions.push(or(...Object.values(categories))!);
      else conditions.push(categories[query.category]!);
      // Explicitly UTC calendar dates, end date inclusive.
      if (query.from) conditions.push(gte(auditLogs.createdAt, new Date(query.from+"T00:00:00.000Z")));
      if (query.to) conditions.push(lte(auditLogs.createdAt, new Date(query.to+"T23:59:59.999Z")));
      const where = and(...conditions);
      const [totals, rows] = await Promise.all([
        db.select({ total: count() }).from(auditLogs).where(where),
        db.select({
          id: auditLogs.id, createdAt: auditLogs.createdAt,
          action: auditLogs.action, entityType: auditLogs.entityType,
          actorUsername: users.username
        }).from(auditLogs)
          .leftJoin(users, and(eq(users.id, auditLogs.actorUserId),
            eq(users.schoolId, auditLogs.schoolId)))
          .where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(query.limit).offset(query.offset)
      ]);
      return {
        rows, total: totals[0]?.total ?? 0, limit: query.limit, offset: query.offset,
        scope: "MATCHED_LIVE_YEAR_ENTITIES" as const, timezone: "UTC" as const
      };
    }
  };
}
