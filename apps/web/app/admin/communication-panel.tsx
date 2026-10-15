"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { announcementDashboard, feeDashboard } from "./communication-overview-model";
import { invoiceReference, invoiceQuery, INVOICE_STATUSES, type AdminInvoiceStatus } from "./communication-invoices-model";
import { AdminFeeOperations, AdminFeeReceiptButton } from "./admin-fee-operations";
import { AdminFeeFinancialReports } from "./admin-fee-financial-reports";
import { AdminNotificationMonitor } from "./admin-notification-monitor";
import { ANNOUNCEMENT_PAGE_SIZE, announcementStatus, findAnnouncements,
  pageAnnouncements, schoolLocalTimeToIso,
  type AnnouncementAudienceFilter, type AnnouncementStatusFilter
} from "./communication-announcements-model";
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
    invoiceNumber: number;
    updatedAt: string;
    createdAt: string;
    issuedAt: string | null;
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
  academicYears: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; code: string; name: string; academicYearId: string }>;
};

function request<T>(accessToken: string, path: string, init?: RequestInit) {
  return adminApi<T>(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
  });
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
  const [feesModule, setFeesModule] = useState<"INVOICES" | "PAYMENTS" | "BALANCES" | "REPORTS">("INVOICES");
  const feeModuleRefs = useRef<Partial<Record<"INVOICES" | "PAYMENTS" | "BALANCES" | "REPORTS", HTMLButtonElement | null>>>({});
  const [feeSearch, setFeeSearch] = useState("");
  const [feeStatus, setFeeStatus] = useState<AdminInvoiceStatus>("ALL");
  const [feeClassId, setFeeClassId] = useState("");
  const [feeAcademicYearId, setFeeAcademicYearId] = useState("");
  const [feeStudentId, setFeeStudentId] = useState("");
  const [feePage, setFeePage] = useState(1);
  const [feeReloadKey, setFeeReloadKey] = useState(0);
  const [feeListing, setFeeListing] = useState<{
    invoices: InvoiceView[]; total: number; page: number; pageSize: number
  } | null>(null);
  const [feeListingStatus, setFeeListingStatus] = useState<ResourceStatus>("idle");
  const [feeListingError, setFeeListingError] = useState("");
  const feeGeneration = useRef(0);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceView | null>(null);
  const [editFeeStudentId, setEditFeeStudentId] = useState("");
  const [editFeeAmount, setEditFeeAmount] = useState("");
  const [editFeeDueDate, setEditFeeDueDate] = useState("");
  const [editFeeDescription, setEditFeeDescription] = useState("");
  useEffect(() => {
    feeModuleRefs.current[feesModule]?.scrollIntoView({ behavior:"smooth", block:"nearest", inline:"nearest" });
  }, [feesModule]);
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
  const [targetClassId, setTargetClassId] = useState("");
  const [targetRole, setTargetRole] = useState<AudienceRole | "">("");
  const [publishMode, setPublishMode] = useState<"NOW" | "SCHEDULE">("NOW");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [schoolTimezone, setSchoolTimezone] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [recipientStatus, setRecipientStatus] = useState<ResourceStatus>("idle");
  const [recipientError, setRecipientError] = useState("");
  const [recipientRetryKey, setRecipientRetryKey] = useState(0);
  const recipientGeneration = useRef(0);
  const [announcementClock, setAnnouncementClock] = useState(() => Date.now());
  const [announcementSearch, setAnnouncementSearch] = useState("");
  const [announcementStatusFilter, setAnnouncementStatusFilter] = useState<AnnouncementStatusFilter>("ALL");
  const [announcementAudienceFilter, setAnnouncementAudienceFilter] = useState<AnnouncementAudienceFilter>("ALL");
  const [announcementClassFilter, setAnnouncementClassFilter] = useState("");
  const [announcementLimit, setAnnouncementLimit] = useState(ANNOUNCEMENT_PAGE_SIZE);
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editPublishAt, setEditPublishAt] = useState("");
  const [reminderDays, setReminderDays] = useState<number[]>([7, 1]);
  const [reminderCandidate, setReminderCandidate] = useState("14");
  const [paymentDraft, setPaymentDraft] = useState<Record<string, { amount: string; method: string; reference: string }>>({});
  // Keep the same key across a network timeout; changing the payment fields creates a new attempt.
  const paymentAttempts = useRef<Record<string, { signature: string; key: string }>>({});
  const [reversalReason, setReversalReason] = useState<Record<string, string>>({});

  useEffect(() => {
    setSection("OVERVIEW");
    setCommunicationPane("LIST");
    setFeesPane("LIST");
    setFeesModule("INVOICES");
    setFeeSearch(""); setFeeStatus("ALL"); setFeeClassId("");
    setFeeAcademicYearId(""); setFeeStudentId(""); setFeePage(1);
    setFeeListing(null); setFeeListingStatus("idle"); setFeeListingError("");
    setFeeReloadKey(0); feeGeneration.current += 1;
    setOpenInvoiceId(null); setEditingInvoice(null);
    setEditFeeStudentId(""); setEditFeeAmount(""); setEditFeeDueDate("");
    setEditFeeDescription("");
    setEditingNotice(null);
    setEditTitle("");
    setEditMessage("");
    setEditPublishAt("");
    setScope("SCHOOL"); setTargetClassId(""); setTargetRole("");
    setPublishMode("NOW"); setScheduledLocal(""); setSchoolTimezone(null);
    setRecipientCount(null); setRecipientStatus("idle"); setRecipientError("");
    setAnnouncementSearch(""); setAnnouncementStatusFilter("ALL");
    setAnnouncementAudienceFilter("ALL"); setAnnouncementClassFilter("");
    setAnnouncementLimit(ANNOUNCEMENT_PAGE_SIZE); setExpandedAnnouncementId(null);
    setNewTitle(""); setNewContent(""); recipientGeneration.current += 1;
    setPaymentDraft({});
    paymentAttempts.current = {};
    setReversalReason({});
    setNotice("");
    setError("");
    setBusy(false);
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
    const generation = ++recipientGeneration.current;
    const token = accessToken;
    if (scope === "CLASS" && !targetClassId) {
      setRecipientCount(null); setRecipientStatus("idle"); setRecipientError("");
      return;
    }
    setRecipientCount(null);
    setRecipientStatus("loading");
    const timer = window.setTimeout(() => {
      void request<{recipientCount:number;schoolTimezone:string}>(
        token, "/v1/admin/announcements/recipients/preview", {
          method: "POST",
          body: JSON.stringify({
            audienceScope: scope,
            ...(scope === "CLASS" ? { classId: targetClassId } : {}),
            ...(scope !== "SCHOOL" && targetRole ? { audienceRole: targetRole } : {})
          })
        }
      ).then(result => {
        if (accessRef.current !== token || generation !== recipientGeneration.current) return;
        setSchoolTimezone(result.schoolTimezone);
        setRecipientCount(result.recipientCount);
        setRecipientStatus("ready"); setRecipientError("");
      }).catch(cause => {
        if (accessRef.current !== token || generation !== recipientGeneration.current) return;
        setRecipientStatus("error");
        setRecipientError(adminErrorText(locale, cause, "Could not preview recipients."));
      });
    }, 300);
    return () => { window.clearTimeout(timer); recipientGeneration.current += 1; };
  }, [accessToken, scope, targetClassId, targetRole, locale, recipientRetryKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setAnnouncementClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setAnnouncementLimit(ANNOUNCEMENT_PAGE_SIZE);
  }, [announcementSearch, announcementStatusFilter,
      announcementAudienceFilter, announcementClassFilter]);

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
        setReminderDays(data.feeReminderDays);
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

  useEffect(() => {
    setFeePage(1);
    setOpenInvoiceId(null);
    setEditingInvoice(null);
  }, [feeSearch, feeStatus, feeClassId, feeAcademicYearId, feeStudentId]);

  useEffect(() => {
    if (section !== "FEES") return;
    const generation = ++feeGeneration.current;
    const token = accessToken;
    const params = invoiceQuery({
      q: feeSearch, status: feeStatus, classId: feeClassId,
      academicYearId: feeAcademicYearId, studentId: feeStudentId, page: feePage
    });
    setFeeListingStatus("loading");
    setFeeListingError("");
    const timer = window.setTimeout(() => {
      void request<{ invoices: InvoiceView[]; total: number; page: number; pageSize: number }>(
        token, "/v1/admin/fees/invoices?" + params
      ).then(result => {
        if (accessRef.current !== token || generation !== feeGeneration.current) return;
        setFeeListing(result);
        setFeeListingStatus("ready");
      }).catch(cause => {
        if (accessRef.current !== token || generation !== feeGeneration.current) return;
        setFeeListingStatus("error");
        setFeeListingError(adminErrorText(locale,cause,"Could not load fee invoices."));
      });
    }, feeSearch.trim() ? 280 : 0);
    return () => {
      clearTimeout(timer);
      feeGeneration.current++;
    };
  }, [section,accessToken,feeSearch,feeStatus,feeClassId,feeAcademicYearId,
      feeStudentId,feePage,feeReloadKey]);

  function refreshInvoiceViews() {
    void loadResource("communication");
    setFeeReloadKey(value => value + 1);
  }

  function openDraftEditor(item: InvoiceView) {
    setEditingInvoice(item);
    setOpenInvoiceId(item.invoice.id);
    setEditFeeStudentId(item.invoice.studentId);
    setEditFeeAmount(String(item.invoice.amount));
    setEditFeeDueDate(item.invoice.dueDate);
    setEditFeeDescription(item.invoice.description ?? "");
  }

  async function updateDraftInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingInvoice || editingInvoice.invoice.status !== "DRAFT") return;
    const item = editingInvoice;
    setBusy(true); setError(""); setNotice("");
    try {
      await request(accessToken,`/v1/admin/fees/invoices/${item.invoice.id}`,{
        method:"PATCH",
        body: JSON.stringify({
          studentId:editFeeStudentId,amount:Number(editFeeAmount),
          dueDate:editFeeDueDate,description:editFeeDescription.trim(),
          expectedUpdatedAt:new Date(item.invoice.updatedAt).toISOString()
        })
      });
      if(accessRef.current!==accessToken)return;
      setEditingInvoice(null);
      setNotice(t("Draft invoice updated successfully."));
      refreshInvoiceViews();
    } catch(cause) {
      if(accessRef.current!==accessToken)return;
      setError(adminErrorText(locale,cause,"Could not edit draft invoice."));
    } finally {
      if(accessRef.current===accessToken)setBusy(false);
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      if (scope === "CLASS" && !targetClassId) throw new Error(t("Select a class before publishing."));
      if (scope === "ROLE" && !targetRole) throw new Error(t("Choose a recipient role."));
      if (publishMode === "SCHEDULE" && (!schoolTimezone || recipientStatus !== "ready")) {
        throw new Error(t("School timezone unavailable. Retry recipient preview before scheduling."));
      }
      const publishAt = publishMode === "SCHEDULE"
        ? schoolLocalTimeToIso(scheduledLocal, schoolTimezone!)
        : undefined;
      if (publishAt && Date.parse(publishAt) <= Date.now()) {
        throw new Error(t("Scheduled publication must be in the future."));
      }
      await request(accessToken, "/v1/admin/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          content: String(form.get("content") ?? "").trim(),
          audienceScope: scope,
          classId: scope === "CLASS" ? targetClassId : undefined,
          audienceRole: scope === "ROLE" || scope === "CLASS" ? targetRole || undefined : undefined,
          publishAt
        })
      });
      if (accessRef.current !== accessToken) return;
      setNotice(t("Announcement saved. Its audience is enforced by the API."));
      formElement.reset();
      setNewTitle(""); setNewContent("");
      setScope("SCHOOL"); setTargetClassId(""); setTargetRole("");
      setPublishMode("NOW"); setScheduledLocal("");
      setCommunicationPane("LIST");
      await loadResource("communication");
    } catch (cause) {
      if (accessRef.current !== accessToken) return;
      setError(cause instanceof Error && !(cause instanceof DOMException) &&
        !(cause as Error & {status?:number}).status ? cause.message
        : adminErrorText(locale, cause, "Could not create announcement."));
    } finally {
      if (accessRef.current === accessToken) setBusy(false);
    }
  }

  async function saveScheduledEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingNotice) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editPublishAt && !schoolTimezone) {
        throw new Error(t("School timezone unavailable. Retry recipient preview before scheduling."));
      }
      if (editPublishAt &&
          Date.parse(schoolLocalTimeToIso(editPublishAt, schoolTimezone!)) <= Date.now()) {
        throw new Error(t("Scheduled publication must be in the future."));
      }
      await request(accessToken, `/v1/admin/announcements/${editingNotice.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(), content: editMessage.trim(),
          ...(editPublishAt ? { publishAt: schoolLocalTimeToIso(
            editPublishAt, schoolTimezone!) } : {})
        })
      });
      if (accessRef.current !== accessToken) return;
      setEditingNotice(null);
      setNotice(t("Scheduled announcement updated."));
      await loadResource("communication");
    } catch (cause) {
      if (accessRef.current !== accessToken) return;
      setError(adminErrorText(locale, cause, "Could not update scheduled announcement."));
    } finally {
      if (accessRef.current === accessToken) setBusy(false);
    }
  }

  async function archiveAnnouncement(id: string) {
    if (!window.confirm(t("Archive this announcement? It will disappear from current recipient views, but already-sent push messages cannot be recalled."))) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, `/v1/admin/announcements/${id}/archive`, { method: "POST" });
      if (accessRef.current !== accessToken) return;
      setNotice(t("Announcement archived."));
      await loadResource("communication");
    } catch (cause) {
      if (accessRef.current !== accessToken) return;
      setError(adminErrorText(locale, cause, "Could not archive announcement."));
    } finally {
      if (accessRef.current === accessToken) setBusy(false);
    }
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      if (accessRef.current !== accessToken) return;
      setNotice(t("Fee invoice created in DRAFT state."));
      formElement.reset();
      refreshInvoiceViews();
    } catch (cause) {
      if (accessRef.current !== accessToken) return;
      setError(adminErrorText(locale, cause, "Could not create fee invoice."));
    } finally {
      if (accessRef.current === accessToken) setBusy(false);
    }
  }

  async function invoiceAction(id: string, action: "issue" | "cancel") {
    if (!window.confirm(t(action === "issue"
      ? "Issue this draft invoice to the family? This action cannot be undone."
      : "Cancel this invoice? This action cannot be undone."))) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, `/v1/admin/fees/invoices/${id}/${action}`, { method: "POST" });
      if (accessRef.current !== accessToken) return;
      setNotice(t(action === "issue" ? "Invoice issued to the family." : "Invoice cancelled."));
      refreshInvoiceViews();
    } catch (cause) {
      if (accessRef.current !== accessToken) return;
      setError(adminErrorText(locale, cause, "Fee invoice action failed."));
    } finally {
      if (accessRef.current === accessToken) setBusy(false);
    }
  }

  async function recordPayment(invoiceId: string, outstanding: number, studentName: string, reference: string) {
    const draft = paymentDraft[invoiceId] ?? { amount: "", method: "CASH", reference: "" };
    const amount = Number(draft.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > outstanding) {
      setError(t("Payment amount must be a whole AFN value within the outstanding balance."));
      return;
    }
    if (!["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"].includes(draft.method)) {
      setError(t("Choose a valid payment method."));
      return;
    }
    if (!window.confirm(adminFormat(locale,
      "Record {amount} for {student} ({invoice}) using {method}? Remaining after payment: {remaining}. This records an immutable transaction.", {
        amount: new Intl.NumberFormat(locale).format(amount) + " " + t("AFN"),
        student: studentName, invoice: reference,
        method: t(draft.method), remaining: new Intl.NumberFormat(locale).format(outstanding - amount) + " " + t("AFN")
      }))) return;
    const signature = JSON.stringify([amount, draft.method, draft.reference.trim()]);
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
          amount, method: draft.method,
          transactionReference: draft.reference.trim() || undefined,
          idempotencyKey
        })
      });
      if (accessRef.current !== accessToken) return;
      delete paymentAttempts.current[invoiceId];
      setPaymentDraft((current) => ({ ...current, [invoiceId]: { amount: "", method: "CASH", reference: "" } }));
      setNotice(t("Payment recorded as an immutable transaction."));
      refreshInvoiceViews();
    } catch (cause) {
      if (accessRef.current !== accessToken) return;
      setError(adminErrorText(locale, cause, "Could not record payment."));
    } finally {
      if (accessRef.current === accessToken) setBusy(false);
    }
  }

  async function reversePayment(paymentId: string) {
    const reason = reversalReason[paymentId]?.trim() ?? "";
    if (!reason) {
      setError(t("Enter a reversal reason first."));
      return;
    }
    if (!window.confirm(adminFormat(locale,
      "Reverse this recorded payment? Reason: {reason}. The original payment remains in the ledger and the balance will be recalculated.", {
        reason
      }))) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, `/v1/admin/fees/payments/${paymentId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason })
      });
      if (accessRef.current !== accessToken) return;
      setReversalReason((current) => ({ ...current, [paymentId]: "" }));
      setNotice(t("Payment reversed with a separate immutable reversal transaction."));
      refreshInvoiceViews();
    } catch (cause) {
      if (accessRef.current !== accessToken) return;
      setError(adminErrorText(locale, cause, "Could not reverse payment."));
    } finally {
      if (accessRef.current === accessToken) setBusy(false);
    }
  }

  function addReminderDay() {
    const candidate = Number(reminderCandidate);
    if (!reminderCandidate.trim() || !Number.isSafeInteger(candidate) || candidate < 1 || candidate > 90) {
      setError(t("Enter a whole number from 1 to 90 days."));
      return;
    }
    if (reminderDays.includes(candidate)) {
      setError(t("That reminder day is already selected."));
      return;
    }
    if (reminderDays.length >= 6) {
      setError(t("You can select up to six reminder days."));
      return;
    }
    setReminderDays(current => [...current, candidate].sort((a, b) => b - a));
    setReminderCandidate("");
    setError("");
  }

  async function saveReminderSettings(event: FormEvent) {
    event.preventDefault();
    if (reminderDays.length < 1 || reminderDays.length > 6 ||
        reminderDays.some(day => !Number.isSafeInteger(day) || day < 1 || day > 90)) {
      setError(t("Select between one and six valid reminder days."));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request<{ daysBeforeDue: number[] }>(accessToken, "/v1/admin/fees/reminder-settings", {
        method: "PATCH",
        body: JSON.stringify({ daysBeforeDue: reminderDays })
      });
      if (accessRef.current !== accessToken) return;
      setReminderDays(result.daysBeforeDue);
      setNotice(t("Fee reminder days updated."));
      await loadResource("communication");
    } catch (cause) {
      if (accessRef.current !== accessToken) return;
      setError(adminErrorText(locale, cause, "Could not update fee reminder settings."));
    } finally {
      if (accessRef.current === accessToken) setBusy(false);
    }
  }

  const activeStudents = visibleFamilies?.students.filter(item => item.student.status === "ACTIVE") ?? [];
  const money = useMemo(() => feeDashboard(visibleOverview?.invoices ?? []), [visibleOverview]);
  const notices = useMemo(() => announcementDashboard(
    visibleOverview?.announcements ?? [], new Date()
  ), [visibleOverview]);

  const announcementDate = (instant: string) => schoolTimezone
    ? formatAdminHijriDateTime(locale, instant, schoolTimezone)
    : `${formatAdminHijriDateTime(locale, instant, "UTC")} UTC`;
  const announcementMatches = useMemo(() => findAnnouncements(
    visibleOverview?.announcements ?? [],
    { search: announcementSearch, status: announcementStatusFilter,
      audience: announcementAudienceFilter, classId: announcementClassFilter }, announcementClock
  ), [visibleOverview, announcementSearch, announcementStatusFilter,
      announcementAudienceFilter, announcementClassFilter, announcementClock]);
  const announcementPage = pageAnnouncements(announcementMatches, announcementLimit);
  const classLabel = (id: string | null) => id
    ? visibleAcademics?.classes.find(row => row.id === id)?.name ?? t("Unknown class")
    : "";
  function showAnnouncement(id: string) {
    setSection("COMMUNICATION");
    setCommunicationPane("LIST");
    setAnnouncementSearch(""); setAnnouncementStatusFilter("ALL");
    setAnnouncementAudienceFilter("ALL"); setAnnouncementClassFilter("");
    setExpandedAnnouncementId(id); setAnnouncementLimit(ANNOUNCEMENT_PAGE_SIZE);
  }
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
        ) : <AdminLoader compact label={t(section === "OVERVIEW" ? "Loading overview data…" : section === "COMMUNICATION" ? "Loading communication data…" : "Loading fees data…")} />}
      </div>
    );
  }



  const formatCount = (value: number) => new Intl.NumberFormat(locale).format(value);
  const formatMoney = (value: number) => `${formatCount(value)} ${t("AFN")}`;

  return (
    <section className="communication-section admin-page-enter">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Communication & fees workspace")}</span>
          <h2>{t("School-family communication & fee management")}</h2>
          <p>{t("Review announcements and issued school fees without mixing creation, records, and balances.")}</p>
        </div>
        <button className="admin-secondary" type="button" disabled={busy}
          onClick={() => {
            void loadResource("communication");
            void loadResource("families");
            void loadResource("academics");
          }}>{t("Refresh all")}</button>
      </div>

      <nav className="communication-main-tabs" role="tablist" aria-label={t("Communication & fees sections")} dir={locale === "en" ? "ltr" : "rtl"}>
        {([
          ["OVERVIEW", "Overview"],
          ["COMMUNICATION", "Communication"],
          ["FEES", "Fees"]
        ] as Array<[Section,string]>).map(([key,label]) => (
          <button type="button" key={key}
            ref={element => { sectionRefs.current[key] = element; }}
            role="tab" aria-selected={section === key}
            aria-controls={`communication-panel-${key.toLowerCase()}`}
            id={`communication-tab-${key.toLowerCase()}`}
            tabIndex={section === key ? 0 : -1}
            className={section === key ? "communication-main-tab is-active" : "communication-main-tab"}
            onKeyDown={event => {
              const keys: Section[] = ["OVERVIEW", "COMMUNICATION", "FEES"];
              const index = keys.indexOf(key);
              const forward = locale === "en" ? "ArrowRight" : "ArrowLeft";
              const backward = locale === "en" ? "ArrowLeft" : "ArrowRight";
              let target = -1;
              if (event.key === "Home") target = 0;
              else if (event.key === "End") target = keys.length - 1;
              else if (event.key === forward) target = (index + 1) % keys.length;
              else if (event.key === backward) target = (index - 1 + keys.length) % keys.length;
              if (target !== -1) {
                event.preventDefault();
                const next = keys[target]!;
                setSection(next);
                sectionRefs.current[next]?.focus();
              }
            }}
            onClick={() => setSection(key)}>{t(label)}</button>
        ))}
      </nav>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      {section === "OVERVIEW" ? (
        <section id="communication-panel-overview" role="tabpanel"
          aria-labelledby="communication-tab-overview" className="communication-tab-panel">
          {ready && visibleOverview ? (
            <>
              <div className="communication-dashboard-group">
                <div className="communication-dashboard-heading">
                  <h3>{t("Communication overview")}</h3>
                  <button type="button" className="admin-secondary"
                    onClick={() => setSection("COMMUNICATION")}>{t("View announcements")}</button>
                </div>
                <div className="academic-summary-grid communication-overview-grid">
                  <Summary label={t("Total announcements")} value={formatCount(notices.total)} />
                  <Summary label={t("Published announcements")} value={formatCount(notices.published)} />
                  <Summary label={t("Scheduled announcements")} value={formatCount(notices.scheduled)} />
                  <Summary label={t("Archived announcements")} value={formatCount(notices.archived)} />
                </div>
              </div>
              <div className="communication-dashboard-group">
                <div className="communication-dashboard-heading">
                  <h3>{t("Financial overview")}</h3>
                  <button type="button" className="admin-secondary"
                    onClick={() => setSection("FEES")}>{t("View fee invoices")}</button>
                </div>
                <p className="admin-copy">{t("Issued school invoices only. Drafts and cancelled invoices do not count toward balances.")}</p>
                <div className="academic-summary-grid communication-overview-grid">
                  <Summary label={t("Issued invoices")} value={formatCount(money.issuedInvoices)} />
                  <Summary label={t("Billed AFN")} value={formatMoney(money.billed)} />
                  <Summary label={t("Paid AFN")} value={formatMoney(money.paid)} />
                  <Summary label={t("Outstanding AFN")} value={formatMoney(money.outstanding)} />
                  <Summary label={t("Overdue AFN")} value={formatMoney(money.overdue)} />
                  <Summary label={t("Students with outstanding fees")} value={formatCount(money.owingStudents)} />
                  <Summary label={t("Collection rate")} value={money.collectionRate === null
                    ? "—" : `${formatCount(Math.round(money.collectionRate))}%`} />
                </div>
              </div>
              <div className="communication-overview-recent">
                <article className="admin-panel communication-recent-card">
                  <h3>{t("Recent announcements")}</h3>
                  {visibleOverview.announcements.slice(0, 4).map(item => (
                    <button type="button" className="communication-recent-row" key={item.id}
                      onClick={() => showAnnouncement(item.id)}>
                      <strong>{item.title}</strong>
                      <span>{t(item.archivedAt ? "ARCHIVED" :
                        Date.parse(item.publishAt) > Date.now() ? "SCHEDULED" : "PUBLISHED")}</span>
                    </button>
                  ))}
                  {!visibleOverview.announcements.length ? <p className="admin-copy">{t("No announcements yet.")}</p> : null}
                </article>
                <article className="admin-panel communication-recent-card">
                  <h3>{t("Recent fee invoices")}</h3>
                  {visibleOverview.invoices.slice(0, 4).map(item => (
                    <button type="button" className="communication-recent-row" key={item.invoice.id}
                      onClick={() => { setSection("FEES"); setFeesPane("LIST"); }}>
                      <strong>{item.studentName}</strong>
                      <span>{t(item.invoice.status)} · {formatMoney(item.outstanding)}</span>
                    </button>
                  ))}
                  {!visibleOverview.invoices.length ? <p className="admin-copy">{t("No fee invoices yet.")}</p> : null}
                </article>
              </div>
            </>
          ) : resourceNotice("communication")}
        </section>
      ) : null}

      {section === "COMMUNICATION" ? (
        <section id="communication-panel-communication" role="tabpanel"
          aria-labelledby="communication-tab-communication" className="communication-tab-panel">
          <div className="communication-dashboard-heading">
            <div>
              <h3>{t("Announcements")}</h3>
              <p>{t("Create and manage school, class, and role announcements.")}</p>
            </div>
            <button type="button" className="admin-secondary" onClick={() => void loadResource("communication")}>
              {t("Refresh announcements")}
            </button>
          </div>
          <AdminNotificationMonitor accessToken={accessToken} locale={locale} />
          <div className="communication-mobile-toggle" role="group" aria-label={t("Choose announcement workspace")}>
            <button type="button" className={communicationPane === "LIST" ? "is-active" : ""}
              aria-pressed={communicationPane === "LIST"}
              onClick={() => setCommunicationPane("LIST")}>{t("Announcement list")}</button>
            <button type="button" className={communicationPane === "FORM" ? "is-active" : ""}
              aria-pressed={communicationPane === "FORM"}
              onClick={() => setCommunicationPane("FORM")}>{t("Create announcement")}</button>
          </div>
          <div className="communication-workflow-layout" data-pane={communicationPane}>
            <div className="communication-workflow-form">
              <article className="admin-panel communication-form-card">
          <div><h2>{t("Create announcement")}</h2><p>{t("Every announcement has an explicit school, class, or role audience.")}</p></div>
          <form className="admin-form" onSubmit={createAnnouncement}>
            <label>{t("Title")}
              <input name="title" minLength={2} maxLength={160} required
                value={newTitle} onChange={event => setNewTitle(event.target.value)} />
            </label>
            <label>{t("Message")}
              <textarea name="content" rows={5} maxLength={10000} required
                value={newContent} onChange={event => setNewContent(event.target.value)} />
            </label>
            <label>{t("Audience")}
              <select value={scope} onChange={event => {
                const next = event.target.value as AnnouncementScope;
                setScope(next);
                setTargetClassId("");
                setTargetRole(next === "ROLE" ? "PARENT" : "");
              }}>
                <option value="SCHOOL">{t("Whole school")}</option>
                <option value="CLASS">{t("One class")}</option>
                <option value="ROLE">{t("One role")}</option>
              </select>
            </label>
            {scope === "CLASS" ? <>
              {resourceStatus.academics === "error" ? resourceNotice("academics") : null}
              <label>{t("Class")}
                <select value={targetClassId} required
                  disabled={resourceStatus.academics !== "ready"}
                  onChange={event => setTargetClassId(event.target.value)}>
                  <option value="">{t("Select class")}</option>
                  {(visibleAcademics?.classes ?? []).map(row => (
                    <option key={row.id} value={row.id}>{row.name} · {row.code}</option>
                  ))}
                </select>
              </label>
              <label>{t("Optional role within class")}
                <select value={targetRole}
                  onChange={event => setTargetRole(event.target.value as AudienceRole | "")}>
                  <option value="">{t("All roles in class")}</option>
                  <option value="PARENT">{t("Parents")}</option>
                  <option value="STUDENT">{t("Students")}</option>
                  <option value="TEACHER">{t("Teachers")}</option>
                </select>
              </label>
            </> : null}
            {scope === "ROLE" ? (
              <label>{t("Role")}
                <select value={targetRole} required
                  onChange={event => setTargetRole(event.target.value as AudienceRole)}>
                  <option value="PARENT">{t("Parents")}</option>
                  <option value="STUDENT">{t("Students")}</option>
                  <option value="TEACHER">{t("Teachers")}</option>
                </select>
              </label>
            ) : null}
            <div className="communication-preview" role="status" aria-live="polite">
              <strong>{t("Recipient preview")}</strong>
              {scope === "CLASS" && !targetClassId ? (
                <p>{t("Select a class to estimate recipients.")}</p>
              ) : recipientStatus === "loading" ? (
                <p>{t("Calculating recipients…")}</p>
              ) : recipientStatus === "error" ? (
                <>
                  <p role="alert">{recipientError}</p>
                  <button type="button" className="admin-secondary"
                    onClick={() => setRecipientRetryKey(key=>key+1)}>{t("Retry recipient preview")}</button>
                </>
              ) : recipientStatus === "ready" ? (
                <p>{new Intl.NumberFormat(locale).format(recipientCount ?? 0)} {t("eligible recipient accounts currently match.")}</p>
              ) : null}
              <small>{t("Current eligible accounts only. Scheduled recipients may change; preview does not prove push delivery.")}</small>
              {schoolTimezone ? <small>{t("School timezone")}: {schoolTimezone}</small> : null}
            </div>
            <fieldset className="communication-publish-choices">
              <legend>{t("Publication")}</legend>
              <label><input type="radio" name="publicationMode" value="NOW"
                checked={publishMode === "NOW"}
                onChange={() => setPublishMode("NOW")} />
                {t("Publish now")}</label>
              <label><input type="radio" name="publicationMode" value="SCHEDULE"
                checked={publishMode === "SCHEDULE"}
                onChange={() => setPublishMode("SCHEDULE")} />
                {t("Schedule publication")}</label>
            </fieldset>
            {publishMode === "SCHEDULE" ? (
              <label>{t("Publication date and school-local time")}
                <AdminHijriDatePicker locale={locale} includeTime required
                  value={scheduledLocal} onChange={setScheduledLocal} />
              </label>
            ) : null}
            <button className="admin-primary" disabled={busy ||
              (scope === "CLASS" && !targetClassId) ||
              (scope === "ROLE" && !targetRole) ||
              (publishMode === "SCHEDULE" && (!scheduledLocal ||
                !schoolTimezone || recipientStatus !== "ready"))}>
              {t(publishMode === "SCHEDULE" ? "Schedule announcement" : "Publish announcement")}
            </button>
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
              <p className="admin-copy">{t("Leave the date blank to keep the existing scheduled time.")}</p>
              <p className="admin-copy">{t("School timezone")}: {schoolTimezone ?? t("Checking school timezone…")}</p>
              <button className="admin-primary" disabled={busy || (!!editPublishAt && !schoolTimezone)}>
                {t("Save changes")}
              </button>
              <button type="button" className="admin-secondary"
                onClick={() => setEditingNotice(null)}>{t("Cancel")}</button>
            </form>
          </article>
        ) : null}


            </div>
            <div className="communication-workflow-list">
              {ready && visibleOverview ? (
                <>
      <article className="admin-panel academic-list-panel communication-announcement-list">
        <div className="admin-section-header">
          <div>
            <h2>{t("Announcements")}</h2>
            <p>{t("Published, scheduled and archived school notices.")}</p>
          </div>
        </div>
        <div className="communication-announcement-filters">
          <label>{t("Search announcements")}
            <input type="search" value={announcementSearch}
              placeholder={t("Search title or message")}
              onChange={event => setAnnouncementSearch(event.target.value)} />
          </label>
          <label>{t("Status")}
            <select value={announcementStatusFilter}
              onChange={event => setAnnouncementStatusFilter(event.target.value as AnnouncementStatusFilter)}>
              {(["ALL","PUBLISHED","SCHEDULED","ARCHIVED"] as AnnouncementStatusFilter[]).map(value=>(
                <option key={value} value={value}>{t(value === "ALL" ? "All statuses" : value)}</option>
              ))}
            </select>
          </label>
          <label>{t("Audience")}
            <select value={announcementAudienceFilter}
              onChange={event => setAnnouncementAudienceFilter(event.target.value as AnnouncementAudienceFilter)}>
              <option value="ALL">{t("All audiences")}</option>
              <option value="SCHOOL">{t("Whole school")}</option>
              <option value="CLASS">{t("One class")}</option>
              <option value="ROLE">{t("One role")}</option>
            </select>
          </label>
          <label>{t("Class")}
            <select value={announcementClassFilter}
              onChange={event => setAnnouncementClassFilter(event.target.value)}>
              <option value="">{t("All classes")}</option>
              {(visibleAcademics?.classes ?? []).map(row=>(
                <option key={row.id} value={row.id}>{row.name} · {row.code}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="admin-copy" role="status">
          {adminFormat(locale,"Showing {shown} of {total} matching announcements",{
            shown:new Intl.NumberFormat(locale).format(announcementPage.shown),
            total:new Intl.NumberFormat(locale).format(announcementPage.total)
          })}
        </p>
        <div className="academic-rows communication-announcement-items">
          {announcementPage.rows.map(item => {
            const open = expandedAnnouncementId === item.id;
            const status = announcementStatus(item, announcementClock);
            return (
              <div className="academic-row communication-announcement-row" key={item.id}>
                <div className="communication-announcement-row-head">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{t(item.audienceScope)}{item.audienceRole ?
                      ` · ${t(item.audienceRole)}` : ""}{item.classId ?
                      ` · ${classLabel(item.classId)}` : ""}</span>
                    <span>{announcementDate(item.publishAt)}
                      {" · "}{t(status)}</span>
                  </div>
                  <span className={`communication-announcement-status status-${status.toLowerCase()}`}>{t(status)}</span>
                </div>
                <p className={open ? "communication-announcement-full" : "communication-announcement-preview"}>
                  {item.content}
                </p>
                {open ? (
                  <dl className="communication-announcement-details">
                    <div><dt>{t("Audience")}</dt><dd>{t(item.audienceScope)}
                      {item.audienceRole ? ` · ${t(item.audienceRole)}` : ""}
                      {item.classId ? ` · ${classLabel(item.classId)}` : ""}</dd></div>
                    <div><dt>{t("Publication")}</dt>
                      <dd>{announcementDate(item.publishAt)}</dd></div>
                    <div><dt>{t("Status")}</dt><dd>{t(status)}</dd></div>
                    <div><dt>{t("Reference")}</dt><dd>{item.id}</dd></div>
                  </dl>
                ) : null}
                <div className="admin-actions">
                  <button className="admin-secondary" type="button"
                    aria-expanded={open} onClick={() => setExpandedAnnouncementId(open ? null : item.id)}>
                    {t(open ? "Hide details" : "View details")}
                  </button>
                  {status === "SCHEDULED" ? (
                    <button className="admin-secondary" type="button" disabled={busy}
                      onClick={() => {
                        setEditingNotice(item);
                        setEditTitle(item.title); setEditMessage(item.content);
                        setEditPublishAt(""); setCommunicationPane("FORM");
                      }}>{t("Edit")}</button>
                  ) : null}
                  {status !== "ARCHIVED" ? (
                    <button className="admin-secondary" type="button" disabled={busy}
                      onClick={() => void archiveAnnouncement(item.id)}>{t("Archive")}</button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!announcementPage.total ? (
            <p className="admin-copy">{t(visibleOverview.announcements.length===0 ?
              "No announcements yet." : "No announcements match your filters.")}</p>
          ) : null}
        </div>
        {announcementPage.hasMore ? (
          <button className="admin-secondary communication-more-button" type="button"
            onClick={() => setAnnouncementLimit(value=>value+ANNOUNCEMENT_PAGE_SIZE)}>
            {t("Load more announcements")}
          </button>
        ) : null}
      </article>


                </>
              ) : resourceNotice("communication")}
            </div>
          </div>
        </section>
      ) : null}

      {section === "FEES" ? (
        <section id="communication-panel-fees" role="tabpanel"
          aria-labelledby="communication-tab-fees" className="communication-tab-panel communication-fees-page">
          <div className="communication-dashboard-heading">
            <div>
              <h3>{t("Fee invoices & payments")}</h3>
              <p>{t("Manage draft invoices and the append-only payment ledger.")}</p>
            </div>
            <button type="button" className="admin-secondary" onClick={() => void loadResource("communication")}>
              {t("Refresh fee invoices")}
            </button>
          </div>
          <nav className="admin-fee-module-tabs" aria-label={t("Fee management sections")}>
            {([
              ["INVOICES", "Invoices"],
              ["PAYMENTS", "Payment history"],
              ["BALANCES", "Student balances"],
              ["REPORTS", "Reports & reconciliation"]
            ] as const).map(([key,label]) => (
              <button type="button" key={key} aria-current={feesModule === key ? "page" : undefined}
                ref={element => { feeModuleRefs.current[key] = element; }}
                className={feesModule === key ? "is-active" : ""}
                onClick={() => setFeesModule(key)}>{t(label)}</button>
            ))}
          </nav>
          {(feesModule === "PAYMENTS" || feesModule === "BALANCES") ? (
            <AdminFeeOperations mode={feesModule} accessToken={accessToken}
              locale={locale}
              students={(visibleFamilies?.students ?? []).map(row => ({
                id: row.student.id, fullName: row.student.fullName,
                studentCode: row.student.studentCode
              }))}
              refreshVersion={feeReloadKey} />
          ) : null}
          {feesModule === "REPORTS" ? (
            <AdminFeeFinancialReports accessToken={accessToken} locale={locale}
              refreshVersion={feeReloadKey}
              students={(visibleFamilies?.students ?? []).filter(row => row.student.status === "ACTIVE").map(row => ({
                id: row.student.id, fullName: row.student.fullName, studentCode: row.student.studentCode
              }))} />
          ) : null}
          {feesModule === "INVOICES" ? (
          <>
          <div className="communication-mobile-toggle" role="group" aria-label={t("Choose fee workspace")}>
            <button type="button" className={feesPane === "LIST" ? "is-active" : ""}
              aria-pressed={feesPane === "LIST"} onClick={() => setFeesPane("LIST")}>
              {t("Invoice list")}
            </button>
            <button type="button" className={feesPane === "FORM" ? "is-active" : ""}
              aria-pressed={feesPane === "FORM"} onClick={() => setFeesPane("FORM")}>
              {t("Create fee invoice")}
            </button>
          </div>
          <div className="communication-workflow-layout" data-pane={feesPane}>
            <div className="communication-workflow-form">
              {visibleFamilies && resourceStatus.families === "ready" && ready ? (
                <>
        <article className="admin-panel communication-form-card communication-invoice-create-card">
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
        </article>

        <article className="admin-panel communication-reminder-card">
          <header className="communication-reminder-heading">
            <h2>{t("Fee reminders · days before due")}</h2>
            <p>{t("Parents receive one reminder per selected day while the invoice remains unpaid and the student is active.")}</p>
          </header>
          <form className="communication-reminder-form" onSubmit={saveReminderSettings}>
            <span className="admin-reminder-label">{t("Configured reminder days")}</span>
            <div className="admin-reminder-chips" role="list" aria-label={t("Configured reminder days")}>
              {reminderDays.map(day => (
                <span role="listitem" className="admin-reminder-chip" key={day}>
                  {adminFormat(locale, "{days} days", { days: day })}
                  <button type="button" disabled={busy || reminderDays.length === 1}
                    aria-label={adminFormat(locale, "Remove {days}-day reminder", { days: day })}
                    title={adminFormat(locale, "Remove {days}-day reminder", { days: day })}
                    onClick={() => setReminderDays(current => current.filter(value => value !== day))}>×</button>
                </span>
              ))}
            </div>
            <div className="admin-reminder-editor">
              <label htmlFor="communication-fee-reminder-day">{t("New reminder day (1–90)")}
                <input id="communication-fee-reminder-day" type="number" min={1} max={90}
                  step={1} inputMode="numeric"
                  value={reminderCandidate}
                  onChange={event => setReminderCandidate(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addReminderDay();
                    }
                  }} />
              </label>
              <button type="button" className="admin-secondary" disabled={busy || reminderDays.length >= 6}
                onClick={addReminderDay}>{t("Add reminder day")}</button>
            </div>
            <div className="admin-reminder-actions">
              <button className="admin-primary" disabled={busy || !reminderDays.length}
                type="submit">{t("Save reminder days")}</button>
            </div>
          </form>
        </article>
                </>
              ) : !ready ? resourceNotice("communication") : resourceNotice("families")}
            </div>
            <div className="communication-workflow-list">
              {ready && visibleOverview ? (
                <>
      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div><h2>{t("Fee invoices & payments")}</h2><p>{t("Payments are appended; reversals never overwrite the original transaction.")}</p></div>
        </div>
        <div className="communication-invoice-filters">
          <label>{t("Search invoices")}
            <input type="search" value={feeSearch}
              onChange={event=>setFeeSearch(event.target.value)}
              placeholder={t("Student name, code, description or invoice number")} />
          </label>
          <label>{t("Status")}
            <select value={feeStatus} onChange={event=>setFeeStatus(event.target.value as AdminInvoiceStatus)}>
              {INVOICE_STATUSES.map(value=><option value={value} key={value}>
                {t(value==="ALL" ? "All statuses" : value)}
              </option>)}
            </select>
          </label>
          <label>{t("Academic year")}
            <select value={feeAcademicYearId} onChange={event=>{
              setFeeAcademicYearId(event.target.value);
              setFeeClassId("");
            }}>
              <option value="">{t("All academic years")}</option>
              {(visibleAcademics?.academicYears ?? []).map(year=>
                <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </label>
          <label>{t("Class")}
            <select value={feeClassId} onChange={event=>setFeeClassId(event.target.value)}>
              <option value="">{t("All classes")}</option>
              {(visibleAcademics?.classes ?? []).filter(row=>
                !feeAcademicYearId || row.academicYearId===feeAcademicYearId
              ).map(row=><option key={row.id} value={row.id}>{row.name} · {row.code}</option>)}
            </select>
          </label>
          <label>{t("Student")}
            <select value={feeStudentId} onChange={event=>setFeeStudentId(event.target.value)}>
              <option value="">{t("All students")}</option>
              {(visibleFamilies?.students ?? []).map(row=>
                <option key={row.student.id} value={row.student.id}>
                  {row.student.fullName} · {row.student.studentCode}
                </option>)}
            </select>
          </label>
        </div>
        {feeListingStatus==="error" ? (
          <div className="admin-error" role="alert">
            {feeListingError}
            <button className="admin-secondary" type="button" onClick={() => setFeeReloadKey(value=>value+1)}>
              {t("Retry")}
            </button>
          </div>
        ) : null}
        {feeListingStatus==="loading" ? <AdminLoader compact label={t("Loading fee invoices…")} /> : null}
        {feeListingStatus==="ready" && feeListing ? (
          <>
            <p className="admin-copy" role="status">
              {adminFormat(locale,"{total} matching invoices",{
                total:formatCount(feeListing.total)
              })}
            </p>
            <div className="communication-invoice-list">

          {feeListing.invoices.map((item) => {
            const draft = paymentDraft[item.invoice.id] ?? { amount: "", method: "CASH", reference: "" };
            const reversedPaymentIds = new Set(
              item.payments.filter((payment) => payment.kind === "REVERSAL" && payment.reversalOfPaymentId)
                .map((payment) => payment.reversalOfPaymentId)
            );
            return (
              <div className="communication-invoice" key={item.invoice.id}>
                <div className="communication-invoice-topline">
                  <strong>{invoiceReference(item.invoice.invoiceNumber)}</strong>
                  <button type="button" className="admin-secondary"
                    aria-expanded={openInvoiceId===item.invoice.id}
                    onClick={()=>{ setOpenInvoiceId(openInvoiceId===item.invoice.id ? null : item.invoice.id);
                      setEditingInvoice(null); }}>
                    {t(openInvoiceId===item.invoice.id ? "Hide details" : "View details")}
                  </button>
                </div>
                <div className="communication-invoice-header">
                  <div>
                    <strong>{item.studentName}</strong>
                    <span>{item.studentCode} · {item.invoice.description || t("School fee")} · {adminFormat(locale, "due {date}", { date: formatAdminHijriDate(locale, item.invoice.dueDate) })}</span>
                  </div>
                  <strong className="communication-invoice-status" data-status={item.invoice.status}>
                    {t(item.invoice.status)}
                  </strong>
                </div>
                {openInvoiceId!==item.invoice.id ? (
                  <dl className="communication-invoice-snapshot">
                    <div><dt>{t("Amount")}</dt><dd>{formatMoney(item.invoice.amount)}</dd></div>
                    <div><dt>{t("Paid")}</dt><dd>{formatMoney(item.paid)}</dd></div>
                    <div><dt>{t("Outstanding")}</dt><dd>{formatMoney(item.outstanding)}</dd></div>
                  </dl>
                ) : null}
                {openInvoiceId===item.invoice.id ? (
                  <div className="communication-invoice-expanded">
                    <dl className="communication-invoice-detail-fields">
                      <div><dt>{t("Invoice number")}</dt><dd>{invoiceReference(item.invoice.invoiceNumber)}</dd></div>
                      <div><dt>{t("Reference")}</dt><dd>{item.invoice.id}</dd></div>
                      <div><dt>{t("Due date")}</dt><dd>{formatAdminHijriDate(locale,item.invoice.dueDate)}</dd></div>
                      <div><dt>{t("Description")}</dt><dd>{item.invoice.description ?? "—"}</dd></div>
                    </dl>
                <div className="communication-money-grid">
                  <span>{t("Amount")}<strong>{formatMoney(item.invoice.amount)}</strong></span>
                  <span>{t("Paid")}<strong>{formatMoney(item.paid)}</strong></span>
                  <span>{t("Outstanding")}<strong>{formatMoney(item.outstanding)}</strong></span>
                </div>

                <div className="admin-actions">
                  {item.invoice.status === "DRAFT" ? (
                    <button disabled={busy} onClick={() => void invoiceAction(item.invoice.id, "issue")}>{t("Issue")}</button>
                  ) : null}
                  {!["PAID", "CANCELLED"].includes(item.invoice.status) && item.paid === 0 ? (
                    <button disabled={busy} onClick={() => void invoiceAction(item.invoice.id, "cancel")}>{t("Cancel")}</button>
                  ) : null}
                </div>

                {item.invoice.status === "DRAFT" ? (
                  <button type="button" className="admin-secondary" disabled={busy}
                    onClick={() => openDraftEditor(item)}>{t("Edit draft")}</button>
                ) : null}
                {editingInvoice?.invoice.id===item.invoice.id ? (
                  <form className="admin-form communication-draft-edit"
                    onSubmit={updateDraftInvoice}>
                    <h3>{t("Edit draft invoice")}</h3>
                    <label>{t("Student")}
                      <select required value={editFeeStudentId}
                        onChange={event=>setEditFeeStudentId(event.target.value)}>
                        {activeStudents.map(row=><option key={row.student.id} value={row.student.id}>
                          {row.student.fullName} · {row.student.studentCode}
                        </option>)}
                      </select>
                    </label>
                    <label>{t("Amount (AFN)")}
                      <input required type="number" min="1" max="100000000" step="1"
                        value={editFeeAmount} onChange={event=>setEditFeeAmount(event.target.value)} />
                    </label>
                    <label>{t("Due date")}
                      <AdminHijriDatePicker locale={locale} required value={editFeeDueDate}
                        onChange={setEditFeeDueDate} />
                    </label>
                    <label>{t("Description")}
                      <input maxLength={240} value={editFeeDescription}
                        onChange={event=>setEditFeeDescription(event.target.value)} />
                    </label>
                    <div className="admin-actions">
                      <button className="admin-primary" type="submit" disabled={busy}>{t("Save draft changes")}</button>
                      <button className="admin-secondary" type="button"
                        onClick={()=>setEditingInvoice(null)}>{t("Close")}</button>
                    </div>
                  </form>
                ) : null}
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
                    <label className="admin-fee-method-label">{t("Method")}
                      <select
                        aria-label={t("Payment method")}
                        value={draft.method}
                        onChange={event => setPaymentDraft(current => ({
                          ...current,
                          [item.invoice.id]: { ...draft, method: event.target.value }
                        }))}
                      >
                        <option value="CASH">{t("Cash")}</option>
                        <option value="BANK_TRANSFER">{t("Bank transfer")}</option>
                        <option value="MOBILE_MONEY">{t("Mobile money")}</option>
                        <option value="OTHER">{t("Other")}</option>
                      </select>
                    </label>
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
                      onClick={() => void recordPayment(item.invoice.id, item.outstanding, item.studentName, invoiceReference(item.invoice.invoiceNumber))}
                    >{t("Record payment")}</button>
                  </div>
                ) : null}

                {item.payments.length > 0 ? (
                  <div className="communication-payment-history">
                    {item.payments.map((payment) => (
                      <div key={payment.id} className="communication-payment-row">
                        <div>
                          <strong>{t(payment.kind)} · {formatMoney(payment.amount)}</strong>
                          <span>{t(payment.method === "CASH" ? "Cash" : payment.method === "BANK_TRANSFER" ?
                            "Bank transfer" : payment.method === "MOBILE_MONEY" ? "Mobile money" :
                            payment.method === "OTHER" ? "Other" : payment.method)} · {formatAdminHijriDateTime(locale, payment.recordedAt)}</span>
                          {payment.kind === "PAYMENT" ? (
                            <AdminFeeReceiptButton accessToken={accessToken} paymentId={payment.id} locale={locale} />
                          ) : null}
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
                ) : null}                  </div>
                ) : null}
              </div>
            );
          })}
          {feeListing.total === 0 ? <p className="admin-copy">{t("No matching invoices.")}</p> : null}
        </div>
        <div className="communication-invoice-pager">
          <button type="button" className="admin-secondary" disabled={feePage===1}
            onClick={()=>{setFeePage(page=>Math.max(1,page-1));setOpenInvoiceId(null);}}>
            {t("Previous")}
          </button>
          <span>{adminFormat(locale,"Page {page} of {total}",{
            page:formatCount(feePage),
            total:formatCount(Math.max(1,Math.ceil(feeListing.total/feeListing.pageSize)))
          })}</span>
          <button type="button" className="admin-secondary"
            disabled={feePage*feeListing.pageSize>=feeListing.total}
            onClick={()=>{setFeePage(page=>page+1);setOpenInvoiceId(null);}}>
            {t("Next")}
          </button>
        </div>
          </>
        ) : null}
      </article>
                </>
              ) : resourceNotice("communication")}
            </div>
          </div>
          </>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="academic-summary">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
