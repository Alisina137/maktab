import type { FeeFinancialReport } from "@maktablink/database";

/** Neutralize spreadsheet formula injection even with leading whitespace/newlines. */
export function csvCell(value: string | number | null | undefined): string {
  const original = String(value ?? "");
  const sanitized = /^[\\s\\uFEFF\\u200B]*[=+\\-@]/u.test(original) || /^[\\s\\uFEFF\\u200B]*[\\t\\r]/u.test(original)
    ? "'" + original : original;
  return '"' + sanitized.replaceAll('"', '""') + '"';
}

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}

export function feeReportCsv(report: FeeFinancialReport, kind: "payments" | "outstanding"): string {
  const lines: string[] = [];
  if (kind === "payments") {
    lines.push(row(["payment_id","invoice_number","student_code","student_name",
      "kind","amount_afn","method","recorded_at_utc","school_timezone",
      "transaction_reference","recorded_by","reconciliation"]));
    for (const entry of report.rows) lines.push(row([
      entry.paymentId, entry.invoiceNumber, entry.studentCode, entry.studentName,
      entry.kind, entry.amount, entry.method, new Date(entry.recordedAt).toISOString(),
      report.schoolTimezone, entry.transactionReference, entry.recordedBy, entry.reconciliation
    ]));
  } else {
    lines.push(row(["invoice_number","student_code","student_name","due_date_gregorian",
      "invoice_amount_afn","net_paid_afn","outstanding_afn","days_overdue","as_of_school_date"]));
    for (const entry of report.invoices) lines.push(row([
      entry.invoiceNumber, entry.studentCode, entry.studentName, entry.dueDate,
      entry.amount, entry.paid, entry.outstanding, entry.daysOverdue, report.asOf
    ]));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
