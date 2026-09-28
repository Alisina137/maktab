# Phase 2 — Authentication & School Accounts

## Outcome

Secure school-issued account system.

Approved scope:

- role selection
- school selection
- login
- temporary password
- account status
- admin user generation

Acceptance criterion:

> A parent from School A cannot authenticate into School B using School A credentials.

## Delivered scope

### Database

- `users`
- `auth_sessions`
- `audit_logs`
- school-scoped username uniqueness
- user states: `INVITED`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`

### Authentication

- no public signup
- school + username + password + expected-role login
- backend role validation
- generated temporary passwords
- private password replacement on first login
- memory-hard scrypt password hashes
- 15-minute opaque access tokens
- rotating 30-day opaque refresh tokens
- only token hashes stored in PostgreSQL
- account suspension revokes sessions
- login rate limiting

### School administrator

Authenticated school administrators can list accounts, create accounts, generate temporary credentials, reset passwords, suspend users, and reactivate users. Tenant scope comes from the authenticated administrator session.

### Platform bootstrap

`PLATFORM_PROVISIONING_KEY` remains a platform-only bootstrap mechanism for school provisioning and first-school-admin creation. It is not an end-user login mechanism.

### Mobile

```text
Role
→ School
→ Credentials
→ Temporary-password replacement
→ Authenticated Phase 2 home
```

Mobile roles shown: Parent, Teacher, Student.

### Web

`/admin` supports school-admin login, first-login password replacement, account generation, account listing, password reset, suspend, and reactivate.

## Explicitly excluded

Phase 3 academic structure remains excluded: academic years, grades, classes, subjects, teacher assignments, Negaran assignments, and timetable. Parent/student relationship data remains a later phase concern.
