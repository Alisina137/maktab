export type AnnouncementSummary = {
  id: string; title: string; content: string;
  audienceScope: "SCHOOL" | "CLASS" | "ROLE";
  classId: string | null; audienceRole: string | null;
  publishAt: string; archivedAt: string | null;
};
export type AnnouncementStatusFilter = "ALL" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED";
export type AnnouncementAudienceFilter = "ALL" | "SCHOOL" | "CLASS" | "ROLE";
export const ANNOUNCEMENT_PAGE_SIZE = 20;

export function announcementStatus(item: AnnouncementSummary, now: number):
  Exclude<AnnouncementStatusFilter,"ALL"> {
  return item.archivedAt ? "ARCHIVED"
    : Date.parse(item.publishAt) > now ? "SCHEDULED" : "PUBLISHED";
}

export function findAnnouncements(
  items: AnnouncementSummary[],
  filters: { search: string; status: AnnouncementStatusFilter;
    audience: AnnouncementAudienceFilter; classId: string },
  now: number
): AnnouncementSummary[] {
  const q = filters.search.trim().toLocaleLowerCase();
  return items.filter(item =>
    (filters.status === "ALL" || announcementStatus(item,now) === filters.status) &&
    (filters.audience === "ALL" || item.audienceScope === filters.audience) &&
    (!filters.classId || item.classId === filters.classId) &&
    (!q || [item.title,item.content].some(value=>value.toLocaleLowerCase().includes(q)))
  ).sort((a,b)=> b.publishAt.localeCompare(a.publishAt) || b.id.localeCompare(a.id));
}

export function pageAnnouncements<T>(items: T[], visibleCount: number) {
  const shown = Math.min(items.length,Math.max(ANNOUNCEMENT_PAGE_SIZE,visibleCount));
  return { shown, rows: items.slice(0,shown), total:items.length, hasMore:shown<items.length };
}

function zoneParts(instant: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-GB",{
    timeZone:zone,calendar:"gregory",numberingSystem:"latn",
    year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",
    minute:"2-digit",hourCycle:"h23"
  }).formatToParts(instant);
  const get=(key:string)=>Number(parts.find(item=>item.type===key)?.value);
  return {year:get("year"),month:get("month"),day:get("day"),
    hour:get("hour"),minute:get("minute")};
}
function formatParts(p: ReturnType<typeof zoneParts>) {
  return `${String(p.year).padStart(4,"0")}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}T${String(p.hour).padStart(2,"0")}:${String(p.minute).padStart(2,"0")}`;
}
/** Convert from a school's local calendar time, never the browser's time zone. */
export function schoolLocalTimeToIso(local: string, zone: string): string {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Choose a valid local date and time.");
  // Validate the civil date itself, including month lengths and leap years.
  const rawEpoch=Date.parse(local+"Z");
  if(!Number.isFinite(rawEpoch) ||
    new Date(rawEpoch).toISOString().slice(0,16)!==local)
    throw new Error("Choose a valid calendar date and time.");
  let epoch=rawEpoch;
  for(let attempt=0;attempt<4;attempt++){
    const p=zoneParts(new Date(epoch),zone);
    const shownEpoch=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
    const delta=rawEpoch-shownEpoch;
    if(delta===0 && formatParts(p)===local)return new Date(epoch).toISOString();
    epoch+=delta;
  }
  if(formatParts(zoneParts(new Date(epoch),zone))!==local)
    throw new Error("This local time does not exist in the school's timezone.");
  return new Date(epoch).toISOString();
}

export function schoolInstantToLocal(instant: string, zone: string): string {
  const d=new Date(instant);
  if(!Number.isFinite(d.getTime()))throw new Error("Invalid publication date.");
  return formatParts(zoneParts(d,zone));
}
