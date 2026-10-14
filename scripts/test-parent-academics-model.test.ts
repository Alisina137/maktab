import assert from "node:assert/strict";
import test from "node:test";
import {
  academicSubjects, defaultTimetableDay, filterParentHomework, filterParentResults,
  filterParentTimetable, groupParentResults, homeworkCategory, parentHomeworkItems,
  type HomeworkItem, type ResultItem
} from "../apps/mobile/src/parent-academics-model";
import type { LearnerAcademicPayload, ParentTimetablePeriod } from "../apps/mobile/src/api";

const due = (id: string, dueAt: string, status: HomeworkItem["homework"]["status"],
  subjectId = "math"): HomeworkItem => ({
  subjectName: subjectId === "math" ? "Math" : "Reading", className: "A",
  homework: {
    id, dueAt, status, subjectId, title: id, content: "Please read the lesson",
    schoolId: "school", classId: "class", academicYearId: "year", assignmentId: "assignment",
    teacherUserId: "teacher", attachmentUrl: null, attachmentFileId: null,
    scheduledAt: null, publishedAt: "2026-10-01T09:00:00Z",
    createdAt: "2026-09-30T09:00:00Z", updatedAt: "2026-09-30T09:00:00Z"
  }
});
const score = (
  examId: string, status: ResultItem["exam"]["status"],
  gradeStatus: ResultItem["grade"]["status"], subjectId: string, value: number, maximum: number
): ResultItem => ({
  grade: {
    id: examId + ":" + subjectId, score: value, remark: "Teacher note",
    status: gradeStatus, publishedAt: "2026-10-02T09:00:00Z"
  },
  exam: { id: examId, name: examId, type: "MONTHLY", status, publishedAt: "2026-10-02T09:00:00Z" },
  examSubject: { id: examId + ":" + subjectId, subjectId, classId: "class", maxScore: maximum,
    examDate: null },
  subjectName: subjectId, className: "Class A"
});
const lesson = (id: string, weekday: ParentTimetablePeriod["period"]["weekday"],
  startsAt: string, subjectId: string): ParentTimetablePeriod => ({
  period: { id, weekday, startsAt, endsAt: "11:00", subjectId, academicYearId: "year",
    classId: "class", teacherUserId: "teacher" },
  subjectName: subjectId, subjectCode: subjectId, teacherName: "Teacher A"
});
function learning(homework: HomeworkItem[] = [], results: ResultItem[] = []): LearnerAcademicPayload {
  return { student: { id: "student", fullName: "Child", studentCode: "1",
    academicYearId: "year", classId: "class" }, homework, results };
}

test("Homework shows only published/closed, categorizes on Kabul day, filters safely", () => {
  const items = parentHomeworkItems(learning([
    due("draft", "2026-10-16T03:00:00Z", "DRAFT"),
    due("archived", "2026-10-11T03:00:00Z", "ARCHIVED"),
    due("today", "2026-10-14T07:00:00Z", "PUBLISHED"),
    due("tomorrow", "2026-10-14T20:00:00Z", "PUBLISHED", "reading"),
    due("yesterday", "2026-10-13T07:00:00Z", "PUBLISHED"),
    due("closed", "2026-10-18T03:00:00Z", "CLOSED")
  ]));
  assert.deepEqual(items.map(x => x.homework.id), ["today", "tomorrow", "yesterday", "closed"]);
  assert.equal(homeworkCategory(items[1]!, "2026-10-14"), "UPCOMING");
  assert.equal(homeworkCategory(items[2]!, "2026-10-14"), "PAST");
  assert.equal(homeworkCategory(items[3]!, "2026-10-14"), "CLOSED");
  const filter = (category: "ALL" | "UPCOMING" | "PAST" | "CLOSED",
    subjectId: string | null = null, query = "") =>
    filterParentHomework(items, { category, subjectId, query, today: "2026-10-14" })
      .map(item => item.homework.id);
  assert.deepEqual(filter("UPCOMING"), ["today", "tomorrow"]);
  assert.deepEqual(filter("PAST"), ["yesterday"]);
  assert.deepEqual(filter("CLOSED"), ["closed"]);
  assert.deepEqual(filter("UPCOMING", "reading"), ["tomorrow"]);
  assert.deepEqual(filter("ALL", null, "please READ"), ["yesterday","today","tomorrow","closed"].sort((a,b)=>{
    const days: Record<string,string> = { yesterday:"13", today:"14",tomorrow:"15",closed:"18" };
    return days[a]!.localeCompare(days[b]!);
  }));
  assert.deepEqual(filter("ALL", null, "nonexistent"), []);
});

test("Exam reports aggregate only authorized published marks and reset totals for subject view", () => {
  const data = learning([], [
    score("released", "PUBLISHED", "PUBLISHED", "math", 80, 100),
    score("released", "PUBLISHED", "PUBLISHED", "english", 25, 50),
    score("released", "PUBLISHED", "DRAFT", "secret", 99, 100),
    score("draftExam", "DRAFT", "PUBLISHED", "secret", 99, 100),
    score("archived", "ARCHIVED", "PUBLISHED", "math", 6, 10)
  ]);
  const groups = groupParentResults(data);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(g => g.id === "released")?.rows.length, 2);
  assert.equal(groups.find(g => g.id === "released")?.score, 105);
  assert.equal(groups.find(g => g.id === "released")?.maximum, 150);
  assert.deepEqual(groupParentResults(learning([], [
    score("hidden", "RESULTS_READY", "DRAFT", "math", 60, 100)
  ])), []);
  const math = filterParentResults(groups, "released", "math");
  assert.equal(math.length, 1);
  assert.equal(math[0]?.score, 80);
  assert.equal(math[0]?.maximum, 100);
  assert.equal(filterParentResults(groups, "released", "secret").length, 0);
  assert.equal(filterParentResults(groups, "unknown", null).length, 0);
});

test("School-week timetable starts on Saturday, sorts by time, filters subject, defaults to real day", () => {
  const periods = [
    lesson("wed", "WEDNESDAY", "08:00", "math"),
    lesson("sat2", "SATURDAY", "10:00", "english"),
    lesson("sat1", "SATURDAY", "08:00", "math"),
    lesson("fri", "FRIDAY", "07:30", "math")
  ];
  assert.deepEqual(filterParentTimetable(periods, "ALL", null).map(x => x.period.id),
    ["sat1","sat2","wed","fri"]);
  assert.deepEqual(filterParentTimetable(periods, "SATURDAY", "math").map(x => x.period.id), ["sat1"]);
  assert.equal(defaultTimetableDay(periods, "2026-10-14"), "WEDNESDAY");
  assert.equal(defaultTimetableDay(periods, "2026-10-15"), "SATURDAY");
  assert.equal(defaultTimetableDay([], "2026-10-14"), "ALL");
  assert.deepEqual(periods.map(x => x.period.id), ["wed", "sat2", "sat1", "fri"]);
  assert.deepEqual(academicSubjects([{ id:"z", name:"Z" },{ id:"a", name:"A" },
    { id:"a", name:"same" }]), [{ id:"a", name:"same" },{ id:"z", name:"Z" }]);
});
