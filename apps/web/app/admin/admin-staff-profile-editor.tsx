"use client";

import { useEffect, useState, type FormEvent } from "react";
import { adminApi, friendlyAdminError } from "./admin-client";
import type { AdminLocale } from "./admin-i18n";

type StaffRecord = {
  fullName: string; employeeCode: string | null;
  position: string; department: string; permissions: string[];
};
type Payload = { profile: StaffRecord | null; permissionCatalog: string[]; positionCatalog: string[] };
const LABELS: Record<string,string> = {
  DIRECTORY_VIEW:"School directory — view",
  ENROLLMENT_REQUESTS:"Registration requests (future workflow)",
  ATTENDANCE_REVIEW:"Attendance review (future workflow)",
  FEES_VIEW:"Fee records — view (future workflow)",
  FEES_COLLECT:"Record payments (future workflow)",
  TASKS_VIEW:"Assigned tasks (future workflow)",
  COMMUNICATION_DRAFT:"Communication drafts (future workflow)",
  REPORTS_VIEW:"Operational reports (future workflow)"
};
/** Admin-only, deliberately separate from the staff web login.
 * These permissions grant only backend implemented actions, not admin rights.
 */
export function AdminStaffProfileEditor({userId, username, accessToken, locale, t}:{
  userId:string; username:string; accessToken:string; locale:AdminLocale;
  t:(text:string)=>string;
}) {
  const [catalog,setCatalog]=useState<Payload|null>(null);
  const [fullName,setFullName]=useState("");
  const [employeeCode,setEmployeeCode]=useState("");
  const [position,setPosition]=useState("RECEPTIONIST");
  const [department,setDepartment]=useState("");
  const [permissions,setPermissions]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [revision,setRevision]=useState(0);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");setSuccess("");setCatalog(null);
    void adminApi<Payload>(`/v1/admin/staff/${userId}/profile`,{
      headers:{Authorization:`Bearer ${accessToken}`},signal:controller.signal,cache:"no-store"
    }).then(data=>{
      if(controller.signal.aborted)return;
      setCatalog(data);
      setFullName(data.profile?.fullName ?? "");
      setEmployeeCode(data.profile?.employeeCode ?? "");
      setPosition(data.profile?.position ?? data.positionCatalog[0] ?? "RECEPTIONIST");
      setDepartment(data.profile?.department ?? "");
      setPermissions(data.profile?.permissions ?? []);
    }).catch(cause=>{
      if(!controller.signal.aborted)setError(friendlyAdminError(cause,"Staff profile could not be loaded.",locale));
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[userId,accessToken,locale,revision]);

  async function save(event:FormEvent) {
    event.preventDefault();if(!catalog || saving)return;
    setSaving(true);setError("");setSuccess("");
    try {
      const answer=await adminApi<{profile:StaffRecord}>(`/v1/admin/staff/${userId}/profile`,{
        method:"PUT",headers:{Authorization:`Bearer ${accessToken}`},
        body:JSON.stringify({
          fullName:fullName.trim(), employeeCode:employeeCode.trim()||null,
          position, department:department.trim(), permissions
        })
      });
      setPermissions(answer.profile.permissions);
      setSuccess(t("Staff profile saved. Existing staff sessions were revoked; sign in again."));
    } catch(cause) {
      setError(friendlyAdminError(cause,"Could not save staff profile.",locale));
    } finally {setSaving(false);}
  }
  return (
    <section className="account-detail-section staff-permissions-editor" aria-labelledby="staff-permission-title">
      <div className="staff-permissions-heading">
        <h3 id="staff-permission-title">{t("Staff position & permissions")}</h3>
        <button type="button" className="admin-secondary"
          disabled={saving} onClick={()=>setRevision(n=>n+1)}>{t("Refresh")}</button>
      </div>
      <p className="admin-copy">{t("Configure this staff member's own school responsibilities. Permissions never grant administrator access.")}</p>
      <p className="pilot-security-note">{t("No permissions are enabled until an administrator saves an assignment.")}</p>
      {loading?<p role="status">{t("Loading staff profile…")}</p>:null}
      {error?<p role="alert" className="admin-error">{error}</p>:null}
      {success?<p role="status" className="admin-success">{success}</p>:null}
      {catalog&&!loading?(
        <form className="staff-permissions-form" onSubmit={save}>
          <label>{t("Full name")}
            <input value={fullName} onChange={e=>setFullName(e.target.value)}
              required minLength={2} maxLength={160} autoComplete="off"/>
          </label>
          <label>{t("Employee code")}
            <input value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)}
              maxLength={32} pattern="[A-Za-z0-9_-]+" placeholder={t("Optional, unique within the school")}/>
          </label>
          <label>{t("Staff position")}
            <select value={position} onChange={e=>setPosition(e.target.value)} required>
              {catalog.positionCatalog.map(item=>
                <option key={item} value={item}>{t(item.replaceAll("_"," ").toLowerCase())}</option>)}
            </select>
          </label>
          <label>{t("Department")}
            <input value={department} onChange={e=>setDepartment(e.target.value)}
              required minLength={2} maxLength={100}/>
          </label>
          <fieldset className="staff-permissions-fieldset">
            <legend>{t("Assigned permissions")}</legend>
            {catalog.permissionCatalog.map(permission=>(
              <label key={permission} className="staff-permission-checkbox">
                <input type="checkbox" checked={permissions.includes(permission)}
                  onChange={e=>setPermissions(current=>e.target.checked
                    ? [...current,permission] : current.filter(p=>p!==permission))}/>
                <span>{t(LABELS[permission]??permission)}</span>
              </label>
            ))}
          </fieldset>
          <p className="pilot-security-note">{t("Future workflow permissions are reserved; only implemented endpoints are accessible. Saving revokes active staff sessions.")}</p>
          <button type="submit" className="admin-primary" disabled={saving}>
            {t(saving?"Saving…":"Save staff assignment")}
          </button>
        </form>
      ):null}
      <p className="pilot-security-note">{t("Staff sign-in")}: /staff · @{username}</p>
    </section>
  );
}
