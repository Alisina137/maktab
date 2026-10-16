"use client";
import { useEffect, useState, type FormEvent } from "react";
import { adminText, type AdminLocale } from "../admin/admin-i18n";
import { friendlyAdminError } from "../admin/admin-client";

export type RegistrationRow = {
  id:string;createdBy:string;status:"DRAFT"|"SUBMITTED"|"UNDER_REVIEW"|"APPROVED"|"REJECTED";
  fullName:string;studentCode:string;parentName:string;academicYearId:string;gradeLevelId:string;
  documents:{identityChecked:boolean;consentChecked:boolean;priorRecordChecked:boolean};
  notes:string;reviewNote:string|null;approvedStudentId:string|null;
  updatedAt:string;
};
export type RegistrationOptions = {
  years:Array<{id:string;name:string;status:string}>;
  grades:Array<{id:string;name:string}>;
  classes:Array<{id:string;name:string;academicYearId:string;gradeLevelId:string}>;
  parents:Array<{userId:string;fullName:string}>;
};
type Draft = Pick<RegistrationRow,"fullName"|"studentCode"|"parentName"|"academicYearId"|"gradeLevelId"|"documents"|"notes">;
const initial:Draft={fullName:"",studentCode:"",parentName:"",academicYearId:"",gradeLevelId:"",
  documents:{identityChecked:false,consentChecked:false,priorRecordChecked:false},notes:""};
type Props = { locale:AdminLocale; userId:string;
  api:<T>(path:string,init?:RequestInit)=>Promise<T> };
export function StaffRegistrationPanel({locale,userId,api}:Props) {
  const t=(key:string)=>adminText(locale,key);
  const [options,setOptions]=useState<RegistrationOptions|null>(null);
  const [rows,setRows]=useState<RegistrationRow[]>([]);
  const [filter,setFilter]=useState("ALL");
  const [draft,setDraft]=useState<Draft>(initial);
  const [editing,setEditing]=useState<string|null>(null);
  const [selected,setSelected]=useState<RegistrationRow|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  async function reload() {
    const [meta,list]=await Promise.all([
      api<RegistrationOptions>("/v1/staff/registrations/options"),
      api<{requests:RegistrationRow[]}>("/v1/staff/registrations")
    ]);
    setOptions(meta);setRows(list.requests);
    if(selected)setSelected(list.requests.find(r=>r.id===selected.id)??null);
  }
  useEffect(()=>{
    let active=true;
    setLoading(true);
    void Promise.all([
      api<RegistrationOptions>("/v1/staff/registrations/options"),
      api<{requests:RegistrationRow[]}>("/v1/staff/registrations")
    ]).then(([meta,data])=>{if(active){setOptions(meta);setRows(data.requests);}})
      .catch(err=>{if(active)setError(friendlyAdminError(err,"Could not load registration requests.",locale));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[api,locale]);

  async function save(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      const result=await api<{request:RegistrationRow}>(editing
        ? "/v1/staff/registrations/"+editing : "/v1/staff/registrations",
      {method:editing?"PUT":"POST",body:JSON.stringify(draft)});
      await reload();
      setEditing(result.request.id);
      setSelected(result.request);
      setNotice(t("Registration draft saved."));
    }catch(err){setError(friendlyAdminError(err,"Could not save registration.",locale));}
    finally{setBusy(false);}
  }
  async function submit(id:string) {
    if(!window.confirm(t("Submit this registration for administrator review?")))return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("/v1/staff/registrations/"+id+"/submit",{method:"POST"});
      await reload();setEditing(null);setDraft(initial);
      setNotice(t("Submitted for administrator review."));
    }catch(err){setError(friendlyAdminError(err,"Could not submit registration.",locale));}
    finally{setBusy(false);}
  }
  function choose(row:RegistrationRow){
    setSelected(row);setError("");setNotice("");
    if(row.status==="DRAFT"&&row.createdBy===userId){
      setEditing(row.id);
      setDraft({fullName:row.fullName,studentCode:row.studentCode,parentName:row.parentName,
        academicYearId:row.academicYearId,gradeLevelId:row.gradeLevelId,
        documents:{...row.documents},notes:row.notes});
    } else {setEditing(null);setDraft(initial);}
  }
  const visible=filter==="ALL"?rows:rows.filter(r=>r.status===filter);
  const missing=selected?.status==="DRAFT"?
    (!selected.documents.identityChecked||!selected.documents.consentChecked):false;
  return <section className="staff-reg-layout">
    <div className="staff-reg-overview">
      <div><span className="eyebrow">{t("Student registration")}</span>
        <h2>{t("Registration & enrollment requests")}</h2>
        <p>{t("Prepare a student application. The school administrator reviews and approves enrollment.")}</p></div>
      <div className="staff-reg-counts">
        <strong>{rows.filter(r=>r.status==="DRAFT").length}<small>{t("Drafts")}</small></strong>
        <strong>{rows.filter(r=>["SUBMITTED","UNDER_REVIEW"].includes(r.status)).length}<small>{t("Pending review")}</small></strong>
        <strong>{rows.filter(r=>r.status==="APPROVED").length}<small>{t("Approved")}</small></strong>
      </div>
    </div>
    {error?<p className="admin-error" role="alert">{error}</p>:null}
    {notice?<p className="staff-reg-success" role="status">{notice}</p>:null}
    {loading?<div className="admin-panel" role="status">{t("Loading registration requests…")}</div>:
    <div className="staff-reg-columns">
      <section className="admin-panel staff-reg-form">
        <div className="admin-section-header"><div><h3>{t(editing?"Edit draft":"New registration")}</h3>
          <p>{t("Information stays a draft until you explicitly submit it.")}</p></div>
          <button type="button" className="admin-secondary" disabled={busy}
            onClick={()=>{setEditing(null);setSelected(null);setDraft(initial);setError("");}}>
            {t("Start new")}</button></div>
        <form className="admin-form staff-reg-fields" onSubmit={save}>
          <label>{t("Student full name")}<input value={draft.fullName} required minLength={2} maxLength={160}
            onChange={e=>setDraft(x=>({...x,fullName:e.target.value}))}/></label>
          <label>{t("Student code")}<input value={draft.studentCode} required minLength={2} maxLength={32}
            pattern="[A-Za-z0-9_-]+" onChange={e=>setDraft(x=>({...x,studentCode:e.target.value}))}
            placeholder="S-0006"/></label>
          <label>{t("Guardian name")}<input value={draft.parentName} required minLength={2} maxLength={160}
            onChange={e=>setDraft(x=>({...x,parentName:e.target.value}))}/></label>
          <div className="staff-reg-two">
            <label>{t("Academic year")}<select value={draft.academicYearId} required
              onChange={e=>setDraft(x=>({...x,academicYearId:e.target.value}))}>
                <option value="">{t("Select academic year")}</option>
                {options?.years.filter(x=>x.status==="ACTIVE"||x.status==="DRAFT").map(x=>
                  <option key={x.id} value={x.id}>{x.name} · {t(x.status)}</option>)}
              </select></label>
            <label>{t("Proposed grade")}<select value={draft.gradeLevelId} required
              onChange={e=>setDraft(x=>({...x,gradeLevelId:e.target.value}))}>
                <option value="">{t("Select grade")}</option>
                {options?.grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
              </select></label>
          </div>
          <fieldset className="staff-reg-checklist"><legend>{t("Document checklist")}</legend>
            {([
              ["identityChecked","Identity document checked"],
              ["consentChecked","Guardian consent confirmed"],
              ["priorRecordChecked","Previous school record checked (optional)"]
            ] as const).map(([key,label])=><label key={key} className="staff-reg-check">
              <input type="checkbox" checked={draft.documents[key]}
                onChange={e=>setDraft(x=>({...x,documents:{...x.documents,[key]:e.target.checked}}))}/>
              <span>{t(label)}</span></label>)}
            <small>{t("These are verification checkboxes, not uploaded files. Identity and consent are required before submission.")}</small>
          </fieldset>
          <label>{t("Registration notes")}<textarea maxLength={1000} rows={3}
            value={draft.notes} onChange={e=>setDraft(x=>({...x,notes:e.target.value}))}/></label>
          <button className="admin-primary" disabled={busy||!options} type="submit">
            {t(busy?"Saving…":editing?"Save draft changes":"Save new draft")}
          </button>
        </form>
        {selected?.status==="DRAFT"&&selected.createdBy===userId?
          <div className="staff-reg-submit">
            <p>{missing?t("Verify identity and consent, then save changes before submitting."):
              t("Your saved draft is ready for final submission.")}</p>
            <button className="admin-secondary" type="button" disabled={busy||missing}
              onClick={()=>void submit(selected.id)}>{t("Submit for review")}</button>
          </div>:null}
      </section>
      <section className="admin-panel staff-reg-queue">
        <div className="admin-section-header"><div><h3>{t("Application queue")}</h3>
          <p>{t("Track drafts, reviews and decisions.")}</p></div>
          <button type="button" className="admin-secondary" disabled={busy}
            onClick={()=>void reload().catch(err=>setError(friendlyAdminError(err,"Could not refresh.",locale)))}>{t("Refresh")}</button>
        </div>
        <label>{t("Application status")}<select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="ALL">{t("All statuses")}</option>
          {["DRAFT","SUBMITTED","UNDER_REVIEW","APPROVED","REJECTED"].map(s=>
            <option key={s} value={s}>{t(s.replaceAll("_"," "))}</option>)}
        </select></label>
        <div className="staff-reg-items">{visible.length===0?<div className="staff-empty">
          {t("No registration requests in this status.")}</div>:visible.map(r=>
          <button type="button" key={r.id} onClick={()=>choose(r)}
            aria-pressed={selected?.id===r.id} className={"staff-reg-item "+(selected?.id===r.id?"staff-reg-item-active":"")}>
            <span><strong>{r.fullName}</strong><small>{r.studentCode} · {r.parentName}</small></span>
            <span className="pilot-badge">{t(r.status.replaceAll("_"," "))}</span>
          </button>)}</div>
        {selected?<div className="staff-reg-detail">
          <h4>{selected.fullName} · {selected.studentCode}</h4>
          <p>{t("Status")}: <strong>{t(selected.status.replaceAll("_"," "))}</strong></p>
          {selected.reviewNote?<p>{t("Review note")}: {selected.reviewNote}</p>:null}
          {selected.approvedStudentId?<p>{t("Student created successfully.")}</p>:null}
          {selected.status==="DRAFT"&&selected.createdBy!==userId?
            <p>{t("Only the creator of a draft can edit or submit it.")}</p>:null}
        </div>:null}
        <p className="pilot-security-note">{t("Staff cannot approve applications or create student accounts.")}</p>
      </section>
    </div>}
  </section>;
}
