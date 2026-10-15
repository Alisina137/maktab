"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { adminApi } from "./admin-client";
import { AdminHijriDatePicker, formatAdminHijriDateTime } from "./admin-hijri-date-picker";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import { invoiceReference } from "./communication-invoices-model";

type Method = { method: string; gross: number; reversals: number; net: number;
  pendingCount: number; reconciledCount: number; pendingAmount: number; reconciledAmount: number };
type Report = {
  schoolTimezone: string; asOf: string; from: string | null; to: string | null;
  billed: number; paid: number; outstanding: number; overdue: number;
  aging: { notDue: number; days1to30: number; days31to60: number; days61to90: number; daysOver90: number };
  statement: { grossPayments: number; reversals: number; netCollections: number; methods: Method[] };
  rows: Array<{ paymentId: string; invoiceNumber: number; studentCode: string; studentName: string;
    kind: "PAYMENT" | "REVERSAL"; method: string; recordedAt: string; amount: number;
    reconciliation: "PENDING" | "RECONCILED" | "REVERSED" | "NOT_APPLICABLE" }>;
  invoices: Array<{ invoiceNumber: number; outstanding: number }>;
};
type Preview = {
  created: false; total: number; ready: number; duplicates: number; unavailable: number;
  rows: Array<{ index: number; studentId: string; status: string; existingInvoiceNumber: number | null }>;
};

export function AdminFeeFinancialReports({ accessToken, locale, students, refreshVersion }: {
  accessToken: string; locale: AdminLocale;
  students: Array<{ id: string; fullName: string; studentCode: string }>;
  refreshVersion: number;
}) {
  const t = (value: string) => adminText(locale, value);
  const money = (value: number) => new Intl.NumberFormat(locale).format(value) + " " + t("AFN");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reload, setReload] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [reportStatus, setReportStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const generation = useRef(0);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const invalidRange = Boolean(from && to && from > to);
  const params = () => new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();

  useEffect(() => {
    const id = ++generation.current, token = accessToken;
    setReport(null); setReportStatus("loading"); setError("");
    if (invalidRange) {
      setReportStatus("error"); setError(t("Report date range must be chronological."));
      return () => { generation.current += 1; };
    }
    void adminApi<{ report: Report }>("/v1/admin/fees/reports?" + params(), {
      headers: { Authorization: `Bearer ${token}` }
    }).then(result => {
      if (generation.current !== id || tokenRef.current !== token) return;
      setReport(result.report); setReportStatus("ready");
    }).catch(cause => {
      if (generation.current !== id || tokenRef.current !== token) return;
      setError(adminErrorText(locale, cause, "Could not load financial report.")); setReportStatus("error");
    });
    return () => { generation.current += 1; };
  }, [accessToken, locale, from, to, reload, refreshVersion, invalidRange]);

  useEffect(() => { setSelectedIds([]); setPreview(null); setNotice(""); }, [accessToken]);
  useEffect(() => { setPreview(null); }, [selectedIds, amount, dueDate, description]);
  const visible = useMemo(() => students.filter(row =>
    (row.fullName + " " + row.studentCode).toLocaleLowerCase()
      .includes(studentSearch.trim().toLocaleLowerCase())
  ).slice(0, 200), [students, studentSearch]);

  async function exportCsv(kind: "payments" | "outstanding") {
    const token = accessToken;
    setBusy(true); setError(""); setNotice("");
    try {
      const { csv, filename } = await adminApi<{ csv: string; filename: string }>(
        "/v1/admin/fees/reports/export?" + new URLSearchParams({
          kind, ...(from ? { from } : {}), ...(to ? { to } : {})
        }).toString(), { headers: { Authorization: `Bearer ${token}` } }
      );
      if (tokenRef.current !== token) return;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename; document.body.appendChild(link); link.click();
      link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(t("Financial CSV exported."));
    } catch (cause) {
      if (tokenRef.current === token) setError(adminErrorText(locale, cause, "Could not export CSV."));
    } finally { if (tokenRef.current === token) setBusy(false); }
  }

  async function reconcile(paymentId: string, current: "PENDING" | "RECONCILED") {
    const next = current === "PENDING" ? "RECONCILED" : "PENDING";
    if (!window.confirm(t(next === "RECONCILED"
      ? "Confirm matching this cash/bank payment to an external record?"
      : "Reopen this reconciled payment for review? The audit trail is preserved."))) return;
    const reference = next === "RECONCILED"
      ? window.prompt(t("External reconciliation reference (optional)"), "") : "";
    if (reference === null) return;
    if (reference.length > 120) { setError(t("Reference must be 120 characters or less.")); return; }
    const token = accessToken;
    setBusy(true); setError(""); setNotice("");
    try {
      await adminApi("/v1/admin/fees/payments/" + encodeURIComponent(paymentId) + "/reconciliation", {
        method: "PATCH", headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: next, ...(next === "RECONCILED" && reference.trim() ? { reference: reference.trim() } : {}) })
      });
      if (tokenRef.current !== token) return;
      setNotice(t("Reconciliation status updated and audited."));
      setReload(value => value + 1);
    } catch (cause) {
      if (tokenRef.current === token) setError(adminErrorText(locale, cause, "Could not update reconciliation."));
    } finally { if (tokenRef.current === token) setBusy(false); }
  }

  async function bulkPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedIds.length < 1 || selectedIds.length > 100) {
      setError(t("Select between 1 and 100 students.")); return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 100000000 || !dueDate) {
      setError(t("Provide a whole AFN amount and a due date.")); return;
    }
    const token = accessToken;
    setBusy(true); setError(""); setNotice(""); setPreview(null);
    try {
      const result = await adminApi<Preview>("/v1/admin/fees/invoices/bulk-preview", {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoices: selectedIds.map(studentId => ({
          studentId, amount: parsedAmount, dueDate, description: description.trim()
        })) })
      });
      if (tokenRef.current !== token) return;
      setPreview(result);
    } catch (cause) {
      if (tokenRef.current === token) setError(adminErrorText(locale, cause, "Could not preview invoice batch."));
    } finally { if (tokenRef.current === token) setBusy(false); }
  }

  return (
    <section className="admin-panel admin-financial-reports">
      <div className="communication-dashboard-heading">
        <div><h3>{t("Financial reports & reconciliation")}</h3>
          <p>{t("Current issued-invoice aging is independent of the transaction date filter. No online payments are captured.")}</p></div>
        <button className="admin-secondary" type="button" onClick={() => setReload(value => value + 1)}>{t("Refresh")}</button>
      </div>
      <div className="admin-fee-filters">
        <label>{t("From date")}<AdminHijriDatePicker locale={locale} value={from} onChange={setFrom} /></label>
        <label>{t("To date")}<AdminHijriDatePicker locale={locale} value={to} onChange={setTo} /></label>
      </div>
      {invalidRange ? <p role="alert" className="admin-error">{t("Report date range must be chronological.")}</p> : null}
      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}
      {reportStatus === "loading" ? <p role="status">{t("Loading fee records…")}</p> : null}
      {reportStatus === "ready" && report ? (
        <>
          <small>{t("School-local as of")}: {report.asOf} · {report.schoolTimezone}</small>
          <div className="admin-delivery-metrics">
            {([
              ["Issued billed",report.billed],["Net paid",report.paid],
              ["Outstanding AFN",report.outstanding],["Overdue AFN",report.overdue],
              ["Period net collections",report.statement.netCollections]
            ] as const).map(([label,value])=>(
              <div key={label}><span>{t(label)}</span><strong>{money(value)}</strong></div>
            ))}
          </div>
          <h4>{t("Outstanding aging (school date)")}</h4>
          <div className="admin-delivery-metrics">
            {([
              ["Not overdue",report.aging.notDue],["1–30 days",report.aging.days1to30],
              ["31–60 days",report.aging.days31to60],["61–90 days",report.aging.days61to90],
              ["Over 90 days",report.aging.daysOver90]
            ] as const).map(([label,value])=>(
              <div key={label}><span>{t(label)}</span><strong>{money(value)}</strong></div>
            ))}
          </div>
          <h4>{t("Collections and reconciliation by method")}</h4>
          <div className="admin-financial-methods">
            {report.statement.methods.map(method=>(
              <div key={method.method} className="admin-fee-ledger-row">
                <div><strong>{t(({CASH:"Cash",BANK_TRANSFER:"Bank transfer",MOBILE_MONEY:"Mobile money",OTHER:"Other"} as Record<string,string>)[method.method] ?? method.method)}</strong>
                  <small>{t("Gross")}: {money(method.gross)} · {t("Reversals")}: {money(method.reversals)}</small>
                  {(method.method==="CASH" || method.method==="BANK_TRANSFER") ? (
                    <small>{t("Reconciled")}: {method.reconciledCount} ({money(method.reconciledAmount)}) · {t("Pending review")}: {method.pendingCount} ({money(method.pendingAmount)})</small>
                  ) : null}
                </div><strong>{t("Net")}: {money(method.net)}</strong>
              </div>
            ))}
          </div>
          <div className="admin-reminder-actions">
            <button className="admin-secondary" type="button" disabled={busy}
              onClick={() => void exportCsv("payments")}>{t("Export transactions CSV")}</button>
            <button className="admin-secondary" type="button" disabled={busy}
              onClick={() => void exportCsv("outstanding")}>{t("Export outstanding CSV")}</button>
          </div>
          <small>{t("CSV includes school-authorized rows and escapes spreadsheet formulas. Exports are audited.")}</small>
          <h4>{t("Payment reconciliation")}</h4>
          <div className="admin-fee-ledger-rows">
            {report.rows.filter(row=>row.kind==="PAYMENT" && (row.method==="CASH" || row.method==="BANK_TRANSFER"))
              .slice(0,50).map(row=>(
              <div className="admin-fee-ledger-row" key={row.paymentId}>
                <div><strong>{row.studentName} · {invoiceReference(row.invoiceNumber)}</strong>
                  <small>{formatAdminHijriDateTime(locale,row.recordedAt,report.schoolTimezone)}</small>
                  <small>{money(row.amount)} · {t(row.reconciliation)}</small>
                </div>
                {(row.reconciliation==="PENDING" || row.reconciliation==="RECONCILED") ? (
                  <button type="button" className="admin-secondary" disabled={busy}
                    onClick={() => void reconcile(row.paymentId,row.reconciliation as "PENDING"|"RECONCILED")}>
                    {t(row.reconciliation==="PENDING" ? "Mark reconciled" : "Reopen reconciliation")}
                  </button>
                ) : null}
              </div>
            ))}
            {!report.rows.length ? <p>{t("No payment transactions in this date range.")}</p> : null}
          </div>
          <small>{t("Showing up to 50 cash/bank rows; CSV contains all eligible report rows.")}</small>
        </>
      ) : null}
      <div className="admin-financial-bulk">
        <h4>{t("Bulk draft-invoice preview")}</h4>
        <p>{t("Preview only. No invoices are created. Existing student/date/description matches are flagged for review.")}</p>
        <form className="admin-form" onSubmit={event => void bulkPreview(event)}>
          <label>{t("Find students")}
            <input type="search" value={studentSearch} onChange={event=>setStudentSearch(event.target.value)}
              placeholder={t("Search students")} />
          </label>
          <div className="admin-financial-students" role="group" aria-label={t("Select students for preview")}>
            {visible.map(student=>(
              <label key={student.id}>
                <input type="checkbox" checked={selectedIds.includes(student.id)}
                  disabled={busy || (!selectedIds.includes(student.id) && selectedIds.length >= 100)}
                  onChange={event=>setSelectedIds(current=>event.target.checked
                    ? [...current,student.id] : current.filter(id=>id!==student.id))} />
                <span>{student.fullName} · {student.studentCode}</span>
              </label>
            ))}
          </div>
          <small>{adminFormat(locale,"{count} students selected (maximum 100)",{count:selectedIds.length})}</small>
          <label>{t("Amount (AFN)")}
            <input type="number" min={1} max={100000000} step={1} required value={amount}
              onChange={event=>setAmount(event.target.value)} />
          </label>
          <label>{t("Due date")}
            <AdminHijriDatePicker locale={locale} required value={dueDate} onChange={setDueDate} />
          </label>
          <label>{t("Description")}<input maxLength={240} value={description}
            onChange={event=>setDescription(event.target.value)} /></label>
          <button type="submit" className="admin-primary" disabled={busy || !selectedIds.length || !dueDate}>
            {t("Preview draft invoice batch")}</button>
        </form>
        {preview ? <div role="status" className="admin-financial-preview">
          <strong>{adminFormat(locale,"{ready} ready / {duplicates} duplicates / {unavailable} unavailable",preview)}</strong>
          <p>{t("Preview only — review results before any individual draft creation.")}</p>
          <ul>{preview.rows.map(row=>(
            <li key={row.index}>{students.find(student=>student.id===row.studentId)?.fullName ?? t("Student")}:
              {" "}{t(row.status)}{row.existingInvoiceNumber ? " · "+invoiceReference(row.existingInvoiceNumber):""}
            </li>
          ))}</ul>
        </div> : null}
      </div>
    </section>
  );
}
