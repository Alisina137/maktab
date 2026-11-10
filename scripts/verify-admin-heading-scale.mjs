import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../apps/web/app/admin/admin-workspace.tsx", import.meta.url), "utf8");
const frame = readFileSync(new URL("../apps/web/app/admin/admin-dashboard-frame.tsx", import.meta.url), "utf8");
const dashboardCss = readFileSync(new URL("../apps/web/app/admin/dashboard-shell.css", import.meta.url), "utf8");
const communication = readFileSync(new URL("../apps/web/app/admin/communication-panel.tsx", import.meta.url), "utf8");

function block(selector) {
  const escaped = selector.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(escaped + "\\s*\\{([^}]*)\\}"));
  assert.ok(match, "Missing CSS heading selector: " + selector);
  return match[1];
}

assert.match(block(".admin-school-identity h1"), /font-size:\s*clamp\(22\.4px,\s*2\.8vw,\s*33\.6px\)/);
assert.match(block(".admin-school-identity p"), /font-size:\s*12\.8px/);
assert.match(block(".admin-route-heading h2"), /font-size:\s*clamp\(19\.6px,\s*2\.1vw,\s*26\.6px\)/);
assert.match(block(".admin-route-heading p"), /font-size:\s*12\.8px/);
assert.match(block(".academic-heading h2"), /font-size:\s*19\.6px/);
assert.match(block(".admin-workspace .academic-heading p"), /font-size:\s*11\.2px/);
assert.match(block(".admin-dashboard-heading h2"), /font-size:\s*21px/);
assert.match(block(".admin-dashboard-heading p"), /font-size:\s*12\.8px/);
assert.ok(css.includes(".admin-school-identity h1 {\n    font-size: 21px;"), "Keep 70% narrow-phone school heading.");
assert.ok(css.includes(".admin-route-heading h2 {\n    font-size: 19.6px;"), "Keep 70% mobile route heading.");
assert.ok(workspace.includes("<AdminDashboardFrame") &&
  frame.includes('className="admin-route-heading ml-admin-page-heading"') &&
  frame.includes("<h1>{t(title)}</h1>") &&
  dashboardCss.includes(".ml-admin-page-heading h1") &&
  dashboardCss.includes(".ml-admin-page-heading p"),
  "Dashboard route headings must stay distinct and legible in the new shell.");
assert.ok(communication.includes('className="admin-section-header academic-heading"'),
  "Communication screen should use the smaller section heading.");
assert.ok(!css.includes(".admin-workspace { font-size:"),
  "Do not scale the entire admin workspace or affect controls/tabs.");

const rootLayout = readFileSync(new URL("../apps/web/app/layout.tsx", import.meta.url), "utf8");
for(const fragment of [
  'import { Inter, Vazirmatn } from "next/font/google";',
  'const adminEnglishFont = Inter({',
  'const adminPersianFont = Vazirmatn({',
  'variable: "--ml-admin-font-english"',
  'variable: "--ml-admin-font-persian"',
  'preload: false',
  'className={`${adminEnglishFont.variable} ${adminPersianFont.variable}`}'
]) assert.ok(rootLayout.includes(fragment), "Missing self-hosted dual admin fonts: " + fragment);
assert.ok(frame.includes("lang={locale}") && frame.includes('dir={locale === "en" ? "ltr" : "rtl"}'),
  "The admin language and text direction must track the selected locale.");
for (const fragment of [
  '.admin-workspace[lang="en"] {',
  '.admin-workspace:is([lang="fa-AF"], [lang="ps-AF"]) {',
  'html .admin-workspace[lang="en"] :is(h1, h2, h3, h4) {',
  'html .admin-workspace:is([lang="fa-AF"], [lang="ps-AF"]) :is(h1, h2, h3, h4) {',
  'font-family: var(--ml-admin-font-english),',
  'font-family: var(--ml-admin-font-persian),'
]) assert.ok(css.includes(fragment), "Missing scoped language font style: " + fragment);
assert.ok(css.includes('body {\\n') || css.includes('body {'),
  "Do not remove global non-admin font fallback.");

console.log("Admin page titles at 70% and subtitles at 80% with mobile overrides and unchanged controls and language-specific fonts verified.");
