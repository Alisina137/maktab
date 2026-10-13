import type { GradeSheetPayload, HomeworkPayload, HomeworkStatus } from "./api";

const KABUL_OFFSET_MINUTES = 4 * 60 + 30;
const MS_PER_MINUTE = 60_000;

export function homeworkDueAt(date: string, time: string): string | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!day || !clock) return null;
  const y = Number(day[1]), m = Number(day[2]), d = Number(day[3]);
  const valid = new Date(Date.UTC(y, m - 1, d));
  if (valid.getUTCFullYear() !== y || valid.getUTCMonth() + 1 !== m || valid.getUTCDate() !== d) return null;
  // Kabul has a fixed UTC+04:30 offset. Do not accidentally use the
  // Android phone's timezone for school homework deadlines.
  const local = Date.UTC(y, m - 1, d, Number(clock[1]), Number(clock[2]));
  return new Date(local - KABUL_OFFSET_MINUTES * MS_PER_MINUTE).toISOString();
}

export function homeworkDueFields(value: string): { date: string; time: string } {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: "", time: "" };
  const localIso = new Date(date.getTime() + KABUL_OFFSET_MINUTES * MS_PER_MINUTE).toISOString();
  return { date: localIso.slice(0, 10), time: localIso.slice(11, 16) };
}

export function filterHomework(
  homeworks: HomeworkPayload[], query: string, status: HomeworkStatus | "ALL"
): HomeworkPayload[] {
  const term = query.trim().toLocaleLowerCase();
  return homeworks.filter((homework) =>
    (status === "ALL" || homework.status === status) &&
    (!term || [homework.title, homework.content, homework.id].some((part) =>
      part.toLocaleLowerCase().includes(term)))
  );
}

export type GradeDrafts = { scores: Record<string, string>; remarks: Record<string, string> };

export function gradeDraftsFromSheet(sheet: GradeSheetPayload): GradeDrafts {
  return {
    scores: Object.fromEntries(sheet.students.map(({ student, grade }) => [
      student.id, grade ? String(grade.score) : ""
    ])),
    remarks: Object.fromEntries(sheet.students.map(({ student, grade }) => [
      student.id, grade?.remark ?? ""
    ]))
  };
}

export function gradeProgress(sheet: GradeSheetPayload) {
  const recorded = sheet.students.filter((item) => item.grade !== null).length;
  return { recorded, missing: sheet.students.length - recorded, total: sheet.students.length };
}

export function pendingGradeEntries(sheet: GradeSheetPayload, drafts: GradeDrafts): {
  entries: Array<{ studentId: string; score: number; remark?: string }>;
  invalid: boolean;
} {
  const entries: Array<{ studentId: string; score: number; remark?: string }> = [];
  for (const { student, grade } of sheet.students) {
    const raw = (drafts.scores[student.id] ?? "").trim();
    const remark = (drafts.remarks[student.id] ?? "").trim();
    if (!raw) {
      if (grade) return { entries: [], invalid: true }; // Cannot delete an existing mark via the draft endpoint.
      if (remark) return { entries: [], invalid: true };
      continue;
    }
    const score = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(score) || score < 0 || score > sheet.examSubject.maxScore || remark.length > 500) {
      return { entries: [], invalid: true };
    }
    if (grade && grade.score === score && (grade.remark ?? "") === remark) continue;
    entries.push({ studentId: student.id, score, ...(remark ? { remark } : {}) });
  }
  return { entries, invalid: false };
}
