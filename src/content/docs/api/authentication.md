---
title: Authentication
description: How browsers, scripts and native apps sign in to the Space Works API, how permissions are checked, and what 401 and 403 responses look like.
sidebar:
  order: 2
---

Space Works has one user model for staff and members. People sign in with a password, a phone code, Google, Apple or your own OpenID Connect provider, and the API hands back a short-lived **JWT access token** that you send as a Bearer token. This page explains those flows from an API caller's point of view.

There are three other credential types, each covered on its own page:

| Caller | Credential | Page |
| --- | --- | --- |
| A person in a browser, a script acting as a person | JWT access token + refresh cookie | This page |
| A person in the official mobile app | JWT access + refresh pair tied to an attested device grant | [Native app device grants](#native-app-device-grants) below |
| Your server calling the public API | Signed API client (`X-Client-Id` + HMAC) | [API clients](/api/api-clients/) |
| A printer or label printer | Ed25519-signed device requests | [Devices](/api/devices/) |

## Access tokens

Send the access token on every request:

```http
GET /api/v1/auth/me HTTP/1.1
Host: spaces.example.org
Authorization: Bearer <access-token>
```

| Token | Lifetime | Where it lives |
| --- | --- | --- |
| Access token (JWT) | 15 minutes | Returned in the response body. Keep it in memory. |
| Refresh token | 7 days, rotated on every use | An `HttpOnly` cookie named `refresh_token`, scoped to `/api/v1/auth/` |

Unless a route says otherwise, every endpoint requires an authenticated user. Public routes (catalogue, public events, health) explicitly allow anonymous callers.

## Password sign-in

```bash
curl -s https://spaces.example.org/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "maker@example.org", "password": "<password>"}'
```

`username` accepts either the username or a unique email address. Optionally send `"surface": "member"` or `"surface": "staff"` (see [Sessions: member and staff](#sessions-member-and-staff)).

A successful response:

```json
{
  "access": "<access-token>",
  "surface": "staff_api",
  "user": {
    "id": 12,
    "username": "maker",
    "email": "maker@example.org",
    "display_name": "Maker",
    "email_verified": true,
    "role": "requester",
    "is_superuser": false,
    "must_change_password": false,
    "makerspaces": [
      {
        "id": 7,
        "slug": "tsel",
        "role": "space_manager",
        "role_name": "Space Manager",
        "source": "membership",
        "actions": ["view_inventory", "edit_inventory", "accept_request", "..."]
      }
    ]
  }
}
```

(The `user` object has a few more fields; see `LoginResponse` in `/docs/`.) The response also sets the refresh cookie.

If the account has two-factor authentication, the response is a challenge instead of a token:

```json
{ "mfa_required": true, "enrollment_required": false, "challenge": "<challenge>", "expires_in": 300 }
```

Finish sign-in by posting the challenge and the user's code to `POST /api/v1/auth/mfa/verify`:

```json
{ "challenge": "<challenge>", "code": "123456" }
```

If `enrollment_required` is `true`, the deployment requires two-factor authentication for this account and the user has not set it up yet; they must enroll an authenticator through the MFA routes under `/api/v1/auth/mfa/` (see the **MFA** tag in `/docs/`) before a session is issued. The challenge expires after `expires_in` seconds (5 minutes by default).

:::note
An operator can turn password sign-in off for the whole deployment. Then `/api/v1/auth/login` answers `403` with `"Password sign-in is not available on this deployment."` See [Authentication settings](/configure/authentication/).
:::

## Refreshing and signing out

Browsers refresh with the cookie. The refresh and logout routes are protected against cross-site requests in two ways: the request must carry an `X-Refresh-CSRF` header (any value; its presence forces a CORS preflight), and its `Origin` must be one of the deployment's allowed frontend origins.

```js
const res = await fetch("https://spaces.example.org/api/v1/auth/refresh", {
  method: "POST",
  credentials: "include",            // send the refresh_token cookie
  headers: { "X-Refresh-CSRF": "1" },
});
const { access } = await res.json();  // a new 15-minute access token
```

Each refresh rotates the refresh cookie; the old refresh token is blacklisted and cannot be reused. `POST /api/v1/auth/logout` (same headers) ends the session and clears the cookie.

:::tip[Scripts and cron jobs]
The refresh flow is built for browsers. A server-side script that signs in with a password gets no usable `Origin`, so it should simply sign in again when its access token expires. For machine-to-machine access to the public API, use an [API client](/api/api-clients/) instead of a person's password.
:::

## Sessions: member and staff

Each token carries a **surface** that limits where it can be used:

| Surface | Issued to | Can call |
| --- | --- | --- |
| `member` | Anyone signing in as a member | `/api/v1/auth/`, `/api/v1/member/`, `/api/v1/memberships/`, `/api/v1/public/` and push-device registration. Staff routes answer `403 "Member sessions cannot access staff APIs."` |
| `staff` | Staff signing in from a registered staff console origin | Staff routes, bound to the origin the session was created on |
| `staff_api` | Staff signing in without a browser origin (scripts, tools) | Staff routes; permissions are still checked on every request |
| `verification_only` | Self-registered accounts that have not confirmed their email | Only `/api/v1/auth/me` and the email-verification routes |

You never pick a higher surface than you are entitled to. If you omit `surface`, the server decides: staff get `staff` or `staff_api`, everyone else gets `member`. A staff user can ask for `"surface": "member"` to get a member-only session. Asking for `"surface": "staff"` without staff authority is refused with `403`.

## Permissions

A valid token only proves who you are. Each request is then authorized by the Auth and RBAC module, which answers one question: can this actor perform this **action** in this **makerspace**?

- **Super Admins** may do everything, except in makerspaces a deployment hides from global access.
- **Everyone else** gets authority per makerspace, from the role on their membership. Roles are editable sets of actions such as `view_inventory`, `edit_inventory`, `accept_request`, `issue_request`, `return_request`, `upload_evidence`, `manage_qr`, `manage_machines`, `manage_events`, `manage_bookings`, `manage_members`, `view_finance`, `record_payment`, `manage_devices` and `view_audit`.
- Some actions imply others. For example `manage_machines` implies `manage_printing` and `collect_service_request`.
- Restricted or suspended accounts are refused even with a valid token.

Lists are filtered the same way, so a staff member never sees another makerspace's records. To find out what the signed-in user can do, read `user.makerspaces[].actions` from the login or `GET /api/v1/auth/me` response. The web console uses this list to decide which screens to show; the server enforces it regardless.

See [Roles and permissions](/guides/roles-and-permissions/) for the built-in roles and how to create custom ones.

## Social and OpenID Connect sign-in

Social providers are switched on by the operator (see [Authentication settings](/configure/authentication/)). `GET /api/v1/auth/social/providers` lists the identities linked to the signed-in user, and `POST` links a new one.

### Google and Apple (ID token flow)

Use this when your app already gets an ID token from the provider's own SDK.

1. Ask Space Works for a single-use nonce:

   ```json
   POST /api/v1/auth/social/nonce
   { "provider": "google", "surface": "member", "delivery": "web", "client_platform": "web" }
   ```

   The response is `{"nonce": "<nonce>", "expires_in": 300}`.

2. Pass that nonce to the provider's sign-in SDK and get back an `id_token`.
3. Exchange it:

   ```json
   POST /api/v1/auth/social/google
   { "id_token": "<id-token>", "nonce": "<nonce>", "surface": "member", "delivery": "web", "client_platform": "web" }
   ```

   Use `/api/v1/auth/social/apple` for Apple. The response contains `access`, `user` and `outcome`, and (for `delivery: "web"`) sets the refresh cookie.

`client_platform` is `web`, `ios` or `android`. `delivery: "device"` is for the attested mobile app (see below).

### OpenID Connect (browser redirect flow)

For a provider configured with slug `<slug>`:

1. `POST /api/v1/auth/social/oidc/<slug>/authorize` with `{"redirect_uri": "https://spaces.example.org/auth/callback"}`. The response is `{authorization_url, state, nonce, expires_in}`.
2. Send the browser to `authorization_url`. Keep `state` and `nonce` for step 3.
3. When the provider redirects back with `code` and `state`, post `{"code": "...", "state": "...", "nonce": "..."}` to `POST /api/v1/auth/social/oidc/callback`. The response contains `access`, `user` and `outcome`, and sets the refresh cookie.

If the account needs two-factor authentication, either exchange returns the same MFA challenge as password sign-in.

## Native app device grants

The official mobile apps do not use cookies. Instead each install proves it is a genuine, approved app build (Apple App Attest or Google Play Integrity) and receives a **device grant**: a revocable record tying a refresh-token family to that install.

1. `POST /api/v1/auth/device/attestation-challenge` with `{"platform": "apple" | "android", "app_id": "<bundle-or-package-id>", "environment": "development" | "production"}`. You get `{challenge, expires_in}`.
2. Produce a platform attestation bound to that challenge.
3. `POST /api/v1/auth/device/login` with the same three fields plus `username`, `password`, `challenge` and `attestation` (a JSON object). The response is `{access, refresh, user, device_grant}`, or an MFA challenge.
4. Rotate tokens with `POST /api/v1/auth/device/refresh` and `{"refresh": "<refresh-token>"}`. You get a new `access` and `refresh`.
5. `POST /api/v1/auth/device/logout` revokes the current grant.

Users can list their signed-in devices with `GET /api/v1/auth/device/grants` and revoke one with `DELETE /api/v1/auth/device/grants/{grant_id}`. A revoked grant stops working on the next request, not when its access token expires.

Rules to know:

- Device auth routes refuse any request that carries `Cookie`, `Origin` or `Referer` headers (`403`), so they cannot be driven from a web page.
- The routes stay dormant until the operator configures the app allowlist and attestation verifiers (`DEVICE_ATTESTATION_APPS` and the `DEVICE_*_ATTESTATION_VERIFY_*` settings), approves the app registration, and enables the **Mobile apps** module. Until then they answer `503` or `401`.
- A native session may send `X-Makerspace-Id` to choose which of the user's makerspaces it is acting in. Browser sessions must not send it.

Do not confuse device grants with [connected devices](/api/devices/): a device grant is a person signed in on a phone, while a connected device is a printer with its own key and no user account.

## What 401 and 403 look like

**401 Unauthorized** means the server could not establish who you are. The response includes `WWW-Authenticate: Bearer realm="api"`.

```json
{ "detail": "Authentication credentials were not provided." }
```

```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid",
  "messages": [{ "token_class": "AccessToken", "token_type": "access", "message": "Token is expired" }]
}
```

On `token_not_valid`, refresh the access token and retry once. If refreshing fails too, sign in again.

**403 Forbidden** means you are signed in but not allowed:

```json
{ "detail": "You do not have permission to perform this action." }
```

Other `403` messages you may see include `"Member sessions cannot access staff APIs."`, `"Staff access is required."` and `"Verify the account email before accessing member APIs."`. Do not retry a `403` with the same token; it will not change until the user's role or account state changes.

## Related

- [API overview](/api/overview/)
- [API clients](/api/api-clients/)
- [Authentication settings](/configure/authentication/)
- [Roles and permissions](/guides/roles-and-permissions/)
- [Security](/configure/security/)
