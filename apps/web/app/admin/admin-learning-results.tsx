"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import { formatAdminHijriDate } from "./admin-hijri-date-picker";
import type { AcademicContext, Exam, ExamSubject } from "./admin-learning-exams";

type ResultRow = {
  grade: { id: string; score: number; remark: string | null; updatedAt: string };
  academicYearId: string;
  examId: string;
  examName: string;
  examStatus: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  studentName: string;
  studentCode: string;
  maxScore: number;
  canCorrect: boolean;
};
type ResultPage = { rows: ResultRow[]; total: number; limit: number; offset: number };
type CorrectionEvent = {
  id: string; createdAt: string; actorUsername: string | null;
  previousScore: number | null; score: number | null;
  previousRemark: string | null; remark: string | null; reason: string;
};
type HistoryPage = { events: CorrectionEvent[]; total: number; limit: number; offset: number };
type Filters = { search: string; examId: string; classId: string; subjectId: string };
const PAGE_SIZE = 20;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_URL + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(init?.headers ?? {}) }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
}

export function AdminLearningResults({
  accessToken, locale, yearId, exams, examSubjects, academics
}: {
  accessToken: string; locale: AdminLocale; yearId: string; exams: Exam[];
  examSubjects: Array<{ examSubject: ExamSubject; className: string; classCode: string; subjectName: string }>;
  academics: AcademicContext;
}) {
  const t = (name: string) => adminText(locale, name);
  const [draftSearch, setDraftSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({ search: "", examId: "", classId: "", subjectId: "" });
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<ResultPage | null>(null);
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const loadSequence = useRef(0);
  const requestKey = JSON.stringify([accessToken, yearId, filters, offset, revision, locale]);
  const uniqueClasses = useMemo(() => academics.classes
    .filter(item => item.academicYearId === yearId)
    .sort((a, b) => a.name.localeCompare(b.name)), [academics.classes, yearId]);
  const uniqueSubjects = useMemo(() => {
    const subjectIds = new Set(examSubjects.map(x => x.examSubject.subjectId));
    return academics.subjects.filter(item => subjectIds.has(item.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [academics.subjects, examSubjects]);

  useEffect(() => {
    setFilters({ search: "", examId: "", classId: "", subjectId: "" });
    setDraftSearch("");
    setOffset(0);
    setExpandedId(null);
    setPage(null);
  }, [accessToken, yearId]);

  useEffect(() => {
    const controller = new AbortController();
    const seq = ++loadSequence.current;
    setStatus("loading");
    setError("");
    setPage(null); // avoid displaying grades for the wrong year/account or filter
    if (!yearId) {
      setStatus("ready");
      return () => { controller.abort(); };
    }
    const params = new URLSearchParams({
      academicYearId: yearId, limit: String(PAGE_SIZE), offset: String(offset)
    });
    if (filters.search) params.set("search", filters.search);
    if (filters.examId) params.set("examId", filters.examId);
    if (filters.classId) params.set("classId", filters.classId);
    if (filters.subjectId) params.set("subjectId", filters.subjectId);
    void request<ResultPage>(accessToken, "/v1/admin/learning/published-results?" + params.toString(),
      { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted && seq === loadSequence.current) {
        setPage(data); setLoadedRequestKey(requestKey); setStatus("ready");
      } })
      .catch(cause => { if (!controller.signal.aborted && seq === loadSequence.current) {
        setError(adminErrorText(locale, cause, "Could not load published results."));
        setStatus("error");
      } });
    return () => { controller.abort(); };
  }, [accessToken, yearId, filters, offset, revision, locale]);

  function changeFilter(key: keyof Filters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
    setOffset(0);
    setExpandedId(null);
    setNotice("");
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    changeFilter("search", draftSearch.trim());
  }
  const refresh = () => setRevision(value => value + 1);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;

  return (
    <div className="learning-results-workspace">
      <header className="learning-panel-heading">
        <div><h3>{t("Gradebook & results")}</h3>
          <p>{t("Search published marks, review corrections and preserve the audit history.")}</p></div>
        <button className="admin-secondary" type="button" onClick={refresh}>
          {t("Refresh")}
        </button>
      </header>
      <form className="learning-results-filters" onSubmit={search} role="search">
        <label>{t("Search students, codes or examinations")}
          <input value={draftSearch} onChange={event => setDraftSearch(event.target.value)}
            maxLength={100} placeholder={t("Student, code or exam")} />
        </label>
        <label>{t("Examination")}
          <select value={filters.examId} onChange={event => changeFilter("examId", event.target.value)}>
            <option value="">{t("All examinations")}</option>
            {exams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>{t("Class")}
          <select value={filters.classId} onChange={event => changeFilter("classId", event.target.value)}>
            <option value="">{t("All classes")}</option>
            {uniqueClasses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>{t("Subject")}
          <select value={filters.subjectId} onChange={event => changeFilter("subjectId", event.target.value)}>
            <option value="">{t("All subjects")}</option>
            {uniqueSubjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button type="submit" className="admin-primary">{t("Search")}</button>
        <button type="button" className="admin-secondary" onClick={() => {
          setDraftSearch(""); setFilters({ search: "", examId: "", classId: "", subjectId: "" });
          setOffset(0); setExpandedId(null);
        }}>{t("Clear filters")}</button>
      </form>
      {notice ? <p role="status" className="admin-success">{notice}</p> : null}
      {error ? <p role="alert" className="admin-error">{error}</p> : null}
      {status === "loading" ? <p role="status">{t("Loading published results…")}</p> : null}
      {status === "error" ? <button type="button" className="admin-secondary" onClick={refresh}>
        {t("Retry")}
      </button> : null}
      {status === "ready" && page && loadedRequestKey === requestKey ? <>
        <p className="admin-copy" role="status">{adminFormat(locale, "{count} published grade(s) found", {
          count: new Intl.NumberFormat(locale).format(page.total)
        })}</p>
        {page.rows.length === 0 ? <div className="learning-empty">
          <strong>{t("No matching published grades.")}</strong>
          <p>{t("Try a different examination, student or class filter.")}</p>
        </div> : (
          <div className="learning-results-list">
            {page.rows.map(row => <ResultCard key={row.grade.id} row={row}
              accessToken={accessToken} locale={locale}
              expanded={expandedId === row.grade.id} onToggle={() => setExpandedId(current =>
                current === row.grade.id ? null : row.grade.id)}
              onSaved={() => {
                setNotice(adminFormat(locale, "Published mark corrected for {name}. The reason and previous value are in the audit log.", { name: row.studentName }));
                refresh();
              }} />)}
          </div>
        )}
        <nav className="learning-results-pagination" aria-label={t("Results pages")}>
          <button className="admin-secondary" type="button" disabled={offset === 0}
            onClick={() => { setExpandedId(null); setOffset(value => Math.max(0, value - PAGE_SIZE)); }}>
            {t("Previous")}
          </button>
          <span>{adminFormat(locale, "Page {page} of {total}", {
            page: new Intl.NumberFormat(locale).format(currentPage),
            total: new Intl.NumberFormat(locale).format(pageCount)
          })}</span>
          <button className="admin-secondary" type="button" disabled={offset + PAGE_SIZE >= page.total}
            onClick={() => { setExpandedId(null); setOffset(value => value + PAGE_SIZE); }}>
            {t("Next")}
          </button>
        </nav>
      </> : null}
    </div>
  );
}

function ResultCard({ row, accessToken, locale, expanded, onToggle, onSaved }: {
  row: ResultRow; accessToken: string; locale: AdminLocale;
  expanded: boolean; onToggle: () => void; onSaved: () => void;
}) {
  const t = (name: string) => adminText(locale, name);
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(String(row.grade.score));
  const [remark, setRemark] = useState(row.grade.remark ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setScore(String(row.grade.score)); setRemark(row.grade.remark ?? "");
    setReason(""); setEditing(false); setError("");
  }, [row.grade.score, row.grade.remark, row.grade.updatedAt]);
  useEffect(() => { if (!expanded) { setEditing(false); setError(""); } }, [expanded]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = Number(score);
    if (!row.canCorrect || !Number.isSafeInteger(next) || next < 0 || next > row.maxScore ||
        reason.trim().length < 2 || reason.trim().length > 500) return;
    if (!window.confirm(t("Confirm this published grade correction? The change and reason will be audited."))) return;
    setBusy(true); setError("");
    try {
      await request(accessToken, "/v1/admin/grades/" + row.grade.id + "/correct", {
        method: "PATCH",
        body: JSON.stringify({ score: next, remark: remark.trim() || null,
          reason: reason.trim(), expectedUpdatedAt: row.grade.updatedAt })
      });
      setEditing(false); setReason(""); onSaved();
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not correct published grade."));
    } finally {
      setBusy(false);
    }
  }
  return <article className="learning-results-card">
    <div className="learning-results-card-header">
      <div className="learning-results-identity">
        <strong>{row.studentName}</strong>
        <small>{row.studentCode} · {row.examName}</small>
        <small>{row.className} · {row.subjectName}</small>
      </div>
      <div className="learning-results-score"><strong>{row.grade.score} / {row.maxScore}</strong>
        <small>{row.grade.remark ?? t("No remark")}</small></div>
      <button className="admin-secondary" type="button" aria-expanded={expanded}
        aria-controls={"result-detail-" + row.grade.id} onClick={onToggle}>
        {expanded ? t("Close details") : t("Review grade")}
      </button>
    </div>
    {expanded ? <div className="learning-results-detail" id={"result-detail-" + row.grade.id}>
      <div className="learning-results-actions">
        <span>{row.canCorrect ? t("Published · correction permitted") : t("Read-only published result")}</span>
        {row.canCorrect && !editing ? <button className="admin-secondary" type="button"
          onClick={() => setEditing(true)}>{t("Correct grade")}</button> : null}
      </div>
      {editing ? <form className="learning-results-edit" onSubmit={submit}>
        <label>{t("Score")}
          <input type="number" min="0" max={row.maxScore} step="1" required
            value={score} onChange={event => setScore(event.target.value)} disabled={busy} /></label>
        <label>{t("Remark")}
          <input maxLength={500} value={remark} onChange={event => setRemark(event.target.value)} disabled={busy} /></label>
        <label>{t("Correction reason")}
          <textarea maxLength={500} required minLength={2} value={reason}
            onChange={event => setReason(event.target.value)} disabled={busy} /></label>
        <div className="learning-results-actions">
          <button className="admin-primary" type="submit" disabled={busy || reason.trim().length < 2 ||
            !/^\d+$/.test(score.trim()) || Number(score) > row.maxScore ||
            (Number(score) === row.grade.score && remark.trim() === (row.grade.remark ?? ""))}>
            {busy ? t("Saving…") : t("Save correction")}
          </button>
          <button className="admin-secondary" type="button" disabled={busy}
            onClick={() => setEditing(false)}>{t("Cancel")}</button>
        </div>
      </form> : null}
      {error ? <p role="alert" className="admin-error">{error}</p> : null}
      <CorrectionHistory accessToken={accessToken} locale={locale} gradeId={row.grade.id} />
    </div> : null}
  </article>;
}

function CorrectionHistory({ accessToken, locale, gradeId }: {
  accessToken: string; locale: AdminLocale; gradeId: string;
}) {
  const t = (name: string) => adminText(locale, name);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setPage(null); setLoading(true); setError("");
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    void request<HistoryPage>(accessToken,
      "/v1/admin/grades/" + gradeId + "/corrections?" + params.toString(),
      { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setPage(data); setLoading(false); }
    }).catch(cause => {
      if (!controller.signal.aborted) {
        setError(adminErrorText(locale, cause, "Could not load correction history."));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [accessToken, gradeId, offset, locale]);
  return <section className="learning-results-history">
    <h4>{t("Correction history")}</h4>
    {loading ? <p role="status">{t("Loading correction history…")}</p> : null}
    {error ? <p role="alert" className="admin-error">{error}</p> : null}
    {page && page.events.length === 0 ? <p className="admin-copy">{t("No corrections recorded for this grade.")}</p> : null}
    {page?.events.map(event => <div key={event.id} className="learning-results-event">
      <strong>{event.previousScore ?? "—"} → {event.score ?? "—"}</strong>
      <span>{event.reason}</span>
      {event.previousRemark !== event.remark ?
        <small>{t("Remark")}: {event.previousRemark || "—"} → {event.remark || "—"}</small> : null}
      <small>{event.actorUsername ?? t("Former administrator")} · {formatAdminHijriDate(locale, event.createdAt)}</small>
    </div>)}
    {page && page.total > PAGE_SIZE ? <nav className="learning-results-pagination" aria-label={t("Correction history pages")}>
      <button className="admin-secondary" type="button" disabled={offset === 0}
        onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}>{t("Previous")}</button>
      <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, page.total)} / {page.total}</span>
      <button className="admin-secondary" type="button" disabled={offset + PAGE_SIZE >= page.total}
        onClick={() => setOffset(value => value + PAGE_SIZE)}>{t("Next")}</button>
    </nav> : null}
  </section>;
}
