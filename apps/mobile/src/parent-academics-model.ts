import type { LearnerAcademicPayload, ParentTimetablePeriod } from "./api";
import { kabulCivilDay, weekdayForSchoolDate } from "./parent-home-model";

export type HomeworkItem = LearnerAcademicPayload["homework"][number];
export type ResultItem = LearnerAcademicPayload["results"][number];
export type HomeworkView = "ALL" | "UPCOMING" | "PAST" | "CLOSED";
export type Weekday = ParentTimetablePeriod["period"]["weekday"];
export const schoolWeekdays: Weekday[] = [
  "SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"
];

export function parentHomeworkItems(learning: LearnerAcademicPayload | null): HomeworkItem[] {
  return (learning?.homework ?? []).filter(item =>
    item.homework.status === "PUBLISHED" || item.homework.status === "CLOSED"
  );
}

export function homeworkCategory(item: HomeworkItem, schoolToday: string): Exclude<HomeworkView,"ALL"> {
  if (item.homework.status === "CLOSED") return "CLOSED";
  const due = kabulCivilDay(item.homework.dueAt);
  // Unknown due dates must not be labeled overdue.
  return due && due < schoolToday ? "PAST" : "UPCOMING";
}

export function filterParentHomework(
  items: HomeworkItem[], options: {
    category: HomeworkView; subjectId: string | null; query: string; today: string;
  }
): HomeworkItem[] {
  const normalized = options.query.trim().toLocaleLowerCase();
  return items.filter(item =>
    (item.homework.status === "PUBLISHED" || item.homework.status === "CLOSED") &&
    (options.category === "ALL" || homeworkCategory(item, options.today) === options.category) &&
    (!options.subjectId || item.homework.subjectId === options.subjectId) &&
    (!normalized || [item.homework.title, item.subjectName, item.homework.content]
      .some(value => value.toLocaleLowerCase().includes(normalized)))
  ).sort((a,b) => {
    // Upcoming items are nearest due first; past/closed are most recent first.
    const direction = options.category === "PAST" || options.category === "CLOSED" ? -1 : 1;
    const diff = direction * (Date.parse(a.homework.dueAt) - Date.parse(b.homework.dueAt));
    return (Number.isFinite(diff) && diff !== 0 ? diff : a.homework.id.localeCompare(b.homework.id));
  });
}

export type PublishedExamGroup = {
  id: string; name: string; type: string; publishedAt: string | null;
  rows: ResultItem[]; score: number; maximum: number;
};

/** Only school-published grades belonging to released or archived exams. */
export function groupParentResults(learning: LearnerAcademicPayload | null): PublishedExamGroup[] {
  const groups = new Map<string, PublishedExamGroup>();
  for (const row of learning?.results ?? []) {
    if (row.grade.status !== "PUBLISHED" ||
      (row.exam.status !== "PUBLISHED" && row.exam.status !== "ARCHIVED")) continue;
    const group = groups.get(row.exam.id) ?? {
      id: row.exam.id, name: row.exam.name, type: row.exam.type,
      publishedAt: row.exam.publishedAt, rows: [], score: 0, maximum: 0
    };
    group.rows.push(row);
    group.score += row.grade.score;
    group.maximum += row.examSubject.maxScore;
    groups.set(group.id, group);
  }
  return [...groups.values()]
    .map(group => ({ ...group, rows: group.rows.sort((a,b) =>
      a.subjectName.localeCompare(b.subjectName) || a.grade.id.localeCompare(b.grade.id)) }))
    .sort((a,b) => {
      const difference = Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? "");
      return Number.isFinite(difference) && difference !== 0
        ? difference : a.name.localeCompare(b.name);
    });
}

export function filterParentResults(
  groups: PublishedExamGroup[], examId: string | null, subjectId: string | null
): PublishedExamGroup[] {
  return groups.filter(group => !examId || group.id === examId).flatMap(group => {
    const rows = group.rows.filter(row => !subjectId || row.examSubject.subjectId === subjectId);
    if (!rows.length) return [];
    return [{
      ...group, rows,
      score: rows.reduce((sum,row) => sum + row.grade.score,0),
      maximum: rows.reduce((sum,row) => sum + row.examSubject.maxScore,0)
    }];
  });
}

export function filterParentTimetable(
  periods: ParentTimetablePeriod[], weekday: Weekday | "ALL",
  subjectId: string | null
): ParentTimetablePeriod[] {
  return periods.filter(item =>
    (weekday === "ALL" || item.period.weekday === weekday) &&
    (!subjectId || item.period.subjectId === subjectId)
  ).sort((a,b) =>
    schoolWeekdays.indexOf(a.period.weekday) - schoolWeekdays.indexOf(b.period.weekday) ||
    a.period.startsAt.localeCompare(b.period.startsAt) ||
    a.period.id.localeCompare(b.period.id)
  );
}

export function defaultTimetableDay(periods: ParentTimetablePeriod[], schoolToday: string): Weekday | "ALL" {
  const today = weekdayForSchoolDate(schoolToday);
  if (today && periods.some(item => item.period.weekday === today)) return today;
  return schoolWeekdays.find(day => periods.some(item => item.period.weekday === day)) ?? "ALL";
}

export function academicSubjects(items: Array<{ id: string; name: string }>) {
  return [...new Map(items.filter(item => item.id).map(item => [item.id, item.name])).entries()]
    .map(([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name));
}
