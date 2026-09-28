"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

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

function datetimeLocalToIso(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Announcement publish time is invalid.");
  return date.toISOString();
}

export function CommunicationPanel({ accessToken }: { accessToken: string }) {
  const [overview, setOverview] = useState<CommunicationOverview | null>(null);
  const [families, setFamilies] = useState<FamilyOverview | null>(null);
  const [academics, setAcademics] = useState<AcademicOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scope, setScope] = useState<AnnouncementScope>("SCHOOL");
  const [reminderText, setReminderText] = useState("7, 1");
  const [paymentDraft, setPaymentDraft] = useState<Record<string, { amount: string; method: string; reference: string }>>({});
  const [reversalReason, setReversalReason] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function load() {
    setError("");
    try {
      const [communication, familyData, academicData] = await Promise.all([
        request<CommunicationOverview>(accessToken, "/v1/admin/communication"),
        request<FamilyOverview>(accessToken, "/v1/admin/families"),
        request<AcademicOverview>(accessToken, "/v1/admin/academics")
      ]);
      setOverview(communication);
      setFamilies(familyData);
      setAcademics(academicData);
      setReminderText(communication.feeReminderDays.join(", "));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load communication and fees.");
    }
  }

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
          audienceRole: scope === "ROLE" ? audienceRole : undefined,
          publishAt: datetimeLocalToIso(String(form.get("publishAt") ?? ""))
        })
      });
      setNotice("Announcement saved. Its audience is enforced by the API.");
      event.currentTarget.reset();
      setScope("SCHOOL");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create announcement.");
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
      setNotice("Announcement archived.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not archive announcement.");
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
      setNotice("Fee invoice created in DRAFT state.");
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create fee invoice.");
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
      setNotice(action === "issue" ? "Invoice issued to the family." : "Invoice cancelled.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Fee invoice action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(invoiceId: string) {
    const draft = paymentDraft[invoiceId] ?? { amount: "", method: "CASH", reference: "" };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, `/v1/admin/fees/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(draft.amount),
          method: draft.method.trim(),
          transactionReference: draft.reference.trim() || undefined
        })
      });
      setPaymentDraft((current) => ({ ...current, [invoiceId]: { amount: "", method: "CASH", reference: "" } }));
      setNotice("Payment recorded as an immutable transaction.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record payment.");
    } finally {
      setBusy(false);
    }
  }

  async function reversePayment(paymentId: string) {
    const reason = reversalReason[paymentId]?.trim() ?? "";
    if (!reason) {
      setError("Enter a reversal reason first.");
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
      setNotice("Payment reversed with a separate immutable reversal transaction.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reverse payment.");
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
      setError("Enter one or more reminder days, for example 7, 1.");
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
      setNotice("Fee reminder days updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update fee reminder settings.");
    } finally {
      setBusy(false);
    }
  }

  const activeStudents = families?.students.filter((item) => item.student.status === "ACTIVE") ?? [];
  const totals = useMemo(
    () => (overview?.invoices ?? []).reduce(
      (sum, item) => ({
        billed: sum.billed + item.invoice.amount,
        paid: sum.paid + item.paid,
        outstanding: sum.outstanding + item.outstanding
      }),
      { billed: 0, paid: 0, outstanding: 0 }
    ),
    [overview]
  );

  if (!overview || !families || !academics) {
    return (
      <section className="communication-section">
        <div className="admin-section-header">
          <div><h2>Communication & fees</h2><p>Loading Phase 7 data…</p></div>
          <button className="admin-secondary" onClick={() => void load()}>Retry</button>
        </div>
        {error ? <div className="admin-error">{error}</div> : null}
      </section>
    );
  }

  return (
    <section className="communication-section">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">Phase 7 · Communication & Fees</span>
          <h2>School-family communication</h2>
          <p>Publish scoped updates and maintain fee visibility using manual school-recorded transactions.</p>
        </div>
        <button className="admin-secondary" onClick={() => void load()} disabled={busy}>Refresh</button>
      </div>

      {error ? <div className="admin-error">{error}</div> : null}
      {notice ? <div className="admin-success">{notice}</div> : null}

      <div className="academic-summary-grid communication-summary-grid">
        <Summary label="Announcements" value={overview.announcements.filter((item) => !item.archivedAt).length} />
        <Summary label="Invoices" value={overview.invoices.length} />
        <Summary label="Billed AFN" value={totals.billed} />
        <Summary label="Paid AFN" value={totals.paid} />
        <Summary label="Outstanding AFN" value={totals.outstanding} />
      </div>

      <div className="communication-two-column">
        <article className="admin-panel communication-form-card">
          <div><h2>Create announcement</h2><p>Every announcement has an explicit school, class, or role audience.</p></div>
          <form className="admin-form" onSubmit={createAnnouncement}>
            <label>Title<input name="title" maxLength={160} required /></label>
            <label>Message<textarea name="content" rows={5} maxLength={10000} required /></label>
            <label>
              Audience
              <select value={scope} onChange={(event) => setScope(event.target.value as AnnouncementScope)}>
                <option value="SCHOOL">Whole school</option>
                <option value="CLASS">One class</option>
                <option value="ROLE">One role</option>
              </select>
            </label>
            {scope === "CLASS" ? (
              <label>
                Class
                <select name="classId" required defaultValue="">
                  <option value="">Select class</option>
                  {academics.classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {item.code}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {scope === "ROLE" ? (
              <label>
                Role
                <select name="audienceRole" required defaultValue="PARENT">
                  <option value="PARENT">Parents</option>
                  <option value="STUDENT">Students</option>
                  <option value="TEACHER">Teachers</option>
                </select>
              </label>
            ) : null}
            <label>Publish at (optional)<input name="publishAt" type="datetime-local" /></label>
            <button className="admin-primary" disabled={busy}>Save announcement</button>
          </form>
        </article>

        <article className="admin-panel communication-form-card">
          <div><h2>Create fee invoice</h2><p>Amounts are recorded in whole AFN. Online payment is intentionally outside the MVP.</p></div>
          <form className="admin-form" onSubmit={createInvoice}>
            <label>
              Student
              <select name="studentId" required defaultValue="">
                <option value="">Select student</option>
                {activeStudents.map((item) => (
                  <option key={item.student.id} value={item.student.id}>
                    {item.student.fullName} · {item.student.studentCode}
                  </option>
                ))}
              </select>
            </label>
            <label>Amount (AFN)<input name="amount" type="number" min="1" step="1" required /></label>
            <label>Due date<input name="dueDate" type="date" required /></label>
            <label>Description<input name="description" maxLength={240} placeholder="Monthly tuition, transport…" /></label>
            <button className="admin-primary" disabled={busy}>Create draft invoice</button>
          </form>

          <form className="communication-reminder-form" onSubmit={saveReminderSettings}>
            <label>
              Fee reminders · days before due
              <input value={reminderText} onChange={(event) => setReminderText(event.target.value)} placeholder="7, 1" />
            </label>
            <button className="admin-secondary" disabled={busy}>Save reminder days</button>
          </form>
        </article>
      </div>

      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div><h2>Announcements</h2><p>Scheduled and published school communication</p></div>
        </div>
        <div className="academic-rows">
          {overview.announcements.map((item) => (
            <div className="academic-row communication-announcement-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.audienceScope}{item.audienceRole ? ` · ${item.audienceRole}` : ""}{item.classId ? " · class scoped" : ""}</span>
                <span>{new Date(item.publishAt).toLocaleString()} {item.archivedAt ? "· ARCHIVED" : ""}</span>
                <p>{item.content}</p>
              </div>
              {!item.archivedAt ? (
                <button className="admin-secondary" disabled={busy} onClick={() => void archiveAnnouncement(item.id)}>Archive</button>
              ) : null}
            </div>
          ))}
          {overview.announcements.length === 0 ? <p className="admin-copy">No announcements yet.</p> : null}
        </div>
      </article>

      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div><h2>Fee invoices & payments</h2><p>Payments are appended; reversals never overwrite the original transaction.</p></div>
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
                    <span>{item.studentCode} · {item.invoice.description || "School fee"} · due {item.invoice.dueDate}</span>
                  </div>
                  <strong>{item.invoice.status}</strong>
                </div>
                <div className="communication-money-grid">
                  <span>Amount <strong>AFN {item.invoice.amount}</strong></span>
                  <span>Paid <strong>AFN {item.paid}</strong></span>
                  <span>Outstanding <strong>AFN {item.outstanding}</strong></span>
                </div>

                <div className="admin-actions">
                  {item.invoice.status === "DRAFT" ? (
                    <button disabled={busy} onClick={() => void invoiceAction(item.invoice.id, "issue")}>Issue</button>
                  ) : null}
                  {!["PAID", "CANCELLED"].includes(item.invoice.status) && item.paid === 0 ? (
                    <button disabled={busy} onClick={() => void invoiceAction(item.invoice.id, "cancel")}>Cancel</button>
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
                      placeholder="Amount"
                    />
                    <input
                      value={draft.method}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({
                          ...current,
                          [item.invoice.id]: { ...draft, method: event.target.value }
                        }))
                      }
                      placeholder="Method · CASH"
                    />
                    <input
                      value={draft.reference}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({
                          ...current,
                          [item.invoice.id]: { ...draft, reference: event.target.value }
                        }))
                      }
                      placeholder="Reference (optional)"
                    />
                    <button
                      className="admin-primary"
                      disabled={busy || !draft.amount || !draft.method.trim()}
                      onClick={() => void recordPayment(item.invoice.id)}
                    >
                      Record payment
                    </button>
                  </div>
                ) : null}

                {item.payments.length > 0 ? (
                  <div className="communication-payment-history">
                    {item.payments.map((payment) => (
                      <div key={payment.id} className="communication-payment-row">
                        <div>
                          <strong>{payment.kind} · AFN {payment.amount}</strong>
                          <span>{payment.method} · {new Date(payment.recordedAt).toLocaleString()}</span>
                          {payment.transactionReference ? <span>Ref: {payment.transactionReference}</span> : null}
                          {payment.reversalReason ? <span>Reason: {payment.reversalReason}</span> : null}
                        </div>
                        {payment.kind === "PAYMENT" && !reversedPaymentIds.has(payment.id) ? (
                          <div className="communication-reversal">
                            <input
                              value={reversalReason[payment.id] ?? ""}
                              onChange={(event) => setReversalReason((current) => ({ ...current, [payment.id]: event.target.value }))}
                              placeholder="Reversal reason"
                            />
                            <button disabled={busy} onClick={() => void reversePayment(payment.id)}>Reverse</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {overview.invoices.length === 0 ? <p className="admin-copy">No fee invoices yet.</p> : null}
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
