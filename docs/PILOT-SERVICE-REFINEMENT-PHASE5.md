# Pilot Operations — Phase 5: Service Health & Subscription Assistance

**Status:** Implementation pushed to the `main` branch; full build and integration tests require execution on a machine with workspace dependencies.

## Purpose

Adds **Pilot Operations → Service Health** at `/admin/pilot/service`, independent of subscription/readiness and other dashboard APIs. It shows a strictly limited **point-in-time operations snapshot for the currently authenticated school** and offers actionable links to the existing audited support-ticket workflow.

**This screen does not claim historical uptime, live push-delivery success, background scheduler execution, backup restoration success, or production launch approval.** A school with no notification alerts may still have an unavailable scheduler. A failed health request could equally be local connectivity, auth, API or database trouble and must be shown as **unknown**, not as a confirmed server outage.

## Server behavior

### Endpoint

`GET /v1/admin/pilot/service-health`

- Authenticated with `requireSchoolAdmin`; scope is **exclusively** `context.user.schoolId`. Caller-provided query parameters are rejected with HTTP 400.
- `Cache-Control: no-store`.
- Read-only: returns no personal notification payloads, device tokens, support-ticket bodies, school-wide activity feeds, internal architecture, infrastructure hostnames, billing mutation controls or metrics for other schools.
- Includes the **existing** `evaluateSubscriptionHealth(context.subscription)` summary: platform status remains authoritative, school admins cannot renew, charge, change price, or reactivate accounts.
- If the SQL query fails, the endpoint fails instead of showing false green checks.

### Evidence-based indicators

| Indicator | Authoritative observation | Limits |
| --- | --- | --- |
| API / database | Authenticated endpoint served and its aggregate SQL query succeeded at snapshot time | Not historical availability |
| Pending notifications | Count of this school's current PENDING notification records | Not proof any push worker is running |
| Pending >60 min | PENDING records whose created_at precedes the snapshot by more than one hour | Old queues may be intentional or blocked |
| Failed notifications | Current FAILED records for this school | Not a delivery success percentage |
| Unresolved support | School-scoped tickets excluding RESOLVED/CLOSED, with separate CRITICAL count | Ticket severity is assigned by the ticket workflow |
| Failed imports, 7 days | Current school FAILED family import batches created in the last seven 24-hour periods | Does not count deliberately rejected validations |
| Scheduler, delivery, backups, uptime | Explicitly **unverified** | No fabricated green/healthy badge |

All database aggregates use parameterized SQL and `school_id` predicates.

## Interface / support workflow

- Four accessible responsive cards: current API query, notification queue, unresolved support, failed recent imports.
- Subscription assistance uses the existing platform-provided status; displays the warning when record dates/lifecycle need platform review.
- School admins can choose **Request billing help** or **Report a technical issue**. Navigation opens `/admin/pilot/launch?support=billing|technical#pilot-support-form`, prefilling an **editable, unsent** ticket draft with a safe category and standard subject. User explicitly submits the ticket. Nothing auto-creates tickets.
- API failures provide an unknown status and retry control; aborted requests cannot overwrite a newer session; app localization includes Dari, Pashto and English.
- No database migration or new billing permissions.

## Verification commands

```powershell
cd C:\projects\maktab
git pull origin main
pnpm verify:pilot:phase5
pnpm typecheck
pnpm test
pnpm build
git status
```

The Phase 5 script **also runs the older Phase 5 subscription lifecycle/reminder verification**, preserving existing checks. New app-integration tests cover auth, query rejection, one school's stale/failed notification counters, resolved/critical ticket handling, import failures, subscription summary and cross-school isolation.

### Manual acceptance

1. Open `/admin/pilot/service` as an authorized school admin. Confirm timestamp and four summaries, with no individual names, credentials or ticket content.
2. Add pending (>60 minutes old), failed and sent notifications; verify only actual queue states are counted; check another school's dashboard remains isolated.
3. Open a critical ticket and resolve it: verify the unresolved-critical count changes after refresh without changing platform launch approval automatically.
4. Add a FAILED import batch within/older than seven days and a REJECTED batch; confirm only fresh FAILED batches count.
5. Disconnect the network or expire the session; verify a clear error (not a green check) and a working retry.
6. Click billing help and technical support links; confirm their drafts are editable and never sent automatically. Submit one to verify it appears in existing support history.
7. Verify school accounts with PAST_DUE/GRACE/SUSPENDED status can still access an appropriate support path; no school billing modification is enabled.
8. Test long translated strings, RTL/Pashto/Dari, narrow screens, keyboard, and 200% text scaling.
9. Prove actual scheduler/push/backup health outside this advisory screen before approving production launch.

## Follow-up

Phase 6 can deepen auditability or operations/release oversight without conflating this dashboard with platform operations.
