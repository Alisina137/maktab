# Encrypted Database Backup & Restore

## Scope

MaktabLink includes operator tooling for encrypted PostgreSQL backups.

The scripts require PostgreSQL client tools:

- `pg_dump`
- `pg_restore`

They must be available on PATH.

## Secret separation

Configure a backup encryption secret independently from the database password:

```text
BACKUP_ENCRYPTION_KEY=<32+ character secret>
```

Store it in the deployment secret manager or local protected environment. Do not commit it to Git.

Losing this key makes encrypted backups unrecoverable.

## Create a backup

From the repository root:

```powershell
pnpm backup:db
```

Default output:

```text
backups/maktablink-<timestamp>.mlbk
```

Optional path:

```powershell
pnpm backup:db -- backups/pre-release.mlbk
```

The script:

1. reads the configured database connection
2. invokes `pg_dump --format=custom`
3. streams dump bytes through AES-256-GCM encryption
4. writes only the encrypted MaktabLink backup format
5. removes an incomplete output on failure

It does not intentionally create a plaintext dump file.

## Store the backup safely

The repository ignores `backups/`; that directory is not the long-term backup destination.

Copy encrypted backups to access-controlled storage outside the application host.

The product specification requires encrypted backups but does not define a specific cloud backup provider.

## Restore safety — two-factor target verification

**A restore is destructive.** Phase 10 deliberately forbids using the application's
usual `DATABASE_URL` as the restore destination. First provision a disposable,
**separate staging database** in Neon and verify the host, database name and
access permissions manually. Never restore a backup directly to production.

In PowerShell (substitute the actual staging URI and database name):

```powershell
$env:RESTORE_DATABASE_URL = "postgresql://STAGING_USER:STAGING_PASSWORD@STAGING_HOST/maktab_staging?sslmode=require"
$env:RESTORE_TARGET = "staging"
$env:CONFIRM_RESTORE_DATABASE = "maktab_staging"
$env:CONFIRM_RESTORE = "YES"
pnpm restore:db -- backups/maktablink-<timestamp>.mlbk
Remove-Item Env:CONFIRM_RESTORE, Env:RESTORE_TARGET, Env:CONFIRM_RESTORE_DATABASE, Env:RESTORE_DATABASE_URL
```

**Safety requirements:** All four `RESTORE_*` / `CONFIRM_RESTORE*` values are
required; the explicit database-name confirmation must match the staging URI;
the configured primary `DATABASE_URL` must also be present to detect a direct
or `-pooler` alias pointing to the same original database. If any check fails,
the script refuses to launch `pg_restore`. A second staging project with
the same database name is permitted only after you have verified it is genuinely
isolated. The guard cannot prove a manually provided hostname is a separate
project; the operator must inspect that in Neon.

The script authenticates the **entire AES-GCM archive before launching**
`pg_restore`, so a wrong encryption key or modified/truncated backup cannot
start destructive SQL execution. The authenticated archive is decrypted a
second time and streamed directly to `pg_restore` with
`--single-transaction --clean --if-exists --no-owner --no-acl --exit-on-error`.
This avoids intentionally writing plaintext backups to disk and rolls back
failed SQL operations on PostgreSQL. Do not run this against production.

**Note:** Prior instructions that changed the normal `DATABASE_URL` and
supplied only `CONFIRM_RESTORE=YES` are intentionally obsolete.
Backups are still created with `pnpm backup:db` from the source database.

## Restore drill record

Before pilot launch, record at minimum:

- backup timestamp
- restore target (non-production)
- operator
- start/end time
- result
- application smoke-test result after restore

CI syntax-checks the scripts, but CI cannot verify your PostgreSQL client installation, production credentials, storage policy, or a real restore. A restore drill is therefore an operational pilot requirement.
