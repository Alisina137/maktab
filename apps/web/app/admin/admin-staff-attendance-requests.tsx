"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../staff/attendance.css";
import { type AdminLocale } from "./admin-i18n";
import { staffAttendanceText } from "../staff/staff-attendance-i18n";
import { formatAdminHijriDate } from "./admin-hijri-date-picker";
import { adminApi, friendlyAdminError } from "./admin-client";
import type { StaffAttendanceRequest } from "../staff/staff-attendance-panel";

type Props={locale:AdminLocale;accessToken:string;onApproved?:()=>void};
export function AdminStaffAttendanceRequests({locale,accessToken,onApproved}:Props){
  const t=(name:string)=>staffAttendanceText(locale,name);
  const [rows,setRows]=useState<StaffAttendanceRequest[]>([]);
  const [filter,setFilter]=useState("PENDING");
  const [selected,setSelected]=useState<StaffAttendanceRequest|null>(null);
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const api=useCallback(<T,>(path:string,init:RequestInit={})=>adminApi<T>(path,{
    ...init,cache:"no-store",headers:{...init.headers,Authorization:`Bearer ${accessToken}`}
  }),[accessToken]);
  const reload=useCallback(async()=>{
    const result=await api<{requests:StaffAttendanceRequest[]}>("/v1/admin/staff-attendance/requests");
    setRows(result.requests);
    setSelected(old=>result.requests.find(x=>x.id===old?.id)??null);
  },[api]);
  useEffect(()=>{
    let active=true;setLoading(true);
    void api<{requests:StaffAttendanceRequest[]}>("/v1/admin/staff-attendance/requests")
      .then(data=>{if(active){setRows(data.requests);setSelected(null);setNote("");}})
      .catch(err=>{if(active)setError(friendlyAdminError(err,"Could not load staff correction requests.",locale));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[api,locale]);
  const visible=useMemo(()=>filter==="ALL"?rows:rows.filter(row=>row.status===filter),[filter,rows]);
  async function decide(action:"APPROVE"|"REJECT"){
    if(!selected||busy)return;
    if(!window.confirm(t(action==="APPROVE"?"Approve this attendance correction?":
      "Reject this attendance correction?")))return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/v1/admin/staff-attendance/requests/"+selected.id+"/decision",{
        method:"POST",body:JSON.stringify({action,note:note.trim()})
      });
      await reload();setSelected(null);setNote("");
      setNotice(t("Attendance correction decision saved."));
      if(action==="APPROVE")onApproved?.();
    }catch(err){setError(friendlyAdminError(err,"Could not save attendance decision.",locale));}
    finally{setBusy(false);}
  }
  return <section className="admin-panel staff-reg-queue staff-attendance">
    <div className="admin-section-header"><div>
      <h3>{t("Staff correction requests")}</h3>
      <p>{t("Staff propose corrections. Only administrators can approve changes to recorded marks.")}</p>
    </div>
      <button type="button" className="admin-secondary" disabled={busy||loading}
        onClick={()=>void reload().catch(err=>setError(friendlyAdminError(err,"Could not refresh.",locale)))}>
        {t("Refresh")}</button>
    </div>
    {error?<p className="admin-error" role="alert">{error}</p>:null}
    {notice?<p className="admin-success" role="status">{notice}</p>:null}
    {loading?<p role="status">{t("Loading staff correction requests…")}</p>:<>
      <div className="staff-attendance-admin-summary">
        <strong>{rows.filter(x=>x.status==="PENDING").length} {t("Pending review")}</strong>
        <label>{t("Status")}<select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="ALL">{t("All statuses")}</option>
          {["PENDING","APPROVED","REJECTED"].map(x=><option key={x} value={x}>{t(x)}</option>)}
        </select></label>
      </div>
      <div className="staff-reg-columns">
        <div className="staff-reg-items">
          {visible.map(row=><button type="button" className={"staff-reg-item "+(selected?.id===row.id?"staff-reg-item-active":"")}
            key={row.id} aria-pressed={selected?.id===row.id} onClick={()=>{
              setSelected(row);setNote("");setError("");setNotice("");
            }}>
            <span><strong>{row.studentName}</strong>
              <small>{row.studentCode} · {row.className} · {formatAdminHijriDate(locale,row.date)}</small></span>
            <span className="pilot-badge">{t(row.status)}</span>
          </button>)}
          {!visible.length?<p>{t("No requests match this status.")}</p>:null}
        </div>
        <div className="staff-attendance-detail">
          {!selected?<p>{t("Select a staff correction request.")}</p>:<>
            <h4>{selected.studentName}</h4>
            <dl className="pilot-detail-grid">
              <div><dt>{t("Current status")}</dt><dd>{t(selected.originalStatus)}</dd></div>
              <div><dt>{t("Requested status")}</dt><dd>{t(selected.requestedStatus)}</dd></div>
              <div><dt>{t("Status")}</dt><dd>{t(selected.status)}</dd></div>
            </dl>
            <p><strong>{t("Reason for correction")}:</strong> {selected.reason}</p>
            {selected.reviewNote?<p>{t("Review note")}: {selected.reviewNote}</p>:null}
            {selected.status==="PENDING"?<div className="admin-form">
              <label>{t("Review note")}<textarea value={note} maxLength={500} rows={3}
                onChange={e=>setNote(e.target.value)}/></label>
              <div className="staff-reg-decision-actions">
                <button type="button" className="admin-primary" disabled={busy}
                  onClick={()=>void decide("APPROVE")}>{t("Approve correction")}</button>
                <button type="button" className="admin-secondary" disabled={busy||note.trim().length<3}
                  onClick={()=>void decide("REJECT")}>{t("Reject request")}</button>
              </div>
              <p className="pilot-security-note">{t("Approval changes the attendance mark and is added to the audit trail. Stale requests cannot overwrite newer records.")}</p>
            </div>:null}
          </>}
        </div>
      </div>
    </>}
  </section>;
}
