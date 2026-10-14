# Admin Communication & Fees — Improvement Roadmap

Scope: the existing administrator route `/admin/communication`. The real repository is the source of truth for current behavior, and MaktabLink's MVP specification controls authorization and workflows. Preserve the existing audited, school-tenant-scoped communication/payment APIs unless a later phase explicitly adds backward-compatible contracts.

## Phase 1 — Navigation, dashboard correctness and responsive workspaces (implemented)

- Keep **Communication & fees** as one school-admin main navigation entry; add **Overview / Communication / Fees** accessible, visibly selected subtabs, first tab selected by default and auto-scrolled into view. Existing deep links to `/admin/communication` still land on Overview.
- Overview separates communication counts (total/published/scheduled/archived **announcements**, not claimed push deliveries) from financial metrics (issued invoice count, issued billed, net paid, outstanding, overdue outstanding, unique students owing, collection percentage). **Draft and cancelled invoices do not inflate collectible totals.** Empty billings display an em dash rather than a misleading zero-percent collection rate.
- Overview includes independently labeled recent announcements/invoices and navigation actions. The lists do not claim to be paginated, searched, or filtered server-side yet; Phase 2 and 3 will add that.
- Communication presents the existing create/scheduled-edit form alongside the authorized announcement list. Fees presents the existing draft-invoice/reminder form alongside invoice details, payment history and reversal actions. Desktop shows two panels side by side, each no wider than 600px. At <=1050px, the **List / Create** toggle shows one panel at a time, with List selected first. Existing form/API actions are preserved.
- `/v1/admin/communication`, `/v1/admin/families`, and `/v1/admin/academics` now load/retry independently. Losing the family or academic endpoint cannot blank the already loaded announcement/invoice list; the dependent creation form has a targeted loading/error/retry state. Each asynchronous response is bound to its initiating bearer token and its resource request generation, preventing stale account data from rendering after a school/account switch. The Communication/Fees resource remains the financial source of truth.
- Existing fetch calls share the admin API's typed network/error parsing. Forms retain a stable HTML form reference across await before resetting their values.
- UI tabs, summaries, button labels, and revenue explanations use English/Dari/Pashto admin translations, numeric grouping and responsive RTL handling.
- No new financial mutation, notification-delivery promise, online payment, database migration, or change to parent/student fee visibility. Existing payment retry/idempotency and immutable reversal mechanics are preserved.
- Tests: `pnpm verify:admin-communication:phase1` runs source/privacy/RTL guards plus `scripts/test-admin-communication-phase1-model.test.ts`; included in monorepo verification and Linux/Windows CI.

**Manual browser acceptance pending**: exact current school balances against issued invoices after payments and reversals; no zero-looking dashboard when communication endpoint fails; academic/family endpoint outage retaining read-only authorized lists; two concurrent admin sessions in different schools; narrow-width 320/375px, tablet, desktop, Dari/Pashto RTL, 200% browser zoom and screen reader; payment idempotency and cancellation flows. No manual browser run is claimed. Production remains **NO-GO** pending Step 20 external checks.

## Phase 2 — Announcements

Search, status/audience/class filters, pagination, actual class names, recipient preview backed by authorized server calculation, explicit Publish Now vs Schedule, timezone-safe scheduling and dedicated detail view. Proposed draft lifecycle requires a new contract and audit logic.

## Phase 3 — Fee invoices

Server-side search/pagination and filters, detail drawer, safe editable draft state, human-readable invoice numbers, confirmed issue/cancel flows and school-year scoping. Preserve original issued-invoice immutability.

## Phase 4 — Payments and student balances

Payment method selection, confirmation, transaction details, PDF/printable ledger-backed receipts, per-student account balances, and date/recorded-by filters. Confirm no fake online payment or balance modifications outside audited transactions.

## Phase 5 — Notification delivery and fee reminders

Administrator notification delivery monitor with precise queue/provider/recipient-read semantics, scheduler-health signal, safe retry controls, structured reminder-day form and expiry/withdrawal safeguards.

## Phase 6 — Reports and financial operations

School-scoped collection statements, aging/reversal reports, CSV export with safe escaping, independent cash/bank reconciliation status, and an audited bulk-draft-invoice preview that detects duplicates.

## Phase 7 — Integrated release verification

Cross-school permissions, concurrent/partial payments, mutable reminder and publish race handling, exact school timezone, manual keyboard/RTL/browser/device checks, scheduler integration, database backups and Step 20 independent operator evidence.

**Principles:** monetary reporting excludes drafts and cancellations; issuance and payment are explicit high-risk actions; never claim provider-accepted push as delivered/read; never infer parent payment collection from an app view; never weaken server tenant and recipient scopes.
