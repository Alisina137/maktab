"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminApi, friendlyAdminError, type School, type Session } from "../admin/admin-client";
import { AdminPasswordInput } from "../admin/admin-password-input";
import {
  ADMIN_DEFAULT_LOCALE, adminDirection, adminLocaleOptions, adminText,
  readAdminLocale, saveAdminLocale, type AdminLocale
} from "../admin/admin-i18n";
import { readStaffSession, storeStaffSession } from "./staff-client";

export default function StaffLoginPage() {
  const router=useRouter();
  const [locale,setLocale]=useState<AdminLocale>(ADMIN_DEFAULT_LOCALE);
  const [schools,setSchools]=useState<School[]>([]);
  const [schoolId,setSchoolId]=useState("");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [pending,setPending]=useState<Session|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const t=(word:string)=>adminText(locale,word);
  const school=schools.find(x=>x.id===schoolId);

  useEffect(()=>{
    setLocale(readAdminLocale());
    if(readStaffSession()){router.replace("/staff/dashboard");return;}
    let active=true;
    void adminApi<{schools:School[]}>("/v1/public/schools").then(data=>{
      if(!active)return;
      setSchools(data.schools);setSchoolId(data.schools[0]?.id??"");
    }).catch(()=>{if(active)setError("Could not load schools. Please try again.");});
    return()=>{active=false;};
  },[router]);
  useEffect(()=>{
    document.documentElement.lang=locale==="en"?"en":locale==="ps-AF"?"ps":"fa";
    document.documentElement.dir=adminDirection(locale);
  },[locale]);

  async function signIn(e:FormEvent){
    e.preventDefault();if(!school)return;
    setBusy(true);setError("");
    try {
      const result=await adminApi<Session>("/v1/auth/login",{method:"POST",
        body:JSON.stringify({schoolId,expectedRole:"SCHOOL_STAFF",username,password})});
      setPassword("");
      if(result.user.role!=="SCHOOL_STAFF")throw new Error("Access denied.");
      if(result.mustChangePassword){setPending(result);return;}
      storeStaffSession({session:result,school});
      router.replace("/staff/dashboard");
    } catch(cause){setError(friendlyAdminError(cause,"Please check your school, username and password.",locale));}
    finally{setBusy(false);}
  }
  async function activate(e:FormEvent){
    e.preventDefault();if(!pending||!school)return;
    setBusy(true);setError("");
    try{
      const result=await adminApi<Session>("/v1/auth/change-temporary-password",{
        method:"POST",headers:{Authorization:`Bearer ${pending.accessToken}`},
        body:JSON.stringify({newPassword})
      });
      storeStaffSession({session:result,school});
      setNewPassword("");setPending(null);
      router.replace("/staff/dashboard");
    } catch(cause){setError(friendlyAdminError(cause,"Unable to set your password.",locale));}
    finally{setBusy(false);}
  }
  return(
    <main className="admin-shell admin-shell-premium admin-auth-shell" dir={adminDirection(locale)}>
      <section className="admin-auth-hero">
        <div className="admin-auth-brand">
          <span className="admin-brand-mark" aria-hidden="true">M</span>
          <div><strong>MaktabLink</strong><span>{t("School Staff Portal")}</span></div>
        </div>
        <div className="admin-login-language">
          <label><span>{t("Language")}</span>
            <select value={locale} onChange={e=>{
              const next=e.target.value as AdminLocale;
              setLocale(next);saveAdminLocale(next);
            }}>
              {adminLocaleOptions.map(l=><option value={l.value} key={l.value}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <div className="admin-auth-copy">
          <span className="admin-kicker">{t("Staff-only web access")}</span>
          <h1>{t("Welcome to your school staff workspace.")}</h1>
          <p>{t("Use the credentials created by your school administrator. Staff work is separate from the administrator website and student, parent and teacher mobile app.")}</p>
        </div>
        <div className="admin-auth-feature-grid">
          <div><strong>{t("Your school")}</strong><span>{t("School-scoped access")}</span></div>
          <div><strong>{t("Directory")}</strong><span>{t("Find school accounts")}</span></div>
          <div><strong>{t("Secure")}</strong><span>{t("Role-specific staff access")}</span></div>
        </div>
      </section>
      <section className="admin-panel admin-login-panel admin-login-premium">
        <div className="admin-login-heading">
          <span className="admin-kicker">{t("Staff account")}</span>
          <h2>{t(pending?"Choose a new password":"Staff sign in")}</h2>
          <p>{t(pending?"Your temporary password must be changed before you can open staff records.":"Choose your school and enter your staff credentials.")}</p>
        </div>
        {error?<div className="admin-error" role="alert">{t(error)}</div>:null}
        {pending?(
          <form className="admin-form admin-form-premium" onSubmit={activate}>
            <label>{t("New password")}
              <AdminPasswordInput value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                autoComplete="new-password" minLength={8} required
                showLabel={t("Show password")} hideLabel={t("Hide password")}/>
            </label>
            <button type="submit" className="admin-primary admin-primary-large" disabled={busy}>
              {t(busy?"Saving…":"Save private password")}
            </button>
          </form>
        ):(
          <form className="admin-form admin-form-premium" onSubmit={signIn}>
            <label>{t("School")}
              <select value={schoolId} onChange={e=>setSchoolId(e.target.value)} required>
                <option value="">{t("Select a school")}</option>
                {schools.map(s=><option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}
              </select>
            </label>
            <label>{t("Username")}
              <input value={username} onChange={e=>setUsername(e.target.value)}
                autoComplete="username" required/>
            </label>
            <label>{t("Password")}
              <AdminPasswordInput value={password} onChange={e=>setPassword(e.target.value)}
                autoComplete="current-password" required
                showLabel={t("Show password")} hideLabel={t("Hide password")}/>
            </label>
            <button type="submit" className="admin-primary admin-primary-large" disabled={busy||!schoolId}>
              {t(busy?"Signing in…":"Sign in to staff dashboard")}
            </button>
          </form>
        )}
        <p className="admin-login-footnote">{t("Only school staff accounts can use this portal.")}</p>
      </section>
    </main>
  );
}
