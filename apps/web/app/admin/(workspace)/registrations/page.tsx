"use client";
import { useEffect, useState } from "react";
import { useAdminWorkspace } from "../../admin-workspace";
import { adminApi, friendlyAdminError } from "../../admin-client";
import type { RegistrationOptions, RegistrationRow } from "../../../staff/staff-registration-panel";

export default function AdminRegistrationPage(){
  const {stored,locale,t,showToast}=useAdminWorkspace();
  const [rows,setRows]=useState<RegistrationRow[]>([]);
  const [options,setOptions]=useState<RegistrationOptions|null>(null);
  const [selected,setSelected]=useState<RegistrationRow|null>(null);
  const [parent,setParent]=useState("");
  const [classId,setClassId]=useState("");
  const [note,setNote]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function get<T>(url:string,init:RequestInit={}) {
    return adminApi<T>(url,{...init,cache:"no-store",headers:{
      ...init.headers,Authorization:`Bearer ${stored.session.accessToken}`
    }});
  }
  async function reload(){
    const [listing,meta]=await Promise.all([
      get<{requests:RegistrationRow[]}>("/v1/admin/registrations"),
      get<RegistrationOptions>("/v1/admin/registrations/options")
    ]);
    setRows(listing.requests);setOptions(meta);
    setSelected(s=>listing.requests.find(r=>r.id===s?.id)??null);
  }
  useEffect(()=>{
    let active=true;
    setLoading(true);
    void Promise.all([
      get<{requests:RegistrationRow[]}>("/v1/admin/registrations"),
      get<RegistrationOptions>("/v1/admin/registrations/options")
    ]).then(([listing,meta])=>{if(active){setRows(listing.requests);setOptions(meta);}})
      .catch(err=>{if(active)setError(friendlyAdminError(err,"Could not load registration requests.",locale));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[stored.session.accessToken,locale]);
  async function act(action:"REVIEW"|"APPROVE"|"REJECT") {
    if(!selected||busy)return;
    if(!window.confirm(t(action==="APPROVE"?"Approve enrollment and create student?":
      action==="REJECT"?"Reject this application?":"Start reviewing this application?")))return;
    setBusy(true);setError("");
    try{
      const url=`/v1/admin/registrations/${selected.id}/${action==="REVIEW"?"review":"decision"}`;
      const body=action==="REVIEW"?{}:action==="APPROVE"
        ?{action:"APPROVE",parentUserId:parent,classId,note}:{action:"REJECT",note};
      await get(url,{method:"POST",body:JSON.stringify(body)});
      await reload();setNote("");
      showToast({kind:"success",title:t("Registration updated"),message:t("The request status has been saved.")});
    }catch(err){setError(friendlyAdminError(err,"Could not update registration.",locale));}
    finally{setBusy(false);}
  }
  const availableClasses=options?.classes.filter(c=>c.academicYearId===selected?.academicYearId &&
    c.gradeLevelId===selected?.gradeLevelId)??[];
  return <div className="staff-reg-layout">
    <div className="staff-reg-overview"><div><span className="eyebrow">{t("Enrollment approvals")}</span>
      <h2>{t("Registration review queue")}</h2>
      <p>{t("Only school administrators approve enrollment and link existing families.")}</p></div>
      <div className="staff-reg-counts">
        <strong>{rows.filter(r=>r.status==="SUBMITTED").length}<small>{t("Submitted")}</small></strong>
        <strong>{rows.filter(r=>r.status==="UNDER_REVIEW").length}<small>{t("Under review")}</small></strong>
      </div>
    </div>
    {error?<div className="admin-error" role="alert">{error}</div>:null}
    {loading?<section className="admin-panel" role="status">{t("Loading registration requests…")}</section>:
    <div className="staff-reg-columns">
      <section className="admin-panel staff-reg-queue"><h3>{t("All applications")}</h3>
        <div className="staff-reg-items">{rows.map(r=><button type="button" key={r.id}
          className={"staff-reg-item "+(selected?.id===r.id?"staff-reg-item-active":"")}
          aria-pressed={selected?.id===r.id} onClick={()=>{setSelected(r);setClassId("");setParent("");setNote("");}}>
          <span><strong>{r.fullName}</strong><small>{r.studentCode} · {r.parentName}</small></span>
          <span className="pilot-badge">{t(r.status.replaceAll("_"," "))}</span>
        </button>)}
        {!rows.length?<p>{t("No registration requests yet.")}</p>:null}</div>
      </section>
      <section className="admin-panel staff-reg-form">
        {!selected?<p>{t("Select an application to review.")}</p>:<>
          <h3>{selected.fullName}</h3>
          <dl className="pilot-detail-grid">
            <div><dt>{t("Student code")}</dt><dd>{selected.studentCode}</dd></div>
            <div><dt>{t("Guardian name")}</dt><dd>{selected.parentName}</dd></div>
            <div><dt>{t("Academic year")}</dt><dd>{options?.years.find(x=>x.id===selected.academicYearId)?.name??"—"}</dd></div>
            <div><dt>{t("Proposed grade")}</dt><dd>{options?.grades.find(x=>x.id===selected.gradeLevelId)?.name??"—"}</dd></div>
          </dl>
          <div className="staff-reg-detail">
            <h4>{t("Document checklist")}</h4>
            <p>{t("Identity document checked")}: {selected.documents.identityChecked?t("Yes"):t("No")}</p>
            <p>{t("Guardian consent confirmed")}: {selected.documents.consentChecked?t("Yes"):t("No")}</p>
            <p>{t("Previous school record checked (optional)")}: {selected.documents.priorRecordChecked?t("Yes"):t("No")}</p>
            {selected.notes?<p>{t("Registration notes")}: {selected.notes}</p>:null}
            {selected.reviewNote?<p>{t("Review note")}: {selected.reviewNote}</p>:null}
          </div>
          {selected.status==="SUBMITTED"?
            <button type="button" className="admin-primary" disabled={busy}
              onClick={()=>void act("REVIEW")}>{t("Start review")}</button>:null}
          {selected.status==="UNDER_REVIEW"?<div className="admin-form staff-reg-decision">
            <label>{t("Linked parent account")}
              <select value={parent} onChange={e=>setParent(e.target.value)}>
                <option value="">{t("Select existing parent")}</option>
                {options?.parents.map(p=><option key={p.userId} value={p.userId}>{p.fullName}</option>)}
              </select></label>
            <label>{t("Class placement")}
              <select value={classId} onChange={e=>setClassId(e.target.value)}>
                <option value="">{t("Select class")}</option>
                {availableClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            <label>{t("Decision note")}
              <textarea maxLength={1000} rows={3} value={note} onChange={e=>setNote(e.target.value)}/>
            </label>
            <div className="staff-reg-decision-actions">
              <button className="admin-primary" type="button" disabled={busy||!parent||!classId}
                onClick={()=>void act("APPROVE")}>{t("Approve & enroll")}</button>
              <button className="admin-secondary" type="button" disabled={busy||note.trim().length<3}
                onClick={()=>void act("REJECT")}>{t("Reject application")}</button>
            </div>
            <p className="pilot-security-note">{t("Approval creates one student linked to this parent and class. This action cannot be undone from the queue.")}</p>
          </div>:null}
          {selected.status==="APPROVED"?<p className="staff-reg-success">{t("Student created successfully.")}</p>:null}
        </>}
      </section>
    </div>}
  </div>;
}
