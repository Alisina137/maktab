import type { LearnerAcademicPayload } from "./api";
import { studentPublishedResults, type StudentResultItem } from "./student-home-model";

export type StudentResultsTab = "EXAMS" | "PERFORMANCE" | "HISTORY";
export const studentResultsTabs: readonly StudentResultsTab[] =
  ["EXAMS","PERFORMANCE","HISTORY"];

export type PublishedExamGroup = {
  id:string; name:string; type:string; publishedAt:string|null;
  results:StudentResultItem[]; score:number; maxScore:number; percent:number;
};
export type StudentSubjectPerformance = {
  subjectId:string; name:string; score:number; maxScore:number;
  percent:number; publishedMarks:number;
  latestPercent:number; previousPercent:number|null;
  trend:"UP"|"DOWN"|"SAME"|"NEW";
  timeline:Array<{id:string;exam:string;date:string|null;percent:number}>;
};
export type StudentResultHistoryEntry = {
  id:string; examName:string; subjectName:string; examType:string;
  score:number; maxScore:number; percent:number;
  publishedAt:string|null; examDate:string|null;
  remark:string|null;
};

function publishedAt(item:StudentResultItem):string|null{
  return item.grade.publishedAt??item.exam.publishedAt??item.examSubject.examDate??null;
}
function compareRecent(a:string|null,b:string|null):number {
  const ad=a?Date.parse(a):NaN,bd=b?Date.parse(b):NaN;
  if(Number.isFinite(ad)&&Number.isFinite(b))return bd-ad;
  if(Number.isFinite(ad))return -1;
  if(Number.isFinite(bd))return 1;
  return (b??"").localeCompare(a??"");
}
function resultOrder(a:StudentResultItem,b:StudentResultItem):number{
  return compareRecent(publishedAt(a),publishedAt(b))||
    a.grade.id.localeCompare(b.grade.id);
}
export function studentVisibleResults(
  payload:LearnerAcademicPayload|null
):StudentResultItem[] {
  if(!payload)return [];
  // Defense in depth: never show a result from another class, even if the API
  // accidentally includes it. Only confirmed published grades enter metrics.
  const classId=payload.student.classId;
  const unique=new Map<string,StudentResultItem>();
  for(const item of studentPublishedResults(payload.results)){
    if(item.examSubject.classId!==classId||!item.grade.id)continue;
    if(!unique.has(item.grade.id))unique.set(item.grade.id,item);
  }
  return [...unique.values()].sort(resultOrder);
}
export function studentResultsSubjects(results:readonly StudentResultItem[]):string[]{
  return [...new Set(results.map(item=>item.subjectName))]
    .sort((a,b)=>a.localeCompare(b));
}
export function studentResultsTypes(results:readonly StudentResultItem[]):string[]{
  return [...new Set(results.map(item=>item.exam.type).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
}
export function studentFilterResults(results:readonly StudentResultItem[],options:{
  subject:string|null;examType:string|null;query:string
}):StudentResultItem[]{
  const term=options.query.trim().normalize("NFKC").toLocaleLowerCase();
  return results.filter(item=>
    (options.subject===null||item.subjectName===options.subject)&&
    (options.examType===null||item.exam.type===options.examType)&&
    (!term||[item.exam.name,item.subjectName,item.exam.type,item.className]
      .some(value=>value.normalize("NFKC").toLocaleLowerCase().includes(term))));
}
export function studentExamGroups(results:readonly StudentResultItem[]):PublishedExamGroup[]{
  const grouped=new Map<string,{id:string;name:string;type:string;publishedAt:string|null;
    results:StudentResultItem[]}>();
  for(const item of results){
    const current=grouped.get(item.exam.id);
    if(current){current.results.push(item);continue;}
    grouped.set(item.exam.id,{id:item.exam.id,name:item.exam.name,type:item.exam.type,
      publishedAt:item.exam.publishedAt,results:[item]});
  }
  return [...grouped.values()].map(group=>{
    const score=group.results.reduce((total,item)=>total+item.grade.score,0);
    const maxScore=group.results.reduce((total,item)=>total+item.examSubject.maxScore,0);
    return {...group,score,maxScore,percent:maxScore>0?Math.round(score/maxScore*100):0,
      results:[...group.results].sort((a,b)=>
        a.subjectName.localeCompare(b.subjectName)||a.grade.id.localeCompare(b.grade.id))};
  }).sort((a,b)=>compareRecent(a.publishedAt,b.publishedAt)||a.id.localeCompare(b.id));
}
export function studentSubjectPerformance(
  results:readonly StudentResultItem[]
):StudentSubjectPerformance[]{
  const grouped=new Map<string,StudentResultItem[]>();
  for(const item of results){
    const current=grouped.get(item.examSubject.subjectId)??[];
    current.push(item);grouped.set(item.examSubject.subjectId,current);
  }
  return [...grouped].map(([subjectId,items])=>{
    const recent=[...items].sort(resultOrder);
    const score=recent.reduce((total,item)=>total+item.grade.score,0);
    const maxScore=recent.reduce((total,item)=>total+item.examSubject.maxScore,0);
    const latestPercent=Math.round(recent[0]!.grade.score/recent[0]!.examSubject.maxScore*100);
    const previousPercent=recent[1]
      ?Math.round(recent[1].grade.score/recent[1].examSubject.maxScore*100):null;
    const trend:StudentSubjectPerformance["trend"]=previousPercent===null?"NEW":latestPercent>previousPercent?"UP":
      latestPercent<previousPercent?"DOWN":"SAME";
    return {subjectId,name:recent[0]!.subjectName,score,maxScore,
      percent:Math.round(score/maxScore*100),publishedMarks:recent.length,
      latestPercent,previousPercent,trend,
      timeline:recent.map(item=>({
        id:item.grade.id,exam:item.exam.name,date:publishedAt(item),
        percent:Math.round(item.grade.score/item.examSubject.maxScore*100)
      }))};
  }).sort((a,b)=>a.percent-b.percent||a.name.localeCompare(b.name)||
    a.subjectId.localeCompare(b.subjectId));
}
export function studentResultHistory(
  results:readonly StudentResultItem[]
):StudentResultHistoryEntry[]{
  return [...results].sort(resultOrder).map(item=>({
    id:item.grade.id,examName:item.exam.name,subjectName:item.subjectName,
    examType:item.exam.type,score:item.grade.score,
    maxScore:item.examSubject.maxScore,
    percent:Math.round(item.grade.score/item.examSubject.maxScore*100),
    publishedAt:item.grade.publishedAt??item.exam.publishedAt,
    examDate:item.examSubject.examDate,remark:item.grade.remark
  }));
}
export function studentPublishedAverage(results:readonly StudentResultItem[]):number|null{
  if(!results.length)return null;
  const max=results.reduce((sum,item)=>sum+item.examSubject.maxScore,0);
  return max>0?Math.round(results.reduce((sum,item)=>sum+item.grade.score,0)/max*100):null;
}
