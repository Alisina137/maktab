import { randomUUID } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import type {
  AcademicYearStatus,
  CreateAcademicYearInput,
  CreateClassSectionInput,
  CreateGradeLevelInput,
  CreateNegaranAssignmentInput,
  CreateSubjectInput,
  CreateTeacherAssignmentInput,
  CreateTeacherProfileInput,
  CreateTimetablePeriodInput,
  EndNegaranAssignmentInput
} from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears,
  classSections,
  gradeLevels,
  negaranAssignments,
  subjects,
  teacherAssignments,
  teacherProfiles,
  timetablePeriods,
  users,
  type AcademicYear,
  type ClassSection,
  type GradeLevel,
  type NegaranAssignment,
  type Subject,
  type TeacherAssignment,
  type TeacherProfile,
  type TimetablePeriod
} from "./schema.js";

export interface AcademicOverview {
  academicYears: AcademicYear[];
  gradeLevels: GradeLevel[];
  classes: ClassSection[];
  subjects: Subject[];
  teachers: TeacherProfile[];
  assignments: TeacherAssignment[];
  negaranAssignments: NegaranAssignment[];
  timetable: TimetablePeriod[];
}

export interface TeacherAcademicView {
  assignments: TeacherAssignment[];
  negaranAssignments: NegaranAssignment[];
  timetable: TimetablePeriod[];
}

export interface AcademicStore {
  getOverview(schoolId: string): Promise<AcademicOverview>;
  getTeacherView(schoolId: string, teacherUserId: string): Promise<TeacherAcademicView>;
  createAcademicYear(schoolId: string, input: CreateAcademicYearInput): Promise<AcademicYear>;
  setAcademicYearStatus(schoolId: string, yearId: string, status: AcademicYearStatus): Promise<AcademicYear>;
  createGradeLevel(schoolId: string, input: CreateGradeLevelInput): Promise<GradeLevel>;
  createClassSection(schoolId: string, input: CreateClassSectionInput): Promise<ClassSection>;
  createSubject(schoolId: string, input: CreateSubjectInput): Promise<Subject>;
  createTeacherProfile(schoolId: string, input: CreateTeacherProfileInput): Promise<TeacherProfile>;
  createTeacherAssignment(schoolId: string, input: CreateTeacherAssignmentInput): Promise<TeacherAssignment>;
  createNegaranAssignment(schoolId: string, input: CreateNegaranAssignmentInput): Promise<NegaranAssignment>;
  endNegaranAssignment(schoolId: string, assignmentId: string, input: EndNegaranAssignmentInput): Promise<NegaranAssignment>;
  createTimetablePeriod(schoolId: string, input: CreateTimetablePeriodInput): Promise<TimetablePeriod>;
}

export class AcademicConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicConflictError";
  }
}

export class AcademicValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicValidationError";
  }
}

export class AcademicNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicNotFoundError";
  }
}

function isUniqueError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate/i.test(message);
}

function periodsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

function dateRangesOverlap(
  startA: string,
  endA: string | null,
  startB: string,
  endB: string | null
): boolean {
  const maxDate = "9999-12-31";
  return startA <= (endB ?? maxDate) && startB <= (endA ?? maxDate);
}

export function createAcademicStore(db: FoundationDatabase): AcademicStore {
  async function getYear(schoolId: string, yearId: string): Promise<AcademicYear> {
    const [year] = await db
      .select()
      .from(academicYears)
      .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, yearId)))
      .limit(1);
    if (!year) throw new AcademicNotFoundError("Academic year not found.");
    return year;
  }

  async function getGrade(schoolId: string, gradeId: string): Promise<GradeLevel> {
    const [grade] = await db
      .select()
      .from(gradeLevels)
      .where(and(eq(gradeLevels.schoolId, schoolId), eq(gradeLevels.id, gradeId)))
      .limit(1);
    if (!grade) throw new AcademicNotFoundError("Grade level not found.");
    return grade;
  }

  async function getClass(schoolId: string, classId: string): Promise<ClassSection> {
    const [classSection] = await db
      .select()
      .from(classSections)
      .where(and(eq(classSections.schoolId, schoolId), eq(classSections.id, classId)))
      .limit(1);
    if (!classSection) throw new AcademicNotFoundError("Class not found.");
    return classSection;
  }

  async function getSubject(schoolId: string, subjectId: string): Promise<Subject> {
    const [subject] = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.schoolId, schoolId), eq(subjects.id, subjectId)))
      .limit(1);
    if (!subject) throw new AcademicNotFoundError("Subject not found.");
    return subject;
  }

  async function getTeacher(schoolId: string, teacherUserId: string): Promise<TeacherProfile> {
    const [teacher] = await db
      .select()
      .from(teacherProfiles)
      .where(and(eq(teacherProfiles.schoolId, schoolId), eq(teacherProfiles.userId, teacherUserId)))
      .limit(1);
    if (!teacher) throw new AcademicNotFoundError("Teacher profile not found.");
    return teacher;
  }

  function requireMutableYear(year: AcademicYear): void {
    if (year.status === "CLOSED" || year.status === "ARCHIVED") {
      throw new AcademicConflictError("Closed or archived academic years cannot receive new academic structure.");
    }
  }

  async function validateClassYear(schoolId: string, yearId: string, classId: string) {
    const [year, classSection] = await Promise.all([
      getYear(schoolId, yearId),
      getClass(schoolId, classId)
    ]);
    requireMutableYear(year);
    if (classSection.academicYearId !== year.id) {
      throw new AcademicValidationError("The selected class does not belong to the selected academic year.");
    }
    return { year, classSection };
  }

  return {
    async getOverview(schoolId) {
      const [
        years,
        grades,
        classes,
        schoolSubjects,
        teachers,
        assignments,
        negarans,
        timetable
      ] = await Promise.all([
        db.select().from(academicYears).where(eq(academicYears.schoolId, schoolId)).orderBy(asc(academicYears.startDate)),
        db.select().from(gradeLevels).where(eq(gradeLevels.schoolId, schoolId)).orderBy(asc(gradeLevels.sortOrder), asc(gradeLevels.name)),
        db.select().from(classSections).where(eq(classSections.schoolId, schoolId)).orderBy(asc(classSections.name)),
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(asc(subjects.name)),
        db.select().from(teacherProfiles).where(eq(teacherProfiles.schoolId, schoolId)).orderBy(asc(teacherProfiles.fullName)),
        db.select().from(teacherAssignments).where(eq(teacherAssignments.schoolId, schoolId)),
        db.select().from(negaranAssignments).where(eq(negaranAssignments.schoolId, schoolId)).orderBy(asc(negaranAssignments.startDate)),
        db.select().from(timetablePeriods).where(eq(timetablePeriods.schoolId, schoolId)).orderBy(asc(timetablePeriods.weekday), asc(timetablePeriods.startsAt))
      ]);

      return {
        academicYears: years,
        gradeLevels: grades,
        classes,
        subjects: schoolSubjects,
        teachers,
        assignments,
        negaranAssignments: negarans,
        timetable
      };
    },

    async getTeacherView(schoolId, teacherUserId) {
      await getTeacher(schoolId, teacherUserId);
      const [assignments, negarans, timetable] = await Promise.all([
        db
          .select()
          .from(teacherAssignments)
          .where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.teacherUserId, teacherUserId))),
        db
          .select()
          .from(negaranAssignments)
          .where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.teacherUserId, teacherUserId))),
        db
          .select()
          .from(timetablePeriods)
          .where(and(eq(timetablePeriods.schoolId, schoolId), eq(timetablePeriods.teacherUserId, teacherUserId)))
          .orderBy(asc(timetablePeriods.weekday), asc(timetablePeriods.startsAt))
      ]);
      return { assignments, negaranAssignments: negarans, timetable };
    },

    async createAcademicYear(schoolId, input) {
      try {
        const [year] = await db
          .insert(academicYears)
          .values({
            id: randomUUID(),
            schoolId,
            name: input.name,
            startDate: input.startDate,
            endDate: input.endDate,
            status: "DRAFT"
          })
          .returning();
        if (!year) throw new Error("Academic year insert did not return a row.");
        return year;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("An academic year with that name already exists in this school.");
        throw error;
      }
    },

    async setAcademicYearStatus(schoolId, yearId, status) {
      const year = await getYear(schoolId, yearId);
      if (year.status === status) return year;

      const allowed: Record<AcademicYearStatus, AcademicYearStatus[]> = {
        DRAFT: ["ACTIVE"],
        ACTIVE: ["CLOSED"],
        CLOSED: ["ACTIVE", "ARCHIVED"],
        ARCHIVED: []
      };
      if (!allowed[year.status].includes(status)) {
        throw new AcademicConflictError(`Academic year cannot move from ${year.status} to ${status}.`);
      }

      if (status === "ACTIVE") {
        const [otherActive] = await db
          .select({ id: academicYears.id })
          .from(academicYears)
          .where(
            and(
              eq(academicYears.schoolId, schoolId),
              eq(academicYears.status, "ACTIVE"),
              ne(academicYears.id, yearId)
            )
          )
          .limit(1);
        if (otherActive) {
          throw new AcademicConflictError("Only one academic year may be active for a school.");
        }
      }

      const [updated] = await db
        .update(academicYears)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, yearId)))
        .returning();
      if (!updated) throw new AcademicNotFoundError("Academic year not found.");
      return updated;
    },

    async createGradeLevel(schoolId, input) {
      try {
        const [grade] = await db
          .insert(gradeLevels)
          .values({ id: randomUUID(), schoolId, ...input })
          .returning();
        if (!grade) throw new Error("Grade level insert did not return a row.");
        return grade;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("That grade code or name already exists in this school.");
        throw error;
      }
    },

    async createClassSection(schoolId, input) {
      const [year] = await Promise.all([
        getYear(schoolId, input.academicYearId),
        getGrade(schoolId, input.gradeLevelId)
      ]);
      requireMutableYear(year);

      try {
        const [classSection] = await db
          .insert(classSections)
          .values({ id: randomUUID(), schoolId, ...input })
          .returning();
        if (!classSection) throw new Error("Class insert did not return a row.");
        return classSection;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("That class code already exists in this academic year.");
        throw error;
      }
    },

    async createSubject(schoolId, input) {
      try {
        const [subject] = await db
          .insert(subjects)
          .values({ id: randomUUID(), schoolId, ...input })
          .returning();
        if (!subject) throw new Error("Subject insert did not return a row.");
        return subject;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("That subject code or name already exists in this school.");
        throw error;
      }
    },

    async createTeacherProfile(schoolId, input) {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.schoolId, schoolId), eq(users.id, input.userId)))
        .limit(1);
      if (!user) throw new AcademicNotFoundError("Teacher user account not found.");
      if (user.role !== "TEACHER") {
        throw new AcademicValidationError("Only a TEACHER account can receive a teacher profile.");
      }
      if (user.status === "ARCHIVED") {
        throw new AcademicConflictError("Archived teacher accounts cannot receive a teacher profile.");
      }

      try {
        const [teacher] = await db
          .insert(teacherProfiles)
          .values({
            userId: input.userId,
            schoolId,
            employeeCode: input.employeeCode,
            fullName: input.fullName,
            phone: input.phone || null
          })
          .returning();
        if (!teacher) throw new Error("Teacher profile insert did not return a row.");
        return teacher;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("This teacher already has a profile or employee code is already in use.");
        throw error;
      }
    },

    async createTeacherAssignment(schoolId, input) {
      await Promise.all([
        validateClassYear(schoolId, input.academicYearId, input.classId),
        getSubject(schoolId, input.subjectId),
        getTeacher(schoolId, input.teacherUserId)
      ]);

      try {
        const [assignment] = await db
          .insert(teacherAssignments)
          .values({ id: randomUUID(), schoolId, ...input })
          .returning();
        if (!assignment) throw new Error("Teacher assignment insert did not return a row.");
        return assignment;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("This teacher is already assigned to that subject and class.");
        throw error;
      }
    },

    async createNegaranAssignment(schoolId, input) {
      const [{ year }, _teacher] = await Promise.all([
        validateClassYear(schoolId, input.academicYearId, input.classId),
        getTeacher(schoolId, input.teacherUserId)
      ]);

      if (input.startDate < year.startDate || input.startDate > year.endDate) {
        throw new AcademicValidationError("Negaran start date must fall inside the academic year.");
      }
      if (input.endDate && (input.endDate < year.startDate || input.endDate > year.endDate)) {
        throw new AcademicValidationError("Negaran end date must fall inside the academic year.");
      }

      const existing = await db
        .select()
        .from(negaranAssignments)
        .where(
          and(
            eq(negaranAssignments.schoolId, schoolId),
            eq(negaranAssignments.academicYearId, input.academicYearId),
            eq(negaranAssignments.classId, input.classId)
          )
        );

      if (existing.some((item) => dateRangesOverlap(item.startDate, item.endDate, input.startDate, input.endDate ?? null))) {
        throw new AcademicConflictError("This class already has a Negaran during the selected date range.");
      }

      const [assignment] = await db
        .insert(negaranAssignments)
        .values({
          id: randomUUID(),
          schoolId,
          ...input,
          endDate: input.endDate ?? null
        })
        .returning();
      if (!assignment) throw new Error("Negaran assignment insert did not return a row.");
      return assignment;
    },

    async endNegaranAssignment(schoolId, assignmentId, input) {
      const [assignment] = await db
        .select()
        .from(negaranAssignments)
        .where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.id, assignmentId)))
        .limit(1);
      if (!assignment) throw new AcademicNotFoundError("Negaran assignment not found.");
      if (assignment.endDate) throw new AcademicConflictError("This historical Negaran assignment is already closed.");
      if (input.endDate < assignment.startDate) {
        throw new AcademicValidationError("Negaran end date cannot be before its start date.");
      }

      const year = await getYear(schoolId, assignment.academicYearId);
      if (input.endDate > year.endDate) {
        throw new AcademicValidationError("Negaran end date cannot be after the academic year.");
      }

      const [updated] = await db
        .update(negaranAssignments)
        .set({ endDate: input.endDate, updatedAt: new Date() })
        .where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.id, assignmentId)))
        .returning();
      if (!updated) throw new AcademicNotFoundError("Negaran assignment not found.");
      return updated;
    },

    async createTimetablePeriod(schoolId, input) {
      await Promise.all([
        validateClassYear(schoolId, input.academicYearId, input.classId),
        getSubject(schoolId, input.subjectId),
        getTeacher(schoolId, input.teacherUserId)
      ]);

      const [assignment] = await db
        .select({ id: teacherAssignments.id })
        .from(teacherAssignments)
        .where(
          and(
            eq(teacherAssignments.schoolId, schoolId),
            eq(teacherAssignments.academicYearId, input.academicYearId),
            eq(teacherAssignments.classId, input.classId),
            eq(teacherAssignments.subjectId, input.subjectId),
            eq(teacherAssignments.teacherUserId, input.teacherUserId)
          )
        )
        .limit(1);
      if (!assignment) {
        throw new AcademicValidationError("Create the teacher-subject-class assignment before adding its timetable period.");
      }

      const candidates = await db
        .select()
        .from(timetablePeriods)
        .where(
          and(
            eq(timetablePeriods.schoolId, schoolId),
            eq(timetablePeriods.academicYearId, input.academicYearId),
            eq(timetablePeriods.weekday, input.weekday)
          )
        );

      for (const item of candidates) {
        if (!periodsOverlap(item.startsAt, item.endsAt, input.startsAt, input.endsAt)) continue;
        if (item.classId === input.classId) {
          throw new AcademicConflictError("The class already has another timetable period at this time.");
        }
        if (item.teacherUserId === input.teacherUserId) {
          throw new AcademicConflictError("The teacher is already scheduled in another class at this time.");
        }
      }

      const [period] = await db
        .insert(timetablePeriods)
        .values({ id: randomUUID(), schoolId, ...input })
        .returning();
      if (!period) throw new Error("Timetable period insert did not return a row.");
      return period;
    }
  };
}
