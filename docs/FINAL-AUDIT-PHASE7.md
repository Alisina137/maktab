# MaktabLink Final Audit — Phase 7: Communication, Fees, Payments and Notifications

**Baseline:** `aa56cab56b7b11a8d9f68f6cb83116ff18844873` (Phase 6 merged).
**Scope:** school announcements, fee invoice lifecycle, report/reconciliation calculations, device registration and push delivery.
**Migrations introduced in this phase:** none. **Production readiness:** **NO-GO** until staging/Neon migrations, full role/device testing and operator approval.

## Source findings and corrections

| Existing behavior | Risk | Applied correction |
| --- | --- | --- |
| A new invoice checked student `ACTIVE` outside the transaction | A student might be withdrawn between form submission and invoice insert | Lock and re-check the student within the invoice-creation transaction before consuming a school invoice number |
| Invoice issuance and draft editing checked the target student's enrollment without a row lock | An invoice could be issued/edited while a concurrent administrator withdrew the learner | Use a row-level lock for the student when issuing or editing a draft; maintain invoice-first lock ordering on updates |
| Push-token registration used SELECT-then-INSERT | Simultaneous device registrations could fail with unique violations; account ownership races surfaced as server errors | Use the unique push-token index as the atomic conflict arbiter, return the existing row for the same user, and reject ownership by a different school/user |
| A push provider/SDK throwing aborted the notification delivery batch | Later devices/notifications were not attempted and the queued item was not marked FAILED | Convert thrown provider errors to a per-device FAILED result, preserve lease cleanup, and retry only failed devices on the next run |
| Expo transport exceptions were persisted with their original message | Provider errors can contain sensitive URL/token details | Store a generic, bounded transport message instead of raw transport exception text |
| Legacy payments used the `BANK` method whereas reports/reconciliation recognized only `BANK_TRANSFER` | Real bank collections appeared under OTHER and could not be reconciled through the UI | Normalize reporting category for legacy BANK/Bank Transfer case variants to BANK_TRANSFER; accept both for reconciliation without changing immutable payment history |

## Tests added

- `pnpm verify:communication:phase7` runs source invariants plus focused PGlite communication and financial regression suites.
- Push test: one provider throws while a second device succeeds; the failing device is recorded as FAILED with no raw token/SDK exception; next run retries only the failed delivery and does not resend accepted ones.
- Token test: concurrent registrations with the same user/token return one device row; attempts to register the token for a different school's parent return a controlled conflict.
- Fee test: newly creating or issuing a draft after student withdrawal is refused.
- Financial test: a legacy BANK payment appears in bank-transfer reconciliation totals; reconciliation, reversals and the net statement remain consistent.
- Existing tests continue to cover idempotent payments, one-time reversals, audited invoice transitions, school isolation, announcement targeting, lease-based overlapping push workers, notification requeue, fee reminders and receipt/export reporting.
- CI runs focused Phase 7 checks on Linux and Windows and includes them in the root full verification.

## Risks and operator acceptance

1. Test on real Neon PostgreSQL with **two independent DB connections and worker processes** before trusting concurrency claims in production. PGlite is a functional, single-instance regression tool.
2. The database-level username uniqueness migration **0033** from Phase 6 and the **0032** integrity migration from Phase 3 still require their own read-only preflight, staging rehearsal and verified backup. This phase adds **no migration**.
3. Manually test parent fee visibility after guardian transfer/withdrawal, archived announcements and role-specific notification recipients in English, Dari and Pashto.
4. Verify Expo push permissions and provider receipts on physical Android devices with notification permission granted/denied, offline/reconnect and more than one device.
5. Financial acceptance requires manual reconciliation against actual cash drawers, bank statements, and reversals. Provider acceptance of a push is not proof that the device received it.

### Local verification

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:communication:phase7
pnpm typecheck
pnpm test
```

All source changes are repository-only; no email, payment, migration or push side effects were initiated by this audit.
