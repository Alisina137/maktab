# Step 17 — Fee Invoices, Ledger, Reminders and Family Access
Date: 2026-10-13. Scope: manual whole-AFN receipts, not online payment collection.

| ID | Case | Automated test / follow-up |
| --- | --- | --- |
| 17.1 | Admin-only invoice creation, tenant scoping | API role 403 and store school 404 |
| 17.2 | Whole AFN amount, valid Gregorian ISO due date, student and bounded description | Contract validation and API 400/404 |
| 17.3 | DRAFT privacy, one-time issue and cancellation lifecycle | API and store |
| 17.4 | Withdrawn pupils cannot receive new invoices | Store active-enrollment guard |
| 17.5 | Partial 500+700=1200, PAID and exact outstanding | Store balance regression |
| 17.6 | Overpayment and payment on PAID/CANCELLED denied | API 400, store conflict |
| 17.7 | Original payments never edited, reason-required one-time reversals | API/store, unique reversal index |
| 17.8 | Invoice/payment/reversal audits atomic, retry does not duplicate audit | Transactional store and audit count test |
| 17.9 | Only linked Parent/Student reads, no cross-school access | API/store tenant and family tests |
| 17.10 | School-local day boundary and configurable pre-due/overdue reminders | Store scheduler regression, real timezone smoke pending |
| 17.11 | No stale reminder inbox or push after settlement, withdrawal or transfer | Store filtering/queue checks; live device pending |
| 17.12 | Idempotent payment POST after lost response; conflicting payload 409 | UUID key, browser safe retry, API/store |
| 17.13 | Concurrent Admin payment writes cannot overpay or race cancellation | Row lock; real multi-connection PostgreSQL test pending |
| 17.14 | Web Admin and Android Parent/Student balance, receipts, currency/RTL, offline | Manual device smoke pending |

## Manual pilot acceptance
Create two Admin sessions, two parents and an unrelated school. Create/issue a draft and record two partial payments; force an HTTP response timeout then retry the exact request, verifying one receipt and one audit. Run concurrent payments that would exceed the balance; only one may succeed. Reverse with a reason, verify the original immutable receipt and reversal remain visible, then reverse the remaining payment and cancel. Test due/overdue notices across school-local midnight; withdraw or transfer the child before pending push and confirm the former guardian gets no new fee alert. Verify date formatting and currency with Dari, Pashto and English on Android and browser. Reconcile bank/cash records outside the app.

## Deployment
Run `pnpm db:migrate` for migration `0019_fee_payment_idempotency.sql` before starting the new API. Run `pnpm verify`. No schema changes delete or alter historical payment rows. Formerly cancelled pre-due alerts retain their original deduplication keys following later reversals; the app still exposes current outstanding balance and separate overdue alerts.

## Additional Step 17 retry and cancelled-invoice regression

- Replay of the original payment idempotency key after all payments are reversed and the invoice is CANCELLED cannot append a payment, restore the balance, or change the cancelled status.
- New payments on CANCELLED invoices remain rejected, while the original receipt and reversal rows remain in history.
- A different school cannot reverse another tenant's payment even with its UUID.
- The former guardian's fee alerts remain absent after cancellation; cancelled invoice remains in linked family's historical ledger.

These cases have been added to `packages/database/src/communication-store.test.ts`. CI verification and real Android/browser acceptance remain separate gates.
