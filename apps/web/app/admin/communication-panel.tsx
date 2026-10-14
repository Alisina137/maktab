"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { announcementDashboard, feeDashboard } from "./communication-overview-model";
import { AdminLoader } from "./admin-loader";
import {
  AdminHijriDatePicker,
  formatAdminHijriDate,
  formatAdminHijriDateTime
} from "./admin-hijri-date-picker";
import { useAdminWorkspace } from "./admin-workspace";
import { adminErrorText, adminFormat, adminText } from "./admin-i18n";
import { adminApi } from "./admin-client";

type Section = "OVERVIEW" | "COMMUNICATION" | "FEES";
type Pane = "LIST" | "FORM";
type ResourceKey = "communication" | "families" | "academics";
type ResourceStatus = "idle" | "loading" | "ready" | "error";
type AnnouncementScope = "SCHOOL" | "CLASS" | "ROLE";
type AudienceRole = "TEACHER" | "PARENT" | "STUDENT";

type Announcement = {
  id: string;
  title: string;
  content: string;
  audienceScope: AnnouncementScope;
  classId: string | null;
  audienceRole: string | null;
  publishAt: string;
  archivedAt: string | null;
};

type FeePayment = {
  id: string;
  kind: "PAYMENT" | "REVERSAL";
  amount: number;
  method: string;
  transactionReference: string | null;
  reversalOfPaymentId: string | null;
  reversalReason: string | null;
  recordedAt: string;
};

type InvoiceView = {
  invoice: {
    id: string;
    studentId: string;
    amount: number;
    currency: string;
    description: string | null;
    dueDate: string;
    status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
  };
  studentName: string;
  studentCode: string;
  paid: number;
  outstanding: number;
  payments: FeePayment[];
};

type CommunicationOverview = {
  announcements: Announcement[];
  invoices: InvoiceView[];
  feeReminderDays: number[];
};

type FamilyOverview = {
  students: Array<{
    student: { id: string; studentCode: string; fullName: string; status: string };
  }>;
};

type AcademicOverview = {
  classes: Array<{ id: string; code: string; name: string }>;
};

function request<T>(accessToken: string, path: string, init?: RequestInit) {
  return adminApi<T>(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
  });
}

function datetimeLocalToIso(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Announcement publish time is invalid.");
  return date.toISOString();
}

export function CommunicationPanel({ accessToken }: { accessToken: string }) {
  const { locale } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const [overview, setOverview] = useState<CommunicationOverview | null>(null);
  const [families, setFamilies] = useState<FamilyOverview | null>(null);
  const [academics, setAcademics] = useState<AcademicOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>("OVERVIEW");
  const [communicationPane, setCommunicationPane] = useState<Pane>("LIST");
  const [feesPane, setFeesPane] = useState<Pane>("LIST");
  const [resourceStatus, setResourceStatus] = useState<Record<ResourceKey, ResourceStatus>>({
    communication: "idle", families: "idle", academics: "idle"
  });
  const [resourceError, setResourceError] = useState<Partial<Record<ResourceKey, string>>>({});
  const [resourceOwner, setResourceOwner] = useState<Partial<Record<ResourceKey, string>>>({});
  const accessRef = useRef(accessToken);
  accessRef.current = accessToken;
  const requestGeneration = useRef<Record<ResourceKey, number>>({
    communication: 0, families: 0, academics: 0
  });
  const sectionRefs = useRef<Partial<Record<Section, HTMLButtonElement | null>>>({});
  const { error, notice, setError, setNotice } = useTransientAdminFeedback();
  const [scope, setScope] = useState<AnnouncementScope>("SCHOOL");
  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editPublishAt, setEditPublishAt] = useState("");
  const [reminderText, setReminderText] = useState("7, 1");
  const [paymentDraft, setPaymentDraft] = useState<Record<string, { amount: string; method: string; reference: string }>>({});
  // Keep the same key across a network timeout; changing the payment fields creates a new attempt.
  const paymentAttempts = useRef<Record<string, { signature: string; key: string }>>({});
  const [reversalReason, setReversalReason] = useState<Record<string, string>>({});

  useEffect(() => {
    setSection("OVERVIEW");
    setCommunicationPane("LIST");
    setFeesPane("LIST");
    setOverview(null);
    setFamilies(null);
    setAcademics(null);
    setResourceOwner({});
    setResourceStatus({ communication: "idle", families: "idle", academics: "idle" });
    setResourceError({});
    void loadResource("communication");
    void loadResource("families");
    void loadResource("academics");
    return () => {
      for (const key of ["communication", "families", "academics"] as ResourceKey[]) {
        requestGeneration.current[key] += 1;
      }
    };
  }, [accessToken]);

  useEffect(() => {
    sectionRefs.current[section]?.scrollIntoView({
      behavior: "smooth", block: "nearest", inline: "nearest"
    });
  }, [section]);

  async function loadResource(key: ResourceKey) {
    const generation = ++requestGeneration.current[key];
    const token = accessToken;
    setResourceStatus(current => ({ ...current, [key]: "loading" }));
    setResourceError(current => ({ ...current, [key]: "" }));
    try {
      if (key === "communication") {
        const data = await request<CommunicationOverview>(token, "/v1/admin/communication");
        if (accessRef.current !== token || requestGeneration.current[key] !== generation) return;
        setOverview(data);
        setReminderText(data.feeReminderDays.join(", "));
      } else if (key === "families") {
        const data = await request<FamilyOverview>(token, "/v1/admin/families");
        if (accessRef.current !== token || requestGeneration.current[key] !== generation) return;
        setFamilies(data);
      } else {
        const data = await request<AcademicOverview>(token, "/v1/admin/academics");
        if (accessRef.current !== token || requestGeneration.current[key] !== generation) return;
        setAcademics(data);
      }
      setResourceOwner(current => ({ ...current, [key]: token }));
      setResourceStatus(current => ({ ...current, [key]: "ready" }));
    } catch (cause) {
      if (accessRef.current !== token || requestGeneration.current[key] !== generation) return;
      const message = adminErrorText(locale, cause, "Could not load communication and fees.");
      setResourceError(current => ({ ...current, [key]: message }));
      setResourceStatus(current => ({ ...current, [key]: "error" }));
    }
  }

  const visibleOverview = resourceOwner.communication === accessToken ? overview : null;
  const visibleFamilies = resourceOwner.families === accessToken ? families : null;
  const visibleAcademics = resourceOwner.academics === accessToken ? academics : null;

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const classId = String(form.get("classId") ?? "");
      const audienceRole = String(form.get("audienceRole") ?? "");
      await request(accessToken, "/v1/admin/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          content: String(form.get("content") ?? "").trim(),
          audienceScope: scope,
          classId: scope === "CLASS" ? classId : undefined,
          audienceRole: scope === "ROLE" || scope === "CLASS" ? audienceRole || undefined : undefined,
          publishAt: datetimeLocalToIso(String(form.get("publishAt") ?? ""))
        })
      });
      setNotice(t("Announcement saved. Its audience is enforced by the API."));
      event.currentTarget.reset();
      setScope("SCHOOL");
      await loadResource("communication");
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not create announcement."));
    } finally {
      setBusy(false);
    }
  }

  async function saveScheduledEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingNotice) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, `/v1/admin/announcements/${editingNotice.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(), content: editMessage.trim(),
          ...(editPublishAt ? { publishAt: datetimeLocalToIso(editPublishAt) } : {})
        })
      });
      setEditingNotice(null);
      setNotice(t("Scheduled announcement updated."));
      await loadResource("communication");
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not update scheduled announcement."));
    } finally {
      setBusy(false);
    }
  }

  async function archiveAnnouncement(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, `/v1/admin/announcements/${id}/archive`, { method: "POST" });
      setNotice(t("Announcement archived."));
      await loadResource("communication");
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not archive announcement."));
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await request(accessToken, "/v1/admin/fees/invoices", {
        method: "POST",
        body: JSON.stringify({
          studentId: String(form.get("studentId") ?? ""),
          amount: Number(form.get("amount")),
          dueDate: String(form.get("dueDate") ?? ""),
          description: String(form.get("description") ?? "").trim() || undefined
        })
      });
      setNotice(t("Fee invoice created in DRAFT state."));
      event.currentTarget.reset();
      await loadResource("communication");
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not create fee invoice."));
    } finally {
      setBusy(false);
    }
  }

  async function invoiceAction(id: string, action: "issue" | "cancel") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, `/v1/admin/fees/invoices/${id}/${action}`, { method: "POST" });
      setNotice(t(action === "issue" ? "Invoice issued to the family." : "Invoice cancelled."));
      await loadResource("communication");
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Fee invoice action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(invoiceId: string) {
    const draft = paymentDraft[invoiceId] ?? { amount: "", method: "CASH", reference: "" };
    const signature = JSON.stringify([Number(draft.amount), draft.method.trim(), draft.reference.trim()]);
    const previous = paymentAttempts.current[invoiceId];
    const idempotencyKey = previous?.signature === signature ? previous.key : crypto.randomUUID();
    paymentAttempts.current[invoiceId] = { signature, key: idempotencyKey };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, `/v1/admin/fees/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(draft.amount),
          method: draft.method.trim(),
          transactionReference: draft.reference.trim() || undefined,
          idempotencyKey
        })
      });
      delete paymentAttempts.current[invoiceId];
      setPaymentDraft((current) => ({ ...current, [invoiceId]: { amount: "", method: "CASH", reference: "" } }));
      setNotice(t("Payment recorded as an immutable transaction."));
      await loadResource("communication");
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not record payment."));
    } finally {
      setBusy(false);
    }
  }

  async function reversePayment(paymentId: string) {
    const reason = reversalReason[paymentId]?.trim() ?? "";
    if (!reason) {
      setError(t("Enter a reversal reason first."));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, `/v1/admin/fees/payments/${paymentId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason })
      });
      setReversalReason((current) => ({ ...current, [paymentId]: "" }));
      setNotice(t("Payment reversed with a separate immutable reversal transaction."));
      await loadResource("communication");
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not reverse payment."));
    } finally {
      setBusy(false);
    }
  }

  async function saveReminderSettings(event: FormEvent) {
    event.preventDefault();
    const days = reminderText
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    if (days.length === 0) {
      setError(t("Enter one or more reminder days, for example 7, 1."));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request<{ daysBeforeDue: number[] }>(accessToken, "/v1/admin/fees/reminder-settings", {
        method: "PATCH",
        body: JSON.stringify({ daysBeforeDue: days })
      });
      setReminderText(result.daysBeforeDue.join(", "));
      setNotice(t("Fee reminder days updated."));
      await loadResource("communication");
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not update fee reminder settings."));
    } finally {
      setBusy(false);
    }
  }

  const activeStudents = visibleFamilies?.students.filter(item => item.student.status === "ACTIVE") ?? [];
  const money = useMemo(() => feeDashboard(visibleOverview?.invoices ?? []), [visibleOverview]);
  const notices = useMemo(() => announcementDashboard(
    visibleOverview?.announcements ?? [], new Date()
  ), [visibleOverview]);

  const ready = resourceStatus.communication === "ready" && !!visibleOverview;
  function resourceNotice(key: ResourceKey) {
    return (
      <div className="admin-panel communication-resource-state" role="status">
        {resourceStatus[key] === "error" ? (
          <>
            <p role="alert">{resourceError[key] || t("Could not load communication and fees.")}</p>
            <button type="button" className="admin-secondary" onClick={() => void loadResource(key)}>
              {t("Retry")}
            </button>
          </>
        ) : <AdminLoader compact label={t("Loading Phase 7 data…")} />}
      </div>
    );
  }


  return (
    <section className="communication-section admin-page-enter">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Phase 7 · Communication & Fees")}</span>
          <h2>{t("School-family communication")}</h2>
          <p>{t("Publish scoped updates and maintain fee visibility using manual school-recorded transactions.")}</p>
        </div>
        <button className="admin-secondary" onClick={() => void load()} disabled={busy}>{t("Refresh")}</button>
      </div>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      <div className="academic-summary-grid communication-summary-grid">
        <Summary label={t("Announcements")} value={overview.announcements.filter((item) => !item.archivedAt).length} />
        <Summary label={t("Invoices")} value={overview.invoices.length} />
        <Summary label={t("Billed AFN")} value={totals.billed} />
        <Summary label={t("Paid AFN")} value={totals.paid} />
        <Summary label={t("Outstanding AFN")} value={totals.outstanding} />
      </div>

      <div className="communication-two-column">
        <article className="admin-panel communication-form-card">
          <div><h2>{t("Create announcement")}</h2><p>{t("Every announcement has an explicit school, class, or role audience.")}</p></div>
          <form className="admin-form" onSubmit={createAnnouncement}>
            <label>{t("Title")}<input name="title" maxLength={160} required /></label>
            <label>{t("Message")}<textarea name="content" rows={5} maxLength={10000} required /></label>
            <label>
              {t("Audience")}
              <select value={scope} onChange={(event) => setScope(event.target.value as AnnouncementScope)}>
                <option value="SCHOOL">{t("Whole school")}</option>
                <option value="CLASS">{t("One class")}</option>
                <option value="ROLE">{t("One role")}</option>
              </select>
            </label>
            {scope === "CLASS" ? (
              <label>{t("Class")}<select name="classId" required defaultValue="">
                  <option value="">{t("Select class")}</option>
                  {(visibleAcademics?.classes ?? []).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {item.code}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {scope === "CLASS" ? (
              <label>{t("Optional role within class")}
                <select name="audienceRole" defaultValue="">
                  <option value="">{t("All roles in class")}</option>
                  <option value="PARENT">{t("Parents")}</option>
                  <option value="STUDENT">{t("Students")}</option>
                  <option value="TEACHER">{t("Teachers")}</option>
                </select>
              </label>
            ) : null}
            {scope === "ROLE" ? (
              <label>{t("Role")}<select name="audienceRole" required defaultValue="PARENT">
                  <option value="PARENT">{t("Parents")}</option>
                  <option value="STUDENT">{t("Students")}</option>
                  <option value="TEACHER">{t("Teachers")}</option>
                </select>
              </label>
            ) : null}
            <label>{t("Publish at (optional)")}<AdminHijriDatePicker locale={locale} name="publishAt" includeTime /></label>
            <button className="admin-primary" disabled={busy}>{t("Save announcement")}</button>
          </form>
        </article>

        {editingNotice ? (
          <article className="admin-panel communication-form-card">
            <div><h2>{t("Edit scheduled announcement")}</h2>
              <p>{t("Published announcements are immutable; only future scheduled notices may be edited.")}</p>
            </div>
            <form className="admin-form" onSubmit={saveScheduledEdit}>
              <label>{t("Title")}<input required minLength={2} maxLength={160}
                value={editTitle} onChange={event => setEditTitle(event.target.value)} /></label>
              <label>{t("Message")}<textarea required maxLength={10000} rows={5}
                value={editMessage} onChange={event => setEditMessage(event.target.value)} /></label>
              <label>{t("Publish at")}
                <AdminHijriDatePicker locale={locale} includeTime
                  value={editPublishAt} onChange={setEditPublishAt} />
              </label>
              <button className="admin-primary" disabled={busy}>{t("Save changes")}</button>
              <button type="button" className="admin-secondary"
                onClick={() => setEditingNotice(null)}>{t("Cancel")}</button>
            </form>
          </article>
        ) : null}

        <article className="admin-panel communication-form-card">
          <div><h2>{t("Create fee invoice")}</h2><p>{t("Amounts are recorded in whole AFN. Online payment is intentionally outside the MVP.")}</p></div>
          <form className="admin-form" onSubmit={createInvoice}>
            <label>
              {t("Student")}
              <select name="studentId" required defaultValue="">
                <option value="">{t("Select student")}</option>
                {activeStudents.map((item) => (
                  <option key={item.student.id} value={item.student.id}>
                    {item.student.fullName} · {item.student.studentCode}
                  </option>
                ))}
              </select>
            </label>
            <label>{t("Amount (AFN)")}<input name="amount" type="number" min="1" step="1" required /></label>
            <label>{t("Due date")}<AdminHijriDatePicker locale={locale} name="dueDate" required /></label>
            <label>{t("Description")}<input name="description" maxLength={240} placeholder={t("Monthly tuition, transport…")} /></label>
            <button className="admin-primary" disabled={busy}>{t("Create draft invoice")}</button>
          </form>

          <form className="communication-reminder-form" onSubmit={saveReminderSettings}>
            <label>
              {t("Fee reminders · days before due")}
              <input value={reminderText} onChange={(event) => setReminderText(event.target.value)} placeholder="7, 1" />
            </label>
            <button className="admin-secondary" disabled={busy}>{t("Save reminder days")}</button>
          </form>
        </article>
      </div>

      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div><h2>{t("Announcements")}</h2><p>{t("Scheduled and published school communication")}</p></div>
        </div>
        <div className="academic-rows">
          {overview.announcements.map((item) => (
            <div className="academic-row communication-announcement-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{t(item.audienceScope)}{item.audienceRole ? ` · ${t(item.audienceRole)}` : ""}{item.classId ? ` · ${t("class scoped")}` : ""}</span>
                <span>{formatAdminHijriDateTime(locale, item.publishAt)} · {t(item.archivedAt ? "ARCHIVED" :
                    new Date(item.publishAt).getTime() > Date.now() ? "SCHEDULED" : "PUBLISHED")}</span>
                <p>{item.content}</p>
              </div>
              {!item.archivedAt ? (
                <div className="admin-actions">
                  {new Date(item.publishAt).getTime() > Date.now() ? (
                    <button className="admin-secondary" type="button" disabled={busy}
                      onClick={() => {
                        setEditingNotice(item); setEditTitle(item.title);
                        setEditMessage(item.content); setEditPublishAt("");
                      }}>{t("Edit")}</button>
                  ) : null}
                  <button className="admin-secondary" disabled={busy}
                    onClick={() => void archiveAnnouncement(item.id)}>{t("Archive")}</button>
                </div>
              ) : null}
            </div>
          ))}
          {overview.announcements.length === 0 ? <p className="admin-copy">{t("No announcements yet.")}</p> : null}
        </div>
      </article>

      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div><h2>{t("Fee invoices & payments")}</h2><p>{t("Payments are appended; reversals never overwrite the original transaction.")}</p></div>
        </div>
        <div className="communication-invoice-list">
          {overview.invoices.map((item) => {
            const draft = paymentDraft[item.invoice.id] ?? { amount: "", method: "CASH", reference: "" };
            const reversedPaymentIds = new Set(
              item.payments.filter((payment) => payment.kind === "REVERSAL" && payment.reversalOfPaymentId)
                .map((payment) => payment.reversalOfPaymentId)
            );
            return (
              <div className="communication-invoice" key={item.invoice.id}>
                <div className="communication-invoice-header">
                  <div>
                    <strong>{item.studentName}</strong>
                    <span>{item.studentCode} · {item.invoice.description || t("School fee")} · {adminFormat(locale, "due {date}", { date: formatAdminHijriDate(locale, item.invoice.dueDate) })}</span>
                  </div>
                  <strong>{t(item.invoice.status)}</strong>
                </div>
                <div className="communication-money-grid">
                  <span>{t("Amount")}<strong>AFN {item.invoice.amount}</strong></span>
                  <span>{t("Paid")}<strong>AFN {item.paid}</strong></span>
                  <span>{t("Outstanding")}<strong>AFN {item.outstanding}</strong></span>
                </div>

                <div className="admin-actions">
                  {item.invoice.status === "DRAFT" ? (
                    <button disabled={busy} onClick={() => void invoiceAction(item.invoice.id, "issue")}>{t("Issue")}</button>
                  ) : null}
                  {!["PAID", "CANCELLED"].includes(item.invoice.status) && item.paid === 0 ? (
                    <button disabled={busy} onClick={() => void invoiceAction(item.invoice.id, "cancel")}>{t("Cancel")}</button>
                  ) : null}
                </div>

                {["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(item.invoice.status) ? (
                  <div className="communication-payment-form">
                    <input
                      type="number"
                      min="1"
                      max={item.outstanding}
                      step="1"
                      value={draft.amount}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({
                          ...current,
                          [item.invoice.id]: { ...draft, amount: event.target.value }
                        }))
                      }
                      placeholder={t("Amount")}
                    />
                    <input
                      value={draft.method}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({
                          ...current,
                          [item.invoice.id]: { ...draft, method: event.target.value }
                        }))
                      }
                      placeholder={t("Method · CASH")}
                    />
                    <input
                      value={draft.reference}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({
                          ...current,
                          [item.invoice.id]: { ...draft, reference: event.target.value }
                        }))
                      }
                      placeholder={t("Reference (optional)")}
                    />
                    <button
                      className="admin-primary"
                      disabled={busy || !draft.amount || !draft.method.trim()}
                      onClick={() => void recordPayment(item.invoice.id)}
                    >{t("Record payment")}</button>
                  </div>
                ) : null}

                {item.payments.length > 0 ? (
                  <div className="communication-payment-history">
                    {item.payments.map((payment) => (
                      <div key={payment.id} className="communication-payment-row">
                        <div>
                          <strong>{t(payment.kind)} · AFN {payment.amount}</strong>
                          <span>{payment.method} · {formatAdminHijriDateTime(locale, payment.recordedAt)}</span>
                          {payment.transactionReference ? <span>{t("Ref")}: {payment.transactionReference}</span> : null}
                          {payment.reversalReason ? <span>{t("Reason")}: {payment.reversalReason}</span> : null}
                        </div>
                        {payment.kind === "PAYMENT" && !reversedPaymentIds.has(payment.id) ? (
                          <div className="communication-reversal">
                            <input
                              value={reversalReason[payment.id] ?? ""}
                              onChange={(event) => setReversalReason((current) => ({ ...current, [payment.id]: event.target.value }))}
                              placeholder={t("Reversal reason")}
                            />
                            <button disabled={busy} onClick={() => void reversePayment(payment.id)}>{t("Reverse")}</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {overview.invoices.length === 0 ? <p className="admin-copy">{t("No fee invoices yet.")}</p> : null}
        </div>
      </article>
    </section>
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
