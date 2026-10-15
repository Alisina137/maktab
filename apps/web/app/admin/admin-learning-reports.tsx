"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { formatAdminHijriDateTime } from "./admin-hijri-date-picker";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import type { AcademicContext } from "./admin-learning-exams";

type ReportRow = {
  assignmentId: string; classId: string; className: string; subjectId: string;
  subjectName: string; teacherName: string; examSubjects: number;
  publishedExamSubjects: number; publishedGrades: number; publishedHomework: number;
  submissionsAwaitingReview: number; curriculumUnits: number;
  completedUnits: number; completedLessons: number;
};
type Report = {
  rows: ReportRow[]; total: number; limit: number; offset: number;
  summary: { assignments: number; examSubjects: number; publishedExamSubjects: number;
    publishedGrades: number; publishedHomework: number; submissionsAwaitingReview: number;
    curriculumUnits: number; completedUnits: number; completedLessons: number };
  coverage: "ASSIGNED_CLASS_SUBJECTS_ONLY";
};
type AuditCategory = "ALL" | "EXAMS" | "GRADES" | "HOMEWORK" | "CURRICULUM";
type AuditRow = { id: string; createdAt: string; action: string; entityType: string; actorUsername: string | null };
type Audit = { rows: AuditRow[]; total: number; limit: number; offset: number;
  scope: "MATCHED_LIVE_YEAR_ENTITIES"; timezone: "UTC" };
type ExportResult = { filename: string; csv: string; exportedRows: number; total: number; truncated: boolean };
type ReportFilters = { classId: string; subjectId: string; search: string };
type AuditFilters = { category: AuditCategory; from: string; to: string };
const PAGE_SIZE = 20;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const categories: AuditCategory[] = ["ALL", "EXAMS", "GRADES", "HOMEWORK", "CURRICULUM"];
const reportDefaults: ReportFilters = { classId:"", subjectId:"", search:"" };
const auditDefaults: AuditFilters = { category:"ALL", from:"", to:"" };

async function request<T>(accessToken: string, path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(API_URL+path, {
    signal, headers: {Authorization:"Bearer "+accessToken, "Content-Type":"application/json"}
  });
  const result = await response.json().catch(()=>null);
  if (!response.ok) throw new Error(result?.message ?? "Request failed.");
  return result as T;
}

export function AdminLearningReports({accessToken, locale, yearId, academics}: {
  accessToken:string; locale:AdminLocale; yearId:string; academics:AcademicContext;
}) {
  const t = (s:string)=>adminText(locale,s);
  const number = (n:number)=>new Intl.NumberFormat(locale).format(n);
  const [section,setSection] = useState<"SUMMARY"|"AUDIT">("SUMMARY");
  const [searchDraft,setSearchDraft] = useState("");
  const [reportFilters,setReportFilters] = useState<ReportFilters>(reportDefaults);
  const [auditFilters,setAuditFilters] = useState<AuditFilters>(auditDefaults);
  const [reportOffset,setReportOffset] = useState(0);
  const [auditOffset,setAuditOffset] = useState(0);
  const [reload,setReload] = useState(0);
  const [report,setReport] = useState<Report|null>(null);
  const [audit,setAudit] = useState<Audit|null>(null);
  const [requestStatus,setRequestStatus] = useState<"loading"|"ready"|"error">("loading");
  const [loadedKey,setLoadedKey] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [exportBusy,setExportBusy] = useState(false);
  const sequence = useRef(0);
  const tokenRef = useRef(accessToken);
  const yearRef = useRef(yearId);
  tokenRef.current = accessToken; yearRef.current = yearId;
  const classOptions = useMemo(()=>academics.classes.filter(x=>x.academicYearId===yearId)
    .sort((a,b)=>a.name.localeCompare(b.name)),[academics.classes,yearId]);
  const subjectOptions = useMemo(()=>academics.subjects.slice()
    .sort((a,b)=>a.name.localeCompare(b.name)),[academics.subjects]);
  const badRange = Boolean(auditFilters.from && auditFilters.to &&
    auditFilters.from > auditFilters.to);
  const requestKey = JSON.stringify([accessToken,yearId,section,
    reportFilters,auditFilters,reportOffset,auditOffset,reload,locale]);

  useEffect(()=>{
    setSection("SUMMARY"); setReportFilters(reportDefaults);
    setAuditFilters(auditDefaults); setSearchDraft("");
    setReportOffset(0); setAuditOffset(0);
    setReport(null); setAudit(null); setLoadedKey("");
    setNotice(""); setExportBusy(false);
  },[accessToken,yearId]);

  useEffect(()=>{
    const controller=new AbortController();
    const id=++sequence.current;
    setReport(null);setAudit(null);setLoadedKey("");setError("");
    if(!yearId){setRequestStatus("ready");return ()=>controller.abort();}
    if(section==="AUDIT"&&badRange){
      setRequestStatus("error");setError(t("Audit date range must be chronological."));
      return ()=>controller.abort();
    }
    setRequestStatus("loading");
    const params=new URLSearchParams({academicYearId:yearId,
      limit:String(PAGE_SIZE),offset:String(section==="SUMMARY"?reportOffset:auditOffset)});
    if(section==="SUMMARY"){
      if(reportFilters.classId)params.set("classId",reportFilters.classId);
      if(reportFilters.subjectId)params.set("subjectId",reportFilters.subjectId);
      if(reportFilters.search)params.set("search",reportFilters.search);
    }else{
      params.set("category",auditFilters.category);
      if(auditFilters.from)params.set("from",auditFilters.from);
      if(auditFilters.to)params.set("to",auditFilters.to);
    }
    const url="/v1/admin/learning/"+(section==="SUMMARY"?"reports":"audit")+"?"+params;
    void request<Report|Audit>(accessToken,url,controller.signal).then(value=>{
      if(controller.signal.aborted||sequence.current!==id)return;
      if(section==="SUMMARY")setReport(value as Report);else setAudit(value as Audit);
      setLoadedKey(requestKey);setRequestStatus("ready");
    }).catch(cause=>{
      if(controller.signal.aborted||sequence.current!==id)return;
      setError(adminErrorText(locale,cause,"Could not load academic reports."));
      setRequestStatus("error");
    });
    return ()=>controller.abort();
  },[accessToken,locale,yearId,section,reportFilters,auditFilters,
    reportOffset,auditOffset,reload,badRange]);

  function applySearch(e: FormEvent<HTMLFormElement>){
    e.preventDefault();setReportFilters(old=>({...old,search:searchDraft.trim()}));setReportOffset(0);
  }
  function reportFilter<K extends keyof ReportFilters>(key:K,value:ReportFilters[K]){
    setReportFilters(old=>({...old,[key]:value}));setReportOffset(0);
  }
  function auditFilter<K extends keyof AuditFilters>(key:K,value:AuditFilters[K]){
    setAuditFilters(old=>({...old,[key]:value}));setAuditOffset(0);
  }
  async function exportFile(){
    if(!yearId||exportBusy||(section==="AUDIT"&&badRange))return;
    const token=accessToken,year=yearId;
    setExportBusy(true);setError("");setNotice("");
    const params=new URLSearchParams({academicYearId:year});
    if(section==="SUMMARY"){
      if(reportFilters.classId)params.set("classId",reportFilters.classId);
      if(reportFilters.subjectId)params.set("subjectId",reportFilters.subjectId);
      if(reportFilters.search)params.set("search",reportFilters.search);
    }else{
      params.set("category",auditFilters.category);
      if(auditFilters.from)params.set("from",auditFilters.from);
      if(auditFilters.to)params.set("to",auditFilters.to);
    }
    const controller=new AbortController();
    try{
      const result=await request<ExportResult>(token,"/v1/admin/learning/"+
        (section==="SUMMARY"?"reports":"audit")+"/export?"+params,controller.signal);
      if(tokenRef.current!==token||yearRef.current!==year)return;
      const url=URL.createObjectURL(new Blob([result.csv],{type:"text/csv;charset=utf-8"}));
      const anchor=document.createElement("a");
      anchor.href=url;anchor.download=result.filename;document.body.appendChild(anchor);
      anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice(result.truncated
        ? adminFormat(locale,"Exported first {count} of {total} records. Narrow filters to include the rest.",{
          count:number(result.exportedRows),total:number(result.total)})
        : adminFormat(locale,"Exported {count} records.",{count:number(result.exportedRows)}));
    }catch(cause){
      if(tokenRef.current===token&&yearRef.current===year)
        setError(adminErrorText(locale,cause,"Could not export academic CSV."));
    }finally{
      if(tokenRef.current===token&&yearRef.current===year)setExportBusy(false);
    }
  }
  const activeData=section==="SUMMARY"?report:audit;
  const activeOffset=section==="SUMMARY"?reportOffset:auditOffset;
  const movePage=(next:number)=>{
    if(section==="SUMMARY")setReportOffset(next);
    else setAuditOffset(next);
  };
  return <div className="learning-report-workspace">
    <header className="learning-panel-heading">
      <div><h3>{t("Academic reports & audit")}</h3>
        <p>{t("Review school academic outcomes and recorded learning activity for the selected academic year.")}</p>
      </div><button type="button" className="admin-secondary" onClick={()=>setReload(v=>v+1)}>
        {t("Refresh")}</button>
    </header>
    <nav className="learning-report-tabs" role="tablist" aria-label={t("Academic report sections")}>
      {(["SUMMARY","AUDIT"] as const).map(tab=><button type="button" role="tab"
        key={tab} aria-selected={section===tab}
        onClick={()=>setSection(tab)}>{t("Report section: "+tab)}</button>)}
    </nav>
    {!yearId?<div className="admin-panel learning-empty"><strong>{t("Select an academic year")}</strong>
      <p>{t("Select an academic year above to review learning activity.")}</p></div>:<>
      {section==="SUMMARY"?<>
        <form className="learning-report-filters" role="search" onSubmit={applySearch}>
          <label>{t("Search teacher, class or subject")}
            <input value={searchDraft} maxLength={100} onChange={e=>setSearchDraft(e.target.value)} /></label>
          <label>{t("Class")}<select value={reportFilters.classId}
            onChange={e=>reportFilter("classId",e.target.value)}>
            <option value="">{t("All classes")}</option>
            {classOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
          </select></label>
          <label>{t("Subject")}<select value={reportFilters.subjectId}
            onChange={e=>reportFilter("subjectId",e.target.value)}>
            <option value="">{t("All subjects")}</option>
            {subjectOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
          </select></label>
          <button className="admin-primary" type="submit">{t("Search")}</button>
          <button className="admin-secondary" type="button" onClick={()=>{
            setReportFilters(reportDefaults);setSearchDraft("");setReportOffset(0);
          }}>{t("Clear filters")}</button>
        </form>
        <p className="admin-copy">{t("Report figures cover assigned class-subject pairs. Unassigned subjects are excluded; draft grades are never counted as published.")}</p>
        {requestStatus==="ready"&&report&&loadedKey===requestKey?<>
          <div className="learning-report-metrics">
            {([
              ["Assigned class-subjects",report.summary.assignments],
              ["Configured exam subjects",report.summary.examSubjects],
              ["Published exam subjects",report.summary.publishedExamSubjects],
              ["Published grade records",report.summary.publishedGrades],
              ["Published homework",report.summary.publishedHomework],
              ["Teacher reviews pending",report.summary.submissionsAwaitingReview],
              ["Completed curriculum chapters",report.summary.completedUnits],
              ["Curriculum chapters configured",report.summary.curriculumUnits],
              ["Completed lessons",report.summary.completedLessons]
            ] as const).map(([title,value])=><div key={title}>
              <span>{t(title)}</span><strong>{number(value)}</strong>
            </div>)}
          </div>
          <p className="admin-copy">{adminFormat(locale,"{count} assigned class-subject record(s)",{
            count:number(report.total)})}</p>
          <div className="learning-report-rows">
            {report.rows.map(row=><article className="learning-report-row" key={row.assignmentId}>
              <div><strong>{row.className} · {row.subjectName}</strong><small>
                {t("Assigned teacher")}: {row.teacherName}</small></div>
              <div className="learning-report-row-values">
                {([
                  ["Published exam subjects",row.publishedExamSubjects],
                  ["Published grade records",row.publishedGrades],
                  ["Published homework",row.publishedHomework],
                  ["Teacher reviews pending",row.submissionsAwaitingReview],
                  ["Completed curriculum chapters",row.completedUnits],
                  ["Curriculum chapters configured",row.curriculumUnits],
                  ["Completed lessons",row.completedLessons]
                ] as const).map(([label,value])=><span key={label}>
                  {t(label)}: <b>{number(value)}</b></span>)}
              </div>
            </article>)}
            {!report.rows.length?<p className="learning-empty">
              {t("No assigned class-subject records match these filters.")}</p>:null}
          </div>
        </>:null}
      </>:<>
        <div className="learning-report-filters">
          <label>{t("Activity category")}<select value={auditFilters.category}
            onChange={e=>auditFilter("category",e.target.value as AuditCategory)}>
            {categories.map(x=><option key={x} value={x}>{t("Audit category: "+x)}</option>)}
          </select></label>
          <label>{t("From (UTC calendar date)")}<input type="date" value={auditFilters.from}
            onChange={e=>auditFilter("from",e.target.value)} /></label>
          <label>{t("To (UTC calendar date)")}<input type="date" value={auditFilters.to}
            onChange={e=>auditFilter("to",e.target.value)} /></label>
          <button type="button" className="admin-secondary" onClick={()=>{
            setAuditFilters(auditDefaults);setAuditOffset(0);
          }}>{t("Clear filters")}</button>
        </div>
        <p className="admin-copy">{t("Only actions linked to surviving learning records in this academic year are listed. Deleted chapters and private metadata are not included.")}</p>
        {requestStatus==="ready"&&audit&&loadedKey===requestKey?<>
          <p className="admin-copy">{adminFormat(locale,"{count} audit event(s)",{count:number(audit.total)})}</p>
          <div className="learning-report-audit-list">
            {audit.rows.map(row=><article key={row.id} className="learning-report-audit-item">
              <div><strong>{t(row.action)}</strong><small>{t("Record")}: {row.entityType}</small></div>
              <div><small>{formatAdminHijriDateTime(locale,row.createdAt,"Asia/Kabul")}</small>
                <small>{t("Actor")}: {row.actorUsername ?? t("Unknown")}</small></div>
            </article>)}
            {!audit.rows.length?<p className="learning-empty">{t("No matching learning audit events.")}</p>:null}
          </div>
        </>:null}
      </>}
      {requestStatus==="loading"?<p role="status">{t("Loading academic reports data…")}</p>:null}
      {requestStatus==="error"||error?<div className="admin-error" role="alert">
        {error || t("Could not load academic reports.")}
        <button type="button" className="admin-secondary" onClick={()=>setReload(v=>v+1)}>{t("Retry")}</button>
      </div>:null}
      {requestStatus==="ready"&&activeData&&loadedKey===requestKey?<nav
        className="learning-results-pagination" aria-label={t("Report pages")}>
        <button type="button" className="admin-secondary" disabled={activeOffset===0}
          onClick={()=>movePage(Math.max(0,activeOffset-PAGE_SIZE))}>{t("Previous")}</button>
        <span>{adminFormat(locale,"Page {current} of {total}",{
          current:number(Math.floor(activeOffset/PAGE_SIZE)+1),
          total:number(Math.max(1,Math.ceil(activeData.total/PAGE_SIZE)))})}</span>
        <button type="button" className="admin-secondary"
          disabled={activeOffset+PAGE_SIZE>=activeData.total}
          onClick={()=>movePage(activeOffset+PAGE_SIZE)}>{t("Next")}</button>
      </nav>:null}
      <div className="learning-report-export">
        <button type="button" className="admin-secondary"
          disabled={exportBusy||badRange&&section==="AUDIT"||requestStatus==="loading"}
          onClick={()=>void exportFile()}>
          {exportBusy?t("Exporting…"):t(section==="SUMMARY"?"Export academic report CSV":"Export learning audit CSV")}
        </button>
        <small>{t("CSV exports contain at most 500 records, escape spreadsheet formulas and are logged. Narrow filters if an export is truncated.")}</small>
      </div>
      {notice?<p role="status" className="admin-copy">{notice}</p>:null}
    </>}
  </div>;
}
