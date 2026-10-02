import Constants from "expo-constants";
import {
  notifyReadCacheFallback,
  readReadCache,
  writeReadCache
} from "./read-cache";

declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };

export interface SchoolOption {
  id: string;
  code: string;
  name: string;
  province: string;
  city: string;
  imageUrl: string | null;
  defaultLanguage: "fa-AF" | "ps-AF" | "en";
}

export interface AdminContactPayload {
  username: string;
  fullName: string;
  jobTitle: string | null;
  imageUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  officeLocation: string | null;
  officeHours: string | null;
  bio: string | null;
}

export interface SafeUser {
  id: string;
  schoolId: string;
  username: string;
  role: "SCHOOL_ADMIN" | "SCHOOL_STAFF" | "TEACHER" | "PARENT" | "STUDENT";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  mustChangePassword: boolean;
}

export interface ParentChild {
  student: {
    id: string;
    studentCode: string;
    fullName: string;
    status: "ACTIVE" | "WITHDRAWN";
    parentUserId: string;
    academicYearId: string;
    classId: string;
  };
  classSection: {
    id: string;
    code: string;
    name: string;
    academicYearId: string;
  };
  academicYear: {
    id: string;
    name: string;
    status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  };
}

export interface ParentHomePayload {
  parent: {
    userId: string;
    fullName: string;
    phone: string | null;
  };
  children: ParentChild[];
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface TeacherTodayPayload {
  date: string;
  weekday: string;
  teacher: { userId: string; fullName: string; employeeCode: string };
  schedule: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    classId: string;
    className: string;
    classCode: string;
    subjectId: string;
    subjectName: string;
  }>;
  supervisedClasses: Array<{
    assignmentId: string;
    classId: string;
    className: string;
    classCode: string;
    attendanceStatus: "PENDING" | "SUBMITTED";
    attendanceId: string | null;
  }>;
}

export interface AttendanceSheetPayload {
  date: string;
  classSection: { id: string; name: string; code: string; academicYearId: string };
  attendance: { id: string; status: "SUBMITTED" | "CORRECTED" } | null;
  students: Array<{
    student: { id: string; studentCode: string; fullName: string };
    status: AttendanceStatus | null;
    note: string | null;
  }>;
  canEdit: boolean;
  locked: boolean;
}

export interface ParentAttendanceDay {
  attendanceId: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  classId: string;
  className: string;
}

export interface ParentTimetablePeriod {
  period: {
    id: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    teacherUserId: string;
    weekday: "SATURDAY" | "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
    startsAt: string;
    endsAt: string;
  };
  subjectName: string;
  subjectCode: string;
  teacherName: string;
}

export interface ParentNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  deepLink: string | null;
  deliveryStatus: "PENDING" | "SENT" | "FAILED" | "CANCELLED";
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export type HomeworkStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
export type ExamStatus = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "RESULTS_READY" | "PUBLISHED" | "ARCHIVED";

export interface HomeworkPayload {
  id: string;
  schoolId: string;
  assignmentId: string;
  academicYearId: string;
  classId: string;
  subjectId: string;
  teacherUserId: string;
  title: string;
  content: string;
  dueAt: string;
  attachmentUrl: string | null;
  status: HomeworkStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherLearningPayload {
  assignments: Array<{
    assignmentId: string;
    academicYearId: string;
    classId: string;
    className: string;
    classCode: string;
    subjectId: string;
    subjectName: string;
  }>;
  homeworks: HomeworkPayload[];
  examSubjects: Array<{
    examSubject: {
      id: string;
      examId: string;
      subjectId: string;
      classId: string;
      maxScore: number;
    };
    exam: {
      id: string;
      academicYearId: string;
      name: string;
      type: string;
      status: ExamStatus;
    };
    className: string;
    classCode: string;
    subjectName: string;
  }>;
}

export interface GradeSheetPayload {
  examSubject: {
    id: string;
    examId: string;
    subjectId: string;
    classId: string;
    maxScore: number;
  };
  exam: {
    id: string;
    academicYearId: string;
    name: string;
    type: string;
    status: ExamStatus;
  };
  classSection: { id: string; name: string; code: string };
  subject: { id: string; name: string; code: string };
  students: Array<{
    student: {
      id: string;
      studentCode: string;
      fullName: string;
    };
    grade: {
      id: string;
      score: number;
      remark: string | null;
      status: "DRAFT" | "PUBLISHED";
    } | null;
  }>;
  canEdit: boolean;
}

export interface LearnerAcademicPayload {
  student: {
    id: string;
    studentCode: string;
    fullName: string;
    academicYearId: string;
    classId: string;
  };
  homework: Array<{
    homework: HomeworkPayload;
    subjectName: string;
    className: string;
  }>;
  results: Array<{
    grade: {
      id: string;
      score: number;
      remark: string | null;
      status: "DRAFT" | "PUBLISHED";
      publishedAt: string | null;
    };
    exam: {
      id: string;
      name: string;
      type: string;
      status: ExamStatus;
      publishedAt: string | null;
    };
    examSubject: {
      id: string;
      maxScore: number;
      subjectId: string;
      classId: string;
    };
    subjectName: string;
    className: string;
  }>;
}

export interface AnnouncementPayload {
  id: string;
  schoolId: string;
  title: string;
  content: string;
  audienceScope: "SCHOOL" | "CLASS" | "ROLE";
  classId: string | null;
  audienceRole: SafeUser["role"] | null;
  publishAt: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface FeePaymentPayload {
  id: string;
  invoiceId: string;
  kind: "PAYMENT" | "REVERSAL";
  amount: number;
  method: string;
  transactionReference: string | null;
  reversalOfPaymentId: string | null;
  reversalReason: string | null;
  recordedAt: string;
}

export interface FeeInvoiceViewPayload {
  invoice: {
    id: string;
    studentId: string;
    amount: number;
    currency: string;
    description: string | null;
    dueDate: string;
    status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
    issuedAt: string | null;
  };
  studentName: string;
  studentCode: string;
  paid: number;
  outstanding: number;
  payments: FeePaymentPayload[];
}

export interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  user: SafeUser;
  mustChangePassword: boolean;
}

export class ApiRequestError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly network: boolean;

  constructor(
    message: string,
    options: { status?: number | null; code?: string | null; network?: boolean } = {}
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.network = options.network ?? false;
  }
}

export function isNetworkApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.network;
}

let preferCachedReads = false;
let sessionRefreshHandler: (() => Promise<string | null>) | null = null;

export function setPreferCachedReads(value: boolean) {
  preferCachedReads = value;
}

export function setSessionRefreshHandler(
  handler: (() => Promise<string | null>) | null
) {
  sessionRefreshHandler = handler;
}

function withAuthorization(init: RequestInit | undefined, accessToken: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:4000` : "http://127.0.0.1:4000";
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options: { cache?: boolean; timeoutMs?: number; allowSessionRefresh?: boolean } = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  const method = (init?.method ?? "GET").toUpperCase();
  const cacheable = method === "GET" && options.cache !== false;

  try {
    if (cacheable && preferCachedReads) {
      const cached = await readReadCache<T>(path);
      if (cached) return cached.data;
    }

    const baseUrl = apiBaseUrl();
    let response: Response;
    try {
      const headers = new Headers(init?.headers);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      if (!headers.has("ngrok-skip-browser-warning")) {
        headers.set("ngrok-skip-browser-warning", "true");
      }

      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: init?.signal ?? controller.signal,
        headers
      });
    } catch {
      if (cacheable) {
        const cached = await readReadCache<T>(path);
        if (cached) {
          notifyReadCacheFallback(cached.savedAt);
          return cached.data;
        }
      }
      throw new ApiRequestError("Network unavailable.", { network: true });
    }

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new ApiRequestError("MaktabLink service unavailable.", {
          status: response.status,
          code: "api_unavailable",
          network: true
        });
      }
    }

    if (!response.ok) {
      const message =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : "Request failed.";
      const code =
        body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : null;

      const headers = new Headers(init?.headers);
      const hasBearerToken = headers.get("Authorization")?.startsWith("Bearer ") ?? false;
      const canRefresh =
        options.allowSessionRefresh !== false &&
        response.status === 401 &&
        code === "session_invalid" &&
        hasBearerToken &&
        sessionRefreshHandler;

      if (canRefresh) {
        const nextAccessToken = await sessionRefreshHandler();
        if (nextAccessToken) {
          return request<T>(
            path,
            withAuthorization(init, nextAccessToken),
            { ...options, allowSessionRefresh: false }
          );
        }
      }

      throw new ApiRequestError(message, { status: response.status, code });
    }

    if (cacheable) await writeReadCache(path, body as T);
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  health(timeoutMs = 5_000) {
    return request<{ status: string }>("/health", undefined, { cache: false, timeoutMs });
  },

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
    return request<SessionPayload>(
      "/v1/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken })
      },
      { cache: false, allowSessionRefresh: false }
    );
  },

  me(accessToken: string) {
    return request<{ user: SafeUser; mustChangePassword: boolean }>(
      "/v1/auth/me",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      },
      { cache: false }
    );
  },

  adminContact(accessToken: string) {
    return request<{ contact: AdminContactPayload | null }>("/v1/school/admin-contact", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  parentHome(accessToken: string) {
    return request<ParentHomePayload>("/v1/parent/home", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  parentAttendance(accessToken: string, studentId: string) {
    return request<{ today: string; days: ParentAttendanceDay[] }>(`/v1/parent/children/${studentId}/attendance`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  parentTimetable(accessToken: string, studentId: string) {
    return request<{ periods: ParentTimetablePeriod[] }>(`/v1/parent/children/${studentId}/timetable`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  parentNotifications(accessToken: string) {
    return request<{ notifications: ParentNotification[] }>("/v1/notifications", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  notifications(accessToken: string) {
    return request<{ notifications: ParentNotification[] }>("/v1/notifications", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  markNotificationRead(accessToken: string, notificationId: string) {
    return request<{ notification: ParentNotification }>(`/v1/notifications/${notificationId}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  announcements(accessToken: string) {
    return request<{ announcements: AnnouncementPayload[] }>("/v1/announcements", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  createTeacherAnnouncement(
    accessToken: string,
    input: { title: string; content: string; classId: string }
  ) {
    return request<{ announcement: AnnouncementPayload }>("/v1/teacher/announcements", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        audienceScope: "CLASS",
        classId: input.classId
      })
    });
  },

  parentFees(accessToken: string, studentId: string) {
    return request<{ invoices: FeeInvoiceViewPayload[] }>(`/v1/parent/children/${studentId}/fees`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  studentFees(accessToken: string) {
    return request<{ invoices: FeeInvoiceViewPayload[] }>("/v1/student/fees", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  registerPushDevice(accessToken: string, pushToken: string, platform: "ANDROID" | "IOS") {
    return request<{ device: { id: string } }>("/v1/notifications/devices", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ pushToken, platform })
    });
  },

  deactivatePushDevice(accessToken: string, pushToken: string, platform: "ANDROID" | "IOS") {
    return request<null>("/v1/notifications/devices/deactivate", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ pushToken, platform })
    });
  },

  teacherToday(accessToken: string) {
    return request<TeacherTodayPayload>("/v1/teacher/today", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  teacherAttendance(accessToken: string, classId: string, date?: string) {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : "";
    return request<AttendanceSheetPayload>(`/v1/teacher/negaran/${classId}/attendance${suffix}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  teacherLearning(accessToken: string) {
    return request<TeacherLearningPayload>("/v1/teacher/learning", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  createHomework(
    accessToken: string,
    input: {
      assignmentId: string;
      title: string;
      content: string;
      dueAt: string;
      attachmentUrl?: string;
    }
  ) {
    return request<{ homework: HomeworkPayload }>("/v1/teacher/homework", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input)
    });
  },

  updateHomework(
    accessToken: string,
    homeworkId: string,
    input: {
      title?: string;
      content?: string;
      dueAt?: string;
      attachmentUrl?: string | null;
    }
  ) {
    return request<{ homework: HomeworkPayload }>(`/v1/teacher/homework/${homeworkId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input)
    });
  },

  homeworkAction(accessToken: string, homeworkId: string, action: "publish" | "close" | "archive") {
    return request<{ homework: HomeworkPayload }>(`/v1/teacher/homework/${homeworkId}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  gradeSheet(accessToken: string, examSubjectId: string) {
    return request<GradeSheetPayload>(`/v1/teacher/exam-subjects/${examSubjectId}/grades`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  saveDraftGrades(
    accessToken: string,
    examSubjectId: string,
    entries: Array<{ studentId: string; score: number; remark?: string }>
  ) {
    return request<{ sheet: GradeSheetPayload }>(`/v1/teacher/exam-subjects/${examSubjectId}/grades`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ entries })
    });
  },

  parentLearning(accessToken: string, studentId: string) {
    return request<LearnerAcademicPayload>(`/v1/parent/children/${studentId}/learning`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  studentHome(accessToken: string) {
    return request<LearnerAcademicPayload>("/v1/student/home", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  },

  submitDailyAttendance(
    accessToken: string,
    input: {
      classId: string;
      date: string;
      entries: Array<{ studentId: string; status: AttendanceStatus; note?: string }>;
    }
  ) {
    return request<{
      sheet: AttendanceSheetPayload;
      created: boolean;
      changed: boolean;
      notificationCount: number;
    }>("/v1/teacher/negaran/attendance", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input)
    });
  },

  async logout(refreshToken: string) {
    await request<null>("/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  }
};
