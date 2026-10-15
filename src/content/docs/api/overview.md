---
title: API overview
description: Base URLs, interactive docs, request and response conventions, rate limits and the endpoint groups of the SpaceWorks REST API.
sidebar:
  order: 1
---

Everything the SpaceWorks web console, public pages and mobile apps do goes through one REST API, served by the Django backend. You can call the same API from your own scripts, websites and integrations. This page covers the conventions every endpoint shares; the rest of this section explains how to [authenticate](/api/authentication/), how to build a signed [API client](/api/api-clients/), how to receive [webhooks](/api/webhooks/), and how [connected devices](/api/devices/) talk to the server.

## Base URL

All API routes live under `/api` on your deployment's main domain:

```text
https://spaces.example.org/api/v1/...
```

On a local development stack the backend listens on `http://localhost:8000`, so the same routes are at `http://localhost:8000/api/v1/...`.

| Prefix | What it is |
| --- | --- |
| `/api/v1/` | The current, versioned API. Use it for everything new. |
| `/api/public/` | An older, unversioned alias of the public catalogue routes (makerspace list, inventory, categories, stats, item detail and item watch). It returns the same data as `/api/v1/public/`. Prefer the `v1` paths. |

## Interactive docs

Every endpoint is described in an OpenAPI 3 schema generated from the code, so the schema always matches the server you are talking to.

| URL | What you get |
| --- | --- |
| `/docs/` | Swagger UI. Try requests in the browser; click **Authorize** to paste a Bearer token. |
| `/redoc/` | ReDoc, a read-friendly reference with every request and response schema. |
| `/schema/` | The raw OpenAPI document (YAML by default; send `Accept: application/json` for JSON). |

Visiting the bare backend root (`/`) redirects to `/docs/`. On a production install, the bundled reverse proxy forwards `/docs`, `/redoc` and `/schema` to the backend, so they work on your main domain.

:::tip[Generate a client]
Point any OpenAPI generator at `/schema/` to produce a typed client. The SpaceWorks web console does exactly this: its TypeScript types are generated from the same schema.
:::

## Versioning

- **The URL version** (`/api/v1/`) changes only for breaking changes to the route layout. New endpoints and new response fields are added within `v1`.
- **The schema version** (`info.version` in `/schema/`) matches the SpaceWorks release, for example `0.9.2`. Check it to see which release a server runs.
- **Protocols version independently.** The API-client signature format, the device signature format (`X-Device-Signature-Version: v1`) and the webhook payload format (`payload_version` 1 or 2) each carry their own version, so they can evolve without a new URL version.

## Requests and responses

- **JSON in, JSON out.** Send `Content-Type: application/json` on requests with a body. Evidence photos are not posted to the API: the API hands out a short-lived presigned upload URL and the file goes straight to object storage.
- **Trailing slashes matter.** Paths are matched exactly as shown in the schema. Some routes end in `/` (for example `/api/v1/public/{makerspace}/inventory/`) and some do not (for example `/api/v1/auth/login`). Copy paths from `/docs/`.
- **Timestamps** are ISO 8601 with a UTC offset, for example `2026-10-11T00:00:00+00:00`.
- **IDs** are integers for most records and UUIDs for devices, enrollments, printer jobs and public tokens.

### Pagination

List endpoints are paginated with page numbers, 24 items per page:

```json
{
  "count": 57,
  "next": "https://spaces.example.org/api/v1/public/tsel/inventory/?page=2",
  "previous": null,
  "results": [ ... ]
}
```

Pass `?page=N` to move through pages and follow `next` until it is `null`. A few small lookup lists (for example public inventory categories) return a plain array instead; the schema shows which.

### Errors

Errors use standard HTTP status codes with a JSON body. Three shapes are common:

```json
{ "detail": "Authentication credentials were not provided." }
```

```json
{ "detail": "The loan deposit must be settled before issue.", "code": "deposit_required" }
```

```json
{ "label": ["This field is required."], "allowed_origins": ["At least one allowed origin is required."] }
```

The first is the default for permission, authentication and not-found errors. The second is used by workflow rules (loan state machine, stock, bookings, events), where `code` is a stable machine-readable string you can branch on. The third is a field-level validation error, keyed by field name. A route whose module is switched off for that makerspace uses the same shape: `{"module": "events is disabled for this makerspace."}`.

| Status | Typical meaning |
| --- | --- |
| `400` | Validation failed, or a module needed by this route is switched off. |
| `401` | No credentials, or the credentials are invalid or expired. |
| `403` | Authenticated, but not allowed to do this (missing permission, wrong makerspace, restricted account). |
| `404` | Not found, or not visible to you. Records in a makerspace you cannot see return `404` rather than `403`, so their existence is not revealed. |
| `409` | Conflict with the current state, for example an invalid workflow transition or insufficient stock. |
| `410` | Gone: an expired enrollment, lease or evidence object. |
| `423` | The makerspace is temporarily frozen while it is being migrated. |
| `429` | Rate limited. Wait for the `Retry-After` header before retrying. |
| `503` | A dependency (object storage, Redis, encryption keys) is unavailable. Retry later. |

### Request IDs

Every response carries an `X-Request-ID` header. If you send your own `X-Request-ID` (1 to 64 characters from `A-Z a-z 0-9 _ . : -`), the server uses it; otherwise it generates one. The same ID appears on every server log line for that request and on any background job it starts, so include it when you report a problem.

## Rate limits

Sensitive and public routes are throttled per route group. Anonymous callers are counted per client IP; signed-in callers per user; verified API clients per client.

| Throttle | Default | Applies to |
| --- | --- | --- |
| `public_read` | 120/min | Public catalogue reads by anonymous callers |
| `client_public` / `client_standard` / `client_trusted` | 30/min, 120/min, 600/min | Public routes called by a signed [API client](/api/api-clients/), by its rate tier |
| `login` | 10/min | Password login |
| `request_submit` | 10/min | Borrow request submission |
| `telegram_webhook` | 60/min | The Telegram webhook route |

Many more scopes exist (MFA, password reset, sign-up, event registration, bookings, kiosk sessions and so on). Each can be changed with a `THROTTLE_<SCOPE>` environment variable, for example `THROTTLE_PUBLIC_READ=300/min`. See [Environment variables](/configure/environment-variables/).

A throttled request gets `429` and a `Retry-After` header in seconds.

## Makerspaces in URLs

SpaceWorks is multi-tenant: almost every record belongs to one makerspace, and the URL says which.

| Surface | How the makerspace is named | Example |
| --- | --- | --- |
| Public | The makerspace **slug** or its short **public code** (case-insensitive) | `/api/v1/public/tsel/inventory/` |
| Staff | The numeric makerspace ID | `/api/v1/admin/makerspace/7/devices` |
| Member | The numeric makerspace ID | `/api/v1/member/makerspaces/7/activity` |

Object routes such as `/api/v1/admin/requests/42` do not repeat the makerspace; the server works it out from the record and checks you are allowed to act there. Asking for a record in a makerspace you cannot see returns `404`.

## Endpoint groups

The schema groups operations by tag. This table maps the main groups to their path prefixes.

| Group | Path prefix | Who calls it | Main OpenAPI tags |
| --- | --- | --- | --- |
| Public catalogue | `/api/v1/public/makerspaces/`, `/api/v1/public/{makerspace}/inventory/`, `.../stats/` | Anyone | Public inventory |
| Public borrowing | `/api/v1/public/{makerspace}/requests`, `.../tools/*`, `/api/v1/public/requests/{token}/status` | Signed-in members | Public requests |
| Public events, bookings, machines | `/api/v1/public/{makerspace}/events/`, `.../spaces/`, `.../machines`, `.../machine-service/*` | Anyone; members to register or book | Public events, Public bookings, Public machines, Public machine service |
| Public membership and presence | `.../membership-requests`, `.../invitation-requests`, `.../presence-sessions` | Members | Memberships, Presence |
| Organizations | `/api/v1/public/organizations/{slug}/` | Anyone | Public organizations |
| Authentication | `/api/v1/auth/` | Everyone | Auth, MFA, Social auth, Device auth |
| Member self-service | `/api/v1/member/`, `/api/v1/memberships/` | Signed-in members | Member account, Member profile, Member events, Member bookings, Loans, Payments |
| Staff console | `/api/v1/admin/` | Staff with the right permissions | Admin makerspaces, Admin inventory, Admin requests, Admin users, Admin roles, QR assets, Containers, Stocktake, Admin machines, Admin events, Admin bookings, Admin memberships, Reports, Analytics, Backup, Platform, API clients, Devices |
| Handover | `/api/v1/guest-admin/` | Staff with handover permissions | Admin requests |
| Notifications and integrations | `/api/v1/notifications/`, `/api/v1/integrations/` | Staff and members | Notifications, Personal notifications, Notification delivery, Telegram, Native push |
| Procurement | `/api/v1/procurement/` | Staff | Procurement |
| Connected devices | `/api/v1/device/` | Enrolled printers and label printers | Device protocol |
| Kiosk and check-in stations | `/api/v1/kiosk-stations/`, `/api/v1/event-checkin-stations/` | Kiosk browsers | Kiosk stations, Event check-in stations |
| Payment provider webhooks | `/api/v1/webhooks/stripe/{code}`, `/api/v1/webhooks/razorpay/{code}` | Stripe and Razorpay | Payments |
| Operations | `/api/v1/health/`, `/api/v1/health/readiness/`, `/api/v1/metrics/`, `/api/v1/live/` | Monitoring, browsers | Health |

:::note[Handover paths keep their old name]
The `/api/v1/guest-admin/` paths are the handover API surface. The built-in Guest Admin role has been retired (handover staff now get a custom role), but the paths keep their name so existing clients do not break. Access is decided by the caller's permissions, not by the path.
:::

Optional apps that a deployment has removed have no routes at all and answer `404`. Routes for a module that is installed but switched off for a makerspace answer `400` with a `module` error. See [Modules](/guides/modules/).

### Live updates

`GET /api/v1/live/` is a Server-Sent Events stream for signed-in users. It sends `change` events of the form `{kind, makerspace_id, target_type, target_id, actor_id, ts}` for the makerspaces you can see, plus a `: keep-alive` comment every 25 seconds. The stream carries no record content: when you get an event, refetch through the normal endpoints. It returns `503` when the deployment has no Redis, in which case poll instead. Because it needs an `Authorization` header, read it with `fetch()` and a stream reader rather than the browser's `EventSource`.

## Your first call

The public catalogue needs no account. Replace `tsel` with your makerspace's slug or public code:

```bash
curl -s "https://spaces.example.org/api/v1/public/tsel/inventory/?q=soldering&page=1" \
  -H "Accept: application/json"
```

```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 31,
      "name": "Soldering station",
      "description": "Temperature-controlled, 60 W.",
      "category_id": 4,
      "category_name": "Electronics",
      "category_slug": "electronics",
      "borrowing_terms": "...",
      "availability": { "mode": "exact_count", "count": 3, "label": "Available" },
      "image_url": null
    }
  ]
}
```

The inventory list also accepts `category=<slug>` and `sort=name|most_used|popular`.

`availability` follows each item's public visibility settings: it is `null` when counts are hidden, `{"mode": "status_only", "label": ...}` when only a status is shown, and includes `count` only when the makerspace chose to publish exact counts. The label is `Available`, `Limited` or `Unavailable`.

:::note
A deployment can require every public call to carry API-client or publishable-key credentials. If an anonymous call returns `401 {"detail": "Invalid client signature."}`, see [API clients](/api/api-clients/).
:::

## Next steps

- [Authentication](/api/authentication/): sign in and call staff and member endpoints.
- [API clients](/api/api-clients/): sign server-to-server requests to the public API.
- [Webhooks](/api/webhooks/): receive signed events from SpaceWorks.
- [Devices](/api/devices/): connect printers and label printers.
