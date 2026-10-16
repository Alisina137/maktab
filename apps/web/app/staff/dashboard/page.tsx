"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminApi, friendlyAdminError, type Session } from "../../admin/admin-client";
import { AdminPasswordInput } from "../../admin/admin-password-input";
import {
  ADMIN_DEFAULT_LOCALE, adminDirection, adminLocaleOptions, adminText,
  readAdminLocale, saveAdminLocale, type AdminLocale
} from "../../admin/admin-i18n";
import { clearStaffSession, readStaffSession, storeStaffSession, type StaffSession } from "../staff-client";
import { StaffHomePanel } from "../staff-home-panel";

type StaffMe={user:{id:string;username:string;role:"SCHOOL_STAFF";status:string};
  school:{id:string;name:string;code:string};
  profile:{fullName:string;employeeCode:string|null;position:string;
    department:string;permissions:string[]} | null};
type Match={username:string;fullName:string;code:string|null;
  role:"STUDENT"|"PARENT"|"TEACHER";status:string};
type Directory={entries:Match[];total:number;page:number;pages:number;pageSize:number};
type Group="STUDENT"|"PARENT"|"TEACHER";
export default function StaffDashboard() {
  const router=useRouter();
  const [locale,setLocale]=useState<AdminLocale>(ADMIN_DEFAULT_LOCALE);
  const [tab,setTab]=useState<"home"|"directory"|"settings">("home");
  const [stored,setStored]=useState<StaffSession|null>(null);
  const current=useRef<StaffSession|null>(null);
  const [profile,setProfile]=useState<StaffMe|null>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState("");
  const [group,setGroup]=useState<Group>("STUDENT");
  const [status,setStatus]=useState<"ALL"|"ACTIVE"|"INVITED"|"SUSPENDED"|"ARCHIVED">("ALL");
  const [sortBy,setSortBy]=useState<"name"|"username">("name");
  const [order,setOrder]=useState<"asc"|"desc">("asc");
  const [pageSize,setPageSize]=useState<10|20>(10);
  const [selected,setSelected]=useState<Match|null>(null);
  const [query,setQuery]=useState("");
  const [submitted,setSubmitted]=useState("");
  const [page,setPage]=useState(1);
  const [directory,setDirectory]=useState<Directory|null>(null);
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [passwordBusy,setPasswordBusy]=useState(false);
  const [passwordNotice,setPasswordNotice]=useState("");
  const t=(s:string)=>adminText(locale,s);
  const canDirectory=profile?.profile?.permissions?.includes("DIRECTORY_VIEW")===true;
  const tabs=[
    {id:"home" as const,label:"Home"},
    ...(canDirectory?[{id:"directory" as const,label:"Directory"}]:[]),
    {id:"settings" as const,label:"Profile & Settings"}
  ];
  const number=(v:number)=>new Intl.NumberFormat(locale==="en"?"en-US":locale).format(v);
  const exit=useCallback(()=>{
    current.current=null;clearStaffSession();setStored(null);setProfile(null);
    router.replace("/staff");
  },[router]);

  const authenticated=useCallback(async <T,>(path:string, init:RequestInit={}):Promise<T>=>{
    let value=current.current;
    if(!value || value.session.user.role!=="SCHOOL_STAFF") throw Error("Staff login is required.");
    // Refresh slightly before expiry. A revoked/suspended user cannot read
    // staff records; every API call performs role and school validation.
    const deadline=Date.parse(value.session.accessExpiresAt??"");
    if(!Number.isFinite(deadline) || deadline<=Date.now()+30_000){
      try{
        const next=await adminApi<Session>("/v1/auth/refresh",{
          method:"POST",body:JSON.stringify({refreshToken:value.session.refreshToken})
        });
        if(next.user.role!=="SCHOOL_STAFF" || next.mustChangePassword ||
           next.user.status!=="ACTIVE")throw Error("Staff login is required.");
        value={...value,session:next};
        storeStaffSession(value);current.current=value;setStored(value);
      }catch{exit();throw Error("Your staff session has expired.");}
    }
    try{
      return await adminApi<T>(path,{...init,headers:{
        ...init.headers,Authorization:`Bearer ${value.session.accessToken}`
      },cache:"no-store"});
    }catch(cause){
      if(cause && typeof cause==="object" && "status" in cause) {
        const failure=cause as {status:number;code?:string};
        const sessionBlocked = [401,403,503].includes(failure.status) &&
          !(path==="/v1/auth/change-password" &&
            failure.status===401 && failure.code==="current_password_invalid");
        // An incorrect current password is a form error, not a revoked session.
        // Revoked, suspended and unavailable staff accounts still leave immediately.
        if(sessionBlocked)exit();
      }
      throw cause;
    }
  },[exit]);

  useEffect(()=>{
    setLocale(readAdminLocale());
    const value=readStaffSession();
    if(!value){router.replace("/staff");return;}
    current.current=value;setStored(value);
    let active=true;
    void authenticated<StaffMe>("/v1/staff/me").then(data=>{
      if(active){setProfile(data);setMessage("");}
    }).catch(cause=>{
      if(active)setMessage(cause instanceof Error?cause.message:"Could not verify staff account.");
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[authenticated,router]);
  useEffect(()=>{
    document.documentElement.lang=locale==="en"?"en":locale==="ps-AF"?"ps":"fa";
    document.documentElement.dir=adminDirection(locale);
  },[locale]);

  useEffect(()=>{
    if(!submitted)return;
    let active=true;
    setWorking(true);setDirectory(null);setMessage("");setSelected(null);
    const params=new URLSearchParams({query:submitted,group,status,sortBy,order,
      pageSize:String(pageSize),page:String(page)});
    void authenticated<Directory>("/v1/staff/directory?"+params).then(data=>{
      if(active)setDirectory(data);
    }).catch(cause=>{
      if(active)setMessage(friendlyAdminError(cause,"Could not search school records.",locale));
    }).finally(()=>{if(active)setWorking(false);});
    return()=>{active=false;};
  },[submitted,group,status,sortBy,order,pageSize,page,authenticated,locale]);

  async function signOut(){
    const value=current.current;exit();
    if(value)await adminApi("/v1/auth/logout",{method:"POST",
      body:JSON.stringify({refreshToken:value.session.refreshToken})}).catch(()=>null);
  }
  async function changePassword(e:FormEvent){
    e.preventDefault();setPasswordBusy(true);setPasswordNotice("");
    try{
      const next=await authenticated<Session>("/v1/auth/change-password",{
        method:"POST",body:JSON.stringify({currentPassword,newPassword})
      });
      const old=current.current;
      if(!old)throw Error("Staff session has expired.");
      const replacement={...old,session:next};
      storeStaffSession(replacement);current.current=replacement;setStored(replacement);
      setCurrentPassword("");setNewPassword("");
      setPasswordNotice(t("Password updated successfully."));
    }catch(cause){
      setPasswordNotice(friendlyAdminError(cause,"Could not change password.",locale));
    }finally{setPasswordBusy(false);}
  }
  function search(e:FormEvent){
    e.preventDefault();
    if(query.trim().length<2)return;
    setPage(1);setSubmitted(query.trim());
  }
  if(!stored || loading)return (
    <main className="admin-shell staff-shell" dir={adminDirection(locale)}>
      <div className="admin-panel" role="status">{t("Checking staff access…")}</div>
    </main>
  );
  if(!profile)return (
    <main className="admin-shell staff-shell" dir={adminDirection(locale)}>
      <div className="admin-error" role="alert">{message||t("Staff access is unavailable.")}</div>
      <button className="admin-secondary" onClick={exit}>{t("Back to staff sign in")}</button>
    </main>
  );
  return(
    <main className="admin-shell staff-shell" dir={adminDirection(locale)}>
      <header className="staff-header admin-panel">
        <div className="staff-header-brand">
          <span className="admin-brand-mark" aria-hidden="true">M</span>
          <div><strong>MaktabLink</strong><small>{t("School Staff Portal")}</small></div>
        </div>
        <div className="staff-header-actions">
          <label>{t("Language")}
            <select value={locale} onChange={e=>{
              const next=e.target.value as AdminLocale;
              setLocale(next);saveAdminLocale(next);
            }}>{adminLocaleOptions.map(v=><option value={v.value} key={v.value}>{v.label}</option>)}</select>
          </label>
          <button type="button" className="admin-secondary" onClick={()=>void signOut()}>{t("Sign out")}</button>
        </div>
      </header>
      <section className="staff-hero">
        <span className="eyebrow">{t("Staff workspace")}</span>
        <h1>{t("Welcome back")}, {profile.profile?.fullName || profile.user.username}</h1>
        <p>{t("Find school records for front-desk assistance. Account creation, grades, fees and administrative settings remain administrator-only.")}</p>
        <div className="staff-school-badge">{profile.school.name} · {profile.school.code}
          {profile.profile ? ` · ${t(profile.profile.position.replaceAll("_"," ").toLowerCase())}` : ""}
        </div>
      </section>
      <nav className="staff-workspace-nav" aria-label={t("Staff workspace navigation")}>
        {tabs.map(item => (
          <button type="button" key={item.id} className={tab===item.id?"staff-nav-active":""}
            aria-pressed={tab===item.id} onClick={()=>setTab(item.id)}>{t(item.label)}</button>
        ))}
      </nav>
      {tab==="home" ? <StaffHomePanel locale={locale} school={profile.school}
        displayName={profile.profile?.fullName || profile.user.username}
        position={profile.profile?.position ?? null}
        department={profile.profile?.department ?? null}
        permissions={profile.profile?.permissions ?? []}
        onDirectory={()=>setTab("directory")} onSettings={()=>setTab("settings")}/> : null}
      {tab==="directory" ? <div className="staff-workspace-grid staff-directory-layout">
        {canDirectory ? (
        <section className="admin-panel staff-directory">
          <div className="admin-section-header">
            <div>
              <span className="eyebrow">{t("Daily staff work")}</span>
              <h2>{t("School directory lookup")}</h2>
              <p>{t("Search a student, parent or teacher by name, username or school code.")}</p>
            </div>
          </div>
          <form onSubmit={search} className="staff-search">
            <label>{t("Account type")}
              <select value={group} onChange={e=>{
                setGroup(e.target.value as Group);setPage(1);setSubmitted("");setDirectory(null);
              }}>
                <option value="STUDENT">{t("Students")}</option>
                <option value="PARENT">{t("Parents")}</option>
                <option value="TEACHER">{t("Teachers")}</option>
              </select>
            </label>
            <label>{t("Search")}
              <input type="search" value={query} minLength={2} maxLength={80}
                onChange={e=>setQuery(e.target.value)}
                placeholder={t("Enter at least two characters")} required/>
            </label>
            <label>{t("Account status")}
              <select value={status} onChange={e=>{setStatus(e.target.value as typeof status);setPage(1);}}>
                <option value="ALL">{t("All statuses")}</option>
                <option value="ACTIVE">{t("Active")}</option>
                <option value="INVITED">{t("Invited")}</option>
                <option value="SUSPENDED">{t("Suspended")}</option>
                <option value="ARCHIVED">{t("Archived")}</option>
              </select>
            </label>
            <label>{t("Sort by")}
              <select value={sortBy} onChange={e=>{setSortBy(e.target.value as typeof sortBy);setPage(1);}}>
                <option value="name">{t("Full name")}</option>
                <option value="username">{t("Username")}</option>
              </select>
            </label>
            <label>{t("Order")}
              <select value={order} onChange={e=>{setOrder(e.target.value as typeof order);setPage(1);}}>
                <option value="asc">{t("Ascending")}</option>
                <option value="desc">{t("Descending")}</option>
              </select>
            </label>
            <label>{t("Results per page")}
              <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value) as 10|20);setPage(1);}}>
                <option value={10}>10</option><option value={20}>20</option>
              </select>
            </label>
            <div className="staff-directory-actions">
              <button type="submit" className="admin-primary" disabled={working || query.trim().length<2}>
                {t(working?"Searching…":"Find records")}
              </button>
              <button type="button" className="admin-secondary"
                onClick={()=>{setQuery("");setSubmitted("");setStatus("ALL");setSortBy("name");setOrder("asc");
                  setGroup("STUDENT");setPageSize(10);setPage(1);setSelected(null);setDirectory(null);setMessage("");}}>
                {t("Clear filters")}
              </button>
            </div>
          </form>
          {message?<p className="admin-error" role="alert">{message}</p>:null}
          {working?<p role="status">{t("Searching school records…")}</p>:null}
          {!submitted?<div className="staff-empty">
            {t("Enter a name or code to find accounts in your school.")}
          </div>:null}
          {!working&&directory?(
            <div>
              <p className="pilot-security-note">
                {number(directory.total)} {t("matching school records")}
              </p>
              {directory.entries.length?(
                <div className="staff-lookup-list">
                  {directory.entries.map(row=>(
                    <button key={row.role+row.username} type="button" className="staff-lookup-row staff-lookup-button"
                      onClick={()=>setSelected(current=>current?.username===row.username?null:row)}
                      aria-expanded={selected?.username===row.username}>
                      <span className="staff-lookup-ident"><strong>{row.fullName}</strong>
                        <small>@{row.username}{row.code?" · "+row.code:""}</small></span>
                      <span className="pilot-badge">{t(row.status)}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              ):<p>{t("No matching records in your school.")}</p>}
              {selected ? <section className="staff-record-details admin-panel" aria-label={t("Account details")}>
                <div className="admin-section-header">
                  <div><span className="eyebrow">{t("Read-only school record")}</span>
                    <h3>{selected.fullName}</h3></div>
                  <button type="button" className="admin-secondary"
                    onClick={()=>setSelected(null)}>{t("Close")}</button>
                </div>
                <dl className="pilot-detail-grid">
                  <div><dt>{t("Username")}</dt><dd>{selected.username}</dd></div>
                  <div><dt>{t("Role")}</dt><dd>{t(selected.role)}</dd></div>
                  <div><dt>{t("Status")}</dt><dd>{t(selected.status)}</dd></div>
                  <div><dt>{t("Record code")}</dt><dd>{selected.code || "—"}</dd></div>
                </dl>
                <p className="pilot-security-note">{t("Only basic directory fields are available. Contacts, family links, grades and fees require separate approved permissions.")}</p>
              </section> : null}
              <nav className="staff-pages" aria-label={t("Directory pages")}>
                <button className="admin-secondary" type="button" disabled={working||page<=1}
                  onClick={()=>setPage(x=>Math.max(1,x-1))}>{t("Previous")}</button>
                <span>{number(page)} / {number(directory.pages)}</span>
                <button className="admin-secondary" type="button"
                  disabled={working||page>=directory.pages}
                  onClick={()=>setPage(x=>x+1)}>{t("Next")}</button>
              </nav>
            </div>
          ):null}
          <p className="pilot-security-note">
            {t("This is a limited lookup, not an administrator directory. Private contacts and student family relationships are not shown.")}
          </p>
        </section>
        ) : (
          <section className="admin-panel staff-directory" role="status">
            <h2>{t("Directory access not assigned")}</h2>
            <p>{t("Ask your school administrator to assign the directory permission. Your staff account remains separate from the admin dashboard.")}</p>
          </section>
        )}
      </div> : null}
      {tab==="settings" ? <div className="staff-workspace-grid staff-settings-layout">
        <aside className="staff-side">
          <section className="admin-panel staff-security">
            <h2>{t("My staff account")}</h2>
            <dl className="pilot-detail-grid">
              <div><dt>{t("Username")}</dt><dd>{profile.user.username}</dd></div>
              <div><dt>{t("Role")}</dt><dd>{t("School staff")}</dd></div>
              <div><dt>{t("School")}</dt><dd>{profile.school.name}</dd></div>
              <div><dt>{t("Status")}</dt><dd>{t(profile.user.status)}</dd></div>
              <div><dt>{t("Position")}</dt><dd>{profile.profile
                ? t(profile.profile.position.replaceAll("_"," ").toLowerCase()) : "—"}</dd></div>
              <div><dt>{t("Department")}</dt><dd>{profile.profile?.department || "—"}</dd></div>
              <div><dt>{t("Employee code")}</dt><dd>{profile.profile?.employeeCode || "—"}</dd></div>
              <div><dt>{t("Assigned permissions")}</dt><dd>{profile.profile?.permissions.length ?? 0}</dd></div>
            </dl>
          </section>
          <section className="admin-panel staff-security">
            <h2>{t("Change my password")}</h2>
            <form className="admin-form" onSubmit={changePassword}>
              <label>{t("Current password")}
                <AdminPasswordInput value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}
                  autoComplete="current-password" required
                  showLabel={t("Show password")} hideLabel={t("Hide password")}/>
              </label>
              <label>{t("New password")}
                <AdminPasswordInput value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                  autoComplete="new-password" minLength={8} required
                  showLabel={t("Show password")} hideLabel={t("Hide password")}/>
              </label>
              <button type="submit" className="admin-secondary" disabled={passwordBusy}>
                {t(passwordBusy?"Saving…":"Update password")}
              </button>
            </form>
            {passwordNotice?<p role="status">{passwordNotice}</p>:null}
          </section>
        </aside>
      </div> : null}
    </main>
  );
}
