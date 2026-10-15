"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminHijriDatePicker, formatAdminHijriDate } from "./admin-hijri-date-picker";
import { AdminLoader } from "./admin-loader";
import { adminText, type AdminLocale } from "./admin-i18n";

type CaseStatus="OPEN"|"IN_PROGRESS"|"RESOLVED"|"DISMISSED";
type Candidate={attendanceId:string;studentId:string;studentAttendanceId:string;studentName:string;
  studentCode:string;classId:string;className:string;date:string;status:"ABSENT"|"LATE";
  existingCaseId:string|null};
type FollowupCase={id:string;studentId:string;studentName:string;studentCode:string;className:string;
  classId:string;date:string;sourceStatus:string;currentStatus:string;status:CaseStatus;
  assignedToUserId:string|null;dueOn:string|null;openingNote:string;resolutionNote:string|null;
  updatedAt:string;createdAt:string};
type Result<T>={total:number;limit:number;offset:number;rows:T[];summary?:Record<CaseStatus,number>};
type Activity={id:string;kind:string;details:string;actorName:string;createdAt:string};
type Filters={from:string;to:string;classId:string;search:string;status:"ALL"|CaseStatus};
const statuses:CaseStatus[]=["OPEN","IN_PROGRESS","RESOLVED","DISMISSED"];
const kinds=["NOTE","CALL","MEETING","MESSAGE"] as const;
const PAGE_SIZE=15;
const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
function request<T>(token:string,path:string,signal?:AbortSignal,options?:{method:string;payload:unknown}):Promise<T>{
  return fetch(API+path,{signal,method:options?.method??"GET",cache:"no-store",
    headers:{Authorization:`Bearer ${token}`,...(options?{"Content-Type":"application/json"}:{})},
    body:options?JSON.stringify(options.payload):undefined
  }).then(async response=>{
    const body=await response.json().catch(()=>({message:"Invalid server response."}));
    if(!response.ok)throw new Error(body.message??body.error??"Request failed.");
    return body as T;
  });
}
function dateNBefore(iso:string,days:number){
  const dt=new Date(iso+"T12:00:00Z");dt.setUTCDate(dt.getUTCDate()-days);
  return dt.toISOString().slice(0,10);
}
function localizedTimestamp(locale:AdminLocale,iso:string){
  return new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kabul"})
    .format(new Date(iso));
}
export function AdminAttendanceFollowups({accessToken,academicYearId,academicYearStatus,schoolToday,locale,classes}:{
  accessToken:string;academicYearId:string;academicYearStatus:string;schoolToday:string;
  locale:AdminLocale;classes:Array<{id:string;name:string;code:string}>;
}){
  const t=(key:string)=>adminText(locale,key);
  const writable=academicYearStatus==="ACTIVE";
  const [mode,setMode]=useState<"CASES"|"CANDIDATES">("CASES");
  const [draft,setDraft]=useState<Filters>({from:"",to:"",classId:"",search:"",status:"ALL"});
  const [applied,setApplied]=useState<Filters>({from:"",to:"",classId:"",search:"",status:"ALL"});
  const [offset,setOffset]=useState(0);
  const [reload,setReload]=useState(0);
  const [data,setData]=useState<Result<FollowupCase|Candidate>|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [createFor,setCreateFor]=useState<Candidate|null>(null);
  const [assignees,setAssignees]=useState<Array<{id:string;username:string}>>([]);
  const [assigned,setAssigned]=useState("");
  const [dueOn,setDueOn]=useState("");
  const [note,setNote]=useState("");
  const [status,setStatus]=useState<CaseStatus>("OPEN");
  const [activityKind,setActivityKind]=useState<(typeof kinds)[number]>("NOTE");
  const [activityNote,setActivityNote]=useState("");
  const [activityPage,setActivityPage]=useState(0);
  const [activityReload,setActivityReload]=useState(0);
  const [activities,setActivities]=useState<{total:number;rows:Activity[]}|null>(null);
  const [activitiesLoading,setActivitiesLoading]=useState(false);

  useEffect(()=>{
    const from=schoolToday?dateNBefore(schoolToday,29):"";
    const initial={from,to:schoolToday,classId:"",search:"",status:"ALL"} as Filters;
    setDraft(initial);setApplied(initial);setSelected(null);setCreateFor(null);
    setOffset(0);setMode("CASES");setError("");setNotice("");
  },[academicYearId,accessToken,schoolToday]);

  useEffect(()=>{
    const controller=new AbortController();
    const params=new URLSearchParams({academicYearId,limit:String(PAGE_SIZE),offset:String(offset)});
    if(applied.from)params.set("from",applied.from);
    if(applied.to)params.set("to",applied.to);
    if(applied.classId)params.set("classId",applied.classId);
    if(applied.search)params.set("search",applied.search);
    if(mode==="CASES"&&applied.status!=="ALL")params.set("status",applied.status);
    setLoading(true);setData(null);setError("");
    void request<Result<FollowupCase|Candidate>>(accessToken,
      `/v1/admin/attendance/followups${mode==="CANDIDATES"?"/candidates":""}?${params}`,
      controller.signal).then(result=>{
        if(controller.signal.aborted)return;setData(result);setLoading(false);
      }).catch(cause=>{
        if(controller.signal.aborted)return;setLoading(false);
        setError(cause instanceof Error?cause.message:t("Could not load follow-ups."));
      });
    return ()=>controller.abort();
  },[accessToken,academicYearId,mode,applied,offset,reload]);

  useEffect(()=>{
    const controller=new AbortController();
    void request<{assignees:Array<{id:string;username:string}>}>(accessToken,
      "/v1/admin/attendance/followups/assignees",controller.signal)
      .then(r=>{if(!controller.signal.aborted)setAssignees(r.assignees);})
      .catch(()=>{if(!controller.signal.aborted)setAssignees([]);});
    return ()=>controller.abort();
  },[accessToken,academicYearId]);

  useEffect(()=>{
    if(!selected||mode!=="CASES"){setActivities(null);return;}
    const controller=new AbortController();setActivitiesLoading(true);setActivities(null);
    void request<{total:number;rows:Activity[]}>(accessToken,
      `/v1/admin/attendance/followups/${selected}/activities?limit=10&offset=${activityPage*10}`,
      controller.signal).then(result=>{
        if(!controller.signal.aborted){setActivities(result);setActivitiesLoading(false);}
      }).catch(cause=>{
        if(!controller.signal.aborted){setActivitiesLoading(false);setError(cause instanceof Error?cause.message:t("Could not load activities."));}
      });
    return ()=>controller.abort();
  },[accessToken,academicYearId,selected,mode,activityPage,activityReload]);

  const cases=mode==="CASES"?(data?.rows??[]) as FollowupCase[]:[];
  const candidates=mode==="CANDIDATES"?(data?.rows??[]) as Candidate[]:[];
  const current=cases.find(item=>item.id===selected)??null;

  function apply(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(draft.from&&draft.to&&(draft.from>draft.to||
      (Date.parse(draft.to+"T12:00:00Z")-Date.parse(draft.from+"T12:00:00Z"))/86400000>61)){
      setError(t("Choose a valid range of up to 62 days."));return;
    }
    setError("");setNotice("");setOffset(0);setSelected(null);setCreateFor(null);
    setApplied({...draft,search:draft.search.trim()});
  }
  function selectCase(item:FollowupCase){
    setSelected(item.id);setCreateFor(null);setAssigned(item.assignedToUserId??"");
    setDueOn(item.dueOn??"");setStatus(item.status);setNote("");
    setActivityNote("");setActivityPage(0);
  }
  function showCase(id:string){
    setMode("CASES");setOffset(0);setSelected(id);setCreateFor(null);setActivityPage(0);
    setApplied({...applied,status:"ALL"});setDraft(f=>({...f,status:"ALL"}));
  }
  async function mutate(path:string,method:string,payload:unknown,success:string){
    if(!writable||busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      await request(accessToken,path,undefined,{method,payload});
      setNotice(t(success));setReload(n=>n+1);setActivityReload(n=>n+1);
      setCreateFor(null);setNote("");setActivityNote("");
    }catch(cause){
      setError(cause instanceof Error?cause.message:t("Follow-up action failed."));
    }finally{setBusy(false);}
  }
  function saveCase(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!createFor||note.trim().length<5)return;
    void mutate("/v1/admin/attendance/followups","POST",{
      academicYearId,attendanceId:createFor.attendanceId,studentId:createFor.studentId,
      openingNote:note.trim(),assignedToUserId:assigned||null,dueOn:dueOn||null
    },"Follow-up opened.");
  }
  function updateCase(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!current||note.trim().length<5)return;
    void mutate(`/v1/admin/attendance/followups/${current.id}`,"PATCH",{
      expectedUpdatedAt:current.updatedAt,status,assignedToUserId:assigned||null,dueOn:dueOn||null,
      note:note.trim()
    },"Follow-up updated.");
  }
  function logActivity(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!current||activityNote.trim().length<5)return;
    void mutate(`/v1/admin/attendance/followups/${current.id}/activities`,"POST",{
      kind:activityKind,details:activityNote.trim()
    },"Activity recorded. No message was sent automatically.");
  }

  return <section className="attendance-followups">
    <header className="admin-section-header"><div>
      <h3>{t("Absence and lateness follow-ups")}</h3>
      <p>{t("Open cases only for submitted absence or lateness marks. Contact actions are logged, never automatically delivered.")}</p>
    </div>
      <button type="button" className="admin-secondary" disabled={busy} onClick={()=>setReload(v=>v+1)}>{t("Refresh")}</button>
    </header>
    {!writable?<p className="attendance-readonly-note" role="note">
      {t("Historical academic years are read-only; follow-up records stay visible.")}
    </p>:null}
    <nav className="attendance-followup-tabs" role="tablist" aria-label={t("Follow-up views")}>
      {(["CASES","CANDIDATES"] as const).map(key=><button type="button" key={key}
        role="tab" aria-selected={mode===key} className={mode===key?"is-active":""}
        onClick={()=>{setMode(key);setOffset(0);setSelected(null);setCreateFor(null);}}>
        {t(key==="CASES"?"Cases":"Recorded marks")}
      </button>)}
    </nav>
    <form className="admin-panel attendance-followup-filter" onSubmit={apply}>
      <label>{t("From")}<AdminHijriDatePicker locale={locale} today={schoolToday} value={draft.from}
        onChange={v=>setDraft(f=>({...f,from:v}))}/></label>
      <label>{t("To")}<AdminHijriDatePicker locale={locale} today={schoolToday} value={draft.to}
        onChange={v=>setDraft(f=>({...f,to:v}))}/></label>
      <label>{t("Class")}<select value={draft.classId}
        onChange={e=>setDraft(f=>({...f,classId:e.target.value}))}>
          <option value="">{t("All classes in selected year")}</option>
          {classes.map(c=><option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}
      </select></label>
      <label>{t("Student name or code")}<input maxLength={100} value={draft.search}
        onChange={e=>setDraft(f=>({...f,search:e.target.value}))} /></label>
      {mode==="CASES"?<label>{t("Case status")}<select value={draft.status}
        onChange={e=>setDraft(f=>({...f,status:e.target.value as Filters["status"]}))}>
          <option value="ALL">{t("All statuses")}</option>
          {statuses.map(s=><option value={s} key={s}>{t(s)}</option>)}
      </select></label>:null}
      <button className="admin-primary" type="submit">{t("Apply filters")}</button>
    </form>
    {data?.summary&&mode==="CASES"?<div className="attendance-followup-summary">
      {statuses.map(s=><div key={s}><strong>{data.summary![s]}</strong><span>{t(s)}</span></div>)}
    </div>:null}
    {error?<div className="admin-error" role="alert">{error}</div>:null}
    {notice?<div className="admin-success" role="status">{notice}</div>:null}
    {loading?<div className="admin-panel" role="status"><AdminLoader label={t("Loading follow-up data…")}/></div>:
      <div className="attendance-followup-body">
        <div className="admin-panel attendance-followup-list">
          <p className="admin-copy">{data?.total??0} {t("records found")}</p>
          {mode==="CANDIDATES"?candidates.map(c=><article className="attendance-followup-row" key={c.studentAttendanceId}>
            <div><strong>{c.studentName}</strong><small>{c.studentCode} · {c.className} · {formatAdminHijriDate(locale,c.date)}</small></div>
            <span className={`attendance-mark attendance-mark-${c.status.toLowerCase()}`}>{t(c.status)}</span>
            {c.existingCaseId?
              <span className="attendance-followup-tag">{t("Case already opened")}</span>:
              <button className="admin-secondary" type="button" disabled={!writable||busy}
                onClick={()=>{setCreateFor(c);setSelected(null);setAssigned("");setDueOn("");setNote("");}}>
                {t("Open follow-up")}</button>}
          </article>):cases.map(c=><button key={c.id} type="button"
            aria-pressed={selected===c.id} className="attendance-followup-row attendance-followup-select"
            onClick={()=>selectCase(c)}>
            <div><strong>{c.studentName}</strong><small>{c.studentCode} · {c.className} · {formatAdminHijriDate(locale,c.date)}</small></div>
            <span className="attendance-followup-tag">{t(c.status)}</span>
            <span className="attendance-mark">{t(c.currentStatus)}</span>
          </button>)}
          {!data?.rows.length?<p className="admin-copy">{t(mode==="CASES"?"No cases match the selected filters.":"No recorded absence or lateness marks match.")}</p>:null}
          {(data?.total??0)>PAGE_SIZE?<div className="attendance-followup-pagination">
            <button type="button" className="admin-secondary" disabled={offset===0}
              onClick={()=>{setOffset(o=>Math.max(0,o-PAGE_SIZE));setSelected(null);}}>{t("Previous")}</button>
            <span>{offset+1}–{Math.min(offset+PAGE_SIZE,data!.total)} / {data!.total}</span>
            <button type="button" className="admin-secondary" disabled={offset+PAGE_SIZE>=data!.total}
              onClick={()=>{setOffset(o=>o+PAGE_SIZE);setSelected(null);}}>{t("Next")}</button>
          </div>:null}
        </div>
        {mode==="CANDIDATES"&&createFor?<form className="admin-panel attendance-followup-detail" onSubmit={saveCase}>
          <h4>{t("Open a follow-up case")}</h4>
          <p>{createFor.studentName} · {t(createFor.status)}</p>
          <label>{t("Responsible staff member")}<select disabled={busy} value={assigned} onChange={e=>setAssigned(e.target.value)}>
            <option value="">{t("Unassigned")}</option>
            {assignees.map(a=><option key={a.id} value={a.id}>{a.username}</option>)}
          </select></label>
          <label>{t("Follow-up due date")}<AdminHijriDatePicker locale={locale} today={schoolToday} value={dueOn} onChange={setDueOn}/></label>
          <label>{t("Opening reason (required)")}<textarea required minLength={5} maxLength={500} value={note}
            onChange={e=>setNote(e.target.value)}/></label>
          <div className="attendance-followup-actions">
            <button className="admin-primary" type="submit" disabled={!writable||busy||note.trim().length<5}>{t("Create case")}</button>
            <button className="admin-secondary" type="button" onClick={()=>setCreateFor(null)}>{t("Cancel")}</button>
          </div>
        </form>:null}
        {mode==="CASES"&&current?<div className="attendance-followup-detail-group">
          <form className="admin-panel attendance-followup-detail" onSubmit={updateCase}>
            <h4>{t("Follow-up case details")}</h4>
            <p><strong>{current.studentName}</strong> · {t(current.sourceStatus)} · {formatAdminHijriDate(locale,current.date)}</p>
            {current.currentStatus!=="ABSENT"&&current.currentStatus!=="LATE"?
              <p className="attendance-readonly-note">{t("The original attendance mark has changed. Review whether this case should be closed.")}</p>:null}
            <p>{t("Opening reason")}: {current.openingNote}</p>
            {current.resolutionNote?<p>{t("Resolution note")}: {current.resolutionNote}</p>:null}
            <label>{t("Case status")}<select value={status} disabled={!writable||busy}
              onChange={e=>setStatus(e.target.value as CaseStatus)}>
              {statuses.map(s=><option key={s} value={s}>{t(s)}</option>)}
            </select></label>
            <label>{t("Responsible staff member")}<select value={assigned} disabled={!writable||busy}
              onChange={e=>setAssigned(e.target.value)}>
              <option value="">{t("Unassigned")}</option>
              {assignees.map(a=><option key={a.id} value={a.id}>{a.username}</option>)}
            </select></label>
            <label>{t("Follow-up due date")}<AdminHijriDatePicker locale={locale} today={schoolToday} value={dueOn}
              onChange={setDueOn} disabled={!writable||busy}/></label>
            <label>{t("Update / resolution reason (required)")}<textarea required minLength={5} maxLength={500}
              disabled={!writable||busy} value={note} onChange={e=>setNote(e.target.value)}/></label>
            <button type="submit" className="admin-primary" disabled={!writable||busy||note.trim().length<5}>
              {t("Save case update")}</button>
          </form>
          <section className="admin-panel attendance-followup-detail">
            <h4>{t("Contact and activity log")}</h4>
            <p className="admin-copy">{t("Logging a call or message documents an action; it does not send a message or call anyone.")}</p>
            <form className="attendance-followup-activity-form" onSubmit={logActivity}>
              <label>{t("Activity type")}<select value={activityKind} disabled={!writable||busy||
                current.status==="RESOLVED"||current.status==="DISMISSED"}
                onChange={e=>setActivityKind(e.target.value as (typeof kinds)[number])}>
                {kinds.map(k=><option key={k} value={k}>{t(k)}</option>)}
              </select></label>
              <label>{t("Activity details")}<textarea required minLength={5} maxLength={500}
                disabled={!writable||busy||current.status==="RESOLVED"||current.status==="DISMISSED"}
                value={activityNote} onChange={e=>setActivityNote(e.target.value)}/></label>
              <button className="admin-secondary" type="submit" disabled={!writable||busy||
                current.status==="RESOLVED"||current.status==="DISMISSED"||activityNote.trim().length<5}>
                {t("Record activity")}</button>
            </form>
            {activitiesLoading?<AdminLoader label={t("Loading case history…")}/>:null}
            {activities?.rows.map(a=><article className="attendance-followup-activity" key={a.id}>
              <strong>{t(a.kind)}</strong><span>{localizedTimestamp(locale,a.createdAt)} · {a.actorName}</span><p>{a.details}</p>
            </article>)}
            {!activitiesLoading&&!activities?.rows.length?<p className="admin-copy">{t("No activity logged yet.")}</p>:null}
            {(activities?.total??0)>10?<div className="attendance-followup-pagination">
              <button className="admin-secondary" type="button" disabled={activityPage===0}
                onClick={()=>setActivityPage(p=>Math.max(0,p-1))}>{t("Previous")}</button>
              <span>{activityPage+1} / {Math.ceil(activities!.total/10)}</span>
              <button className="admin-secondary" type="button" disabled={(activityPage+1)*10>=activities!.total}
                onClick={()=>setActivityPage(p=>p+1)}>{t("Next")}</button>
            </div>:null}
          </section>
        </div>:null}
      </div>}
  </section>;
}
