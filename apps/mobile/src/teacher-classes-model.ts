import type { TeacherAcademicsPayload, TeacherLearningPayload } from "./api";

export type TeacherClassesFilter = "ALL" | "HOMEWORK" | "GRADING";
export type TeacherAssignment = TeacherAcademicsPayload["assignmentDetails"][number];
export interface TeacherAssignmentActivity {
  assignment: TeacherAssignment;
  homeworkDrafts: number;
  activeHomework: number;
  openExams: number;
}
export interface TeacherClassGroup {
  classId: string;
  className: string;
  classCode: string;
  subjects: TeacherAssignmentActivity[];
}
export interface TeacherClassesOverview {
  classes: TeacherClassGroup[];
  totalClasses: number;
  totalSubjects: number;
  homeworkDrafts: number;
  openExams: number;
}

function searchable(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}

/** Only group assignmentDetails already scoped to the authenticated teacher
 * by the /v1/teacher/academics endpoint. This is a client-side view, never
 * a substitute for backend permissions. */
export function teacherClassesOverview(
  academics: TeacherAcademicsPayload | null,
  learning: TeacherLearningPayload | null,
  query: string,
  filter: TeacherClassesFilter
): TeacherClassesOverview {
  const assignments = academics?.assignmentDetails ?? [];
  const homework = learning?.homeworks ?? [];
  const examSubjects = learning?.examSubjects ?? [];
  const all = assignments.map(assignment => {
    const relatedHomework = homework.filter(item =>
      item.assignmentId === assignment.assignmentId &&
      item.classId === assignment.classId &&
      item.subjectId === assignment.subjectId
    );
    const openExams = examSubjects.filter(item =>
      item.examSubject.classId === assignment.classId &&
      item.examSubject.subjectId === assignment.subjectId &&
      item.exam.academicYearId === assignment.academicYearId &&
      item.exam.status === "IN_PROGRESS"
    ).length;
    return {
      assignment,
      homeworkDrafts: relatedHomework.filter(item => item.status === "DRAFT").length,
      activeHomework: relatedHomework.filter(item => item.status === "PUBLISHED").length,
      openExams
    };
  });
  const normalized = searchable(query);
  const matches = all.filter(item => {
    const a = item.assignment;
    const search = [a.className, a.classCode, a.subjectName].some(value =>
      searchable(value).includes(normalized)
    );
    return search && (filter === "ALL" ||
      (filter === "HOMEWORK" && item.homeworkDrafts > 0) ||
      (filter === "GRADING" && item.openExams > 0));
  });
  const groups = new Map<string,TeacherClassGroup>();
  for(const item of matches) {
    const a=item.assignment;
    const existing=groups.get(a.classId) ?? {
      classId:a.classId,className:a.className,classCode:a.classCode,subjects:[]
    };
    existing.subjects.push(item);
    groups.set(a.classId,existing);
  }
  for(const group of groups.values()) {
    group.subjects.sort((a,b)=>a.assignment.subjectName.localeCompare(b.assignment.subjectName));
  }
  return {
    classes:[...groups.values()].sort((a,b)=>a.className.localeCompare(b.className)),
    totalClasses:new Set(assignments.map(item=>item.classId)).size,
    totalSubjects:assignments.length,
    homeworkDrafts:all.reduce((sum,item)=>sum+item.homeworkDrafts,0),
    openExams:all.reduce((sum,item)=>sum+item.openExams,0)
  };
}

/** Safe display value: missing marks or unknown totals must never become 0%. */
export function teacherProgressRatio(numerator:number, denominator:number):number|null {
  if(!Number.isFinite(numerator)||!Number.isFinite(denominator)||denominator<=0)
    return null;
  if(numerator<0) return null;
  return Math.max(0,Math.min(100,Math.round(100*numerator/denominator)));
}
