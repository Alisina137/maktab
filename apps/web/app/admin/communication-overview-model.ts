/** Pure school ledger/announcement projections. No browser-timezone or network dependencies. */
export type DashboardInvoice = {
  invoice: { id: string; studentId: string; amount: number; dueDate: string;
    status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" };
  paid: number;
  outstanding: number;
};
export type DashboardAnnouncement = { id: string; publishAt: string; archivedAt: string | null };

export function feeDashboard(invoices: DashboardInvoice[]) {
  const issued = invoices.filter(item =>
    item.invoice.status !== "DRAFT" && item.invoice.status !== "CANCELLED");
  const billed = issued.reduce((sum, item) => sum + item.invoice.amount, 0);
  const paid = issued.reduce((sum, item) => sum + item.paid, 0);
  const outstanding = issued.reduce((sum, item) => sum + item.outstanding, 0);
  const overdue = issued.filter(item => item.invoice.status === "OVERDUE")
    .reduce((sum, item) => sum + item.outstanding, 0);
  return {
    totalInvoices: invoices.length, issuedInvoices: issued.length,
    billed, paid, outstanding, overdue,
    collectionRate: billed > 0 ? Math.min(100, Math.max(0, paid / billed * 100)) : null,
    owingStudents: new Set(issued.filter(item => item.outstanding > 0)
      .map(item => item.invoice.studentId)).size
  };
}

export function announcementDashboard(announcements: DashboardAnnouncement[], now: Date) {
  const published = announcements.filter(item => !item.archivedAt &&
    Date.parse(item.publishAt) <= now.getTime()).length;
  const scheduled = announcements.filter(item => !item.archivedAt &&
    Date.parse(item.publishAt) > now.getTime()).length;
  const archived = announcements.filter(item => Boolean(item.archivedAt)).length;
  return { total: announcements.length, published, scheduled, archived };
}
