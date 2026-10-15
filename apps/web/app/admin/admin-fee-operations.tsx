"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "./admin-client";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import { AdminHijriDatePicker, formatAdminHijriDate, formatAdminHijriDateTime } from "./admin-hijri-date-picker";
import { AdminLoader } from "./admin-loader";
import { invoiceReference } from "./communication-invoices-model";

type FeePaymentRow = {
  payment: {
    id: string;
    kind: "PAYMENT" | "REVERSAL";
    amount: number;
    method: string;
    transactionReference: string | null;
    reversalOfPaymentId: string | null;
    reversalReason: string | null;
    recordedAt: string;
  };
  invoiceId: string;
  invoiceNumber: number;
  studentId: string;
  studentName: string;
  studentCode: string;
  recordedByUsername: string;
};
type FeeReceipt = FeePaymentRow & {
  schoolName: string;
  schoolTimezone: string;
  invoiceAmount: number;
  description: string | null;
  dueDate: string;
  currentOutstanding: number;
  reversed: boolean;
};
type FeeBalance = {
  student: { id: string; fullName: string; studentCode: string; status: string };
  billed: number;
  paid: number;
  outstanding: number;
  overdue: number;
  invoices: Array<{
    invoice: {
      id: string; invoiceNumber: number; amount: number; dueDate: string;
      description: string | null; status: string
    };
    paid: number;
    outstanding: number;
  }>;
};

const METHODS = ["ALL", "CASH", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"] as const;
const KINDS = ["ALL", "PAYMENT", "REVERSAL"] as const;
const labelMethod = (method: string) => ({
  CASH: "Cash", BANK_TRANSFER: "Bank transfer",
  MOBILE_MONEY: "Mobile money", OTHER: "Other", REVERSAL: "Reversal"
} as Record<string,string>)[method] ?? method;

function useFeeCurrency(locale: AdminLocale) {
  return (value: number) => `${new Intl.NumberFormat(locale).format(value)} ${adminText(locale, "AFN")}`;
}

function feeRequest<T>(token: string, url: string): Promise<T> {
  return adminApi<T>(url, { headers: { Authorization: `Bearer ${token}` } });
}

/** The receipt is re-read from the authorized immutable database ledger, never generated from unsaved form values. */
export function AdminFeeReceiptButton({
  accessToken, paymentId, locale
}: { accessToken: string; paymentId: string; locale: AdminLocale }) {
  const [receipt, setReceipt] = useState<FeeReceipt | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef(accessToken);
  const generation = useRef(0);
  tokenRef.current = accessToken;
  const t = (value: string) => adminText(locale, value);
  const money = useFeeCurrency(locale);
  useEffect(() => {
    generation.current += 1;
    setReceipt(null);
    setError("");
    setLoading(false);
    return () => { generation.current += 1; };
  }, [accessToken, paymentId]);
  async function open() {
    const token = accessToken;
    const requestId = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await feeRequest<{ receipt: FeeReceipt }>(
        token, `/v1/admin/fees/payments/${encodeURIComponent(paymentId)}/receipt`
      );
      if (tokenRef.current !== token || requestId !== generation.current) return;
      setReceipt(result.receipt);
    } catch (cause) {
      if (tokenRef.current !== token || requestId !== generation.current) return;
      setError(adminErrorText(locale, cause, "Could not load receipt."));
    } finally {
      if (tokenRef.current === token && requestId === generation.current) setLoading(false);
    }
  }
  return (
    <>
      <button type="button" className="admin-secondary" disabled={loading}
        onClick={() => void open()}>{t("View receipt")}</button>
      {error ? <div role="alert" className="admin-error">{error}</div> : null}
      {receipt ? (
        <div className="admin-fee-receipt-overlay" role="presentation"
          onClick={() => setReceipt(null)}>
          <section className="admin-fee-receipt" role="dialog" aria-modal="true"
            aria-label={t("Payment receipt")} onClick={event => event.stopPropagation()}>
            <div className="admin-fee-receipt-actions">
              <button type="button" className="admin-secondary"
                onClick={() => setReceipt(null)}>{t("Close")}</button>
              <button type="button" className="admin-primary"
                onClick={() => window.print()}>{t("Print / Save as PDF")}</button>
            </div>
            <header className="admin-fee-receipt-header">
              <strong>{receipt.schoolName}</strong>
              <h2>{t("Payment receipt")}</h2>
              {receipt.reversed ? (
                <p className="admin-fee-reversed" role="alert">{t("REVERSED — NOT A VALID PAYMENT")}</p>
              ) : null}
              <small>{t("Recorded school payment — not an online transaction")}</small>
            </header>
            <dl className="admin-fee-receipt-details">
              <div><dt>{t("Receipt ID")}</dt><dd>{receipt.payment.id}</dd></div>
              <div><dt>{t("Invoice number")}</dt><dd>{invoiceReference(receipt.invoiceNumber)}</dd></div>
              <div><dt>{t("Student")}</dt><dd>{receipt.studentName} · {receipt.studentCode}</dd></div>
              <div><dt>{t("Description")}</dt><dd>{receipt.description || t("School fee")}</dd></div>
              <div><dt>{t("Date")}</dt><dd>{formatAdminHijriDateTime(locale,receipt.payment.recordedAt,receipt.schoolTimezone)}</dd></div>
              <div><dt>{t("Amount")}</dt><dd>{money(receipt.payment.amount)}</dd></div>
              <div><dt>{t("Method")}</dt><dd>{t(labelMethod(receipt.payment.method))}</dd></div>
              <div><dt>{t("Reference")}</dt><dd>{receipt.payment.transactionReference || "—"}</dd></div>
              <div><dt>{t("Recorded by")}</dt><dd>{receipt.recordedByUsername}</dd></div>
              <div><dt>{t("Current outstanding")}</dt><dd>{money(receipt.currentOutstanding)}</dd></div>
            </dl>
            <p className="admin-copy">{t("This receipt reflects the recorded payment. Current outstanding may include later transactions.")}</p>
          </section>
        </div>
      ) : null}
    </>
  );
}

export function AdminFeeOperations({
  mode, accessToken, locale, students, refreshVersion
}: {
  mode: "PAYMENTS" | "BALANCES";
  accessToken: string;
  locale: AdminLocale;
  students: Array<{ id: string; fullName: string; studentCode: string }>;
  refreshVersion: number;
}) {
  const t = (value: string) => adminText(locale, value);
  const money = useFeeCurrency(locale);
  const [studentId, setStudentId] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("ALL");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [recorder, setRecorder] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [listing, setListing] = useState<{
    payments: FeePaymentRow[]; total: number; page: number; pageSize: number; schoolTimezone: string
  } | null>(null);
  const [balance, setBalance] = useState<FeeBalance | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [owner, setOwner] = useState("");
  const tokenRef = useRef(accessToken);
  const generation = useRef(0);
  tokenRef.current = accessToken;

  useEffect(() => { setPage(1); }, [studentId,method,kind,from,to,recorder]);
  useEffect(() => {
    const token = accessToken;
    const id = ++generation.current;
    setListing(null);
    setBalance(null);
    setOwner("");
    setError("");
    if (mode === "BALANCES" && !studentId) {
      setStatus("idle");
      return () => { generation.current += 1; };
    }
    setStatus("loading");
    const timer = window.setTimeout(() => {
      const url = mode === "BALANCES"
        ? `/v1/admin/fees/students/${encodeURIComponent(studentId)}/balance`
        : `/v1/admin/fees/payments?${new URLSearchParams({
            page: String(page), method, kind, recordedByUsername: recorder,
            ...(studentId ? { studentId } : {}),
            ...(from ? { from } : {}), ...(to ? { to } : {})
          }).toString()}`;
      void feeRequest<FeeBalance | { payments: FeePaymentRow[]; total: number; page: number; pageSize: number }>(
        token, url
      ).then(result => {
        if (tokenRef.current !== token || generation.current !== id) return;
        if (mode === "BALANCES") setBalance(result as FeeBalance);
        else setListing(result as { payments: FeePaymentRow[]; total: number; page: number; pageSize: number });
        setOwner(token);
        setStatus("ready");
      }).catch(cause => {
        if (tokenRef.current !== token || generation.current !== id) return;
        setError(adminErrorText(locale, cause, "Could not load fee records."));
        setStatus("error");
      });
    }, mode === "PAYMENTS" && recorder.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); generation.current += 1; };
  }, [mode,accessToken,studentId,method,kind,from,to,recorder,page,refreshVersion,reload]);

  const currentListing = owner === accessToken ? listing : null;
  const currentBalance = owner === accessToken ? balance : null;
  const filterHasInvalidRange = Boolean(from && to && from > to);
  const statusElement = status === "loading" ? <AdminLoader compact label={t("Loading fee records…")} />
    : status === "error" ? <div className="admin-error" role="alert">
        {error} <button className="admin-secondary" type="button"
          onClick={() => setReload(value => value+1)}>{t("Retry")}</button>
      </div> : null;

  return (
    <div className="admin-panel admin-fee-operations">
      <div className="communication-dashboard-heading">
        <div>
          <h3>{t(mode === "PAYMENTS" ? "Payment history" : "Student balances")}</h3>
          <p>{t(mode === "PAYMENTS"
            ? "Recorded payments and immutable reversals, newest first."
            : "Issued invoices only; draft and cancelled invoices do not count.")}</p>
        </div>
        <button type="button" className="admin-secondary"
          onClick={() => setReload(value => value + 1)}>{t("Refresh")}</button>
      </div>
      <div className="admin-fee-filters">
        <label>{t("Student")}
          <select value={studentId} onChange={event => setStudentId(event.target.value)}>
            <option value="">{t("All students")}</option>
            {students.map(row => <option key={row.id} value={row.id}>
              {row.fullName} · {row.studentCode}
            </option>)}
          </select>
        </label>
        {mode === "PAYMENTS" ? (
          <>
            <label>{t("Type")}
              <select value={kind} onChange={event => setKind(event.target.value as typeof kind)}>
                {KINDS.map(value => <option value={value} key={value}>
                  {t(value==="ALL" ? "All transaction types" : value)}
                </option>)}
              </select>
            </label>
            <label>{t("Method")}
              <select value={method} onChange={event => setMethod(event.target.value as typeof method)}>
                {METHODS.map(value => <option key={value} value={value}>
                  {t(value==="ALL" ? "All methods" : labelMethod(value))}
                </option>)}
              </select>
            </label>
            <label>{t("Recorded by")}
              <input value={recorder} maxLength={64} onChange={event=>setRecorder(event.target.value)}
                placeholder={t("Administrator username")} />
            </label>
            <label>{t("From date")}
              <AdminHijriDatePicker locale={locale} value={from} onChange={setFrom} />
            </label>
            <label>{t("To date")}
              <AdminHijriDatePicker locale={locale} value={to} onChange={setTo} />
            </label>
          </>
        ) : null}
      </div>
      {filterHasInvalidRange && mode==="PAYMENTS" ? (
        <p className="admin-error" role="alert">{t("The start date cannot be after the end date.")}</p>
      ) : null}
      {mode==="BALANCES" && !studentId ? (
        <p className="admin-copy">{t("Select a student to review their financial balance.")}</p>
      ) : statusElement}
      {mode==="PAYMENTS" && currentListing && status==="ready" ? (
        <>
          <p className="admin-copy" role="status">{adminFormat(locale,"{count} payment transactions",{
            count: new Intl.NumberFormat(locale).format(currentListing.total)
          })}</p>
          <div className="admin-fee-ledger-rows">
            {currentListing.payments.map(row => (
              <article key={row.payment.id} className="admin-fee-ledger-row">
                <div>
                  <strong>{row.studentName} · {invoiceReference(row.invoiceNumber)}</strong>
                  <small>{row.studentCode} · {t(row.payment.kind)} · {t(labelMethod(row.payment.method))}</small>
                  <small>{formatAdminHijriDateTime(locale,row.payment.recordedAt,currentListing.schoolTimezone)} · {t("Recorded by")}: {row.recordedByUsername}</small>
                  {row.payment.transactionReference ? <small>{t("Reference")}: {row.payment.transactionReference}</small> : null}
                  {row.payment.reversalReason ? <small>{t("Reason")}: {row.payment.reversalReason}</small> : null}
                </div>
                <div className="admin-fee-ledger-amount">
                  <strong>{row.payment.kind==="REVERSAL" ? "−" : ""}{money(row.payment.amount)}</strong>
                  {row.payment.kind === "PAYMENT" ? (
                    <AdminFeeReceiptButton accessToken={accessToken} paymentId={row.payment.id} locale={locale} />
                  ) : null}
                </div>
              </article>
            ))}
            {!currentListing.payments.length ? <p className="admin-copy">{t("No matching payment transactions.")}</p> : null}
          </div>
          <div className="communication-invoice-pager">
            <button type="button" className="admin-secondary" disabled={page<=1}
              onClick={()=>setPage(value=>Math.max(1,value-1))}>{t("Previous")}</button>
            <span>{adminFormat(locale,"Page {page} of {total}",{
              page, total:Math.max(1,Math.ceil(currentListing.total/currentListing.pageSize))
            })}</span>
            <button type="button" className="admin-secondary"
              disabled={page*currentListing.pageSize>=currentListing.total}
              onClick={()=>setPage(value=>value+1)}>{t("Next")}</button>
          </div>
        </>
      ) : null}
      {mode==="BALANCES" && currentBalance && status==="ready" ? (
        <>
          <h4>{currentBalance.student.fullName} · {currentBalance.student.studentCode}</h4>
          <div className="academic-summary-grid communication-overview-grid">
            {([
              [t("Billed AFN"),money(currentBalance.billed)],
              [t("Paid AFN"),money(currentBalance.paid)],
              [t("Outstanding AFN"),money(currentBalance.outstanding)],
              [t("Overdue AFN"),money(currentBalance.overdue)]
            ] as const).map(([label,value])=>
              <div className="academic-summary" key={label}>
                <strong>{value}</strong><span>{label}</span>
              </div>)}
          </div>
          <div className="admin-fee-ledger-rows">
            {currentBalance.invoices.map(row => (
              <div className="admin-fee-ledger-row" key={row.invoice.id}>
                <div>
                  <strong>{invoiceReference(row.invoice.invoiceNumber)} · {row.invoice.description || t("School fee")}</strong>
                  <small>{t(row.invoice.status)} · {t("Due date")}: {formatAdminHijriDate(locale,row.invoice.dueDate)}</small>
                </div>
                <div className="admin-fee-ledger-amount">
                  <strong>{money(row.outstanding)}</strong>
                  <small>{t("Paid")}: {money(row.paid)}</small>
                </div>
              </div>
            ))}
            {!currentBalance.invoices.length ? <p className="admin-copy">{t("No issued invoices for this student.")}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
