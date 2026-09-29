import type { TranslationKey } from "@maktablink/localization";
import { ApiRequestError } from "./api";

export type AppErrorKind = "network" | "general";

export interface AppErrorDescriptor {
  key: TranslationKey;
  kind: AppErrorKind;
}

export function appErrorFromCause(
  cause: unknown,
  fallback: TranslationKey = "common.requestFailed"
): AppErrorDescriptor {
  if (cause instanceof ApiRequestError) {
    if (cause.network || cause.code === "api_unavailable") {
      return { key: "common.apiUnavailable", kind: "network" };
    }

    switch (cause.code) {
      case "school_service_unavailable":
      case "subscription_write_blocked":
        return { key: "common.serviceUnavailable", kind: "general" };
      case "session_invalid":
      case "refresh_invalid":
        return { key: "common.sessionExpired", kind: "general" };
      case "invalid_credentials":
        return { key: "auth.invalidCredentials", kind: "general" };
      case "role_mismatch":
        return { key: "auth.roleMismatch", kind: "general" };
      case "account_suspended":
        return { key: "auth.accountSuspended", kind: "general" };
      case "account_unavailable":
        return { key: "auth.accountUnavailable", kind: "general" };
      case "rate_limited":
        return { key: "auth.rateLimited", kind: "general" };
      case "validation_error":
        return { key: "common.validationError", kind: "general" };
      default:
        return { key: fallback, kind: "general" };
    }
  }

  return { key: fallback, kind: "general" };
}
