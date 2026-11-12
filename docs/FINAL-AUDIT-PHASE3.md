# MaktabLink Final Audit — Phase 3: Database Integrity, Migrations and Concurrency

**Base revision:** `9020a5f52bc85724f816a9bf44904f283979b429`. **New migration:** `0032_phase3_integrity_constraints.sql`. **Release decision:** **NO-GO**, pending controlled migration and live PostgreSQL/Neon backup-and-restore acceptance.

## Findings and applied corrections

| Finding | Why it matters | Implemented safeguard |
| --- | --- | --- |
| A second academic year could be activated in a concurrent request between the read and write checks | One school could have two ACTIVE years and break all year-sensitive workflows | Partial unique PostgreSQL index (one ACTIVE academic year per school), store-level status compare-and-swap and domain-specific 409 conflict on uniqueness races |
| Classes used independent year and grade foreign keys instead of school-aligned keys | A wrongly scoped insert could attach a class to another school's academic year or grade | Composite foreign keys to `academic_years(school_id,id)` and `grade_levels(school_id,id)` |
| Student parent and class/year references were not enforced together | Cross-school family relationships or mismatched enrollment class/year could persist if API validation is bypassed | Student `(school_id,parent_user_id)` and `(school_id,academic_year_id,class_id)` composite foreign keys |
| Enrollment-history references lacked consistent tenant/year link guarantees | Student history could refer to a different school's student or year-incompatible class | School-scoped student and school/year-scoped class foreign keys |
| Teacher assignments referenced teacher, subject and class by globally unique IDs only | Wrong-school assignments could be written by a buggy import/tool | Three school-scoped foreign keys, including exact class/year membership |
| Fee invoices, payment ledger records, and sessions had independently valid, not jointly scoped, foreign keys | A direct database operation could link a payment to another school's invoice, or a session to another school's user | Composite school+student, school+invoice, school+user foreign keys for financial and authentication core |
| New migration tags could silently be excluded from the main API integration fixture | Tests previously loaded an incomplete list and omitted migrations 0013, 0030, 0031 | API test database now checks its complete migration fixture against the **canonical Drizzle migration journal** (same ordered set as production), preserving legacy verification tools that inspect explicit filenames |
| Existing dirty records would make constraints fail without an actionable inventory | A production migration could be blocked mid-deploy | `db:preflight:phase3` checks 16 categories of integrity violations with read-only aggregate counts, no PII and no destructive remediation |

The constraints are **additive**; no existing records are auto-repaired, deleted, reassigned or backfilled. They deliberately refuse inconsistent existing relationships. Newly introduced compound unique indexes serve as referenced keys for PostgreSQL multi-column foreign keys. The ORM schema is updated to match the SQL migration.

## Verification

Run on a development or restored staging database first:

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:db:phase3
pnpm db:check
pnpm db:preflight:phase3
```

`verify:db:phase3` uses PGlite and Fastify/PGlite integration tests to verify the entire journal applies in order, cross-school financial/family/session references are rejected, and only one concurrent school-year activation succeeds. Linux and Windows GitHub Actions also run it before the broader regressions.

## Production migration runbook (not executed by the code change)

1. Schedule a maintenance window; restrict application writes to avoid races during validation and migration.
2. Verify access to the **unpooled** Neon PostgreSQL endpoint and test `pnpm backup:db` with `BACKUP_ENCRYPTION_KEY`. Verify a **separate staging restore** and record the result; a backup without a tested restore is insufficient.
3. Take a fresh encrypted backup and store it off-host. Never commit the backup, credentials or restoration secret.
4. Run `pnpm db:preflight:phase3` against the correct existing database (baseline migrations through 0031); every check must return **0 violations**. If any fail, stop and investigate using protected administrative tooling. Never delete/reassign records automatically.
5. In staging, run `pnpm db:migrate` using `DATABASE_URL_UNPOOLED` (configure your migration tool's environment appropriately) and verify migration 0032, plus cross-school/academic-year/ledger acceptance scenarios. Confirm planned rollback/restore.
6. Apply the migration to production only after independent operator approval, then run smoke tests for school admin, staff, teacher, parent, student and fee payment flows. Verify tenant isolation and preserve evidence.
7. If migration fails, stop the deployment. Do **not** edit the Drizzle journal manually. Use the tested restore plan and reconciliation procedure.

## Follow-up / risks that remain

- Full-graph multi-tenant relational enforcement (including all attendance, learning, announcements, notifications and pilot tables) is broader than this migration. The application-level tenant guards remain essential; extend DB constraints in a separately audited migration after validating legacy records.
- PostgreSQL connection-level race tests and lock contention benchmarks against real Neon are still needed; PGlite is a useful test DB, not a production concurrency substitute.
- Schema migration checks must run with sufficient database permissions and on a consistent staging snapshot.
- Manual backup/restore drills, reconciliation, device tests and a final go-live authorization remain **NO-GO** gates in `RELEASE-READINESS-STEP20.md`.

**Operator safety:** Pulling these source changes does **not** run migrations against your Neon database. Do not run `db:migrate` on live school data until the above steps are complete.
