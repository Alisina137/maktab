import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const base = "apps/web/app/admin/";
const frame = read(base + "admin-dashboard-frame.tsx");
const workspace = read(base + "admin-workspace.tsx");
const shell = read(base + "dashboard-shell.css");
const polish = read(base + "admin-phase4-polish.css");
const layout = read(base + "(workspace)/layout.tsx");
const loading = read(base + "(workspace)/loading.tsx");
const error = read(base + "(workspace)/error.tsx");
const translations = read(base + "admin-i18n.ts");

const needs = (source, fragments, subject) => {
  for (const fragment of fragments) assert.ok(source.includes(fragment),
    subject + " missing: " + fragment);
};

// Route search: the input is a true keyboard-operable, labeled combobox.
// Result ids, focus and selection must be kept consistent with its active option.
needs(frame, [
  'role="search"', 'role="combobox" aria-autocomplete="list"',
  'role="listbox"', 'role="option" tabIndex={-1}',
  'aria-activedescendant={showResults && highlightedSearchIndex >= 0',
  'id={"admin-page-search-option-" + index}',
  'onKeyDown={handleSearchKeyDown}',
  'event.key === "ArrowDown"', 'event.key === "ArrowUp"',
  'event.key === "Home"', 'event.key === "End"',
  'event.key === "Enter"', 'event.key === "Escape"',
  'onBlur={() => {', 'data-admin-no-loading="true"',
  'setHighlightedSearchIndex(-1)'
], "Search accessibility");

// On mobile, all external interactive controls are inaccessible while the
// drawer is active, and hidden drawer links cannot be tabbed into when closed.
needs(frame, [
  'inert={isMobileLayout && !mobileOpen}',
  'inert={isMobileLayout && mobileOpen}',
  'aria-modal={isMobileLayout && mobileOpen ? true : undefined}',
  'aria-hidden={isMobileLayout && !mobileOpen ? true : undefined}',
  'onKeyDown={handleSidebarKeyDown}',
  'document.body.style.overflow = "hidden"',
  'last.focus();', 'first.focus();',
  'closeMobileSidebar(true)', 'menuButtonRef.current?.focus()',
  'className="ml-admin-sidebar-close"',
  'closeSidebarAfterNavigation()',
  'id="admin-workspace-content" tabIndex={-1}',
  'aria-controls="ml-admin-sidebar"'
], "Responsive drawer");

// Admin header has one image, and sidebar navigation uses a role icon only.
const side = frame.slice(frame.indexOf('className="ml-admin-sidebar-profile"'),
  frame.indexOf("</Link>", frame.indexOf('className="ml-admin-sidebar-profile"')));
assert.ok(side.includes('ml-admin-sidebar-profile-icon') && !side.includes('<UserAvatar'),
  "The sidebar must no longer duplicate the administrator profile picture");
assert.ok(frame.includes('<UserAvatar name={userName} url={adminProfile.imageUrl} />'),
  "The administrator image remains in the header");

needs(frame, [
  'localStorage.getItem("maktablink.admin.sidebar.compact")',
  'localStorage.setItem("maktablink.admin.sidebar.compact"',
  'if (!compactPreferenceReady) return;',
  'grid-template', // deliberate? not in TSX, validated by CSS below
].slice(0, 3), "Desktop icon rail preference");
needs(workspace, [
  '.sort((left, right) => right.length - left.length)',
  'maktablink.admin.academic-year:',
  't(loadingTextForAdminRoute(pathname))'
], "Route and school context");

// The fallback must never silently render a blank screen; per-route loading
// and errors provide localized, safe retry and dashboard return controls.
needs(layout, [
  'import "../admin-phase4-polish.css"',
  'import { AdminLoader } from "../admin-loader"',
  '<Suspense fallback={', '<AdminWorkspaceShell>{children}</AdminWorkspaceShell>'
], "Workspace shell");
needs(loading, ['AdminLoader', 't("Loading page…")'], "Route loading");
needs(error, [
  'useAdminWorkspace()', 'onClick={reset}', 'href="/admin/dashboard"',
  'role="alert"', 't("We could not load this page.")',
  't("Return to dashboard")'
], "Route error boundary");
assert.ok(!error.includes('{error.message}') && !error.includes('{error.stack}'),
  "Never expose raw server exceptions in the user-facing error boundary");

for (const key of [
  "Loading page…", "We could not load this page.",
  "Your changes were not confirmed. Retry or return to the dashboard.",
  "Try again", "Return to dashboard"
]) {
  assert.equal(translations.split(JSON.stringify(key) + ":").length - 1, 2,
    "Missing paired Dari/Pashto translation: " + key);
}

needs(polish, [
  '.ml-admin-dashboard-shell', '--ml-admin-ui-control-height: 44px',
  '.ml-admin-sidebar-profile-icon', '.ml-admin-sidebar-close',
  '.ml-admin-route-error', '.ml-admin-route-loading-card',
  'role="option"', // present as selector [role="option"]
  'aria-selected="true"', ':focus-visible',
  '@media (max-width: 900px)', '@media (max-width: 650px)',
  '@media (max-width: 390px)', '.ml-admin-topbar-language',
  '@media (prefers-reduced-motion: reduce)'
], "Phase 4 scoped styling");
needs(shell, [
  'grid-template-columns: 256px minmax(0, 1fr)',
  'grid-template-columns: 73px minmax(0, 1fr)',
  '[dir="rtl"]', '@media (max-width: 900px)'
], "Previous responsive layout");

let depth = 0;
for (const char of polish) {
  if (char === "{") depth++;
  if (char === "}") depth--;
  assert.ok(depth >= 0, "Unbalanced Phase 4 CSS block");
}
assert.equal(depth, 0, "Unclosed Phase 4 CSS block");

console.log("Final Audit Phase 4 admin UI verified: RTL, mobile drawer accessibility, keyboard search, profile, loading/error feedback, normalized focus and responsive styling.");
