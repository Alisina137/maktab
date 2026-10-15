"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { adminErrorText, adminText, type AdminLocale } from "./admin-i18n";
import { formatAdminHijriDate } from "./admin-hijri-date-picker";
import { attendanceAdjacentMonth, attendanceCalendarMonth } from "./attendance-calendar-model";

type DirectoryRow={
  studentId:string;studentName:string;studentCode:string;classId:string;className:string;
  classCode:string;status:"ACTIVE"|"WITHDRAWN";
  present:number;absent:number;late:number;excused:number;recorded:number;
};
type Directory={academicYearId:string;total:number;limit:number;offset:number;rows:DirectoryRow[]};
type History={
  academicYearId:string;student:{id:string;name:string;code:string;classId:string;
    className:string;classCode:string;enrollmentStatus:string};
  from:string;to:string;today:string;
  summary:{present:number;absent:number;late:number;excused:number;recorded:number;rate:number|null};
  days:Array<{date:string;status:"PRESENT"|"ABSENT"|"LATE"|"EXCUSED";note:string|null;
    className:string;submittedAt:string;updatedAt:string}>;
  closures:Array<{date:string;reason:string}>;
};
type Props={accessToken:string;academicYearId:string;schoolToday:string;
  locale:AdminLocale;classId:string};
const API_URL=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
const PAGE_SIZE=15;
async function getJson<T>(token:string,path:string,signal:AbortSignal):Promise<T>{
  const response=await fetch(API_URL+path,{signal,headers:{Authorization:`Bearer ${token}`,"Cache-Control":"no-cache"},cache:"no-store"});
  if(!response.ok){const body=await response.json().catch(()=>null);throw Error(body?.message??"Request failed.");}
  return response.json() as Promise<T>;
}
const WEEKDAYS=["Sat","Sun","Mon","Tue","Wed","Thu","Fri"] as const;

export function AdminAttendanceStudents({accessToken,academicYearId,schoolToday,locale,classId}:Props) {
  const t=(s:string)=>adminText(locale,s);
  const [searchDraft,setSearchDraft]=useState("");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
  const [anchor,setAnchor]=useState(schoolToday);
  const [directory,setDirectory]=useState<Directory|null>(null);
  const [directoryState,setDirectoryState]=useState<"loading"|"ready"|"error">("loading");
  const [directoryError,setDirectoryError]=useState("");
  const [history,setHistory]=useState<History|null>(null);
  const [historyState,setHistoryState]=useState<"loading"|"ready"|"error">("loading");
  const [historyError,setHistoryError]=useState("");
  const [reload,setReload]=useState(0);
  const [reloadHistory,setReloadHistory]=useState(0);
  const calendar=useMemo(()=>anchor?attendanceCalendarMonth(anchor,locale):null,[anchor,locale]);

  useEffect(()=>{
    setSelected(null);setAnchor(schoolToday);setPage(0);setSearchDraft("");setSearch("");
    setDirectory(null);setHistory(null);
  },[academicYearId,accessToken,schoolToday,classId]);

  useEffect(()=>{
    if(!academicYearId)return;
    const controller=new AbortController();
    setDirectoryState("loading");setDirectory(null);setDirectoryError("");
    const query=new URLSearchParams({academicYearId,limit:String(PAGE_SIZE),
      offset:String(page*PAGE_SIZE)});
    if(classId)query.set("classId",classId);
    if(search.trim())query.set("search",search.trim());
    void getJson<Directory>(accessToken,"/v1/admin/attendance/students?"+query,controller.signal)
      .then(result=>{if(!controller.signal.aborted){setDirectory(result);setDirectoryState("ready");}})
      .catch(error=>{if(!controller.signal.aborted){
        setDirectoryState("error");
        setDirectoryError(adminErrorText(locale,error,"Could not load student directory."));}});
    return ()=>controller.abort();
  },[accessToken,academicYearId,classId,search,page,reload]);

  useEffect(()=>{
    if(!selected||!calendar)return;
    const controller=new AbortController();
    setHistoryState("loading");setHistory(null);setHistoryError("");
    const query=new URLSearchParams({academicYearId,from:calendar.from,to:calendar.to});
    void getJson<History>(accessToken,
      `/v1/admin/attendance/students/${selected}/history?${query}`,controller.signal)
      .then(result=>{if(!controller.signal.aborted){setHistory(result);setHistoryState("ready");}})
      .catch(error=>{if(!controller.signal.aborted){
        setHistoryState("error");
        setHistoryError(adminErrorText(locale,error,"Could not load student attendance history."));}});
    return ()=>controller.abort();
  },[accessToken,academicYearId,selected,calendar?.from,calendar?.to,reloadHistory]);

  function submitSearch(event:FormEvent){event.preventDefault();setPage(0);setSelected(null);setSearch(searchDraft);}
  const totalPages=directory?Math.max(1,Math.ceil(directory.total/PAGE_SIZE)):1;
  const statusByDay=new Map(history?.days.map(day=>[day.date,day] as const)??[]);
  const closureByDay=new Map(history?.closures.map(day=>[day.date,day] as const)??[]);
  const nextMonth=anchor?attendanceAdjacentMonth(anchor,locale,1):null;
  const cannotAdvance=!!nextMonth&&!!schoolToday&&nextMonth>schoolToday;

  return <div className="attendance-students-layout">
    <section className="admin-panel attendance-students-directory">
      <header className="attendance-module-heading">
        <div><h3>{t("Student attendance directory")}</h3>
          <p>{t("Search enrolled students, including those without recorded attendance.")}</p></div>
        <button className="admin-secondary" onClick={()=>setReload(v=>v+1)} type="button">
          {t("Refresh")}</button>
      </header>
      <form className="attendance-students-search" onSubmit={submitSearch}>
        <label>{t("Student name or code")}
          <input type="search" value={searchDraft} maxLength={100}
            onChange={e=>setSearchDraft(e.target.value)}
            placeholder={t("Find a student…")}/></label>
        <button className="admin-primary" type="submit">{t("Search")}</button>
      </form>
      {directoryState==="loading"?<p role="status">{t("Loading student directory data…")}</p>:null}
      {directoryState==="error"?<div role="alert" className="admin-error">{directoryError}
        <button className="admin-secondary" type="button" onClick={()=>setReload(v=>v+1)}>
          {t("Retry")}</button></div>:null}
      {directoryState==="ready"&&directory?<><p className="attendance-hint">
        {directory.total} {t("students matched")}</p>
        <div className="attendance-student-list">
          {directory.rows.map(row=><button key={row.studentId} type="button"
            className={selected===row.studentId?"attendance-student-card is-active":"attendance-student-card"}
            aria-pressed={selected===row.studentId}
            onClick={()=>{setSelected(row.studentId);setAnchor(schoolToday);}}>
            <span><strong>{row.studentName}</strong>
              <small>{row.studentCode} · {row.className}</small></span>
            <span className="attendance-student-card-count">{row.recorded} {t("recorded days")}</span>
          </button>)}
          {!directory.rows.length?<p className="attendance-hint">{t("No students match your search.")}</p>:null}
        </div>
        <div className="attendance-pagination">
          <button className="admin-secondary" type="button" disabled={page===0}
            onClick={()=>{setSelected(null);setPage(v=>v-1);}}>{t("Previous")}</button>
          <span>{page+1} / {totalPages}</span>
          <button className="admin-secondary" type="button" disabled={page+1>=totalPages}
            onClick={()=>{setSelected(null);setPage(v=>v+1);}}>{t("Next")}</button>
        </div>
      </>:null}
    </section>

    <section className="admin-panel attendance-student-history">
      {!selected?<div className="attendance-empty-selection">
        <h3>{t("Student attendance profile")}</h3>
        <p>{t("Select a student from the directory to review their history and monthly calendar.")}</p>
      </div>:<>
        <header className="attendance-module-heading">
          <div><h3>{t("Student attendance profile")}</h3>
            {history?<p>{history.student.name} · {history.student.code} · {history.student.className}</p>:null}
          </div>
          <button type="button" className="admin-secondary"
            onClick={()=>setReloadHistory(v=>v+1)}>{t("Refresh")}</button>
        </header>
        <div className="attendance-calendar-toolbar">
          <button className="admin-secondary" type="button"
            aria-label={t("Previous month")}
            onClick={()=>setAnchor(value=>attendanceAdjacentMonth(value,locale,-1))}>‹</button>
          <strong>{calendar?.title??""}</strong>
          <button className="admin-secondary" type="button"
            aria-label={t("Next month")} disabled={cannotAdvance}
            onClick={()=>setAnchor(value=>attendanceAdjacentMonth(value,locale,1))}>›</button>
        </div>
        {historyState==="loading"?<p role="status">{t("Loading student attendance history…")}</p>:null}
        {historyState==="error"?<div role="alert" className="admin-error">{historyError}
          <button className="admin-secondary" type="button"
            onClick={()=>setReloadHistory(v=>v+1)}>{t("Retry")}</button></div>:null}
        {historyState==="ready"&&history&&calendar?<div className="attendance-history-content">
          <div className="attendance-student-summary">
            <div><strong>{history.summary.rate===null?"—":history.summary.rate+"%"}</strong>
              <span>{t("Attendance rate")}</span></div>
            <div><strong>{history.summary.recorded}</strong><span>{t("Recorded")}</span></div>
            <div><strong>{history.summary.absent}</strong><span>{t("Absent")}</span></div>
            <div><strong>{history.summary.late}</strong><span>{t("Late")}</span></div>
            <div><strong>{history.summary.excused}</strong><span>{t("Excused")}</span></div>
          </div>
          <p className="attendance-hint">{t("Attendance rate counts Present and Late over Present, Late and Absent. Excused, closed, future and unrecorded days are excluded.")}</p>
          <div className="attendance-calendar-grid" role="grid" aria-label={t("Monthly attendance calendar")}>
            {WEEKDAYS.map(day=><div className="attendance-calendar-weekday" key={day} role="columnheader">{t(day)}</div>)}
            {Array.from({length:calendar.leading},(_,i)=>
              <div role="presentation" key={"blank-"+i} className="attendance-calendar-blank"/>)}
            {calendar.days.map(cell=>{
              const day=statusByDay.get(cell.iso),closed=closureByDay.get(cell.iso);
              const state=day?.status??(cell.iso>history.today?"FUTURE":closed?"CLOSED":"UNRECORDED");
              const label=state==="CLOSED"?"School closure":
                state==="UNRECORDED"?"Not recorded":
                state==="FUTURE"?"Upcoming day":state;
              return <div key={cell.iso} role="gridcell" tabIndex={0}
                className={`attendance-calendar-day attendance-calendar-day-${state.toLowerCase()}`}
                title={`${formatAdminHijriDate(locale,cell.iso)}: ${t(label)}`}
                aria-label={`${formatAdminHijriDate(locale,cell.iso)}: ${t(label)}`}>
                <strong>{cell.day}</strong><small>{t(label)}</small>
              </div>;
            })}
          </div>
          <div className="attendance-history-days">
            <h4>{t("Recorded attendance history")}</h4>
            {history.days.map(day=><div className="attendance-history-day" key={day.date}>
              <div><strong>{formatAdminHijriDate(locale,day.date)}</strong>
                <small>{day.className}{day.note?" · "+day.note:""}</small></div>
              <span className={`attendance-mark attendance-mark-${day.status.toLowerCase()}`}>
                {t(day.status)}</span>
            </div>)}
            {!history.days.length?<p className="attendance-hint">
              {t("No recorded attendance for this student in the selected month.")}</p>:null}
          </div>
        </div>:null}
      </>}
    </section>
  </div>;
}
