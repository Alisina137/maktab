import type {
  HomeworkSubmissionPayload, LearnerAcademicPayload
} from "./api";
import { studentDueDay } from "./student-home-model";

export type HomeworkStudentTab = "TO_DO" | "SUBMITTED" | "REVISION" | "COMPLETED";
export type HomeworkStudentState =
  "TO_DO" | "OVERDUE" | "SUBMITTED" | "REVISION" | "REVIEWED" | "CLOSED";
export const studentHomeworkTabs: readonly HomeworkStudentTab[] =
  ["TO_DO","SUBMITTED","REVISION","COMPLETED"];
export type HomeworkItem = LearnerAcademicPayload["homework"][number];
export type HomeworkRow = {
  item: HomeworkItem; submission: HomeworkSubmissionPayload | null;
  state: HomeworkStudentState; tab: HomeworkStudentTab;
  canSubmit: boolean; dueAt: number;
};

export function studentSubmissionMap(submissions: readonly HomeworkSubmissionPayload[] | null):
  Map<string,HomeworkSubmissionPayload> {
  const map = new Map<string,HomeworkSubmissionPayload>();
  for (const item of submissions ?? []) {
    const existing=map.get(item.homeworkId);
    if(!existing||Date.parse(item.submittedAt)>Date.parse(existing.submittedAt)||
      (item.submittedAt===existing.submittedAt&&item.id>existing.id)){
      map.set(item.homeworkId,item);
    }
  }
  return map;
}

/** Do not show draft or archived homework to students, even if an old
 * submission happens to exist. Closed work remains accessible as history. */
export function studentHomeworkRows(
  homework:readonly HomeworkItem[],submissions:readonly HomeworkSubmissionPayload[]|null,
  now:Date=new Date()
):HomeworkRow[] {
  const mapped=studentSubmissionMap(submissions);
  return homework
    .filter(item=>item.homework.status==="PUBLISHED"||item.homework.status==="CLOSED")
    .map(item=>{
      const submission=mapped.get(item.homework.id)??null;
      const dueAt=Date.parse(item.homework.dueAt);
      const open=item.homework.status==="PUBLISHED"&&
        Number.isFinite(dueAt)&&dueAt>=now.getTime();
      let state:HomeworkStudentState;
      if(submission?.status==="REVIEWED")state="REVIEWED";
      else if(submission?.status==="SUBMITTED")state="SUBMITTED";
      else if(submission?.status==="REVISION_REQUESTED")state="REVISION";
      else if(item.homework.status==="CLOSED")state="CLOSED";
      else state=open?"TO_DO":"OVERDUE";
      const tab:HomeworkStudentTab=
        state==="REVIEWED"||state==="CLOSED"?"COMPLETED":
        state==="SUBMITTED"?"SUBMITTED":
        state==="REVISION"?"REVISION":"TO_DO";
      return {item,submission,state,tab,
        canSubmit:open&&(submission===null||submission.status==="REVISION_REQUESTED"),
        dueAt:Number.isFinite(dueAt)?dueAt:Infinity};
    })
    .sort((a,b)=>a.dueAt-b.dueAt||
      a.item.homework.id.localeCompare(b.item.homework.id));
}

export function studentHomeworkSubjects(rows:readonly HomeworkRow[]):string[]{
  return [...new Set(rows.map(row=>row.item.subjectName).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
}
export function studentHomeworkFilter(rows:readonly HomeworkRow[],options:{
  tab:HomeworkStudentTab;subject:string|null;query:string
}):HomeworkRow[] {
  const term=options.query.trim().normalize("NFKC").toLocaleLowerCase();
  return rows.filter(row=>row.tab===options.tab&&
    (!options.subject||row.item.subjectName===options.subject)&&
    (!term||[row.item.homework.title,row.item.homework.content,
      row.item.subjectName,row.item.className].some(value=>
      value.normalize("NFKC").toLocaleLowerCase().includes(term))));
}
export function studentHomeworkCounts(rows:readonly HomeworkRow[]) {
  return studentHomeworkTabs.reduce((result,tab)=>{
    result[tab]=rows.filter(row=>row.tab===tab).length;
    return result;
  },{TO_DO:0,SUBMITTED:0,REVISION:0,COMPLETED:0} as Record<HomeworkStudentTab,number>);
}
export function studentHomeworkDeadlineState(dueAt:string,now:Date=new Date()):
  "OVERDUE"|"TODAY"|"TOMORROW"|"LATER"|"UNKNOWN" {
  const stamp=Date.parse(dueAt);
  const nowTime=now.getTime();
  if(!Number.isFinite(stamp)||!Number.isFinite(nowTime))return "UNKNOWN";
  if(stamp<nowTime)return "OVERDUE";
  const today=studentDueDay(now.toISOString()),dueDay=studentDueDay(dueAt);
  if(!today||!dueDay)return "UNKNOWN";
  if(dueDay===today)return "TODAY";
  const next=new Date(nowTime+86_400_000);
  if(studentDueDay(next.toISOString())===dueDay)return "TOMORROW";
  return "LATER";
}
export function studentHomeworkCanSubmit(
  row:HomeworkRow,submissionsVerified:boolean
):boolean {return row.canSubmit&&submissionsVerified;}
