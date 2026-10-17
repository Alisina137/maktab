import type {
  ContinuousAssessmentPayload, ContinuousAssessmentSheetPayload,
  GradeSheetPayload, TeacherLearningPayload
} from "./api";
import { pendingGradeEntries, type GradeDrafts } from "./learning-workflow";

type ExamRow = TeacherLearningPayload["examSubjects"][number];
export type TeacherExamStatusFilter = "ALL" | "OPEN" | "READ_ONLY";
export type AssessmentCategoryFilter = ContinuousAssessmentPayload["category"] | "ALL";

function searchText(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}

/** Restrict the Work > Marks directory to the teacher's current subject assignment.
 * Backend authorization remains the source of truth for sheet access. */
export function teacherExamDirectory(
  exams: readonly ExamRow[],
  assignments: TeacherLearningPayload["assignments"],
  selectedAssignmentId: string,
  search: string,
  status: TeacherExamStatusFilter
): ExamRow[] {
  if (!selectedAssignmentId) return [];
  const assignment = assignments.find(item => item.assignmentId === selectedAssignmentId);
  if (!assignment) return [];
  const term = searchText(search);
  return exams.filter(item =>
    item.exam.academicYearId === assignment.academicYearId &&
    item.examSubject.classId === assignment.classId &&
    item.examSubject.subjectId === assignment.subjectId &&
    (status === "ALL" ||
      (status === "OPEN" && item.exam.status === "IN_PROGRESS") ||
      (status === "READ_ONLY" && item.exam.status !== "IN_PROGRESS")) &&
    (!term || [item.exam.name, item.className, item.classCode, item.subjectName,
      item.exam.type].some(text => searchText(text).includes(term)))
  ).sort((a,b) =>
    (a.examSubject.examDate ?? "9999").localeCompare(b.examSubject.examDate ?? "9999") ||
    a.exam.name.localeCompare(b.exam.name));
}

/** Scores are private and preliminary until the school publishes results.
 * Average is only over valid recorded marks, never over absent students. */
export function teacherGradeSummary(sheet: GradeSheetPayload, drafts?: GradeDrafts) {
  const max=sheet.examSubject.maxScore;
  const valid=Number.isFinite(max) && max>0;
  const values=valid ? sheet.students
    .filter(item => item.grade !== null && Number.isFinite(item.grade.score) &&
      item.grade.score>=0 && item.grade.score<=max)
    .map(item => item.grade!.score/max*100) : [];
  const recorded=sheet.students.filter(item => item.grade!==null).length;
  const validAverage=values.length>0
    ? Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*10)/10 : null;
  const pending=drafts && sheet.canEdit ? pendingGradeEntries(sheet,drafts) : null;
  return {
    total:sheet.students.length,
    recorded,
    missing:sheet.students.length-recorded,
    averagePercent:validAverage,
    above80:values.filter(value=>value>=80).length,
    between60And79:values.filter(value=>value>=60&&value<80).length,
    below60:values.filter(value=>value<60).length,
    pendingChanges:pending?.invalid?null:pending?.entries.length??0,
    invalidDrafts:pending?.invalid??false
  };
}

export function teacherGradeStudents(
  sheet: GradeSheetPayload, query: string, missingOnly: boolean
) {
  const term=searchText(query);
  return sheet.students.filter(item =>
    (!missingOnly || item.grade === null) &&
    (!term || [item.student.fullName,item.student.studentCode].some(value =>
      searchText(value).includes(term)))
  ).sort((a,b)=>a.student.fullName.localeCompare(b.student.fullName) ||
    a.student.id.localeCompare(b.student.id));
}

export function teacherAssessmentDirectory(
  items: readonly ContinuousAssessmentPayload[], assignmentId:string,
  category:AssessmentCategoryFilter, query:string
) {
  const term=searchText(query);
  return items.filter(item =>
    item.assignmentId===assignmentId &&
    (category==="ALL" || item.category===category) &&
    (!term || [item.title,item.category,item.assessedOn].some(value=>
      searchText(value).includes(term)))
  ).sort((a,b)=>b.assessedOn.localeCompare(a.assessedOn) ||
    a.title.localeCompare(b.title));
}
export type AssessmentScoreDraft = {
  scores:Record<string,string>;
  remarks:Record<string,string>;
};
export function teacherAssessmentDrafts(sheet:ContinuousAssessmentSheetPayload):AssessmentScoreDraft {
  return {
    scores:Object.fromEntries(sheet.students.map(row=>[
      row.student.id,row.score===null?"":String(row.score.score)
    ])),
    remarks:Object.fromEntries(sheet.students.map(row=>[
      row.student.id,row.score?.remark??""
    ]))
  };
}

export function teacherAssessmentChanges(
  sheet:ContinuousAssessmentSheetPayload,
  drafts:AssessmentScoreDraft
):{entries:Array<{studentId:string;score:number;remark?:string}>;invalid:boolean} {
  const entries:Array<{studentId:string;score:number;remark?:string}>=[];
  const max=sheet.assessment.maxScore;
  if(!Number.isSafeInteger(max)||max<1)return {entries:[],invalid:true};
  for(const row of sheet.students){
    const value=(drafts.scores[row.student.id]??"").trim();
    const remark=(drafts.remarks[row.student.id]??"").trim();
    if(!value){
      // Missing marks may remain blank; existing recorded marks cannot be erased
      // through an update-only endpoint.
      if(row.score!==null||remark)return {entries:[],invalid:true};
      continue;
    }
    if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||
      Number(value)>max||remark.length>500)return {entries:[],invalid:true};
    if(row.score?.score!==Number(value)||(row.score?.remark??"")!==remark){
      entries.push({studentId:row.student.id,score:Number(value),remark});
    }
  }
  return {entries,invalid:false};
}

export function teacherAssessmentSummary(
  sheet:ContinuousAssessmentSheetPayload, drafts:AssessmentScoreDraft
) {
  const valid=Number.isFinite(sheet.assessment.maxScore)&&sheet.assessment.maxScore>0;
  const values=valid?sheet.students.filter(row=>row.score!==null &&
    Number.isFinite(row.score.score)&&row.score.score>=0&&
    row.score.score<=sheet.assessment.maxScore)
    .map(row=>row.score!.score/sheet.assessment.maxScore*100):[];
  const changes=teacherAssessmentChanges(sheet,drafts);
  return {
    total:sheet.students.length,
    recorded:sheet.students.filter(row=>row.score!==null).length,
    missing:sheet.students.filter(row=>row.score===null).length,
    averagePercent:values.length>0
      ? Math.round(values.reduce((n,x)=>n+x,0)/values.length*10)/10 : null,
    pendingChanges:changes.invalid?null:changes.entries.length,
    invalidDrafts:changes.invalid
  };
}

export function teacherAssessmentStudents(
  sheet:ContinuousAssessmentSheetPayload, query:string, missingOnly:boolean
) {
  const term=searchText(query);
  return sheet.students.filter(row=>
    (!missingOnly || row.score===null) &&
    (!term || [row.student.fullName,row.student.studentCode].some(value=>
      searchText(value).includes(term)))
  ).sort((a,b)=>a.student.fullName.localeCompare(b.student.fullName) ||
    a.student.id.localeCompare(b.student.id));
}

/** Gregorian date validation for the API; the date picker provides
 * calendar localization, this protects manual or restored input. */
export function teacherAssessmentDateValid(value:string) {
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(!match)return false;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&
    date.getUTCDate()===day;
}
