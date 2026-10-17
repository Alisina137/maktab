import type {
  AnnouncementPayload, HomeworkSubmissionPayload, LearnerAcademicPayload,
  StudentTimetablePayload
} from "./api";

export type StudentPeriod=StudentTimetablePayload["periods"][number];
export type StudentHomeworkItem=LearnerAcademicPayload["homework"][number];
export type StudentResultItem=LearnerAcademicPayload["results"][number];
export type StudentLessonState="CURRENT"|"NEXT"|"DONE"|"NONE"|"UNKNOWN";
export interface StudentSchoolClock {
  day:string; weekday:string; minutes:number;
}
/** Resolve all urgency decisions against school-local time, never the phone timezone. */
export function studentSchoolClock(now:Date):StudentSchoolClock|null {
  if(!Number.isFinite(now.getTime()))return null;
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit",
    weekday:"long",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(now);
  const get=(key:string)=>parts.find(part=>part.type===key)?.value??"";
  const hour=Number(get("hour")),minute=Number(get("minute"));
  if(!get("year")||!get("month")||!get("day")||
    !Number.isInteger(hour)||!Number.isInteger(minute)||hour>23||minute>59)return null;
  return {day:`${get("year")}-${get("month")}-${get("day")}`,
    weekday:get("weekday").toUpperCase(),minutes:hour*60+minute};
}
function minutes(value:string):number|null{
  const match=/^(\d{1,2}):(\d{2})$/.exec(value);
  if(!match)return null;
  const hour=Number(match[1]),minute=Number(match[2]);
  return hour<24&&minute<60?hour*60+minute:null;
}
export function studentTodayLessons(timetable:StudentTimetablePayload|null,now:Date=new Date()) {
  const clock=studentSchoolClock(now);
  if(!timetable||!clock)return [] as StudentPeriod[];
  return timetable.periods.filter(item=>item.period.weekday===clock.weekday)
    .sort((a,b)=>a.period.startsAt.localeCompare(b.period.startsAt)||
      a.period.id.localeCompare(b.period.id));
}
export function studentLessonFocus(timetable:StudentTimetablePayload|null,now:Date=new Date()):
  {state:StudentLessonState;period:StudentPeriod|null;todayCount:number;completed:number} {
  const clock=studentSchoolClock(now);
  if(!clock||!timetable)return {state:"UNKNOWN",period:null,todayCount:0,completed:0};
  const today=studentTodayLessons(timetable,now);
  const periods=today.map(item=>({
    item,start:minutes(item.period.startsAt),end:minutes(item.period.endsAt)
  })).filter((x):x is {item:StudentPeriod;start:number;end:number}=>
    x.start!==null&&x.end!==null&&x.end>x.start);
  const completed=periods.filter(x=>x.end<=clock.minutes).length;
  const current=periods.find(x=>x.start<=clock.minutes&&clock.minutes<x.end);
  if(current)return {state:"CURRENT",period:current.item,todayCount:periods.length,completed};
  const next=periods.find(x=>x.start>clock.minutes);
  if(next)return {state:"NEXT",period:next.item,todayCount:periods.length,completed};
  return {state:periods.length?"DONE":"NONE",period:null,
    todayCount:periods.length,completed};
}
export function studentDueDay(iso:string):string|null {
  const date=new Date(iso);return studentSchoolClock(date)?.day??null;
}
function isPublished(item:StudentHomeworkItem):boolean {
  return item.homework.status==="PUBLISHED";
}
/** If the submission API failed, counts requiring submission are unknown, not zero. */
export function studentHomeworkOverview(
  homework:readonly StudentHomeworkItem[],
  submissions:readonly HomeworkSubmissionPayload[]|null,
  now:Date=new Date()
) {
  const stamp=now.getTime(),day=studentSchoolClock(now)?.day??null;
  const byHomework=new Map(submissions?.map(item=>[item.homeworkId,item])??[]);
  const active=homework.filter(isPublished);
  const needsAction=(item:StudentHomeworkItem)=>{
    const submission=byHomework.get(item.homework.id);
    return !submission||submission.status==="REVISION_REQUESTED";
  };
  const sorted=[...active].filter(item=>submissions===null||needsAction(item))
    .sort((a,b)=>{
      const dueDiff=Date.parse(a.homework.dueAt)-Date.parse(b.homework.dueAt);
      return (Number.isFinite(dueDiff)?dueDiff:0)||
        a.homework.id.localeCompare(b.homework.id);
    });
  const upcoming=sorted.find(item=>Date.parse(item.homework.dueAt)>=stamp)??null;
  const overdue=sorted.filter(item=>Date.parse(item.homework.dueAt)<stamp);
  const dueToday=sorted.filter(item=>studentDueDay(item.homework.dueAt)===day);
  const actionable=submissions===null?null:active.filter(item=>needsAction(item)&&Date.parse(item.homework.dueAt)>=stamp).length;
  const reviewed=submissions===null?null:active.filter(item=>
    byHomework.get(item.homework.id)?.status==="REVIEWED").length;
  const submitted=submissions===null?null:active.filter(item=>
    byHomework.get(item.homework.id)?.status==="SUBMITTED").length;
  const revision=submissions===null?null:active.filter(item=>
    byHomework.get(item.homework.id)?.status==="REVISION_REQUESTED").length;
  return {
    upcoming,overdue:submissions===null?null:overdue.length,
    dueToday:submissions===null?null:dueToday.length,
    pending:actionable,submitted,reviewed,revision,
    publishedCount:active.length,
    completionPercent:submissions===null||active.length===0?null:
      Math.round((reviewed??0)/active.length*100)
  };
}
export function studentPublishedResults(results:readonly StudentResultItem[]) {
  return results.filter(item=>item.grade.status==="PUBLISHED"&&
    (item.exam.status==="PUBLISHED"||item.exam.status==="ARCHIVED")&&
    item.examSubject.maxScore>0&&Number.isFinite(item.examSubject.maxScore)&&
    item.grade.score>=0&&Number.isFinite(item.grade.score)&&
    item.grade.score<=item.examSubject.maxScore);
}
export function studentAcademicOverview(results:readonly StudentResultItem[]) {
  const published=studentPublishedResults(results);
  const total=published.reduce((sum,item)=>sum+item.grade.score,0);
  const max=published.reduce((sum,item)=>sum+item.examSubject.maxScore,0);
  const latest=[...published].sort((a,b)=>{
    const first=b.grade.publishedAt??b.exam.publishedAt??"";
    const second=a.grade.publishedAt??a.exam.publishedAt??"";
    return first.localeCompare(second)||a.grade.id.localeCompare(b.grade.id);
  })[0]??null;
  const bySubject=new Map<string,{name:string;score:number;max:number}>();
  for(const item of published){
    const id=item.examSubject.subjectId;
    const previous=bySubject.get(id)??{name:item.subjectName,score:0,max:0};
    previous.score+=item.grade.score;
    previous.max+=item.examSubject.maxScore;
    bySubject.set(id,previous);
  }
  const lowest=[...bySubject.values()].sort((a,b)=>a.score/a.max-b.score/b.max||
    a.name.localeCompare(b.name))[0]??null;
  return {
    publishedCount:published.length,latest,
    percent:max>0?Math.round(total/max*100):null,
    subjectCount:bySubject.size,
    focusSubject:lowest?.name??null,
    focusPercent:lowest?Math.round(lowest.score/lowest.max*100):null
  };
}
export function studentLatestAnnouncement(
  announcements:readonly AnnouncementPayload[],classId:string|null
) {
  return [...announcements].filter(item=>!item.archivedAt&&
    (item.audienceScope!=="CLASS"||(classId!==null&&item.classId===classId)))
    .sort((a,b)=>b.publishAt.localeCompare(a.publishAt)||b.id.localeCompare(a.id))[0]??null;
}
