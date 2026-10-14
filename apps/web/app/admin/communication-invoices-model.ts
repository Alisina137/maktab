/** Stable school-scoped invoice reference; counter allocated atomically by the database. */
export function invoiceReference(number: number): string {
  if (!Number.isSafeInteger(number) || number < 1) throw new Error("Invoice number is invalid.");
  return "INV-" + String(number).padStart(6, "0");
}
export const INVOICE_STATUSES = [
  "ALL","DRAFT","ISSUED","PARTIALLY_PAID","PAID","OVERDUE","CANCELLED"
] as const;
export type AdminInvoiceStatus = typeof INVOICE_STATUSES[number];
export function invoiceQuery(filters: {
  q: string; status: AdminInvoiceStatus;
  page: number; classId: string; academicYearId: string; studentId: string
}) {
  const query = new URLSearchParams({ page: String(filters.page), status: filters.status });
  if (filters.q.trim()) query.set("q", filters.q.trim());
  if (filters.classId) query.set("classId", filters.classId);
  if (filters.academicYearId) query.set("academicYearId", filters.academicYearId);
  if (filters.studentId) query.set("studentId", filters.studentId);
  return query.toString();
}
