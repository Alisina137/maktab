"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { adminApi, friendlyAdminError, type Session } from "../../admin-client";
import { AdminLoader, AdminSkeleton } from "../../admin-loader";
import { AdminPasswordInput } from "../../admin-password-input";
import { useAdminWorkspace } from "../../admin-workspace";

type AdminProfile = {
  fullName: string;
  jobTitle: string | null;
  imageUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  officeLocation: string | null;
  officeHours: string | null;
  bio: string | null;
};

type ProfileResponse = {
  user: { username: string; role: string };
  profile: AdminProfile;
};

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function whatsappHref(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

const ADMIN_PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ADMIN_PROFILE_IMAGE_MAX_DIMENSION = 512;
const ADMIN_PROFILE_IMAGE_MAX_DATA_URL_LENGTH = 700_000;
const ADMIN_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function prepareAdminProfileImage(file: File): Promise<string> {
  if (!ADMIN_PROFILE_IMAGE_TYPES.has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > ADMIN_PROFILE_IMAGE_MAX_BYTES) {
    throw new Error("The profile image must be 5 MB or smaller.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("MaktabLink could not read that image file."));
      image.src = objectUrl;
    });

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("MaktabLink could not read that image file.");
    }

    const scale = Math.min(
      1,
      ADMIN_PROFILE_IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("MaktabLink could not prepare that image.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let quality = 0.84;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > ADMIN_PROFILE_IMAGE_MAX_DATA_URL_LENGTH && quality > 0.46) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    if (dataUrl.length > ADMIN_PROFILE_IMAGE_MAX_DATA_URL_LENGTH) {
      throw new Error("The prepared profile image is still too large. Choose a smaller image.");
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function AdminProfilePage() {
  const {
    stored,
    locale,
    t,
    showToast,
    updateSession,
    refreshAdminProfile,
    signOut
  } = useAdminWorkspace();
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [officeLocation, setOfficeLocation] = useState("");
  const [officeHours, setOfficeHours] = useState("");
  const [bio, setBio] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    void load();
  }, [stored.session.accessToken]);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  async function load() {
    setBusy(true);
    try {
      const result = await adminApi<ProfileResponse>("/v1/admin/profile", {
        headers: { Authorization: `Bearer ${stored.session.accessToken}` }
      });
      setFullName(result.profile.fullName);
      setJobTitle(result.profile.jobTitle ?? "");
      setImageUrl(result.profile.imageUrl ?? "");
      setImageFailed(false);
      setEmail(result.profile.email ?? "");
      setWhatsapp(result.profile.whatsapp ?? "");
      setPhone(result.profile.phone ?? "");
      setOfficeLocation(result.profile.officeLocation ?? "");
      setOfficeHours(result.profile.officeHours ?? "");
      setBio(result.profile.bio ?? "");
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
        body: JSON.stringify({
          fullName,
          jobTitle: optional(jobTitle),
          imageUrl: optional(imageUrl),
          email: optional(email),
          whatsapp: optional(whatsapp),
          phone: optional(phone),
          officeLocation: optional(officeLocation),
          officeHours: optional(officeHours),
          bio: optional(bio)
        })
      });

      setFullName(result.profile.fullName);
      setJobTitle(result.profile.jobTitle ?? "");
      setImageUrl(result.profile.imageUrl ?? "");
      setImageFailed(false);
      setEmail(result.profile.email ?? "");
      setWhatsapp(result.profile.whatsapp ?? "");
      setPhone(result.profile.phone ?? "");
      setOfficeLocation(result.profile.officeLocation ?? "");
      setOfficeHours(result.profile.officeHours ?? "");
      setBio(result.profile.bio ?? "");
      await refreshAdminProfile();

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

  async function chooseProfileImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImageProcessing(true);
    try {
      const prepared = await prepareAdminProfileImage(file);
      setImageUrl(prepared);
      setImageFailed(false);
      showToast({
        kind: "success",
        title: t("Profile image ready"),
        message: t("The image is ready in the preview. Save changes to keep it.")
      });
    } catch (cause) {
      showToast({
        kind: "error",
        title: t("Profile image was not selected"),
        message: cause instanceof Error ? t(cause.message) : t("Please choose another image.")
      });
    } finally {
      setImageProcessing(false);
    }
  }

  function removeProfileImage() {
    setImageUrl("");
    setImageFailed(false);
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast({
        kind: "error",
        title: t("Password was not changed"),
        message: t("New password and confirmation do not match.")
      });
      return;
    }

    setPasswordBusy(true);
    try {
      const result = await adminApi<Session>("/v1/auth/change-password", {
        method: "POST",
        headers: { Authorization: `Bearer ${stored.session.accessToken}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      updateSession(result);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast({
        kind: "success",
        title: t("Password changed"),
        message: t("Your administrator password has been updated securely.")
      });
    } catch (cause) {
      showToast({
        kind: "error",
        title: t("Password was not changed"),
        message: friendlyAdminError(cause, "Please review the passwords and try again.", locale)
      });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const contactPreview = useMemo(() => ({
    fullName: fullName.trim() || stored.session.user.username,
    jobTitle: jobTitle.trim(),
    email: email.trim(),
    whatsapp: whatsapp.trim(),
    phone: phone.trim(),
    officeLocation: officeLocation.trim(),
    officeHours: officeHours.trim(),
    bio: bio.trim()
  }), [bio, email, fullName, jobTitle, officeHours, officeLocation, phone, stored.session.user.username, whatsapp]);

  return (
    <section className="admin-profile-page admin-page-enter">
      <div className="admin-profile-grid">
        <article className="admin-panel admin-profile-card">
          <div className="admin-section-header">
            <div>
              <span className="admin-kicker">{t("Public school contact")}</span>
              <h3>{t("Administrator profile")}</h3>
              <p>{t("This contact information can be shown to parents, teachers, and students from the same school.")}</p>
            </div>
          </div>

          {!loaded && busy ? (
            <div className="admin-profile-loading">
              <AdminLoader label={t("Loading…")} />
              <AdminSkeleton rows={5} />
            </div>
          ) : (
            <form className="admin-form admin-profile-form" onSubmit={save}>
              <div className="admin-profile-form-grid">
                <label>
                  {t("Full name")}
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} maxLength={160} required />
                </label>
                <label>
                  {t("Position / title")}
                  <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={120} placeholder={t("Principal, administrator…")} />
                </label>
                <div className="admin-profile-wide admin-profile-image-field">
                  <label>
                    {t("Profile image URL")}
                    <input
                      value={imageUrl.startsWith("data:image/") ? "" : imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        setImageFailed(false);
                      }}
                      type="url"
                      maxLength={2048}
                      placeholder="https://..."
                    />
                  </label>
                  <div className="admin-profile-image-actions">
                    <label className="admin-secondary admin-profile-upload-button">
                      {t(imageProcessing ? "Preparing image…" : "Choose image from PC")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => void chooseProfileImage(event)}
                        disabled={imageProcessing || busy}
                      />
                    </label>
                    {imageUrl ? (
                      <button className="admin-secondary" type="button" onClick={removeProfileImage} disabled={busy || imageProcessing}>
                        {t("Remove image")}
                      </button>
                    ) : null}
                  </div>
                  <span className="admin-field-hint">
                    {imageUrl.startsWith("data:image/")
                      ? t("Image selected from this PC. Save changes to store it with the administrator profile.")
                      : t("Paste a direct web image URL or choose a JPG, PNG, or WebP file from this PC. Maximum file size: 5 MB.")}
                  </span>
                </div>
                <label>
                  {t("Public email")}
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={254} placeholder="admin@school.af" />
                </label>
                <label>
                  {t("WhatsApp")}
                  <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={32} placeholder="+937xxxxxxxx" />
                </label>
                <label>
                  {t("Phone")}
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} placeholder="07xxxxxxxx" />
                </label>
                <label>
                  {t("Office / location")}
                  <input value={officeLocation} onChange={(e) => setOfficeLocation(e.target.value)} maxLength={200} placeholder={t("Main administration office")} />
                </label>
                <label className="admin-profile-wide">
                  {t("Office hours")}
                  <input value={officeHours} onChange={(e) => setOfficeHours(e.target.value)} maxLength={160} placeholder={t("Saturday–Thursday, 08:00–14:00")} />
                </label>
                <label className="admin-profile-wide">
                  {t("Contact note / bio")}
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={1000} placeholder={t("A short message for families and teachers…")} />
                </label>
              </div>

              <button className="admin-primary" disabled={busy} type="submit">
                {t(busy ? "Saving…" : "Save changes")}
              </button>
            </form>
          )}
        </article>

        <aside className="admin-profile-side">
          <article className="admin-panel admin-contact-preview">
            <span className="admin-kicker">{t("Contact card preview")}</span>
            <div className="admin-contact-avatar">
              {imageUrl && !imageFailed ? (
                <img
                  key={imageUrl}
                  src={imageUrl}
                  alt=""
                  onLoad={() => setImageFailed(false)}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <span aria-hidden="true">{contactPreview.fullName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            {imageFailed && imageUrl ? (
              <p className="admin-profile-image-error">{t("The saved image could not be loaded. Check the image URL or choose an image from your PC.")}</p>
            ) : null}
            <h3>{contactPreview.fullName}</h3>
            {contactPreview.jobTitle ? <p className="admin-contact-title">{contactPreview.jobTitle}</p> : null}
            {contactPreview.bio ? <p className="admin-contact-bio">{contactPreview.bio}</p> : null}

            <div className="admin-contact-links">
              {contactPreview.email ? (
                <a href={`mailto:${contactPreview.email}`}>{t("Email")}: {contactPreview.email}</a>
              ) : null}
              {contactPreview.whatsapp ? (
                <a href={whatsappHref(contactPreview.whatsapp)} target="_blank" rel="noreferrer">
                  {t("WhatsApp")}: {contactPreview.whatsapp}
                </a>
              ) : null}
              {contactPreview.phone ? <a href={`tel:${contactPreview.phone}`}>{t("Phone")}: {contactPreview.phone}</a> : null}
              {contactPreview.officeLocation ? <span>{t("Office / location")}: {contactPreview.officeLocation}</span> : null}
              {contactPreview.officeHours ? <span>{t("Office hours")}: {contactPreview.officeHours}</span> : null}
            </div>
          </article>

          <article className="admin-panel admin-profile-card">
            <span className="admin-kicker">{t("Account information")}</span>
            <dl className="admin-profile-details">
              <div><dt>{t("Username")}</dt><dd>{stored.session.user.username}</dd></div>
              <div><dt>{t("Role")}</dt><dd>{t("School admin")}</dd></div>
              <div><dt>{t("School")}</dt><dd>{stored.school.name}</dd></div>
              <div><dt>{t("School code")}</dt><dd>{stored.school.code}</dd></div>
            </dl>
            <div className="admin-profile-signout">
              <button
                className="admin-secondary admin-profile-signout-button"
                type="button"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
              >
                {t("Sign out")}
              </button>
            </div>
          </article>
        </aside>
      </div>

      <article className="admin-panel admin-password-card">
        <div>
          <span className="admin-kicker">{t("Security")}</span>
          <h3>{t("Change my password")}</h3>
          <p>{t("Use this form for your own administrator password. Directory reset is intentionally disabled for the account you are currently using.")}</p>
        </div>
        <form className="admin-form admin-password-form" onSubmit={changePassword}>
          <label>
            {t("Current password")}
            <AdminPasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              showLabel={t("Show password")}
              hideLabel={t("Hide password")}
            />
          </label>
          <label>
            {t("New password")}
            <AdminPasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
              showLabel={t("Show password")}
              hideLabel={t("Hide password")}
            />
          </label>
          <label>
            {t("Confirm new password")}
            <AdminPasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
              showLabel={t("Show password")}
              hideLabel={t("Hide password")}
            />
          </label>
          <button className="admin-primary" disabled={passwordBusy} type="submit">
            {t(passwordBusy ? "Saving…" : "Change password")}
          </button>
        </form>
      </article>
    </section>
  );
}
