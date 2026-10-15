"use client";

import { useEffect, useMemo, useState } from "react";
import { adminErrorText, adminText, type AdminLocale } from "./admin-i18n";
import { formatAdminHijriDate } from "./admin-hijri-date-picker";

type Status="PRESENT"|"ABSENT"|"LATE"|"EXCUSED";
type Register={
  date:string;today:string;academicYearId:string;
  classSection:{id:string;name:string;code:string};
  record:{id:string;status:"SUBMITTED"|"CORRECTED";submittedAt:string}|null;
  negaranName:string|null;
  students:Array<{id:string;name:string;code:string;enrollmentStatus:"ACTIVE"|"WITHDRAWN";
    status:Status|null;note:string|null;updatedAt:string|null}>;
};
type Props={
  accessToken:string;academicYearId:string;classId:string;date:string;
  locale:AdminLocale;onClose:()=>void;
};

export function AdminAttendanceClassRegister({accessToken,academicYearId,classId,date,locale,onClose}:Props){
  const t=(key:string)=>adminText(locale,key);
  const [data,setData]=useState<Register|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState<Status|"ALL"|"UNRECORDED">("ALL");
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");setData(null);setSearch("");setStatusFilter("ALL");
    const query=new URLSearchParams({academicYearId,date});
    void fetch((process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000")+
      `/v1/admin/attendance/classes/${classId}/register?${query}`,{
      signal:controller.signal,cache:"no-store",
      headers:{Authorization:`Bearer ${accessToken}`}
    }).then(async result=>{
      const body=await result.json();
      if(!result.ok)throw Error(body?.message??"Could not load class register.");
      return body as Register;
    }).then(result=>{if(!controller.signal.aborted){setData(result);setLoading(false);}})
      .catch(cause=>{if(!controller.signal.aborted){
        setError(adminErrorText(locale,cause,"Could not load class register."));setLoading(false);
      }});
    return ()=>controller.abort();
  },[accessToken,academicYearId,classId,date,refresh]);
  const visible=useMemo(()=>data?.students.filter(item=>{
    const query=search.trim().toLocaleLowerCase();
    return (statusFilter==="ALL"||item.status===(statusFilter==="UNRECORDED"?null:statusFilter))&&
      (!query||item.name.toLocaleLowerCase().includes(query)||
        item.code.toLocaleLowerCase().includes(query));
  })??[],[data,search,statusFilter]);
  const recorded=data?.students.filter(item=>item.status!==null).length??0;

  return <article className="admin-panel attendance-class-detail">
    <header className="attendance-module-heading">
      <div><h3>{t("Class attendance register")}</h3>
        {data?<p>{data.classSection.name} · {data.classSection.code} ·
          {formatAdminHijriDate(locale,data.date)}</p>:null}</div>
      <div className="attendance-detail-actions">
        <button type="button" className="admin-secondary"
          onClick={()=>setRefresh(v=>v+1)}>{t("Refresh")}</button>
        <button type="button" className="admin-secondary" onClick={onClose}>
          {t("Close register")}</button>
      </div>
    </header>
    {loading?<p role="status">{t("Loading class register data…")}</p>:null}
    {error?<div role="alert" className="admin-error">{error}
      <button className="admin-secondary" type="button" onClick={()=>setRefresh(v=>v+1)}>
        {t("Retry")}</button></div>:null}
    {data?<><div className="attendance-class-detail-summary">
      <div><strong>{data.record?t("Submitted"):t("Not submitted")}</strong>
        <span>{t("Register status")}</span></div>
      <div><strong>{recorded} / {data.students.length}</strong>
        <span>{t("Students with recorded marks")}</span></div>
      <div><strong>{data.negaranName??"—"}</strong>
        <span>{t("Assigned Negaran")}</span></div>
    </div>
    {!data.record?<p className="attendance-readonly-note" role="note">
      {t("No register was submitted for this date. Unrecorded students must not be treated as absent.")}</p>:null}
    <p className="attendance-hint">
      {t("This roster includes currently assigned students and historical marks for this register. It is not a historical enrollment snapshot.")}</p>
    <div className="attendance-monitor-filters">
      <label>{t("Student name or code")}
        <input type="search" value={search}
          onChange={e=>setSearch(e.target.value)} placeholder={t("Find a student…")}/></label>
      <label>{t("Attendance status")}
        <select value={statusFilter}
          onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="ALL">{t("All statuses")}</option>
          {(["PRESENT","ABSENT","LATE","EXCUSED"] as const).map(status=>
            <option value={status} key={status}>{t(status)}</option>)}
          <option value="UNRECORDED">{t("Not recorded")}</option>
        </select></label>
    </div>
    <div className="attendance-class-students">
      {visible.map(item=><div key={item.id} className="attendance-class-student">
        <div><strong>{item.name}</strong><small>{item.code}
          {item.enrollmentStatus==="WITHDRAWN"?" · "+t("Withdrawn"):""}</small>
          {item.note?<small>{t("Note")}: {item.note}</small>:null}</div>
        {item.status?<span className={`attendance-mark attendance-mark-${item.status.toLowerCase()}`}>
          {t(item.status)}</span>:<span className="attendance-mark">{t("Not recorded")}</span>}
      </div>)}
      {!visible.length?<p className="attendance-hint">{t("No students match your search.")}</p>:null}
    </div>
    <p className="attendance-hint">
      {t("To correct a submitted mark, use the attendance correction list in Daily Registers below.")}</p>
    </>:null}
  </article>;
}
