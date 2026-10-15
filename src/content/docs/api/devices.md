---
title: Devices
description: The signed device protocol for 3D printers and label printers, the command lease protocol, kiosk station sessions, and the retired Telegram callback route.
sidebar:
  order: 5
---

**Connected devices** are machines that talk to Space Works on their own: a print agent next to a 3D printer that reports job progress and filament use, or a label printer that prints QR labels for new stock. A device is never a user account. It holds an **Ed25519 key** it generated itself, proves it owns that key once during enrollment, and then signs every request.

This page is for people writing device agents. Staff-side setup is covered in [Printing](/guides/printing/) and [Inventory and QR codes](/guides/inventory-and-qr/). Kiosk tablets work differently (they are browsers with a PIN session) and are covered at the end.

## Requirements

| Feature | Modules that must be enabled | Staff permission |
| --- | --- | --- |
| Enroll, rotate and revoke devices | `devices` (Connected devices) | `manage_devices` |
| 3D printer jobs | `devices`, `machines`, `machine_service` | `manage_devices` and management scope for the machine |
| Label printing | `devices`, `qr_print_batches` | `manage_qr` to send labels |

A device route whose module is switched off answers `400`. A deployment that removed the devices app entirely has no `/api/v1/device/` routes and answers `404`.

## Encodings

| Value | Encoding |
| --- | --- |
| Public key | Standard base64 **with** padding of the raw 32-byte Ed25519 key (44 characters). |
| Signature | Standard base64 **with** padding of the raw 64-byte signature (88 characters). |
| Nonce, challenge | base64url **without** padding. A nonce is 16 to 64 random bytes; a server challenge is 32 bytes. |
| Key fingerprint | Lowercase hex SHA-256 of the raw 32-byte public key. |

Only canonical encodings are accepted: no stray padding, no extra bits. Every signed message is a sequence of **length-framed fields**: each field is a 4-byte big-endian length followed by the field's bytes (UTF-8 for text). Framing makes field boundaries unambiguous.

## 1. Register the device (staff)

A staff member creates the device and gets a one-time enrollment token:

```bash
curl -s https://spaces.example.org/api/v1/admin/makerspace/7/devices \
  -H "Authorization: Bearer <staff-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"kind": "printer", "name": "Prusa MK4 #2", "offline_threshold_seconds": 300}'
```

`kind` is `printer` or `label_printer`. The response contains the `device` and an `enrollment`:

```json
{
  "device": { "id": "6f1c...", "kind": "printer", "name": "Prusa MK4 #2", "status": "pending", "key_version": 0 },
  "enrollment": {
    "enrollment_id": "0b7e...",
    "device_id": "6f1c...",
    "purpose": "enroll",
    "token": "<one-time-token>",
    "expires_at": "2026-10-15T10:15:00Z"
  }
}
```

Hand `enrollment_id` and `token` to the agent (for example as a pairing code). The token is shown once, stored only as a hash, and expires after 15 minutes (`DEVICE_ENROLLMENT_TTL_SECONDS`). Issuing a new enrollment for the same device cancels any unused one.

Other staff routes: `GET /api/v1/admin/makerspace/{id}/devices` lists devices, `GET`/`PATCH /api/v1/admin/devices/{id}` reads or renames a device and changes its `offline_threshold_seconds`, `POST /api/v1/admin/devices/{id}/enrollments` issues a new enrollment, and `POST /api/v1/admin/devices/{id}/revoke` blocks it.

## 2. Enroll (proof of possession)

The agent generates a key pair, asks for a challenge, signs it, and completes enrollment. Neither call needs any other credential.

1. `POST /api/v1/device/enrollments/{enrollment_id}/challenge` with `{"token": "...", "public_key": "<base64>"}`. The response is `{"challenge": "<base64url>", "expires_at": "..."}`.
2. Sign the **enrollment message**, whose fields are, in order:
   1. `spaceworks-device-enrollment`
   2. `v1`
   3. the enrollment UUID
   4. the makerspace ID, in decimal
   5. the device UUID
   6. the purpose (`enroll`, `rotate` or `reactivate`)
   7. the key fingerprint (hex SHA-256 of the raw public key)
   8. the **raw** challenge bytes (decode the base64url first)
3. `POST /api/v1/device/enrollments/{enrollment_id}/complete` with `{"token", "public_key", "challenge", "signature"}`. The response is the device identity: `{device_id, makerspace_id, status, key_version, last_seen_at}`.

The makerspace ID is not in the enrollment grant: get it from the staff member along with the token, or read it from the device record. Completion activates the device, increments `key_version` and consumes the enrollment in one step.

```js title="enroll.mjs (Node.js 18+)"
import { createHash, generateKeyPairSync, sign } from "node:crypto";

const BASE = "https://spaces.example.org";
const { enrollmentId, token, makerspaceId, deviceId } = JSON.parse(process.env.PAIRING);

function frame(...fields) {
  return Buffer.concat(fields.flatMap((field) => {
    const value = Buffer.isBuffer(field) ? field : Buffer.from(String(field), "utf8");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(value.length);
    return [length, value];
  }));
}
const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const spki = publicKey.export({ format: "der", type: "spki" });
const rawPublicKey = spki.subarray(spki.length - 32);           // last 32 bytes = raw key
const publicKeyB64 = rawPublicKey.toString("base64");

const post = (path, body) => fetch(BASE + path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
}).then((r) => r.json());

const { challenge } = await post(`/api/v1/device/enrollments/${enrollmentId}/challenge`,
  { token, public_key: publicKeyB64 });

const message = frame("spaceworks-device-enrollment", "v1", enrollmentId, makerspaceId,
  deviceId, "enroll", sha256Hex(rawPublicKey), Buffer.from(challenge, "base64url"));
const signature = sign(null, message, privateKey).toString("base64");

console.log(await post(`/api/v1/device/enrollments/${enrollmentId}/complete`,
  { token, public_key: publicKeyB64, challenge, signature }));
// Store privateKey securely on the device; it never leaves it.
```

| Status | Meaning |
| --- | --- |
| `400` | Malformed input, or the module is disabled. |
| `403` | Wrong token, unknown enrollment or failed proof. These are deliberately indistinguishable. |
| `409` | The key is already bound to another device, or a rotation reused the current key. |
| `410` | The enrollment was already used, revoked or has expired. |
| `423` | The makerspace is frozen for migration. |

## 3. Sign every request

After enrollment, each request to `/api/v1/device/` carries six headers:

| Header | Value |
| --- | --- |
| `X-Device-Id` | The device UUID, lowercase canonical form. |
| `X-Device-Key-Version` | The current `key_version` (a positive integer). |
| `X-Device-Signature-Version` | `v1` |
| `X-Device-Timestamp` | Unix time in seconds. Must be within 300 seconds of the server (`DEVICE_SIGNATURE_MAX_SKEW_SECONDS`). |
| `X-Device-Nonce` | Fresh random nonce, base64url without padding, 16 to 64 bytes. Never reuse one. |
| `X-Device-Signature` | Base64 Ed25519 signature of the request message. |

The **request message** fields are, in order:

1. `spaceworks-device-request`
2. `v1`
3. the upper-case HTTP method
4. the **exact raw request target**, path plus query string, exactly as it appears on the HTTP request line (never reordered or re-encoded)
5. the timestamp, in decimal
6. the nonce
7. the lowercase hex SHA-256 of the exact body bytes (the hash of an empty string for no body)

Each nonce is accepted once per device key and remembered for 24 hours (`DEVICE_NONCE_TTL_SECONDS`). Retrying a request means signing it again with a new nonce and timestamp.

```python title="device_client.py"
import base64
import hashlib
import json
import secrets
import time

import requests
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

BASE_URL = "https://spaces.example.org"


def frame(*fields):
    out = bytearray()
    for field in fields:
        value = field.encode("utf-8") if isinstance(field, str) else bytes(field)
        out += len(value).to_bytes(4, "big") + value
    return bytes(out)


class DeviceClient:
    def __init__(self, device_id: str, key_version: int, private_key: Ed25519PrivateKey):
        self.device_id = device_id
        self.key_version = key_version
        self.key = private_key

    def request(self, method: str, target: str, payload=None):
        """`target` is the path plus query string, already percent-encoded."""
        body = b"" if payload is None else json.dumps(payload, separators=(",", ":")).encode()
        timestamp = str(int(time.time()))
        nonce = secrets.token_urlsafe(16)  # 16 random bytes, unpadded base64url
        message = frame(
            "spaceworks-device-request", "v1", method.upper(), target,
            timestamp, nonce, hashlib.sha256(body).hexdigest(),
        )
        headers = {
            "X-Device-Id": self.device_id,
            "X-Device-Key-Version": str(self.key_version),
            "X-Device-Signature-Version": "v1",
            "X-Device-Timestamp": timestamp,
            "X-Device-Nonce": nonce,
            "X-Device-Signature": base64.b64encode(self.key.sign(message)).decode(),
        }
        if payload is not None:
            headers["Content-Type"] = "application/json"
        return requests.request(method, BASE_URL + target, data=body or None, headers=headers, timeout=15)


# client = DeviceClient(device_id, key_version, private_key)
# print(client.request("POST", "/api/v1/device/heartbeat").json())
```

Every authentication failure is `401` with `WWW-Authenticate: SpaceWorks-Device-v1`. A revoked or rotated key, a stale `key_version`, a timestamp outside the skew, a replayed nonce and a tampered body all fail the same way. `403` means the device is not allowed on that route or its makerspace is unavailable, and `423` means the makerspace is frozen for migration.

:::note[Behind a proxy]
The server verifies the raw request target it actually received (the `RAW_URI` / `REQUEST_URI` value, or ASGI `raw_path`). If a proxy in front of Space Works rewrites paths or query strings, signatures will not match. A server that exposes no raw target refuses all device requests.
:::

## Heartbeat and offline alerts

`POST /api/v1/device/heartbeat` with an empty body records that the device is alive and returns `{device_id, makerspace_id, status, key_version, last_seen_at}`. Any signed request also counts as activity. If a device stays silent longer than its `offline_threshold_seconds` (default 300), Space Works raises a `devices.offline` notification, and `devices.recovered` when it comes back. Route those to email, chat or a [webhook](/api/webhooks/) in the notification matrix.

## Command delivery (lease and acknowledge)

Printers and label printers receive work through the same pull protocol.

1. **Lease.** `POST /api/v1/device/commands/lease` with `{}`. The response is `{"command": null}` when there is nothing to do, or:

   ```json
   {
     "command": {
       "command_id": "c4a1...",
       "kind": "printer_job",
       "lease_token": "<returned-once>",
       "lease_expires_at": "2026-10-15T10:01:00Z",
       "printer_job_id": "9d2e...",
       "external_job_id": "agent-job-123",
       "service_request_id": 456
     }
   }
   ```

   Label commands have `kind: "label_print"` with `label_command_id`, `qr_batch_id` and `item_count` instead of the printer fields.

2. **Acknowledge.** `POST /api/v1/device/commands/{command_id}/ack` with `{"lease_token": "<token>"}` claims ownership. Repeating an identical acknowledgement succeeds. A wrong or replaced token gets `409`; a lease that expired before acknowledgement gets `410` and the command is re-queued with backoff.

A lease lasts 60 seconds (`DEVICE_COMMAND_LEASE_SECONDS`) and a command is offered at most 10 times (`DEVICE_COMMAND_MAX_ATTEMPTS`). Once acknowledged, the command belongs to the device for as long as the job takes; later telemetry and results only need the device's signature. Delivery is at least once, so keep a durable local record mapping each server job ID to the physical job and ignore commands you already have.

## 3D printer jobs

Staff bind an enrolled printer to a machine (`POST /api/v1/admin/makerspace/{id}/device-printer-bindings` with `device_id`, `machine_id`, `enabled`, `auto_apply_terminal`) and then create a job for an in-progress print request (`POST /api/v1/admin/makerspace/{id}/printer-jobs` with `binding_id`, `service_request_id`, `external_job_id`). The device then receives a `printer_job` command.

**Telemetry** (advisory only; it never changes machine status or charges):

```json
POST /api/v1/device/printer-jobs/{printer_job_id}/telemetry
{"external_job_id": "agent-job-123", "telemetry_state": "running", "progress_percent": 25}
```

`telemetry_state` is `idle`, `running` or `paused`.

**Result** when the print finishes:

```json
POST /api/v1/device/printer-jobs/{printer_job_id}/result
{
  "operation_id": "5f0c3c6e-1d2b-4c1e-9a55-0b7f3f1c2d10",
  "external_job_id": "agent-job-123",
  "outcome": "completed",
  "actual_minutes": 42,
  "consumptions": [{"machine_consumable_id": 789, "quantity": "2.50"}],
  "actual_grams": "12.00"
}
```

- `consumptions` is required, even as an empty list. Each entry names a consumable of the bound machine; count-based consumables need whole numbers.
- Send `actual_grams` only when the request reserved a weight-based material pool, `actual_quantity` for other reserved pools, and neither when nothing was reserved. Never both.
- For a failed print use `"outcome": "failed"` and add `failure_reason` (up to 1000 characters) and `percent_complete` (0 to 100).
- Prices, amounts and payment fields are refused. Charges are calculated by Space Works from the makerspace's own pricing.
- Keep `operation_id` the same across retries of one report. The same operation and payload returns the stored result; a changed payload under the same `operation_id` gets `409`.

By default a report waits for staff review (`POST /api/v1/admin/printer-jobs/{id}/apply`). A binding with `auto_apply_terminal: true` applies it automatically.

## Label printing

Staff send a QR print batch to a label printer with `POST /api/v1/admin/qr-print-batches/{batch_id}/label-commands` and `{"device_id": "...", "request_id": "<uuid>"}`. Repeating the same `request_id` returns the original command; reusing it for something different gets `409`.

After leasing and acknowledging a `label_print` command, the device:

1. Downloads the labels: `GET /api/v1/device/label-commands/{label_command_id}/content` returns a ZIP of SVG labels (`Cache-Control: no-store`). Only the device that owns the acknowledged command can download it.
2. Reports the result: `POST /api/v1/device/label-commands/{label_command_id}/result` with `operation_id` (UUID), `outcome` and `result_code`.

| `outcome` | Allowed `result_code` |
| --- | --- |
| `succeeded` | `ok` |
| `retryable_failed` | `out_of_labels`, `paper_empty`, `offline`, `printer_error`, `unknown_error` |
| `failed` | `out_of_labels`, `paper_empty`, `offline`, `printer_error`, `unknown_error` |

Free-text printer messages are not accepted. A retryable failure is re-offered with backoff; a permanent failure, or running out of attempts, ends the command. Replaying the same `operation_id` returns the original receipt.

## Rotation, revocation and restore

- **Rotate.** Staff issue a new enrollment for an active device (purpose `rotate`). The agent completes it with a **new** key. The old key stops working the moment `key_version` advances.
- **Revoke.** `POST /api/v1/admin/devices/{id}/revoke` blocks the device immediately and invalidates any command it owns. Only a new `reactivate` enrollment with fresh proof brings it back.
- **Move or restore.** When a makerspace is migrated to another deployment or restored from a full backup, no device key, enrollment or nonce carries over. Devices come back as pending and must enroll again; `key_version` keeps increasing so an old signature can never match.

`X-Device-Signature-Version` must be `v1`. A future `v2` will use a different domain string, so a `v1` signature can never be accepted as `v2`.

## Test vectors

Use these to check your framing and signing. The private key is the 32-byte seed `00 01 02 ... 1f`.

- Public key: `A6EHv/POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg=`
- Fingerprint: `56475aa75463474c0285df5dbf2bcab73da651358839e9b77481b2eab107708c`

| Message | Inputs | SHA-256 of the framed message | Signature |
| --- | --- | --- | --- |
| Request | `POST`, `/api/v1/device/heartbeat?b=2&a=1`, timestamp `1760000000`, nonce `AAECAwQFBgcICQoLDA0ODw`, body `{"status":"ok"}` | `e891fd5275c6f9ac8532c09b48c593e38a1ce1121d6f945643ec48c536b428fe` | `B70XDhmKjehFpaz9rxF6LooqOUD1IT2oXVCwQ2x63GWj2r5dscuK85hejYBVlr+kZXb7fPC1Kwffshkjq/26Bg==` |
| Enrollment | enrollment `00000000-0000-4000-8000-000000000001`, makerspace `7`, device `00000000-0000-4000-8000-000000000002`, purpose `enroll`, challenge bytes `0x20` to `0x3f` (`ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8`) | `cdd60412027c85f820114e9fdd22bde4d86e56ea768298fbc664756228ff7244` | `vhJhxnQUqxdl/J2Nr+36t26m0r3iZ1ieUv7cuRqnoALo432jjM0lgjTu9S0m3d5DD95kV3w7ylqmh35d4n3YAg==` |

In Python, load the test key with `Ed25519PrivateKey.from_private_bytes(bytes(range(32)))`.

## Kiosk stations

A kiosk is a browser on a shared tablet at the front desk, not a signed device. It authenticates with a **Station PIN** and a cookie:

1. Staff create a station (`/api/v1/admin/makerspace/{id}/kiosk-stations/`) and get its public token and 8-digit PIN.
2. The kiosk page calls `POST /api/v1/kiosk-stations/{public_token}/session/` with `{"pin": "12345678"}`. On success the server sets an `HttpOnly` cookie named `sw_kiosk_station`, scoped to that station's path, and returns the station, makerspace, session expiry and `permitted_operations`.
3. When a staff member signs in at the kiosk, the page requests an **operator lease** (`POST .../operator-lease/` with the staff member's Bearer token) and sends it as `X-Kiosk-Operator-Lease` on the work routes, so every action is attributed to a real person.

Every cookie-bearing kiosk route requires an `X-Station-CSRF` header and an `Origin` that is one of the makerspace's public origins (or a configured frontend origin). All failures return the same generic `403`. `DELETE .../session/` ends the session and revokes its operator leases. Event check-in stations at `/api/v1/event-checkin-stations/` follow the same pattern with their own cookie. See [Kiosk mode](/guides/kiosk/) for setup.

## The Telegram webhook route

Telegram in Space Works is **outbound only**: it posts alerts into a group chat, and decisions such as accepting or rejecting a request are made in the staff console. `POST /api/v1/integrations/telegram/webhook` still exists so that a deployment which once registered it with Telegram does not leave Telegram retrying a dead URL. It checks the `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` (refusing with `403` when the secret is unset or wrong), then acknowledges every update with `{"detail": "Ignored."}` and takes no action. Do not build on it.

## Related

- [Printing](/guides/printing/)
- [Inventory and QR codes](/guides/inventory-and-qr/)
- [Kiosk mode](/guides/kiosk/)
- [Webhooks](/api/webhooks/)
- [API overview](/api/overview/)
