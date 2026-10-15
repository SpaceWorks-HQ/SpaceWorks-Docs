---
title: Webhooks
description: Receive signed JSON webhooks from SpaceWorks, verify their signatures, and handle retries and duplicate deliveries.
sidebar:
  order: 4
---

Signed webhooks let SpaceWorks call **your** HTTPS endpoint whenever something happens in a makerspace: a loan is accepted, a booking is confirmed, a printer goes offline, a payment is received. They use the same notification matrix, retry logic and delivery log as the Slack, Discord, Mattermost and Telegram channels, but deliver structured, signed JSON instead of a chat message.

## Set up a webhook

1. **Enable the module.** Turn on **Signed webhooks** (module key `webhook`) for the makerspace. See [Modules](/guides/modules/).
2. **Add a destination.** In the staff console's notification settings, add a destination on the **Signed webhook** channel with your endpoint URL and a signing secret. Or use the API (requires the **manage makerspace** permission):

   ```bash
   curl -s https://spaces.example.org/api/v1/admin/makerspace/7/notification-destinations \
     -H "Authorization: Bearer <staff-access-token>" \
     -H "Content-Type: application/json" \
     -d '{
           "channel": "webhook",
           "label": "Inventory sync",
           "webhook_url": "https://hooks.example.org/spaceworks",
           "signing_secret": "<a-random-secret-of-16-or-more-characters>",
           "payload_version": 2
         }'
   ```

3. **Route events to it.** Every event family starts with the webhook channel switched **off**. Turn on the events you want in the notification matrix (staff console, or `PATCH /api/v1/admin/makerspace/{id}/notification-rules`). See [Notifications](/configure/notifications/).
4. **Send a test.** `POST /api/v1/integrations/makerspace/{id}/delivery-test` with `{"destination_id": <id>}` sends a `system.delivery_test` event so you can check your receiver end to end.

Rules for the endpoint URL:

- It must be an absolute `https://` URL with no embedded credentials and no fragment.
- Its hostname must resolve to a public address. Private, loopback and other non-public addresses are refused when you save the destination and again at every send, and the connection is pinned to the address that was checked. To test against a laptop, expose it through a public HTTPS tunnel.
- The signing secret is between 16 and 512 characters. It is stored encrypted and never shown again; the API only reports `signing_secret_set: true`. To change it, `PATCH` the destination with a new `signing_secret`.

## Payload formats

Each destination has a `payload_version`. Version 1 is the default for existing destinations; version 2 is the structured format recommended for new integrations. You can switch a destination at any time by updating `payload_version`. Both versions use the same signature.

### Version 2 (structured)

```json
{
  "version": 2,
  "id": "42",
  "event": "hardware_requests.accepted",
  "makerspace_id": 7,
  "occurred_at": "2026-10-11T00:00:00+00:00",
  "data": { "request_id": 123 }
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | integer, always `2` | Payload format version. |
| `id` | string | The delivery ID. Stable across retries of the same delivery. |
| `event` | string | `<family>.<event>`, for example `bookings.confirmed`. |
| `makerspace_id` | integer | The makerspace the event belongs to. |
| `occurred_at` | date-time | When the event happened (captured before queueing, so it is stable across retries). |
| `data` | object | Positive integer IDs of the records involved. Missing IDs are omitted. |

Version 2 deliberately carries **only identifiers**: no chat text, names, email addresses, phone numbers, payment-provider handles, download links or free-form notes. Fetch the details you need from the API with those IDs. The envelope and `data` reject unknown fields, so a version-2 payload never grows silently; new data would come with a new payload version.

A complete JSON Schema (Draft 2020-12) with one definition per event is published at [`docs/webhooks-v2.schema.json`](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/docs/webhooks-v2.schema.json). Use it to validate payloads in tests.

| Family | `data` properties |
| --- | --- |
| `hardware_requests` | `request_id`, `payment_id` |
| `printing` | `machine_service_request_id`, `request_id`, `machine_id` |
| `events` | `event_id`, `series_id`, `registration_id` |
| `bookings` | `booking_id`, `space_id` |
| `maintenance` | `machine_id`, `schedule_id`, `maintenance_log_id` |
| `members` | `membership_request_id`, `membership_id` |
| `api_access` | `api_key_request_id` |
| `devices` | none |
| `payments` | `payment_id`, `refund_id`, `request_id`, `booking_id`, `registration_id`, `membership_id` |
| `stock` | `to_buy_item_id`, `pool_id` |
| `certifications` | `certification_grant_id`, `certification_type_id`, `membership_id` |
| `reports` | `schedule_id` |
| `system.delivery_test` | none |

### Version 1 (legacy)

Version 1 sends the same message a chat room would get, plus IDs:

```json
{
  "id": 42,
  "event": "accepted",
  "feature": "hardware_requests",
  "makerspace_id": 7,
  "text": "Hardware request #12 has been accepted.",
  "data": { "request_id": 12, "occurred_at": "2026-10-10T01:02:03+00:00" },
  "created_at": "2026-10-10T01:02:04+00:00",
  "structured": {
    "version": 1,
    "event": "hardware_requests.accepted",
    "ids": { "request_id": 12 },
    "makerspace": { "id": 7 },
    "occurred_at": "2026-10-10T01:02:03+00:00"
  }
}
```

Here `event` is the bare event key and `id` is an integer. If you are on version 1, automate on `structured.event` and `structured.ids` rather than parsing `text`.

## Event catalogue

| Family | Events |
| --- | --- |
| `hardware_requests` | `submitted`, `accepted`, `rejected`, `issued`, `partially_returned`, `returned`, `closed_with_issue`, `return_reminder`, `deposit_raised`, `late_fee_raised`, `overdue_escalated`, `back_available` |
| `printing` | `submitted`, `accepted`, `started`, `rejected`, `completed`, `failed`, `collected`, `reprinted` |
| `events` | `published`, `cancelled`, `completed`, `registration_created`, `registration_pending_approval`, `registration_waitlisted`, `registration_approved`, `registration_rejected`, `registration_cancelled`, `registration_promoted`, `registration_attended`, `series_published`, `series_cancelled`, `series_completed`, `series_generation_failed`, `reminder` |
| `bookings` | `created`, `confirmed`, `rejected`, `cancelled`, `completed`, `no_show`, `reminder` |
| `maintenance` | `schedule_created`, `schedule_updated`, `schedule_deactivated`, `logged`, `schedule_completed`, `due_soon`, `overdue` |
| `members` | `request_pending`, `member_joined`, `approved`, `declined`, `renewal_due`, `lapsed`, `renewal_failed`, `awaiting_payment`, `payment_due`, `renewed`, `grace_started`, `cancelled`, `broadcast` |
| `api_access` | `api_key_request_resolved` |
| `devices` | `offline`, `recovered` |
| `payments` | `charge_raised`, `payment_due_soon`, `payment_due_today`, `payment_overdue`, `payment_received`, `refund_issued`, `payment_failed` |
| `stock` | `low_stock`, `procurement_received` |
| `certifications` | `granted`, `revoked`, `expiring`, `expired` |
| `reports` | `scheduled_report` (sent when a scheduled report is delivered to this destination) |
| `system` | `delivery_test` |

An event only reaches your endpoint if its module is enabled for the makerspace and its webhook cell is switched on in the matrix.

## The request

SpaceWorks sends a `POST` with these headers:

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `User-Agent` | `SpaceWorks-Webhook/2` (or `SpaceWorks-Webhook/1` for version-1 payloads) |
| `X-SpaceWorks-Event` | Version 2: `<family>.<event>`. Version 1: the bare event key. |
| `X-SpaceWorks-Delivery` | The delivery ID. Same as the body's `id`. |
| `X-SpaceWorks-Signature` | `t=<unix seconds>,v1=<hex signature>` |

The body is compact JSON with sorted keys. Do not rely on that formatting; verify against the raw bytes you receive.

## Verifying signatures

The signature is the lowercase hex HMAC-SHA256 of the timestamp, a dot, and the raw body:

```text
v1 = hex( HMAC-SHA256( signing_secret, "<t>." + raw_body_bytes ) )
```

The `v1` label names the signature algorithm, not the payload version; it is `v1` for both payload formats.

To verify:

1. Parse `t` and `v1` from `X-SpaceWorks-Signature`.
2. Reject the request if `t` is too far from your clock (five minutes is a good tolerance).
3. Recompute the HMAC over the **raw** body bytes, before any JSON parsing.
4. Compare with a constant-time comparison.

### Python (Flask)

```python title="receiver.py"
import hashlib
import hmac
import time

from flask import Flask, abort, request

app = Flask(__name__)
SIGNING_SECRET = "<your-signing-secret>"
TOLERANCE_SECONDS = 300


def verify(header: str, raw_body: bytes, secret: str) -> bool:
    try:
        parts = dict(item.split("=", 1) for item in header.split(","))
        timestamp = int(parts["t"])
        received = parts["v1"]
    except (KeyError, ValueError):
        return False
    if abs(time.time() - timestamp) > TOLERANCE_SECONDS:
        return False
    expected = hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, received)


@app.post("/spaceworks")
def spaceworks_webhook():
    raw = request.get_data()  # raw bytes, before parsing
    if not verify(request.headers.get("X-SpaceWorks-Signature", ""), raw, SIGNING_SECRET):
        abort(401)
    event = request.get_json()
    if already_processed(event["id"]):       # your own de-duplication store
        return "", 204
    handle(event["event"], event["data"])    # keep this fast; queue slow work
    mark_processed(event["id"])
    return "", 204
```

### JavaScript (Node.js and Express)

```js title="receiver.mjs"
import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNING_SECRET = process.env.SPACEWORKS_SIGNING_SECRET;
const TOLERANCE_SECONDS = 300;

function verify(header = "", rawBody, secret) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  const t = Number.parseInt(parts.t, 10);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.`).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

const app = express();

// express.raw keeps the body as a Buffer so the signature is checked on the exact bytes.
app.post("/spaceworks", express.raw({ type: "application/json" }), (req, res) => {
  if (!verify(req.get("X-SpaceWorks-Signature"), req.body, SIGNING_SECRET)) {
    return res.sendStatus(401);
  }
  const event = JSON.parse(req.body.toString("utf8"));
  // De-duplicate on event.id, then handle event.event / event.data.
  res.sendStatus(204);
});

app.listen(3000);
```

### Test vector

With secret `change-me-to-a-long-secret`, timestamp `1760000000` and this exact body:

```json
{"data":{"request_id":123},"event":"hardware_requests.accepted","id":"42","makerspace_id":7,"occurred_at":"2026-10-11T00:00:00+00:00","version":2}
```

the header is:

```text
t=1760000000,v1=b12c8b2414217d1cb3b506c0642370b455973d224fad90eb4f9f9f432ddfe2cc
```

## Delivery, retries and failures

- **Success** is any `2xx` response within **5 seconds**. Respond quickly and do slow work in the background.
- **Redirects** (`301`, `302`, `303`, `307`, `308`) are followed up to three hops; each new location is checked against the same public-address rules. A redirect without a `Location`, or a fourth hop, is a failure.
- **Anything else** (a non-2xx status, a timeout, a TLS or connection error) fails the attempt. The delivery worker retries up to **3 more times** with exponential backoff: roughly 1, 2 and 4 minutes, plus a little random jitter.
- After the last retry the delivery is marked **failed** in the makerspace's **Delivery logs**. A space manager can retry it from there (or with `POST /api/v1/integrations/makerspace/{id}/delivery-logs/channel/{log_id}/retry`), and a Super Admin can retry it from `/control/`. A manual retry re-sends the same delivery with the same ID.

Each retry gets a fresh timestamp and signature, but the body (including `id` and `occurred_at`) is unchanged.

Deliveries are sent by the background worker shortly after the event. If the makerspace has quiet hours set in its notification timing policy, a delivery can be held until they end; `occurred_at` still records when the event happened.

:::note[Daily limits on managed hosting]
Self-hosted deployments have no cap on webhook deliveries. On a managed (hosted) deployment, each makerspace may have a daily limit per notification channel; once it is reached, further deliveries that day are recorded as failed with "Daily webhook notification limit reached for this space."
:::

## Idempotency

Delivery is **at least once**, not exactly once. A worker can crash after your server accepted a request but before SpaceWorks recorded the success, and that delivery will be sent again.

- **De-duplicate on the delivery ID** (`id` in the body, `X-SpaceWorks-Delivery` in the headers). If you receive webhooks from more than one SpaceWorks deployment, key on deployment plus ID.
- Each destination gets its own delivery ID for the same event, so two destinations pointing at the same URL will each deliver.
- Make handlers safe to re-run: "set status to accepted" rather than "increment a counter".
- Use `occurred_at`, not the time you received the request, when ordering events. Retries can arrive out of order.

## Related

- [Notifications](/configure/notifications/): the notification matrix and other channels.
- [API clients](/api/api-clients/): calling SpaceWorks from your server.
- [API overview](/api/overview/)
