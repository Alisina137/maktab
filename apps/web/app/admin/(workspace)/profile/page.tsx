"use client";

import { useEffect, useState, type FormEvent } from "react";
import { adminApi, friendlyAdminError } from "../../admin-client";
import { AdminLoader, AdminSkeleton } from "../../admin-loader";
import { useAdminWorkspace } from "../../admin-workspace";

type ProfileResponse = {
  user: { username: string; role: string };
  profile: { fullName: string; phone: string | null };
};

export default function AdminProfilePage() {
  const { stored, locale, t, showToast } = useAdminWorkspace();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void load();
  }, [stored.session.accessToken]);

  async function load() {
    setBusy(true);
    try {
      const result = await adminApi<ProfileResponse>("/v1/admin/profile", {
        headers: { Authorization: `Bearer ${stored.session.accessToken}` }
      });
      setFullName(result.profile.fullName);
      setPhone(result.profile.phone ?? "");
      setLoaded(true);
    } catch (cause) {
      showToast({
        kind: "error",
        title: t("Profile could not be loaded"),
        message: friendlyAdminError(cause, "Please try again.", locale)
      });
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await adminApi<ProfileResponse>("/v1/admin/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${stored.session.accessToken}` },
        body: JSON.stringify({ fullName, phone: phone.trim() || null })
      });
      setFullName(result.profile.fullName);
      setPhone(result.profile.phone ?? "");
      showToast({
        kind: "success",
        title: t("Profile updated"),
        message: t("Your administrator profile has been saved.")
      });
    } catch (cause) {
      showToast({
        kind: "error",
        title: t("Profile was not updated"),
        message: friendlyAdminError(cause, "Please review the profile information and try again.", locale)
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-profile-grid admin-page-enter">
      <article className="admin-panel admin-profile-card">
        <div className="admin-section-header">
          <div>
            <span className="admin-kicker">{t("Personal details")}</span>
            <h3>{t("Administrator profile")}</h3>
            <p>{t("Edit the profile information shown for your administrator account.")}</p>
          </div>
        </div>

        {!loaded && busy ? (
          <div className="admin-profile-loading">
            <AdminLoader label={t("Loading…")} />
            <AdminSkeleton rows={3} />
          </div>
        ) : (
          <form className="admin-form admin-profile-form" onSubmit={save}>
            <label>
              {t("Full name")}
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} maxLength={160} required />
            </label>
            <label>
              {t("Phone")}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} placeholder="07xxxxxxxx" />
            </label>
            <button className="admin-primary" disabled={busy} type="submit">
              {t(busy ? "Saving…" : "Save changes")}
            </button>
          </form>
        )}
      </article>

      <article className="admin-panel admin-profile-card">
        <span className="admin-kicker">{t("Account information")}</span>
        <dl className="admin-profile-details">
          <div><dt>{t("Username")}</dt><dd>{stored.session.user.username}</dd></div>
          <div><dt>{t("Role")}</dt><dd>{t("School admin")}</dd></div>
          <div><dt>{t("School")}</dt><dd>{stored.school.name}</dd></div>
          <div><dt>{t("School code")}</dt><dd>{stored.school.code}</dd></div>
        </dl>
      </article>
    </section>
  );
}
