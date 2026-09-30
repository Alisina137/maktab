"use client";

import { adminText, type AdminLocale } from "./admin-i18n";

export type School = {
  id: string;
  code: string;
  name: string;
  province: string;
  city: string;
  imageUrl: string | null;
};

export type User = {
  id: string;
  username: string;
  role: "SCHOOL_ADMIN" | "SCHOOL_STAFF" | "TEACHER" | "PARENT" | "STUDENT";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  mustChangePassword: boolean;
  profile?: {
    fullName: string | null;
    phone: string | null;
    code: string | null;
  };
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt?: string;
  refreshExpiresAt?: string;
  user: User;
  mustChangePassword: boolean;
};

export type AdminToastState = {
  kind: "error" | "success";
  title: string;
  message: string;
};

export type StoredAdminSession = {
  session: Session;
  school: School;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const ADMIN_SESSION_KEY = "maktablink.admin.session";

export class AdminApiError extends Error {
  code: string | null;
  status: number;
  requestId: string | null;
  dependencies: string[];

  constructor(
    message: string,
    status: number,
    code: string | null,
    requestId: string | null,
    dependencies: string[] = []
  ) {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.dependencies = dependencies;
  }
}

export async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new AdminApiError(
        "MaktabLink could not read the server response.",
        response.status,
        "invalid_response",
        response.headers.get("x-request-id"),
        []
      );
    }
  }

  if (!response.ok) {
    const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const issues = Array.isArray(record?.issues) ? record.issues : [];
    const firstIssue = issues.find((issue) => issue && typeof issue === "object") as Record<string, unknown> | undefined;
    const issueMessage = typeof firstIssue?.message === "string" ? firstIssue.message : null;
    const dependencies = Array.isArray(record?.dependencies)
      ? record.dependencies.filter((item): item is string => typeof item === "string")
      : [];
    throw new AdminApiError(
      typeof record?.message === "string" ? record.message : issueMessage ?? "Request failed.",
      response.status,
      typeof record?.error === "string" ? record.error : null,
      response.headers.get("x-request-id"),
      dependencies
    );
  }

  return body as T;
}

export function friendlyAdminError(
  cause: unknown,
  fallback = "Please try again.",
  locale: AdminLocale = "en"
) {
  const fallbackText = adminText(locale, fallback);
  if (!(cause instanceof AdminApiError)) return fallbackText;

  if (cause.code === "academic_dependency" && cause.dependencies.length > 0) {
    const base = adminText(locale, cause.message || "This record cannot be deleted because it is used by:");
    const dependencies = cause.dependencies.map((item) => adminText(locale, item));
    return `${base} ${dependencies.join(locale === "en" ? ", " : "، ")}`;
  }

  const messages: Record<string, string> = {
    session_invalid: "Your administrator session has expired. Please sign in again.",
    unauthorized: "Please sign in again to continue.",
    self_suspend_blocked: "You cannot suspend the administrator account you are currently using.",
    self_reset_blocked: "For your security, reset another account here. Your current administrator password cannot be reset from its own active session.",
    account_archived: "This account is archived and can no longer be changed.",
    subscription_write_blocked: "Account changes are temporarily unavailable while the school subscription is suspended.",
    not_found: "This account could not be found. Refresh the page and try again.",
    validation_error: "Some information is not valid. Please review it and try again.",
    invalid_request: "The request could not be processed. Please try again.",
    username_conflict: "That username already exists in this school.",
    current_password_invalid: "The current password is incorrect.",
    password_unchanged: "Choose a new password that is different from the current password.",
    two_factor_delivery_unavailable: "Email and SMS verification delivery is not configured for this server.",
    two_factor_delivery_failed: "MaktabLink could not deliver both verification codes. Try again later.",
    two_factor_contacts_missing: "Add both an email address and phone number to your administrator profile before changing the password.",
    two_factor_rate_limited: "Too many verification-code requests. Try again later.",
    two_factor_verification_expired: "This verification request has expired. Request new codes.",
    two_factor_attempts_exceeded: "Too many incorrect verification attempts. Request new codes.",
    two_factor_code_invalid: "One or both verification codes are incorrect.",
    two_factor_verification_required: "Complete email and SMS verification before changing the administrator password.",
    internal_error: "MaktabLink could not complete this request. Please try again.",
    invalid_response: "The school service returned an unreadable response. Please try again."
  };

  const mapped = cause.code ? messages[cause.code] : undefined;
  const specificMessage =
    cause.message &&
    cause.message !== "Request failed." &&
    cause.message !== "The request could not be processed. Please try again."
      ? cause.message
      : null;
  const preferMappedMessage = cause.code === "internal_error" || cause.code === "invalid_response";
  const english = preferMappedMessage
    ? mapped ?? specificMessage ?? cause.message ?? fallback
    : specificMessage ?? mapped ?? cause.message ?? fallback;
  if (locale === "en") return english || fallback;
  const translated = adminText(locale, english);
  return translated !== english ? translated : english || fallbackText;
}

export function saveAdminSession(value: StoredAdminSession) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(value));
  }
}

export function loadAdminSession(): StoredAdminSession | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as StoredAdminSession;
  } catch {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
}

export function clearAdminSession() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
}
