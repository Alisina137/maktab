"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { AdminLocale } from "../admin/admin-i18n";
import { friendlyAdminError } from "../admin/admin-client";
import { staffWorkText } from "./staff-work-i18n";
import "./staff-work.css";

export type StaffPreferences={showNotificationBadge:boolean;compactTaskView:boolean};
export const DEFAULT_STAFF_PREFERENCES:StaffPreferences={
  showNotificationBadge:true,compactTaskView:false
};
export function StaffWorkPreferences({locale,api,onSaved}:{
  locale:AdminLocale;api:<T>(path:string,init?:RequestInit)=>Promise<T>;
  onSaved?:(value:StaffPreferences)=>void;
}){
  const t=(key:string)=>staffWorkText(locale,key);
  const [prefs,setPrefs]=useState<StaffPreferences>(DEFAULT_STAFF_PREFERENCES);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let active=true;setLoading(true);
    void api<{preferences:StaffPreferences}>("/v1/staff/work-preferences").then(({preferences})=>{
      if(active){setPrefs(preferences);onSaved?.(preferences);}
    }).catch(e=>{
      if(active)setError(friendlyAdminError(e,"Could not load preferences.",locale));
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  // Preferences belong to the authenticated session; onSaved is a state-setter.
  },[api,locale,onSaved]);
  async function save(e:FormEvent){
    e.preventDefault();if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const result=await api<{preferences:StaffPreferences}>("/v1/staff/work-preferences",{
        method:"PUT",body:JSON.stringify(prefs)
      });
      setPrefs(result.preferences);onSaved?.(result.preferences);setNotice(t("Preferences saved."));
    }catch(e){setError(friendlyAdminError(e,"Could not save preferences.",locale));}
    finally{setBusy(false);}
  }
  return <section className="admin-panel staff-work-settings">
    <h2>{t("Workspace preferences")}</h2>
    {error?<p className="admin-error" role="alert">{error}</p>:null}
    {notice?<p className="staff-reg-success" role="status">{notice}</p>:null}
    {loading?<p role="status">{t("Loading staff work…")}</p>:<form className="admin-form" onSubmit={save}>
      <label className="staff-work-toggle">
        <input type="checkbox" checked={prefs.showNotificationBadge}
          onChange={e=>setPrefs(prev=>({...prev,showNotificationBadge:e.target.checked}))}/>
        {t("Show unread notifications on Home")}
      </label>
      <label className="staff-work-toggle">
        <input type="checkbox" checked={prefs.compactTaskView}
          onChange={e=>setPrefs(prev=>({...prev,compactTaskView:e.target.checked}))}/>
        {t("Compact task cards")}
      </label>
      <button className="admin-secondary" disabled={busy}>{t("Save preferences")}</button>
    </form>}
  </section>;
}
