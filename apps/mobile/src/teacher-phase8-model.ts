import type {
  AnnouncementPayload, ParentNotification, TeacherAcademicsPayload,
  TeacherTodayPayload
} from "./api";

export type TeacherInboxFilter = "ALL" | "UNREAD" | "READ";
const normalize=(value:string)=>value.trim().normalize("NFKC").toLocaleLowerCase();

/** Client-only display filter. Never authorize actions or infer class membership from it. */
export function teacherInboxList(
  notifications:readonly ParentNotification[], filter:TeacherInboxFilter, search:string,
  limit=30
):ParentNotification[] {
  const term=normalize(search);
  const size=Number.isSafeInteger(limit)?Math.max(0,Math.min(limit,100)):30;
  return notifications.filter(item=>
    (filter==="ALL"||(filter==="UNREAD"?!item.readAt:!!item.readAt)) &&
    (!term||[item.title,item.message,item.type].some(text=>normalize(text).includes(term)))
  ).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id))
    .slice(0,size);
}
export function teacherUnreadCount(notifications:readonly ParentNotification[]):number{
  return notifications.filter(item=>!item.readAt).length;
}
export function teacherAnnouncementPreview(items:readonly AnnouncementPayload[], limit=10) {
  return items.filter(item=>!item.archivedAt)
    .sort((a,b)=>b.publishAt.localeCompare(a.publishAt)||b.id.localeCompare(a.id))
    .slice(0,Math.max(0,Math.min(limit,50)));
}

/** Projection of server-authorized details. Never invent teacher roles, assignments,
 * supervision, performance or permissions if these sources are not loaded. */
export function teacherProfileSummary(
  today:TeacherTodayPayload|null, academics:TeacherAcademicsPayload|null
) {
  if(!today&&!academics)return {
    employeeCode:null as string|null,fullName:null as string|null,
    assignments:null as number|null,classes:null as number|null,
    supervisionClasses:null as number|null,weeklyPeriods:null as number|null
  };
  const assigned=academics?.assignmentDetails??null;
  const classes=assigned?new Set(assigned.map(item=>item.classId)).size:null;
  return {
    employeeCode:today?.teacher.employeeCode??null,
    fullName:today?.teacher.fullName??null,
    assignments:assigned?.length??null,
    classes,
    supervisionClasses:today?.supervisedClasses.length??null,
    weeklyPeriods:academics?.schedule.length??null
  };
}

export type TeacherHubLoadStatus = "LOADING" | "READY" | "STALE" | "ERROR";
/** Keep the last successful data on transient errors, but surface stale state.
 * A failed first fetch must not show an inaccurate empty dashboard. */
export function teacherHubLoadStatus(hadData:boolean, requestFailed:boolean):TeacherHubLoadStatus {
  return requestFailed?(hadData?"STALE":"ERROR"):"READY";
}
