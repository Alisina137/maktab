"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminLoader, AdminSkeleton } from "./admin-loader";
import { AdminHijriDatePicker } from "./admin-hijri-date-picker";
import { useAdminWorkspace } from "./admin-workspace";
import { adminErrorText, adminFormat, adminText } from "./admin-i18n";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

type AttendanceReportRow = {
  attendanceId: string;
  date: string;
  classId: string;
  className: string;
  classCode: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  status: AttendanceStatus;
  note: string | null;
  submittedAt: string;
  updatedAt: string;
};

type AttendanceReport = {
  from: string;
  to: string;
  summary: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    totalMarks: number;
    submittedClasses: number;
    pendingClasses: number;
  };
  rows: AttendanceReportRow[];
};

type AcademicOverview = {
  classes: Array<{ id: string; code: string; name: string; academicYearId: string }>;
  academicYears: Array<{ id: string; name: string; status: string }>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const statuses: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

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

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function AttendancePanel({ accessToken }: { accessToken: string }) {
  const { locale } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const today = useMemo(localDate, []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [classId, setClassId] = useState("");
  const [academics, setAcademics] = useState<AcademicOverview | null>(null);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const { error, notice, setError, setNotice } = useTransientAdminFeedback();

  useEffect(() => {
    void Promise.all([
      request<AcademicOverview>(accessToken, "/v1/admin/academics"),
      loadReport()
    ])
      .then(([academicData]) => setAcademics(academicData))
      .catch((cause) => setError(adminErrorText(locale, cause, "Could not load attendance.")));
  }, [accessToken]);

  async function loadReport(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const query = new URLSearchParams({ from, to });
      if (classId) query.set("classId", classId);
      const result = await request<AttendanceReport>(
        accessToken,
        `/v1/admin/attendance/report?${query.toString()}`
      );
      setReport(result);
      return result;
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not load attendance report."));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function correct(row: AttendanceReportRow, status: AttendanceStatus, note: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(
        accessToken,
        `/v1/admin/attendance/${row.attendanceId}/students/${row.studentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, note: note.trim() || undefined })
        }
      );
      setNotice(adminFormat(locale, "Attendance corrected for {name}. The change was written to the audit log.", { name: row.studentName }));
      await loadReport();
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Attendance correction failed."));
    } finally {
      setBusy(false);
    }
  }

  if ((!academics || !report) && !error) {
    return (
      <section className="admin-panel attendance-section admin-loading-card">
        <AdminLoader label={t("Loading…")} />
        <AdminSkeleton rows={5} />
      </section>
    );
  }

  if (!academics || !report) {
    return (
      <section className="admin-panel attendance-section admin-loading-card">
        <div className="admin-error" role="alert">{error}</div>
        <button className="admin-secondary" type="button" onClick={() => window.location.reload()}>
          {t("Retry")}
        </button>
      </section>
    );
  }

  const activeYearIds = new Set(
    academics?.academicYears.filter((year) => year.status === "ACTIVE").map((year) => year.id) ?? []
  );
  const classes = academics?.classes.filter((item) => activeYearIds.has(item.academicYearId)) ?? [];

  return (
    <section className="attendance-section admin-page-enter">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Phase 5 · Attendance")}</span>
          <h2>{t("Attendance oversight")}</h2>
          <p>{t("Review class attendance, absence/late totals, pending class submissions, and make audited corrections.")}</p>
        </div>
        <button className="admin-secondary" type="button" onClick={() => void loadReport()} disabled={busy}>{t("Refresh")}</button>
      </div>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      <form className="admin-panel attendance-filter" onSubmit={loadReport}>
        <label>
          {t("From")}
          <AdminHijriDatePicker locale={locale} value={from} onChange={setFrom} required />
        </label>
        <label>
          {t("To")}
          <AdminHijriDatePicker locale={locale} value={to} onChange={setTo} required />
        </label>
        <label>{t("Class")}<select value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">{t("All active classes")}</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.code}</option>
            ))}
          </select>
        </label>
        <button className="admin-primary" type="submit" disabled={busy || from > to}>
          {t("Apply filters")}
        </button>
      </form>

      {report ? (
        <>
          <div className="academic-summary-grid attendance-summary-grid">
            <Summary label={t("Present")} value={report.summary.present} />
            <Summary label={t("Absent")} value={report.summary.absent} />
            <Summary label={t("Late")} value={report.summary.late} />
            <Summary label={t("Excused")} value={report.summary.excused} />
            <Summary label={t("Submitted classes")} value={report.summary.submittedClasses} />
            <Summary label={t("Pending classes")} value={report.summary.pendingClasses} />
          </div>

          <article className="admin-panel academic-list-panel">
            <div className="admin-section-header">
              <div>
                <h2>{t("Attendance records")}</h2>
                <p>{adminFormat(locale, "{count} student mark(s) from {from} to {to}", {
                  count: report.rows.length,
                  from: report.from,
                  to: report.to
                })}</p>
              </div>
            </div>
            <div className="attendance-report-list">
              {report.rows.map((row) => (
                <AttendanceReportItem
                  key={`${row.attendanceId}-${row.studentId}`}
                  row={row}
                  busy={busy}
                  onCorrect={correct}
                />
              ))}
              {report.rows.length === 0 ? (
                <p className="admin-copy">{t("No attendance records match these filters.")}</p>
              ) : null}
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}

function AttendanceReportItem({
  row,
  busy,
  onCorrect
}: {
  row: AttendanceReportRow;
  busy: boolean;
  onCorrect: (row: AttendanceReportRow, status: AttendanceStatus, note: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(row.status);
  const [note, setNote] = useState(row.note ?? "");

  useEffect(() => {
    setStatus(row.status);
    setNote(row.note ?? "");
  }, [row.status, row.note]);

  const changed = status !== row.status || note.trim() !== (row.note ?? "");

  return (
    <div className="attendance-report-row">
      <div className="attendance-record-main">
        <strong>{row.studentName}</strong>
        <span>{row.studentCode} · {row.className} · {row.date}</span>
      </div>
      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)}>
          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label>
        Correction note
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} placeholder={t("Optional reason")} />
      </label>
      <button
        type="button"
        className="admin-secondary"
        disabled={busy || !changed}
        onClick={() => void onCorrect(row, status, note)}
      >
        Save correction
      </button>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="academic-summary">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
