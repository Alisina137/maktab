"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminHijriDatePicker, formatAdminHijriDate } from "./admin-hijri-date-picker";
import { AdminLoader } from "./admin-loader";
import { adminText, type AdminLocale } from "./admin-i18n";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type Row = {
  id: string; at: string; attendanceId: string; date: string;
  className: string; classId: string; actorName: string;
  studentId: string | null; studentName: string | null; studentCode: string | null;
  previousStatus: Status | null; status: Status | null;
  originalNote: string | null; reason: string | null;
};
type Result = { academicYearId: string; total: number; limit: number; offset: number; rows: Row[] };
type Filters = { from: string; to: string; classId: string; search: string };
const EMPTY: Filters = { from: "", to: "", classId: "", search: "" };
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 15;

export function AdminAttendanceAudit({ accessToken, academicYearId, locale, classes }: {
  accessToken: string; academicYearId: string; locale: AdminLocale;
  classes: Array<{ id: string; name: string; code: string }>;
}) {
  const t = (key: string) => adminText(locale, key);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<Result | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(EMPTY); setApplied(EMPTY); setOffset(0);
  }, [accessToken, academicYearId]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      academicYearId, limit: String(PAGE_SIZE), offset: String(offset)
    });
    if (applied.from) params.set("from", applied.from);
    if (applied.to) params.set("to", applied.to);
    if (applied.classId) params.set("classId", applied.classId);
    if (applied.search) params.set("search", applied.search);
    setState("loading"); setData(null); setError("");
    void fetch(`${API_URL}/v1/admin/attendance/audit?${params}`, {
      signal: controller.signal, headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    }).then(async response => {
      const body: Result & { message?: string } = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not load attendance audit.");
      return body;
    }).then(result => {
      if (controller.signal.aborted) return;
      setData(result); setState("ready");
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : t("Could not load attendance audit."));
      setState("error");
    });
    return () => controller.abort();
  }, [accessToken, academicYearId, applied, offset, reload]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setError(t("From date cannot be after To date.")); return;
    }
    if (draft.from && draft.to &&
      (Date.parse(draft.to + "T12:00:00Z") - Date.parse(draft.from + "T12:00:00Z")) / 86400000 > 365) {
      setError(t("Select at most 366 days.")); return;
    }
    setOffset(0); setApplied({ ...draft, search: draft.search.trim() });
  }

  return <article className="admin-panel attendance-audit">
    <header className="admin-section-header">
      <div><h3>{t("Attendance audit trail")}</h3>
        <p>{t("Every administrator correction shows the old and new status, reason, actor, and time. Teacher notes remain unchanged.")}</p>
      </div>
      <button type="button" className="admin-secondary" onClick={() => setReload(n => n + 1)}>
        {t("Refresh")}
      </button>
    </header>
    <form className="attendance-audit-filter" onSubmit={submit} aria-label={t("Filter correction history")}>
      <label>{t("From")}
        <AdminHijriDatePicker locale={locale} value={draft.from}
          onChange={value => setDraft(current => ({...current, from: value}))}/>
      </label>
      <label>{t("To")}
        <AdminHijriDatePicker locale={locale} value={draft.to}
          onChange={value => setDraft(current => ({...current, to: value}))}/>
      </label>
      <label>{t("Class")}
        <select value={draft.classId}
          onChange={event => setDraft(current => ({...current, classId: event.target.value}))}>
          <option value="">{t("All classes in selected year")}</option>
          {classes.map(item => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
        </select>
      </label>
      <label>{t("Student name or code")}
        <input maxLength={100} value={draft.search} placeholder={t("Search students")}
          onChange={event => setDraft(current => ({...current,search:event.target.value}))}/>
      </label>
      <div className="attendance-audit-buttons">
        <button type="submit" className="admin-primary">{t("Apply filters")}</button>
        <button type="button" className="admin-secondary" onClick={() => {
          setDraft(EMPTY); setApplied(EMPTY); setOffset(0);
        }}>{t("Clear")}</button>
      </div>
    </form>
    {state === "loading" ? <div role="status"><AdminLoader label={t("Loading attendance audit…")}/></div> : null}
    {error ? <div className="admin-error" role="alert">{error}</div> : null}
    {state === "error" ? <button type="button" className="admin-secondary"
      onClick={() => setReload(n => n + 1)}>{t("Retry")}</button> : null}
    {state === "ready" && data ? <>
      <p className="admin-copy" role="status">{data.total} {t("correction events found")}</p>
      <div className="attendance-audit-list">
        {data.rows.map(item => <div className="attendance-audit-card" key={item.id}>
          <div className="attendance-audit-title">
            <strong>{item.studentName ?? t("Student record unavailable")}</strong>
            <span>{item.studentCode ? item.studentCode + " · " : ""}
              {item.className} · {formatAdminHijriDate(locale,item.date)}</span>
          </div>
          <div className="attendance-audit-transition">
            <span className="attendance-audit-status">{item.previousStatus ? t(item.previousStatus) : "—"}</span>
            <span aria-hidden="true">→</span>
            <span className="attendance-audit-status">{item.status ? t(item.status) : "—"}</span>
          </div>
          <div className="attendance-audit-detail">
            <div><small>{t("Reason")}</small><p>{item.reason ?? t("Reason not captured for older correction")}</p></div>
            <div><small>{t("Original teacher note")}</small><p>{item.originalNote ?? t("No note recorded")}</p></div>
          </div>
          <footer>{t("Changed by")}: {item.actorName} · {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kabul"
          }).format(new Date(item.at))}</footer>
        </div>)}
        {!data.rows.length ? <p className="admin-copy">{t("No correction events match these filters.")}</p> : null}
      </div>
      {data.total > PAGE_SIZE ? <div className="attendance-audit-pagination">
        <button className="admin-secondary" type="button" disabled={offset === 0}
          onClick={() => setOffset(n => Math.max(0,n-PAGE_SIZE))}>{t("Previous")}</button>
        <span>{Math.min(offset+1,data.total)}–{Math.min(offset+PAGE_SIZE,data.total)} / {data.total}</span>
        <button className="admin-secondary" type="button" disabled={offset+PAGE_SIZE >= data.total}
          onClick={() => setOffset(n=>n+PAGE_SIZE)}>{t("Next")}</button>
      </div> : null}
    </> : null}
  </article>;
}
