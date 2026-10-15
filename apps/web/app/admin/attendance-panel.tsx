"use client";

import { AdminAttendanceAudit } from "./admin-attendance-audit";
import { AdminAttendanceFollowups } from "./admin-attendance-followups";
import { AdminAttendanceAnalytics } from "./admin-attendance-analytics";
import { AdminAttendanceMonitoring } from "./admin-attendance-monitoring";
import { AdminAttendanceStudents } from "./admin-attendance-students";
import { AdminAttendanceClassRegister } from "./admin-attendance-class-register";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTransientAdminFeedback } from "./admin-feedback";
import { AdminLoader, AdminSkeleton } from "./admin-loader";
import { AdminHijriDatePicker, formatAdminHijriDate } from "./admin-hijri-date-picker";
import { useAdminWorkspace } from "./admin-workspace";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import {
  ATTENDANCE_TABS, attendanceRate, type AttendanceTab
} from "./attendance-workspace-model";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

type AttendanceReportRow = {
  attendanceId: string; date: string; classId: string; className: string; classCode: string;
  studentId: string; studentCode: string; studentName: string;
  status: AttendanceStatus; note: string | null; submittedAt: string; updatedAt: string;
};

type AttendanceReport = {
  from: string; to: string;
  summary: {
    present: number; absent: number; late: number; excused: number;
    totalMarks: number; submittedClasses: number; pendingClasses: number;
  };
  rows: AttendanceReportRow[];
};

type AcademicOverview = {
  classes: Array<{ id: string; code: string; name: string; academicYearId: string }>;
  academicYears: Array<{ id: string; name: string; status: string }>;
};

type Filters = { from: string; to: string; classId: string };
const EMPTY_FILTERS: Filters = { from: "", to: "", classId: "" };
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const statuses: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

async function request<T>(accessToken: string, path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init, signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}) }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
}

function reportUrl(yearId: string, filters?: Filters): string {
  const params = new URLSearchParams({ academicYearId: yearId });
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.classId) params.set("classId", filters.classId);
  return "/v1/admin/attendance/report?" + params;
}

export function AttendancePanel({ accessToken }: { accessToken: string }) {
  const { locale, selectedAcademicYearId, selectedAcademicYear } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const [activeTab, setActiveTab] = useState<AttendanceTab>("OVERVIEW");
  const tabRefs = useRef<Partial<Record<AttendanceTab, HTMLButtonElement | null>>>({});
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters | null>(null);
  const [schoolToday, setSchoolToday] = useState("");
  const [academics, setAcademics] = useState<AcademicOverview | null>(null);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [selectedRegisterClass, setSelectedRegisterClass] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [bootstrapRefresh, setBootstrapRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const { error, notice, setError, setNotice } = useTransientAdminFeedback();
  const loadSequence = useRef(0);
  const loadController = useRef<AbortController | null>(null);
  const scope = accessToken + ":" + selectedAcademicYearId;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  useEffect(() => {
    const run = ++loadSequence.current;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setReport(null); setAcademics(null); setSchoolToday("");
    setDraftFilters(EMPTY_FILTERS); setAppliedFilters(null); setSelectedRegisterClass(null);
    setBusy(false); setActionBusy(false); setStatus(selectedAcademicYearId ? "loading" : "empty");
    setError(""); setNotice("");
    if (selectedAcademicYearId) {
      const year = selectedAcademicYearId;
      // With dates omitted, the report endpoint uses the school's configured
      // timezone. Never initialize attendance from the administrator's device.
      void Promise.all([
        request<AcademicOverview>(accessToken, "/v1/admin/academics", controller.signal),
        request<AttendanceReport>(accessToken, reportUrl(year), controller.signal)
      ]).then(([academicData, initialReport]) => {
        if (controller.signal.aborted || loadSequence.current !== run) return;
        const today = initialReport.to;
        setAcademics(academicData); setReport(initialReport);
        setSchoolToday(today);
        setDraftFilters({ from: today, to: today, classId: "" });
        setAppliedFilters({ from: today, to: today, classId: "" });
        setStatus("ready");
      }).catch(cause => {
        if (controller.signal.aborted || loadSequence.current !== run) return;
        setStatus("error");
        setError(adminErrorText(locale, cause, "Could not load attendance."));
      });
    }
    return () => {
      controller.abort();
      if (loadController.current === controller) loadController.current = null;
      ++loadSequence.current;
    };
  }, [accessToken, selectedAcademicYearId, bootstrapRefresh]);

  async function loadReport(filters: Filters) {
    if (!selectedAcademicYearId) return false;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const run = ++loadSequence.current;
    const expectedScope = scope;
    setBusy(true); setStatus("loading"); setReport(null); setError("");
    setSelectedRegisterClass(null);
    try {
      const next = await request<AttendanceReport>(
        accessToken, reportUrl(selectedAcademicYearId, filters), controller.signal
      );
      if (controller.signal.aborted || loadSequence.current !== run || scopeRef.current !== expectedScope) return false;
      setReport(next); setAppliedFilters(filters);
      setStatus("ready");
      return true;
    } catch (cause) {
      if (controller.signal.aborted || loadSequence.current !== run || scopeRef.current !== expectedScope) return false;
      setError(adminErrorText(locale, cause, "Could not load attendance report."));
      setStatus("error");
      return false;
    } finally {
      if (loadSequence.current === run && scopeRef.current === expectedScope) setBusy(false);
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftFilters.from || !draftFilters.to || draftFilters.from > draftFilters.to || actionBusy) return;
    setNotice("");
    void loadReport(draftFilters);
  }

  async function correct(row: AttendanceReportRow, nextStatus: AttendanceStatus, reason: string) {
    if (actionBusy || busy || selectedAcademicYear?.status !== "ACTIVE") return;
    const expectedScope = scope;
    setActionBusy(true); setError(""); setNotice("");
    try {
      await request(
        accessToken,
        `/v1/admin/attendance/${row.attendanceId}/students/${row.studentId}`,
        undefined, { method: "PATCH", body: JSON.stringify({
          status: nextStatus, reason: reason.trim(), expectedUpdatedAt: row.updatedAt
        }) }
      );
      if (scopeRef.current !== expectedScope) return;
      const updated = appliedFilters ? await loadReport(appliedFilters) : false;
      if (updated && scopeRef.current === expectedScope) {
        setNotice(adminFormat(locale,
          "Attendance corrected for {name}. The change was written to the audit log.",
          { name: row.studentName }));
      }
    } catch (cause) {
      if (scopeRef.current === expectedScope) {
        setError(adminErrorText(locale, cause, "Attendance correction failed."));
      }
    } finally {
      if (scopeRef.current === expectedScope) setActionBusy(false);
    }
  }

  const classes = useMemo(() => (academics?.classes ?? [])
    .filter(item => item.academicYearId === selectedAcademicYearId)
    .sort((a,b) => a.name.localeCompare(b.name)), [academics, selectedAcademicYearId]);
  const historicalReadOnly = selectedAcademicYear?.status !== "ACTIVE";
  const rate = report ? attendanceRate(report.summary) : null;
  const appliedDescription = appliedFilters
    ? adminFormat(locale, "Showing recorded marks from {from} to {to}", {
      from: formatAdminHijriDate(locale, appliedFilters.from),
      to: formatAdminHijriDate(locale, appliedFilters.to)
    }) : "";

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: AttendanceTab) {
    const index = ATTENDANCE_TABS.findIndex(item => item.id === id);
    let target = index;
    if (event.key === "Home") target = 0;
    else if (event.key === "End") target = ATTENDANCE_TABS.length - 1;
    else if (event.key === "ArrowRight") target = (index + 1) % ATTENDANCE_TABS.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + ATTENDANCE_TABS.length) % ATTENDANCE_TABS.length;
    else return;
    event.preventDefault();
    const destination = ATTENDANCE_TABS[target]!.id;
    setActiveTab(destination);
    tabRefs.current[destination]?.focus();
  }

  const metrics = report ? ([
    ["Present", report.summary.present], ["Absent", report.summary.absent],
    ["Late", report.summary.late], ["Excused", report.summary.excused],
    ["Submitted class-day registers", report.summary.submittedClasses]
  ] as const) : [];

  return (
    <section className="attendance-section admin-page-enter">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Daily attendance management")}</span>
          <h2>{t("Attendance oversight")}</h2>
          <p>{t("Review daily registers, student attendance and schoolwide attendance activity.")}</p>
          {schoolToday ? <small className="attendance-school-date">
            {t("School-local date")}: {formatAdminHijriDate(locale, schoolToday)}
          </small> : null}
        </div>
        <button type="button" className="admin-secondary"
          onClick={() => {
            if (appliedFilters) void loadReport(appliedFilters);
            else setBootstrapRefresh(value => value + 1);
          }}
          disabled={busy || actionBusy || status === "loading"}>{t("Refresh")}</button>
      </div>

      <nav className="attendance-workspace-tabs" role="tablist" aria-label={t("Attendance sections")}>
        {ATTENDANCE_TABS.map(({ id, label }) => (
          <button key={id} type="button" role="tab"
            id={`attendance-tab-${id.toLowerCase()}`}
            aria-selected={activeTab === id}
            aria-controls={`attendance-panel-${id.toLowerCase()}`}
            tabIndex={activeTab === id ? 0 : -1}
            ref={element => { tabRefs.current[id] = element; }}
            onKeyDown={event => onTabKeyDown(event, id)}
            onClick={() => setActiveTab(id)}>
            {t(label)}
          </button>
        ))}
      </nav>

      {status === "empty" ? <div className="admin-panel attendance-workspace-state">
        <strong>{t("Select an academic year")}</strong>
        <p>{t("Choose an academic year in the administrator header to view attendance.")}</p>
      </div> : null}
      {status === "loading" ? <div className="admin-panel attendance-workspace-state" role="status">
        <AdminLoader label={t("Loading attendance data…")} />
        <AdminSkeleton rows={3} />
      </div> : null}
      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {status === "error" ? <button type="button" className="admin-secondary"
        onClick={() => {
          if (appliedFilters) void loadReport(appliedFilters);
          else setBootstrapRefresh(value => value + 1);
        }}>{t("Retry")}</button> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      {status === "ready" && report && academics ? <>
        {(activeTab === "OVERVIEW" || activeTab === "REGISTERS") ? (
          <form className="admin-panel attendance-filter" onSubmit={applyFilters} aria-label={t("Attendance filters")}>
            <label>{t("From")}
              <AdminHijriDatePicker locale={locale} value={draftFilters.from}
                onChange={from => setDraftFilters(current => ({...current, from}))} required />
            </label>
            <label>{t("To")}
              <AdminHijriDatePicker locale={locale} value={draftFilters.to}
                onChange={to => setDraftFilters(current => ({...current, to}))} required />
            </label>
            <label>{t("Class")}
              <select value={draftFilters.classId} onChange={event =>
                setDraftFilters(current => ({...current, classId: event.target.value}))}>
                <option value="">{t("All classes in selected year")}</option>
                {classes.map(item => <option key={item.id} value={item.id}>
                  {item.name} · {item.code}</option>)}
              </select>
            </label>
            <button type="submit" className="admin-primary"
              disabled={busy || actionBusy || !draftFilters.from || !draftFilters.to ||
                draftFilters.from > draftFilters.to}>{t("Apply filters")}</button>
          </form>
        ) : null}

        {(activeTab === "OVERVIEW" || activeTab === "REGISTERS") ? <p className="attendance-period-caption">{appliedDescription}</p> : null}
        {historicalReadOnly && activeTab === "REGISTERS" ? (
          <p className="attendance-readonly-note" role="note">
            {t("This academic year is not active. Historical attendance is read-only.")}
          </p>
        ) : null}

        <div id={`attendance-panel-${activeTab.toLowerCase()}`} role="tabpanel"
          aria-labelledby={`attendance-tab-${activeTab.toLowerCase()}`} tabIndex={0}>
          {activeTab === "OVERVIEW" ? <>
            <div className="academic-summary-grid attendance-summary-grid">
              {metrics.map(([label,value]) => <Summary key={label} label={t(label)} value={value} />)}
            </div>
            <div className="attendance-overview-grid">
              <article className="admin-panel attendance-dashboard-card">
                <span>{t("Recorded attendance rate")}</span>
                <strong>{rate === null ? "—" : `${rate}%`}</strong>
                <p>{t("Based on submitted Present, Late and Absent marks. Excused and unrecorded days are excluded.")}</p>
              </article>
              <article className="admin-panel attendance-dashboard-card">
                <span>{t("Records needing attention in this period")}</span>
                <strong>{report.summary.absent + report.summary.late}</strong>
                <p>{t("Absent and Late marks in the selected period, not unresolved cases.")}</p>
                <button type="button" className="admin-secondary"
                  onClick={() => setActiveTab("FOLLOWUPS")}>{t("View recorded absences and lateness")}</button>
              </article>
              <article className="admin-panel attendance-dashboard-card">
                <span>{t("Submission overview")}</span>
                <strong>{report.summary.submittedClasses}</strong>
                <p>{t("Submitted registers in the selected period. Daily eligibility is shown below.")}</p>
                <p>{t("Daily submission monitoring follows the timetable and declared school closures.")}</p>
                <button type="button" className="admin-secondary"
                  onClick={() => setActiveTab("REGISTERS")}>{t("Open daily registers")}</button>
              </article>
            </div>
            <AdminAttendanceMonitoring
              accessToken={accessToken} academicYearId={selectedAcademicYearId}
              dateFrom={appliedFilters?.from??""} dateTo={appliedFilters?.to??""}
              classId={appliedFilters?.classId??""} locale={locale}
              mode="OVERVIEW" academicYearStatus={selectedAcademicYear?.status??""}
              schoolToday={schoolToday}
            />
          </> : null}

          {activeTab === "REGISTERS" ? (<div className="attendance-register-layout">
            <AdminAttendanceMonitoring
              accessToken={accessToken} academicYearId={selectedAcademicYearId}
              dateFrom={appliedFilters?.from??""} dateTo={appliedFilters?.to??""}
              classId={appliedFilters?.classId??""} locale={locale}
              mode="REGISTERS" academicYearStatus={selectedAcademicYear?.status??""}
              schoolToday={schoolToday}
              onOpenClass={(classId) => setSelectedRegisterClass(classId)}
            />
            {selectedRegisterClass && appliedFilters && appliedFilters.from === appliedFilters.to ?
              <AdminAttendanceClassRegister
                accessToken={accessToken} academicYearId={selectedAcademicYearId}
                classId={selectedRegisterClass} date={appliedFilters.from}
                locale={locale} onClose={() => setSelectedRegisterClass(null)}
              /> : null}
            <article className="admin-panel academic-list-panel">
              <div className="admin-section-header">
                <div><h3>{t(selectedRegisterClass ? "Selected class attendance marks" : "Daily registers")}</h3>
                  <p>{adminFormat(locale, "{count} student mark(s) from {from} to {to}", {
                    count: report.rows.length,
                    from: formatAdminHijriDate(locale, report.from),
                    to: formatAdminHijriDate(locale, report.to)
                  })}</p>
                </div>
              </div>
              <div className="attendance-report-list">
                {report.rows.filter(row => !selectedRegisterClass || row.classId === selectedRegisterClass).map(row => <AttendanceReportItem
                  key={`${row.attendanceId}-${row.studentId}`}
                  row={row} locale={locale} busy={busy || actionBusy}
                  readOnly={historicalReadOnly} onCorrect={correct} />)}
                {!report.rows.filter(row => !selectedRegisterClass || row.classId === selectedRegisterClass).length ? <p className="admin-copy">
                  {t("No attendance records match these filters.")}</p> : null}
              </div>
            </article>
          </div>) : null}

          {activeTab === "STUDENTS" ? <AdminAttendanceStudents
            accessToken={accessToken} academicYearId={selectedAcademicYearId}
            schoolToday={schoolToday} locale={locale}
            classId={appliedFilters?.classId??""}
          /> : null}

          {activeTab === "FOLLOWUPS" ? <AdminAttendanceFollowups
            accessToken={accessToken} academicYearId={selectedAcademicYearId}
            academicYearStatus={selectedAcademicYear?.status??""}
            schoolToday={schoolToday} locale={locale} classes={classes} /> : null}

          {activeTab === "REPORTS" ? <AdminAttendanceAnalytics
            accessToken={accessToken} academicYearId={selectedAcademicYearId}
            schoolToday={schoolToday} locale={locale} classes={classes}/> : null}

          {activeTab === "AUDIT" ? <AdminAttendanceAudit
            accessToken={accessToken} academicYearId={selectedAcademicYearId}
            classes={classes} locale={locale} /> : null}
        </div>
      </> : null}
    </section>
  );
}

function AttendanceReportItem({ row, locale, busy, readOnly, onCorrect }: {
  row: AttendanceReportRow; locale: AdminLocale; busy: boolean; readOnly: boolean;
  onCorrect: (row: AttendanceReportRow, status: AttendanceStatus, reason: string) => Promise<void>;
}) {
  const t = (english: string) => adminText(locale, english);
  const [status, setStatus] = useState<AttendanceStatus>(row.status);
  const [reason, setReason] = useState("");
  useEffect(() => {
    setStatus(row.status); setReason("");
  }, [row.status, row.note, row.updatedAt]);
  const canSave = status !== row.status && reason.trim().length >= 5;
  return <div className="attendance-report-row">
    <div className="attendance-record-main">
      <strong>{row.studentName}</strong>
      <span>{row.studentCode} · {row.className} · {formatAdminHijriDate(locale, row.date)}</span>
    </div>
    <label>{t("Status")}
      <select value={status} onChange={event => setStatus(event.target.value as AttendanceStatus)}
        disabled={busy || readOnly}>
        {statuses.map(item => <option key={item} value={item}>{t(item)}</option>)}
      </select>
    </label>
    <div className="attendance-original-note">
      <span>{t("Original teacher note")}</span>
      <p>{row.note || t("No note recorded")}</p>
    </div>
    <label>{t("Correction reason (required)")}
      <input value={reason} onChange={event => setReason(event.target.value)}
        required minLength={5} maxLength={240}
        placeholder={t("Explain why this mark must change")}
        disabled={busy || readOnly} />
    </label>
    <button type="button" className="admin-secondary"
      disabled={busy || readOnly || !canSave}
      onClick={() => void onCorrect(row, status, reason)}>{t("Save correction")}</button>
  </div>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="academic-summary"><strong>{value}</strong><span>{label}</span></div>;
}
