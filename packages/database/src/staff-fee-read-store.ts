import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import { classSections, feeInvoices, feePayments, students } from "./schema.js";

export type StaffFeeInvoiceRow = {
  id:string;invoiceNumber:number;studentId:string;studentName:string;
  studentCode:string;className:string;amount:number;currency:string;
  description:string|null;dueDate:string;status:string;paid:number;outstanding:number;
};
export type StaffFeeInvoiceFilter={
  q:string;status:"ALL"|"ISSUED"|"PARTIALLY_PAID"|"OVERDUE"|"PAID";page:number;
};
export interface StaffFeeReadStore {
  listInvoices(schoolId:string,filter:StaffFeeInvoiceFilter):Promise<{
    invoices:StaffFeeInvoiceRow[];page:number;pageSize:number;total:number;
  }>;
}
const available=["ISSUED","PARTIALLY_PAID","OVERDUE","PAID"] as const;
const PAGE_SIZE=20;

/** Read-only, tenant-scoped projection; drafts, contacts and internal account data are never serialized. */
export function createStaffFeeReadStore(db:FoundationDatabase):StaffFeeReadStore{
  return {
    async listInvoices(schoolId,filter){
      const q=filter.q.trim();
      // Escape LIKE wildcards: typed search must not accidentally match every student.
      const escaped=q.replace(/[\\%_]/g,match=>"\\"+match);
      const where=and(
        eq(feeInvoices.schoolId,schoolId),eq(students.schoolId,schoolId),
        eq(classSections.schoolId,schoolId),
        inArray(feeInvoices.status,filter.status==="ALL"?[...available]:[filter.status]),
        q?or(ilike(students.fullName,`%${escaped}%`),ilike(students.studentCode,`%${escaped}%`)):undefined
      );
      const [totalRows,records]=await Promise.all([
        db.select({value:count()}).from(feeInvoices)
          .innerJoin(students,and(eq(students.id,feeInvoices.studentId),eq(students.schoolId,schoolId)))
          .innerJoin(classSections,and(eq(classSections.id,students.classId),eq(classSections.schoolId,schoolId)))
          .where(where),
        db.select({
          id:feeInvoices.id,invoiceNumber:feeInvoices.invoiceNumber,
          studentId:students.id,studentName:students.fullName,studentCode:students.studentCode,
          className:classSections.name,amount:feeInvoices.amount,currency:feeInvoices.currency,
          description:feeInvoices.description,dueDate:feeInvoices.dueDate,status:feeInvoices.status
        }).from(feeInvoices)
          .innerJoin(students,and(eq(students.id,feeInvoices.studentId),eq(students.schoolId,schoolId)))
          .innerJoin(classSections,and(eq(classSections.id,students.classId),eq(classSections.schoolId,schoolId)))
          .where(where).orderBy(desc(feeInvoices.createdAt),desc(feeInvoices.id))
          .limit(PAGE_SIZE).offset((filter.page-1)*PAGE_SIZE)
      ]);
      const ids=records.map(r=>r.id);
      const payments=ids.length?await db.select({
        invoiceId:feePayments.invoiceId,amount:feePayments.amount,kind:feePayments.kind
      }).from(feePayments).where(and(eq(feePayments.schoolId,schoolId),inArray(feePayments.invoiceId,ids))):[];
      const paidByInvoice=new Map<string,number>();
      for(const payment of payments)paidByInvoice.set(payment.invoiceId,
        (paidByInvoice.get(payment.invoiceId)??0)+(payment.kind==="PAYMENT"?payment.amount:-payment.amount));
      return {
        invoices:records.map(row=>({
          ...row,paid:paidByInvoice.get(row.id)??0,
          outstanding:Math.max(0,row.amount-(paidByInvoice.get(row.id)??0))
        })),
        total:Number(totalRows[0]?.value??0),page:filter.page,pageSize:PAGE_SIZE
      };
    }
  };
}
