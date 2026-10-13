# Admin Accounts — UI and Capability Improvement Plan

Started: 2026-10-14. Route: `/admin/accounts`.
Source of truth for currently implemented behavior: the main-branch application and school-scoped API.

## Phase 1 — Layout and styling (implemented)

- **Directory-first:** Accounts opens in the directory view, rather than displaying a large creation form by default.
- **Four interactive account summaries:** total accounts, active accounts, pending activation and suspended accounts; the cards filter the current school's loaded directory and reset competing filters so the selected count is meaningful.
- **Accurate pending count:** `INVITED` accounts or `ACTIVE` accounts still requiring a first-login password change. The pending and active totals may overlap; this is not an exclusive partition.
- **View switch:** choose Account directory or Create account. Desktop retains the directory beside an opened creation form; at tablet/phone widths, the selected view occupies the available space.
- **Directory:** retained school-scoped API, create, reset, suspend/reactivate, current-admin action restrictions, role/status/search filters and temporary credential display. Improved spacing, role-colored avatars, badge layout, focus indicators, searchable controls and mobile scrolling.
- **Accessibility / localization:** view buttons and filter buttons expose their pressed states; search and status filter have explicit accessible names; new interface text is provided in English, Dari and Pashto; layout works in RTL. Native web focus support and motion preferences remain in place.
- **Small UI correctness fix:** replaced invalid dotted parent/student username examples with alphanumeric examples accepted by their existing server contract. Validation rules are not altered.
- **Verification:** `pnpm verify:release` now checks the presence of the directory-first, filtering, RTL translation, focus and responsive implementation. Complete CI and real browser/device visual acceptance are separate gates.

### Manual acceptance for Phase 1

1. Sign in as a school admin and verify Accounts opens on the full directory, including school-only users.
2. On a populated school, select each summary: total, active, pending and suspended; confirm the visible results match counts. In particular, confirm an active user awaiting password setup is counted as pending.
3. Switch between directory and creation: at desktop widths the open form is beside the directory; on narrow screens only the selected view appears. Create a Parent and Student account without altering the family linking rules.
4. Test search, role groups, status filter, clear filters, reset, suspend/reactivate and view recovery in English, Dari and Pashto.
5. Test keyboard navigation, focus visibility, 200% zoom, RTL phone/tablet widths and temporary password visibility.
6. Verify `pnpm verify` and CI Ubuntu/Windows at the final commit.

## Future phases (not implemented by Phase 1)

- **Phase 2 — Creation:** role-specific form validation and improved one-time credential display/dismissal/copy behavior.
- **Phase 3 — Details:** account drawer and linked parent/child/teacher information; editing through canonical feature modules.
- **Phase 4 — Security:** confirmation dialogs, revoked sessions on suspension, suspension reasons, account audit drill-down and appropriate security handling.
- **Phase 5 — Scale:** server-side search/pagination/sorting, optional safely scoped bulk account operations.
- **Phase 6 — Regression:** expanded end-to-end role, tenant, network, locale, accessibility and responsive verification.

No new database schema changes or provisioning API changes were introduced in Phase 1.
