import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  changeTemporaryPasswordSchema,
  loginInputSchema,
  passwordSchema,
  refreshSessionSchema
} from "@maktablink/contracts";
import type { AccountStore, AuthenticatedSessionContext } from "@maktablink/database";
import { z, ZodError } from "zod";
import {
  generateVerificationCode,
  generateVerificationToken,
  hashVerificationCode,
  hashVerificationToken,
  maskEmail,
  safeHashEqual,
  type AdminPasswordVerificationDelivery
} from "./admin-password-2fa.js";
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
  verificationToken: z.string().min(32).max(256).optional()
});

const startAdminPasswordVerificationSchema = z.object({
  currentPassword: z.string().min(1).max(256)
});

const verifyAdminPasswordEmailCodeSchema = z.object({
  verificationId: z.string().uuid(),
  emailCode: z.string().regex(/^\d{6}$/)
});

const ADMIN_PASSWORD_CODE_TTL_MS = 10 * 60 * 1000;
const ADMIN_PASSWORD_CODE_TTL_MINUTES = 10;
const ADMIN_PASSWORD_MAX_ATTEMPTS = 5;

function subscriptionUnavailable(context: Pick<AuthenticatedSessionContext, "subscription">) {
  return context.subscription.status === "SUSPENDED" || context.subscription.status === "CANCELLED";
}

function endUserBlockedBySubscription(
  context: Pick<AuthenticatedSessionContext, "user" | "subscription">
) {
  return context.user.role !== "SCHOOL_ADMIN" && subscriptionUnavailable(context);
}

async function requireAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  store: AccountStore,
  options: {
    allowSuspended?: boolean;
    allowSubscriptionUnavailable?: boolean;
  } = {}
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
  if (context.user.status === "SUSPENDED" && !options.allowSuspended) {
    await reply.code(403).send({
      error: "account_suspended",
      message: "This account is suspended. Contact the school administration to reactivate it."
    });
    return null;
  }
  if (endUserBlockedBySubscription(context) && !options.allowSubscriptionUnavailable) {
    await reply.code(503).send({
      error: "school_service_unavailable",
      message: "This school's MaktabLink service is currently unavailable. Contact the school administration."
    });
    return null;
  }
  return context;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  store: AccountStore,
  limiter: LoginRateLimiter,
  options: {
    passwordVerificationDelivery: AdminPasswordVerificationDelivery;
    passwordVerificationSecret: string;
  }
) {
  const verificationLimiter = new LoginRateLimiter(3, 10 * 60 * 1000);
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
      if (context.user.status === "ARCHIVED") {
        return reply.code(403).send({ error: "account_unavailable", message: "This account is no longer active." });
      }
      if (!(await verifyPassword(input.password, context.user.passwordHash))) {
        return reply.code(401).send({ error: "invalid_credentials", message: "Invalid school, username, or password." });
      }
      if (context.user.role !== input.expectedRole) {
        return reply.code(403).send({ error: "role_mismatch", message: "This account does not belong to the selected role." });
      }
      if (endUserBlockedBySubscription(context) && context.user.status !== "SUSPENDED") {
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

  app.post("/v1/auth/admin-password-verification/start", async (request, reply) => {
    try {
      const context = await requireAccess(request, reply, store);
      if (!context) return;
      if (context.user.role !== "SCHOOL_ADMIN") {
        return reply.code(403).send({
          error: "forbidden",
          message: "Administrator access is required for this verification."
        });
      }

      if (!options.passwordVerificationDelivery.configured) {
        return reply.code(503).send({
          error: "two_factor_delivery_unavailable",
          message: "Email verification delivery is not configured for this server."
        });
      }

      const input = startAdminPasswordVerificationSchema.parse(request.body);
      if (!(await verifyPassword(input.currentPassword, context.user.passwordHash))) {
        return reply.code(401).send({
          error: "current_password_invalid",
          message: "The current password is incorrect."
        });
      }

      const rateKey = `${context.user.schoolId}:${context.user.id}:${request.ip}`;
      if (!verificationLimiter.consume(rateKey)) {
        return reply.code(429).send({
          error: "two_factor_rate_limited",
          message: "Too many verification-code requests. Try again later."
        });
      }

      const contacts = await store.getAdminPasswordVerificationContacts(
        context.user.schoolId,
        context.user.id
      );
      if (!contacts) {
        return reply.code(409).send({
          error: "two_factor_contacts_missing",
          message: "Add an email address to your administrator profile before changing the password."
        });
      }

      const verificationId = randomUUID();
      const emailCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + ADMIN_PASSWORD_CODE_TTL_MS);

      await store.createAdminPasswordVerification({
        id: verificationId,
        schoolId: context.user.schoolId,
        userId: context.user.id,
        emailCodeHash: hashVerificationCode(
          options.passwordVerificationSecret,
          verificationId,
          "email",
          emailCode
        ),
        smsCodeHash: hashVerificationCode(
          options.passwordVerificationSecret,
          verificationId,
          "sms",
          "email-only-disabled"
        ),
        expiresAt
      });

      try {
        await options.passwordVerificationDelivery.sendEmailCode({
          to: contacts.email,
          code: emailCode,
          expiresInMinutes: ADMIN_PASSWORD_CODE_TTL_MINUTES
        });
      } catch (error) {
        await store.cancelAdminPasswordVerification(
          context.user.schoolId,
          context.user.id,
          verificationId
        );
        request.log.error({
          event: "admin_password_verification_delivery_failed",
          userId: context.user.id,
          schoolId: context.user.schoolId,
          error
        });
        return reply.code(503).send({
          error: "two_factor_delivery_failed",
          message: "MaktabLink could not deliver the verification email. Try again later."
        });
      }

      await store.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "admin.password_verification_started",
        entityType: "user",
        entityId: context.user.id,
        metadata: {
          email: maskEmail(contacts.email),
          factor: "email"
        }
      });

      return {
        verificationId,
        email: maskEmail(contacts.email),
        expiresInSeconds: ADMIN_PASSWORD_CODE_TTL_MS / 1000
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "validation_error", issues: error.issues });
      }
      throw error;
    }
  });

  app.post("/v1/auth/admin-password-verification/verify", async (request, reply) => {
    try {
      const context = await requireAccess(request, reply, store);
      if (!context) return;
      if (context.user.role !== "SCHOOL_ADMIN") {
        return reply.code(403).send({
          error: "forbidden",
          message: "Administrator access is required for this verification."
        });
      }

      const input = verifyAdminPasswordEmailCodeSchema.parse(request.body);
      const verification = await store.findAdminPasswordVerification(
        context.user.schoolId,
        context.user.id,
        input.verificationId
      );

      if (
        !verification ||
        verification.consumedAt ||
        verification.verifiedAt ||
        verification.expiresAt.getTime() <= Date.now()
      ) {
        return reply.code(410).send({
          error: "two_factor_verification_expired",
          message: "This verification request has expired. Request a new code."
        });
      }

      if (verification.attempts >= ADMIN_PASSWORD_MAX_ATTEMPTS) {
        await store.cancelAdminPasswordVerification(
          context.user.schoolId,
          context.user.id,
          input.verificationId
        );
        return reply.code(429).send({
          error: "two_factor_attempts_exceeded",
          message: "Too many incorrect verification attempts. Request a new code."
        });
      }

      const emailMatches = safeHashEqual(
        verification.emailCodeHash,
        hashVerificationCode(
          options.passwordVerificationSecret,
          verification.id,
          "email",
          input.emailCode
        )
      );

      if (!emailMatches) {
        const updated = await store.incrementAdminPasswordVerificationAttempts(
          context.user.schoolId,
          context.user.id,
          input.verificationId
        );
        const remainingAttempts = Math.max(
          0,
          ADMIN_PASSWORD_MAX_ATTEMPTS - (updated?.attempts ?? ADMIN_PASSWORD_MAX_ATTEMPTS)
        );
        if (remainingAttempts === 0) {
          await store.cancelAdminPasswordVerification(
            context.user.schoolId,
            context.user.id,
            input.verificationId
          );
        }
        return reply.code(400).send({
          error: "two_factor_code_invalid",
          message: "The email verification code is incorrect.",
          remainingAttempts
        });
      }

      const verificationToken = generateVerificationToken();
      await store.markAdminPasswordVerificationVerified(
        context.user.schoolId,
        context.user.id,
        input.verificationId,
        hashVerificationToken(options.passwordVerificationSecret, verificationToken)
      );

      await store.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "admin.password_verification_completed",
        entityType: "user",
        entityId: context.user.id,
        metadata: { factor: "email" }
      });

      return {
        verificationToken,
        expiresAt: verification.expiresAt.toISOString()
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "validation_error", issues: error.issues });
      }
      throw error;
    }
  });

  app.post("/v1/auth/change-password", async (request, reply) => {
    try {
      const context = await requireAccess(request, reply, store);
      if (!context) return;

      const input = changePasswordSchema.parse(request.body);
      if (!(await verifyPassword(input.currentPassword, context.user.passwordHash))) {
        return reply.code(401).send({
          error: "current_password_invalid",
          message: "The current password is incorrect."
        });
      }
      if (input.currentPassword === input.newPassword) {
        return reply.code(400).send({
          error: "password_unchanged",
          message: "Choose a new password that is different from the current password."
        });
      }

      if (context.user.role === "SCHOOL_ADMIN") {
        if (!input.verificationToken) {
          return reply.code(403).send({
            error: "two_factor_verification_required",
            message: "Complete email verification before changing the administrator password."
          });
        }
        const consumed = await store.consumeAdminPasswordVerification(
          context.user.schoolId,
          context.user.id,
          hashVerificationToken(options.passwordVerificationSecret, input.verificationToken)
        );
        if (!consumed) {
          return reply.code(403).send({
            error: "two_factor_verification_required",
            message: "The two-factor verification is missing, expired, or already used."
          });
        }
      }

      const passwordHash = await hashPassword(input.newPassword);
      const user = await store.activateUserWithPassword(
        context.user.schoolId,
        context.user.id,
        passwordHash
      );
      if (!user) return reply.code(404).send({ error: "not_found", message: "Account not found." });

      await store.writeAudit({
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "user.password_changed",
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
      if (endUserBlockedBySubscription(context) && context.user.status !== "SUSPENDED") {
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
    const context = await requireAccess(request, reply, store, {
      allowSuspended: true,
      allowSubscriptionUnavailable: true
    });
    if (!context) return;
    return {
      user: safeUser(context.user),
      mustChangePassword: context.user.mustChangePassword
    };
  });
}

export { requireAccess };
