# Step 19 — Local Environment & Deployment Readiness

Date: 2026-10-14. Scope: safe release verification and repair of interrupted local checkout/migration workflow.

| ID | Check | Status / follow-up |
| --- | --- | --- |
| 19.1 | GitHub main changes are present in the working tree before verification | User-side checkout blocked by HTTPS connection reset; retry required |
| 19.2 | Parent resilience verifier still enforces cache disable before reconnect reload | Fixed in Step 18 (commit 087b08d4); the user's old script remains until pull succeeds |
| 19.3 | `DATABASE_URL` existence and URL scheme validation | Added non-destructive `pnpm db:check` |
| 19.4 | PostgreSQL connection, default schema and Drizzle migration journal check | `pnpm db:check`; actual local execution pending |
| 19.5 | Database diagnostic must never print password or connection URL | Offline fake-secret regression in `scripts/test-db-check.mjs` |
| 19.6 | Check the latest SQL migrations, particularly `0018_exam_subject_dates` and `0019_fee_payment_idempotency` | Source inspected; local application pending |
| 19.7 | `pnpm verify`: localization, parent resilience, ngrok/dev API, typecheck, tests and production build | GitHub CI runs component checks; user local smoke pending checkout |
| 19.8 | Network interruptions must not cause subsequent migration/build commands to continue as if pull succeeded | Documented PowerShell fail-fast pull-and-verify sequence |
| 19.9 | Verify /ready, /metrics, and school subscription/tenant authorization on a deployed environment | Manual acceptance pending |
| 19.10 | PostgreSQL backup and non-production restore, real Android/push testing | Manual acceptance pending |

## Symptoms reported

- `git pull origin main` failed with `Recv failure: Connection was reset`. GitHub's server cannot be updated from a user-local git pull on the assistant side; this is an HTTPS transport failure. It does **not** establish a code merge error.
- Running `pnpm verify` anyway used the old `verify-parent-resilience.mjs`, which still expects a comment marker removed by the reconnect refactor. The corrected script is already on GitHub main and passed CI.
- `pnpm db:migrate` stopped at the Drizzle `applying migrations` spinner without a useful database error message. This output does **not** identify whether the actual failure was network, TLS, authentication or SQL drift. Do not edit migration history or run `db:push` to guess at a fix.

## Safe PowerShell recovery on Windows

Run from the MaktabLink directory. A failure stops later commands; this is
important because PowerShell happily runs the next command even after a
separate git process fails.

```powershell
cd C:\projects\maktab
git status --short
git -c http.version=HTTP/1.1 pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Git pull failed; stop before migration or verify." }
pnpm db:check
if ($LASTEXITCODE -ne 0) { throw "Database preflight failed; check connectivity / credentials." }
pnpm db:migrate
if ($LASTEXITCODE -ne 0) { throw "Database migration failed; stop and investigate the original error." }
pnpm verify
if ($LASTEXITCODE -ne 0) { throw "Verification failed." }
```

If pull continues returning `Connection was reset`, test `git -c
http.version=HTTP/1.1 ls-remote origin HEAD`, check the VPN/proxy/firewall or
switch networks. Do **not** disable TLS verification, delete local changes or
run `git reset --hard` to repair a transport reset.

If `db:check` fails, its concise diagnostic should distinguish common DNS,
connection, timeout and authentication error codes without exposing secrets.
If the preflight passes but migration fails, retain the full migration error
log and inspect the actual failed SQL and Drizzle migration journal against
the local database before making any schema modification.
