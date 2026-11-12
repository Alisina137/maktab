# MaktabLink Final Audit — Phase 4: Admin Dashboard, Navigation and Visual Consistency

**Base revision:** `fbd335941c59a68b522f4d66b8f0bf8ab67fbb13` (Phase 3 merged).  
**Scope:** authenticated school-administration web workspace, all page routes under `/admin/(workspace)`.  
**Release decision:** **NO-GO** until independent interactive browser and physical-device testing, plus remaining release gates.  
**Database impact:** none. **New dependencies:** none.

## Actual findings and fixes

| Observed defect in source | User impact | Applied change |
| --- | --- | --- |
| Mobile sidebar was only CSS-transformed off screen; links could remain keyboard reachable and assistive-technology visible | Keyboard focus could escape the drawer or move to invisible links; background actions remained interactive | Mobile sidebar now exposes modal semantics, becomes inert/hidden when closed, traps Tab while open, moves focus on open/close, locks background scrolling and makes the main column inert while open |
| Sidebar had no in-drawer close button | Mobile keyboard and touch users relied on the backdrop or Escape | Added a localized, focusable close button in the drawer |
| Sidebar profile repeated the header profile image | Competing profile identities made the top header less clear | Sidebar now uses an accessible profile icon and name; **image appears only in the top-right header** |
| Route search exposed a listbox but had no Arrow-key selection or `aria-activedescendant` | Inaccessible search results with keyboard and screen readers | Added labeled combobox navigation: ArrowUp/Down, Home/End, Enter, Escape, selection state and focus-out behavior |
| Search combined section names before localization | Dari and Pashto search-result group labels appeared in English | Translate the parent group and child page separately and deduplicate equivalent destination URLs |
| Desktop icon-rail size was ephemeral | Sidebar unnecessarily expanded after every reload | Persist compact preference with guarded localStorage reads and writes, without affecting modal mobile state |
| Sidebar navigation left keyboard focus on an offscreen item after mobile navigation | Subsequent Tab navigation could start from an invisible element | Return focus to main page content on successful mobile route link navigation |
| Page-level route loading used a null Suspense fallback; nested navigation had no consistent route-level boundary | A blank interstitial or a full failure without a recovery affordance | Render the existing AdminLoader on initial suspension and page navigation; add a localized, non-sensitive route error/retry screen |
| Pilot-route loading helper checked generic `/admin/pilot` before nested routes | Loading label described the wrong operation on pilot subpages | Choose the most specific matching route |
| Explicit academic-year choice reset on page reload | Unexpected context-switch and repeat navigation when reviewing previous years | Persist the year selection per school in sessionStorage and validate it against returned school-year IDs |
| A mobile breakpoint hid language selection at <=390px | Some phone widths lost the only visible language picker in admin | Keep the language select visible; hide redundant notification shortcut rather than localization |
| Styling was inconsistent around touch targets, page headings, error feedback and focus | Smaller click targets, clipped RTL captions, inconsistent spacing | Add a scoped Phase 4 CSS layer with 44px controls, logical-direction labels, responsive wrap, visible focus indicators, reduced-motion settings and consistent route recovery cards |

These changes leave existing admin permissions, authentication flows, API contracts, tab IDs, data loading and database schema intact.

## Files of interest

- `apps/web/app/admin/admin-dashboard-frame.tsx`: search, responsive drawer, focus and navigation behavior.
- `apps/web/app/admin/admin-workspace.tsx`: loading route precedence and per-school year persistence.
- `apps/web/app/admin/admin-phase4-polish.css`: scoped visual and responsive corrections.
- `apps/web/app/admin/(workspace)/layout.tsx`: nonblank Suspense fallback.
- `apps/web/app/admin/(workspace)/loading.tsx` and `error.tsx`: route-level feedback and recovery.
- `apps/web/app/admin/admin-i18n.ts`: paired Dari/Pashto recovery messages.
- `scripts/verify-admin-audit-phase4.mjs`: targeted source invariant checks.

## Automated checks

Run from the project root after `pnpm install --frozen-lockfile`:

```powershell
pnpm verify:admin:phase4
pnpm verify:admin-dashboard
pnpm verify:admin-headings
pnpm verify:admin-loading
pnpm typecheck
pnpm build
```

The Phase 4 check is also run in Linux and Windows CI before the full verification suite. It checks that the keyboard search, mobile focus trap/inert guards, localized route recovery, CSS breakpoints and reduced-motion support cannot be accidentally removed. CI verifies TypeScript and app compilation but does **not** substitute for interactive visual testing.

## Independent browser acceptance checklist

Test the exact commit in Chromium, Firefox and Safari where available, at 320px, 375px, 390px, 650px, 900px, 1024px and 1440px. Repeat for English LTR and Dari/Pashto RTL.

1. Open and close the mobile menu with pointer, Escape, close button and backdrop. Verify focus moves into the drawer, never tabs behind it, and returns to menu on explicit close. Try scrolling the page behind the drawer.
2. Follow nested links (Academic years, Accounts/Create, Attendance/Reports, Learning/Exams, Communication/Fees, Pilot/Adoption), then keyboard Tab to verify focus is inside the visible workspace, not on a hidden sidebar link.
3. Collapse and expand the desktop sidebar, reload and confirm the state survives. Resize to mobile and back; ensure menu and icon rail do not interfere.
4. Search pages with Ctrl/Cmd+K and slash shortcuts; use ArrowUp, ArrowDown, Home, End, Enter and Escape. Verify group names translate correctly and no duplicate destinations appear.
5. Verify language selection remains available at 320–390px. Check long Pashto and Dari headings and labels at 200% browser zoom.
6. Confirm only one profile picture is displayed in the header; the sidebar profile link remains recognizable and clickable.
7. Select an archived/nonactive academic year, reload and verify the chosen year persists for that school but never carries into another school's session.
8. Simulate slow routes and route render failures; verify localized loading and error recovery, retry, and safe dashboard navigation without showing stack traces or tokens.
9. Check all eleven top-level admin destinations and their existing subtabs for horizontal overflow, empty/data/error states, 44px touch targets, visual alignment and proper keyboard focus indicators.

**Operator note:** The existing production NO-GO status still applies. This phase corrects verified source defects; it has not been manually accepted on a live device.
