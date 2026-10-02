import { randomUUID } from "node:crypto";
import { and, asc, eq, ne, or } from "drizzle-orm";
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
  EndNegaranAssignmentInput,
  UpdateAcademicYearInput,
  UpdateClassSectionInput,
  UpdateGradeLevelInput,
  UpdateNegaranAssignmentInput,
  UpdateSubjectInput,
  UpdateTeacherAssignmentInput,
  UpdateTeacherProfileInput,
  UpdateTimetablePeriodInput
} from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears,
  announcements,
  classSections,
  dailyAttendances,
  examSubjects,
  exams,
  gradeLevels,
  homeworks,
  negaranAssignments,
  studentClassHistory,
  students,
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

export interface ClassTimetableView {
  period: TimetablePeriod;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
}

export interface AcademicStore {
  getOverview(schoolId: string): Promise<AcademicOverview>;
  getTeacherView(schoolId: string, teacherUserId: string): Promise<TeacherAcademicView>;
  getClassTimetable(
    schoolId: string,
    academicYearId: string,
    classId: string
  ): Promise<ClassTimetableView[]>;
  createAcademicYear(schoolId: string, input: CreateAcademicYearInput): Promise<AcademicYear>;
  updateAcademicYear(schoolId: string, yearId: string, input: UpdateAcademicYearInput): Promise<AcademicYear>;
  setAcademicYearStatus(schoolId: string, yearId: string, status: AcademicYearStatus): Promise<AcademicYear>;
  deleteAcademicYear(schoolId: string, yearId: string): Promise<AcademicYear>;
  createGradeLevel(schoolId: string, input: CreateGradeLevelInput): Promise<GradeLevel>;
  updateGradeLevel(schoolId: string, gradeId: string, input: UpdateGradeLevelInput): Promise<GradeLevel>;
  deleteGradeLevel(schoolId: string, gradeId: string): Promise<GradeLevel>;
  createClassSection(schoolId: string, input: CreateClassSectionInput): Promise<ClassSection>;
  updateClassSection(schoolId: string, classId: string, input: UpdateClassSectionInput): Promise<ClassSection>;
  deleteClassSection(schoolId: string, classId: string): Promise<ClassSection>;
  createSubject(schoolId: string, input: CreateSubjectInput): Promise<Subject>;
  updateSubject(schoolId: string, subjectId: string, input: UpdateSubjectInput): Promise<Subject>;
  deleteSubject(schoolId: string, subjectId: string): Promise<Subject>;
  createTeacherProfile(schoolId: string, input: CreateTeacherProfileInput): Promise<TeacherProfile>;
  updateTeacherProfile(schoolId: string, teacherUserId: string, input: UpdateTeacherProfileInput): Promise<TeacherProfile>;
  deleteTeacherProfile(schoolId: string, teacherUserId: string): Promise<TeacherProfile>;
  createTeacherAssignment(schoolId: string, input: CreateTeacherAssignmentInput): Promise<TeacherAssignment>;
  updateTeacherAssignment(schoolId: string, assignmentId: string, input: UpdateTeacherAssignmentInput): Promise<TeacherAssignment>;
  deleteTeacherAssignment(schoolId: string, assignmentId: string): Promise<TeacherAssignment>;
  createNegaranAssignment(schoolId: string, input: CreateNegaranAssignmentInput): Promise<NegaranAssignment>;
  updateNegaranAssignment(schoolId: string, assignmentId: string, input: UpdateNegaranAssignmentInput): Promise<NegaranAssignment>;
  deleteNegaranAssignment(schoolId: string, assignmentId: string): Promise<NegaranAssignment>;
  endNegaranAssignment(schoolId: string, assignmentId: string, input: EndNegaranAssignmentInput): Promise<NegaranAssignment>;
  createTimetablePeriod(schoolId: string, input: CreateTimetablePeriodInput): Promise<TimetablePeriod>;
  updateTimetablePeriod(schoolId: string, periodId: string, input: UpdateTimetablePeriodInput): Promise<TimetablePeriod>;
  deleteTimetablePeriod(schoolId: string, periodId: string): Promise<TimetablePeriod>;
}

export class AcademicConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicConflictError";
  }
}

export class AcademicDependencyError extends AcademicConflictError {
  dependencies: string[];

  constructor(message: string, dependencies: string[]) {
    super(message);
    this.name = "AcademicDependencyError";
    this.dependencies = dependencies;
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

function databaseErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  if ("cause" in error) {
    return databaseErrorCode((error as { cause?: unknown }).cause);
  }
  return null;
}

function databaseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const causeMessage =
      "cause" in error ? databaseErrorMessage((error as Error & { cause?: unknown }).cause) : "";
    return [error.message, causeMessage].filter(Boolean).join(" ");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error ?? "");
}

function isUniqueError(error: unknown): boolean {
  return databaseErrorCode(error) === "23505" || /unique|duplicate/i.test(databaseErrorMessage(error));
}

function isForeignKeyError(error: unknown): boolean {
  return databaseErrorCode(error) === "23503" || /foreign key/i.test(databaseErrorMessage(error));
}


function dependencyNames(entries: Array<[string, unknown[]]>): string[] {
  return entries.filter(([, rows]) => rows.length > 0).map(([name]) => name);
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

  async function getAssignment(schoolId: string, assignmentId: string): Promise<TeacherAssignment> {
    const [assignment] = await db
      .select()
      .from(teacherAssignments)
      .where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.id, assignmentId)))
      .limit(1);
    if (!assignment) throw new AcademicNotFoundError("Teacher assignment not found.");
    return assignment;
  }

  async function getNegaran(schoolId: string, assignmentId: string): Promise<NegaranAssignment> {
    const [assignment] = await db
      .select()
      .from(negaranAssignments)
      .where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.id, assignmentId)))
      .limit(1);
    if (!assignment) throw new AcademicNotFoundError("Negaran assignment not found.");
    return assignment;
  }

  async function getTimetablePeriod(schoolId: string, periodId: string): Promise<TimetablePeriod> {
    const [period] = await db
      .select()
      .from(timetablePeriods)
      .where(and(eq(timetablePeriods.schoolId, schoolId), eq(timetablePeriods.id, periodId)))
      .limit(1);
    if (!period) throw new AcademicNotFoundError("Timetable period not found.");
    return period;
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

    async getClassTimetable(schoolId, academicYearId, classId) {
      await validateClassYear(schoolId, academicYearId, classId);
      return db
        .select({
          period: timetablePeriods,
          subjectName: subjects.name,
          subjectCode: subjects.code,
          teacherName: teacherProfiles.fullName
        })
        .from(timetablePeriods)
        .innerJoin(
          subjects,
          and(
            eq(subjects.id, timetablePeriods.subjectId),
            eq(subjects.schoolId, timetablePeriods.schoolId)
          )
        )
        .innerJoin(
          teacherProfiles,
          and(
            eq(teacherProfiles.userId, timetablePeriods.teacherUserId),
            eq(teacherProfiles.schoolId, timetablePeriods.schoolId)
          )
        )
        .where(
          and(
            eq(timetablePeriods.schoolId, schoolId),
            eq(timetablePeriods.academicYearId, academicYearId),
            eq(timetablePeriods.classId, classId)
          )
        )
        .orderBy(asc(timetablePeriods.weekday), asc(timetablePeriods.startsAt));
    },

    async createAcademicYear(schoolId, input) {
      const [existing] = await db
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.name, input.name)))
        .limit(1);
      if (existing) {
        throw new AcademicConflictError(
          "Duplicate academic years are not allowed. An academic year with that name already exists in this school."
        );
      }

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
        if (isUniqueError(error)) {
          throw new AcademicConflictError(
            "Duplicate academic years are not allowed. An academic year with that name already exists in this school."
          );
        }
        throw error;
      }
    },

    async updateAcademicYear(schoolId, yearId, input) {
      const current = await getYear(schoolId, yearId);
      if (current.status !== "DRAFT") {
        throw new AcademicConflictError("Only draft academic years can be edited.");
      }
      const negarans = await db
        .select({ startDate: negaranAssignments.startDate, endDate: negaranAssignments.endDate })
        .from(negaranAssignments)
        .where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.academicYearId, yearId)));
      if (negarans.some((item) =>
        item.startDate < input.startDate ||
        item.startDate > input.endDate ||
        (item.endDate !== null && item.endDate > input.endDate)
      )) {
        throw new AcademicConflictError("Academic year dates cannot exclude existing Negaran assignment dates.");
      }
      const [duplicate] = await db
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(
          and(
            eq(academicYears.schoolId, schoolId),
            eq(academicYears.name, input.name),
            ne(academicYears.id, yearId)
          )
        )
        .limit(1);
      if (duplicate) {
        throw new AcademicConflictError(
          "Duplicate academic years are not allowed. An academic year with that name already exists in this school."
        );
      }

      try {
        const [updated] = await db
          .update(academicYears)
          .set({ ...input, updatedAt: new Date() })
          .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, yearId)))
          .returning();
        if (!updated) throw new AcademicNotFoundError("Academic year not found.");
        return updated;
      } catch (error) {
        if (isUniqueError(error)) {
          throw new AcademicConflictError(
            "Duplicate academic years are not allowed. An academic year with that name already exists in this school."
          );
        }
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
        ARCHIVED: ["CLOSED"]
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

    async deleteAcademicYear(schoolId, yearId) {
      const year = await getYear(schoolId, yearId);
      if (year.status !== "ARCHIVED") {
        throw new AcademicConflictError("Only archived academic years can be deleted.");
      }

      const [
        classes,
        currentStudents,
        enrollmentHistory,
        assignments,
        negarans,
        timetable,
        attendance,
        homeworkRows,
        examRows
      ] = await Promise.all([
        db.select({ id: classSections.id }).from(classSections)
          .where(and(eq(classSections.schoolId, schoolId), eq(classSections.academicYearId, yearId))).limit(1),
        db.select({ id: students.id }).from(students)
          .where(and(eq(students.schoolId, schoolId), eq(students.academicYearId, yearId))).limit(1),
        db.select({ id: studentClassHistory.id }).from(studentClassHistory)
          .where(and(eq(studentClassHistory.schoolId, schoolId), eq(studentClassHistory.academicYearId, yearId))).limit(1),
        db.select({ id: teacherAssignments.id }).from(teacherAssignments)
          .where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.academicYearId, yearId))).limit(1),
        db.select({ id: negaranAssignments.id }).from(negaranAssignments)
          .where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.academicYearId, yearId))).limit(1),
        db.select({ id: timetablePeriods.id }).from(timetablePeriods)
          .where(and(eq(timetablePeriods.schoolId, schoolId), eq(timetablePeriods.academicYearId, yearId))).limit(1),
        db.select({ id: dailyAttendances.id }).from(dailyAttendances)
          .where(and(eq(dailyAttendances.schoolId, schoolId), eq(dailyAttendances.academicYearId, yearId))).limit(1),
        db.select({ id: homeworks.id }).from(homeworks)
          .where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.academicYearId, yearId))).limit(1),
        db.select({ id: exams.id }).from(exams)
          .where(and(eq(exams.schoolId, schoolId), eq(exams.academicYearId, yearId))).limit(1)
      ]);

      const dependencies = dependencyNames([
        ["Classes", classes],
        ["Students", currentStudents],
        ["Student enrollment history", enrollmentHistory],
        ["Teacher assignments", assignments],
        ["Negaran assignments", negarans],
        ["Timetable periods", timetable],
        ["Attendance records", attendance],
        ["Homework", homeworkRows],
        ["Exams", examRows]
      ]);
      if (dependencies.length > 0) {
        throw new AcademicDependencyError(
          "This academic year cannot be deleted because it is used by:",
          dependencies
        );
      }

      try {
        const [deleted] = await db
          .delete(academicYears)
          .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, yearId)))
          .returning();
        if (!deleted) throw new AcademicNotFoundError("Academic year not found.");
        return deleted;
      } catch (error) {
        if (isForeignKeyError(error)) {
          throw new AcademicDependencyError(
            "This academic year cannot be deleted because it is used by:",
            ["Other linked school records"]
          );
        }
        throw error;
      }
    },

    async createGradeLevel(schoolId, input) {
      const [existing] = await db
        .select({ id: gradeLevels.id })
        .from(gradeLevels)
        .where(
          and(
            eq(gradeLevels.schoolId, schoolId),
            or(eq(gradeLevels.code, input.code), eq(gradeLevels.name, input.name))
          )
        )
        .limit(1);
      if (existing) {
        throw new AcademicConflictError(
          "Duplicate grade levels are not allowed. A grade with that code or name already exists in this school."
        );
      }

      try {
        const [grade] = await db
          .insert(gradeLevels)
          .values({ id: randomUUID(), schoolId, ...input })
          .returning();
        if (!grade) throw new Error("Grade level insert did not return a row.");
        return grade;
      } catch (error) {
        if (isUniqueError(error)) {
          throw new AcademicConflictError(
            "Duplicate grade levels are not allowed. A grade with that code or name already exists in this school."
          );
        }
        throw error;
      }
    },

    async updateGradeLevel(schoolId, gradeId, input) {
      await getGrade(schoolId, gradeId);
      const [duplicate] = await db
        .select({ id: gradeLevels.id })
        .from(gradeLevels)
        .where(
          and(
            eq(gradeLevels.schoolId, schoolId),
            ne(gradeLevels.id, gradeId),
            or(eq(gradeLevels.code, input.code), eq(gradeLevels.name, input.name))
          )
        )
        .limit(1);
      if (duplicate) {
        throw new AcademicConflictError(
          "Duplicate grade levels are not allowed. A grade with that code or name already exists in this school."
        );
      }

      try {
        const [updated] = await db
          .update(gradeLevels)
          .set({ ...input, updatedAt: new Date() })
          .where(and(eq(gradeLevels.schoolId, schoolId), eq(gradeLevels.id, gradeId)))
          .returning();
        if (!updated) throw new AcademicNotFoundError("Grade level not found.");
        return updated;
      } catch (error) {
        if (isUniqueError(error)) {
          throw new AcademicConflictError(
            "Duplicate grade levels are not allowed. A grade with that code or name already exists in this school."
          );
        }
        throw error;
      }
    },

    async deleteGradeLevel(schoolId, gradeId) {
      const grade = await getGrade(schoolId, gradeId);
      const classes = await db
        .select({ id: classSections.id })
        .from(classSections)
        .where(and(eq(classSections.schoolId, schoolId), eq(classSections.gradeLevelId, gradeId)))
        .limit(1);

      const dependencies = dependencyNames([["Classes", classes]]);
      if (dependencies.length > 0) {
        throw new AcademicDependencyError(
          "This grade cannot be deleted because it is used by:",
          dependencies
        );
      }

      try {
        const [deleted] = await db
          .delete(gradeLevels)
          .where(and(eq(gradeLevels.schoolId, schoolId), eq(gradeLevels.id, gradeId)))
          .returning();
        if (!deleted) throw new AcademicNotFoundError("Grade level not found.");
        return deleted;
      } catch (error) {
        if (isForeignKeyError(error)) {
          throw new AcademicDependencyError(
            "This grade cannot be deleted because it is used by:",
            ["Classes"]
          );
        }
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

    async updateClassSection(schoolId, classId, input) {
      const current = await getClass(schoolId, classId);
      const year = await getYear(schoolId, current.academicYearId);
      requireMutableYear(year);
      if (input.academicYearId !== current.academicYearId) {
        throw new AcademicConflictError("A class cannot be moved to another academic year.");
      }
      await getGrade(schoolId, input.gradeLevelId);
      try {
        const [updated] = await db
          .update(classSections)
          .set({
            gradeLevelId: input.gradeLevelId,
            code: input.code,
            name: input.name,
            updatedAt: new Date()
          })
          .where(and(eq(classSections.schoolId, schoolId), eq(classSections.id, classId)))
          .returning();
        if (!updated) throw new AcademicNotFoundError("Class not found.");
        return updated;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("That class code already exists in the academic year.");
        throw error;
      }
    },

    async deleteClassSection(schoolId, classId) {
      const classSection = await getClass(schoolId, classId);
      const year = await getYear(schoolId, classSection.academicYearId);
      requireMutableYear(year);

      const [
        currentStudents,
        enrollmentHistory,
        assignments,
        negarans,
        timetable,
        attendance,
        homeworkRows,
        examRows,
        announcementRows
      ] = await Promise.all([
        db.select({ id: students.id }).from(students).where(and(eq(students.schoolId, schoolId), eq(students.classId, classId))).limit(1),
        db.select({ id: studentClassHistory.id }).from(studentClassHistory).where(and(eq(studentClassHistory.schoolId, schoolId), eq(studentClassHistory.classId, classId))).limit(1),
        db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.classId, classId))).limit(1),
        db.select({ id: negaranAssignments.id }).from(negaranAssignments).where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.classId, classId))).limit(1),
        db.select({ id: timetablePeriods.id }).from(timetablePeriods).where(and(eq(timetablePeriods.schoolId, schoolId), eq(timetablePeriods.classId, classId))).limit(1),
        db.select({ id: dailyAttendances.id }).from(dailyAttendances).where(and(eq(dailyAttendances.schoolId, schoolId), eq(dailyAttendances.classId, classId))).limit(1),
        db.select({ id: homeworks.id }).from(homeworks).where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.classId, classId))).limit(1),
        db.select({ id: examSubjects.id }).from(examSubjects).where(and(eq(examSubjects.schoolId, schoolId), eq(examSubjects.classId, classId))).limit(1),
        db.select({ id: announcements.id }).from(announcements).where(and(eq(announcements.schoolId, schoolId), eq(announcements.classId, classId))).limit(1)
      ]);

      const dependencies = dependencyNames([
        ["Students", currentStudents],
        ["Student enrollment history", enrollmentHistory],
        ["Teacher assignments", assignments],
        ["Negaran assignments", negarans],
        ["Timetable periods", timetable],
        ["Attendance records", attendance],
        ["Homework", homeworkRows],
        ["Exam subjects", examRows],
        ["Announcements", announcementRows]
      ]);
      if (dependencies.length > 0) {
        throw new AcademicDependencyError(
          "This class cannot be deleted because it is used by:",
          dependencies
        );
      }

      try {
        const [deleted] = await db
          .delete(classSections)
          .where(and(eq(classSections.schoolId, schoolId), eq(classSections.id, classId)))
          .returning();
        if (!deleted) throw new AcademicNotFoundError("Class not found.");
        return deleted;
      } catch (error) {
        if (isForeignKeyError(error)) {
          throw new AcademicDependencyError(
            "This class cannot be deleted because it is used by:",
            ["Other linked school records"]
          );
        }
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

    async updateSubject(schoolId, subjectId, input) {
      await getSubject(schoolId, subjectId);
      try {
        const [updated] = await db
          .update(subjects)
          .set({ ...input, updatedAt: new Date() })
          .where(and(eq(subjects.schoolId, schoolId), eq(subjects.id, subjectId)))
          .returning();
        if (!updated) throw new AcademicNotFoundError("Subject not found.");
        return updated;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("That subject code or name already exists.");
        throw error;
      }
    },

    async deleteSubject(schoolId, subjectId) {
      const subject = await getSubject(schoolId, subjectId);
      const [assignments, timetable, homeworkRows, examRows] = await Promise.all([
        db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.subjectId, subjectId))).limit(1),
        db.select({ id: timetablePeriods.id }).from(timetablePeriods).where(and(eq(timetablePeriods.schoolId, schoolId), eq(timetablePeriods.subjectId, subjectId))).limit(1),
        db.select({ id: homeworks.id }).from(homeworks).where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.subjectId, subjectId))).limit(1),
        db.select({ id: examSubjects.id }).from(examSubjects).where(and(eq(examSubjects.schoolId, schoolId), eq(examSubjects.subjectId, subjectId))).limit(1)
      ]);

      const dependencies = dependencyNames([
        ["Teacher assignments", assignments],
        ["Timetable periods", timetable],
        ["Homework", homeworkRows],
        ["Exam subjects", examRows]
      ]);
      if (dependencies.length > 0) {
        throw new AcademicDependencyError(
          "This subject cannot be deleted because it is used by:",
          dependencies
        );
      }

      try {
        const [deleted] = await db
          .delete(subjects)
          .where(and(eq(subjects.schoolId, schoolId), eq(subjects.id, subjectId)))
          .returning();
        if (!deleted) throw new AcademicNotFoundError("Subject not found.");
        return deleted;
      } catch (error) {
        if (isForeignKeyError(error)) {
          throw new AcademicDependencyError(
            "This subject cannot be deleted because it is used by:",
            ["Other linked school records"]
          );
        }
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

    async updateTeacherProfile(schoolId, teacherUserId, input) {
      await getTeacher(schoolId, teacherUserId);
      try {
        const [updated] = await db
          .update(teacherProfiles)
          .set({
            employeeCode: input.employeeCode,
            fullName: input.fullName,
            phone: input.phone ?? null,
            updatedAt: new Date()
          })
          .where(and(eq(teacherProfiles.schoolId, schoolId), eq(teacherProfiles.userId, teacherUserId)))
          .returning();
        if (!updated) throw new AcademicNotFoundError("Teacher profile not found.");
        return updated;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("That teacher employee code already exists.");
        throw error;
      }
    },

    async deleteTeacherProfile(schoolId, teacherUserId) {
      const teacher = await getTeacher(schoolId, teacherUserId);
      const [assignments, negarans, timetable, homeworkRows] = await Promise.all([
        db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.teacherUserId, teacherUserId))).limit(1),
        db.select({ id: negaranAssignments.id }).from(negaranAssignments).where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.teacherUserId, teacherUserId))).limit(1),
        db.select({ id: timetablePeriods.id }).from(timetablePeriods).where(and(eq(timetablePeriods.schoolId, schoolId), eq(timetablePeriods.teacherUserId, teacherUserId))).limit(1),
        db.select({ id: homeworks.id }).from(homeworks).where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.teacherUserId, teacherUserId))).limit(1)
      ]);

      const dependencies = dependencyNames([
        ["Teacher assignments", assignments],
        ["Negaran assignments", negarans],
        ["Timetable periods", timetable],
        ["Homework", homeworkRows]
      ]);
      if (dependencies.length > 0) {
        throw new AcademicDependencyError(
          "This teacher profile cannot be deleted because it is used by:",
          dependencies
        );
      }

      try {
        const [deleted] = await db
          .delete(teacherProfiles)
          .where(and(eq(teacherProfiles.schoolId, schoolId), eq(teacherProfiles.userId, teacherUserId)))
          .returning();
        if (!deleted) throw new AcademicNotFoundError("Teacher profile not found.");
        return deleted;
      } catch (error) {
        if (isForeignKeyError(error)) {
          throw new AcademicDependencyError(
            "This teacher profile cannot be deleted because it is used by:",
            ["Other linked school records"]
          );
        }
        throw error;
      }
    },

    async createTeacherAssignment(schoolId, input) {
      await Promise.all([
        validateClassYear(schoolId, input.academicYearId, input.classId),
        getSubject(schoolId, input.subjectId),
        getTeacher(schoolId, input.teacherUserId)
      ]);

      const [occupiedSlot] = await db
        .select({ id: teacherAssignments.id })
        .from(teacherAssignments)
        .where(and(
          eq(teacherAssignments.schoolId, schoolId),
          eq(teacherAssignments.academicYearId, input.academicYearId),
          eq(teacherAssignments.classId, input.classId),
          eq(teacherAssignments.subjectId, input.subjectId)
        ))
        .limit(1);
      if (occupiedSlot) {
        throw new AcademicConflictError("This class and subject already have a teacher assigned.");
      }

      try {
        const [assignment] = await db
          .insert(teacherAssignments)
          .values({ id: randomUUID(), schoolId, ...input })
          .returning();
        if (!assignment) throw new Error("Teacher assignment insert did not return a row.");
        return assignment;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("This class and subject already have a teacher assigned.");
        throw error;
      }
    },

    async updateTeacherAssignment(schoolId, assignmentId, input) {
      const current = await getAssignment(schoolId, assignmentId);
      const year = await getYear(schoolId, current.academicYearId);
      requireMutableYear(year);
      if (input.academicYearId !== current.academicYearId) {
        throw new AcademicConflictError("A teacher assignment cannot be moved to another academic year.");
      }
      const refs = await Promise.all([
        db.select({ id: homeworks.id }).from(homeworks).where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.assignmentId, assignmentId))).limit(1),
        db.select({ id: timetablePeriods.id }).from(timetablePeriods).where(and(
          eq(timetablePeriods.schoolId, schoolId),
          eq(timetablePeriods.academicYearId, current.academicYearId),
          eq(timetablePeriods.teacherUserId, current.teacherUserId),
          eq(timetablePeriods.subjectId, current.subjectId),
          eq(timetablePeriods.classId, current.classId)
        )).limit(1)
      ]);
      if (refs.some((rows) => rows.length > 0)) {
        throw new AcademicConflictError("Remove dependent homework or timetable periods before editing this teacher assignment.");
      }
      await Promise.all([
        validateClassYear(schoolId, input.academicYearId, input.classId),
        getSubject(schoolId, input.subjectId),
        getTeacher(schoolId, input.teacherUserId)
      ]);
      const [occupiedSlot] = await db
        .select({ id: teacherAssignments.id })
        .from(teacherAssignments)
        .where(and(
          eq(teacherAssignments.schoolId, schoolId),
          eq(teacherAssignments.academicYearId, input.academicYearId),
          eq(teacherAssignments.classId, input.classId),
          eq(teacherAssignments.subjectId, input.subjectId),
          ne(teacherAssignments.id, assignmentId)
        ))
        .limit(1);
      if (occupiedSlot) {
        throw new AcademicConflictError("This class and subject already have a teacher assigned.");
      }
      try {
        const [updated] = await db
          .update(teacherAssignments)
          .set({
            classId: input.classId,
            subjectId: input.subjectId,
            teacherUserId: input.teacherUserId
          })
          .where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.id, assignmentId)))
          .returning();
        if (!updated) throw new AcademicNotFoundError("Teacher assignment not found.");
        return updated;
      } catch (error) {
        if (isUniqueError(error)) throw new AcademicConflictError("This class and subject already have a teacher assigned.");
        throw error;
      }
    },

    async deleteTeacherAssignment(schoolId, assignmentId) {
      const assignment = await getAssignment(schoolId, assignmentId);
      const year = await getYear(schoolId, assignment.academicYearId);
      requireMutableYear(year);

      const [homeworkRows, timetable] = await Promise.all([
        db.select({ id: homeworks.id }).from(homeworks).where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.assignmentId, assignmentId))).limit(1),
        db.select({ id: timetablePeriods.id }).from(timetablePeriods).where(and(
          eq(timetablePeriods.schoolId, schoolId),
          eq(timetablePeriods.academicYearId, assignment.academicYearId),
          eq(timetablePeriods.teacherUserId, assignment.teacherUserId),
          eq(timetablePeriods.subjectId, assignment.subjectId),
          eq(timetablePeriods.classId, assignment.classId)
        )).limit(1)
      ]);

      const dependencies = dependencyNames([
        ["Homework", homeworkRows],
        ["Timetable periods", timetable]
      ]);
      if (dependencies.length > 0) {
        throw new AcademicDependencyError(
          "This teacher assignment cannot be deleted because it is used by:",
          dependencies
        );
      }

      try {
        const [deleted] = await db
          .delete(teacherAssignments)
          .where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.id, assignmentId)))
          .returning();
        if (!deleted) throw new AcademicNotFoundError("Teacher assignment not found.");
        return deleted;
      } catch (error) {
        if (isForeignKeyError(error)) {
          throw new AcademicDependencyError(
            "This teacher assignment cannot be deleted because it is used by:",
            ["Other linked school records"]
          );
        }
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
        .where(and(
          eq(negaranAssignments.schoolId, schoolId),
          eq(negaranAssignments.academicYearId, input.academicYearId),
          or(
            eq(negaranAssignments.classId, input.classId),
            eq(negaranAssignments.teacherUserId, input.teacherUserId)
          )
        ));

      const overlap = existing.find((item) =>
        dateRangesOverlap(item.startDate, item.endDate, input.startDate, input.endDate ?? null)
      );
      if (overlap?.classId === input.classId) {
        throw new AcademicConflictError("This class already has a Negaran during the selected date range.");
      }
      if (overlap?.teacherUserId === input.teacherUserId) {
        throw new AcademicConflictError("This teacher is already Negaran for another class during the selected date range.");
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

    async updateNegaranAssignment(schoolId, assignmentId, input) {
      const current = await getNegaran(schoolId, assignmentId);
      const year = await getYear(schoolId, current.academicYearId);
      requireMutableYear(year);
      if (input.academicYearId !== current.academicYearId) {
        throw new AcademicConflictError("A Negaran assignment cannot be moved to another academic year.");
      }
      await Promise.all([
        validateClassYear(schoolId, input.academicYearId, input.classId),
        getTeacher(schoolId, input.teacherUserId)
      ]);
      if (
        input.startDate < year.startDate ||
        input.startDate > year.endDate ||
        (input.endDate && (input.endDate < input.startDate || input.endDate > year.endDate))
      ) {
        throw new AcademicValidationError("Negaran assignment dates must fall inside the academic year.");
      }
      const overlaps = await db
        .select({
          id: negaranAssignments.id,
          classId: negaranAssignments.classId,
          teacherUserId: negaranAssignments.teacherUserId,
          startDate: negaranAssignments.startDate,
          endDate: negaranAssignments.endDate
        })
        .from(negaranAssignments)
        .where(and(
          eq(negaranAssignments.schoolId, schoolId),
          eq(negaranAssignments.academicYearId, input.academicYearId),
          or(
            eq(negaranAssignments.classId, input.classId),
            eq(negaranAssignments.teacherUserId, input.teacherUserId)
          ),
          ne(negaranAssignments.id, assignmentId)
        ));
      const overlap = overlaps.find((row) =>
        dateRangesOverlap(input.startDate, input.endDate ?? null, row.startDate, row.endDate)
      );
      if (overlap?.classId === input.classId) {
        throw new AcademicConflictError("This class already has an overlapping Negaran assignment.");
      }
      if (overlap?.teacherUserId === input.teacherUserId) {
        throw new AcademicConflictError("This teacher is already Negaran for another class during the selected date range.");
      }
      const [updated] = await db
        .update(negaranAssignments)
        .set({
          classId: input.classId,
          teacherUserId: input.teacherUserId,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          updatedAt: new Date()
        })
        .where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.id, assignmentId)))
        .returning();
      if (!updated) throw new AcademicNotFoundError("Negaran assignment not found.");
      return updated;
    },

    async deleteNegaranAssignment(schoolId, assignmentId) {
      const assignment = await getNegaran(schoolId, assignmentId);
      const year = await getYear(schoolId, assignment.academicYearId);
      if (year.status !== "DRAFT") {
        throw new AcademicConflictError("Only draft-year Negaran assignments can be deleted. End the assignment instead.");
      }

      try {
        const [deleted] = await db
          .delete(negaranAssignments)
          .where(and(eq(negaranAssignments.schoolId, schoolId), eq(negaranAssignments.id, assignmentId)))
          .returning();
        if (!deleted) throw new AcademicNotFoundError("Negaran assignment not found.");
        return deleted;
      } catch (error) {
        if (isForeignKeyError(error)) {
          throw new AcademicDependencyError(
            "This Negaran assignment cannot be deleted because it is used by:",
            ["Other linked school records"]
          );
        }
        throw error;
      }
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
    },

    async updateTimetablePeriod(schoolId, periodId, input) {
      const current = await getTimetablePeriod(schoolId, periodId);
      const year = await getYear(schoolId, current.academicYearId);
      requireMutableYear(year);
      if (input.academicYearId !== current.academicYearId) {
        throw new AcademicConflictError("A timetable period cannot be moved to another academic year.");
      }
      await Promise.all([
        validateClassYear(schoolId, input.academicYearId, input.classId),
        getSubject(schoolId, input.subjectId),
        getTeacher(schoolId, input.teacherUserId)
      ]);
      const [assignment] = await db
        .select({ id: teacherAssignments.id })
        .from(teacherAssignments)
        .where(and(
          eq(teacherAssignments.schoolId, schoolId),
          eq(teacherAssignments.academicYearId, input.academicYearId),
          eq(teacherAssignments.classId, input.classId),
          eq(teacherAssignments.subjectId, input.subjectId),
          eq(teacherAssignments.teacherUserId, input.teacherUserId)
        ))
        .limit(1);
      if (!assignment) {
        throw new AcademicValidationError("Timetable period requires an existing matching teacher assignment.");
      }
      const conflicts = await db
        .select()
        .from(timetablePeriods)
        .where(and(
          eq(timetablePeriods.schoolId, schoolId),
          eq(timetablePeriods.academicYearId, input.academicYearId),
          eq(timetablePeriods.weekday, input.weekday),
          ne(timetablePeriods.id, periodId)
        ));
      for (const row of conflicts) {
        if (!periodsOverlap(input.startsAt, input.endsAt, row.startsAt, row.endsAt)) continue;
        if (row.classId === input.classId) {
          throw new AcademicConflictError("The class already has another timetable period at that time.");
        }
        if (row.teacherUserId === input.teacherUserId) {
          throw new AcademicConflictError("The teacher already has another timetable period at that time.");
        }
      }
      const [updated] = await db
        .update(timetablePeriods)
        .set({
          classId: input.classId,
          subjectId: input.subjectId,
          teacherUserId: input.teacherUserId,
          weekday: input.weekday,
          startsAt: input.startsAt,
          endsAt: input.endsAt
        })
        .where(and(eq(timetablePeriods.schoolId, schoolId), eq(timetablePeriods.id, periodId)))
        .returning();
      if (!updated) throw new AcademicNotFoundError("Timetable period not found.");
      return updated;
    },

    async deleteTimetablePeriod(schoolId, periodId) {
      const period = await getTimetablePeriod(schoolId, periodId);
      const year = await getYear(schoolId, period.academicYearId);
      requireMutableYear(year);

      try {
        const [deleted] = await db
          .delete(timetablePeriods)
          .where(and(eq(timetablePeriods.schoolId, schoolId), eq(timetablePeriods.id, periodId)))
          .returning();
        if (!deleted) throw new AcademicNotFoundError("Timetable period not found.");
        return deleted;
      } catch (error) {
        if (isForeignKeyError(error)) {
          throw new AcademicDependencyError(
            "This timetable period cannot be deleted because it is used by:",
            ["Other linked school records"]
          );
        }
        throw error;
      }
    }
  };
}
