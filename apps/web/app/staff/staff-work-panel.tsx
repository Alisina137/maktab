"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminLocale } from "../admin/admin-i18n";
import { friendlyAdminError } from "../admin/admin-client";
import { staffWorkText } from "./staff-work-i18n";
import { formatAdminHijriDate } from "../admin/admin-hijri-date-picker";
import "./staff-work.css";

export type WorkTask={
 id:string;title:string;details:string;priority:"LOW"|"NORMAL"|"HIGH";
 status:"TODO"|"IN_PROGRESS"|"DONE"|"CANCELLED";dueDate:string|null;updatedAt:string;
};
export type MessageDraft={
 id:string;title:string;content:string;audienceScope:"SCHOOL"|"ROLE";
 audienceRole:"TEACHER"|"PARENT"|"STUDENT"|null;
 status:"DRAFT"|"SUBMITTED"|"APPROVED"|"REJECTED";
 reviewNote:string|null;updatedAt:string;createdAt:string;
};
type WorkNotice={id:string;title:string;message:string;createdAt:string;readAt:string|null};
type Props={locale:AdminLocale;api:<T>(path:string,init?:RequestInit)=>Promise<T>;
 canTasks:boolean;canDrafts:boolean;initialView?:"tasks"|"drafts"|"notifications";
 compactTaskView?:boolean;onUnreadChange?:(value:number)=>void};
const statusOrder=["TODO","IN_PROGRESS","DONE","CANCELLED"];
const pretty=(value:string)=>value.replaceAll("_"," ");
export function StaffWorkPanel({locale,api,canTasks,canDrafts,
  initialView="tasks",compactTaskView=false,onUnreadChange}:Props){
 const t=(key:string)=>staffWorkText(locale,key);
 const [view,setView]=useState<"tasks"|"drafts"|"notifications">(initialView);
 const [tasks,setTasks]=useState<WorkTask[]>([]);
 const [drafts,setDrafts]=useState<MessageDraft[]>([]);
 const [notices,setNotices]=useState<WorkNotice[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [selectedDraft,setSelectedDraft]=useState<string|null>(null);
 const [draftTitle,setDraftTitle]=useState("");
 const [draftContent,setDraftContent]=useState("");
 const [scope,setScope]=useState<"SCHOOL"|"ROLE">("SCHOOL");
 const [role,setRole]=useState<"TEACHER"|"PARENT"|"STUDENT">("PARENT");
 const [taskFilter,setTaskFilter]=useState("OPEN");
 const fetchAll=useCallback(async()=>{
  const [ts,ds,ns]=await Promise.all([
   canTasks?api<{tasks:WorkTask[]}>("/v1/staff/tasks"):Promise.resolve({tasks:[] as WorkTask[]}),
   canDrafts?api<{drafts:MessageDraft[]}>("/v1/staff/message-drafts"):Promise.resolve({drafts:[] as MessageDraft[]}),
   api<{notifications:WorkNotice[];unreadCount:number}>("/v1/staff/work-notifications")
  ]);
  setTasks(ts.tasks);setDrafts(ds.drafts);setNotices(ns.notifications);
  onUnreadChange?.(ns.unreadCount);
 },[api,canTasks,canDrafts,onUnreadChange]);
 useEffect(()=>{
  let active=true;setLoading(true);
  const startup=async()=>{
    const [ts,ds,ns]=await Promise.all([
      canTasks?api<{tasks:WorkTask[]}>("/v1/staff/tasks"):Promise.resolve({tasks:[] as WorkTask[]}),
      canDrafts?api<{drafts:MessageDraft[]}>("/v1/staff/message-drafts"):Promise.resolve({drafts:[] as MessageDraft[]}),
      api<{notifications:WorkNotice[];unreadCount:number}>("/v1/staff/work-notifications")
    ]);
    if(active){setTasks(ts.tasks);setDrafts(ds.drafts);setNotices(ns.notifications);
      onUnreadChange?.(ns.unreadCount);}
  };
  void startup().catch(e=>{if(active)setError(friendlyAdminError(e,"Unable to load staff work.",locale));})
    .finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[api,canTasks,canDrafts,onUnreadChange,locale]);
 const visibleTasks=useMemo(()=>tasks.filter(x=>taskFilter==="ALL"||
   (taskFilter==="OPEN" ? (x.status==="TODO"||x.status==="IN_PROGRESS"):x.status===taskFilter)),
   [tasks,taskFilter]);
 const currentDraft=drafts.find(x=>x.id===selectedDraft);
 function editDraft(draft:MessageDraft|null){
   setSelectedDraft(draft?.id??null);setDraftTitle(draft?.title??"");
   setDraftContent(draft?.content??"");setScope(draft?.audienceScope??"SCHOOL");
   setRole(draft?.audienceRole??"PARENT");setError("");setSuccess("");
 }
 async function execute(action:()=>Promise<unknown>,message:string):Promise<boolean>{
   if(busy)return false;setBusy(true);setError("");setSuccess("");
   try{await action();await fetchAll();setSuccess(t(message));return true;}
   catch(e){setError(friendlyAdminError(e,"Could not save changes.",locale));return false;}
   finally{setBusy(false);}
 }
 async function changeTask(task:WorkTask,status:"TODO"|"IN_PROGRESS"|"DONE"){
   if(status===task.status)return;
   await execute(()=>api("/v1/staff/tasks/"+task.id,{
     method:"PATCH",body:JSON.stringify({status,expectedUpdatedAt:task.updatedAt})
   }),"Task status updated.");
 }
 async function saveDraft(event:FormEvent){
   event.preventDefault();
   const payload={title:draftTitle.trim(),content:draftContent.trim(),audienceScope:scope,
     audienceRole:scope==="ROLE"?role:null};
   const editable=currentDraft&&["DRAFT","REJECTED"].includes(currentDraft.status);
   if(currentDraft&&!editable)return;
   const saved=await execute(async()=>{
     await api(currentDraft?"/v1/staff/message-drafts/"+currentDraft.id:
        "/v1/staff/message-drafts",{
       method:currentDraft?"PUT":"POST",
       body:JSON.stringify(currentDraft?{...payload,expectedUpdatedAt:currentDraft.updatedAt}:payload)
     });
   },"Draft saved. Submit it when ready for administrator review.");
   if(saved)editDraft(null);
 }
 async function submitDraft(draft:MessageDraft){
   if(!window.confirm(t("Submit this message to the administrator for review?")))return;
   const sent=await execute(()=>api("/v1/staff/message-drafts/"+draft.id+"/submit",{
     method:"POST"
   }),"Message submitted for review. It has not been published.");
   if(sent)editDraft(null);
 }
 async function markRead(notice:WorkNotice){
   if(notice.readAt)return;
   await execute(()=>api("/v1/staff/work-notifications/"+notice.id+"/read",{
     method:"POST"
   }),"Notification marked as read.");
 }
 return <section className="staff-work" aria-label={t("Tasks & communication")}>
  <div className="staff-work-hero"><div><span className="eyebrow">{t("My staff workspace")}</span>
   <h2>{t("Tasks, messages & notifications")}</h2>
   <p>{t("Assigned work stays private to you. Messages require school administrator review.")}</p>
  </div><button className="admin-secondary" type="button" disabled={busy||loading}
    onClick={()=>void execute(fetchAll,"Staff work refreshed.")}>{t("Refresh")}</button></div>
  <div role="tablist" aria-label={t("Work sections")} className="staff-work-tabs">
    {canTasks?<button type="button" role="tab" aria-selected={view==="tasks"}
      onClick={()=>setView("tasks")}>{t("My tasks")} ({tasks.filter(x=>x.status!=="DONE"&&x.status!=="CANCELLED").length})</button>:null}
    {canDrafts?<button type="button" role="tab" aria-selected={view==="drafts"}
      onClick={()=>setView("drafts")}>{t("Communication drafts")} ({drafts.filter(x=>x.status==="DRAFT").length})</button>:null}
    <button type="button" role="tab" aria-selected={view==="notifications"}
      onClick={()=>setView("notifications")}>{t("Notifications")} ({notices.filter(x=>!x.readAt).length})</button>
  </div>
  {error?<p className="admin-error" role="alert">{error}</p>:null}
  {success?<p className="staff-reg-success" role="status">{success}</p>:null}
  {loading?<p role="status" className="admin-panel">{t("Loading staff work…")}</p>:null}
  {!loading&&view==="tasks"&&canTasks?<div className="admin-panel staff-work-area" role="tabpanel">
   <div className="staff-work-bar"><h3>{t("My assigned tasks")}</h3>
    <label>{t("Status")}<select value={taskFilter} onChange={e=>setTaskFilter(e.target.value)}>
      {["OPEN","ALL",...statusOrder].map(x=><option key={x} value={x}>{t(pretty(x))}</option>)}
    </select></label>
   </div>
   <div className={"staff-work-list "+(compactTaskView?"staff-work-compact":"")}>
   {visibleTasks.map(item=><article className="staff-work-item" key={item.id}>
    <header><div><strong>{item.title}</strong>
      <small>{t("Priority")}: {t(item.priority)} · {t("Due")}: {item.dueDate?
        formatAdminHijriDate(locale,item.dueDate):t("No due date")}</small></div>
      <span className="pilot-badge">{t(pretty(item.status))}</span></header>
    {!compactTaskView?<p>{item.details||t("No additional instructions.")}</p>:null}
    {item.status!=="CANCELLED"?<div className="staff-work-actions">
      {item.status==="TODO"?<button className="admin-secondary" type="button" disabled={busy}
        onClick={()=>void changeTask(item,"IN_PROGRESS")}>{t("Start")}</button>:null}
      {item.status!=="DONE"?<button className="admin-primary" type="button" disabled={busy}
        onClick={()=>void changeTask(item,"DONE")}>{t("Mark complete")}</button>:null}
      {item.status==="DONE"?<button className="admin-secondary" type="button" disabled={busy}
        onClick={()=>void changeTask(item,"IN_PROGRESS")}>{t("Reopen")}</button>:null}
    </div>:null}
   </article>)}
   {!visibleTasks.length?<p>{t("No assigned tasks match this filter.")}</p>:null}
   </div>
  </div>:null}
  {!loading&&view==="drafts"&&canDrafts?<div className="staff-work-draft-grid" role="tabpanel">
   <section className="admin-panel staff-work-area">
    <div className="staff-work-bar"><h3>{t("My communication drafts")}</h3>
     <button type="button" className="admin-secondary" onClick={()=>editDraft(null)}>{t("New draft")}</button></div>
    <div className="staff-work-list">{drafts.map(item=><article key={item.id} className="staff-work-item">
      <header><strong>{item.title}</strong><span className="pilot-badge">{t(item.status)}</span></header>
      <small>{t("Audience")}: {t(item.audienceScope)}{item.audienceRole?" · "+t(item.audienceRole):""}</small>
      <p>{item.content.slice(0,160)}{item.content.length>160?"…":""}</p>
      {item.reviewNote?<p>{t("Administrator note")}: {item.reviewNote}</p>:null}
      <div className="staff-work-actions">
        {["DRAFT","REJECTED"].includes(item.status)?<button className="admin-secondary"
          type="button" onClick={()=>editDraft(item)}>{t("Edit")}</button>:null}
        {item.status==="DRAFT"?<button className="admin-primary" type="button"
          disabled={busy} onClick={()=>void submitDraft(item)}>{t("Submit for review")}</button>:null}
      </div>
    </article>)}
    {!drafts.length?<p>{t("No communication drafts yet.")}</p>:null}</div>
   </section>
   <section className="admin-panel staff-work-area">
    <h3>{currentDraft?t("Edit communication draft"):t("Create communication draft")}</h3>
    <p className="pilot-security-note">{t("Saving does not send messages. Only administrators can publish announcements.")}</p>
    <form className="admin-form" onSubmit={saveDraft}>
     <label>{t("Title")}<input required minLength={3} maxLength={160}
       value={draftTitle} onChange={e=>setDraftTitle(e.target.value)}/></label>
     <label>{t("Message")}<textarea required minLength={5} maxLength={5000} rows={7}
       value={draftContent} onChange={e=>setDraftContent(e.target.value)}/></label>
     <label>{t("Audience")}<select value={scope}
       onChange={e=>setScope(e.target.value as typeof scope)}>
       <option value="SCHOOL">{t("SCHOOL")}</option>
       <option value="ROLE">{t("ROLE")}</option>
     </select></label>
     {scope==="ROLE"?<label>{t("Recipient role")}<select value={role}
       onChange={e=>setRole(e.target.value as typeof role)}>
       {["TEACHER","PARENT","STUDENT"].map(value=><option key={value} value={value}>{t(value)}</option>)}
     </select></label>:null}
     <div className="staff-work-actions">
      <button className="admin-primary" type="submit" disabled={busy||draftTitle.trim().length<3||draftContent.trim().length<5}>
       {t("Save draft")}</button>
      {currentDraft?<button className="admin-secondary" type="button" onClick={()=>editDraft(null)}>{t("Cancel editing")}</button>:null}
     </div>
    </form>
   </section>
  </div>:null}
  {!loading&&view==="notifications"?<section className="admin-panel staff-work-area" role="tabpanel">
    <h3>{t("My notifications")}</h3>
    <div className="staff-work-list">{notices.map(item=><article key={item.id}
      className={"staff-work-item "+(!item.readAt?"staff-work-unread":"")}>
      <header><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString(locale)}</small></header>
      <p>{item.message}</p>
      {!item.readAt?<button className="admin-secondary" type="button" disabled={busy}
        onClick={()=>void markRead(item)}>{t("Mark as read")}</button>:null}
    </article>)}
    {!notices.length?<p>{t("No work notifications yet.")}</p>:null}</div>
  </section>:null}
 </section>;
}
