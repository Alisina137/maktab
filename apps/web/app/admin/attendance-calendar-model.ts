export type AdminAttendanceCalendarLocale = "fa-AF"|"ps-AF"|"en";
export type AdminAttendanceCalendarCell = { iso: string; day: number };
const DAY_MS=86_400_000;
export function attendanceValidDay(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T12:00:00Z");
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function attendanceShiftDay(value:string,by:number) {
  if(!attendanceValidDay(value)||!Number.isInteger(by))throw Error("Invalid calendar day");
  return new Date(Date.parse(value+"T12:00:00Z")+by*DAY_MS).toISOString().slice(0,10);
}
function monthPart(value:string,locale:AdminAttendanceCalendarLocale) {
  const options={ calendar:locale==="en"?"gregory":"persian", numberingSystem:"latn",
    timeZone:"UTC",year:"numeric",month:"numeric",day:"numeric"} as const;
  const parts=new Intl.DateTimeFormat("en-US",options).formatToParts(new Date(value+"T12:00:00Z"));
  const number=(key:"year"|"month"|"day")=>Number(parts.find(part=>part.type===key)?.value);
  return {year:number("year"),month:number("month"),day:number("day")};
}
export function attendanceCalendarMonth(anchor:string,locale:AdminAttendanceCalendarLocale) {
  if(!attendanceValidDay(anchor))throw Error("Invalid calendar anchor");
  const reference=monthPart(anchor,locale);
  const same=(value:string)=>{
    const part=monthPart(value,locale);
    return part.month===reference.month&&part.year===reference.year;
  };
  let from=anchor,to=anchor;
  for(let i=0;i<31;i++){const prior=attendanceShiftDay(from,-1);if(!same(prior))break;from=prior;}
  for(let i=0;i<31;i++){const next=attendanceShiftDay(to,1);if(!same(next))break;to=next;}
  const leading=(new Date(from+"T12:00:00Z").getUTCDay()+1)%7;
  const days:AdminAttendanceCalendarCell[]=[];
  for(let iso=from;iso<=to;iso=attendanceShiftDay(iso,1))
    days.push({iso,day:monthPart(iso,locale).day});
  const title=new Intl.DateTimeFormat(locale==="en"?"en-US":locale,{
    calendar:locale==="en"?"gregory":"persian",timeZone:"UTC",month:"long",year:"numeric"
  }).format(new Date(anchor+"T12:00:00Z"));
  return {from,to,leading,days,title};
}
export function attendanceAdjacentMonth(anchor:string,locale:AdminAttendanceCalendarLocale,direction:-1|1) {
  const month=attendanceCalendarMonth(anchor,locale);
  return attendanceShiftDay(direction<0?month.from:month.to,direction);
}
