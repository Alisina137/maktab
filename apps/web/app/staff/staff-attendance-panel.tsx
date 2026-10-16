"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import "./attendance.css";
import { type AdminLocale } from "../admin/admin-i18n";
import { staffAttendanceText } from "./staff-attendance-i18n";
import { AdminHijriDatePicker, formatAdminHijriDate } from "../admin/admin-hijri-date-picker";
import { friendlyAdminError } from "../admin/admin-client";

export type AttendanceMark = {
  attendanceId:string;studentId:string;studentName:string;studentCode:string;
  className:string;classId:string;date:string;
  status:"PRESENT"|"ABSENT"|"LATE"|"EXCUSED";updatedAt:string;
};
export type StaffAttendanceRequest = {
  id:string;studentName:string;studentCode:string;className:string;date:string;
  originalStatus:string;requestedStatus:string;status:"PENDING"|"APPROVED"|"REJECTED";
  reason:string;reviewNote:string|null;createdAt:string;
};
type Report = {
  from:string;to:string;today:string;total:number;offset:number;hasMore:boolean;
  rows:AttendanceMark[];
  summary:{present:number;absent:number;late:number;excused:number};
};
type Props={locale:AdminLocale;api:<T>(path:string,init?:RequestInit)=>Promise<T>};
const STATUSES=["PRESENT","ABSENT","LATE","EXCUSED"] as const;

export function StaffAttendancePanel({locale,api}:Props){
  const t=(label:string)=>staffAttendanceText(locale,label);
  const [report,setReport]=useState<Report|null>(null);
  const [requests,setRequests]=useState<StaffAttendanceRequest[]>([]);
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [offset,setOffset]=useState(0);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<AttendanceMark|null>(null);
  const [requestedStatus,setRequestedStatus]=useState<AttendanceMark["status"]>("PRESENT");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const read=useCallback(async (nextFrom:string,nextTo:string,nextOffset:number)=>{
    const params=new URLSearchParams({offset:String(nextOffset)});
    if(nextFrom)params.set("from",nextFrom);
    if(nextTo)params.set("to",nextTo);
    return api<Report>("/v1/staff/attendance/report?"+params);
  },[api]);
  const reload=useCallback(async(nextFrom:string,nextTo:string,nextOffset:number)=>{
    const [data,list]=await Promise.all([
      read(nextFrom,nextTo,nextOffset),
      api<{requests:StaffAttendanceRequest[]}>("/v1/staff/attendance/requests")
    ]);
    setReport(data);setRequests(list.requests);
    if(!nextFrom&&!nextTo){setFrom(data.today);setTo(data.today);}
    setSelected(null);
  },[api,read]);
  useEffect(()=>{
    let active=true;
    setLoading(true);
    void Promise.all([
      read("","",0),api<{requests:StaffAttendanceRequest[]}>("/v1/staff/attendance/requests")
    ]).then(([data,list])=>{if(active){
      setReport(data);setRequests(list.requests);setFrom(data.today);setTo(data.today);
    }}).catch(err=>{if(active)setError(friendlyAdminError(err,"Could not load attendance records.",locale));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[read,api,locale]);
  const visible=useMemo(()=>report?.rows.filter(row=>
    (row.studentName+" "+row.studentCode+" "+row.className)
      .toLocaleLowerCase().includes(search.toLocaleLowerCase()))??[],[report,search]);
  async function apply(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try{await reload(from,to,0);setOffset(0);}
    catch(err){setError(friendlyAdminError(err,"Could not load attendance records.",locale));}
    finally{setBusy(false);}
  }
  async function page(next:number){
    setBusy(true);setError("");
    try{await reload(from,to,next);setOffset(next);}
    catch(err){setError(friendlyAdminError(err,"Could not load attendance records.",locale));}
    finally{setBusy(false);}
  }
  function choose(row:AttendanceMark){
    setSelected(row);setRequestedStatus(row.status);setReason("");
    setNotice("");setError("");
  }
  async function submit(e:FormEvent){
    e.preventDefault();if(!selected||busy||requestedStatus===selected.status)return;
    if(!window.confirm(t("Send this attendance correction to the administrator?")))return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/v1/staff/attendance/requests",{method:"POST",body:JSON.stringify({
        attendanceId:selected.attendanceId,studentId:selected.studentId,
        requestedStatus,expectedUpdatedAt:selected.updatedAt,reason:reason.trim()
      })});
      await reload(from,to,offset);
      setReason("");setNotice(t("Correction request submitted for review."));
    }catch(err){setError(friendlyAdminError(err,"Could not submit correction request.",locale));}
    finally{setBusy(false);}
  }
  return <section className="staff-reg-layout staff-attendance">
    <div className="staff-reg-overview">
      <div><span className="eyebrow">{t("Attendance assistance")}</span>
        <h2>{t("Attendance review & correction requests")}</h2>
        <p>{t("Review recorded marks and request corrections. Only a school administrator can change attendance.")}</p>
      </div>
      <div className="staff-reg-counts">
        <strong>{requests.filter(r=>r.status==="PENDING").length}<small>{t("Pending review")}</small></strong>
        <strong>{requests.filter(r=>r.status==="APPROVED").length}<small>{t("Approved")}</small></strong>
      </div>
    </div>
    {error?<p className="admin-error" role="alert">{error}</p>:null}
    {notice?<p className="staff-reg-success" role="status">{notice}</p>:null}
    {loading?<div className="admin-panel" role="status">{t("Loading attendance data…")}</div>:(
      <div className="staff-reg-columns">
        <section className="admin-panel staff-reg-queue">
          <h3>{t("Recorded attendance")}</h3>
          <form className="admin-form staff-attendance-filters" onSubmit={apply}>
            <label>{t("From")}<AdminHijriDatePicker locale={locale} today={report?.today} value={from}
              required onChange={setFrom}/></label>
            <label>{t("To")}<AdminHijriDatePicker locale={locale} today={report?.today} value={to}
              required onChange={setTo}/></label>
            <button type="submit" className="admin-secondary" disabled={busy||from>to}>
              {t("Apply filters")}</button>
          </form>
          <label>{t("Search")}<input type="search" value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder={t("Search student or class")}/></label>
          <p className="pilot-security-note">{report?.total??0} {t("recorded marks")}</p>
          <div className="staff-reg-items">
            {visible.map(row=><button type="button"
              key={row.attendanceId+row.studentId} onClick={()=>choose(row)}
              aria-pressed={selected?.attendanceId===row.attendanceId&&selected.studentId===row.studentId}
              className={"staff-reg-item "+(selected?.attendanceId===row.attendanceId&&selected.studentId===row.studentId?"staff-reg-item-active":"")}>
              <span><strong>{row.studentName}</strong>
                <small>{row.studentCode} · {row.className} · {formatAdminHijriDate(locale,row.date)}</small></span>
              <span className="pilot-badge">{t(row.status)}</span>
            </button>)}
            {!visible.length?<p>{t("No recorded attendance for this selection.")}</p>:null}
          </div>
          <div className="staff-pages">
            <button type="button" className="admin-secondary" disabled={busy||offset===0}
              onClick={()=>void page(Math.max(0,offset-50))}>{t("Previous")}</button>
            <button type="button" className="admin-secondary" disabled={busy||!report?.hasMore}
              onClick={()=>void page(offset+50)}>{t("Next")}</button>
          </div>
          {selected?<form className="admin-form staff-attendance-request" onSubmit={submit}>
            <h3>{t("Request correction")}: {selected.studentName}</h3>
            <p>{t("Current status")}: {t(selected.status)}</p>
            <label>{t("Requested status")}<select value={requestedStatus}
              onChange={e=>setRequestedStatus(e.target.value as AttendanceMark["status"])}>
              {STATUSES.map(status=><option key={status} value={status}>{t(status)}</option>)}
            </select></label>
            <label>{t("Reason for correction")}<textarea required minLength={10} maxLength={500}
              rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
            <button className="admin-primary" disabled={busy||requestedStatus===selected.status||reason.trim().length<10}>
              {t("Submit correction request")}</button>
          </form>:null}
        </section>
        <section className="admin-panel staff-reg-queue">
          <h3>{t("My correction requests")}</h3>
          <p>{t("Decisions and review notes from school administrators.")}</p>
          <div className="staff-reg-items">
            {requests.map(row=><article className="staff-attendance-history" key={row.id}>
              <div><strong>{row.studentName}</strong><span className="pilot-badge">{t(row.status)}</span></div>
              <small>{row.className} · {formatAdminHijriDate(locale,row.date)}</small>
              <p>{t(row.originalStatus)} → {t(row.requestedStatus)}</p>
              <p>{row.reason}</p>
              {row.reviewNote?<p>{t("Review note")}: {row.reviewNote}</p>:null}
            </article>)}
            {!requests.length?<p>{t("No correction requests yet.")}</p>:null}
          </div>
        </section>
      </div>
    )}
  </section>;
}
