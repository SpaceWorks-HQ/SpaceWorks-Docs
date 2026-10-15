---
title: Monitoring
description: Watch a Space Works deployment with structured JSON logs and request IDs, health and readiness checks, the token-protected Prometheus endpoint, the platform dashboard, Sentry and background-job checks.
sidebar:
  order: 9
---

Space Works gives you five ways to see what a deployment is doing: structured logs, health checks, a
Prometheus metrics endpoint, a built-in platform dashboard for superadmins, and optional Sentry error
reporting. None of them sends data anywhere unless you configure it.

## Logs and request IDs

Every request gets a correlation ID. If a proxy in front of Space Works already sends an
`X-Request-ID` header of up to 64 plain characters (letters, digits, `_ . : -`), that value is used;
otherwise a new one is generated. The ID is returned in the response's `X-Request-ID` header, stamped
on every log line the request produces, and carried into any background job it starts, so one search
finds everything that happened.

With `DEBUG` off, logs are one JSON object per line:

```json
{"ts": "2026-10-16T09:14:02.381+00:00", "level": "INFO", "logger": "apps.integrations.telegram", "message": "Telegram delivery skipped.", "request_id": "3f9c2b7e8a1d4c0f9e6b5a4d3c2b1a09", "makerspace_id": 4, "configured": false}
```

Extra context (such as `makerspace_id`) appears as its own key, so a log shipper (Loki, Elastic,
CloudWatch, Datadog) can filter on it without regular expressions. Calendar-feed URLs, which work as
passwords, are redacted from logs. Audit entries are linked to logs through an `audit_recorded` line
carrying the entry's ID.

| Variable | Default | Effect |
| --- | --- | --- |
| `LOG_LEVEL` | `INFO` | Minimum level |
| `LOG_JSON` | on unless `DEBUG` | `False` for the single-line human format |

Both are read by the backend but not passed through by the bundled Docker stack (see
[Environment variables](/configure/environment-variables/#which-variables-reach-the-backend-in-the-bundled-stack)).

To read logs on a Compose install:

```bash title="In the install directory"
scripts/spaceworks-compose.sh bundled logs -f backend worker beat
```

Containers keep up to five 10 MB log files each before rotating.

## Health checks

| Endpoint | Answers | Use it for |
| --- | --- | --- |
| `GET /api/v1/health/` | `{"status": "ok"}` | Liveness: the process is up. |
| `GET /api/v1/health/readiness/` | `{"status": "ready", "database": "ok", ...}` or 503 | Readiness: the database is reachable and migrated, the host is not mid-restore, and encryption keys (if used) are loaded. |

Both are public and need no token. The bundled containers use the readiness check for their own
Docker health checks, and plain-HTTP calls to these paths are never redirected to HTTPS, so internal
probes keep working. Point an external uptime monitor at
`https://<your-domain>/api/v1/health/readiness/`.

## Prometheus metrics

Set a long random `METRICS_TOKEN` to turn on `GET /api/v1/metrics/`. While the token is unset the
route answers 404, so an unconfigured deployment does not reveal it. A wrong token gets 401.

```bash title="Check it"
curl -H "Authorization: Bearer <your-metrics-token>" https://<your-domain>/api/v1/metrics/
```

```yaml title="prometheus.yml"
scrape_configs:
  - job_name: spaceworks
    scheme: https
    metrics_path: /api/v1/metrics/
    authorization:
      type: Bearer
      credentials: <your-metrics-token>
    static_configs:
      - targets: ["makerspace.example.org"]
```

The endpoint exposes counts and IDs only, never names, contact details or other tenant content:

| Metric | Labels | Meaning |
| --- | --- | --- |
| `spaceworks_celery_queue_length` | `queue` | Background jobs waiting in Redis. Empty when jobs run inline. |
| `spaceworks_hardware_requests` | `status` | Borrow requests by workflow state |
| `spaceworks_notification_deliveries_last_hour` | `channel`, `status` | Email and chat deliveries in the last hour |
| `spaceworks_storage_bytes_used` | `makerspace_id` | Storage accounted to each makerspace |
| `spaceworks_storage_bytes_used_total` | none | Storage across all makerspaces |
| `spaceworks_evidence_retention_states` | `status` | Evidence photos by retention state (`expiring`, `expired`, `cleaning`) |
| `spaceworks_evidence_retention_last_expiry_timestamp_seconds` | none | Unix time of the latest photo expiry, `0` if none |

All are gauges read at scrape time. Storage accounting is maintained on hosting platforms; on
self-hosted installs the storage gauges are not kept up to date. Scrape every minute or slower.

## Platform dashboard

Superadmins have a **Platform dashboard** tab in the staff console (not shown on a makerspace's own
custom domain). It shows backup and offsite-copy status, failed deliveries, how recently each
scheduled job ran, and usage per makerspace. Its **Problems** list runs a fixed set of checks every
15 minutes and on demand, each marked ok, warn or error with a link to the fix:

| Check | Warns | Errors |
| --- | --- | --- |
| Backups | No successful automatic backup, or the last one is older than 36 hours | Older than 72 hours, or the last run failed |
| Offsite copies | No active destination, or the latest copy is unverified | A failed or abandoned copy |
| Scheduler | A job has not run for three of its intervals | A job's last run failed |
| Updates | An update is pending or available | An update failed |
| Email and Telegram | Missing configuration or stalled health | Failed deliveries |
| Storage | 90% of the makerspace's limit | Over the limit |
| Domain | Verification pending | Verification failed |

Makerspace managers have a **Usage & limits** tab for their own makerspace. On self-hosted
installs limits do not apply.

## Background jobs

The `worker` container runs background jobs (email, chat delivery, exports) and `beat` schedules the
periodic ones. Run exactly one `beat`. Key periodic jobs:

| Job | Runs |
| --- | --- |
| Reminder sweep and membership admissions | Every 5 minutes |
| Password reset mail | Every minute |
| Return reminders | Hourly |
| Platform problem checks, scheduled reports | Every 15 minutes |
| Evidence expiry and abandoned-upload cleanup | Every 6 hours |
| Deployment backup | Daily at 02:00 UTC |
| Cleanups (expired exports, auth challenges, kiosk data) | Nightly |

What to watch:

- **Queue length.** `spaceworks_celery_queue_length` should return to zero. A steady rise means the
  worker is down or overloaded; check `scripts/spaceworks-compose.sh bundled logs worker` and
  consider raising `CELERY_CONCURRENCY`.
- **Scheduler freshness.** The **Scheduler freshness** table on the platform dashboard shows each
  job's last run. Missing runs usually mean `beat` is stopped.
- **Delivery failures.** `spaceworks_notification_deliveries_last_hour{status="failed"}` and
  **Admin → Delivery logs**.

On the cloud profile there is no worker or beat: a `cron` container runs due jobs every 15 minutes
(`CRON_INTERVAL_SECONDS`) and retries stuck mail.

## Sentry

Set `SENTRY_DSN` to send unhandled errors from the web and worker processes to Sentry or a
compatible service. The SDK is loaded only when a DSN is set, and it runs with Sentry's
`send_default_pii` option off, so user details, cookies and client IP addresses are not attached. `SENTRY_ENVIRONMENT` labels the deployment and `SENTRY_TRACES_SAMPLE_RATE` (0 to 1, default
0) turns on performance tracing.

## Suggested alerts

| Alert | Condition |
| --- | --- |
| Site down | Readiness check failing for 2 minutes |
| Jobs stuck | `spaceworks_celery_queue_length` above 100 for 15 minutes |
| Mail failing | Failed email deliveries in the last hour above a few |
| Metrics missing | Prometheus cannot scrape for 5 minutes |
| Retention stalled | Expiry is enabled but the last-expiry timestamp has not moved for several days while the preview shows eligible photos |
| Disk | Host disk for the database and `minio_data` volumes above 80% |

Also review the **Problems** list on the platform dashboard after every update.

## Related

- [Security](/configure/security/)
- [Troubleshooting](/help/troubleshooting/)
- [Backup and restore](/install/backup-restore/)
