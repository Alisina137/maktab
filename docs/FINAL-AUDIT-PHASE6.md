# MaktabLink Final Audit — Phase 6: Accounts, Families and Role Lifecycle

**Baseline:** `06ed82c48211f6d05797a2f446b9946c615a5c20` (Phase 5 merged).  
**Scope:** school admin accounts, student login linkage, parent/student relationships, enrollment intervals, role boundaries, password reset and account suspension/reactivation.  
**Database migration:** `0033_phase6_casefold_usernames.sql` (not executed against Neon by repository changes).  
**Release:** remains **NO-GO** pending Stage/Neon backup, preflight, migration test, device acceptance and operator sign-off.

## Observed bugs and fixes

| Finding in existing source | Consequence | Implementation |
| --- | --- | --- |
| Student login attachment checked `userId` before beginning a transaction, then updated by student ID only | Concurrent requests could create two login users and overwrite the student link, leaving an orphan | Conditional in-transaction student update requiring `ACTIVE` and `userId IS NULL`; loser rolls back the newly inserted login. Withdrawn students cannot receive a new login |
| Student update read the entire student outside its transaction; enrollment history opened only on class change and closed on withdrawal | Concurrent admin changes could revert fields or create overlapping history; a withdrawn student reactivated in the same class had no active enrollment interval | Lock the student row first, validate current school parent/year/class, calculate changes from locked data, close history on withdrawal/transfer and open exactly one interval on reactivation/transfer. CAS timestamp is updated monotonically |
| Parent deletion checked linked children before deleting, outside a transaction | Concurrent linking could surface an unhandled PostgreSQL FK exception | Lock/check/delete in a single transaction; preserve the school and role guard and return controlled `409 family_conflict` on an FK race |
| Student deletion read linked records and the student login before its deletion transaction | A concurrent login link or new linked record could leave an orphan or return HTTP 500 | Lock student, check attendance/grades/invoices, delete student and its own login in one transaction; map FK races to family conflict |
| Admin account status action trusted a route-level preflight and updated status without validating the prior status inside the transaction | Concurrent suspend/reactivate requests could duplicate audit events or reactivate accounts that had since been archived; stale password-change state could be bypassed | Lock member row, enforce transitions, derive `INVITED` or `ACTIVE` from current `mustChangePassword`, atomically revoke sessions and unconsumed 2FA proofs, log only one successful transition. Send `409 account_status_conflict` for stale changes |
| Account reset checked archived/self status before bcrypt work, then updated any user matching ID inside the transaction | An account archived while the password hash was being created could still receive a new temporary password | Transactional guard against archived/self/administrator accounts; successful reset invalidates sessions and any outstanding verification proof |
| Single-user suspend/reactivate endpoints did not exclude other school-admin users | School-admin identities could be disabled via ordinary member management | Explicit administrator-account protection in the API and persistence layer, without granting staff any admin powers |
| `usernameExists` used `lower(username)`, but login used case-sensitive equality and the database unique index enforced case-sensitive names | Direct imports/parallel processes could create identities that differed only in case; login behavior disagreed with username availability checks | New expression unique index `(school_id, lower(username))`; consistent case-insensitive login lookup and rate-limit key. Existing normal API schema already lowercases usernames |
| Existing users might have case-insensitive username collisions before new index | Unsafe automatic index creation or silent account renaming | Migration intentionally aborts if collisions exist. Separate read-only preflight reports counts, never usernames/PII and never modifies records |

## Regression coverage

- `pnpm verify:accounts:phase6`: invariants plus PGlite family, account, migration-chain tests on Linux and Windows CI.
- New tests reproduce two simultaneous student-account attachments, confirm a single attached user and **no orphan**.
- New tests verify withdrawal, reactivation, transfers, same-class edits and exact open/closed student enrollment intervals.
- New tests verify parent deletion safety, cascading student-login removal and cross-school data isolation.
- New tests verify concurrent status actions, duplicate audit prevention, session revocation, reactivation password-change enforcement, privileged-role protection and archived/foreign reset behavior.
- Migration-chain test applies all migrations through 0033 and verifies a case variant is blocked within a school while a different school can use the same login name.
- Existing staff portal security and permissions tests, teachers, student/parent navigation, account bulk-status and end-to-end API tests remain enabled in the full CI suite.

## Neon / existing data runbook (do not skip)

1. Verify an encrypted backup and restore it on a **separate staging database**. Never use production for the first rehearsal.
2. Confirm migration 0032 from the Phase 3 audit has been preflighted and successfully applied on staging.
3. On restored staging, run `pnpm db:preflight:phase6`; a nonzero exit blocks deployment.
4. Inspect and reconcile any casefold username collisions **with school administrators**. Do not automatically delete, merge or rename users—the identities may refer to distinct people.
5. Re-run Phase 6 preflight and `pnpm db:migrate` on staging after confirmation, then `pnpm verify:accounts:phase6`, the complete regression suite and a staged login test.
6. Schedule the controlled production migration only after rollback/restore readiness and operator approval. **Pulling code does not run migration 0033.**

## Remaining gates

- Real two-connection PostgreSQL concurrency testing (PGlite is a functional regression harness, not a distributed lock test).
- Manual administrator ↔ teacher ↔ parent ↔ student ↔ staff permission matrix with suspended/archived accounts and tenant-switch scenarios.
- End-to-end device tests in Dari, Pashto and English (including RTL), accessibility and session invalidation in the separate staff portal.
- Remaining Phase 7–10 workflow and release-readiness audits.

**No automatic data changes, credential emailing or background jobs were triggered by this pull request.**
