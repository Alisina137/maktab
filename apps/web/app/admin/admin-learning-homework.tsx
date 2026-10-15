"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import { formatAdminHijriDate } from "./admin-hijri-date-picker";
import type { AcademicContext } from "./admin-learning-exams";

type Status = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
type Attention = "ALL" | "PAST_DUE" | "AWAITING_REVIEW" | "MISSING" | "REVISION_REQUESTED";
type ReviewFilter = "ALL" | "MISSING" | "SUBMITTED" | "REVIEWED" | "REVISION_REQUESTED";
type HomeworkRow = {
  homework: {
    id: string; title: string; status: Status; dueAt: string; scheduledAt: string | null;
    publishedAt: string | null; createdAt: string; updatedAt: string;
  };
  classId: string; className: string; subjectId: string; subjectName: string;
  teacherUserId: string; teacherName: string;
  expected: number; submitted: number; awaitingReview: number;
  reviewed: number; revisionRequested: number; missing: number;
  pastDueWithMissing: boolean;
};
type HomeworkPage = { rows: HomeworkRow[]; total: number; limit: number; offset: number };
type RosterItem = { student: { id: string; fullName: string; studentCode: string };
  submission: { id: string; status: string; submittedAt: string;
    reviewedAt: string | null; feedback: string | null } | null };
type RosterPage = {
  homework: { id: string; title: string; status: Status };
  students: RosterItem[]; total: number; limit: number; offset: number;
  rosterBasis: "CURRENT_ACTIVE_ENROLLMENT";
};
type Filters = { search: string; status: Status | ""; attention: Attention; classId: string; subjectId: string };
const PAGE_SIZE = 20;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const baseFilters: Filters = { search: "", status: "", attention: "ALL", classId: "", subjectId: "" };
const statuses: Status[] = ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"];
const attentions: Attention[] = ["ALL", "PAST_DUE", "AWAITING_REVIEW", "MISSING", "REVISION_REQUESTED"];
const reviewFilters: ReviewFilter[] = ["ALL", "MISSING", "SUBMITTED", "REVIEWED", "REVISION_REQUESTED"];

async function get<T>(token: string, path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(API_URL + path, {
    signal, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
}

export function AdminLearningHomework({ accessToken, locale, yearId, academics, publishedCount, reviewCount }: {
  accessToken: string; locale: AdminLocale; yearId: string; academics: AcademicContext;
  publishedCount: number | null; reviewCount: number | null;
}) {
  const t = (value: string) => adminText(locale, value);
  const [draftSearch, setDraftSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(baseFilters);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState<HomeworkPage | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const requestKey = JSON.stringify([accessToken, locale, yearId, filters, offset, revision]);
  const classes = useMemo(() => academics.classes
    .filter(row => row.academicYearId === yearId)
    .sort((a, b) => a.name.localeCompare(b.name)), [academics.classes, yearId]);
  const subjects = useMemo(() => academics.subjects
    .slice().sort((a, b) => a.name.localeCompare(b.name)), [academics.subjects]);

  useEffect(() => {
    setPage(null); setLoadedKey(""); setFilters(baseFilters);
    setDraftSearch(""); setOffset(0); setExpandedId(null);
  }, [accessToken, yearId]);

  useEffect(() => {
    const controller = new AbortController();
    const id = ++sequence.current;
    setLoading(true); setError(""); setPage(null);
    if (!yearId) {
      setLoading(false);
      return () => controller.abort();
    }
    const params = new URLSearchParams({
      academicYearId: yearId, limit: String(PAGE_SIZE), offset: String(offset),
      attention: filters.attention
    });
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.classId) params.set("classId", filters.classId);
    if (filters.subjectId) params.set("subjectId", filters.subjectId);
    void get<HomeworkPage>(accessToken, "/v1/admin/learning/homework?" + params.toString(), controller.signal)
      .then(data => { if (!controller.signal.aborted && id === sequence.current) {
        setPage(data); setLoadedKey(requestKey); setLoading(false);
      } })
      .catch(cause => { if (!controller.signal.aborted && id === sequence.current) {
        setError(adminErrorText(locale, cause, "Could not load homework monitoring."));
        setLoading(false);
      } });
    return () => controller.abort();
  }, [accessToken, locale, yearId, filters, offset, revision]);

  function changeFilter(key: keyof Filters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
    setOffset(0); setExpandedId(null);
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    changeFilter("search", draftSearch.trim());
  }
  const refresh = () => setRevision(value => value + 1);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;
  const formatNumber = (count: number) => new Intl.NumberFormat(locale).format(count);
  return <div className="learning-homework-workspace">
    <header className="learning-panel-heading">
      <div><h3>{t("Homework monitoring")}</h3>
        <p>{t("Review homework coverage and teacher feedback across the selected academic year.")}</p></div>
      <button type="button" className="admin-secondary" onClick={refresh}>{t("Refresh")}</button>
    </header>
    <p className="admin-copy">{t("Homework creation, publication and submission reviews remain with assigned teachers.")}</p>
    <div className="learning-homework-metrics">
      <div><span>{t("Published homework")}</span><strong>{publishedCount == null ? "—" : formatNumber(publishedCount)}</strong></div>
      <div><span>{t("Submissions awaiting review")}</span><strong>{reviewCount == null ? "—" : formatNumber(reviewCount)}</strong></div>
    </div>
    {!yearId ? <div className="admin-panel learning-empty"><strong>{t("Select an academic year")}</strong>
      <p>{t("Select an academic year above to review learning activity.")}</p></div> : <>
      <form className="learning-homework-filters" onSubmit={search} role="search">
        <label>{t("Search homework titles")}
          <input value={draftSearch} onChange={event => setDraftSearch(event.target.value)}
            maxLength={100} placeholder={t("Homework title")} /></label>
        <label>{t("Homework status")}
          <select value={filters.status} onChange={event => changeFilter("status", event.target.value)}>
            <option value="">{t("All statuses")}</option>
            {statuses.map(status => <option key={status} value={status}>{t(status)}</option>)}
          </select>
        </label>
        <label>{t("Attention filter")}
          <select value={filters.attention} onChange={event => changeFilter("attention", event.target.value)}>
            {attentions.map(filter => <option key={filter} value={filter}>{t("Homework attention: " + filter)}</option>)}
          </select>
        </label>
        <label>{t("Class")}
          <select value={filters.classId} onChange={event => changeFilter("classId", event.target.value)}>
            <option value="">{t("All classes")}</option>
            {classes.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        <label>{t("Subject")}
          <select value={filters.subjectId} onChange={event => changeFilter("subjectId", event.target.value)}>
            <option value="">{t("All subjects")}</option>
            {subjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        <button type="submit" className="admin-primary">{t("Search")}</button>
        <button type="button" className="admin-secondary" onClick={() => {
          setDraftSearch(""); setFilters(baseFilters); setOffset(0); setExpandedId(null);
        }}>{t("Clear filters")}</button>
      </form>
      {loading ? <p role="status">{t("Loading homework data…")}</p> : null}
      {error ? <div className="admin-error" role="alert">{error}
        <button type="button" className="admin-secondary" onClick={refresh}>{t("Retry")}</button>
      </div> : null}
      {!loading && !error && page && loadedKey === requestKey ? <>
        <p className="admin-copy" role="status">{adminFormat(locale, "{count} homework record(s)", { count: formatNumber(page.total) })}</p>
        {page.rows.length === 0 ? <div className="learning-empty">
          <strong>{t("No matching homework records.")}</strong>
          <p>{t("Try changing the academic, status or attention filters.")}</p>
        </div> : <div className="learning-homework-list">
          {page.rows.map(row => <HomeworkCard key={row.homework.id} row={row}
            accessToken={accessToken} locale={locale}
            expanded={expandedId === row.homework.id}
            onToggle={() => setExpandedId(id => id === row.homework.id ? null : row.homework.id)} />)}
        </div>}
        <nav className="learning-results-pagination" aria-label={t("Homework pages")}>
          <button type="button" className="admin-secondary" disabled={offset === 0}
            onClick={() => { setOffset(value => Math.max(0, value - PAGE_SIZE)); setExpandedId(null); }}>
            {t("Previous")}</button>
          <span>{adminFormat(locale, "Page {page} of {total}", {
            page: formatNumber(currentPage), total: formatNumber(totalPages)
          })}</span>
          <button type="button" className="admin-secondary" disabled={offset + PAGE_SIZE >= page.total}
            onClick={() => { setOffset(value => value + PAGE_SIZE); setExpandedId(null); }}>
            {t("Next")}</button>
        </nav>
      </> : null}
    </>}
  </div>;
}

function HomeworkCard({ row, accessToken, locale, expanded, onToggle }: {
  row: HomeworkRow; accessToken: string; locale: AdminLocale;
  expanded: boolean; onToggle: () => void;
}) {
  const t = (value: string) => adminText(locale, value);
  const formatNumber = (count: number) => new Intl.NumberFormat(locale).format(count);
  const published = row.homework.status !== "DRAFT";
  return <article className="learning-homework-card">
    <div className="learning-homework-head">
      <div className="learning-homework-title"><strong>{row.homework.title}</strong>
        <small>{row.className} · {row.subjectName} · {row.teacherName}</small>
        <small>{t("Deadline")}: {formatAdminHijriDate(locale, row.homework.dueAt)}</small>
      </div>
      <span className="learning-exam-pill" data-status={row.homework.status}>{t(row.homework.status)}</span>
      {row.pastDueWithMissing ? <span className="learning-homework-warning">{t("Past due with missing submissions")}</span> : null}
    </div>
    {published ? <div className="learning-homework-counts">
      {([
        ["Current active roster", row.expected],
        ["Submitted", row.submitted],
        ["Awaiting teacher review", row.awaitingReview],
        ["Reviewed", row.reviewed],
        ["Revision requested", row.revisionRequested],
        ["No submission", row.missing]
      ] as const).map(([label, count]) => <div key={label}>
        <span>{t(label)}</span><strong>{formatNumber(count)}</strong>
      </div>)}
    </div> : <p className="admin-copy">{t("Draft homework is not yet visible to students.")}</p>}
    <button type="button" className="admin-secondary" aria-expanded={expanded}
      aria-controls={"learning-homework-detail-" + row.homework.id} onClick={onToggle}>
      {expanded ? t("Close details") : t("View submission progress")}
    </button>
    {expanded ? <div className="learning-homework-detail" id={"learning-homework-detail-" + row.homework.id}>
      <p className="admin-copy">{t("Counts use students currently active in this class and academic year; historical class membership is not reconstructed.")}</p>
      {published ? <HomeworkRoster key={row.homework.id} accessToken={accessToken}
        homeworkId={row.homework.id} locale={locale} /> : <p className="admin-copy">
        {t("Publish homework before monitoring student submissions.")}</p>}
    </div> : null}
  </article>;
}

function HomeworkRoster({ accessToken, homeworkId, locale }: {
  accessToken: string; homeworkId: string; locale: AdminLocale;
}) {
  const t = (value: string) => adminText(locale, value);
  const [filter, setFilter] = useState<ReviewFilter>("ALL");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState<RosterPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setPage(null); setError(""); setLoading(true);
    const params = new URLSearchParams({ filter, limit: String(PAGE_SIZE), offset: String(offset) });
    void get<RosterPage>(accessToken, "/v1/admin/learning/homework/" + homeworkId +
      "/roster?" + params.toString(), controller.signal).then(data => {
      if (!controller.signal.aborted) { setPage(data); setLoading(false); }
    }).catch(cause => { if (!controller.signal.aborted) {
      setError(adminErrorText(locale, cause, "Could not load student progress."));
      setLoading(false);
    } });
    return () => controller.abort();
  }, [accessToken, homeworkId, locale, filter, offset, revision]);
  return <section className="learning-homework-roster">
    <div className="learning-homework-roster-head">
      <h4>{t("Student submission progress")}</h4>
      <label>{t("Review status")}
        <select value={filter} onChange={event => { setFilter(event.target.value as ReviewFilter); setOffset(0); }}>
          {reviewFilters.map(value => <option key={value} value={value}>
            {t("Submission filter: " + value)}</option>)}
        </select>
      </label>
    </div>
    {loading ? <p role="status">{t("Loading student progress…")}</p> : null}
    {error ? <div role="alert" className="admin-error">{error}
      <button className="admin-secondary" type="button" onClick={() => setRevision(v => v + 1)}>{t("Retry")}</button>
    </div> : null}
    {page && !loading && !error ? <>
      {page.students.length === 0 ? <p className="admin-copy">{t("No students match this submission status.")}</p> :
        <div className="learning-homework-students">{page.students.map(entry =>
          <div key={entry.student.id} className="learning-homework-student">
            <div><strong>{entry.student.fullName}</strong><small>{entry.student.studentCode}</small></div>
            <div><strong>{t("Submission filter: " + (entry.submission?.status ?? "MISSING"))}</strong>
              {entry.submission?.submittedAt ? <small>{t("Submitted on")}: {formatAdminHijriDate(locale, entry.submission.submittedAt)}</small> : null}
              {entry.submission?.feedback ? <small>{t("Teacher feedback")}: {entry.submission.feedback}</small> : null}
            </div>
          </div>)}</div>}
      <nav className="learning-results-pagination" aria-label={t("Student progress pages")}>
        <button className="admin-secondary" type="button" disabled={offset === 0}
          onClick={() => setOffset(v => Math.max(0, v - PAGE_SIZE))}>{t("Previous")}</button>
        <span>{page.total === 0 ? "0" :
          (offset + 1) + "–" + Math.min(page.total, offset + PAGE_SIZE)} / {page.total}</span>
        <button className="admin-secondary" type="button" disabled={offset + PAGE_SIZE >= page.total}
          onClick={() => setOffset(v => v + PAGE_SIZE)}>{t("Next")}</button>
      </nav>
    </> : null}
  </section>;
}
