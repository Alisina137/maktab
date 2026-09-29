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

  constructor(message: string, status: number, code: string | null, requestId: string | null) {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
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
        response.headers.get("x-request-id")
      );
    }
  }

  if (!response.ok) {
    const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
    throw new AdminApiError(
      typeof record?.message === "string" ? record.message : "Request failed.",
      response.status,
      typeof record?.error === "string" ? record.error : null,
      response.headers.get("x-request-id")
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

  const messages: Record<string, string> = {
    session_invalid: "Your administrator session has expired. Please sign in again.",
    unauthorized: "Please sign in again to continue.",
    self_suspend_blocked: "You cannot suspend the administrator account you are currently using.",
    self_reset_blocked: "For your security, reset another account here. Your current administrator password cannot be reset from its own active session.",
    account_archived: "This account is archived and can no longer be changed.",
    subscription_write_blocked: "Account changes are temporarily unavailable while the school subscription is suspended.",
    not_found: "This account could not be found. Refresh the page and try again.",
    validation_error: "Some information is not valid. Please review it and try again.",
    username_conflict: "That username already exists in this school.",
    current_password_invalid: "The current password is incorrect.",
    password_unchanged: "Choose a new password that is different from the current password.",
    internal_error: "MaktabLink could not complete this request. Please try again.",
    invalid_response: "The school service returned an unreadable response. Please try again."
  };

  const english = cause.code ? messages[cause.code] ?? cause.message : cause.message;
  if (locale === "en") return english || fallback;
  const translated = adminText(locale, english);
  return translated !== english ? translated : fallbackText;
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
