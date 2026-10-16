import { sql } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";

// Counts are server-side school aggregates; lastLoginAt indicates sign-in, not screen activity.
export const adoptionWindows = ["today", "7d", "30d"] as const;
export type AdoptionWindow = (typeof adoptionWindows)[number];
export type AdoptionRole = "TEACHER" | "PARENT" | "STUDENT";
export type AdoptionRoleSummary = {
  role: AdoptionRole; eligible: number; signedIn: number; activated: number;
  signedInPercent: number | null; activatedPercent: number | null;
};
export type AdoptionReport = {
  window: AdoptionWindow; startAt: string; endAt: string; timeZone: "Asia/Kabul";
  roles: AdoptionRoleSummary[];
  activities: {
    homeworkPublished: number; homeworkSubmissions: number;
    attendanceClassDays: number; attendanceStudentMarks: number;
    announcementsPublished: number;
  };
};
function asRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return (result as { rows?: Record<string, unknown>[] }).rows ?? [];
}
function dateWindow(window: AdoptionWindow, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = [part("year"), part("month"), part("day")].join("-");
  const midnight = new Date(day + "T00:00:00+04:30");
  const first = new Date(midnight.getTime() - (window === "today" ? 0 : window === "7d" ? 6 : 29) * 86_400_000);
  const firstDay = new Date(first.getTime() + 270 * 60_000).toISOString().slice(0, 10);
  return { start: first.toISOString(), end: now.toISOString(), firstDay, day };
}
export async function getPilotAdoptionReport(
  db: FoundationDatabase, schoolId: string, window: AdoptionWindow, now = new Date()
): Promise<AdoptionReport> {
  const { start, end, firstDay, day } = dateWindow(window, now);
  const rows = asRows(await db.execute(sql`
    WITH eligible AS (
      SELECT u.id, u.role, u.last_login_at, u.must_change_password
      FROM users u WHERE u.school_id = ${schoolId}::uuid AND u.status = 'ACTIVE'
      AND (
        (u.role = 'TEACHER' AND EXISTS
          (SELECT 1 FROM teacher_profiles t WHERE t.school_id = u.school_id AND t.user_id = u.id))
        OR (u.role = 'PARENT' AND EXISTS
          (SELECT 1 FROM parent_profiles p WHERE p.school_id = u.school_id AND p.user_id = u.id))
        OR (u.role = 'STUDENT' AND EXISTS (
          SELECT 1 FROM students s JOIN academic_years y
            ON y.id = s.academic_year_id AND y.school_id = s.school_id AND y.status = 'ACTIVE'
          WHERE s.school_id = u.school_id AND s.user_id = u.id AND s.status = 'ACTIVE'))
      )
    ), roles AS (
      SELECT role, count(*)::int AS eligible,
        count(*) FILTER (WHERE last_login_at BETWEEN ${start}::timestamptz
          AND ${end}::timestamptz)::int AS signed_in,
        count(*) FILTER (WHERE NOT must_change_password)::int AS activated
      FROM eligible GROUP BY role
    )
    SELECT
      (SELECT coalesce(json_agg(json_build_object('role', role,
        'eligible', eligible, 'signedIn', signed_in, 'activated', activated)), '[]'::json)
        FROM roles) AS role_counts,
      (SELECT count(*)::int FROM homeworks h JOIN academic_years y
        ON y.id = h.academic_year_id AND y.school_id = h.school_id AND y.status = 'ACTIVE'
        WHERE h.school_id = ${schoolId}::uuid
          AND h.published_at BETWEEN ${start}::timestamptz AND ${end}::timestamptz)
        AS homework_published,
      (SELECT count(*)::int FROM homework_submissions hs
        JOIN homeworks h ON h.id = hs.homework_id AND h.school_id = hs.school_id
        JOIN academic_years y
          ON y.id = h.academic_year_id AND y.school_id = h.school_id AND y.status = 'ACTIVE'
        WHERE hs.school_id = ${schoolId}::uuid
          AND hs.submitted_at BETWEEN ${start}::timestamptz AND ${end}::timestamptz)
        AS homework_submissions,
      (SELECT count(*)::int FROM daily_attendances d JOIN academic_years y
        ON y.id = d.academic_year_id AND y.school_id = d.school_id AND y.status = 'ACTIVE'
        WHERE d.school_id = ${schoolId}::uuid AND d.date BETWEEN ${firstDay}::date AND ${day}::date
          AND d.submitted_at <= ${end}::timestamptz) AS attendance_days,
      (SELECT count(*)::int FROM student_attendances s JOIN daily_attendances d
        ON d.id = s.attendance_id AND d.school_id = s.school_id
        JOIN academic_years y ON y.id = d.academic_year_id AND y.school_id = d.school_id AND y.status = 'ACTIVE'
        WHERE s.school_id = ${schoolId}::uuid AND d.date BETWEEN ${firstDay}::date AND ${day}::date
          AND d.submitted_at <= ${end}::timestamptz) AS attendance_marks,
      (SELECT count(*)::int FROM announcements a WHERE a.school_id = ${schoolId}::uuid
        AND a.archived_at IS NULL
        AND a.publish_at BETWEEN ${start}::timestamptz AND ${end}::timestamptz)
        AS announcements_published
  `));
  const data = rows[0] ?? {};
  const raw = data.role_counts;
  const rolesRaw: Record<string, unknown>[] = Array.isArray(raw) ? raw as Record<string, unknown>[] :
    typeof raw === "string" ? JSON.parse(raw) as Record<string, unknown>[] : [];
  const num = (obj: Record<string, unknown>, key: string) => Number(obj[key] ?? 0);
  const roles: AdoptionRoleSummary[] = (["TEACHER", "PARENT", "STUDENT"] as const).map((role) => {
    const entry = rolesRaw.find((r) => r.role === role) ?? {};
    const eligible = num(entry, "eligible"), signedIn = num(entry, "signedIn");
    const activated = num(entry, "activated");
    return { role, eligible, signedIn, activated,
      signedInPercent: eligible ? Math.round(signedIn / eligible * 100) : null,
      activatedPercent: eligible ? Math.round(activated / eligible * 100) : null };
  });
  return { window, startAt: start, endAt: end, timeZone: "Asia/Kabul", roles,
    activities: {
      homeworkPublished: num(data, "homework_published"),
      homeworkSubmissions: num(data, "homework_submissions"),
      attendanceClassDays: num(data, "attendance_days"),
      attendanceStudentMarks: num(data, "attendance_marks"),
      announcementsPublished: num(data, "announcements_published")
    }
  };
}
