import type {AnnouncementPayload,ParentNotification} from "./api";
export const STUDENT_INBOX_PAGE_SIZE=20;
export type StudentReadFilter="ALL"|"UNREAD"|"READ";
export type StudentTopicFilter="ALL"|"SCHOOL"|"ACADEMICS"|"ATTENDANCE"|"FEES";
export type StudentAnnouncementFilter="ALL"|"SCHOOL"|"CLASS"|"STUDENT";
export const studentReadFilters:readonly StudentReadFilter[]=["ALL","UNREAD","READ"];
export const studentTopicFilters:readonly StudentTopicFilter[]=[
  "ALL","SCHOOL","ACADEMICS","ATTENDANCE","FEES"
];
export const studentAnnouncementFilters:readonly StudentAnnouncementFilter[]=[
  "ALL","SCHOOL","CLASS","STUDENT"
];

function matches(query:string,...fields:(string|null|undefined)[]):boolean{
  const term=query.trim().normalize("NFKC").toLocaleLowerCase();
  return !term||fields.some(field=>field?.normalize("NFKC").toLocaleLowerCase().includes(term));
}
/** The API enforces the audience; still reject stale class and other-role items. */
export function studentVisibleAnnouncements(
  items:readonly AnnouncementPayload[],classId:string|null,now:Date=new Date()
):AnnouncementPayload[]{
  return items.filter(item=>{
    if(item.archivedAt||!Number.isFinite(Date.parse(item.publishAt))||
      Date.parse(item.publishAt)>now.getTime())return false;
    if(item.audienceScope==="SCHOOL")return true;
    if(item.audienceScope==="CLASS")return classId!==null&&item.classId===classId&&
      (!item.audienceRole||item.audienceRole==="STUDENT");
    return item.audienceScope==="ROLE"&&item.audienceRole==="STUDENT";
  }).sort((a,b)=>b.publishAt.localeCompare(a.publishAt)||b.id.localeCompare(a.id));
}
export function studentFilterAnnouncements(
  items:readonly AnnouncementPayload[],
  options:{classId:string|null;query:string;audience:StudentAnnouncementFilter;now?:Date}
):AnnouncementPayload[]{
  return studentVisibleAnnouncements(items,options.classId,options.now).filter(item=>{
    const selected=options.audience==="ALL"||
      options.audience==="SCHOOL"&&item.audienceScope==="SCHOOL"||
      options.audience==="CLASS"&&item.audienceScope==="CLASS"||
      options.audience==="STUDENT"&&item.audienceScope==="ROLE";
    return selected&&matches(options.query,item.title,item.content);
  });
}
export function studentNotificationTopic(item:ParentNotification):StudentTopicFilter{
  if(item.type==="ANNOUNCEMENT")return "SCHOOL";
  if(item.type==="HOMEWORK_PUBLISHED"||item.type==="RESULTS_PUBLISHED"||
    item.type.startsWith("HOMEWORK_")||item.type.startsWith("RESULTS_"))return "ACADEMICS";
  if(item.type.startsWith("ATTENDANCE_"))return "ATTENDANCE";
  if(item.type==="FEE_DUE"||item.type==="FEE_OVERDUE")return "FEES";
  return "ALL";
}
export function studentVisibleNotifications(items:readonly ParentNotification[]):ParentNotification[]{
  return items.filter(item=>item.deliveryStatus==="PENDING"||item.deliveryStatus==="SENT")
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
}
export function studentFilterNotifications(items:readonly ParentNotification[],
 options:{query:string;read:StudentReadFilter;topic:StudentTopicFilter}
):ParentNotification[]{
  return studentVisibleNotifications(items).filter(item=>{
    const read=options.read==="ALL"||
      options.read==="UNREAD"&&!item.readAt||options.read==="READ"&&!!item.readAt;
    const topic=options.topic==="ALL"||studentNotificationTopic(item)===options.topic;
    return read&&topic&&matches(options.query,item.title,item.message);
  });
}
export function studentNotificationUnread(items:readonly ParentNotification[]):number{
  return studentVisibleNotifications(items).filter(item=>!item.readAt).length;
}
export function studentInboxPage<T>(rows:readonly T[],page:number,
  getId:(row:T)=>string,focusId?:string|null){
  const index=focusId?rows.findIndex(row=>getId(row)===focusId):-1;
  const limit=Math.max(STUDENT_INBOX_PAGE_SIZE,
    Math.floor(Math.max(1,page))*STUDENT_INBOX_PAGE_SIZE,
    index<0?0:Math.ceil((index+1)/STUDENT_INBOX_PAGE_SIZE)*STUDENT_INBOX_PAGE_SIZE);
  const count=Math.min(rows.length,limit);
  return {visible:rows.slice(0,count),hasMore:count<rows.length,
    showing:count,total:rows.length};
}
