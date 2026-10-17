import type { ParentNotification } from "./api";

export type NotificationDestination =
  | "PARENT_ANNOUNCEMENTS" | "PARENT_HOMEWORK" | "PARENT_RESULTS"
  | "PARENT_HOME" | "PARENT_ATTENDANCE" | "PARENT_FEES" | "STUDENT_ANNOUNCEMENTS" | "STUDENT_HOMEWORK"
  | "STUDENT_RESULTS" | "STUDENT_HOME" | "STUDENT_ATTENDANCE" | "TEACHER_ANNOUNCEMENTS"
  | "TEACHER_HOMEWORK" | "TEACHER_GRADES" | "TEACHER_TODAY";

// Only app-known destinations; never pass a server-provided URL directly
// into navigation/Linking.openURL.
export function notificationDestination(
  role: "PARENT" | "STUDENT" | "TEACHER",
  notification: Pick<ParentNotification, "type" | "deepLink">
): NotificationDestination | null {
  const { type, deepLink } = notification;
  if (type === "ANNOUNCEMENT" && deepLink === "/announcements") {
    return role === "PARENT" ? "PARENT_ANNOUNCEMENTS"
      : role === "STUDENT" ? "STUDENT_ANNOUNCEMENTS" : "TEACHER_ANNOUNCEMENTS";
  }
  if (type === "HOMEWORK_PUBLISHED" && /^\/homework\/[0-9a-f-]{36}$/i.test(deepLink ?? "")) {
    return role === "PARENT" ? "PARENT_HOMEWORK"
      : role === "STUDENT" ? "STUDENT_HOMEWORK" : "TEACHER_HOMEWORK";
  }
  if (type === "RESULTS_PUBLISHED" && /^\/results\/[0-9a-f-]{36}$/i.test(deepLink ?? "")) {
    return role === "PARENT" ? "PARENT_RESULTS"
      : role === "STUDENT" ? "STUDENT_RESULTS" : "TEACHER_GRADES";
  }
  if (type.startsWith("ATTENDANCE_")) {
    return role === "PARENT" ? "PARENT_ATTENDANCE"
      : role === "STUDENT" ? "STUDENT_ATTENDANCE" : "TEACHER_TODAY";
  }
  if (role === "PARENT" && (type === "FEE_DUE" || type === "FEE_OVERDUE") &&
      /^\/parent\/children\/[0-9a-f-]{36}\/fees$/i.test(deepLink ?? "")) {
    return "PARENT_FEES"; // Fees live under Parent More, not academic results.
  }
  return null;
}
