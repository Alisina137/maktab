import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { adminFeePaymentsQuerySchema, recordFeePaymentSchema } from "@maktablink/contracts";
import {
  CommunicationConflictError, CommunicationNotFoundError, CommunicationValidationError,
  hasStaffPermission, type AccountStore, type CommunicationStore,
  type StaffFeeReadStore
} from "@maktablink/database";
import { z, ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";

const invoicesQuery=z.object({
  q:z.string().trim().max(80).default(""),
  status:z.enum(["ALL","ISSUED","PARTIALLY_PAID","OVERDUE","PAID"]).default("ALL"),
  page:z.coerce.number().int().min(1).max(10000).default(1)
}).strict();
const historyQuery=z.object({
  page:z.coerce.number().int().min(1).max(10000).default(1),
  kind:z.enum(["ALL","PAYMENT","REVERSAL"]).default("ALL"),
  method:z.enum(["ALL","CASH","BANK_TRANSFER","MOBILE_MONEY","OTHER"]).default("ALL")
}).strict();
const paymentInput=recordFeePaymentSchema.extend({
  method:z.enum(["CASH","BANK_TRANSFER","MOBILE_MONEY","OTHER"]),
  // Idempotency is mandatory for staff collection: a lost response must be safe to retry.
  idempotencyKey:z.string().uuid()
}).strict();
const idParam=z.object({id:z.string().uuid()}).strict();

function errorReply(reply:FastifyReply,error:unknown){
  if(error instanceof ZodError)return reply.code(400).send({
    error:"validation_error",message:"Check the fee fields.",issues:error.issues
  });
  if(error instanceof CommunicationValidationError)
    return reply.code(400).send({error:"fee_validation",message:error.message});
  if(error instanceof CommunicationNotFoundError)
    return reply.code(404).send({error:"not_found",message:error.message});
  if(error instanceof CommunicationConflictError)
    return reply.code(409).send({error:"fee_conflict",message:error.message});
  throw error;
}
async function feeStaff(request:FastifyRequest,reply:FastifyReply,accounts:AccountStore){
  const ctx=await requireAccess(request,reply,accounts);
  if(!ctx)return null;
  if(ctx.user.role!=="SCHOOL_STAFF"||ctx.user.mustChangePassword||ctx.user.status!=="ACTIVE"){
    await reply.code(403).send({error:"forbidden",message:"Active school staff credentials required."});
    return null;
  }
  const profile=await accounts.getStaffProfile(ctx.user.schoolId,ctx.user.id);
  const canView=hasStaffPermission(profile?.permissions,"FEES_VIEW");
  const canCollect=hasStaffPermission(profile?.permissions,"FEES_COLLECT");
  if(!canView&&!canCollect){
    await reply.code(403).send({error:"permission_denied",message:"Fee permission required."});
    return null;
  }
  return {ctx,canView,canCollect};
}
function receiptView(row:Awaited<ReturnType<CommunicationStore["getAdminFeePaymentReceipt"]>>){
  return {
    id:row.payment.id,invoiceId:row.invoiceId,invoiceNumber:row.invoiceNumber,
    schoolName:row.schoolName,studentName:row.studentName,studentCode:row.studentCode,
    amount:row.payment.amount,currency:"AFN",
    method:row.payment.method,transactionReference:row.payment.transactionReference,
    recordedAt:row.payment.recordedAt,recordedByUsername:row.recordedByUsername,
    schoolTimezone:row.schoolTimezone,
    invoiceAmount:row.invoiceAmount,currentOutstanding:row.currentOutstanding,
    reversed:row.reversed
  };
}

/** Staff fees intentionally reuse the audited administrator ledger. No staff invoice,
 * reversal, reconciliation, reminder or refund mutation routes are registered here. */
export function registerStaffFeeRoutes(
  app:FastifyInstance,accounts:AccountStore,
  communication:CommunicationStore,store:StaffFeeReadStore
):void{
  app.get("/v1/staff/fees/invoices",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const staff=await feeStaff(request,reply,accounts);if(!staff)return;
    try{
      const input=invoicesQuery.parse(request.query);
      return await store.listInvoices(staff.ctx.user.schoolId,input);
    }catch(error){return errorReply(reply,error);}
  });
  app.get("/v1/staff/fees/payments",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const staff=await feeStaff(request,reply,accounts);if(!staff)return;
    try{
      const input=historyQuery.parse(request.query);
      const query=adminFeePaymentsQuerySchema.parse({
        ...input,
        // A collector without FEES_VIEW can inspect only payments they recorded.
        recordedBy:staff.canView?undefined:staff.ctx.user.id,
        recordedByUsername:""
      });
      const rows=await communication.listAdminFeePayments(staff.ctx.user.schoolId,query);
      return {
        page:rows.page,pageSize:rows.pageSize,total:rows.total,
        payments:rows.payments.map(row=>({
          id:row.payment.id,invoiceId:row.invoiceId,invoiceNumber:row.invoiceNumber,
          studentName:row.studentName,studentCode:row.studentCode,
          kind:row.payment.kind,amount:row.payment.amount,method:row.payment.method,
          recordedAt:row.payment.recordedAt,recordedByUsername:row.recordedByUsername,
          transactionReference:row.payment.transactionReference,
          reversedPaymentId:row.payment.reversalOfPaymentId
        }))
      };
    }catch(error){return errorReply(reply,error);}
  });
  app.get<{Params:{id:string}}>("/v1/staff/fees/receipts/:id",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const staff=await feeStaff(request,reply,accounts);if(!staff)return;
    try{
      const {id}=idParam.parse(request.params);
      const row=await communication.getAdminFeePaymentReceipt(staff.ctx.user.schoolId,id);
      if(!staff.canView&&row.payment.recordedBy!==staff.ctx.user.id)
        return reply.code(403).send({error:"permission_denied",message:"Only your own receipts are available."});
      return {receipt:receiptView(row)};
    }catch(error){return errorReply(reply,error);}
  });
  app.post<{Params:{id:string}}>("/v1/staff/fees/invoices/:id/payments",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const staff=await feeStaff(request,reply,accounts);if(!staff)return;
    if(!staff.canCollect)
      return reply.code(403).send({error:"permission_denied",message:"Payment collection permission required."});
    try{
      const {id}=idParam.parse(request.params);
      const input=paymentInput.parse(request.body);
      const updated=await communication.recordFeePayment(
        staff.ctx.user.schoolId,staff.ctx.user.id,id,input
      );
      const posted=updated.payments.find(payment=>
        payment.idempotencyKey===input.idempotencyKey&&payment.kind==="PAYMENT");
      if(!posted||posted.recordedBy!==staff.ctx.user.id)
        throw new CommunicationConflictError("This payment retry key belongs to a different operator.");
      const receipt=await communication.getAdminFeePaymentReceipt(staff.ctx.user.schoolId,posted.id);
      return reply.code(201).send({
        invoice:{id:updated.invoice.id,status:updated.invoice.status,
          amount:updated.invoice.amount,paid:updated.paid,outstanding:updated.outstanding},
        receipt:receiptView(receipt)
      });
    }catch(error){return errorReply(reply,error);}
  });
}
