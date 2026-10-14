import type {
  AnnouncementPayload, AttendanceStatus, FeeInvoiceViewPayload,
  LearnerAcademicPayload, ParentNotification, ParentTimetablePeriod
} from "./api";

export type ParentHomeResource =
  | "attendance" | "timetable" | "learning" | "announcements" | "fees" | "notifications";
export type ParentHomeResourceStatus = "idle" | "loading" | "ready" | "error";
export type ParentHomeResourceMap = Record<ParentHomeResource, ParentHomeResourceStatus>;
export const initialParentResources: ParentHomeResourceMap = {
  attendance: "idle", timetable: "idle", learning: "idle",
  announcements: "idle", fees: "idle", notifications: "idle"
};
export function loadingParentChildResources(): ParentHomeResourceMap {
  return { attendance: "loading", timetable: "loading", learning: "loading",
    announcements: "loading", fees: "loading", notifications: "idle" };
}

type Day = string;
type Weekday = ParentTimetablePeriod["period"]["weekday"];
const weekdays: Weekday[] = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
export function weekdayForSchoolDate(schoolDay: string): Weekday | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(schoolDay)) return null;
  const d = new Date(schoolDay+"T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===schoolDay
    ? weekdays[d.getUTCDay()] ?? null : null;
}
export function kabulCivilDay(value: string): Day | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return weekdayForSchoolDate(value) ? value : null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:"Asia/Kabul", year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date);
  const pick=(type:string)=>parts.find(item=>item.type===type)?.value;
  const y=pick("year"),m=pick("month"),d=pick("day");
  return y&&m&&d ? `${y}-${m}-${d}` : null;
}
function daysUntil(day: string, today: string): number | null {
  if (!weekdayForSchoolDate(day)||!weekdayForSchoolDate(today)) return null;
  return Math.round((Date.parse(day+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000);
}
export type ParentHomeAlert = {
  id: string;
  kind: "attendance" | "homework" | "fees" | "notifications";
  tone: "danger" | "warning" | "brand";
  label: "parent.alertAbsent" | "parent.alertLate" |
    "parent.alertHomeworkToday" | "parent.alertHomeworkTomorrow" |
    "parent.alertFeeOverdue" | "parent.alertFeeSoon" | "parent.alertUnread";
  detail?: string;
  destination: "ATTENDANCE" | "ACADEMICS" | "INBOX" | "MORE";
  section?: "HOMEWORK" | "NOTIFICATIONS";
};
export interface ParentHomeView {
  todayPeriods: ParentTimetablePeriod[];
  homework: LearnerAcademicPayload["homework"][number] | null;
  latestResult: LearnerAcademicPayload["results"][number] | null;
  latestAnnouncement: AnnouncementPayload | null;
  outstanding: number;
  unreadCount: number;
  alerts: ParentHomeAlert[];
}
export function buildParentHomeView(input: {
  classId: string; todayDate: string; todayAttendance: AttendanceStatus | null;
  timetable: ParentTimetablePeriod[]; learning: LearnerAcademicPayload | null;
  announcements: AnnouncementPayload[]; fees: FeeInvoiceViewPayload[];
  notifications: ParentNotification[];
  available: { attendance:boolean; timetable:boolean; learning:boolean;
    announcements:boolean; fees:boolean; notifications:boolean; };
}): ParentHomeView {
  const { todayDate,available }=input;
  const weekday=weekdayForSchoolDate(todayDate);
  const todayPeriods=available.timetable&&weekday
    ? input.timetable.filter(item=>item.period.weekday===weekday)
      .sort((a,b)=>a.period.startsAt.localeCompare(b.period.startsAt))
    : [];
  const pendingHomework=available.learning ? [...(input.learning?.homework??[])]
    .filter(row=>row.homework.status==="PUBLISHED" && !!kabulCivilDay(row.homework.dueAt))
    .sort((a,b)=>Date.parse(a.homework.dueAt)-Date.parse(b.homework.dueAt)) : [];
  const upcoming=pendingHomework.filter(item=>{
    const due=kabulCivilDay(item.homework.dueAt);
    return due && (daysUntil(due,todayDate)??-1)>=0;
  });
  const homework=upcoming[0]??null;
  const latestResult=available.learning
    ? [...(input.learning?.results??[])].filter(x=>x.grade.status==="PUBLISHED")
        .sort((a,b)=>Date.parse(b.grade.publishedAt??"")-Date.parse(a.grade.publishedAt??""))[0]??null
    : null;
  const visible=available.announcements ? input.announcements
    .filter(item=>!item.archivedAt && (item.audienceScope!=="CLASS"||item.classId===input.classId))
    .sort((a,b)=>Date.parse(b.publishAt)-Date.parse(a.publishAt)) : [];
  const outstanding=available.fees?input.fees.reduce((sum,item)=>
    sum+(item.invoice.status!=="CANCELLED"?Math.max(0,item.outstanding):0),0):0;
  const unreadCount=available.notifications?input.notifications.filter(x=>!x.readAt).length:0;
  const alerts:ParentHomeAlert[]=[];
  if(available.attendance && input.todayAttendance==="ABSENT") alerts.push({
    id:"today-absent",kind:"attendance",tone:"danger",label:"parent.alertAbsent",destination:"ATTENDANCE"
  });
  if(available.attendance && input.todayAttendance==="LATE") alerts.push({
    id:"today-late",kind:"attendance",tone:"warning",label:"parent.alertLate",destination:"ATTENDANCE"
  });
  if(available.learning && upcoming.length){
    const due=kabulCivilDay(upcoming[0]!.homework.dueAt);
    const remaining=due?daysUntil(due,todayDate):null;
    if(remaining===0||remaining===1)alerts.push({
      id:"homework-"+upcoming[0]!.homework.id,kind:"homework",tone:"warning",
      label:remaining===0?"parent.alertHomeworkToday":"parent.alertHomeworkTomorrow",
      detail:upcoming[0]!.homework.title,destination:"ACADEMICS",section:"HOMEWORK"
    });
  }
  if(available.fees){
    const unpaid=input.fees.filter(item=>item.outstanding>0
      && item.invoice.status!=="DRAFT" && item.invoice.status!=="CANCELLED");
    const overdue=unpaid.find(item=>{
      const n=daysUntil(item.invoice.dueDate,todayDate);
      return n!==null&&n<0;
    });
    const soon=unpaid.find(item=>{
      const n=daysUntil(item.invoice.dueDate,todayDate);
      return n!==null&&n>=0&&n<=2;
    });
    const due=overdue??soon;
    if(due)alerts.push({
      id:"fee-"+due.invoice.id,kind:"fees",tone:overdue?"danger":"warning",
      label:overdue?"parent.alertFeeOverdue":"parent.alertFeeSoon",
      detail:due.invoice.description??undefined,destination:"MORE"
    });
  }
  if(unreadCount>0)alerts.push({
    id:"unread-notifications",kind:"notifications",tone:"brand",
    label:"parent.alertUnread",destination:"INBOX",section:"NOTIFICATIONS"
  });
  const severity={danger:0,warning:1,brand:2};
  alerts.sort((a,b)=>severity[a.tone]-severity[b.tone]);
  return {todayPeriods,homework,latestResult,latestAnnouncement:visible[0]??null,
    outstanding,unreadCount,alerts:alerts.slice(0,4)};
}
