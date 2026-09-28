import type { FastifyInstance, FastifyReply } from "fastify";
import {
  bulkImportEntitySchema,
  createParentAccountSchema,
  createSchoolUserSchema,
  createStudentSchema,
  teacherImportRowSchema,
  updateStudentSchema,
  type BulkImportEntity
} from "@maktablink/contracts";
import {
  FamilyConflictError,
  FamilyNotFoundError,
  FamilyValidationError,
  type AcademicStore,
  type AccountStore,
  type FamilyStore
} from "@maktablink/database";
import { z, ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { generateTemporaryPassword, hashPassword } from "../auth/security.js";
import { safeUser } from "../auth/session.js";
import { requireSchoolAdmin } from "../users/routes.js";
import { ImportFileError, parseTabularFile } from "./import-file.js";

const previewSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  contentBase64: z.string().min(1).max(8_000_000)
});

const rowSchema = z.record(z.string(), z.string());
const validateSchema = z.object({
  entityType: bulkImportEntitySchema,
  rows: z.array(rowSchema).min(1).max(1000),
  mapping: z.record(z.string(), z.string())
});
const commitSchema = z.object({
  entityType: bulkImportEntitySchema,
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000)
});

type ImportErrorRow = { row: number; field?: string; message: string };

function sendFamilyError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
  if (error instanceof ImportFileError || error instanceof FamilyValidationError) {
    return reply.code(400).send({ error: "family_validation", message: error.message });
  }
  if (error instanceof FamilyNotFoundError) {
    return reply.code(404).send({ error: "not_found", message: error.message });
  }
  if (error instanceof FamilyConflictError) {
    return reply.code(409).send({ error: "family_conflict", message: error.message });
  }
  throw error;
}

function mapped(row: Record<string, string>, mapping: Record<string, string>, field: string): string {
  const column = mapping[field];
  return column ? String(row[column] ?? "").trim() : "";
}

export function registerFamilyRoutes(
  app: FastifyInstance,
  accounts: AccountStore,
  academics: AcademicStore,
  families: FamilyStore
) {
  app.get("/v1/admin/families", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    return families.getOverview(context.user.schoolId);
  });

  app.post("/v1/admin/families/parents", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createParentAccountSchema.parse(request.body);
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      const created = await families.createParentAccount(context.user.schoolId, {
        ...input,
        passwordHash
      });
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "parent.created",
        entityType: "parent_profile",
        entityId: created.user.id,
        metadata: { username: created.user.username, fullName: created.profile.fullName }
      });
      return reply.code(201).send({
        user: safeUser(created.user),
        profile: created.profile,
        temporaryPassword
      });
    } catch (error) {
      return sendFamilyError(reply, error);
    }
  });

  app.post("/v1/admin/families/students", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createStudentSchema.parse(request.body);
      const student = await families.createStudent(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "student.created",
        entityType: "student",
        entityId: student.id,
        metadata: {
          studentCode: student.studentCode,
          parentUserId: student.parentUserId,
          classId: student.classId,
          academicYearId: student.academicYearId
        }
      });
      return reply.code(201).send({ student });
    } catch (error) {
      return sendFamilyError(reply, error);
    }
  });

  app.patch<{ Params: { studentId: string } }>(
    "/v1/admin/families/students/:studentId",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const input = updateStudentSchema.parse(request.body);
        const student = await families.updateStudent(
          context.user.schoolId,
          request.params.studentId,
          input
        );
        await accounts.writeAudit({
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "student.updated",
          entityType: "student",
          entityId: student.id,
          metadata: {
            parentUserId: student.parentUserId,
            classId: student.classId,
            academicYearId: student.academicYearId,
            status: student.status
          }
        });
        return { student };
      } catch (error) {
        return sendFamilyError(reply, error);
      }
    }
  );

  app.get("/v1/parent/home", async (request, reply) => {
    const context = await requireAccess(request, reply, accounts);
    if (!context) return;
    if (context.user.mustChangePassword) {
      return reply.code(403).send({
        error: "password_change_required",
        message: "Change the temporary password before using parent features."
      });
    }
    if (context.user.role !== "PARENT") {
      return reply.code(403).send({ error: "forbidden", message: "Parent access is required." });
    }
    try {
      return await families.getParentHome(context.user.schoolId, context.user.id);
    } catch (error) {
      return sendFamilyError(reply, error);
    }
  });

  app.post("/v1/admin/families/import/preview", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = previewSchema.parse(request.body);
      return parseTabularFile(input.fileName, input.contentBase64);
    } catch (error) {
      return sendFamilyError(reply, error);
    }
  });

  app.post("/v1/admin/families/import/validate", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = validateSchema.parse(request.body);
      const [familyOverview, academicOverview, schoolUsers] = await Promise.all([
        families.getOverview(context.user.schoolId),
        academics.getOverview(context.user.schoolId),
        accounts.listUsers(context.user.schoolId)
      ]);
      const errors: ImportErrorRow[] = [];
      const normalizedRows: Array<Record<string, string>> = [];
      const existingUsernames = new Set(schoolUsers.map((user) => user.username.toLowerCase()));
      const existingStudentCodes = new Set(
        familyOverview.students.map((item) => item.student.studentCode.toUpperCase())
      );
      const existingEmployeeCodes = new Set(
        academicOverview.teachers.map((teacher) => teacher.employeeCode.toUpperCase())
      );
      const parentByUsername = new Map(
        familyOverview.parents.map((parent) => [parent.user.username.toLowerCase(), parent])
      );
      const seenUsernames = new Set<string>();
      const seenStudentCodes = new Set<string>();
      const seenEmployeeCodes = new Set<string>();

      for (let index = 0; index < input.rows.length; index += 1) {
        const source = input.rows[index] ?? {};
        const rowNumber = index + 2;
        try {
          if (input.entityType === "PARENT") {
            const parsed = createParentAccountSchema.parse({
              username: mapped(source, input.mapping, "username"),
              fullName: mapped(source, input.mapping, "fullName"),
              phone: mapped(source, input.mapping, "phone") || undefined
            });
            const key = parsed.username.toLowerCase();
            if (existingUsernames.has(key) || seenUsernames.has(key)) {
              errors.push({ row: rowNumber, field: "username", message: "Username already exists or is duplicated in this file." });
              continue;
            }
            seenUsernames.add(key);
            normalizedRows.push({
              username: parsed.username,
              fullName: parsed.fullName,
              phone: parsed.phone ?? ""
            });
            continue;
          }

          if (input.entityType === "TEACHER") {
            const parsed = teacherImportRowSchema.parse({
              username: mapped(source, input.mapping, "username"),
              employeeCode: mapped(source, input.mapping, "employeeCode"),
              fullName: mapped(source, input.mapping, "fullName"),
              phone: mapped(source, input.mapping, "phone") || undefined
            });
            const usernameKey = parsed.username.toLowerCase();
            const employeeKey = parsed.employeeCode.toUpperCase();
            if (existingUsernames.has(usernameKey) || seenUsernames.has(usernameKey)) {
              errors.push({ row: rowNumber, field: "username", message: "Username already exists or is duplicated in this file." });
              continue;
            }
            if (existingEmployeeCodes.has(employeeKey) || seenEmployeeCodes.has(employeeKey)) {
              errors.push({ row: rowNumber, field: "employeeCode", message: "Employee code already exists or is duplicated in this file." });
              continue;
            }
            seenUsernames.add(usernameKey);
            seenEmployeeCodes.add(employeeKey);
            normalizedRows.push({
              username: parsed.username,
              employeeCode: parsed.employeeCode,
              fullName: parsed.fullName,
              phone: parsed.phone ?? ""
            });
            continue;
          }

          const studentCode = mapped(source, input.mapping, "studentCode").toUpperCase();
          const fullName = mapped(source, input.mapping, "fullName");
          const parentUsername = mapped(source, input.mapping, "parentUsername").toLowerCase();
          const academicYearValue = mapped(source, input.mapping, "academicYear");
          const classValue = mapped(source, input.mapping, "classCode").toUpperCase();

          const parent = parentByUsername.get(parentUsername);
          if (!parent || parent.user.status === "SUSPENDED" || parent.user.status === "ARCHIVED") {
            errors.push({ row: rowNumber, field: "parentUsername", message: "An available parent account with this username was not found." });
            continue;
          }
          const year = academicOverview.academicYears.find(
            (item) => item.id === academicYearValue || item.name.toLowerCase() === academicYearValue.toLowerCase()
          );
          if (!year) {
            errors.push({ row: rowNumber, field: "academicYear", message: "Academic year was not found." });
            continue;
          }
          const classSection = academicOverview.classes.find(
            (item) =>
              item.academicYearId === year.id &&
              (item.id === classValue || item.code.toUpperCase() === classValue)
          );
          if (!classSection) {
            errors.push({ row: rowNumber, field: "classCode", message: "Class was not found in the selected academic year." });
            continue;
          }

          const parsed = createStudentSchema.parse({
            parentUserId: parent.user.id,
            studentCode,
            fullName,
            academicYearId: year.id,
            classId: classSection.id
          });
          const codeKey = parsed.studentCode.toUpperCase();
          if (existingStudentCodes.has(codeKey) || seenStudentCodes.has(codeKey)) {
            errors.push({ row: rowNumber, field: "studentCode", message: "Student code already exists or is duplicated in this file." });
            continue;
          }
          seenStudentCodes.add(codeKey);
          normalizedRows.push({
            parentUserId: parsed.parentUserId,
            studentCode: parsed.studentCode,
            fullName: parsed.fullName,
            academicYearId: parsed.academicYearId,
            classId: parsed.classId
          });
        } catch (error) {
          const message =
            error instanceof ZodError
              ? error.issues.map((issue) => issue.message).join("; ")
              : error instanceof Error
                ? error.message
                : "Invalid row.";
          errors.push({ row: rowNumber, message });
        }
      }

      return {
        entityType: input.entityType,
        valid: errors.length === 0,
        rowCount: input.rows.length,
        validRowCount: normalizedRows.length,
        errors,
        normalizedRows
      };
    } catch (error) {
      return sendFamilyError(reply, error);
    }
  });

  app.post("/v1/admin/families/import/commit", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = commitSchema.parse(request.body);
      const entityType: BulkImportEntity = input.entityType;
      let importedCount = 0;
      const credentials: Array<{ username: string; temporaryPassword: string }> = [];

      if (entityType === "PARENT") {
        const rows = z.array(createParentAccountSchema).parse(input.rows);
        const prepared = await Promise.all(rows.map(async (row) => {
          const temporaryPassword = generateTemporaryPassword();
          credentials.push({ username: row.username, temporaryPassword });
          return { ...row, passwordHash: await hashPassword(temporaryPassword) };
        }));
        importedCount = (await families.importParents(context.user.schoolId, prepared)).length;
      } else if (entityType === "TEACHER") {
        const rows = z.array(teacherImportRowSchema).parse(input.rows);
        const prepared = await Promise.all(rows.map(async (row) => {
          const temporaryPassword = generateTemporaryPassword();
          credentials.push({ username: row.username, temporaryPassword });
          return { ...row, passwordHash: await hashPassword(temporaryPassword) };
        }));
        importedCount = (await families.importTeachers(context.user.schoolId, prepared)).length;
      } else {
        const rows = z.array(createStudentSchema).parse(input.rows);
        importedCount = (await families.importStudents(context.user.schoolId, rows)).length;
      }

      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "family.import_completed",
        entityType: "bulk_import",
        metadata: { entityType, importedCount }
      });

      return reply.code(201).send({ entityType, importedCount, credentials });
    } catch (error) {
      return sendFamilyError(reply, error);
    }
  });
}
