import Constants from "expo-constants";

declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };

export interface SchoolOption {
  id: string;
  code: string;
  name: string;
  province: string;
  city: string;
  defaultLanguage: "fa-AF" | "ps-AF" | "en";
}

export interface SafeUser {
  id: string;
  schoolId: string;
  username: string;
  role: "SCHOOL_ADMIN" | "SCHOOL_STAFF" | "TEACHER" | "PARENT" | "STUDENT";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  mustChangePassword: boolean;
}

export interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  user: SafeUser;
  mustChangePassword: boolean;
}

function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:4000` : "http://127.0.0.1:4000";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = body?.message ?? "Request failed.";
      throw new Error(message);
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  async schools(query = "") {
    const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    return request<{ schools: SchoolOption[] }>(`/v1/public/schools${suffix}`);
  },

  login(input: { schoolId: string; expectedRole: "PARENT" | "TEACHER" | "STUDENT"; username: string; password: string }) {
    return request<SessionPayload>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  changeTemporaryPassword(accessToken: string, newPassword: string) {
    return request<SessionPayload>("/v1/auth/change-temporary-password", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ newPassword })
    });
  },

  refresh(refreshToken: string) {
    return request<SessionPayload>("/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },

  me(accessToken: string) {
    return request<{ user: SafeUser; mustChangePassword: boolean }>("/v1/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  async logout(refreshToken: string) {
    await request<null>("/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  }
};
