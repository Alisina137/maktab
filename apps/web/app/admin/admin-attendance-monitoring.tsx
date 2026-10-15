"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AdminHijriDatePicker, formatAdminHijriDate } from "./admin-hijri-date-picker";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import type {
  AttendanceClosure, AttendanceMonitoringResponse, DayMonitorState
} from "@maktablink/database";

type Props = {
  accessToken: string; academicYearId: string;
  dateFrom: string; dateTo: string; classId: string;
  locale: AdminLocale; mode: "OVERVIEW" | "REGISTERS";
  academicYearStatus: string; schoolToday: string;
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const stateLabels: Record<DayMonitorState, string> = {
  SUBMITTED: "Submitted", PENDING: "Pending submission",
  CLOSED: "School closure", NOT_SCHEDULED: "No class scheduled",
  FUTURE: "Upcoming day", OUTSIDE_YEAR: "Outside academic year",
  NO_STUDENTS: "No active students", NO_NEGARAN: "Negaran missing or inactive",
  MULTIPLE_NEGARAN: "Conflicting Negaran assignments"
};

function responseMessage(text: string): string {
  try { return JSON.parse(text)?.message || "Request failed."; }
  catch { return text || "Request failed."; }
}
async function adminRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response=await fetch(API_URL+path,{
    ...init,
    headers: {"Content-Type":"application/json", Authorization:`Bearer ${token}`,...(init?.headers??{})}
  });
  const body=await response.text();
  if(!response.ok)throw new Error(responseMessage(body));
  return body ? JSON.parse(body) as T : {} as T;
}
function monitoringUrl(yearId: string, date: string, classId: string) {
  const query=new URLSearchParams({ academicYearId: yearId, date });
  if(classId)query.set("classId",classId);
  return "/v1/admin/attendance/monitor?"+query;
}
function closureUrl(yearId: string) {
  return "/v1/admin/attendance/closures?"+new URLSearchParams({academicYearId:yearId});
}
export function AdminAttendanceMonitoring(props: Props) {
  const {
    accessToken,academicYearId,dateFrom,dateTo,classId,locale,mode,
    academicYearStatus,schoolToday
  }=props;
  const t=(english:string)=>adminText(locale,english);
  const scope=`${accessToken}:${academicYearId}:${dateFrom}:${dateTo}:${classId}`;
  const scopeRef=useRef(scope);
  scopeRef.current=scope;
  const [monitor,setMonitor]=useState<AttendanceMonitoringResponse|null>(null);
  const [closures,setClosures]=useState<AttendanceClosure[]>([]);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const [loadError,setLoadError]=useState("");
  const [feedback,setFeedback]=useState("");
  const [mutationError,setMutationError]=useState("");
  const [version,setVersion]=useState(0);
  const [saving,setSaving]=useState(false);
  const [closureDay,setClosureDay]=useState(dateFrom);
  const [closureReason,setClosureReason]=useState("");
  const [statusFilter,setStatusFilter]=useState("ALL");
  const [search,setSearch]=useState("");
  const isSingleDay=!!dateFrom&&dateFrom===dateTo;
  const canEdit=academicYearStatus==="ACTIVE"||academicYearStatus==="DRAFT";
  const pendingMutation=useRef(false);
  const onRequest=useRef(0);

  useEffect(()=>{
    setClosureDay(dateFrom);
    setStatusFilter("ALL");setSearch("");
  },[dateFrom,academicYearId]);

  useEffect(()=>{
    if(!isSingleDay)return;
    const controller=new AbortController();
    const order=++onRequest.current;
    setMonitor(null);setState("loading");setLoadError("");
    void Promise.all([
      adminRequest<AttendanceMonitoringResponse>(
        accessToken,monitoringUrl(academicYearId,dateFrom,classId),{signal:controller.signal}),
      mode==="REGISTERS"
        ? adminRequest<{closures:AttendanceClosure[]}>(
          accessToken,closureUrl(academicYearId),{signal:controller.signal})
        : Promise.resolve(null)
    ]).then(([data,days])=>{
      if(controller.signal.aborted||onRequest.current!==order||scopeRef.current!==scope)return;
      setMonitor(data);
      if(days)setClosures(days.closures);
      setState("ready");
    }).catch(error=>{
      if(controller.signal.aborted||onRequest.current!==order||scopeRef.current!==scope)return;
      setLoadError(adminErrorText(locale,error,"Could not load daily attendance monitoring."));
      setState("error");
    });
    return ()=>{controller.abort();onRequest.current++;};
  },[accessToken,academicYearId,dateFrom,dateTo,classId,mode,version]);

  const visible=useMemo(()=>{
    const query=search.toLocaleLowerCase().trim();
    return monitor?.classes.filter(row=>
      (statusFilter==="ALL"||row.state===statusFilter) &&
      (!query||[row.className,row.classCode,row.negaranName??""]
        .some(value=>value.toLocaleLowerCase().includes(query)))
    )??[];
  },[monitor,statusFilter,search]);

  async function addClosure(event: FormEvent) {
    event.preventDefault();
    if(!canEdit||pendingMutation.current||!closureDay||!closureReason.trim())return;
    pendingMutation.current=true;setSaving(true);setFeedback("");setMutationError("");
    const expectedScope=scopeRef.current;
    try{
      await adminRequest(accessToken,"/v1/admin/attendance/closures",{
        method:"POST",body:JSON.stringify({
          academicYearId,date:closureDay,reason:closureReason.trim()
        })
      });
      if(scopeRef.current!==expectedScope)return;
      setClosureReason("");
      setFeedback(t("School closure saved and audited."));
      setVersion(value=>value+1);
    }catch(cause){
      if(scopeRef.current===expectedScope)
        setMutationError(adminErrorText(locale,cause,"Could not save closure."));
    }finally{pendingMutation.current=false;setSaving(false);}
  }

  async function deleteClosure(closure:AttendanceClosure){
    if(!canEdit||pendingMutation.current)return;
    if(!window.confirm(adminFormat(locale,"Reopen {date} for attendance?",{
      date:formatAdminHijriDate(locale,closure.date)})))return;
    pendingMutation.current=true;setSaving(true);setFeedback("");setMutationError("");
    const expectedScope=scopeRef.current;
    try{
      await adminRequest(accessToken,
        `/v1/admin/attendance/closures/${closure.id}`,{method:"DELETE"});
      if(scopeRef.current!==expectedScope)return;
      setFeedback(t("School closure removed and audited."));
      setVersion(value=>value+1);
    }catch(cause){
      if(scopeRef.current===expectedScope)
        setMutationError(adminErrorText(locale,cause,"Could not reopen school day."));
    }finally{pendingMutation.current=false;setSaving(false);}
  }

  if(!isSingleDay)return <div className="admin-panel attendance-monitor-state" role="note">
    <strong>{t("Select a single day to monitor submissions")}</strong>
    <p>{t("The attendance register and period reports support date ranges. Daily submission monitoring needs one selected school day.")}</p>
  </div>;

  if(state==="loading")return <div className="admin-panel attendance-monitor-state" role="status">
    {t("Loading daily class monitoring data…")}
  </div>;
  if(state==="error"||!monitor)return <div className="admin-panel attendance-monitor-state">
    <p className="admin-error" role="alert">{loadError||t("Daily monitoring is unavailable.")}</p>
    <button type="button" className="admin-secondary" onClick={()=>setVersion(value=>value+1)}>
      {t("Retry")}</button>
  </div>;

  const s=monitor.summary;
  const percentage=s.expectedClasses?Math.round(1000*s.submittedExpected/s.expectedClasses)/10:null;
  const dayCaption=adminFormat(locale,"Daily submission status for {date}",{
    date:formatAdminHijriDate(locale,monitor.date)
  });
  const badges=[
    ["Expected registers",s.expectedClasses],
    ["Submitted expected",s.submittedExpected],
    ["Pending submission",s.pendingClasses],
    ["Setup issues",s.configurationIssues],
    ["Submitted total",s.submittedTotal]
  ] as const;

  return <div className="attendance-monitor-workspace">
    <div className="attendance-monitor-head">
      <div><h3>{mode==="OVERVIEW"?t("Daily submission progress"):t("Class-by-class daily monitoring")}</h3>
        <p>{dayCaption}</p></div>
      <button className="admin-secondary" type="button"
        disabled={saving} onClick={()=>setVersion(value=>value+1)}>{t("Refresh monitoring")}</button>
    </div>
    {monitor.closure?<div className="attendance-calendar-closure" role="note">
      <strong>{t("Declared school closure")}</strong><span>{monitor.closure.reason}</span>
    </div>:null}
    <div className="attendance-monitor-kpi">
      <div><strong>{percentage===null?"—":`${percentage}%`}</strong>
        <small>{t("Expected submissions completed")}</small></div>
      <div className="attendance-monitor-meter" role="progressbar" aria-label={t("Expected submissions completed")}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage??0}>
        <div style={{width:`${percentage??0}%`}} /></div>
      <small>{t("Only scheduled days within the academic year, with active students and one active Negaran, are counted as expected. Closures and future dates are excluded.")}</small>
    </div>
    <div className="attendance-monitor-metrics">
      {badges.map(([label,value])=><div key={label} className="attendance-monitor-metric">
        <strong>{value}</strong><span>{t(label)}</span>
      </div>)}
    </div>
    {s.configurationIssues>0?<p className="attendance-monitor-warning" role="note">
      {t("Setup issues need administrator attention. These classes are not counted as missing submissions until their setup is fixed.")}
    </p>:null}

    {mode==="REGISTERS"?<>
      <div className="attendance-monitor-filters">
        <label>{t("Find class or Negaran")}
          <input type="search" value={search} onChange={event=>setSearch(event.target.value)}
            placeholder={t("Search classes…")} /></label>
        <label>{t("Submission status")}
          <select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}>
            <option value="ALL">{t("All statuses")}</option>
            {(Object.entries(stateLabels) as Array<[DayMonitorState,string]>).map(([id,label])=>
              <option key={id} value={id}>{t(label)}</option>)}
          </select></label>
      </div>
      <div className="attendance-monitor-class-list">
        {visible.map(row=><article className="attendance-monitor-class" key={row.classId}>
          <div className="attendance-monitor-class-head">
            <div><strong>{row.className} · {row.classCode}</strong>
              <small>{t("Negaran")}: {row.negaranName??t(row.negaranCount>1?
                "Multiple assignments":"Not assigned or inactive")}</small></div>
            <span className={`attendance-day-state attendance-day-state-${row.state.toLowerCase()}`}>
              {t(stateLabels[row.state])}</span>
          </div>
          <div className="attendance-monitor-class-meta">
            <span>{t("Active students")}: {row.activeStudents}</span>
            {row.submittedAt?<span>{t("Submitted at")}: {new Date(row.submittedAt).toLocaleString(locale)}</span>:null}
            {row.submittedAt?<span>{t("Present")}: {row.present} · {t("Absent")}: {row.absent} ·
              {t("Late")}: {row.late} · {t("Excused")}: {row.excused}</span>:null}
          </div>
        </article>)}
        {!visible.length?<p className="admin-copy">{t("No classes match the selected monitoring filters.")}</p>:null}
      </div>
      <section className="admin-panel attendance-closure-panel">
        <h3>{t("School calendar closures")}</h3>
        <p>{t("Declare holidays or non-teaching days so missing registers are not counted as pending. A closure cannot be added to a day that already has submitted attendance.")}</p>
        {mutationError?<p className="admin-error" role="alert">{mutationError}</p>:null}
        {feedback?<p className="admin-success" role="status">{feedback}</p>:null}
        {canEdit?<form onSubmit={addClosure} className="attendance-closure-form">
          <label>{t("Closure date")}
            <AdminHijriDatePicker locale={locale} value={closureDay} onChange={setClosureDay} required />
          </label>
          <label>{t("Reason")}
            <input value={closureReason} maxLength={160} required
              onChange={event=>setClosureReason(event.target.value)}
              placeholder={t("Holiday or school closure reason")} />
          </label>
          <button type="submit" className="admin-primary" disabled={saving||!closureDay||!closureReason.trim()}>
            {saving?t("Saving…"):t("Add school closure")}</button>
        </form>:<p className="attendance-readonly-note">
          {t("This academic year is read-only. Calendar closures cannot be changed.")}</p>}
        <div className="attendance-closure-list">
          {closures.map(closure=><div className="attendance-closure-item" key={closure.id}>
            <div><strong>{formatAdminHijriDate(locale,closure.date)}</strong>
              <span>{closure.reason}</span></div>
            {canEdit?<button type="button" className="admin-secondary" disabled={saving}
              onClick={()=>void deleteClosure(closure)}>{t("Remove closure")}</button>:null}
          </div>)}
          {!closures.length?<p className="admin-copy">{t("No school closures have been recorded for this year.")}</p>:null}
        </div>
      </section>
    </>:<div className="attendance-monitor-overview-list">
      {monitor.classes.filter(row=>row.state==="PENDING"||row.state==="NO_NEGARAN"||
        row.state==="MULTIPLE_NEGARAN"||row.state==="NO_STUDENTS").slice(0,8).map(row=>
        <div key={row.classId} className="attendance-monitor-attention">
          <strong>{row.className} · {row.classCode}</strong>
          <span>{t(stateLabels[row.state])}</span>
        </div>)}
      {!s.pendingClasses&&!s.configurationIssues?
        <p className="admin-copy">{t("No pending or misconfigured class registers for this date.")}</p>:null}
    </div>}
    <p className="attendance-monitor-footnote">
      {t("Calendar eligibility follows class timetable weekdays, year dates, declared school closures, active enrollment and Negaran assignments. Timetable changes are not historically versioned.")}
    </p>
    <p className="attendance-monitor-footnote">
      {t("Submitted total may include classes outside today's expected schedule. Submission percentages count only expected registers.")}
    </p>
    {schoolToday!==monitor.today?<p className="attendance-monitor-footnote" role="note">
      {t("The school's current date changed. Refresh the Attendance page to update today.")}</p>:null}
  </div>;
}
