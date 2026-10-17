import type {
  HomeworkPayload, HomeworkStatus, HomeworkSubmissionPayload, TeacherLearningPayload
} from "./api";

export type HomeworkDeadlineFilter = "ALL" | "DUE_SOON" | "OVERDUE";
export type SubmissionFilter = "ALL" | "SUBMITTED" | "REVIEWED" | "REVISION_REQUESTED" | "MISSING";
export type StudentIdentity = { id: string; fullName: string; studentCode: string };
export type HomeworkSubmissionEntry = { submission: HomeworkSubmissionPayload; student: StudentIdentity };
export type SubmissionRow = { student: StudentIdentity; submission: HomeworkSubmissionPayload | null };

const SOON_MS = 48 * 60 * 60 * 1000;
const normalize = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase();
const dueTime = (item: HomeworkPayload) => {
  const value = Date.parse(item.dueAt);
  return Number.isFinite(value) ? value : null;
};

/** Deadline urgency describes published, still-open homework only.
 * It does NOT infer whether a particular student has submitted. */
export function homeworkDeadline(item: HomeworkPayload, now: number): HomeworkDeadlineFilter {
  if (item.status !== "PUBLISHED" || !Number.isFinite(now)) return "ALL";
  const due = dueTime(item);
  if (due === null) return "ALL";
  if (due < now) return "OVERDUE";
  if (due <= now + SOON_MS) return "DUE_SOON";
  return "ALL";
}

export function teacherHomeworkOverview(homeworks: readonly HomeworkPayload[], now: number) {
  return {
    total: homeworks.length,
    drafts: homeworks.filter(item => item.status === "DRAFT").length,
    published: homeworks.filter(item => item.status === "PUBLISHED").length,
    dueSoon: homeworks.filter(item => homeworkDeadline(item, now) === "DUE_SOON").length,
    overdue: homeworks.filter(item => homeworkDeadline(item, now) === "OVERDUE").length
  };
}

export function teacherHomeworkList(
  homeworks: readonly HomeworkPayload[],
  assignments: TeacherLearningPayload["assignments"],
  query: string,
  status: HomeworkStatus | "ALL",
  assignmentId: string | "ALL",
  deadline: HomeworkDeadlineFilter,
  now: number
): HomeworkPayload[] {
  const term = normalize(query);
  const byId = new Map(assignments.map(item => [item.assignmentId, item]));
  return homeworks.filter(item => {
    if (!byId.has(item.assignmentId)) return false; // Only currently assigned subjects.
    if (status !== "ALL" && status !== item.status) return false;
    if (assignmentId !== "ALL" && item.assignmentId !== assignmentId) return false;
    if (deadline !== "ALL" && homeworkDeadline(item, now) !== deadline) return false;
    const assignment = byId.get(item.assignmentId)!;
    return !term || [item.title, item.content, assignment.className,
      assignment.classCode, assignment.subjectName].some(value => normalize(value).includes(term));
  }).sort((a,b) => (dueTime(a) ?? Number.MAX_SAFE_INTEGER) -
    (dueTime(b) ?? Number.MAX_SAFE_INTEGER) || b.createdAt.localeCompare(a.createdAt));
}

/** A missing row requires a successfully loaded, teacher-authorized active roster.
 * Null roster means UNKNOWN, never zero non-submitters. */
export function teacherSubmissionOverview(
  entries: readonly HomeworkSubmissionEntry[],
  roster: readonly StudentIdentity[] | null,
  query: string,
  filter: SubmissionFilter
) {
  const byStudent = new Map<string,SubmissionRow>();
  for (const entry of entries) {
    if (!byStudent.has(entry.student.id)) byStudent.set(entry.student.id, entry);
  }
  if (roster !== null) {
    for (const student of roster) {
      if (!byStudent.has(student.id)) byStudent.set(student.id, { student, submission: null });
    }
  }
  const rows = [...byStudent.values()];
  const counts = {
    submitted: rows.filter(row => row.submission !== null).length,
    pending: rows.filter(row => row.submission?.status === "SUBMITTED").length,
    reviewed: rows.filter(row => row.submission?.status === "REVIEWED").length,
    revision: rows.filter(row => row.submission?.status === "REVISION_REQUESTED").length,
    missing: roster === null ? null : rows.filter(row => row.submission === null).length
  };
  const term = normalize(query);
  return {
    counts,
    rows: rows.filter(row => {
      if (term && ![row.student.fullName, row.student.studentCode].some(value =>
        normalize(value).includes(term))) return false;
      return filter === "ALL" ||
        (filter === "MISSING" ? row.submission === null && roster !== null :
          row.submission?.status === filter);
    }).sort((a,b) => {
      const rank = (row:SubmissionRow) => row.submission?.status === "SUBMITTED" ? 0 :
        row.submission?.status === "REVISION_REQUESTED" ? 1 :
        row.submission?.status === "REVIEWED" ? 2 : 3;
      return rank(a)-rank(b) || a.student.fullName.localeCompare(b.student.fullName) ||
        a.student.id.localeCompare(b.student.id);
    })
  };
}
