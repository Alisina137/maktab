"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminHijriDatePicker, formatAdminHijriDate } from "./admin-hijri-date-picker";
import { useAdminWorkspace } from "./admin-workspace";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";

export type ExamStatus = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "RESULTS_READY" | "PUBLISHED" | "ARCHIVED";
export type Exam = {
  id: string; academicYearId: string; name: string; type: string;
  status: ExamStatus; publishedAt: string | null;
};
export type ExamSubject = {
  id: string; examId: string; subjectId: string; classId: string;
  maxScore: number; examDate: string | null;
};
export type ExamDetail = {
  exam: Exam;
  subjects: Array<{
    examSubject: ExamSubject;
    className: string; classCode: string; subjectName: string;
  }>;
  sameDayWarnings: Array<{
    classId: string; className: string; examDate: string; subjectNames: string[];
  }>;
};
export type AcademicContext = {
  classes: Array<{ id: string; name: string; code: string; academicYearId: string }>;
  subjects: Array<{ id: string; name: string; code: string }>;
  assignments: Array<{
    id: string; academicYearId: string; classId: string; subjectId: string; teacherUserId: string;
  }>;
};

type DetailTab = "OVERVIEW" | "SCHEDULE" | "SUBJECTS" | "LIFECYCLE";
const detailTabs: Array<{ id: DetailTab; title: string }> = [
  { id: "OVERVIEW", title: "Overview" },
  { id: "SCHEDULE", title: "Exam schedule" },
  { id: "SUBJECTS", title: "Exam subjects" },
  { id: "LIFECYCLE", title: "Exam lifecycle" }
];
const statuses: ExamStatus[] = ["DRAFT","SCHEDULED","IN_PROGRESS","RESULTS_READY","PUBLISHED","ARCHIVED"];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}) }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
}

export function AdminLearningExams({
  accessToken, locale, yearId, yearActive, exams, examSubjects, academics, initialExamId
}: {
  accessToken: string; locale: AdminLocale; yearId: string; yearActive: boolean;
  exams: Exam[]; examSubjects: Array<{examSubject: ExamSubject; className: string; classCode: string; subjectName: string}>;
  academics: AcademicContext; initialExamId?: string;
}) {
  const router = useRouter();
  const { selectedAcademicYear, setSelectedAcademicYearId } = useAdminWorkspace();
  const t = (value: string) => adminText(locale, value);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExamStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("OVERVIEW");
  const tabRefs = useRef<Partial<Record<DetailTab, HTMLButtonElement | null>>>({});
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(initialExamId));
  const [detailError, setDetailError] = useState("");
  const [detailRevision, setDetailRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [dateEditId, setDateEditId] = useState("");
  const [revisedDate, setRevisedDate] = useState("");
  const activeToken = useRef(accessToken);
  activeToken.current = accessToken;

  useEffect(() => {
    if (!initialExamId) return;
    const controller = new AbortController();
    const token = accessToken;
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    void request<ExamDetail>(token,
      `/v1/admin/exams/${encodeURIComponent(initialExamId)}/detail`,
      { signal: controller.signal }).then(result => {
        if (controller.signal.aborted || activeToken.current !== token) return;
        setDetail(result);
        setDetailLoading(false);
        if (result.exam.academicYearId !== yearId) {
          setSelectedAcademicYearId(result.exam.academicYearId);
        }
      }).catch(cause => {
        if (controller.signal.aborted || activeToken.current !== token) return;
        setDetailError(adminErrorText(locale, cause, "Could not load examination details."));
        setDetailLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, initialExamId, detailRevision, locale]);

  useEffect(() => {
    tabRefs.current[detailTab]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [detailTab]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, yearId]);

  const filtered = useMemo(() => exams.filter(exam =>
    (statusFilter === "ALL" || exam.status === statusFilter) &&
    (exam.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) ||
      exam.type.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  ), [exams, search, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * 10, Math.min(page, pageCount) * 10);
  const selected = detail?.exam;
  const validYear = !!selected && selected.academicYearId === yearId;
  const canConfigure = !!selected && yearActive && ["DRAFT", "SCHEDULED"].includes(selected.status);
  const yearSubjects = detail?.subjects ?? [];
  const availableClasses = academics.classes.filter(item => item.academicYearId === yearId);
  const availableSubjects = academics.assignments.filter(item => item.academicYearId === yearId && item.classId === classId)
    .map(item => academics.subjects.find(subject => subject.id === item.subjectId))
    .filter((item): item is AcademicContext["subjects"][number] => Boolean(item))
    .filter(item => !yearSubjects.some(row => row.examSubject.classId === classId && row.examSubject.subjectId === item.id));
  const uniqueSubjects = Array.from(new Map(availableSubjects.map(item => [item.id, item])).values());
  const sortedDates = yearSubjects.map(row => row.examSubject.examDate).filter((date): date is string => !!date).sort();

  async function createExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request<{ exam: Exam }>(accessToken, "/v1/admin/exams", {
        method: "POST",
        body: JSON.stringify({ academicYearId: yearId,
          name: String(values.get("name") ?? "").trim(),
          type: String(values.get("type") ?? "").trim() })
      });
      if (activeToken.current !== accessToken) return;
      router.push(`/admin/learning/exams/${result.exam.id}`);
    } catch (cause) {
      if (activeToken.current === accessToken)
        setError(adminErrorText(locale, cause, "Could not create exam."));
    } finally { if (activeToken.current === accessToken) setBusy(false); }
  }

  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canConfigure || !selectedAcademicYear ||
      !examDate || examDate < selectedAcademicYear.startDate || examDate > selectedAcademicYear.endDate) {
      setError(t("Choose an exam date within the academic year.")); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await request(accessToken, "/v1/admin/exam-subjects", {
        method: "POST", body: JSON.stringify({
          examId: selected.id, classId, subjectId, examDate, maxScore: Number(maxScore)
        })
      });
      if (activeToken.current !== accessToken) return;
      setClassId(""); setSubjectId(""); setExamDate(""); setMaxScore("100");
      setNotice(t("Exam subject added."));
      setDetailRevision(value => value + 1);
    } catch (cause) {
      if (activeToken.current === accessToken)
        setError(adminErrorText(locale, cause, "Could not add exam subject."));
    } finally { if (activeToken.current === accessToken) setBusy(false); }
  }

  async function updateDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canConfigure || !dateEditId || !revisedDate || !selectedAcademicYear ||
      revisedDate < selectedAcademicYear.startDate || revisedDate > selectedAcademicYear.endDate) {
      setError(t("Choose an exam date within the academic year.")); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await request(accessToken, `/v1/admin/exam-subjects/${dateEditId}/date`, {
        method: "PATCH", body: JSON.stringify({ examDate: revisedDate })
      });
      if (activeToken.current !== accessToken) return;
      setNotice(t("Exam date updated and recorded in the audit history."));
      setDateEditId(""); setRevisedDate("");
      setDetailRevision(value => value + 1);
    } catch (cause) {
      if (activeToken.current === accessToken)
        setError(adminErrorText(locale, cause, "Could not update the exam date."));
    } finally { if (activeToken.current === accessToken) setBusy(false); }
  }

  async function changeStatus(exam: Exam) {
    const next: Partial<Record<ExamStatus, ExamStatus>> = {
      DRAFT: "SCHEDULED", SCHEDULED: "IN_PROGRESS",
      IN_PROGRESS: "RESULTS_READY", PUBLISHED: "ARCHIVED"
    };
    const status = next[exam.status];
    if ((exam.status === "RESULTS_READY" || status === "ARCHIVED") &&
      !window.confirm(t(exam.status === "RESULTS_READY"
        ? "Publish examination results to families? This action cannot be undone."
        : "Archive this examination? It will become read-only."))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (exam.status === "RESULTS_READY") {
        const result = await request<{notificationCount:number}>(
          accessToken, `/v1/admin/exams/${exam.id}/publish`, { method: "POST" });
        if (activeToken.current !== accessToken) return;
        setNotice(adminFormat(locale, "Results published. {count} in-app notification(s) queued.",
          { count: result.notificationCount }));
      } else if (status) {
        await request(accessToken, `/v1/admin/exams/${exam.id}/status`, {
          method: "POST", body: JSON.stringify({ status })
        });
        if (activeToken.current !== accessToken) return;
        setNotice(adminFormat(locale, "Exam moved to {status}.", { status: t(status) }));
      }
      setDetailRevision(value => value + 1);
    } catch (cause) {
      if (activeToken.current === accessToken)
        setError(adminErrorText(locale, cause, "Exam action failed."));
    } finally { if (activeToken.current === accessToken) setBusy(false); }
  }

  if (!initialExamId) {
    return (
      <div className="learning-exam-workspace">
        <div className="learning-exam-heading">
          <div><h3>{t("Exam directory")}</h3>
            <p>{t("Find examinations in the selected academic year and open their details.")}</p></div>
          {yearActive ? <button type="button" className="admin-primary"
            onClick={() => setCreateOpen(value => !value)}>
            {t(createOpen ? "Close exam creation" : "Create exam")}
          </button> : null}
        </div>
        {createOpen && yearActive ? (
          <article className="admin-panel learning-exam-create">
            <div><h3>{t("Create exam")}</h3>
              <p>{t("Exam cycles begin as drafts. Set a separate exam date for each assigned class and subject.")}</p></div>
            <form className="admin-form" onSubmit={createExam}>
              <label>{t("Exam name")}<input name="name" required maxLength={120} placeholder={t("Midyear exam")} /></label>
              <label>{t("Exam type")}<input name="type" required maxLength={80} placeholder="MIDYEAR" /></label>
              <button className="admin-primary" disabled={busy}>{t("Create draft exam")}</button>
            </form>
          </article>
        ) : null}
        {error ? <p className="admin-error" role="alert">{error}</p> : null}
        {!yearId ? <div className="admin-panel learning-empty">{t("Select an academic year")}</div> : (
          <>
            <div className="learning-exam-filters">
              <label>{t("Search examinations")}
                <input type="search" value={search} onChange={event => setSearch(event.target.value)}
                  placeholder={t("Search by name or type")} /></label>
              <label>{t("Exam status")}
                <select value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value as ExamStatus | "ALL")}>
                  <option value="ALL">{t("All statuses")}</option>
                  {statuses.map(item => <option key={item} value={item}>{t(item)}</option>)}
                </select>
              </label>
            </div>
            <div className="learning-exam-directory" aria-live="polite">
              {visible.map(exam => {
                const configured = examSubjects.filter(row => row.examSubject.examId === exam.id);
                const classes = new Set(configured.map(row => row.examSubject.classId));
                const dates = configured.map(row => row.examSubject.examDate)
                  .filter((date): date is string => !!date).sort();
                return (
                  <Link href={`/admin/learning/exams/${exam.id}`} className="learning-exam-card" key={exam.id}>
                    <div className="learning-exam-card-head">
                      <strong>{exam.name}</strong>
                      <span className="learning-exam-pill" data-status={exam.status}>{t(exam.status)}</span>
                    </div>
                    <span className="learning-exam-type">{exam.type}</span>
                    <div className="learning-exam-card-stats">
                      <span>{t("Classes")}: <b>{classes.size}</b></span>
                      <span>{t("Exam subjects")}: <b>{configured.length}</b></span>
                    </div>
                    <small>{dates.length
                      ? `${formatAdminHijriDate(locale, dates[0]!)}${dates.length > 1 ? " — " + formatAdminHijriDate(locale, dates.at(-1)!) : ""}`
                      : t("No exam dates configured")}</small>
                    <span className="learning-exam-open">{t("Open examination")} →</span>
                  </Link>
                );
              })}
              {!visible.length ? (
                <div className="admin-panel learning-empty">{t("No examinations match your filters.")}</div>
              ) : null}
            </div>
            {pageCount > 1 ? (
              <div className="learning-exam-pagination">
                <button type="button" className="admin-secondary"
                  disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>{t("Previous")}</button>
                <span>{adminFormat(locale, "Page {current} of {total}", {
                  current: Math.min(page, pageCount), total: pageCount
                })}</span>
                <button type="button" className="admin-secondary"
                  disabled={page >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>{t("Next")}</button>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="learning-exam-workspace">
      <Link href="/admin/learning" className="learning-exam-back">{t("Back to examinations")} ←</Link>
      {detailLoading ? <div role="status" className="admin-panel learning-empty">{t("Loading examination details…")}</div> :
        detailError ? <div className="admin-panel learning-empty">
          <p role="alert" className="admin-error">{detailError}</p>
          <button type="button" className="admin-secondary" onClick={() => setDetailRevision(value => value + 1)}>{t("Retry")}</button>
        </div> : !detail || !validYear ? (
          <div className="admin-panel learning-empty">{t("Select the examination academic year above.")}</div>
        ) : (
          <>
            <header className="learning-exam-heading">
              <div><span className="eyebrow">{t("Examination details")}</span>
                <h3>{selected!.name}</h3><p>{selected!.type}</p></div>
              <span className="learning-exam-pill" data-status={selected!.status}>{t(selected!.status)}</span>
            </header>
            {error ? <p className="admin-error" role="alert">{error}</p> : null}
            {notice ? <p className="admin-success" role="status">{notice}</p> : null}
            <nav className="learning-exam-detail-tabs" role="tablist" aria-label={t("Examination detail sections")}
              dir={locale === "en" ? "ltr" : "rtl"}>
              {detailTabs.map(({ id, title }, index) => (
                <button type="button" key={id} role="tab" id={`exam-detail-tab-${id.toLowerCase()}`}
                  ref={element => { tabRefs.current[id] = element; }}
                  aria-selected={detailTab === id} aria-controls={`exam-detail-panel-${id.toLowerCase()}`}
                  tabIndex={detailTab === id ? 0 : -1}
                  className={detailTab === id ? "is-active" : ""}
                  onClick={() => setDetailTab(id)}
                  onKeyDown={event => {
                    const forward = locale === "en" ? "ArrowRight" : "ArrowLeft";
                    const backward = locale === "en" ? "ArrowLeft" : "ArrowRight";
                    let next = -1;
                    if (event.key === "Home") next = 0;
                    if (event.key === "End") next = detailTabs.length - 1;
                    if (event.key === forward) next = (index + 1) % detailTabs.length;
                    if (event.key === backward) next = (index - 1 + detailTabs.length) % detailTabs.length;
                    if (next !== -1) {
                      event.preventDefault();
                      const destination = detailTabs[next]!.id;
                      setDetailTab(destination);
                      tabRefs.current[destination]?.focus();
                    }
                  }}>{t(title)}</button>
              ))}
            </nav>
            {detailTab === "OVERVIEW" ? (
              <section role="tabpanel" id="exam-detail-panel-overview" aria-labelledby="exam-detail-tab-overview"
                className="learning-exam-details-panel">
                <div className="learning-exam-stats">
                  <div><span>{t("Exam subjects")}</span><strong>{yearSubjects.length}</strong></div>
                  <div><span>{t("Classes")}</span><strong>{new Set(yearSubjects.map(item => item.examSubject.classId)).size}</strong></div>
                  <div><span>{t("Dates configured")}</span>
                    <strong>{yearSubjects.filter(item => !!item.examSubject.examDate).length}/{yearSubjects.length}</strong></div>
                </div>
                <article className="admin-panel learning-exam-info">
                  <h4>{t("Examination summary")}</h4>
                  <p>{t("Exam status")}: <strong>{t(selected!.status)}</strong></p>
                  <p>{t("Exam type")}: <strong>{selected!.type}</strong></p>
                  <p>{t("First exam date")}: {sortedDates.length ? formatAdminHijriDate(locale, sortedDates[0]!) : "—"}</p>
                  <p>{t("Last exam date")}: {sortedDates.length ? formatAdminHijriDate(locale, sortedDates.at(-1)!) : "—"}</p>
                </article>
                {detail.sameDayWarnings.length > 0 ? (
                  <article className="admin-panel learning-exam-warning">
                    <h4>{t("Same-day examination advisory")}</h4>
                    <p>{t("Two or more subjects are scheduled on the same day for a class. No start times are stored, so this is not a verified time conflict.")}</p>
                    {detail.sameDayWarnings.map(item =>
                      <p key={item.classId + item.examDate}>{item.className} · {formatAdminHijriDate(locale, item.examDate)} · {item.subjectNames.join(" / ")}</p>)}
                    <button type="button" className="admin-secondary" onClick={() => setDetailTab("SCHEDULE")}>{t("Review schedule")}</button>
                  </article>
                ) : null}
              </section>
            ) : null}
            {detailTab === "SCHEDULE" ? (
              <section role="tabpanel" id="exam-detail-panel-schedule" aria-labelledby="exam-detail-tab-schedule"
                className="learning-exam-details-panel">
                <div className="learning-panel-heading"><h3>{t("Exam schedule")}</h3>
                  <p>{t("Schedule stores calendar dates per class and subject; times, rooms and invigilators are not yet recorded.")}</p></div>
                <div className="learning-exam-rows">
                  {yearSubjects.map(row => (
                    <div className="learning-exam-subject-row" key={row.examSubject.id}>
                      <div><strong>{row.className} · {row.subjectName}</strong>
                        <small>{t("Maximum score")}: {row.examSubject.maxScore}</small></div>
                      <span>{row.examSubject.examDate ? formatAdminHijriDate(locale, row.examSubject.examDate) : t("Unscheduled")}</span>
                    </div>
                  ))}
                  {!yearSubjects.length ? <div className="admin-panel learning-empty">{t("No exam subjects configured yet.")}</div> : null}
                </div>
                {detail.sameDayWarnings.length ? (
                  <div className="admin-panel learning-exam-warning">
                    <strong>{t("Same-day examination advisory")}</strong>
                    {detail.sameDayWarnings.map(item =>
                      <p key={item.classId + item.examDate}>{item.className} · {formatAdminHijriDate(locale, item.examDate)}: {item.subjectNames.join(" / ")}</p>)}
                  </div>
                ) : null}
                {canConfigure ? (
                  <article className="admin-panel learning-exam-editor">
                    <h3>{t("Update exam date")}</h3>
                    <form className="admin-form" onSubmit={updateDate}>
                      <label>{t("Exam subject")}<select required value={dateEditId}
                        onChange={event => {
                          const id = event.target.value;
                          setDateEditId(id);
                          setRevisedDate(yearSubjects.find(item => item.examSubject.id === id)?.examSubject.examDate ?? "");
                        }}>
                        <option value="">{t("Select exam subject")}</option>
                        {yearSubjects.map(row => <option key={row.examSubject.id} value={row.examSubject.id}>
                          {row.className} · {row.subjectName}</option>)}
                      </select></label>
                      <label>{t("Exam date")}<AdminHijriDatePicker locale={locale} value={revisedDate}
                        onChange={setRevisedDate} required disabled={busy} /></label>
                      <button type="submit" className="admin-primary" disabled={busy || !dateEditId || !revisedDate}>
                        {t("Save exam date")}</button>
                    </form>
                  </article>
                ) : null}
              </section>
            ) : null}
            {detailTab === "SUBJECTS" ? (
              <section role="tabpanel" id="exam-detail-panel-subjects" aria-labelledby="exam-detail-tab-subjects"
                className="learning-exam-details-panel">
                <div className="learning-panel-heading"><h3>{t("Exam subjects")}</h3>
                  <p>{t("Class subjects must have an active teacher assignment in the same academic year.")}</p></div>
                <div className="learning-exam-rows">
                  {yearSubjects.map(row => (
                    <div className="learning-exam-subject-row" key={row.examSubject.id}>
                      <div><strong>{row.className} · {row.subjectName}</strong>
                        <small>{row.classCode}</small></div>
                      <div><strong>{t("Maximum score")}: {row.examSubject.maxScore}</strong>
                        <small>{row.examSubject.examDate ? formatAdminHijriDate(locale, row.examSubject.examDate) : t("Unscheduled")}</small></div>
                    </div>
                  ))}
                  {!yearSubjects.length ? <div className="admin-panel learning-empty">{t("No exam subjects configured yet.")}</div> : null}
                </div>
                {canConfigure ? (
                  <article className="admin-panel learning-exam-editor">
                    <h3>{t("Add exam subject")}</h3>
                    <form className="admin-form" onSubmit={addSubject}>
                      <label>{t("Class")}<select required value={classId}
                        onChange={event => {setClassId(event.target.value); setSubjectId("");}}>
                        <option value="">{t("Select class")}</option>
                        {availableClasses.map(item => <option value={item.id} key={item.id}>
                          {item.name} · {item.code}</option>)}
                      </select></label>
                      <label>{t("Subject")}<select required value={subjectId}
                        onChange={event => setSubjectId(event.target.value)}>
                        <option value="">{t("Select assigned subject")}</option>
                        {uniqueSubjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select></label>
                      <label>{t("Exam date")}<AdminHijriDatePicker locale={locale} value={examDate}
                        onChange={setExamDate} required disabled={busy} /></label>
                      <label>{t("Maximum score")}<input type="number" required min={1} max={10000} step={1}
                        value={maxScore} onChange={event => setMaxScore(event.target.value)} /></label>
                      <button type="submit" className="admin-primary" disabled={busy || !subjectId || !examDate || !classId}>
                        {t("Add subject")}</button>
                    </form>
                  </article>
                ) : null}
              </section>
            ) : null}
            {detailTab === "LIFECYCLE" ? (
              <section role="tabpanel" id="exam-detail-panel-lifecycle" aria-labelledby="exam-detail-tab-lifecycle"
                className="learning-exam-details-panel">
                <article className="admin-panel learning-exam-editor">
                  <h3>{t("Exam lifecycle")}</h3>
                  <p>{t("Draft → Scheduled → In progress → Results ready → Published → Archived")}</p>
                  <p>{t("Current status")}: <strong>{t(selected!.status)}</strong></p>
                  {yearSubjects.length === 0 ? <p className="admin-copy">{t("Configure at least one subject before scheduling.")}</p> : null}
                  {yearSubjects.some(row => !row.examSubject.examDate) ? (
                    <p className="admin-copy">{t("Every subject needs a date before scheduling.")}</p>
                  ) : null}
                  {yearActive && selected!.status !== "ARCHIVED" ? (
                    <div className="admin-actions">
                      <button type="button" className="admin-primary" disabled={busy ||
                        (selected!.status === "DRAFT" && (!yearSubjects.length ||
                          yearSubjects.some(row => !row.examSubject.examDate)))}
                        onClick={() => void changeStatus(selected!)}>
                        {t(selected!.status === "DRAFT" ? "Schedule" :
                          selected!.status === "SCHEDULED" ? "Start exam" :
                          selected!.status === "IN_PROGRESS" ? "Mark results ready" :
                          selected!.status === "RESULTS_READY" ? "Publish results" :
                          selected!.status === "PUBLISHED" ? "Archive" : "Archived")}
                      </button>
                    </div>
                  ) : null}
                  {selected!.status === "IN_PROGRESS" ? (
                    <p className="admin-copy">{t("Results readiness is validated by the server before changing status.")}</p>
                  ) : null}
                </article>
              </section>
            ) : null}
          </>
        )}
    </div>
  );
}
