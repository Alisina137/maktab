import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import type {
  CreateParentAccountInput,
  CreateStudentInput,
  StudentStatus,
  TeacherImportRow,
  UpdateStudentInput
} from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears,
  classSections,
  feeInvoices,
  gradeRecords,
  parentProfiles,
  studentAttendances,
  studentClassHistory,
  students,
  teacherProfiles,
  users,
  type AcademicYear,
  type ClassSection,
  type ParentProfile,
  type Student,
  type StudentClassHistory,
  type User
} from "./schema.js";

export interface ParentSummary {
  profile: ParentProfile;
  user: User;
  childCount: number;
}

export interface StudentFamilyView {
  student: Student;
  user: User | null;
  classSection: ClassSection;
  academicYear: AcademicYear;
}

export interface StudentEnrollmentView {
  history: StudentClassHistory;
  student: Student;
  user: User | null;
  classSection: ClassSection;
  academicYear: AcademicYear;
}

export interface FamilyOverview {
  parents: ParentSummary[];
  students: StudentFamilyView[];
  enrollments: StudentEnrollmentView[];
}

export interface ParentHome {
  parent: ParentProfile;
  children: StudentFamilyView[];
}

export interface PreparedParentImportRow extends CreateParentAccountInput {
  passwordHash: string;
}

export interface PreparedTeacherImportRow extends TeacherImportRow {
  passwordHash: string;
}

export interface FamilyStore {
  getOverview(schoolId: string): Promise<FamilyOverview>;
  getParentHome(schoolId: string, parentUserId: string): Promise<ParentHome>;
  createParentAccount(
    schoolId: string,
    input: CreateParentAccountInput & { passwordHash: string }
  ): Promise<{ user: User; profile: ParentProfile }>;
  deleteParentAccount(schoolId: string, parentUserId: string): Promise<void>;
  createStudentAccount(
    schoolId: string,
    studentId: string,
    input: { username: string; passwordHash: string }
  ): Promise<{ user: User; student: Student }>;
  createStudent(schoolId: string, input: CreateStudentInput): Promise<Student>;
  updateStudent(schoolId: string, studentId: string, input: UpdateStudentInput): Promise<Student>;
  deleteStudent(schoolId: string, studentId: string): Promise<void>;
  importParents(
    schoolId: string,
    rows: PreparedParentImportRow[]
  ): Promise<Array<{ user: User; profile: ParentProfile }>>;
  importStudents(schoolId: string, rows: CreateStudentInput[]): Promise<Student[]>;
  importTeachers(
    schoolId: string,
    rows: PreparedTeacherImportRow[]
  ): Promise<Array<{ user: User }>>;
}

export class FamilyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FamilyConflictError";
  }
}

export class FamilyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FamilyValidationError";
  }
}

type FamilyTransaction = Parameters<Parameters<FoundationDatabase["transaction"]>[0]>[0];

export class FamilyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FamilyNotFoundError";
  }
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isUniqueError(error: unknown): boolean {
  if (databaseErrorCode(error) === "23505") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate/i.test(message);
}

function isForeignKeyError(error: unknown): boolean {
  return databaseErrorCode(error) === "23503";
}

export function createFamilyStore(db: FoundationDatabase): FamilyStore {
  async function getParent(schoolId: string, parentUserId: string) {
    const [row] = await db
      .select({ profile: parentProfiles, user: users })
      .from(parentProfiles)
      .innerJoin(users, and(eq(users.id, parentProfiles.userId), eq(users.schoolId, parentProfiles.schoolId)))
      .where(and(eq(parentProfiles.schoolId, schoolId), eq(parentProfiles.userId, parentUserId)))
      .limit(1);
    if (!row) throw new FamilyNotFoundError("Parent account not found.");
    if (row.user.role !== "PARENT") throw new FamilyValidationError("Linked account is not a parent.");
    return row;
  }

  async function getClassYear(
    schoolId: string,
    academicYearId: string,
    classId: string
  ): Promise<{ year: AcademicYear; classSection: ClassSection }> {
    const [year] = await db
      .select()
      .from(academicYears)
      .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, academicYearId)))
      .limit(1);
    if (!year) throw new FamilyNotFoundError("Academic year not found.");

    const [classSection] = await db
      .select()
      .from(classSections)
      .where(and(eq(classSections.schoolId, schoolId), eq(classSections.id, classId)))
      .limit(1);
    if (!classSection) throw new FamilyNotFoundError("Class not found.");
    if (classSection.academicYearId !== year.id) {
      throw new FamilyValidationError("The selected class does not belong to the selected academic year.");
    }
    if (year.status === "CLOSED" || year.status === "ARCHIVED") {
      throw new FamilyConflictError("Students cannot be added to a closed or archived academic year.");
    }
    return { year, classSection };
  }

  async function validateParentForStudent(schoolId: string, parentUserId: string) {
    const parent = await getParent(schoolId, parentUserId);
    if (parent.user.status === "SUSPENDED" || parent.user.status === "ARCHIVED") {
      throw new FamilyConflictError("Students must be linked to an available parent account.");
    }
    return parent;
  }

  async function insertStudent(
    tx: FamilyTransaction,
    schoolId: string,
    input: CreateStudentInput
  ): Promise<Student> {
    const [student] = await tx
      .insert(students)
      .values({
        id: randomUUID(),
        schoolId,
        parentUserId: input.parentUserId,
        studentCode: input.studentCode,
        fullName: input.fullName,
        academicYearId: input.academicYearId,
        classId: input.classId,
        status: "ACTIVE"
      })
      .returning();
    if (!student) throw new Error("Student insert did not return a row.");

    await tx.insert(studentClassHistory).values({
      id: randomUUID(),
      schoolId,
      studentId: student.id,
      academicYearId: student.academicYearId,
      classId: student.classId
    });
    return student;
  }

  return {
    async getOverview(schoolId) {
      const [parentRows, studentRows, enrollmentRows] = await Promise.all([
        db
          .select({ profile: parentProfiles, user: users })
          .from(parentProfiles)
          .innerJoin(users, and(eq(users.id, parentProfiles.userId), eq(users.schoolId, parentProfiles.schoolId)))
          .where(eq(parentProfiles.schoolId, schoolId))
          .orderBy(asc(parentProfiles.fullName)),
        db
          .select({ student: students, user: users, classSection: classSections, academicYear: academicYears })
          .from(students)
          .leftJoin(users, and(eq(users.id, students.userId), eq(users.schoolId, students.schoolId)))
          .innerJoin(classSections, and(eq(classSections.id, students.classId), eq(classSections.schoolId, students.schoolId)))
          .innerJoin(academicYears, and(eq(academicYears.id, students.academicYearId), eq(academicYears.schoolId, students.schoolId)))
          .where(eq(students.schoolId, schoolId))
          .orderBy(asc(students.fullName)),
        db
          .select({
            history: studentClassHistory,
            student: students,
            user: users,
            classSection: classSections,
            academicYear: academicYears
          })
          .from(studentClassHistory)
          .innerJoin(students, and(eq(students.id, studentClassHistory.studentId), eq(students.schoolId, studentClassHistory.schoolId)))
          .leftJoin(users, and(eq(users.id, students.userId), eq(users.schoolId, students.schoolId)))
          .innerJoin(classSections, and(eq(classSections.id, studentClassHistory.classId), eq(classSections.schoolId, studentClassHistory.schoolId)))
          .innerJoin(academicYears, and(eq(academicYears.id, studentClassHistory.academicYearId), eq(academicYears.schoolId, studentClassHistory.schoolId)))
          .where(eq(studentClassHistory.schoolId, schoolId))
          .orderBy(asc(students.fullName), asc(studentClassHistory.startedAt))
      ]);

      const counts = new Map<string, number>();
      for (const row of studentRows) {
        counts.set(row.student.parentUserId, (counts.get(row.student.parentUserId) ?? 0) + 1);
      }

      return {
        parents: parentRows.map((row) => ({
          ...row,
          childCount: counts.get(row.profile.userId) ?? 0
        })),
        students: studentRows,
        enrollments: enrollmentRows
      };
    },

    async getParentHome(schoolId, parentUserId) {
      const { profile } = await getParent(schoolId, parentUserId);
      const children = await db
        .select({ student: students, user: users, classSection: classSections, academicYear: academicYears })
        .from(students)
        .leftJoin(users, and(eq(users.id, students.userId), eq(users.schoolId, students.schoolId)))
        .innerJoin(classSections, and(eq(classSections.id, students.classId), eq(classSections.schoolId, students.schoolId)))
        .innerJoin(academicYears, and(eq(academicYears.id, students.academicYearId), eq(academicYears.schoolId, students.schoolId)))
        .where(and(eq(students.schoolId, schoolId), eq(students.parentUserId, parentUserId)))
        .orderBy(asc(students.fullName));
      return { parent: profile, children };
    },

    async createParentAccount(schoolId, input) {
      try {
        return await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({
              id: randomUUID(),
              schoolId,
              username: input.username,
              passwordHash: input.passwordHash,
              role: "PARENT",
              status: "INVITED",
              mustChangePassword: true
            })
            .returning();
          if (!user) throw new Error("Parent user insert did not return a row.");

          const [profile] = await tx
            .insert(parentProfiles)
            .values({
              userId: user.id,
              schoolId,
              fullName: input.fullName,
              phone: input.phone || null
            })
            .returning();
          if (!profile) throw new Error("Parent profile insert did not return a row.");
          return { user, profile };
        });
      } catch (error) {
        if (isUniqueError(error)) throw new FamilyConflictError("This username already exists. Please type another username.");
        throw error;
      }
    },

    async deleteParentAccount(schoolId, parentUserId) {
      await getParent(schoolId, parentUserId);
      const [linkedStudent] = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.parentUserId, parentUserId)))
        .limit(1);

      if (linkedStudent) {
        throw new FamilyConflictError("This parent cannot be deleted because students are linked to the account.");
      }

      await db
        .delete(users)
        .where(and(eq(users.schoolId, schoolId), eq(users.id, parentUserId)));
    },

    async createStudentAccount(schoolId, studentId, input) {
      const [student] = await db
        .select()
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)))
        .limit(1);
      if (!student) throw new FamilyNotFoundError("Student not found.");
      if (student.userId) throw new FamilyConflictError("This student already has a student account.");

      try {
        return await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({
              id: randomUUID(),
              schoolId,
              username: input.username,
              passwordHash: input.passwordHash,
              role: "STUDENT",
              status: "INVITED",
              mustChangePassword: true
            })
            .returning();
          if (!user) throw new Error("Student user insert did not return a row.");

          const [updated] = await tx
            .update(students)
            .set({ userId: user.id, updatedAt: new Date() })
            .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)))
            .returning();
          if (!updated) throw new FamilyNotFoundError("Student not found.");
          return { user, student: updated };
        });
      } catch (error) {
        if (isUniqueError(error)) throw new FamilyConflictError("This username already exists. Please type another username.");
        throw error;
      }
    },

    async createStudent(schoolId, input) {
      try {
        await validateParentForStudent(schoolId, input.parentUserId);
        await getClassYear(schoolId, input.academicYearId, input.classId);
        return await db.transaction((tx) => insertStudent(tx, schoolId, input));
      } catch (error) {
        if (isUniqueError(error)) throw new FamilyConflictError("That student code already exists in this school.");
        if (isForeignKeyError(error)) {
          throw new FamilyConflictError(
            "The selected parent, academic year, or class is no longer available. Refresh the page and try again."
          );
        }
        throw error;
      }
    },

    async updateStudent(schoolId, studentId, input) {
      const [current] = await db
        .select()
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)))
        .limit(1);
      if (!current) throw new FamilyNotFoundError("Student not found.");

      const parentUserId = input.parentUserId ?? current.parentUserId;
      const academicYearId = input.academicYearId ?? current.academicYearId;
      const classId = input.classId ?? current.classId;
      await validateParentForStudent(schoolId, parentUserId);
      await getClassYear(schoolId, academicYearId, classId);

      return db.transaction(async (tx) => {
        const classChanged =
          current.academicYearId !== academicYearId || current.classId !== classId;

        if (classChanged) {
          await tx
            .update(studentClassHistory)
            .set({ endedAt: new Date() })
            .where(
              and(
                eq(studentClassHistory.schoolId, schoolId),
                eq(studentClassHistory.studentId, studentId),
                isNull(studentClassHistory.endedAt)
              )
            );
          await tx.insert(studentClassHistory).values({
            id: randomUUID(),
            schoolId,
            studentId,
            academicYearId,
            classId
          });
        }

        const status: StudentStatus = input.status ?? current.status;
        if (status === "WITHDRAWN") {
          await tx
            .update(studentClassHistory)
            .set({ endedAt: new Date() })
            .where(
              and(
                eq(studentClassHistory.schoolId, schoolId),
                eq(studentClassHistory.studentId, studentId),
                isNull(studentClassHistory.endedAt)
              )
            );
        }

        const [updated] = await tx
          .update(students)
          .set({
            parentUserId,
            academicYearId,
            classId,
            fullName: input.fullName ?? current.fullName,
            status,
            updatedAt: new Date()
          })
          .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)))
          .returning();
        if (!updated) throw new FamilyNotFoundError("Student not found.");
        return updated;
      });
    },

    async deleteStudent(schoolId, studentId) {
      const [student] = await db
        .select()
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)))
        .limit(1);
      if (!student) throw new FamilyNotFoundError("Student not found.");

      const [attendance, grade, invoice] = await Promise.all([
        db
          .select({ id: studentAttendances.id })
          .from(studentAttendances)
          .where(and(eq(studentAttendances.schoolId, schoolId), eq(studentAttendances.studentId, studentId)))
          .limit(1),
        db
          .select({ id: gradeRecords.id })
          .from(gradeRecords)
          .where(and(eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.studentId, studentId)))
          .limit(1),
        db
          .select({ id: feeInvoices.id })
          .from(feeInvoices)
          .where(and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.studentId, studentId)))
          .limit(1)
      ]);

      if (attendance[0] || grade[0] || invoice[0]) {
        throw new FamilyConflictError(
          "This student cannot be deleted because attendance, grade, or fee data is linked to the student."
        );
      }

      await db.transaction(async (tx) => {
        await tx
          .delete(students)
          .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)));

        if (student.userId) {
          await tx
            .delete(users)
            .where(and(eq(users.schoolId, schoolId), eq(users.id, student.userId)));
        }
      });
    },

    async importParents(schoolId, rows) {
      try {
        return await db.transaction(async (tx) => {
          const created: Array<{ user: User; profile: ParentProfile }> = [];
          for (const row of rows) {
            const [user] = await tx
              .insert(users)
              .values({
                id: randomUUID(),
                schoolId,
                username: row.username,
                passwordHash: row.passwordHash,
                role: "PARENT",
                status: "INVITED",
                mustChangePassword: true
              })
              .returning();
            if (!user) throw new Error("Parent user insert did not return a row.");
            const [profile] = await tx
              .insert(parentProfiles)
              .values({
                userId: user.id,
                schoolId,
                fullName: row.fullName,
                phone: row.phone || null
              })
              .returning();
            if (!profile) throw new Error("Parent profile insert did not return a row.");
            created.push({ user, profile });
          }
          return created;
        });
      } catch (error) {
        if (isUniqueError(error)) throw new FamilyConflictError("Import conflicts with an existing parent username.");
        throw error;
      }
    },

    async importStudents(schoolId, rows) {
      try {
        for (const row of rows) {
          await validateParentForStudent(schoolId, row.parentUserId);
          await getClassYear(schoolId, row.academicYearId, row.classId);
        }
        return await db.transaction(async (tx) => {
          const created: Student[] = [];
          for (const row of rows) created.push(await insertStudent(tx, schoolId, row));
          return created;
        });
      } catch (error) {
        if (isUniqueError(error)) throw new FamilyConflictError("Import contains a duplicate or existing student code.");
        throw error;
      }
    },

    async importTeachers(schoolId, rows) {
      try {
        return await db.transaction(async (tx) => {
          const created: Array<{ user: User }> = [];
          for (const row of rows) {
            const [user] = await tx
              .insert(users)
              .values({
                id: randomUUID(),
                schoolId,
                username: row.username,
                passwordHash: row.passwordHash,
                role: "TEACHER",
                status: "INVITED",
                mustChangePassword: true
              })
              .returning();
            if (!user) throw new Error("Teacher user insert did not return a row.");
            await tx.insert(teacherProfiles).values({
              userId: user.id,
              schoolId,
              employeeCode: row.employeeCode,
              fullName: row.fullName,
              phone: row.phone || null
            });
            created.push({ user });
          }
          return created;
        });
      } catch (error) {
        if (isUniqueError(error)) {
          throw new FamilyConflictError("Import conflicts with an existing teacher username or employee code.");
        }
        throw error;
      }
    }
  };
}
