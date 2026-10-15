"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLearningExams, type Exam, type ExamSubject, type AcademicContext } from "./admin-learning-exams";
import { AdminLoader, AdminSkeleton } from "./admin-loader";

import { useAdminWorkspace } from "./admin-workspace";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";

type PublishedGrade = {
  grade: {
    id: string;
    score: number;
    remark: string | null;
    updatedAt: string;
  };
  academicYearId: string;
  examName: string;
  subjectName: string;
  className: string;
  studentName: string;
  studentCode: string;
  maxScore: number;
};

type LearningOverview = {
  exams: Exam[];
  examSubjects: Array<{
    examSubject: ExamSubject;
    className: string;
    classCode: string;
    subjectName: string;
  }>;
  publishedGrades: PublishedGrade[];
};

type LearningTab = "OVERVIEW" | "HOMEWORK" | "EXAMS" | "RESULTS" | "TEACHING" | "REPORTS";
type LearningDashboard = {
  academicYearId: string;
  metrics: {
    activeExams: number;
    examsAwaitingPublication: number;
    publishedExams: number;
    publishedHomework: number;
    submissionsAwaitingReview: number;
    classesWithMissingMarks: number;
    continuousAssessments: number;
    curriculumCompletedUnits: number;
    curriculumAssignedUnits: number;
  };
  attention: Array<{
    id: string; category: "EXAMS" | "RESULTS" | "HOMEWORK";
    title: string; detail: string; count: number;
  }>;
};
const learningTabs: Array<{ id: LearningTab; title: string }> = [
  { id: "OVERVIEW", title: "Overview" },
  { id: "HOMEWORK", title: "Homework" },
  { id: "EXAMS", title: "Exams" },
  { id: "RESULTS", title: "Gradebook & results" },
  { id: "TEACHING", title: "Teaching progress" },
  { id: "REPORTS", title: "Reports & audit" }
];

type AcademicOverview = AcademicContext & {
  academicYears: Array<{ id: string; name: string; status: string }>;
  classes: Array<{ id: string; name: string; code: string; academicYearId: string }>;
  subjects: Array<{ id: string; name: string; code: string }>;
  assignments: Array<{ id: string; academicYearId: string; classId: string; subjectId: string; teacherUserId: string }>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
}

export function LearningPanel({ accessToken, initialExamId }: { accessToken: string; initialExamId?: string }) {
  const router = useRouter();
  const { locale, selectedAcademicYearId, selectedAcademicYear } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const [learning, setLearning] = useState<LearningOverview | null>(null);
  const [academics, setAcademics] = useState<AcademicOverview | null>(null);
  const [dashboard, setDashboard] = useState<LearningDashboard | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<LearningTab>(initialExamId ? "EXAMS" : "OVERVIEW");
  const tabRefs = useRef<Partial<Record<LearningTab, HTMLButtonElement | null>>>({});
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const currentToken = useRef(accessToken);
  currentToken.current = accessToken;
  const { error, notice, setError, setNotice } = useTransientAdminFeedback();


  useEffect(() => {
    // Also refresh when the selected academic year changes; never reuse a
    // previous user's or previous year's overview after an account switch.
    setLearning(null);
    setAcademics(null);
    setDashboard(null);
    void load();
    return () => {
      generation.current += 1;
      pending.current?.abort();
    };
  }, [accessToken, selectedAcademicYearId]);

  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({
      block: "nearest", inline: "nearest", behavior: "smooth"
    });
  }, [activeTab]);

  async function load() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const id = ++generation.current;
    const token = accessToken;
    setLoadingStatus("loading");
    setError("");
    try {
      const [learningData, academicData, dashboardData] = await Promise.all([
        request<LearningOverview>(token, "/v1/admin/learning", { signal: controller.signal }),
        request<AcademicOverview>(token, "/v1/admin/academics", { signal: controller.signal }),
        selectedAcademicYearId ? request<LearningDashboard>(
          token, `/v1/admin/learning/dashboard?academicYearId=${encodeURIComponent(selectedAcademicYearId)}`,
          { signal: controller.signal }
        ) : Promise.resolve(null)
      ]);
      if (controller.signal.aborted || generation.current !== id || currentToken.current !== token) return;
      setLearning(learningData);
      setAcademics(academicData);
      setDashboard(dashboardData);
      setLoadingStatus("ready");
    } catch (cause) {
      if (controller.signal.aborted || generation.current !== id || currentToken.current !== token) return;
      setLoadingStatus("error");
      setError(adminErrorText(locale, cause, "Could not load learning data."));
    }
  }

  const yearExams =
    learning?.exams.filter((exam) => exam.academicYearId === selectedAcademicYearId) ?? [];
  const yearExamIds = new Set(yearExams.map((exam) => exam.id));
  const yearExamSubjects =
    learning?.examSubjects.filter((item) => yearExamIds.has(item.examSubject.examId)) ?? [];
  const yearPublishedGrades =
    learning?.publishedGrades.filter((item) => item.academicYearId === selectedAcademicYearId) ?? [];
  const historicalReadOnly = selectedAcademicYear?.status !== "ACTIVE";
  if (!learning || !academics || loadingStatus === "error") {
    return (
      <section className="admin-panel learning-section admin-loading-card">
        {loadingStatus === "error" ? (
          <>
            <h2>{t("Learning data unavailable")}</h2>
            <p className="admin-error" role="alert">{error || t("Could not load learning data.")}</p>
            <button type="button" className="admin-secondary" onClick={() => void load()}>{t("Retry")}</button>
          </>
        ) : (
          <>
            <AdminLoader label={t("Loading learning data…")} />
            <AdminSkeleton rows={5} />
          </>
        )}
      </section>
    );
  }

  const formatCount = (value: number) => new Intl.NumberFormat(locale).format(value);

  return (
    <section className="learning-section admin-page-enter">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Academic management")}</span>
          <h2>{t("Learning management")}</h2>
          <p>{t("Review academic activity, manage examinations, and monitor results across the selected academic year.")}</p>
        </div>
        <button type="button" className="admin-secondary" onClick={() => void load()} disabled={loadingStatus === "loading"}>{t("Refresh")}</button>
      </div>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      <nav className="learning-main-tabs" role="tablist" aria-label={t("Learning sections")}
        dir={locale === "en" ? "ltr" : "rtl"}>
        {learningTabs.map(({ id, title }, index) => (
          <button key={id} id={`learning-tab-${id.toLowerCase()}`}
            type="button" role="tab" aria-selected={activeTab === id}
            aria-controls={`learning-panel-${id.toLowerCase()}`}
            tabIndex={activeTab === id ? 0 : -1}
            ref={element => { tabRefs.current[id] = element; }}
            className={activeTab === id ? "is-active" : ""}
            onClick={() => setActiveTab(id)}
            onKeyDown={event => {
              const forward = locale === "en" ? "ArrowRight" : "ArrowLeft";
              const backward = locale === "en" ? "ArrowLeft" : "ArrowRight";
              let next = -1;
              if (event.key === "Home") next = 0;
              if (event.key === "End") next = learningTabs.length - 1;
              if (event.key === forward) next = (index + 1) % learningTabs.length;
              if (event.key === backward) next = (index - 1 + learningTabs.length) % learningTabs.length;
              if (next !== -1) {
                event.preventDefault();
                const destination = learningTabs[next]!.id;
                setActiveTab(destination);
                tabRefs.current[destination]?.focus();
              }
            }}>{t(title)}</button>
        ))}
      </nav>

      {activeTab === "OVERVIEW" ? (
        <section id="learning-panel-overview" role="tabpanel" aria-labelledby="learning-tab-overview"
          className="learning-tab-panel">
          {!selectedAcademicYearId ? (
            <div className="admin-panel learning-empty"><strong>{t("Select an academic year")}</strong>
              <p>{t("Select an academic year above to review learning activity.")}</p></div>
          ) : dashboard ? (
            <>
              <header className="learning-panel-heading">
                <div><h3>{t("Learning overview")}</h3>
                  <p>{t("Live school records for the selected academic year.")}</p></div>
              </header>
              <div className="learning-metric-grid">
                {([
                  ["Active examinations", dashboard.metrics.activeExams, "EXAMS"],
                  ["Awaiting publication", dashboard.metrics.examsAwaitingPublication, "RESULTS"],
                  ["Published examinations", dashboard.metrics.publishedExams, "RESULTS"],
                  ["Published homework", dashboard.metrics.publishedHomework, "HOMEWORK"],
                  ["Submissions awaiting review", dashboard.metrics.submissionsAwaitingReview, "HOMEWORK"],
                  ["Classes with missing marks", dashboard.metrics.classesWithMissingMarks, "EXAMS"],
                  ["Continuous assessments", dashboard.metrics.continuousAssessments, "RESULTS"]
                ] as const).map(([title, count, tab]) => (
                  <button type="button" className="learning-metric-card" key={title}
                    onClick={() => setActiveTab(tab)}>
                    <span>{t(title)}</span>
                    <strong>{formatCount(count)}</strong>
                    <small>{t("View section")} →</small>
                  </button>
                ))}
                <button type="button" className="learning-metric-card"
                  onClick={() => setActiveTab("TEACHING")}>
                  <span>{t("Assigned curriculum units completed")}</span>
                  <strong>{dashboard.metrics.curriculumAssignedUnits === 0 ? "—" :
                    `${formatCount(dashboard.metrics.curriculumCompletedUnits)}/${formatCount(dashboard.metrics.curriculumAssignedUnits)}`}</strong>
                  <small>{t("View section")} →</small>
                </button>
              </div>
              <article className="admin-panel learning-attention-card">
                <div className="learning-panel-heading"><h3>{t("Needs attention")}</h3>
                  <p>{t("Academic items that may require administrator follow-up.")}</p></div>
                {dashboard.attention.length ? (
                  <div className="learning-attention-list">
                    {dashboard.attention.map(item => (
                      <button type="button" key={`${item.category}:${item.id}`}
                        className="learning-attention-item"
                        onClick={() => {
                          if (item.category === "HOMEWORK") {
                            setActiveTab("HOMEWORK");
                          } else {
                            router.push(`/admin/learning/exams/${item.id}`);
                          }
                        }}>
                        <span className="learning-attention-info">
                          <strong>{item.title}</strong>
                          <small>{t(item.detail)}</small>
                        </span>
                        <span className="learning-attention-count">{formatCount(item.count)}</span>
                        <span className="learning-attention-action">{t("View section")} →</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="learning-empty">
                    <strong>{t("No current learning exceptions")}</strong>
                    <p>{t("No missing marks, pending result publications, or outstanding homework reviews were found in this academic year.")}</p>
                  </div>
                )}
              </article>
            </>
          ) : <div className="admin-panel learning-empty">{t("Learning dashboard unavailable.")}</div>}
        </section>
      ) : null}

      {activeTab === "HOMEWORK" ? (
        <section id="learning-panel-homework" role="tabpanel" aria-labelledby="learning-tab-homework"
          className="learning-tab-panel admin-panel learning-module-summary">
          <h3>{t("Homework monitoring")}</h3>
          <p>{t("Homework creation and submission review remain with assigned teachers.")}</p>
          <div className="learning-summary-inline">
            <div><span>{t("Published homework")}</span><strong>{dashboard ? formatCount(dashboard.metrics.publishedHomework) : "—"}</strong></div>
            <div><span>{t("Submissions awaiting review")}</span><strong>{dashboard ? formatCount(dashboard.metrics.submissionsAwaitingReview) : "—"}</strong></div>
          </div>
          <p className="admin-copy">{t("Schoolwide homework records and submission filters are not yet available in this view.")}</p>
        </section>
      ) : null}

      {activeTab === "TEACHING" ? (
        <section id="learning-panel-teaching" role="tabpanel" aria-labelledby="learning-tab-teaching"
          className="learning-tab-panel admin-panel learning-module-summary">
          <h3>{t("Teaching progress")}</h3>
          <p>{t("Curriculum definitions are managed in Academics. Teachers record chapter progress in their own workspace.")}</p>
          <div className="learning-summary-inline">
            <div><span>{t("Assigned curriculum units completed")}</span>
              <strong>{dashboard?.metrics.curriculumAssignedUnits
                ? `${formatCount(dashboard.metrics.curriculumCompletedUnits)}/${formatCount(dashboard.metrics.curriculumAssignedUnits)}`
                : "—"}</strong></div>
          </div>
          <Link className="admin-secondary learning-module-link" href="/admin/academics/curriculum">
            {t("Open curriculum management")}
          </Link>
        </section>
      ) : null}

      {activeTab === "REPORTS" ? (
        <section id="learning-panel-reports" role="tabpanel" aria-labelledby="learning-tab-reports"
          className="learning-tab-panel admin-panel learning-module-summary">
          <h3>{t("Academic reports & audit")}</h3>
          <p>{t("Detailed academic report exports and audit filters are not yet available in this workspace.")}</p>
          <div className="learning-summary-inline">
            <div><span>{t("Published examinations")}</span>
              <strong>{dashboard ? formatCount(dashboard.metrics.publishedExams) : "—"}</strong></div>
            <div><span>{t("Continuous assessments")}</span>
              <strong>{dashboard ? formatCount(dashboard.metrics.continuousAssessments) : "—"}</strong></div>
          </div>
        </section>
      ) : null}

      {activeTab === "EXAMS" ? (
        <section id="learning-panel-exams" role="tabpanel" aria-labelledby="learning-tab-exams"
          className="learning-tab-panel">
          <AdminLearningExams
            accessToken={accessToken}
            locale={locale}
            yearId={selectedAcademicYearId}
            yearActive={selectedAcademicYear?.status === "ACTIVE"}
            exams={yearExams}
            examSubjects={yearExamSubjects}
            academics={academics}
            initialExamId={initialExamId}
          />
        </section>
      ) : null}

      {activeTab === "RESULTS" ? (
        <section id="learning-panel-results" role="tabpanel" aria-labelledby="learning-tab-results"
          className="learning-tab-panel">
          <div className="learning-panel-heading">
            <div><h3>{t("Gradebook & results")}</h3>
              <p>{t("Published examination grades and audited corrections.")}</p>
            </div>
          </div>
      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div><h2>{t("Published result corrections")}</h2><p>{t("Published marks cannot be deleted. Corrections require a reason and create audit history.")}</p></div>
        </div>
        <div className="learning-grade-list">
          {yearPublishedGrades.map((item) => (
            <PublishedGradeRow
              key={item.grade.id}
              item={item}
              accessToken={accessToken}
              locale={locale}
              busy={busy}
              readOnly={historicalReadOnly}
              onBusy={setBusy}
              onError={setError}
              onNotice={setNotice}
              onReload={load}
            />
          ))}
          {yearPublishedGrades.length === 0 ? <p className="admin-copy">{t("No published grades in the selected academic year.")}</p> : null}
        </div>
      </article>
        </section>
      ) : null}
    </section>
  );
}

function PublishedGradeRow({
  item,
  accessToken,
  locale,
  busy,
  readOnly,
  onBusy,
  onError,
  onNotice,
  onReload
}: {
  item: PublishedGrade;
  accessToken: string;
  locale: AdminLocale;
  busy: boolean;
  readOnly: boolean;
  onBusy: (value: boolean) => void;
  onError: (value: string) => void;
  onNotice: (value: string) => void;
  onReload: () => Promise<void>;
}) {
  const t = (english: string) => adminText(locale, english);
  const [score, setScore] = useState(String(item.grade.score));
  const [remark, setRemark] = useState(item.grade.remark ?? "");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setScore(String(item.grade.score));
    setRemark(item.grade.remark ?? "");
  }, [item.grade.score, item.grade.remark]);

  async function save() {
    onBusy(true);
    onError("");
    onNotice("");
    try {
      await request(accessToken, `/v1/admin/grades/${item.grade.id}/correct`, {
        method: "PATCH",
        body: JSON.stringify({
          score: Number(score),
          remark: remark.trim() || undefined,
          reason: reason.trim(),
          expectedUpdatedAt: item.grade.updatedAt
        })
      });
      onNotice(adminFormat(locale, "Published mark corrected for {name}. The reason and previous value are in the audit log.", { name: item.studentName }));
      setReason("");
      await onReload();
    } catch (cause) {
      onError(adminErrorText(locale, cause, "Could not correct published grade."));
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="learning-grade-row">
      <div>
        <strong>{item.studentName}</strong>
        <span>{item.studentCode} · {item.examName} · {item.className} · {item.subjectName}</span>
      </div>
      <label>{t("Score")}<input type="number" min={0} max={item.maxScore} step={1} value={score} onChange={(event) => setScore(event.target.value)} disabled={readOnly} /></label>
      <label>{t("Remark")}<input value={remark} onChange={(event) => setRemark(event.target.value)} maxLength={500} disabled={readOnly} /></label>
      <label>{t("Correction reason")}<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required disabled={readOnly} /></label>
      <button className="admin-secondary" type="button" disabled={busy || readOnly || reason.trim().length < 2 || !/^\d+$/.test(score.trim()) || !Number.isSafeInteger(Number(score)) || Number(score) > item.maxScore} onClick={() => void save()}>
        {t("Save correction")}
      </button>
    </div>
  );
}
