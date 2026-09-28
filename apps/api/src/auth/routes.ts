import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  changeTemporaryPasswordSchema,
  loginInputSchema,
  refreshSessionSchema
} from "@maktablink/contracts";
import type { AccountStore, AuthenticatedSessionContext } from "@maktablink/database";
import { ZodError } from "zod";
import { LoginRateLimiter } from "./rate-limit.js";
import { hashPassword, hashSessionToken, verifyPassword } from "./security.js";
import {
  authenticateAccess,
  authenticateRefresh,
  bearerToken,
  issueSession,
  rotateSession,
  safeUser
} from "./session.js";

function subscriptionUnavailable(context: AuthenticatedSessionContext) {
  return context.subscription.status === "SUSPENDED" || context.subscription.status === "CANCELLED";
}

function endUserBlockedBySubscription(context: AuthenticatedSessionContext) {
  return context.user.role !== "SCHOOL_ADMIN" && subscriptionUnavailable(context);
}

async function requireAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  store: AccountStore
): Promise<AuthenticatedSessionContext | null> {
  const token = bearerToken(request.headers.authorization);
  if (!token) {
    await reply.code(401).send({ error: "unauthorized", message: "Authentication is required." });
    return null;
  }
  const context = await authenticateAccess(store, token);
  if (!context) {
    await reply.code(401).send({ error: "session_invalid", message: "Your session has expired or is no longer valid." });
    return null;
  }
  if (endUserBlockedBySubscription(context)) {
    await reply.code(503).send({
      error: "school_service_unavailable",
      message: "This school's MaktabLink service is currently unavailable. Contact the school administration."
    });
    return null;
  }
  return context;
}

export function registerAuthRoutes(app: FastifyInstance, store: AccountStore, limiter: LoginRateLimiter) {
  app.post("/v1/auth/login", async (request, reply) => {
    try {
      const input = loginInputSchema.parse(request.body);
      const rateKey = `${request.ip}:${input.schoolId}:${input.username}`;
      if (!limiter.consume(rateKey)) {
        return reply.code(429).send({ error: "rate_limited", message: "Too many login attempts. Try again later." });
      }

      const context = await store.findUserForLogin(input.schoolId, input.username);
      if (!context || context.school.status !== "ACTIVE") {
        return reply.code(401).send({ error: "invalid_credentials", message: "Invalid school, username, or password." });
      }
      if (context.user.status === "SUSPENDED") {
        return reply.code(403).send({ error: "account_suspended", message: "This account is suspended. Contact the school administration." });
      }
      if (context.user.status === "ARCHIVED") {
        return reply.code(403).send({ error: "account_unavailable", message: "This account is no longer active." });
      }
      if (!(await verifyPassword(input.password, context.user.passwordHash))) {
        return reply.code(401).send({ error: "invalid_credentials", message: "Invalid school, username, or password." });
      }
      if (context.user.role !== input.expectedRole) {
        return reply.code(403).send({ error: "role_mismatch", message: "This account does not belong to the selected role." });
      }
      if (endUserBlockedBySubscription(context)) {
        return reply.code(503).send({
          error: "school_service_unavailable",
          message: "This school's MaktabLink service is currently unavailable. Contact the school administration."
        });
      }

      limiter.clear(rateKey);
      await store.updateLastLogin(context.user.schoolId, context.user.id);
      const session = await issueSession(store, context.user);
      return {
        ...session,
        user: safeUser(context.user),
        mustChangePassword: context.user.mustChangePassword
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "validation_error", issues: error.issues });
      }
      throw error;
    }
  });

  app.post("/v1/auth/change-temporary-password", async (request, reply) => {
    try {
      const context = await requireAccess(request, reply, store);
      if (!context) return;
      if (!context.user.mustChangePassword) {
        return reply.code(409).send({ error: "password_change_not_required", message: "This account no longer requires a temporary-password change." });
      }

      const input = changeTemporaryPasswordSchema.parse(request.body);
      const passwordHash = await hashPassword(input.newPassword);
      const user = await store.activateUserWithPassword(context.user.schoolId, context.user.id, passwordHash);
      if (!user) return reply.code(404).send({ error: "not_found", message: "Account not found." });

      await store.writeAudit({
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "user.temporary_password_changed",
        entityType: "user",
        entityId: user.id
      });

      const session = await issueSession(store, user);
      return {
        ...session,
        user: safeUser(user),
        mustChangePassword: false
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "validation_error", issues: error.issues });
      }
      throw error;
    }
  });

  app.post("/v1/auth/refresh", async (request, reply) => {
    try {
      const input = refreshSessionSchema.parse(request.body);
      const context = await authenticateRefresh(store, input.refreshToken);
      if (!context) {
        return reply.code(401).send({ error: "refresh_invalid", message: "Refresh session is expired or invalid." });
      }
      if (endUserBlockedBySubscription(context)) {
        return reply.code(503).send({
          error: "school_service_unavailable",
          message: "This school's MaktabLink service is currently unavailable. Contact the school administration."
        });
      }
      const session = await rotateSession(store, context);
      if (!session) {
        return reply.code(401).send({ error: "refresh_invalid", message: "Refresh session is expired or invalid." });
      }
      return {
        ...session,
        user: safeUser(context.user),
        mustChangePassword: context.user.mustChangePassword
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "validation_error", issues: error.issues });
      }
      throw error;
    }
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    try {
      const input = refreshSessionSchema.parse(request.body);
      const context = await store.findByRefreshTokenHash(hashSessionToken(input.refreshToken));
      if (context) await store.revokeSession(context.session.id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "validation_error", issues: error.issues });
      }
      throw error;
    }
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const context = await requireAccess(request, reply, store);
    if (!context) return;
    return {
      user: safeUser(context.user),
      mustChangePassword: context.user.mustChangePassword
    };
  });
}

export { requireAccess };
