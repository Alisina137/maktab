"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { adminApi, friendlyAdminError } from "../../admin-client";
import { AdminHijriDatePicker, formatAdminHijriDate } from "../../admin-hijri-date-picker";
import { useAdminWorkspace } from "../../admin-workspace";
import { staffWorkText } from "../../../staff/staff-work-i18n";
import type { WorkTask, MessageDraft } from "../../../staff/staff-work-panel";
import "../../../staff/staff-work.css";

type StaffOption={id:string;fullName:string;employeeCode:string|null};
type TasksResponse={tasks:Array<WorkTask & {assignedTo:string;createdBy:string}>;staff:StaffOption[]};
export default function StaffWorkAdministration(){
  const {stored,locale}=useAdminWorkspace();
  const t=(label:string)=>staffWorkText(locale,label);
  const [tab,setTab]=useState<"tasks"|"drafts">("tasks");
  const [tasks,setTasks]=useState<TasksResponse>({tasks:[],staff:[]});
  const [drafts,setDrafts]=useState<MessageDraft[]>([]);
  const [title,setTitle]=useState("");
  const [details,setDetails]=useState("");
  const [assignedTo,setAssignedTo]=useState("");
  const [priority,setPriority]=useState<"LOW"|"NORMAL"|"HIGH">("NORMAL");
  const [dueDate,setDueDate]=useState("");
  const [selected,setSelected]=useState<MessageDraft|null>(null);
  const [reviewNote,setReviewNote]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const api=useCallback(<T,>(path:string,init:RequestInit={}):Promise<T>=>adminApi<T>(path,{
    ...init,cache:"no-store",headers:{...init.headers,
      Authorization:`Bearer ${stored.session.accessToken}`}
  }),[stored.session.accessToken]);
  const reload=useCallback(async()=>{
    const [t,d]=await Promise.all([
      api<TasksResponse>("/v1/admin/staff-work/tasks"),
      api<{drafts:MessageDraft[]}>("/v1/admin/staff-work/drafts")
    ]);
    setTasks(t);setDrafts(d.drafts);
    setSelected(old=>d.drafts.find(x=>x.id===old?.id)??null);
  },[api]);
  useEffect(()=>{
    let alive=true;setLoading(true);
    void Promise.all([
      api<TasksResponse>("/v1/admin/staff-work/tasks"),
      api<{drafts:MessageDraft[]}>("/v1/admin/staff-work/drafts")
    ]).then(([t,d])=>{if(alive){setTasks(t);setDrafts(d.drafts);}})
      .catch(e=>{if(alive)setError(friendlyAdminError(e,"Could not load staff operations.",locale));})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[api,locale]);
  async function createTask(event:FormEvent){
    event.preventDefault();if(busy)return;
    setBusy(true);setError("");setSuccess("");
    try{
      await api("/v1/admin/staff-work/tasks",{method:"POST",
        body:JSON.stringify({assignedTo,title:title.trim(),details:details.trim(),
          priority,dueDate:dueDate||null})});
      await reload();
      setTitle("");setDetails("");setDueDate("");
      setSuccess(t("Task assigned successfully."));
    }catch(e){setError(friendlyAdminError(e,"Could not assign task.",locale));}
    finally{setBusy(false);}
  }
  async function decide(action:"APPROVE"|"REJECT"){
    if(!selected||busy)return;
    if(!window.confirm(t(action==="APPROVE"?
       "Approve the copy for administrator publication?":"Reject this draft?")))return;
    setBusy(true);setError("");setSuccess("");
    try{
      await api("/v1/admin/staff-work/drafts/"+selected.id+"/decision",{
        method:"POST",body:JSON.stringify({action,note:reviewNote.trim()})
      });
      await reload();setReviewNote("");
      setSuccess(t(action==="APPROVE"?"Copy approved. Not published.":"Draft rejected and staff notified."));
    }catch(e){setError(friendlyAdminError(e,"Could not review draft.",locale));}
    finally{setBusy(false);}
  }
  const assignees=useMemo(()=>new Map(tasks.staff.map(x=>[x.id,x.fullName])),[tasks.staff]);
  return <section className="staff-work staff-work-admin">
    <header className="staff-work-hero">
      <div><span className="eyebrow">{t("School administration")}</span>
        <h2>{t("Staff tasks & communication review")}</h2>
        <p>{t("Assign work and approve communication copy. Publication remains in the administrator announcement workspace.")}</p>
      </div>
      <button type="button" className="admin-secondary" disabled={busy||loading}
        onClick={()=>void reload().catch(e=>setError(friendlyAdminError(e,"Could not refresh.",locale)))}>{t("Refresh")}</button>
    </header>
    <div className="staff-work-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab==="tasks"}
        onClick={()=>setTab("tasks")}>{t("Staff task assignments")}</button>
      <button type="button" role="tab" aria-selected={tab==="drafts"}
        onClick={()=>setTab("drafts")}>{t("Communication review")}
        {" ("+drafts.filter(x=>x.status==="SUBMITTED").length+")"}</button>
    </div>
    {error?<p className="admin-error" role="alert">{error}</p>:null}
    {success?<p className="staff-reg-success" role="status">{success}</p>:null}
    {loading?<p role="status" className="admin-panel">{t("Loading staff work…")}</p>:null}
    {!loading&&tab==="tasks"?<div role="tabpanel" className="staff-work-draft-grid">
      <section className="admin-panel staff-work-area">
        <h3>{t("Assign new task")}</h3>
        <form className="admin-form" onSubmit={createTask}>
          <label>{t("Assigned staff")}<select required value={assignedTo}
            onChange={e=>setAssignedTo(e.target.value)}>
            <option value="">{t("Select a staff member")}</option>
            {tasks.staff.map(x=><option key={x.id} value={x.id}>{x.fullName} {x.employeeCode?("("+x.employeeCode+")"):""}</option>)}
          </select></label>
          <label>{t("Task title")}<input required minLength={3} maxLength={160}
            value={title} onChange={e=>setTitle(e.target.value)}/></label>
          <label>{t("Instructions")}<textarea maxLength={2000} rows={4}
            value={details} onChange={e=>setDetails(e.target.value)}/></label>
          <label>{t("Priority")}<select value={priority}
            onChange={e=>setPriority(e.target.value as typeof priority)}>
            {["LOW","NORMAL","HIGH"].map(x=><option key={x} value={x}>{t(x)}</option>)}
          </select></label>
          <label>{t("Due date (optional)")}
            <AdminHijriDatePicker locale={locale} value={dueDate} onChange={setDueDate}/>
          </label>
          <button className="admin-primary" disabled={busy||!assignedTo||title.trim().length<3}>{t("Assign task")}</button>
        </form>
      </section>
      <section className="admin-panel staff-work-area">
        <h3>{t("Assigned tasks")}</h3>
        <div className="staff-work-list">{tasks.tasks.map(x=><article className="staff-work-item" key={x.id}>
          <header><strong>{x.title}</strong><span className="pilot-badge">{t(x.status.replaceAll("_"," "))}</span></header>
          <p>{assignees.get(x.assignedTo)||t("Former staff member")} · {t(x.priority)}</p>
          {x.details?<p>{x.details}</p>:null}
          {x.dueDate?<small>{t("Due")}: {formatAdminHijriDate(locale,x.dueDate)}</small>:null}
        </article>)}
        {!tasks.tasks.length?<p>{t("No tasks have been assigned.")}</p>:null}</div>
      </section>
    </div>:null}
    {!loading&&tab==="drafts"?<div role="tabpanel" className="staff-work-draft-grid">
      <section className="admin-panel staff-work-area">
        <h3>{t("Staff message requests")}</h3>
        <div className="staff-work-list">{drafts.map(x=><button type="button" key={x.id}
          className={"staff-work-item staff-work-select "+(selected?.id===x.id?"staff-work-active":"")}
          onClick={()=>{setSelected(x);setReviewNote("");}}>
          <header><strong>{x.title}</strong><span className="pilot-badge">{t(x.status)}</span></header>
          <small>{t(x.audienceScope)} {x.audienceRole?t(x.audienceRole):""}</small>
        </button>)}
        {!drafts.length?<p>{t("No communication drafts to review.")}</p>:null}</div>
      </section>
      <section className="admin-panel staff-work-area">
        {!selected?<p>{t("Select a message draft to inspect it.")}</p>:<>
          <h3>{selected.title}</h3>
          <p className="staff-work-message-preview">{selected.content}</p>
          <p>{t("Audience")}: {t(selected.audienceScope)} {selected.audienceRole?t(selected.audienceRole):""}</p>
          <p>{t("Status")}: {t(selected.status)}</p>
          {selected.reviewNote?<p>{t("Review note")}: {selected.reviewNote}</p>:null}
          {selected.status==="SUBMITTED"?<div className="admin-form">
            <label>{t("Review note")}<textarea rows={3} maxLength={500}
              value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/></label>
            <div className="staff-work-actions">
              <button className="admin-primary" disabled={busy} type="button"
                onClick={()=>void decide("APPROVE")}>{t("Approve copy")}</button>
              <button className="admin-secondary" type="button"
                disabled={busy||reviewNote.trim().length<3}
                onClick={()=>void decide("REJECT")}>{t("Reject")}</button>
            </div>
          </div>:null}
          {selected.status==="APPROVED"?<div className="staff-work-actions">
            <button type="button" className="admin-secondary" onClick={()=>{
              void navigator.clipboard.writeText(selected.title+"\n\n"+selected.content)
                .then(()=>setSuccess(t("Approved text copied.")))
                .catch(()=>setError(t("Copy was blocked. Select the preview text manually.")));
            }}>{t("Copy approved text")}</button>
            <Link className="admin-primary" href="/admin/communication">{t("Open announcements")}</Link>
          </div>:null}
          <p className="pilot-security-note">{t("Approval does not publish or notify parents, teachers, or students. The administrator must create and publish an announcement separately.")}</p>
        </>}
      </section>
    </div>:null}
  </section>;
}
