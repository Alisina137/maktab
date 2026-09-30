import type { FastifyInstance, FastifyReply } from "fastify";
import {
  createAcademicYearSchema,
  createClassSectionSchema,
  createGradeLevelSchema,
  createNegaranAssignmentSchema,
  createSubjectSchema,
  createTeacherAssignmentSchema,
  createTeacherProfileSchema,
  createTimetablePeriodSchema,
  endNegaranAssignmentSchema,
  type AcademicYearStatus
} from "@maktablink/contracts";
import {
  AcademicConflictError,
  AcademicNotFoundError,
  AcademicValidationError,
  type AcademicStore,
  type AccountStore
} from "@maktablink/database";
import { ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";

function sendAcademicError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "validation_error",
      message: error.issues[0]?.message ?? "Academic request validation failed.",
      issues: error.issues
    });
  }
  if (error instanceof AcademicValidationError) {
    return reply.code(400).send({ error: "academic_validation", message: error.message });
  }
  if (error instanceof AcademicNotFoundError) {
    return reply.code(404).send({ error: "not_found", message: error.message });
  }
  if (error instanceof AcademicConflictError) {
    return reply.code(409).send({ error: "academic_conflict", message: error.message });
  }
  throw error;
}

export function registerAcademicRoutes(
  app: FastifyInstance,
  accounts: AccountStore,
  academics: AcademicStore
) {
  app.get("/v1/admin/academics", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    return academics.getOverview(context.user.schoolId);
  });

  app.post("/v1/admin/academics/years", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createAcademicYearSchema.parse(request.body);
      const year = await academics.createAcademicYear(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "academic_year.created",
        entityType: "academic_year",
        entityId: year.id,
        metadata: { name: year.name }
      });
      return reply.code(201).send({ academicYear: year });
    } catch (error) {
      return sendAcademicError(reply, error);
    }
  });

  const statusRoutes: Array<{ path: string; status: AcademicYearStatus; action: string }> = [
    { path: "activate", status: "ACTIVE", action: "academic_year.activated" },
    { path: "close", status: "CLOSED", action: "academic_year.closed" },
    { path: "archive", status: "ARCHIVED", action: "academic_year.archived" }
  ];

  for (const route of statusRoutes) {
    app.post<{ Params: { yearId: string } }>(
      `/v1/admin/academics/years/:yearId/${route.path}`,
      async (request, reply) => {
        const context = await requireSchoolAdmin(request, reply, accounts);
        if (!context) return;
        try {
          const year = await academics.setAcademicYearStatus(
            context.user.schoolId,
            request.params.yearId,
            route.status
          );
          await accounts.writeAudit({
            schoolId: context.user.schoolId,
            actorUserId: context.user.id,
            action: route.action,
            entityType: "academic_year",
            entityId: year.id
          });
          return { academicYear: year };
        } catch (error) {
          return sendAcademicError(reply, error);
        }
      }
    );
  }

  app.post("/v1/admin/academics/grades", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createGradeLevelSchema.parse(request.body);
      const grade = await academics.createGradeLevel(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "grade_level.created",
        entityType: "grade_level",
        entityId: grade.id,
        metadata: { code: grade.code, name: grade.name }
      });
      return reply.code(201).send({ grade });
    } catch (error) {
      return sendAcademicError(reply, error);
    }
  });

  app.post("/v1/admin/academics/classes", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createClassSectionSchema.parse(request.body);
      const classSection = await academics.createClassSection(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "class_section.created",
        entityType: "class_section",
        entityId: classSection.id,
        metadata: { code: classSection.code, academicYearId: classSection.academicYearId }
      });
      return reply.code(201).send({ class: classSection });
    } catch (error) {
      return sendAcademicError(reply, error);
    }
  });

  app.post("/v1/admin/academics/subjects", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createSubjectSchema.parse(request.body);
      const subject = await academics.createSubject(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "subject.created",
        entityType: "subject",
        entityId: subject.id,
        metadata: { code: subject.code, name: subject.name }
      });
      return reply.code(201).send({ subject });
    } catch (error) {
      return sendAcademicError(reply, error);
    }
  });

  app.post("/v1/admin/academics/teachers", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createTeacherProfileSchema.parse(request.body);
      const teacher = await academics.createTeacherProfile(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "teacher_profile.created",
        entityType: "teacher_profile",
        entityId: teacher.userId,
        metadata: { employeeCode: teacher.employeeCode, fullName: teacher.fullName }
      });
      return reply.code(201).send({ teacher });
    } catch (error) {
      return sendAcademicError(reply, error);
    }
  });

  app.post("/v1/admin/academics/assignments", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createTeacherAssignmentSchema.parse(request.body);
      const assignment = await academics.createTeacherAssignment(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "teacher_assignment.created",
        entityType: "teacher_assignment",
        entityId: assignment.id,
        metadata: {
          teacherUserId: assignment.teacherUserId,
          subjectId: assignment.subjectId,
          classId: assignment.classId,
          academicYearId: assignment.academicYearId
        }
      });
      return reply.code(201).send({ assignment });
    } catch (error) {
      return sendAcademicError(reply, error);
    }
  });

  app.post("/v1/admin/academics/negaran", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createNegaranAssignmentSchema.parse(request.body);
      const assignment = await academics.createNegaranAssignment(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "negaran_assignment.created",
        entityType: "negaran_assignment",
        entityId: assignment.id,
        metadata: {
          teacherUserId: assignment.teacherUserId,
          classId: assignment.classId,
          academicYearId: assignment.academicYearId
        }
      });
      return reply.code(201).send({ assignment });
    } catch (error) {
      return sendAcademicError(reply, error);
    }
  });

  app.post<{ Params: { assignmentId: string } }>(
    "/v1/admin/academics/negaran/:assignmentId/end",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const input = endNegaranAssignmentSchema.parse(request.body);
        const assignment = await academics.endNegaranAssignment(
          context.user.schoolId,
          request.params.assignmentId,
          input
        );
        await accounts.writeAudit({
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "negaran_assignment.ended",
          entityType: "negaran_assignment",
          entityId: assignment.id,
          metadata: { endDate: assignment.endDate }
        });
        return { assignment };
      } catch (error) {
        return sendAcademicError(reply, error);
      }
    }
  );

  app.post("/v1/admin/academics/timetable", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createTimetablePeriodSchema.parse(request.body);
      const period = await academics.createTimetablePeriod(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "timetable_period.created",
        entityType: "timetable_period",
        entityId: period.id,
        metadata: {
          classId: period.classId,
          subjectId: period.subjectId,
          teacherUserId: period.teacherUserId,
          weekday: period.weekday,
          startsAt: period.startsAt,
          endsAt: period.endsAt
        }
      });
      return reply.code(201).send({ period });
    } catch (error) {
      return sendAcademicError(reply, error);
    }
  });

  app.get("/v1/teacher/academics", async (request, reply) => {
    const context = await requireAccess(request, reply, accounts);
    if (!context) return;
    if (context.user.mustChangePassword) {
      return reply.code(403).send({
        error: "password_change_required",
        message: "Change the temporary password before using teacher features."
      });
    }
    if (context.user.role !== "TEACHER") {
      return reply.code(403).send({
        error: "forbidden",
        message: "Teacher access is required."
      });
    }

    try {
      return await academics.getTeacherView(context.user.schoolId, context.user.id);
    } catch (error) {
      return sendAcademicError(reply, error);
    }
  });
}
