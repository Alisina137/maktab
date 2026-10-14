"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adminErrorText, adminFormat, adminText, type AdminLocale } from "./admin-i18n";
import { formatAdminHijriDateTime } from "./admin-hijri-date-picker";

type EvidenceCategory = "CROSS_ROLE" | "DATABASE" | "BACKUP_RESTORE" | "NOTIFICATIONS_JOBS" | "ACCESSIBILITY_RTL";
type Evidence = { id: string; category: EvidenceCategory; reference: string; note: string;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED"; reviewedBy: string | null;
  reviewNote: string | null; updatedAt: string; };
type Decision = { status: "APPROVED" | "NOT_APPROVED"; operatorLabel: string | null;
  note: string | null; reviewedAt: string | null; };
type History = { id: string; status: string; operatorLabel: string; note: string; createdAt: string };
type LaunchOverview = {
  evidence: Evidence[]; decision: Decision | null; decisionHistory: History[];
  verifiedCount: number; totalRequired: number; openCriticalTickets: number;
  effectiveApproved: boolean;
};
type SupportTicket = { id: string; subject: string; description: string; category: string;
  priority: "NORMAL" | "HIGH" | "CRITICAL"; status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string; updatedAt: string; };
type SupportUpdate = { id: string; authorKind: string; note: string; createdAt: string; statusAfter: string | null };
type SupportPage = { tickets: SupportTicket[]; hasMore: boolean; offset: number; limit: number };
const categories: EvidenceCategory[] = [
  "CROSS_ROLE", "DATABASE", "BACKUP_RESTORE", "NOTIFICATIONS_JOBS", "ACCESSIBILITY_RTL"
];
const categoryNames: Record<EvidenceCategory, string> = {
  CROSS_ROLE: "Four-role journey verification",
  DATABASE: "Live database and migration proof",
  BACKUP_RESTORE: "Encrypted backup and restore evidence",
  NOTIFICATIONS_JOBS: "Push delivery, scheduler and monitoring proof",
  ACCESSIBILITY_RTL: "Device accessibility and RTL evidence"
};
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function PilotLaunchSupportPanel({ accessToken, locale, setupReady }: {
  accessToken: string; locale: AdminLocale; setupReady: boolean;
}) {
  const t = (value: string) => adminText(locale, value);
  const sessionVersion = useRef(0);
  const [overview, setOverview] = useState<LaunchOverview | null>(null);
  const [tickets, setTickets] = useState<SupportPage | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<{ ticket: SupportTicket; updates: SupportUpdate[] } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EvidenceCategory>("CROSS_ROLE");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [issueCategory, setIssueCategory] = useState("TECHNICAL");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "CRITICAL">("NORMAL");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offset, setOffset] = useState(0);

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(API_URL + path, {
      ...options,
      headers: { Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers },
      signal: signal ?? options.signal, cache: "no-store"
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message ?? "Pilot request failed.");
    return body as T;
  }, [accessToken]);

  const load = useCallback(async (pageOffset: number, signal?: AbortSignal) => {
    const [launchResult, supportResult] = await Promise.all([
      request<LaunchOverview>("/v1/admin/pilot/launch", {}, signal),
      request<SupportPage>("/v1/admin/pilot/support?limit=10&offset=" + pageOffset, {}, signal)
    ]);
    if (!signal?.aborted) {
      setOverview(launchResult);
      setTickets(supportResult);
      setOffset(pageOffset);
    }
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    sessionVersion.current += 1;
    setOverview(null); setTickets(null); setSelectedTicket(null);
    setReference(""); setNote(""); setSubject(""); setDescription(""); setReply("");
    setError(""); setNotice(""); setLoading(true); setSaving(false);
    void load(0, controller.signal).catch((cause) => {
      if (!controller.signal.aborted) setError(adminErrorText(locale, cause, "Could not load launch or support data."));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => { controller.abort(); sessionVersion.current += 1; };
  }, [load, locale]);

  async function mutate(path: string, method: string, payload: Record<string, unknown>, after: () => void) {
    const session = sessionVersion.current;
    setError(""); setNotice(""); setSaving(true);
    try {
      await request(path, { method, body: JSON.stringify(payload) });
      if (session !== sessionVersion.current) return;
      after();
      setSelectedTicket(null);
      await load(0);
      if (session === sessionVersion.current) setNotice(t("Saved. The platform must review launch evidence and approval."));
    } catch (cause) {
      if (session === sessionVersion.current) setError(adminErrorText(locale, cause, "Pilot request failed."));
    } finally {
      if (session === sessionVersion.current) setSaving(false);
    }
  }

  async function viewTicket(ticketId: string) {
    const session = sessionVersion.current;
    setError("");
    try {
      const result = await request<{ ticket: SupportTicket; updates: SupportUpdate[] }>(
        "/v1/admin/pilot/support/" + encodeURIComponent(ticketId)
      );
      if (session === sessionVersion.current) setSelectedTicket(result);
    } catch (cause) {
      if (session === sessionVersion.current) setError(adminErrorText(locale, cause, "Could not load support ticket."));
    }
  }

  const selectedEvidence = overview?.evidence.find((item) => item.category === selectedCategory);
  const approved = overview?.effectiveApproved === true;
  const staleApproval = overview?.decision?.status === "APPROVED" && !approved;
  const verified = overview?.verifiedCount ?? 0;

  return (
    <section className="pilot-workflow" aria-label={t("Launch and support workflow")}>
      <header className="pilot-section-heading">
        <h3>{t("Launch evidence and support")}</h3>
        <p>{t("Evidence submissions are requests for operator review, not verified proof or automatic launch approval.")}</p>
      </header>
      {error ? <div role="alert" className="admin-error">{error}</div> : null}
      {notice ? <p role="status" className="pilot-badge pilot-badge-ok">{notice}</p> : null}
      {loading ? <div className="admin-panel" role="status">{t("Loading launch and support status…")}</div> : null}
      {overview ? (
        <>
          <div className="pilot-workflow-grid">
            <article className="admin-panel pilot-launch-status">
              <span className="eyebrow">{t("Platform launch decision")}</span>
              <h3>{t(approved ? "Approved by platform operator" : staleApproval ? "Approval requires revalidation" : "Not approved for launch")}</h3>
              <span className={"pilot-badge " + (approved ? "pilot-badge-ok" : "pilot-badge-warning")}>
                {t(approved ? "APPROVED" : "NOT_APPROVED")}
              </span>
              <p>{adminFormat(locale, "{done} of {total} evidence categories verified", {
                done: verified, total: overview.totalRequired
              })}</p>
              <progress value={verified} max={overview.totalRequired} aria-label={t("Verified launch evidence")} />
              {!setupReady ? <p className="pilot-security-note">{t("Automated configuration readiness has not passed. Operator approval also requires verified evidence.")}</p> : null}
              {overview.openCriticalTickets > 0 ? (
                <p className="pilot-security-note">{adminFormat(locale, "{count} unresolved critical support tickets block approval", {
                  count: overview.openCriticalTickets
                })}</p>
              ) : null}
              {overview.decision?.reviewedAt ? (
                <p>{formatAdminHijriDateTime(locale, overview.decision.reviewedAt)} · {overview.decision.operatorLabel}</p>
              ) : null}
              {overview.decision?.note ? <p>{overview.decision.note}</p> : null}
              <p className="pilot-security-note">{t("Only an authorized platform operator can verify evidence or approve the school. Production release acceptance remains a separate operational gate.")}</p>
              <Link className="pilot-inline-link" href="/admin/pilot/readiness">{t("View readiness")}</Link>
            </article>

            <article className="admin-panel pilot-workflow-evidence">
              <h3>{t("Evidence checklist")}</h3>
              <div className="pilot-workflow-checks">
                {categories.map((category) => {
                  const record = overview.evidence.find((item) => item.category === category);
                  return (
                    <div className="pilot-workflow-check" key={category}>
                      <div>
                        <strong>{t(categoryNames[category])}</strong>
                        {record ? <p>{formatAdminHijriDateTime(locale, record.updatedAt)}</p> : null}
                      </div>
                      <span className={"pilot-badge " + (record?.status === "VERIFIED" ? "pilot-badge-ok" : "pilot-badge-warning")}>
                        {t(record?.status ?? "NOT_SUBMITTED")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
          <article className="admin-panel pilot-workflow-submit">
            <h3>{t("Submit launch evidence")}</h3>
            <p>{t("Record a secure evidence reference and summary. Never include passwords, tokens, student personal data or confidential backup files.")}</p>
            <form onSubmit={(event) => {
              event.preventDefault();
              void mutate("/v1/admin/pilot/launch/evidence", "PUT", {
                category: selectedCategory, reference: reference.trim(), note: note.trim()
              }, () => { setReference(""); setNote(""); });
            }}>
              <label>{t("Verification area")}
                <select value={selectedCategory} disabled={saving} onChange={(event) => {
                  setSelectedCategory(event.target.value as EvidenceCategory); setReference(""); setNote("");
                }}>
                  {categories.map((cat) => <option key={cat} value={cat}>{t(categoryNames[cat])}</option>)}
                </select>
              </label>
              {selectedEvidence ? (
                <div className="pilot-workflow-submission">
                  <span className="pilot-badge pilot-badge-warning">{t(selectedEvidence.status)}</span>
                  <p>{t("Current reference")}: <span dir="auto">{selectedEvidence.reference}</span></p>
                  <p>{selectedEvidence.note}</p>
                  {selectedEvidence.reviewNote ? <p>{t("Operator feedback")}: {selectedEvidence.reviewNote}</p> : null}
                </div>
              ) : null}
              <label>{t("Evidence reference")}
                <input required minLength={5} maxLength={500} value={reference} disabled={saving}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={t("Secure document identifier or reference link")} />
              </label>
              <label>{t("Evidence summary")}
                <textarea required minLength={10} maxLength={2000} rows={3} value={note} disabled={saving}
                  onChange={(event) => setNote(event.target.value)} />
              </label>
              <button className="admin-primary" type="submit" disabled={saving}>{t("Submit for platform review")}</button>
            </form>
          </article>
          {overview.decisionHistory.length ? (
            <details className="admin-panel pilot-workflow-history">
              <summary>{t("Launch decision history")}</summary>
              {overview.decisionHistory.map((item) => (
                <div key={item.id}>
                  <strong>{t(item.status)}</strong> · {item.operatorLabel} · {formatAdminHijriDateTime(locale, item.createdAt)}
                  <p>{item.note}</p>
                </div>
              ))}
            </details>
          ) : null}
        </>
      ) : null}

      <article className="admin-panel pilot-workflow-support">
        <div className="admin-section-header">
          <div>
            <h3>{t("Support tickets")}</h3>
            <p>{t("Report an operational issue, ask for assistance, and track the platform's response.")}</p>
          </div>
          <button className="admin-secondary" type="button" disabled={loading || saving}
            onClick={() => { setLoading(true); void load(0).catch((cause) =>
              setError(adminErrorText(locale, cause, "Could not load launch or support data.")))
              .finally(() => setLoading(false)); }}>{t("Refresh")}</button>
        </div>
        <form className="pilot-support-form" onSubmit={(event) => {
          event.preventDefault();
          void mutate("/v1/admin/pilot/support", "POST", {
            subject: subject.trim(), description: description.trim(), category: issueCategory, priority
          }, () => { setSubject(""); setDescription(""); setPriority("NORMAL"); });
        }}>
          <label>{t("Subject")}
            <input required minLength={5} maxLength={160} value={subject} disabled={saving}
              onChange={(event) => setSubject(event.target.value)} /></label>
          <label>{t("Issue category")}
            <select value={issueCategory} disabled={saving} onChange={(event) => setIssueCategory(event.target.value)}>
              {["ACCESS","ACADEMICS","DATA","BILLING","TECHNICAL","OTHER"].map((item) =>
                <option value={item} key={item}>{t(item)}</option>)}
            </select>
          </label>
          <label>{t("Priority")}
            <select value={priority} disabled={saving}
              onChange={(event) => setPriority(event.target.value as typeof priority)}>
              {["NORMAL","HIGH","CRITICAL"].map((item) =>
                <option value={item} key={item}>{t(item)}</option>)}
            </select>
          </label>
          <label className="pilot-support-description">{t("Description")}
            <textarea required minLength={10} maxLength={3000} rows={3} value={description} disabled={saving}
              onChange={(event) => setDescription(event.target.value)} /></label>
          <button className="admin-primary" type="submit" disabled={saving}>{t("Create support ticket")}</button>
        </form>
        <div className="pilot-support-list" aria-label={t("Submitted tickets")}>
          {tickets?.tickets.map((ticket) => (
            <button className="pilot-support-row" type="button" key={ticket.id}
              onClick={() => void viewTicket(ticket.id)} aria-expanded={selectedTicket?.ticket.id === ticket.id}>
              <span><strong>{ticket.subject}</strong><small>{formatAdminHijriDateTime(locale, ticket.createdAt)}</small></span>
              <span className="pilot-badge pilot-badge-warning">{t(ticket.priority)}</span>
              <span className="pilot-badge">{t(ticket.status)}</span>
            </button>
          ))}
          {tickets && tickets.tickets.length === 0 ? <p>{t("No support tickets yet.")}</p> : null}
        </div>
        {tickets ? (
          <div className="admin-actions pilot-support-pagination">
            <button type="button" className="admin-secondary" disabled={offset === 0 || saving}
              onClick={() => void load(Math.max(0, offset - tickets.limit))}>{t("Newer")}</button>
            <button type="button" className="admin-secondary" disabled={!tickets.hasMore || saving}
              onClick={() => void load(offset + tickets.limit)}>{t("Older")}</button>
          </div>
        ) : null}
        {selectedTicket ? (
          <section className="pilot-support-thread" aria-label={t("Support conversation")}>
            <div className="admin-section-header">
              <h3>{selectedTicket.ticket.subject}</h3>
              <button type="button" className="admin-secondary" onClick={() => setSelectedTicket(null)}>{t("Close")}</button>
            </div>
            <p>{selectedTicket.ticket.description}</p>
            {selectedTicket.updates.map((item) => (
              <div className="pilot-support-message" key={item.id}>
                <strong>{t(item.authorKind === "PLATFORM" ? "Platform support" : "School administrator")}</strong>
                <span>{formatAdminHijriDateTime(locale, item.createdAt)}</span>
                <p>{item.note}</p>
                {item.statusAfter ? <span className="pilot-badge">{t(item.statusAfter)}</span> : null}
              </div>
            ))}
            {selectedTicket.ticket.status !== "CLOSED" ? (
              <form onSubmit={(event) => {
                event.preventDefault();
                const ticketId = selectedTicket.ticket.id;
                void mutate("/v1/admin/pilot/support/" + ticketId + "/replies", "POST",
                  { note: reply.trim() }, () => { setReply(""); });
              }}>
                <label>{t("Reply to support")}
                  <textarea required minLength={2} maxLength={2000} rows={3} value={reply} disabled={saving}
                    onChange={(event) => setReply(event.target.value)} />
                </label>
                <button className="admin-secondary" disabled={saving} type="submit">{t("Send reply")}</button>
              </form>
            ) : <p>{t("This ticket is closed.")}</p>}
          </section>
        ) : null}
        <p className="pilot-security-note">{t("Ticket messages are visible to your school administrators and platform operators; do not submit credentials or private student records.")}</p>
      </article>
    </section>
  );
}
