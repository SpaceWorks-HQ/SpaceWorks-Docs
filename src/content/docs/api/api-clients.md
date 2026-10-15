---
title: API clients
description: Create a machine-to-machine API client, choose its scopes, and sign requests to the public API with HMAC-SHA256.
sidebar:
  order: 3
---

An **API client** is a credential for software rather than a person: a website that embeds your catalogue, a server that submits requests on your behalf, or a dashboard that reads public stats. API clients cover the **public API** only. Staff and member endpoints always need a signed-in user (see [Authentication](/api/authentication/)).

## What is protected

The API-client layer applies to paths under the prefixes in `HMAC_PROTECTED_PATH_PREFIXES`, which by default are:

```text
/api/public/
/api/v1/public/
```

Everything else (`/api/v1/admin/`, `/api/v1/member/`, `/api/v1/auth/`, webhooks, the `/control/` admin) is outside this protocol and authenticates by other means.

Two settings decide how strict the deployment is. Both default to `False`:

| Setting | When `False` | When `True` |
| --- | --- | --- |
| `API_CLIENT_AUTH_REQUIRED` | Unsigned requests to public paths pass through as anonymous; normal permissions and rate limits still apply. Requests that *would* have been rejected are logged. | Every request to a protected path must carry valid client credentials, or it gets `401`. |
| `APICLIENT_REQUIRE_NONCE` | `X-Nonce` is optional, but honoured when sent. | Signed requests without `X-Nonce` are rejected. |

Even with enforcement off, credentials you do send are checked. A request that carries `X-Nonce` and fails verification is rejected rather than falling back to anonymous, so a replayed request can never slip through.

:::tip[Before turning enforcement on]
Run `python manage.py api_client_enforcement_report` in the backend container. It lists clients still on `legacy:v1`, clients with no allowed origins, and clients holding scopes outside the current vocabulary: everything that would break when you flip the switches.
:::

## Three ways to identify a caller

| Shape | Headers | Use it for |
| --- | --- | --- |
| **Signed server client** | `X-Client-Id`, `X-Timestamp`, `X-Signature`, and `X-Nonce` | Server-to-server calls. The only shape that gets its own rate-limit tier. |
| **Browser client** | `X-Client-Id` plus a registered `Origin` (no timestamp or signature) | A first-party web frontend. It identifies the site, but both values are public, so it is never trusted with a higher rate limit. |
| **Publishable key** | `X-Publishable-Key: <key>` (or `?key=<key>`) plus a registered `Origin` | A makerspace's own public website. Scoped to that one makerspace. |

A server client must not send `Origin` or `Referer` headers unless that origin is in its allowed list. Most server HTTP libraries send neither.

A makerspace's publishable key is shown in the staff console and returned as `public_api_key` by `GET /api/v1/admin/makerspace/{id}/api-settings`. It only works while the makerspace's public site is enabled, and only from one of its public origins.

## Creating a client

Staff with the **manage makerspace** permission create clients in the staff console's **API clients** panel, or through the API:

```bash
curl -s https://spaces.example.org/api/v1/admin/makerspace/7/api-clients \
  -H "Authorization: Bearer <staff-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
        "label": "Website catalogue sync",
        "scopes": ["public:read"],
        "allowed_origins": ["https://www.example.org"]
      }'
```

The response includes the new `client_id` (it starts with `ck_`) and a `client_secret`:

```json
{
  "id": 3,
  "label": "Website catalogue sync",
  "client_id": "ck_<random>",
  "client_secret": "<shown-once>",
  "client_type": "server",
  "scopes": ["public:read"],
  "rate_limit_tier": "standard",
  "allowed_origins": ["https://www.example.org"],
  "public_api_base_url": "https://spaces.example.org/api/v1/public/TSEL",
  "is_active": true
}
```

:::caution[Copy the secret now]
`client_secret` is returned only on creation and on rotation. It is stored encrypted and can never be read back. Keep it in a secrets manager, never in browser code.
:::

Notes on the fields:

- `allowed_origins` is required and must list at least one exact origin (`scheme://host[:port]`, no path, no wildcard). Browser clients and publishable keys are checked against it; server clients only use it if they send an `Origin`.
- `client_type` (`server` or `browser`) and `rate_limit_tier` (`public`, `standard` or `trusted`) can only be set by a global Super Admin. Clients created by makerspace staff are `server` clients on the `standard` tier.
- A client created inside a makerspace is bound to it and can only reach that makerspace's routes.
- Makerspace staff who need more than they can grant can file a request with `POST /api/v1/admin/api-key-requests` (`makerspace`, `label`, `reason`, `allowed_origins`) for a Super Admin to review.

`GET /api/v1/admin/makerspace/{id}/api-client-scopes` returns the scope catalogue with a `grantable` flag for the current user, which is handy for building a picker. Clients are listed, edited (`PATCH`) and deleted at `/api/v1/admin/makerspace/{id}/api-clients` and `/api/v1/admin/api-clients/{id}`.

## Scopes

Each protected route has an entry in a fixed **route registry**, keyed by route name and HTTP method. The entry says which scopes may call it and which makerspace it addresses.

| Scope | Grants | Who can grant it |
| --- | --- | --- |
| `public:read` | `GET`/`HEAD` on registered public routes (catalogue, stats, events, spaces, machines, request status) | Makerspace staff |
| `public:write` | `POST` (and a few `DELETE`) on registered public routes (borrow requests, bookings, event registration, membership requests) | Makerspace staff |
| `public:*` | Both of the above, including public routes added in future releases | Global Super Admin only |
| `legacy:v1` | Exactly the routes that existed when scopes were introduced, and nothing added since | Global Super Admin only |

Rules that are easy to miss:

- **Unknown routes are denied first.** A route that is not in the registry is refused before any scope is considered, so neither `public:*` nor `legacy:v1` can open it.
- **`legacy:v1` is frozen.** New routes are never added to it. Move legacy clients to `public:read` / `public:write` when you can.
- **Tenant binding.** A client bound to a makerspace can only call routes for that makerspace. Routes that address no makerspace (such as the public makerspace list) admit a bound client only if the route explicitly allows it.
- **Unresolvable tenants are denied.** If the makerspace in the URL (or behind a public token) cannot be found, the request is refused rather than treated as global.
- The old `admin:read`, `admin:write`, `admin:*` and `reports:read` scopes are retired. They grant nothing and cannot be granted; staff and reporting routes need a signed-in user.

Scopes authorize the *client*. When a public route also needs a person (for example submitting a borrow request requires a signed-in member), send the member's `Authorization: Bearer` token as well.

## Signing a request

Build the message by joining these parts with a single newline (`\n`):

```text
METHOD
FULL_PATH
TIMESTAMP
NONCE
BODY
```

Then send the lowercase hex HMAC-SHA256 of that message, keyed with the client secret, in `X-Signature`.

| Part | Value |
| --- | --- |
| `METHOD` | Upper-case HTTP method, for example `GET`. |
| `FULL_PATH` | The path **including** the query string, exactly as sent: `/api/v1/public/tsel/inventory/?q=drill&page=2`. No scheme or host. |
| `TIMESTAMP` | Unix time in whole seconds, the same value as `X-Timestamp`. Must be within 300 seconds of the server clock (`HMAC_MAX_CLOCK_SKEW_SECONDS`). |
| `NONCE` | The value of `X-Nonce`: 1 to 128 characters from `A-Z a-z 0-9 . _ ~ -`. Use a fresh random value for every request. |
| `BODY` | The exact raw request body bytes, or empty for a bodyless request. |

Note that a `GET` still ends with a newline followed by the empty body.

### Nonce and timestamp rules

- A nonce is accepted once per client. A second request with the same `(client_id, nonce)` pair is rejected, even while `APICLIENT_REQUIRE_NONCE` is off. Different clients may use the same nonce value.
- Nonces are remembered for twice the skew window, which covers every timestamp the server would still accept.
- Rotating the secret does not clear nonces.
- The nonce is claimed only after the signature verifies, so a forged request cannot burn one of your nonces.

:::note[Legacy nonce-less signing]
While `APICLIENT_REQUIRE_NONCE` is off, the server also accepts the older message without the nonce line (`METHOD\nFULL_PATH\nTIMESTAMP\nBODY`). Because that format is ambiguous, a nonce-less request whose body starts with a nonce-like line followed by a newline is rejected. JSON bodies start with `{`, so real clients never hit this, but always send `X-Nonce` in new code.
:::

### Python

```python title="spaceworks_client.py"
import hashlib
import hmac
import json
import secrets
import time

import requests

BASE_URL = "https://spaces.example.org"
CLIENT_ID = "ck_your_client_id"
CLIENT_SECRET = "<client-secret>"  # load from your secrets store


def signed_request(method, full_path, payload=None, bearer=None):
    body = b"" if payload is None else json.dumps(payload, separators=(",", ":")).encode()
    timestamp = str(int(time.time()))
    nonce = secrets.token_urlsafe(16)
    message = b"\n".join(
        [method.upper().encode(), full_path.encode(), timestamp.encode(), nonce.encode(), body]
    )
    signature = hmac.new(CLIENT_SECRET.encode(), message, hashlib.sha256).hexdigest()

    headers = {
        "X-Client-Id": CLIENT_ID,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    # Send exactly the bytes you signed.
    return requests.request(method, BASE_URL + full_path, data=body or None, headers=headers, timeout=10)


response = signed_request("GET", "/api/v1/public/tsel/inventory/?q=drill&page=1")
response.raise_for_status()
for item in response.json()["results"]:
    print(item["name"], item["availability"])
```

### JavaScript (Node.js 18+)

```js title="spaceworksClient.mjs"
import { createHmac, randomBytes } from "node:crypto";

const BASE_URL = "https://spaces.example.org";
const CLIENT_ID = "ck_your_client_id";
const CLIENT_SECRET = process.env.SPACEWORKS_CLIENT_SECRET;

export async function signedRequest(method, fullPath, payload, bearer) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("base64url");
  const message = [method.toUpperCase(), fullPath, timestamp, nonce, body].join("\n");
  const signature = createHmac("sha256", CLIENT_SECRET).update(message, "utf8").digest("hex");

  const headers = {
    "X-Client-Id": CLIENT_ID,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
  };
  if (payload !== undefined) headers["Content-Type"] = "application/json";
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  return fetch(BASE_URL + fullPath, { method, headers, body: body || undefined });
}

const res = await signedRequest("GET", "/api/v1/public/tsel/inventory/?q=drill&page=1");
console.log(res.status, await res.json());
```

### Shell (curl and OpenSSL)

```bash title="signed-get.sh"
CLIENT_ID="ck_your_client_id"
SECRET="<client-secret>"
FULL_PATH="/api/v1/public/tsel/stats/"
TS=$(date +%s)
NONCE=$(openssl rand -hex 16)
BODY=""

SIG=$(printf '%s\n%s\n%s\n%s\n%s' "GET" "$FULL_PATH" "$TS" "$NONCE" "$BODY" \
  | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1)

curl -s "https://spaces.example.org$FULL_PATH" \
  -H "X-Client-Id: $CLIENT_ID" -H "X-Timestamp: $TS" \
  -H "X-Nonce: $NONCE" -H "X-Signature: $SIG"
```

### Check your implementation

With secret `change-me`, method `GET`, path `/api/v1/public/tsel/inventory/?q=drill&page=2`, timestamp `1760000000`, nonce `n-1760000000-abc123` and an empty body, the signature is:

```text
44c7a0c9e04d4a08293a328837ccfb50ddc7fe4c12146e89f7dc5043f5b7af8d
```

### Signing pitfalls

- **Sign the bytes you send.** Serialize JSON once, sign that string, and send the same string. Re-serializing (different key order or spacing) breaks the signature.
- **Sign the query string as sent.** Percent-encode parameters before signing and do not let your HTTP library reorder or re-encode them afterwards.
- **Keep clocks in sync.** Run NTP on the calling server; a drift of more than five minutes fails every request.

## Rotating the secret

```bash
curl -s -X POST https://spaces.example.org/api/v1/admin/api-clients/3/rotate-secret \
  -H "Authorization: Bearer <staff-access-token>"
```

The response contains a new `client_secret`. The previous secret keeps working for **24 hours**, so you can deploy the new one without downtime. Rotating again inside that window replaces the retained previous secret, which immediately invalidates the oldest one.

## Rate limits

A verified signed client is throttled per client by its tier: `public` 30/min, `standard` 120/min, `trusted` 600/min (overridable with `THROTTLE_CLIENT_PUBLIC`, `THROTTLE_CLIENT_STANDARD` and `THROTTLE_CLIENT_TRUSTED`). Browser clients and publishable keys keep the normal per-IP limits. Throttled requests get `429` with `Retry-After`.

## Errors

| Status | Body | Meaning |
| --- | --- | --- |
| `401` | `{"detail": "Invalid client signature."}` | Any credential failure: unknown or inactive client, bad signature, timestamp out of range, nonce reused or malformed, scope not granted, wrong or unresolvable makerspace, origin not allowed. |
| `429` | `{"detail": "Request was throttled. ..."}` | Over the client's rate limit. |

The `401` is deliberately the same for every failure so it tells an attacker nothing. The server log records the specific reason; ask your operator, quoting the `X-Request-ID` from the response.

A quick checklist when you get `401`:

1. Is the client active, and is `X-Client-Id` correct?
2. Is the server clock right (`date -u`)?
3. Did you sign the path **with** its query string, and the exact body bytes?
4. Is this a new nonce?
5. Does the client have `public:read` for `GET` or `public:write` for `POST`, and is it bound to the makerspace in the URL?
6. Are you sending an `Origin` header the client does not list?

## Related

- [API overview](/api/overview/)
- [Authentication](/api/authentication/)
- [Webhooks](/api/webhooks/): the opposite direction, Space Works calling your server.
- [Security settings](/configure/security/)
