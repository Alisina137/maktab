# Production Operations

## Health endpoints

### Liveness

```text
GET /health
```

Confirms that the API process can respond.

### Readiness

```text
GET /ready
```

Checks database connectivity.

Use readiness rather than liveness to decide whether the API should receive production traffic.

### Metrics

```text
GET /metrics
```

Prometheus text output currently includes:

- process uptime
- database-ready gauge
- HTTP request count grouped by method/status class
- cumulative request duration grouped by method/status class
- HTTP 5xx count

Metrics deliberately avoid school/user/student labels to prevent sensitive/high-cardinality telemetry.

A Prometheus server or OpenTelemetry Collector can scrape this endpoint at deployment level.

## Structured logs

Set:

```text
API_STRUCTURED_LOGS=true
```

or run the API in production mode.

Request completion entries include:

- request ID
- method
- parameterized route
- status code
- duration

Unhandled request errors include the same request context.

The `x-request-id` response header can be used to correlate a user-visible error with server logs.

## Platform operational summary

Protected endpoint:

```text
GET /v1/platform/health/summary
```

Reports generic platform operational counts such as subscription states and failed push deliveries.

It requires the platform provisioning credential.

## Scheduled jobs

Configure an external scheduler to invoke:

```text
POST /v1/platform/jobs/communication/run
POST /v1/platform/jobs/subscriptions/run
```

Both endpoints are protected.

The communication job materializes scheduled announcements/fee reminders and retries push delivery.

The subscription job performs subscription lifecycle/reminder work.

Job logic is idempotent where notifications are materialized; repeated runs should not duplicate the same scheduled reminder.

## Error tracking and alerting

The repository provides structured error logs, metrics, readiness, and request IDs.

A production deployment should route those signals into its selected log aggregation/error-tracking/alerting services.

No specific external vendor is hard-coded into business logic.

## Database

Use managed PostgreSQL in production.

Deployment checks should include:

- migrations applied
- `/ready` returns ready
- backup key configured
- encrypted backup succeeds
- restore drill completed before launch

## Push

Expo Push transport plumbing is implemented.

Remote push still requires valid EAS/FCM/APNs deployment credentials and a development/production mobile build.

Push failures do not roll back attendance, homework, result, announcement, or fee actions.

## Secret handling

Never log or commit:

- DATABASE_URL
- database password
- PLATFORM_PROVISIONING_KEY
- BACKUP_ENCRYPTION_KEY
- push credentials

Rotate exposed credentials through the actual provider and deployment secret store.

## Incident first response

For a pilot incident:

1. capture time and request ID
2. check `/health`
3. check `/ready`
4. inspect structured error logs
5. inspect `/metrics` 5xx/database signals
6. check platform health summary if appropriate
7. avoid destructive database edits
8. export school data/audit history for investigation when needed
9. create a verified backup before risky recovery operations
