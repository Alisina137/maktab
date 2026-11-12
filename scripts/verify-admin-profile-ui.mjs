import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const frame = read("apps/web/app/admin/admin-dashboard-frame.tsx");
const dashboardCss = read("apps/web/app/admin/dashboard-shell.css");
const profile = read("apps/web/app/admin/(workspace)/profile/page.tsx");
const css = read("apps/web/app/admin/profile-redesign.css");
const translations = read("apps/web/app/admin/admin-i18n.ts");

// The header must be avatar-only on all breakpoints, without losing access,
// keyboard support, the fallback initial or the full accessible name.
const avatarLinkStart = frame.indexOf('href="/admin/profile" className="ml-admin-topbar-user"');
const avatarLinkEnd = frame.indexOf("</Link>", avatarLinkStart);
assert.ok(avatarLinkStart > -1 && avatarLinkEnd > avatarLinkStart);
const avatarLink = frame.slice(avatarLinkStart, avatarLinkEnd);
assert.ok(avatarLink.includes('title={t("Administrator profile")}') &&
  avatarLink.includes('aria-label={t("Administrator profile")}') &&
  avatarLink.includes('<UserAvatar name={userName} url={adminProfile.imageUrl} />') &&
  !avatarLink.includes('userName.split') &&
  !avatarLink.includes('name="chevron"'),
  "The top-right account link must contain only a labeled avatar.");
assert.ok(dashboardCss.includes(".ml-admin-topbar-user:focus-visible") &&
  dashboardCss.includes("border-radius: 50%") &&
  dashboardCss.includes(".ml-admin-topbar-user:hover"),
  "Avatar-only header must have visible hover and keyboard-focus states.");

// The editor is one actual form, with clear sections and unchanged API behavior.
assert.ok(profile.includes('import "../../profile-redesign.css"') &&
  profile.includes('className="admin-profile-page admin-page-enter ml-profile-redesign"') &&
  profile.includes('className="ml-profile-cover"') &&
  !profile.includes('className="ml-profile-navigation"') &&
  !profile.includes('href="#ml-profile-') &&
  profile.includes('className="ml-profile-private-section"') &&
  profile.includes('className="ml-profile-private-grid"') &&
  profile.includes('aria-labelledby="ml-profile-private-heading"') &&
  profile.includes('aria-label={t("Contact card preview")}') &&
  profile.includes('id="ml-profile-edit"') &&
  profile.includes('id="ml-profile-preview"') &&
  profile.includes('id="ml-profile-account"') &&
  profile.includes('id="ml-profile-security"') &&
  profile.includes('className="ml-profile-save-row"') &&
  profile.includes('className="ml-profile-live-pill"') &&
  profile.includes('className="admin-panel admin-profile-card ml-profile-account"'),
  "Profile cover, editor/preview and separate account/security layout must stay intact.");
for (const label of ["Personal details", "Profile picture", "Contact details", "Office & availability"]) {
  assert.ok(profile.includes('t("' + label + '")'), "Profile form missing section: " + label);
}
for (const marker of [
  'onSubmit={save}', 'onChange={(event) => void chooseProfileImage(event)}',
  'onClick={removeProfileImage}', 'method: "PATCH"', '"/v1/admin/profile"',
  'await refreshAdminProfile()', 'passwordVerificationStep === "START"',
  'passwordVerificationStep === "CODES"', 'passwordVerificationStep === "VERIFIED"',
  'onSubmit={startPasswordVerification}', 'onSubmit={verifyPasswordCodes}',
  'onSubmit={changePassword}', 'updateSession(result)'
]) {
  assert.ok(profile.includes(marker), "Existing secure profile behavior lost: " + marker);
}
for (const marker of [
  ".ml-profile-cover", ".ml-profile-private-section", ".ml-profile-private-grid", ".ml-profile-form-heading",
  ".ml-profile-save-row", ".ml-profile-preview-top", ".ml-profile-account",
  ".ml-profile-security", "@media (max-width: 950px)",
  "@media (max-width: 700px)", "scroll-margin-top",
  "prefers-reduced-motion"
]) {
  assert.ok(css.includes(marker), "Responsive profile styling missing: " + marker);
}
for (const key of [
  "Private settings", "Account & security",
  "Manage account access and password separately from your school contact details.",
  "Profile details", "Your name and position at the school.",
  "Profile picture", "Contact details", "Office & availability",
  "Your contact card preview updates as you type. Save to apply your changes.",
  "Live preview", "Add your contact details to see them here.",
  "School account", "Your school sign-in and access details."
]) {
  assert.equal(translations.split(JSON.stringify(key) + ":").length, 3,
    "Administrator profile must remain bilingual (Dari/Pashto): " + key);
}
console.log("Admin profile redesigned: no four-link navigation, separated contact/private sections, RTL translations, live preview and secure password flow.");
