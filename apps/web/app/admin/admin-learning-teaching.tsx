"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { formatAdminHijriDate } from "./admin-hijri-date-picker";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import type { AcademicContext } from "./admin-learning-exams";

type Focus = "ALL" | "NO_CURRICULUM" | "NOT_STARTED" | "INCOMPLETE" | "POSTPONED" | "NO_LESSONS";
type UnitStatus = "ALL" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
type LessonStatus = "ALL" | "PLANNED" | "COMPLETED" | "POSTPONED";
type ProgressRow = {
  assignmentId: string; classId: string; className: string; classCode: string;
  subjectId: string; subjectName: string; teacherUserId: string; teacherName: string;
  unitsTotal: number; unitsCompleted: number; unitsInProgress: number; unitsNotStarted: number;
  lessonPlanned: number; lessonCompleted: number; lessonPostponed: number; lessonTotal: number;
  lastLessonDate: string | null; attention: Focus[];
};
type ProgressPage = {
  rows: ProgressRow[]; total: number; limit: number; offset: number;
  summary: { assignments: number; totalUnits: number; completedUnits: number;
    inProgressUnits: number; noCurriculum: number; postponedLessons: number };
};
type Chapter = { id: string; title: string; sortOrder: number;
  status: UnitStatus; updatedAt: string | null };
type Lesson = { id: string; lessonDate: string; topic: string; status: LessonStatus;
  chapterTitle: string | null; updatedAt: string };
type DetailPage<T> = { rows: T[]; total: number; limit: number; offset: number };
type Filters = { classId: string; subjectId: string; focus: Focus; search: string };
const PAGE_SIZE = 20;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const defaults: Filters = { classId: "", subjectId: "", focus: "ALL", search: "" };
const focuses: Focus[] = ["ALL","NO_CURRICULUM","NOT_STARTED","INCOMPLETE","POSTPONED","NO_LESSONS"];
const chapters: UnitStatus[] = ["ALL","NOT_STARTED","IN_PROGRESS","COMPLETED"];
const lessons: LessonStatus[] = ["ALL","PLANNED","COMPLETED","POSTPONED"];

async function read<T>(token: string, url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(API_URL + url, {
    signal, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? "Request failed.");
  return payload as T;
}

export function AdminLearningTeaching({ accessToken, locale, yearId, academics }: {
  accessToken: string; locale: AdminLocale; yearId: string; academics: AcademicContext;
}) {
  const t = (english: string) => adminText(locale, english);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const [draftSearch, setDraftSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(defaults);
  const [offset, setOffset] = useState(0);
  const [version, setVersion] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState<ProgressPage | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const requestKey = JSON.stringify([accessToken, locale, yearId, filters, offset, version]);
  const classOptions = useMemo(() => academics.classes.filter(c => c.academicYearId === yearId)
    .sort((a,b) => a.name.localeCompare(b.name)), [academics.classes, yearId]);
  const subjectOptions = useMemo(() => academics.subjects.slice()
    .sort((a,b) => a.name.localeCompare(b.name)), [academics.subjects]);

  useEffect(() => {
    setFilters(defaults); setDraftSearch(""); setOffset(0);
    setExpandedId(null); setPage(null); setLoadedKey("");
  }, [accessToken, yearId]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++sequence.current;
    setPage(null); setBusy(Boolean(yearId)); setError("");
    if (!yearId) return () => controller.abort();
    const params = new URLSearchParams({
      academicYearId: yearId, limit: String(PAGE_SIZE), offset: String(offset), focus: filters.focus
    });
    if (filters.classId) params.set("classId", filters.classId);
    if (filters.subjectId) params.set("subjectId", filters.subjectId);
    if (filters.search) params.set("search", filters.search);
    void read<ProgressPage>(accessToken, "/v1/admin/teaching/progress?" + params, controller.signal)
      .then(result => { if (!controller.signal.aborted && requestId === sequence.current) {
        setPage(result); setLoadedKey(requestKey); setBusy(false);
      }}).catch(cause => { if (!controller.signal.aborted && requestId === sequence.current) {
        setError(adminErrorText(locale, cause, "Could not load teaching progress."));
        setBusy(false);
      }});
    return () => controller.abort();
  }, [accessToken, locale, yearId, filters, offset, version]);

  function changeFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(old => ({ ...old, [key]: value })); setOffset(0); setExpandedId(null);
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); changeFilter("search", draftSearch.trim());
  }
  const summary = !busy && !error && loadedKey === requestKey ? page?.summary : null;
  const current = Math.floor(offset/PAGE_SIZE)+1;
  return <section className="learning-teaching-workspace">
    <header className="learning-panel-heading">
      <div><h3>{t("Teaching progress")}</h3>
        <p>{t("Compare teacher assignments, curriculum chapter coverage and lesson-plan status across the school.")}</p></div>
      <button type="button" className="admin-secondary" onClick={() => setVersion(n => n+1)}>{t("Refresh")}</button>
    </header>
    <div className="learning-teaching-overview" aria-label={t("Teaching summary")}>
      {([
        ["Teaching assignments", summary?.assignments],
        ["Curriculum chapters completed", summary?.completedUnits == null || summary.totalUnits === 0 ? null :
          summary.completedUnits + "/" + summary.totalUnits],
        ["Chapters in progress", summary?.inProgressUnits],
        ["Assignments missing chapters", summary?.noCurriculum],
        ["Postponed lessons", summary?.postponedLessons]
      ] as const).map(([label,value]) => <div key={label}>
        <span>{t(label)}</span><strong>{value == null ? "—" : typeof value === "number" ? number(value) : value}</strong>
      </div>)}
    </div>
    <p className="admin-copy">{t("No chapter deadlines or pacing targets are recorded. Attention filters flag gaps, not verified teaching delays.")}</p>
    {!yearId ? <div className="admin-panel learning-empty">
      <strong>{t("Select an academic year")}</strong>
      <p>{t("Select an academic year above to review learning activity.")}</p>
    </div> : <>
      <form role="search" className="learning-teaching-filters" onSubmit={search}>
        <label>{t("Teacher, class or subject")}
          <input value={draftSearch} maxLength={100} onChange={e => setDraftSearch(e.target.value)}
            placeholder={t("Search teaching assignments")} /></label>
        <label>{t("Class")}
          <select value={filters.classId} onChange={e => changeFilter("classId",e.target.value)}>
            <option value="">{t("All classes")}</option>
            {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label>{t("Subject")}
          <select value={filters.subjectId} onChange={e => changeFilter("subjectId",e.target.value)}>
            <option value="">{t("All subjects")}</option>
            {subjectOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label>{t("Progress follow-up")}
          <select value={filters.focus} onChange={e => changeFilter("focus", e.target.value as Focus)}>
            {focuses.map(value => <option key={value} value={value}>{t("Teaching focus: " + value)}</option>)}
          </select></label>
        <button type="submit" className="admin-primary">{t("Search")}</button>
        <button type="button" className="admin-secondary" onClick={() => {
          setFilters(defaults); setDraftSearch(""); setOffset(0); setExpandedId(null);
        }}>{t("Clear filters")}</button>
      </form>
      {busy ? <p role="status">{t("Loading teaching progress data…")}</p> : null}
      {error ? <div role="alert" className="admin-error">{error}
        <button type="button" className="admin-secondary" onClick={() => setVersion(v => v+1)}>{t("Retry")}</button>
      </div> : null}
      {!busy && !error && page && loadedKey === requestKey ? <>
        <p className="admin-copy" role="status">{adminFormat(locale,
          "{count} teaching assignment(s)", {count:number(page.total)})}</p>
        {page.rows.length === 0 ? <div className="learning-empty">
          <strong>{t("No teaching assignments match these filters.")}</strong>
          <p>{t("Try a different class, subject, teacher name or follow-up filter.")}</p>
        </div> : <div className="learning-teaching-rows">
          {page.rows.map(row => <TeachingCard key={row.assignmentId} row={row}
            accessToken={accessToken} locale={locale} yearId={yearId}
            expanded={expandedId===row.assignmentId}
            onToggle={() => setExpandedId(id => id===row.assignmentId ? null : row.assignmentId)} />)}
        </div>}
        <nav className="learning-results-pagination" aria-label={t("Teaching assignment pages")}>
          <button type="button" className="admin-secondary" disabled={offset===0}
            onClick={() => { setOffset(x => Math.max(0,x-PAGE_SIZE)); setExpandedId(null); }}>{t("Previous")}</button>
          <span>{adminFormat(locale,"Page {current} of {total}",
            {current:number(current),total:number(Math.max(1,Math.ceil(page.total/PAGE_SIZE)))})}</span>
          <button type="button" className="admin-secondary" disabled={offset+PAGE_SIZE>=page.total}
            onClick={() => { setOffset(x=>x+PAGE_SIZE);setExpandedId(null); }}>{t("Next")}</button>
        </nav>
      </> : null}
    </>}
    <Link className="admin-secondary learning-module-link learning-teaching-curriculum-link"
      href="/admin/academics/curriculum">{t("Open curriculum management")}</Link>
  </section>;
}

function TeachingCard({ row, accessToken, locale, yearId, expanded, onToggle }: {
  row: ProgressRow; accessToken: string; locale: AdminLocale; yearId: string;
  expanded: boolean; onToggle: () => void;
}) {
  const t = (s:string) => adminText(locale,s);
  const number = (n:number) => new Intl.NumberFormat(locale).format(n);
  const rate = row.unitsTotal ? Math.round(100*row.unitsCompleted/row.unitsTotal) : null;
  return <article className="learning-teaching-card">
    <header className="learning-teaching-card-head">
      <div className="learning-teaching-card-title">
        <strong>{row.className} · {row.subjectName}</strong>
        <small>{t("Assigned teacher")}: {row.teacherName}</small>
        {row.lastLessonDate ? <small>{t("Last completed lesson")}: {formatAdminHijriDate(locale,row.lastLessonDate)}</small> : null}
      </div>
      <div className="learning-teaching-badges">
        {row.attention.map(flag => <span key={flag} className="learning-teaching-warning">
          {t("Teaching focus: "+flag)}</span>)}
        {!row.attention.length ? <span className="learning-teaching-ok">{t("Curriculum covered")}</span> : null}
      </div>
    </header>
    <div className="learning-teaching-progress">
      <div><span>{t("Completed chapters")}</span>
        <strong>{number(row.unitsCompleted)} / {number(row.unitsTotal)}</strong>
      </div>
      <progress value={rate??0} max={100} aria-label={t("Curriculum completion")}>
        {rate===null ? "—" : rate+"%"}
      </progress>
      <small>{rate===null ? t("No chapters configured") :
        new Intl.NumberFormat(locale).format(rate)+"% " + t("completed")}</small>
    </div>
    <div className="learning-teaching-counts">
      {([
        ["Chapters in progress",row.unitsInProgress],
        ["Not started chapters",row.unitsNotStarted],
        ["Planned lessons",row.lessonPlanned],
        ["Completed lessons",row.lessonCompleted],
        ["Postponed lessons",row.lessonPostponed]
      ] as const).map(([label,value]) => <div key={label}>
        <span>{t(label)}</span><strong>{number(value)}</strong>
      </div>)}
    </div>
    <button type="button" className="admin-secondary" aria-expanded={expanded}
      aria-controls={"teaching-progress-details-"+row.assignmentId} onClick={onToggle}>
      {expanded ? t("Close details") : t("View teaching details")}
    </button>
    {expanded ? <div id={"teaching-progress-details-"+row.assignmentId} className="learning-teaching-detail">
      <TeachingDetail accessToken={accessToken} locale={locale} yearId={yearId}
        assignmentId={row.assignmentId} />
    </div> : null}
  </article>;
}

function TeachingDetail({ accessToken,locale,yearId,assignmentId }: {
  accessToken:string;locale:AdminLocale;yearId:string;assignmentId:string;
}) {
  const t=(s:string)=>adminText(locale,s);
  const [tab,setTab]=useState<"units"|"lessons">("units");
  const [unitStatus,setUnitStatus]=useState<UnitStatus>("ALL");
  const [lessonStatus,setLessonStatus]=useState<LessonStatus>("ALL");
  const [offset,setOffset]=useState(0);
  const [version,setVersion]=useState(0);
  const [items,setItems]=useState<DetailPage<Chapter>|DetailPage<Lesson>|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const status=tab==="units"?unitStatus:lessonStatus;
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setItems(null);setError("");
    const query=new URLSearchParams({academicYearId:yearId,status,
      limit:String(PAGE_SIZE),offset:String(offset)});
    void read<DetailPage<Chapter>|DetailPage<Lesson>>(accessToken,
      "/v1/admin/teaching/progress/"+assignmentId+"/"+tab+"?"+query,controller.signal)
      .then(page=>{if(!controller.signal.aborted){setItems(page);setLoading(false);}})
      .catch(cause=>{if(!controller.signal.aborted){
        setError(adminErrorText(locale,cause,"Could not load teaching details."));setLoading(false);
      }});
    return ()=>controller.abort();
  },[accessToken,locale,yearId,assignmentId,tab,status,offset,version]);
  const number=(n:number)=>new Intl.NumberFormat(locale).format(n);
  return <section className="learning-teaching-detail-body">
    <div className="learning-teaching-detail-switch" role="tablist" aria-label={t("Teaching detail sections")}>
      <button type="button" role="tab" aria-selected={tab==="units"}
        onClick={()=>{setTab("units");setOffset(0);}}>{t("Curriculum chapters")}</button>
      <button type="button" role="tab" aria-selected={tab==="lessons"}
        onClick={()=>{setTab("lessons");setOffset(0);}}>{t("Lesson plans")}</button>
    </div>
    <div className="learning-teaching-detail-controls">
      <label>{t("Progress status")}
        <select value={status} onChange={e=>{
          if(tab==="units")setUnitStatus(e.target.value as UnitStatus);
          else setLessonStatus(e.target.value as LessonStatus);
          setOffset(0);
        }}>
          {(tab==="units"?chapters:lessons).map(st=><option key={st} value={st}>
            {t((tab==="units"?"Unit status: ":"Lesson status: ")+st)}</option>)}
        </select></label>
      <button className="admin-secondary" type="button" onClick={()=>setVersion(v=>v+1)}>{t("Refresh")}</button>
    </div>
    {loading?<p role="status">{t("Loading teaching details…")}</p>:null}
    {error?<div role="alert" className="admin-error">{error}
      <button type="button" className="admin-secondary" onClick={()=>setVersion(v=>v+1)}>{t("Retry")}</button>
    </div>:null}
    {!loading&&!error&&items?<>
      {items.rows.length===0?<p className="admin-copy">{t("No chapters or lesson plans match this status.")}</p>:
      <div className="learning-teaching-detail-list">
        {tab==="units"?(items as DetailPage<Chapter>).rows.map(entry=><div key={entry.id}>
          <div><strong>{number(entry.sortOrder)}. {entry.title}</strong>
            {entry.updatedAt?<small>{t("Last status update")}: {formatAdminHijriDate(locale,entry.updatedAt)}</small>:null}
          </div><span>{t("Unit status: "+entry.status)}</span>
        </div>):(items as DetailPage<Lesson>).rows.map(entry=><div key={entry.id}>
          <div><strong>{entry.topic}</strong><small>{formatAdminHijriDate(locale,entry.lessonDate)}
            {entry.chapterTitle?" · "+entry.chapterTitle:""}</small></div>
          <span>{t("Lesson status: "+entry.status)}</span>
        </div>)}
      </div>}
      <nav className="learning-results-pagination" aria-label={t("Teaching detail pages")}>
        <button type="button" className="admin-secondary" disabled={offset===0}
          onClick={()=>setOffset(v=>Math.max(0,v-PAGE_SIZE))}>{t("Previous")}</button>
        <span>{adminFormat(locale,"Page {current} of {total}",{
          current:number(Math.floor(offset/PAGE_SIZE)+1),
          total:number(Math.max(1,Math.ceil(items.total/PAGE_SIZE)))
        })}</span>
        <button type="button" className="admin-secondary" disabled={offset+PAGE_SIZE>=items.total}
          onClick={()=>setOffset(v=>v+PAGE_SIZE)}>{t("Next")}</button>
      </nav>
    </>:null}
  </section>;
}
