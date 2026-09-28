# Pilot Runbook

This runbook is the operational sequence for onboarding and validating a real MaktabLink pilot school without direct database manipulation.

## 1. Prepare the environment

Required runtime configuration is documented in `.env.example`.

Keep production secrets outside source control:

- `DATABASE_URL`
- `PLATFORM_PROVISIONING_KEY`
- `BACKUP_ENCRYPTION_KEY`

For push delivery, configure the Expo/EAS project and credentials appropriate to the mobile build.

## 2. Verify service readiness

Check:

```text
GET /health
GET /ready
GET /metrics
```

Expected before onboarding:

- process healthy
- database ready
- no repeating server-error pattern in structured logs

Platform support can also query the protected operational summary.

## 3. Onboard the school

Use:

```text
POST /v1/platform/pilot/onboard
```

Provide:

- school code/name/slug/province/city/default language
- initial school-admin username
- optional subscription configuration

The response returns the one-time temporary administrator credential.

Do not insert the school/admin manually in PostgreSQL.

## 4. Administrator first login

The administrator:

1. chooses the school
2. signs in using the issued temporary credential
3. replaces the temporary password
4. opens Pilot Readiness

The permanent password is never recoverable by an administrator or platform operator.

## 5. Configure the academic structure

Recommended dependency order:

1. academic year
2. grade levels
3. classes
4. subjects
5. teacher accounts/profiles
6. teacher assignments
7. Negaran assignments
8. timetable

Use the readiness checklist to catch missing core configuration.

## 6. Import families and students

Download the exact CSV templates from Pilot Readiness.

The import flow remains:

```text
upload
→ map columns
→ validate
→ review errors
→ confirm
→ import
→ distribute generated credentials
```

Never bypass validation by writing directly to the database.

## 7. Validate critical workflows

Use `docs/PILOT-TEST-MATRIX.md` plus manual UI smoke checks.

At minimum, verify with pilot data:

- parent can see all linked children and no unrelated child
- teacher sees assigned work only
- Negaran can submit class attendance
- parent receives the attendance state
- homework becomes visible only after publication
- draft marks remain private until results publication
- class announcement stays inside its audience
- parent sees issued fee status
- subscription suspension produces the intended service behavior

## 8. Accessibility/device smoke check

On representative Android devices:

- increase system font/text size
- enable reduced motion
- inspect Dari and Pashto RTL screens
- use TalkBack for login, child switching, attendance buttons, and key home cards
- confirm status is understandable without color alone
- confirm action targets are comfortably tappable

On admin web:

- complete login and common forms using keyboard only
- confirm visible focus
- confirm errors are announced/readable
- test browser zoom

Record any device-specific issue before expanding the pilot.

## 9. Configure operational jobs

A deployment scheduler must invoke both protected jobs:

```text
POST /v1/platform/jobs/communication/run
POST /v1/platform/jobs/subscriptions/run
```

Choose the production cadence based on the school's desired notification timing.

Run jobs with the platform provisioning header and monitor failures.

## 10. Establish backup/restore operations

Before the pilot stores irreplaceable school data:

1. configure a backup encryption key separate from the database credential
2. create an encrypted backup
3. copy it to access-controlled off-host storage
4. perform a restore drill against a non-production database
5. document operator, timestamp, result, and recovery time

See `docs/BACKUP-RESTORE.md`.

## 11. Configure monitoring

At deployment level:

- collect structured API logs
- scrape `/metrics`
- monitor `/ready`
- alert on repeated 5xx responses/database-not-ready
- connect an error-tracking service if used by the deployment
- review failed push-delivery counts from the platform health summary

Repository support does not mean those external services are automatically configured.

## 12. Pilot go/no-go

A school is a pilot candidate when:

- Pilot Readiness core checks pass
- critical workflow tests pass
- migration and production build succeed
- backup restore drill is documented
- monitoring/schedulers are configured
- admin staff have the administrator guide
- device/accessibility smoke checks have no unresolved critical issue

Do not remove historical school data as a shortcut to resolve pilot issues. Fix the workflow or create an audited correction.
