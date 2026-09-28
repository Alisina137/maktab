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

## Restore safety

A restore is destructive.

Test restore first against a non-production database.

Point `DATABASE_URL` to the intended restore target and set explicit confirmation:

```powershell
$env:CONFIRM_RESTORE = "YES"
pnpm restore:db -- backupsmaktablink-<timestamp>.mlbk
Remove-Item Env:CONFIRM_RESTORE
```

The restore script:

1. validates the MaktabLink backup header
2. derives the AES key from `BACKUP_ENCRYPTION_KEY`
3. decrypts as a stream
4. pipes directly into `pg_restore`
5. uses `--clean --if-exists --no-owner --no-acl --exit-on-error`

No plaintext restore file is intentionally written.

## Restore drill record

Before pilot launch, record at minimum:

- backup timestamp
- restore target (non-production)
- operator
- start/end time
- result
- application smoke-test result after restore

CI syntax-checks the scripts, but CI cannot verify your PostgreSQL client installation, production credentials, storage policy, or a real restore. A restore drill is therefore an operational pilot requirement.
