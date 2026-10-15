import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const base = "apps/web/app/admin/";
const labels = {
  "academic-panel.tsx": "Loading academics data…",
  "family-panel.tsx": "Loading families data…",
  "learning-panel.tsx": "Loading learning data…",
  "attendance-panel.tsx": "Loading attendance data…",
  "admin-account-directory.tsx": "Loading accounts data…",
  "(workspace)/accounts/page.tsx": "Loading accounts data…",
  "(workspace)/profile/page.tsx": "Loading administrator profile data…",
  "pilot-readiness-panel.tsx": "Loading pilot operations data…",
  "admin-notification-monitor.tsx": "Loading communication data…"
};
for (const [path, label] of Object.entries(labels)) {
  const source = read(base + path);
  assert.ok(source.includes(`t("${label}")`), `Expected "${label}" in ${path}`);
  assert.doesNotMatch(source, /Loading Phase\s*\d/i,
    `Implementation phase leaked into a loading status in ${path}`);
}
const communication = read(base + "communication-panel.tsx");
for (const key of ["Loading overview data…", "Loading communication data…", "Loading fees data…"]) {
  assert.ok(communication.includes(`"${key}"`), `Missing communication subtab label: ${key}`);
}
assert.ok(communication.includes('section === "OVERVIEW"') &&
  communication.includes('section === "COMMUNICATION"'),
  "Loading states should follow the selected subtab");
assert.doesNotMatch(communication, /Loading Phase\s*\d/i);
const shell = read(base + "admin-workspace.tsx");
const routeNames = [
  "accounts", "pilot", "communication", "learning", "attendance",
  "families", "academics", "profile"
];
const translations = [
  "Loading accounts data…",
  "Loading pilot operations data…",
  "Loading communication & fees data…",
  "Loading overview data…",
  "Loading communication data…",
  "Loading fees data…",
  "Loading learning data…",
  "Loading attendance data…",
  "Loading families data…",
  "Loading academics data…",
  "Loading administrator profile data…"
];
assert.ok(shell.includes("t(loadingTextForAdminRoute(pathname))"),
  "The initial shell status must show the active route name.");
for (const route of routeNames) {
  assert.ok(shell.includes(`"/admin/${route}"`), `Missing initial loader for ${route}`);
}
const localeSource = read(base + "admin-i18n.ts");
for (const label of translations) {
  const occurrences = localeSource.split(JSON.stringify(label) + ":").length - 1;
  assert.equal(occurrences, 2, `Dari/Pashto translations required for ${label}`);
}
assert.doesNotMatch(localeSource, /"Loading Phase\s*\d/i,
  "Legacy phase names should not exist as loading translation keys");
console.log("Admin context-specific loading labels (no phase numbers) and Dari/Pashto translations verified.");
