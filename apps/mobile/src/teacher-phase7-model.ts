import type {
  AnnouncementPayload, TeachingLesson, TeacherTeachingPayload, UnitState, LessonState
} from "./api";

export type TeacherLessonFilter = "ALL" | LessonState;
export type TeacherUnitFilter = "ALL" | UnitState;
export type TeacherAnnouncementScope = "ALL" | "CLASS" | "SCHOOL" | "ROLE";

/** All dates stay Gregorian at the API boundary; UI handles local calendars. */
export function teacherValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const parsed=new Date(Date.UTC(year,month-1,day));
  return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()+1===month&&
    parsed.getUTCDate()===day;
}
export function teacherValidReportRange(from:string,to:string):boolean {
  return teacherValidIsoDate(from)&&teacherValidIsoDate(to)&&from<=to;
}
export function teacherValidLessonInput(input:{
  lessonDate:string;topic:string;objective:string;materials:string;notes:string;
}):boolean {
  return teacherValidIsoDate(input.lessonDate)&&
    input.topic.trim().length>=1&&input.topic.trim().length<=160&&
    input.objective.trim().length>=1&&input.objective.trim().length<=4000&&
    input.materials.trim().length<=500&&input.notes.trim().length<=4000;
}
function normalized(term:string):string {
  return term.trim().normalize("NFKC").toLocaleLowerCase();
}
export function teacherLessonList(
  lessons:readonly TeachingLesson[],query:string,status:TeacherLessonFilter
):TeachingLesson[]{
  const term=normalized(query);
  return lessons.filter(item=>
    (status==="ALL"||item.status===status)&&
    (!term||[item.topic,item.objective,item.materials,item.notes].some(text=>
      normalized(text).includes(term)))
  ).sort((a,b)=>b.lessonDate.localeCompare(a.lessonDate)||
    a.topic.localeCompare(b.topic)||a.id.localeCompare(b.id));
}
export function teacherUnitList(
  units:TeacherTeachingPayload["units"],status:TeacherUnitFilter,query:string
):TeacherTeachingPayload["units"]{
  const term=normalized(query);
  return units.filter(item=>(status==="ALL"||item.status===status)&&
    (!term||normalized(item.unit.title).includes(term))
  ).sort((a,b)=>a.unit.sortOrder-b.unit.sortOrder||a.unit.id.localeCompare(b.unit.id));
}
export function teacherTeachingProgress(view:TeacherTeachingPayload){
  const lessons=view.lessons;
  const units=view.units;
  return {
    planned:lessons.filter(item=>item.status==="PLANNED").length,
    completed:lessons.filter(item=>item.status==="COMPLETED").length,
    postponed:lessons.filter(item=>item.status==="POSTPONED").length,
    unitTotal:units.length,
    unitCompleted:units.filter(item=>item.status==="COMPLETED").length,
    completionPercent:units.length?Math.round(units.filter(item=>
      item.status==="COMPLETED").length/units.length*100):null
  };
}
export function teacherAnnouncementValid(
  classId:string,title:string,content:string,allowedClasses:readonly string[]
):boolean {
  return allowedClasses.includes(classId)&&title.trim().length>=2&&
    title.trim().length<=160&&content.trim().length>=1&&
    content.trim().length<=10000;
}
export function teacherAnnouncementList(
  announcements:readonly AnnouncementPayload[],
  query:string,scope:TeacherAnnouncementScope
):AnnouncementPayload[]{
  const term=normalized(query);
  return announcements.filter(item=>!item.archivedAt&&
    (scope==="ALL"||item.audienceScope===scope)&&
    (!term||[item.title,item.content].some(value=>normalized(value).includes(term)))
  ).sort((a,b)=>b.publishAt.localeCompare(a.publishAt)||b.id.localeCompare(a.id));
}
