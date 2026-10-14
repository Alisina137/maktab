import type { FeeInvoiceViewPayload, FeePaymentPayload } from "./api";

export type ParentMoreTab = "FEES" | "PROFILE" | "SCHOOL" | "PREFERENCES";
export type ParentFeeFilter = "ALL" | "DUE" | "PAID" | "CANCELLED";

export const parentMoreTabs: ParentMoreTab[] = ["FEES", "PROFILE", "SCHOOL", "PREFERENCES"];

export function visibleParentInvoices(
  invoices: FeeInvoiceViewPayload[], filter: ParentFeeFilter
): FeeInvoiceViewPayload[] {
  return invoices.filter(row => {
    const status = row.invoice.status;
    // The school API already excludes drafts. Filter defensively as a second layer.
    if (status === "DRAFT") return false;
    if (filter === "DUE") return status !== "CANCELLED" && row.outstanding > 0;
    if (filter === "PAID") return status === "PAID";
    if (filter === "CANCELLED") return status === "CANCELLED";
    return true;
  }).sort((a,b) => b.invoice.dueDate.localeCompare(a.invoice.dueDate) ||
    a.invoice.id.localeCompare(b.invoice.id));
}

export function parentFeeSummary(invoices: FeeInvoiceViewPayload[]) {
  // Canceled/draft invoices never inflate issued balances.
  const included = invoices.filter(row =>
    row.invoice.status !== "DRAFT" && row.invoice.status !== "CANCELLED");
  return {
    issued: included.reduce((sum,row) => sum + row.invoice.amount,0),
    paid: included.reduce((sum,row) => sum + row.paid,0),
    outstanding: included.reduce((sum,row) => sum + row.outstanding,0),
    dueCount: included.filter(row => row.outstanding > 0).length,
    invoiceCount: included.length
  };
}

export function sortedParentPayments(payments: FeePaymentPayload[]): FeePaymentPayload[] {
  return [...payments].sort((a,b) => b.recordedAt.localeCompare(a.recordedAt) ||
    b.id.localeCompare(a.id));
}

/** Client-side validation mirrors API policy; the server still validates passwords. */
export function parentPasswordValidation(
  current: string, next: string, confirm: string
): "CURRENT" | "SAME" | "LENGTH" | "LETTER" | "NUMBER" | "SPECIAL" | "CONFIRM" | null {
  if (!current) return "CURRENT";
  if (current === next) return "SAME";
  if (next.length < 8 || next.length > 128) return "LENGTH";
  if (!/[A-Za-z]/.test(next)) return "LETTER";
  if (!/[0-9]/.test(next)) return "NUMBER";
  if (!/[^A-Za-z0-9\s]/.test(next)) return "SPECIAL";
  if (next !== confirm) return "CONFIRM";
  return null;
}
