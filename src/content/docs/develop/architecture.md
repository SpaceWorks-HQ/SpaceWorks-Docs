---
title: Architecture
description: How Space Works is put together, from the deep backend modules to live updates, background jobs and evidence storage.
sidebar:
  order: 1
---

Space Works is a multi-tenant system for running makerspaces: lending hardware, machine and print
queues, bookings, events, membership and the reporting around them. Its central design concern is
**traceability of physical handovers**. Every issue and return of hardware produces evidence (QR
scans, photos, remarks) and an append-only audit trail.

This page explains the shape of the system and the handful of rules that hold it together. Read it
before you change backend behaviour; most review feedback on new contributions traces back to one of
the rules below.

## System overview

The browser clients are deliberately thin. React owns routes, forms, cached server state and
presentation. Django and Django REST Framework (DRF) own tenancy, authorization, invariants, state
transitions, quantity accounting, storage finalization, notifications and audit entries.

```text
                Browsers: public site, member area, staff console, kiosk
                                         |
                            reverse proxy (Caddy / nginx)
          /api/v1/live/ |      /api/, /docs/, /redoc/, /schema/      |  everything else
                        |                     |                       |
         +--------------+        +------------+-----------+   +-------+--------+
         | live         |        | backend                |   | frontend       |
         | (SSE stream, |        | Django 6 + DRF         |   | nginx serving  |
         |  gunicorn    |        | /api/v1/...            |   | the built      |
         |  gthread)    |        | /control/ (Django      |   | React SPA      |
         +------+-------+        |  admin, superadmin)    |   +----------------+
                |                +--+---------+--------+--+
                |   pub/sub         |         |        |
                +------> Redis <----+         |        +----> S3-compatible storage
                          ^    ^              |               (bundled Silo/MinIO,
                          |    |              v                AWS S3, R2, ...)
             Celery worker |    | Celery   PostgreSQL 16
                           +----+ beat
```

| Piece | Role |
| --- | --- |
| `backend` | The Django/DRF API under `/api/v1/`, OpenAPI docs at `/schema/`, `/docs/` and `/redoc/`, and the superadmin-only Django admin at `/control/`. |
| `live` | A second backend process that serves only the Server-Sent Events stream at `/api/v1/live/`. |
| `worker` / `beat` | Celery worker and scheduler for asynchronous and periodic jobs. |
| `frontend` | nginx serving the production React build. |
| `db` | PostgreSQL 16. Append-only and immutability rules are enforced here with triggers. |
| `redis` | Celery broker, shared cache for rate limits, and the live-update pub/sub channel. |
| `minio` | Bundled S3-compatible object storage (the maintained Silo fork of MinIO). |

:::note
`/control/` is the Django admin and is reserved for superadmins. The React staff console lives at
`/admin/` on the frontend. The two are easy to confuse because Django's conventional admin path is
`/admin/`.
:::

## Deep modules

The backend is a set of Django apps under `backend/apps/`, but the boundaries that matter are the
*deep modules* below. Each one hides a lot of logic behind a small interface, and other code is
expected to go through that interface rather than reach around it.

| Module | Where it lives | Responsibility |
| --- | --- | --- |
| Auth and RBAC | `apps/accounts/rbac.py` | Resolves what an actor may do and in which makerspaces. Exposes `can(actor, action, makerspace_id)`, `scope_by_makerspace(actor, queryset)` and `scope_by_action(actor, action, queryset)`. Blocks restricted and suspended users. |
| Request Workflow | `apps/hardware_requests/workflow.py` | The hardware request state machine: submit, accept, reject, assign box, issue, return, renew. Emits audit entries and notifications and coordinates inventory. |
| Inventory Availability | `apps/inventory/availability.py` | All quantity math for reserve, issue, return, stocktake, transfer and mark-lost, plus asset status for QR-tracked tools. |
| QR code and box | `apps/boxes/` | Generates, resolves and revokes QR codes, binds boxes to requests and records immutable scan history. |
| Evidence photo | `apps/evidence/` | Presigned uploads, finalization and immutable `EvidencePhoto` metadata. |
| Audit | `apps/audit/` | The append-only `AuditLog` and its single writer, `apps.audit.services.record()`. |
| Integrations | `apps/integrations/` | Outbound notifications: email, Telegram, Slack, Mattermost, Discord and signed webhooks. |
| Module registry | `apps/makerspaces/module_registry.py` | The single source of truth for module keys, defaults and dependencies. |

Other domains follow the same pattern with their own transition authority:
`machines.service_workflow` for machine-service jobs (3D printing is a machine type and runs through
it), the `bookings` services for bookings, and the `events` services for events and registrations.
Views validate input and check permissions; they never implement a transition themselves.

## The two load-bearing rules

These two rules are easy to break if you only read one module, and breaking either corrupts data in a
way tests may not catch.

### 1. The Request Workflow is the only path for state transitions

Every surface that changes a hardware request goes through the same workflow service: the React staff
console, the handover console and the `/control/` admin actions. Never assign to
`HardwareRequest.status` directly. The workflow is what writes the audit entry, sends notifications
and moves inventory, so a direct status write silently skips all three.

The request state machine is:

```text
draft -> pending_approval -> rejected
                          -> accepted -> issued -> partially_returned -> returned
                                                -> returned
                                                -> closed_with_issue
```

The workflow enforces only allowed transitions. `closed_with_issue` is how lost or damaged hardware is
tied back to the borrower's account status.

:::note[Chat is not a decision surface]
Telegram is **outbound only**. The old accept/reject buttons were removed, and the webhook route now
acknowledges and discards every callback. If you ever add a new decision surface, it must call the
workflow module, never the database.
:::

### 2. Inventory Availability owns all quantity math

Reserving, issuing, returning and marking items lost all flow through `apps.inventory.availability`.
It locks rows, requires an atomic transaction for mutations and raises `InsufficientStock` instead of
letting a count go negative. No other module computes available, reserved or issued counts. The
invariant "availability never goes below zero" lives here and nowhere else.

## Multi-tenancy

`Makerspace` is the tenant root. Every domain record carries a makerspace directly or through its
parent (a booking through its space, a print file through its request). A makerspace owns its
inventory, public URL, staff, custom roles, notification channels, QR namespace and audit scope.

User accounts are global. A person joins a makerspace through a `MakerspaceMembership`, whose role is
an editable, per-makerspace set of *actions* (for example `edit_inventory` or `issue_request`).
Superadmin is the only global role, and even it can be locked out of a makerspace that has disabled
superadmin access.

:::danger[Scope every staff query]
Any list or lookup made for a staff actor must be filtered through the Auth module, typically
`rbac.scope_by_action(...)` or `rbac.scope_by_makerspace(...)`. Forgetting this is a cross-tenant data
leak, not just a bug.
:::

On top of RBAC, an *origin scope* check derives the makerspace from the browser's domain and refuses
cross-tenant targets on staff routes, so a single-domain deployment cannot be used to reach another
tenant.

## Hard rules baked into the workflows

These are enforced in code and must not regress:

- Reviewed-request hardware cannot be issued without both a box QR scan and an issue photo.
- Self-checkout and staff direct handouts cannot be issued without uploaded issue evidence and an
  eligible scanned tool.
- Hardware cannot be returned without a return photo and a return remark.
- Issued quantity cannot exceed accepted quantity without an authorized workflow permission.
- Evidence photo rows and QR scan records are immutable; audit logs are append-only.
- The public catalogue never exposes storage locations, box IDs, QR codes, scan history, evidence
  photos, requester history or hidden counts.

## Evidence storage

Evidence photos live in a **private** bucket (`AWS_STORAGE_BUCKET_NAME`, `evidence` by default).
Public images such as product photos live in a separate public bucket (`PUBLIC_IMAGE_BUCKET`).

The upload flow is designed so an accepted photo can never be swapped out:

1. The client asks for a presigned upload. The URL is bound to an exact MIME type and a content-length
   range, and it always targets a **staging key**. The final object key is never client-writable.
2. The client uploads directly to object storage.
3. The workflow that consumes the photo (issue, return, self-checkout) validates the staged object and
   promotes it to its final key exactly once, inside its own transaction, and attaches the immutable
   `EvidencePhoto` row.

Reads always go through short-lived signed URLs. Photo bytes may expire under an optional retention
policy, but the photo metadata, remarks, scans and audit history are kept, so the accountability trail
survives. See [Evidence retention](/configure/evidence-retention/) for the operator side.

## Background jobs

Celery runs asynchronous work (email delivery, exports, imports, report generation) and, through
`beat`, a periodic schedule declared in `CELERY_BEAT_SCHEDULE` in `backend/config/settings.py`. That
schedule includes the reminder sweep, return reminders, membership admission sweeps, audit
attestation, evidence retention and offline-device scans.

Without a broker (`CELERY_BROKER_URL` unset), tasks run inline (`CELERY_TASK_ALWAYS_EAGER`), so
request-triggered work still happens. Periodic tasks, however, need *something* to fire them. For
hosts with no beat process, `python manage.py run_scheduled_tasks --due-only` runs every due task and
is meant to be driven by cron or a platform scheduler.

## Live updates (SSE over Redis)

The staff console stays fresh without polling hard:

1. Every state-changing service already calls `apps.audit.services.record()`.
2. On commit, `record()` publishes a tiny, PII-free hint (the audit action and a target reference) to
   a Redis pub/sub channel for that makerspace.
3. The `live` service streams those hints to signed-in browsers at `/api/v1/live/`.
4. The browser maps the hint to TanStack Query keys and invalidates them, so data is refetched through
   the ordinary, RBAC-scoped endpoints.

The stream carries hints, never data. `LIVE_REDIS_URL` defaults to the Celery broker. With no Redis
the endpoint answers `503` and the console falls back to polling. Publishing is best-effort: a failed
publish is logged and never breaks the request that produced the audit row.

## Modules and separability

Features are packaged as **modules** (34 keys, six of them core). A makerspace enables the modules it
uses, and every gated endpoint checks the module with `require_module(...)`. Uninstalling a module
hides its surfaces but keeps every row; purging its data is a separate, explicit step. See
[Adding a module](/develop/adding-a-module/).

Separately, a *deployment* can **tombstone** whole apps with `TOMBSTONED_APPS` so their URLs, admin
pages and OpenAPI paths are not shipped at all. Tombstoning never touches data: rows, migrations,
purge plans and PII mappings are all retained. Only apps listed in `SEPARABLE_APPS`
(`apps/separability/tombstones.py`) can be tombstoned; naming anything else refuses startup. A module
is usable only when the makerspace enabled it **and** the deployment still ships its app, and
`module_enabled()` checks both.

## Related

- [Project structure](/develop/project-structure/)
- [Backend conventions](/develop/backend-conventions/)
- [Migrations and data](/develop/migrations-and-data/)
- [Concepts](/get-started/concepts/)
