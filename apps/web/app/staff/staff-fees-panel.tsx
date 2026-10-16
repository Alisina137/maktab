"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AdminLocale } from "../admin/admin-i18n";
import { friendlyAdminError } from "../admin/admin-client";
import { staffFeesText } from "./staff-fees-i18n";
import "./staff-fees.css";

type InvoiceStatus="ALL"|"ISSUED"|"PARTIALLY_PAID"|"OVERDUE"|"PAID";
type FeeInvoice={
  id:string;invoiceNumber:number;studentId:string;studentName:string;studentCode:string;
  className:string;amount:number;paid:number;outstanding:number;currency:string;
  description:string|null;dueDate:string;status:string;
};
type Invoices={invoices:FeeInvoice[];total:number;page:number;pageSize:number};
type Payment={
  id:string;invoiceId:string;invoiceNumber:number;studentName:string;studentCode:string;
  amount:number;kind:"PAYMENT"|"REVERSAL";method:string;recordedAt:string;
  recordedByUsername:string;transactionReference:string|null;reversedPaymentId:string|null;
};
type Payments={payments:Payment[];total:number;page:number;pageSize:number;schoolTimezone:string};
type Receipt={
  id:string;invoiceId:string;invoiceNumber:number;schoolName:string;studentName:string;
  studentCode:string;amount:number;currency:string;method:string;
  transactionReference:string|null;recordedAt:string;recordedByUsername:string;
  schoolTimezone:string;invoiceAmount:number;currentOutstanding:number;reversed:boolean;
};
type Props={locale:AdminLocale;canCollect:boolean;
  api:<T>(path:string,init?:RequestInit)=>Promise<T>};
const STATUSES:InvoiceStatus[]=["ALL","ISSUED","PARTIALLY_PAID","OVERDUE","PAID"];
const METHODS=["CASH","BANK_TRANSFER","MOBILE_MONEY","OTHER"] as const;

function formatDay(locale:AdminLocale,iso:string){
  if(!iso)return "—";
  const date=new Date(iso.slice(0,10)+"T12:00:00Z");
  if(Number.isNaN(date.getTime()))return iso;
  return new Intl.DateTimeFormat(locale==="en"?"en-GB":locale+"-u-ca-persian",{
    year:"numeric",month:"short",day:"numeric",timeZone:"UTC"
  }).format(date);
}
function formatStamp(locale:AdminLocale,iso:string,timezone:string){
  const date=new Date(iso);
  if(Number.isNaN(date.getTime()))return "—";
  return new Intl.DateTimeFormat(locale==="en"?"en-GB":locale+"-u-ca-persian",{
    year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",
    hour12:true,timeZone:timezone||"Asia/Kabul"
  }).format(date);
}
function money(locale:AdminLocale,value:number){
  return new Intl.NumberFormat(locale==="en"?"en-US":locale,{maximumFractionDigits:0}).format(value)+" AFN";
}

export function StaffFeesPanel({locale,canCollect,api}:Props){
  const t=(key:string)=>staffFeesText(locale,key);
  const [section,setSection]=useState<"invoices"|"payments">("invoices");
  const [invoices,setInvoices]=useState<Invoices|null>(null);
  const [payments,setPayments]=useState<Payments|null>(null);
  const [query,setQuery]=useState("");
  const [searched,setSearched]=useState("");
  const [status,setStatus]=useState<InvoiceStatus>("ALL");
  const [invoicePage,setInvoicePage]=useState(1);
  const [paymentPage,setPaymentPage]=useState(1);
  const [paymentMethod,setPaymentMethod]=useState<"ALL"|"CASH"|"BANK_TRANSFER"|"MOBILE_MONEY"|"OTHER">("ALL");
  const [selected,setSelected]=useState<FeeInvoice|null>(null);
  const [amount,setAmount]=useState("");
  const [method,setMethod]=useState<typeof METHODS[number]>("CASH");
  const [reference,setReference]=useState("");
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  // Stable retry key after a network timeout prevents duplicate ledger entries.
  const pendingPayment=useRef<{fingerprint:string;key:string}|null>(null);
  const invoiceParams=useMemo(()=>new URLSearchParams({
    q:searched,status,page:String(invoicePage)
  }).toString(),[searched,status,invoicePage]);
  const paymentParams=useMemo(()=>new URLSearchParams({
    page:String(paymentPage),method:paymentMethod
  }).toString(),[paymentPage,paymentMethod]);

  const fetchInvoices=useCallback(async()=>{
    const result=await api<Invoices>("/v1/staff/fees/invoices?"+invoiceParams);
    setInvoices(result);
    setSelected(previous=>result.invoices.find(x=>x.id===previous?.id)??null);
  },[api,invoiceParams]);
  const fetchPayments=useCallback(async()=>{
    const result=await api<Payments>("/v1/staff/fees/payments?"+paymentParams);
    setPayments(result);
  },[api,paymentParams]);
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    void api<Invoices>("/v1/staff/fees/invoices?"+invoiceParams)
      .then(data=>{if(active){setInvoices(data);setSelected(null);}})
      .catch(err=>{if(active)setError(friendlyAdminError(err,"Could not load fee invoices.",locale));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[api,invoiceParams,locale]);
  useEffect(()=>{
    if(section!=="payments")return;
    let active=true;setLoading(true);setError("");
    void api<Payments>("/v1/staff/fees/payments?"+paymentParams)
      .then(data=>{if(active)setPayments(data);})
      .catch(err=>{if(active)setError(friendlyAdminError(err,"Could not load payment history.",locale));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[api,paymentParams,section,locale]);

  function selectInvoice(row:FeeInvoice){
    setSelected(row);setAmount(String(row.outstanding));setMethod("CASH");
    setReference("");setReceipt(null);setError("");setNotice("");pendingPayment.current=null;
  }
  function searchInvoices(e:FormEvent){
    e.preventDefault();setSearched(query.trim());setInvoicePage(1);setSelected(null);
  }
  async function pay(e:FormEvent){
    e.preventDefault();
    if(!selected||!canCollect||busy)return;
    const n=Number(amount);
    if(!Number.isSafeInteger(n)||n<=0||n>selected.outstanding){
      setError(t("Payment must be a positive amount within the outstanding balance."));return;
    }
    if(!window.confirm(t("Record this payment against the selected invoice?")))return;
    const fingerprint=[selected.id,n,method,reference.trim()].join("|");
    if(!pendingPayment.current||pendingPayment.current.fingerprint!==fingerprint){
      pendingPayment.current={fingerprint,key:crypto.randomUUID()};
    }
    const key=pendingPayment.current.key;
    setBusy(true);setError("");setNotice("");
    try{
      const result=await api<{receipt:Receipt;invoice:{outstanding:number}}>(
        "/v1/staff/fees/invoices/"+selected.id+"/payments",{
          method:"POST",body:JSON.stringify({
            amount:n,method,transactionReference:reference.trim(),idempotencyKey:key
          })
        });
      pendingPayment.current=null;setReceipt(result.receipt);
      setSelected(null);setAmount("");setReference("");
      setNotice(t("Payment recorded successfully. Receipt ready."));
      await Promise.all([fetchInvoices(),fetchPayments()]);
    }catch(err){
      // Preserve the retry key on ambiguous failure. Re-entering different
      // details creates a new key; the ledger rejects mismatched replays.
      setError(friendlyAdminError(err,"Could not record payment. Retry with the same details.",locale));
    }finally{setBusy(false);}
  }
  async function viewReceipt(paymentId:string){
    setBusy(true);setError("");setNotice("");
    try{
      const data=await api<{receipt:Receipt}>("/v1/staff/fees/receipts/"+paymentId);
      setReceipt(data.receipt);
    }catch(err){setError(friendlyAdminError(err,"Could not load receipt.",locale));}
    finally{setBusy(false);}
  }
  const pageOutstanding=(invoices?.invoices??[]).reduce((sum,row)=>sum+row.outstanding,0);
  return <section className="staff-fees" aria-label={t("School fees")}>
    <div className="staff-fees-heading">
      <div><span className="eyebrow">{t("Staff financial workspace")}</span>
        <h2>{t("Fees & collections")}</h2>
        <p>{t("Review issued invoices and payment history. Collection rights are assigned by the school administrator.")}</p>
      </div>
      <div className="staff-fees-kpis">
        <div><span>{t("Invoices on this page")}</span><strong>{invoices?.invoices.length??0}</strong></div>
        <div><span>{t("Outstanding on this page")}</span><strong>{money(locale,pageOutstanding)}</strong></div>
      </div>
    </div>
    <nav className="staff-fees-nav" aria-label={t("Fee sections")}>
      <button type="button" aria-pressed={section==="invoices"} onClick={()=>{setSection("invoices");setError("");}}>
        {t("Invoices & balances")}</button>
      <button type="button" aria-pressed={section==="payments"} onClick={()=>{setSection("payments");setError("");}}>
        {t("Payment history")}</button>
    </nav>
    {error?<div className="admin-error" role="alert">{error}</div>:null}
    {notice?<div className="staff-reg-success" role="status">{notice}</div>:null}
    {section==="invoices"?<div className="staff-fees-columns">
      <section className="admin-panel staff-fees-card">
        <div className="admin-section-header">
          <div><h3>{t("Issued school invoices")}</h3><p>{t("Draft and cancelled invoices are excluded.")}</p></div>
          <button type="button" className="admin-secondary" disabled={busy||loading}
            onClick={()=>void fetchInvoices().catch(err=>setError(friendlyAdminError(err,"Could not refresh.",locale)))}>
            {t("Refresh")}</button>
        </div>
        <form className="staff-fees-filters" onSubmit={searchInvoices}>
          <label>{t("Search student or code")}
            <input value={query} maxLength={80} onChange={e=>setQuery(e.target.value)}
              placeholder={t("Student name or code")}/></label>
          <label>{t("Invoice status")}
            <select value={status} onChange={e=>{setStatus(e.target.value as InvoiceStatus);setInvoicePage(1);setSelected(null);}}>
              {STATUSES.map(x=><option key={x} value={x}>{t(x==="ALL"?"All statuses":x.replaceAll("_"," "))}</option>)}
            </select></label>
          <button type="submit" className="admin-primary" disabled={busy}>{t("Search invoices")}</button>
        </form>
        {loading?<p role="status">{t("Loading fee invoices…")}</p>:<>
          <div className="staff-fees-invoices">
            {invoices?.invoices.map(row=><button type="button" key={row.id}
              aria-pressed={selected?.id===row.id}
              className={"staff-fee-row "+(selected?.id===row.id?"staff-fee-selected":"")}
              onClick={()=>selectInvoice(row)}>
              <span><strong>{row.studentName}</strong>
                <small>{row.studentCode} · {row.className} · #{row.invoiceNumber}</small>
                <small>{t("Due")}: {formatDay(locale,row.dueDate)}</small></span>
              <span><strong>{money(locale,row.outstanding)}</strong>
                <small>{t(row.status.replaceAll("_"," "))}</small></span>
            </button>)}
            {!invoices?.invoices.length?<p>{t("No invoices found.")}</p>:null}
          </div>
          <div className="staff-pages">
            <button className="admin-secondary" disabled={busy||invoicePage<=1}
              onClick={()=>setInvoicePage(p=>Math.max(1,p-1))}>{t("Previous")}</button>
            <span>{invoicePage} / {Math.max(1,Math.ceil((invoices?.total??0)/20))}</span>
            <button className="admin-secondary" disabled={busy||invoicePage*20>=(invoices?.total??0)}
              onClick={()=>setInvoicePage(p=>p+1)}>{t("Next")}</button>
          </div>
        </>}
      </section>
      <section className="admin-panel staff-fees-card">
        {!selected?<div className="staff-fees-empty">
          <h3>{t("Invoice details")}</h3><p>{t("Select an invoice to view its balance and available collection actions.")}</p>
        </div>:<>
          <h3>{t("Invoice details")} · #{selected.invoiceNumber}</h3>
          <dl className="staff-fees-details">
            <div><dt>{t("Student")}</dt><dd>{selected.studentName} ({selected.studentCode})</dd></div>
            <div><dt>{t("Invoice amount")}</dt><dd>{money(locale,selected.amount)}</dd></div>
            <div><dt>{t("Already paid")}</dt><dd>{money(locale,selected.paid)}</dd></div>
            <div><dt>{t("Outstanding")}</dt><dd>{money(locale,selected.outstanding)}</dd></div>
            <div><dt>{t("Due date")}</dt><dd>{formatDay(locale,selected.dueDate)}</dd></div>
            <div><dt>{t("Description")}</dt><dd>{selected.description||"—"}</dd></div>
          </dl>
          {canCollect&&selected.outstanding>0&&selected.status!=="PAID"?(
            <form className="admin-form staff-fee-collect" onSubmit={pay}>
              <h4>{t("Record a payment")}</h4>
              <label>{t("Amount (AFN)")}
                <input type="number" min={1} max={selected.outstanding} step={1} required value={amount}
                  onChange={e=>{setAmount(e.target.value);pendingPayment.current=null;}}/></label>
              <label>{t("Payment method")}
                <select value={method} onChange={e=>{setMethod(e.target.value as typeof method);pendingPayment.current=null;}}>
                  {METHODS.map(value=><option key={value} value={value}>{t(value.replaceAll("_"," "))}</option>)}
                </select></label>
              <label>{t("Transaction reference (optional)")}
                <input maxLength={120} value={reference} onChange={e=>{setReference(e.target.value);pendingPayment.current=null;}}/></label>
              <button type="submit" className="admin-primary" disabled={busy||!amount}>
                {t(busy?"Recording payment…":"Confirm payment")}</button>
              <p className="pilot-security-note">{t("Only confirmed received payments should be recorded. Payments cannot be deleted here.")}</p>
            </form>
          ):<p className="pilot-security-note">{canCollect?t("This invoice has no outstanding balance."):t("Payment collection requires an additional staff permission.")}</p>}
        </>}
      </section>
    </div>:<section className="admin-panel staff-fees-card">
      <div className="admin-section-header"><div><h3>{t("Payment history")}</h3>
        <p>{t("Collectors without viewing permission can see only their own transactions.")}</p></div>
        <button type="button" className="admin-secondary" disabled={busy||loading}
          onClick={()=>void fetchPayments().catch(err=>setError(friendlyAdminError(err,"Could not refresh.",locale)))}>{t("Refresh")}</button>
      </div>
      <label className="staff-fees-method">{t("Payment method")}
        <select value={paymentMethod} onChange={e=>{setPaymentMethod(e.target.value as typeof paymentMethod);setPaymentPage(1);}}>
          <option value="ALL">{t("All methods")}</option>
          {METHODS.map(value=><option key={value} value={value}>{t(value.replaceAll("_"," "))}</option>)}
        </select></label>
      {loading?<p role="status">{t("Loading payment history…")}</p>:<>
        <div className="staff-fees-invoices">
          {payments?.payments.map(item=><article key={item.id} className="staff-fee-row staff-fees-transaction">
            <span><strong>{item.studentName} · #{item.invoiceNumber}</strong>
              <small>{item.studentCode} · {t(item.kind)} · {t(item.method.replaceAll("_"," "))}</small>
              <small>{formatStamp(locale,item.recordedAt,payments.schoolTimezone)}</small></span>
            <span><strong>{money(locale,item.amount)}</strong>
              {item.kind==="PAYMENT"?<button type="button" className="admin-secondary"
                disabled={busy} onClick={()=>void viewReceipt(item.id)}>{t("View receipt")}</button>:null}</span>
          </article>)}
          {!payments?.payments.length?<p>{t("No payment transactions found.")}</p>:null}
        </div>
        <div className="staff-pages">
          <button className="admin-secondary" disabled={busy||paymentPage<=1}
            onClick={()=>setPaymentPage(p=>Math.max(1,p-1))}>{t("Previous")}</button>
          <span>{paymentPage} / {Math.max(1,Math.ceil((payments?.total??0)/20))}</span>
          <button className="admin-secondary" disabled={busy||paymentPage*20>=(payments?.total??0)}
            onClick={()=>setPaymentPage(p=>p+1)}>{t("Next")}</button>
        </div>
      </>}
    </section>}
    {receipt?<section className="admin-panel staff-fees-receipt" aria-label={t("Payment receipt")}>
      <div className="staff-fees-receipt-actions">
        <h3>{t("Payment receipt")}</h3>
        <div><button type="button" className="admin-primary" onClick={()=>window.print()}>{t("Print receipt")}</button>
          <button type="button" className="admin-secondary" onClick={()=>setReceipt(null)}>{t("Close")}</button></div>
      </div>
      <div className="staff-fees-receipt-paper">
        <h2>{receipt.schoolName}</h2><p>{t("Official payment receipt")} · #{receipt.invoiceNumber}</p>
        {receipt.reversed?<p className="admin-error">{t("REVERSED — this payment is no longer valid.")}</p>:null}
        <dl className="staff-fees-details">
          <div><dt>{t("Receipt ID")}</dt><dd>{receipt.id}</dd></div>
          <div><dt>{t("Student")}</dt><dd>{receipt.studentName} ({receipt.studentCode})</dd></div>
          <div><dt>{t("Amount received")}</dt><dd>{money(locale,receipt.amount)}</dd></div>
          <div><dt>{t("Payment method")}</dt><dd>{t(receipt.method.replaceAll("_"," "))}</dd></div>
          <div><dt>{t("Recorded on")}</dt><dd>{formatStamp(locale,receipt.recordedAt,receipt.schoolTimezone)}</dd></div>
          <div><dt>{t("Recorded by")}</dt><dd>{receipt.recordedByUsername}</dd></div>
          <div><dt>{t("Reference")}</dt><dd>{receipt.transactionReference||"—"}</dd></div>
          <div><dt>{t("Outstanding after payment (current)")}</dt><dd>{money(locale,receipt.currentOutstanding)}</dd></div>
        </dl>
        <p className="pilot-security-note">{t("This is a school-issued record of payment. Keep the receipt ID for reference.")}</p>
      </div>
    </section>:null}
  </section>;
}
