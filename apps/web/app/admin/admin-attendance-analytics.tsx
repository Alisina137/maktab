"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminHijriDatePicker, formatAdminHijriDate } from "./admin-hijri-date-picker";
import { AdminLoader } from "./admin-loader";
import { adminText, type AdminLocale } from "./admin-i18n";

type Counts={
  present:number;absent:number;late:number;excused:number;recorded:number;rate:number|null;
};
type ClassRow=Counts & {classId:string;classCode:string;className:string;submittedRegisters:number};
type DayRow=Counts & {date:string;submittedRegisters:number};
type StudentRow=Counts & {
  studentId:string;studentCode:string;studentName:string;
  classId:string;classCode:string;className:string;
};
type Analytics={
  academicYearId:string;from:string;to:string;
  summary:Counts & {submittedRegisters:number;daysWithRegisters:number};
  classes:ClassRow[];days:DayRow[];
};
type StudentPage={total:number;limit:number;offset:number;rows:StudentRow[]};
type Filters={from:string;to:string;classId:string};
const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
const PAGE_SIZE=15;
const EXPORT_KINDS=["classes","days","students"] as const;
function dateNBefore(iso:string,days:number){
  const d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-days);
  return d.toISOString().slice(0,10);
}
function periodValid(filters:Filters){
  if(!filters.from||!filters.to||filters.from>filters.to)return false;
  const diff=(Date.parse(filters.to+"T12:00:00Z")-Date.parse(filters.from+"T12:00:00Z"))/86400000;
  return Number.isFinite(diff)&&diff>=0&&diff<=61;
}
function analyticsParams(yearId:string,filters:Filters){
  const params=new URLSearchParams({
    academicYearId:yearId,from:filters.from,to:filters.to
  });
  if(filters.classId)params.set("classId",filters.classId);
  return params;
}
async function getJson<T>(url:string,token:string,signal:AbortSignal):Promise<T>{
  const response=await fetch(url,{signal,cache:"no-store",headers:{Authorization:`Bearer ${token}`}});
  const body=await response.json().catch(()=>({message:"Invalid server response."}));
  if(!response.ok)throw new Error(body.message??body.error??"Could not load attendance analytics.");
  return body as T;
}
function pct(value:number|null){return value===null?"—":`${value}%`;}
function CountCell({value}:{value:number|null}){return <span>{value===null?"—":value}</span>;}
function Totals({values,t}:{values:Counts & {submittedRegisters:number;daysWithRegisters:number};t:(s:string)=>string}){
  const summary=[
    [t("Recorded attendance rate"),pct(values.rate)],
    [t("Present"),String(values.present)],
    [t("Absent"),String(values.absent)],
    [t("Late"),String(values.late)],
    [t("Excused"),String(values.excused)],
    [t("Submitted registers"),String(values.submittedRegisters)],
    [t("Days with submitted registers"),String(values.daysWithRegisters)]
  ];
  return <div className="attendance-analytics-metrics">
    {summary.map(([key,val])=><div key={key} className="attendance-analytics-metric">
      <span>{key}</span><strong>{val}</strong>
    </div>)}
  </div>;
}
export function AdminAttendanceAnalytics({accessToken,academicYearId,schoolToday,classes,locale}:{
  accessToken:string;academicYearId:string;schoolToday:string;
  classes:Array<{id:string;name:string;code:string}>;locale:AdminLocale;
}){
  const t=(key:string)=>adminText(locale,key);
  const [draft,setDraft]=useState<Filters>({from:"",to:"",classId:""});
  const [applied,setApplied]=useState<Filters>({from:"",to:"",classId:""});
  const [tab,setTab]=useState<"DAYS"|"CLASSES"|"STUDENTS">("DAYS");
  const [report,setReport]=useState<Analytics|null>(null);
  const [students,setStudents]=useState<StudentPage|null>(null);
  const [page,setPage]=useState(0);
  const [reload,setReload]=useState(0);
  const [loading,setLoading]=useState(true);
  const [studentsLoading,setStudentsLoading]=useState(true);
  const [error,setError]=useState("");
  const [studentsError,setStudentsError]=useState("");
  const [exporting,setExporting]=useState<string|null>(null);
  const [exportError,setExportError]=useState("");

  useEffect(()=>{
    if(!schoolToday)return;
    const fresh={from:dateNBefore(schoolToday,29),to:schoolToday,classId:""};
    setDraft(fresh);setApplied(fresh);setTab("DAYS");setPage(0);
    setReport(null);setStudents(null);setError("");setExportError("");
  },[accessToken,academicYearId,schoolToday]);

  useEffect(()=>{
    if(!periodValid(applied))return;
    const controller=new AbortController();
    setLoading(true);setReport(null);setError("");
    const params=analyticsParams(academicYearId,applied);
    void getJson<Analytics>(`${API}/v1/admin/attendance/analytics?${params}`,
      accessToken,controller.signal).then(data=>{
        if(!controller.signal.aborted){setReport(data);setLoading(false);}
      }).catch(cause=>{
        if(!controller.signal.aborted){
          setError(cause instanceof Error?cause.message:t("Could not load attendance analytics."));
          setLoading(false);
        }
      });
    return ()=>controller.abort();
  },[accessToken,academicYearId,applied,reload]);

  useEffect(()=>{
    if(!periodValid(applied))return;
    const controller=new AbortController();
    setStudentsLoading(true);setStudents(null);setStudentsError("");
    const params=analyticsParams(academicYearId,applied);
    params.set("limit",String(PAGE_SIZE));params.set("offset",String(page*PAGE_SIZE));
    void getJson<StudentPage>(`${API}/v1/admin/attendance/analytics/students?${params}`,
      accessToken,controller.signal).then(data=>{
        if(!controller.signal.aborted){setStudents(data);setStudentsLoading(false);}
      }).catch(cause=>{
        if(!controller.signal.aborted){
          setStudentsError(cause instanceof Error?cause.message:t("Could not load student attendance insights."));
          setStudentsLoading(false);
        }
      });
    return ()=>controller.abort();
  },[accessToken,academicYearId,applied,page,reload]);

  function apply(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!periodValid(draft)){setError(t("Select a valid report range of at most 62 days."));return;}
    setError("");setExportError("");setPage(0);setApplied({...draft});
  }

  async function exportCsv(kind:(typeof EXPORT_KINDS)[number]){
    if(exporting||!periodValid(applied))return;
    setExporting(kind);setExportError("");
    try{
      const params=analyticsParams(academicYearId,applied);params.set("kind",kind);
      const response=await fetch(`${API}/v1/admin/attendance/analytics/export?${params}`,{
        cache:"no-store",headers:{Authorization:`Bearer ${accessToken}`}
      });
      if(!response.ok){
        const body=await response.json().catch(()=>({message:"CSV export failed."}));
        throw new Error(body.message??body.error??"CSV export failed.");
      }
      const bytes=await response.blob();
      const blob=new Blob([bytes],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;
      link.download=`attendance-${kind}-${applied.from}-to-${applied.to}.csv`;
      document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(cause){
      setExportError(cause instanceof Error?cause.message:t("CSV export failed."));
    }finally{setExporting(null);}
  }
  const headings=["DAYS","CLASSES","STUDENTS"] as const;
  return <section className="attendance-analytics" aria-label={t("Attendance analytics and reports")}>
    <header className="admin-section-header"><div>
      <h3>{t("Attendance analytics and reports")}</h3>
      <p>{t("Only submitted marks are included. Missing registers are not absences; excused marks do not affect attendance rate.")}</p>
    </div><button type="button" className="admin-secondary" disabled={loading||exporting!==null}
      onClick={()=>setReload(v=>v+1)}>{t("Refresh")}</button>
    </header>
    <form className="admin-panel attendance-analytics-filter" onSubmit={apply}>
      <label>{t("From")}<AdminHijriDatePicker locale={locale} value={draft.from}
        onChange={from=>setDraft(v=>({...v,from}))} required /></label>
      <label>{t("To")}<AdminHijriDatePicker locale={locale} value={draft.to}
        onChange={to=>setDraft(v=>({...v,to}))} required /></label>
      <label>{t("Class")}<select value={draft.classId}
        onChange={event=>setDraft(v=>({...v,classId:event.target.value}))}>
        <option value="">{t("All classes in selected year")}</option>
        {classes.map(c=><option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}
      </select></label>
      <button type="submit" className="admin-primary" disabled={!periodValid(draft)||loading}>
        {t("Apply filters")}</button>
    </form>
    <div className="attendance-analytics-export" aria-label={t("Download attendance reports")}>
      <span>{t("Download CSV")}:</span>
      {EXPORT_KINDS.map(kind=><button type="button" key={kind} className="admin-secondary"
        disabled={loading||studentsLoading||exporting!==null||!report}
        onClick={()=>void exportCsv(kind)}>
        {exporting===kind?t("Exporting…"):t(kind==="classes"?"Class summary CSV":
          kind==="days"?"Daily trend CSV":"Student summary CSV")}
      </button>)}
    </div>
    {error?<p role="alert" className="admin-error">{error}</p>:null}
    {exportError?<p role="alert" className="admin-error">{exportError}</p>:null}
    {loading?<div role="status" className="admin-panel">
      <AdminLoader label={t("Loading attendance report data…")}/>
    </div>:report?<>
      <Totals values={report.summary} t={t} />
      <p className="attendance-analytics-caption">
        {t("Recorded marks")}: {report.summary.recorded} · {formatAdminHijriDate(locale,applied.from)}
        {" – "}{formatAdminHijriDate(locale,applied.to)}
      </p>
      <nav className="attendance-analytics-tabs" role="tablist" aria-label={t("Report sections")}>
        {headings.map(k=><button key={k} type="button" role="tab"
          aria-selected={tab===k} className={tab===k?"is-active":""}
          onClick={()=>setTab(k)}>{t(k==="DAYS"?"Daily trend":k==="CLASSES"?"Class comparison":"Student insights")}</button>)}
      </nav>
      <article className="admin-panel attendance-analytics-table">
        {tab==="DAYS"?<>
          <h4>{t("Daily recorded attendance trend")}</h4>
          <p>{t("Dates without submitted registers are not plotted as zero attendance.")}</p>
          {report.days.length?<div className="attendance-analytics-trends">
            {report.days.map(d=><div className="attendance-analytics-day" key={d.date}>
              <span>{formatAdminHijriDate(locale,d.date)}</span>
              <div className="attendance-analytics-bar" role="img"
                aria-label={`${formatAdminHijriDate(locale,d.date)}: ${pct(d.rate)}, ${d.recorded} ${t("Recorded marks")}`}>
                <span style={{width:`${d.rate??0}%`}}/>
              </div>
              <strong>{pct(d.rate)}</strong><small>{d.recorded} {t("marks")} · {d.submittedRegisters} {t("registers")}</small>
            </div>)}
          </div>:<p className="admin-copy">{t("No submitted registers in the selected period.")}</p>}
        </>:null}
        {tab==="CLASSES"?<>
          <h4>{t("Attendance by class")}</h4>
          <div className="attendance-analytics-scroll"><table>
            <thead><tr><th>{t("Class")}</th><th>{t("Present")}</th><th>{t("Absent")}</th>
              <th>{t("Late")}</th><th>{t("Excused")}</th><th>{t("Submitted registers")}</th>
              <th>{t("Recorded attendance rate")}</th></tr></thead>
            <tbody>{report.classes.map(c=><tr key={c.classId}>
              <th scope="row">{c.className} · {c.classCode}</th>
              <td><CountCell value={c.present}/></td><td><CountCell value={c.absent}/></td>
              <td><CountCell value={c.late}/></td><td><CountCell value={c.excused}/></td>
              <td><CountCell value={c.submittedRegisters}/></td><td>{pct(c.rate)}</td>
            </tr>)}</tbody>
          </table></div>
          {!report.classes.length?<p>{t("No classes in the selected academic year.")}</p>:null}
        </>:null}
        {tab==="STUDENTS"?<>
          <h4>{t("Students with recorded absence and lateness")}</h4>
          <p>{t("Sorted by recorded absences, then lateness. Students without submitted marks are not ranked.")}</p>
          {studentsError?<div role="alert" className="admin-error">{studentsError}
            <button type="button" className="admin-secondary" onClick={()=>setReload(v=>v+1)}>{t("Retry")}</button>
          </div>:null}
          {studentsLoading?<AdminLoader label={t("Loading student attendance insights…")}/>:students?<>
            <p className="admin-copy">{students.total} {t("student-class entries with recorded marks")}</p>
            <div className="attendance-analytics-scroll"><table>
              <thead><tr><th>{t("Student")}</th><th>{t("Class")}</th><th>{t("Present")}</th>
                <th>{t("Absent")}</th><th>{t("Late")}</th><th>{t("Excused")}</th>
                <th>{t("Recorded attendance rate")}</th></tr></thead>
              <tbody>{students.rows.map(s=><tr key={s.studentId+":"+s.classId}>
                <th scope="row">{s.studentName}<small>{s.studentCode}</small></th>
                <td>{s.className}</td><td>{s.present}</td><td>{s.absent}</td>
                <td>{s.late}</td><td>{s.excused}</td><td>{pct(s.rate)}</td>
              </tr>)}</tbody>
            </table></div>
            {!students.rows.length?<p className="admin-copy">{t("No students have recorded marks in this period.")}</p>:null}
            {students.total>PAGE_SIZE?<div className="attendance-analytics-page">
              <button type="button" className="admin-secondary" disabled={page===0}
                onClick={()=>setPage(v=>Math.max(0,v-1))}>{t("Previous")}</button>
              <span>{page*PAGE_SIZE+1}–{Math.min(students.total,(page+1)*PAGE_SIZE)} / {students.total}</span>
              <button type="button" className="admin-secondary"
                disabled={(page+1)*PAGE_SIZE>=students.total}
                onClick={()=>setPage(v=>v+1)}>{t("Next")}</button>
            </div>:null}
          </>:null}
        </>:null}
      </article>
    </>:null}
  </section>;
}
