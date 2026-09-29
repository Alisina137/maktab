"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdminWorkspace } from "./admin-workspace";
import { adminText } from "./admin-i18n";

type ExamStatus = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "RESULTS_READY" | "PUBLISHED" | "ARCHIVED";

type Exam = {
  id: string;
  academicYearId: string;
  name: string;
  type: string;
  status: ExamStatus;
  publishedAt: string | null;
};

type ExamSubject = {
  id: string;
  examId: string;
  subjectId: string;
  classId: string;
  maxScore: number;
};

type PublishedGrade = {
  grade: {
    id: string;
    score: number;
    remark: string | null;
  };
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

type AcademicOverview = {
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

export function LearningPanel({ accessToken }: { accessToken: string }) {
  const { locale } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const [learning, setLearning] = useState<LearningOverview | null>(null);
  const [academics, setAcademics] = useState<AcademicOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const { error, notice, setError, setNotice } = useTransientAdminFeedback();
  const [examId, setExamId] = useState("");
  const [examClassId, setExamClassId] = useState("");

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function load() {
    setError("");
    try {
      const [learningData, academicData] = await Promise.all([
        request<LearningOverview>(accessToken, "/v1/admin/learning"),
        request<AcademicOverview>(accessToken, "/v1/admin/academics")
      ]);
      setLearning(learningData);
      setAcademics(academicData);
      setExamId((current) => current || learningData.exams.find((exam) => exam.status === "DRAFT" || exam.status === "SCHEDULED")?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load exams and results.");
    }
  }

  async function createExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await request(accessToken, "/v1/admin/exams", {
        method: "POST",
        body: JSON.stringify({
          academicYearId: String(form.get("academicYearId") ?? ""),
          name: String(form.get("name") ?? "").trim(),
          type: String(form.get("type") ?? "").trim()
        })
      });
      setNotice("Exam cycle created in DRAFT state.");
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create exam.");
    } finally {
      setBusy(false);
    }
  }

  async function addExamSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await request(accessToken, "/v1/admin/exam-subjects", {
        method: "POST",
        body: JSON.stringify({
          examId: String(form.get("examId") ?? ""),
          classId: String(form.get("classId") ?? ""),
          subjectId: String(form.get("subjectId") ?? ""),
          maxScore: Number(form.get("maxScore"))
        })
      });
      setNotice("Exam subject added.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add exam subject.");
    } finally {
      setBusy(false);
    }
  }

  async function examAction(exam: Exam) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (exam.status === "RESULTS_READY") {
        const result = await request<{ notificationCount: number }>(
          accessToken,
          `/v1/admin/exams/${exam.id}/publish`,
          { method: "POST" }
        );
        setNotice(`Results published. ${result.notificationCount} in-app notification(s) queued.`);
      } else {
        const next: Partial<Record<ExamStatus, ExamStatus>> = {
          DRAFT: "SCHEDULED",
          SCHEDULED: "IN_PROGRESS",
          IN_PROGRESS: "RESULTS_READY",
          PUBLISHED: "ARCHIVED"
        };
        const status = next[exam.status];
        if (!status) return;
        await request(accessToken, `/v1/admin/exams/${exam.id}/status`, {
          method: "POST",
          body: JSON.stringify({ status })
        });
        setNotice(`Exam moved to ${status}.`);
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Exam action failed.");
    } finally {
      setBusy(false);
    }
  }

  const selectedExam = learning?.exams.find((exam) => exam.id === examId) ?? null;
  const activeYears = academics?.academicYears.filter((year) => year.status === "ACTIVE") ?? [];
  const examClasses = selectedExam
    ? academics?.classes.filter((item) => item.academicYearId === selectedExam.academicYearId) ?? []
    : [];
  const assignedSubjectIds = useMemo(() => {
    if (!selectedExam || !examClassId || !academics) return new Set<string>();
    return new Set(
      academics.assignments
        .filter((item) => item.academicYearId === selectedExam.academicYearId && item.classId === examClassId)
        .map((item) => item.subjectId)
    );
  }, [selectedExam, examClassId, academics]);
  const examSubjects = academics?.subjects.filter((subject) => assignedSubjectIds.has(subject.id)) ?? [];

  if (!learning || !academics) {
    return (
      <section className="admin-panel learning-section">
        <h2>{t("Exams & results")}</h2>
        <p>{t("Loading Phase 6 academic communication…")}</p>
        {error ? <div className="admin-error" role="alert">{error}</div> : null}
      </section>
    );
  }

  return (
    <section className="learning-section">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Phase 6 · Homework, Exams & Results")}</span>
          <h2>{t("Exam cycles & result publication")}</h2>
          <p>{t("Configure exam subjects and maximum scores, control the publication lifecycle, and audit corrections after publication.")}</p>
        </div>
        <button className="admin-secondary" onClick={() => void load()} disabled={busy}>{t("Refresh")}</button>
      </div>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      <div className="academic-form-grid">
        <article className="admin-panel academic-form-card">
          <div><h2>{t("Create exam")}</h2><p>Exam cycles begin as DRAFT. Scheduling dates are intentionally outside the MVP Phase 6 scope.</p></div>
          <form className="admin-form" onSubmit={createExam}>
            <label>
              Active academic year
              <select name="academicYearId" required defaultValue="">
                <option value="">{t("Select year")}</option>
                {activeYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>
            </label>
            <label>{t("Exam name")}<input name="name" placeholder="Midyear exam" required /></label>
            <label>{t("Exam type")}<input name="type" placeholder="MIDYEAR" required /></label>
            <button className="admin-primary" disabled={busy || activeYears.length === 0}>{t("Create draft exam")}</button>
          </form>
        </article>

        <article className="admin-panel academic-form-card">
          <div><h2>{t("Add exam subject")}</h2><p>A class/subject can be added only when a teacher assignment already exists for it.</p></div>
          <form className="admin-form" onSubmit={addExamSubject}>
            <label>
              Exam
              <select name="examId" required value={examId} onChange={(event) => { setExamId(event.target.value); setExamClassId(""); }}>
                <option value="">{t("Select exam")}</option>
                {learning.exams.filter((exam) => exam.status === "DRAFT" || exam.status === "SCHEDULED").map((exam) => (
                  <option key={exam.id} value={exam.id}>{exam.name} · {exam.status}</option>
                ))}
              </select>
            </label>
            <label>{t("Class")}<select name="classId" required value={examClassId} onChange={(event) => setExamClassId(event.target.value)}>
                <option value="">{t("Select class")}</option>
                {examClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
              </select>
            </label>
            <label>{t("Subject")}<select name="subjectId" required defaultValue="" key={examClassId}>
                <option value="">{t("Select assigned subject")}</option>
                {examSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
            <label>{t("Maximum score")}<input name="maxScore" type="number" min={1} max={10000} defaultValue={100} required /></label>
            <button className="admin-primary" disabled={busy || !examId || !examClassId || examSubjects.length === 0}>{t("Add subject")}</button>
          </form>
        </article>
      </div>

      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div><h2>{t("Exam lifecycle")}</h2><p>Draft → Scheduled → In progress → Results ready → Published → Archived</p></div>
        </div>
        <div className="academic-rows">
          {learning.exams.map((exam) => {
            const subjectCount = learning.examSubjects.filter((item) => item.examSubject.examId === exam.id).length;
            const action =
              exam.status === "DRAFT" ? "Schedule" :
              exam.status === "SCHEDULED" ? "Start exam" :
              exam.status === "IN_PROGRESS" ? "Mark results ready" :
              exam.status === "RESULTS_READY" ? "Publish results" :
              exam.status === "PUBLISHED" ? "Archive" : null;
            return (
              <div className="academic-row" key={exam.id}>
                <div>
                  <strong>{exam.name}</strong>
                  <span>{exam.type} · {exam.status} · {subjectCount} subject setup(s)</span>
                  {learning.examSubjects.filter((item) => item.examSubject.examId === exam.id).map((item) => (
                    <span key={item.examSubject.id}>{item.className} · {item.subjectName} · max {item.examSubject.maxScore}</span>
                  ))}
                </div>
                {action ? (
                  <div className="admin-actions">
                    <button disabled={busy} onClick={() => void examAction(exam)}>{action}</button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {learning.exams.length === 0 ? <p className="admin-copy">{t("No exams yet.")}</p> : null}
        </div>
      </article>

      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div><h2>{t("Published result corrections")}</h2><p>Published marks cannot be deleted. Corrections require a reason and create audit history.</p></div>
        </div>
        <div className="learning-grade-list">
          {learning.publishedGrades.map((item) => (
            <PublishedGradeRow key={item.grade.id} item={item} accessToken={accessToken} busy={busy} onBusy={setBusy} onError={setError} onNotice={setNotice} onReload={load} />
          ))}
          {learning.publishedGrades.length === 0 ? <p className="admin-copy">{t("No published grades yet.")}</p> : null}
        </div>
      </article>
    </section>
  );
}

function PublishedGradeRow({
  item,
  accessToken,
  busy,
  onBusy,
  onError,
  onNotice,
  onReload
}: {
  item: PublishedGrade;
  accessToken: string;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (value: string) => void;
  onNotice: (value: string) => void;
  onReload: () => Promise<void>;
}) {
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
          reason: reason.trim()
        })
      });
      onNotice(`Published mark corrected for ${item.studentName}. The reason and previous value are in the audit log.`);
      setReason("");
      await onReload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not correct published grade.");
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
      <label>Score<input type="number" min={0} max={item.maxScore} value={score} onChange={(event) => setScore(event.target.value)} /></label>
      <label>Remark<input value={remark} onChange={(event) => setRemark(event.target.value)} maxLength={500} /></label>
      <label>Correction reason<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required /></label>
      <button className="admin-secondary" type="button" disabled={busy || !reason.trim() || Number(score) < 0 || Number(score) > item.maxScore} onClick={() => void save()}>
        Save correction
      </button>
    </div>
  );
}
