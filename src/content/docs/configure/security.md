---
title: Security
description: The secrets SpaceWorks needs and how to protect and rotate them, HTTPS and header settings, rate limits and lockout, control-plane access, account restriction, and a hardening checklist.
sidebar:
  order: 8
---

SpaceWorks holds personal data, payment records and a legal-grade trail of who borrowed what. This
page lists the secrets that protect it, the settings that harden a deployment, and the protections
that are always on. Variable details are in [Environment variables](/configure/environment-variables/).

## Secrets

| Secret | Purpose | If it is lost or changed |
| --- | --- | --- |
| `SECRET_KEY` | Signs sessions and links | Everyone is signed out; password reset, invitation and unsubscribe links stop working. Data is safe. |
| `API_CLIENT_ENC_KEY` | Fernet key encrypting every stored credential: makerspace and platform SMTP passwords, Telegram tokens and chat webhooks, Stripe keys, two-step sign-in secrets, Apple private key, API client secrets | **They become unreadable.** Every credential must be re-entered and everyone using two-step sign-in must re-enrol. |
| `AUDIT_MAC_MASTER_KEY` | Tamper-evident audit rows | Older rows can no longer be verified. |
| `PII_MASTER_KEY`, `PII_SEARCH_HASH_KEY` | Scoped encryption of contact details (only if enabled) | **Encrypted data becomes unreadable** and search indexes cannot be rebuilt. |
| `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD` | Database owner and app role | Reset through PostgreSQL. |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` or `AWS_*` keys | Object storage | Reset at the storage provider. |
| `EVENT_STATION_PIN_PEPPER` | Event and kiosk station PINs | Existing station PINs stop verifying. |
| `PUSH_TOKEN_HMAC_KEY` | Mobile push token fingerprints | Devices must register again. |
| `CRON_SECRET`, `METRICS_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `HMAC_SECRET` | Bearer-style shared secrets | Update the caller with the new value. |
| `BACKUP_ARCHIVE_SIGNING_PRIVATE_KEY` | Signs deployment backups | New backups cannot be signed; restores need the matching public key. |

The installer generates `SECRET_KEY`, `API_CLIENT_ENC_KEY`, `AUDIT_MAC_MASTER_KEY`, both database
passwords and the storage credentials, and writes `.env` with mode `600`.

:::danger[Back up your keys separately]
Keep an offline copy of `.env`, or at least `SECRET_KEY`, `API_CLIENT_ENC_KEY`,
`AUDIT_MAC_MASTER_KEY` and any `PII_*` keys, in a password manager or vault. A database backup
without `API_CLIENT_ENC_KEY` restores encrypted credentials you cannot read. Deployment backup
archives carry these continuity secrets in encrypted form, but do not rely on them as your only copy.
:::

Never reuse one value for two secrets, never commit `.env`, and never paste secrets into tickets or
chat.

## Rotating keys

- **`SECRET_KEY`:** replace it and restart. Expect everyone to sign in again.
- **`API_CLIENT_ENC_KEY`:** there is no built-in re-encryption. Treat it as permanent. If it is
  compromised, generate a new key, then re-enter every SMTP password, chat credential and payment
  key, and have users re-enrol two-step sign-in. A superadmin can be reset with
  `manage.py recover_superadmin <username> --reset-mfa`.
- **`AUDIT_MAC_MASTER_KEY`:** when adding a key to a deployment that already has audit history, run
  `manage.py provision_audit_mac_keys --all`. Check the chain at any time with
  `manage.py verify_audit_log`. Audit signing keys rotate with `manage.py rotate_audit_signing_key`.
- **Scoped PII encryption** is opt-in (`PII_ENCRYPTION_ENABLED=False` by default) and has its own
  fenced rollout, key rotation and rollback procedure, including AWS KMS support. Follow the
  [scoped PII encryption runbook](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/docs/scoped-pii-encryption.md)
  exactly: switching the flag off after rollout is not a rollback.

Run management commands on a Compose install with
`scripts/spaceworks-compose.sh bundled run --rm --no-deps backend --role management python manage.py <command>`.

## HTTPS, cookies and headers

TLS hardening is controlled by `ENABLE_HTTPS`, not by `DEBUG`, so a plain-HTTP trial still works. The
built-in Caddy layer sets it for you; see [Domains and TLS](/install/domains-and-tls/).

| Setting | Effect |
| --- | --- |
| `ENABLE_HTTPS=True` | Redirect HTTP to HTTPS, mark cookies `Secure`, send HSTS for one year with `includeSubDomains` and `preload` |
| `TRUST_X_FORWARDED_PROTO=True` | Trust the proxy's scheme header. Only when your TLS proxy is the **only** way to reach the backend. |
| `SECURE_HSTS_SECONDS` | Start at `0` or a small value while you confirm every subdomain serves HTTPS; preload is hard to undo |
| `CSRF_TRUSTED_ORIGINS` | Your `https://` origin(s); required for sign-in over HTTPS |

Always on, with or without HTTPS: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: same-origin`, and a Content Security Policy.

:::caution[Plain HTTP signs staff out]
The refresh-token cookie is `Secure`, and SpaceWorks refuses session refresh from plain `http://`
origins other than `localhost`. A plain-HTTP install reached by IP or domain therefore cannot keep
staff signed in beyond the 15-minute access token. Use HTTPS for any real deployment.
:::

### Content Security Policy

The default policy allows scripts, styles, images and fonts only from the site itself, plus:

- `'unsafe-inline'` scripts and styles;
- `'wasm-unsafe-eval'`, so the in-browser QR scanner can run its WebAssembly decoder (it does not
  allow JavaScript `eval`);
- `https://cdn.jsdelivr.net`, for the Swagger and ReDoc API documentation pages;
- `blob:` workers.

Pages that show Google or Apple sign-in add those providers' script and frame origins. Responses
under `/control/` additionally allow `'unsafe-eval'` (the admin theme needs it) and your storage
origin for image previews.

## CORS and trusted origins

- `CORS_ALLOWED_ORIGINS` lists the websites allowed to call the API with credentials. Keep it to your
  own sites.
- A makerspace's verified custom domain is trusted automatically. On self-hosted installs only a
  superadmin can set it, because trusted origins are deployment-wide.
- Staff sign-in and token refresh accept only `https://` origins (plus `localhost`), and only the
  exact registered origin, never a prefix match.
- Integration origins that a makerspace adds for API clients can call public endpoints but can never
  refresh a staff session.

## Real client IPs

Rate limits and login lockout key on the client's IP address. Set `TRUSTED_PROXY_COUNT` to the exact
number of proxies in front of the backend (the bundled stack has one, nginx; add one for each CDN or
extra proxy). Too low and every user shares the proxy's IP, so one person's mistakes throttle
everyone; too high and clients can spoof their IP. The backend refuses to start with `DEBUG` off and
no value set.

## Rate limits and lockout

- **Lockout:** five failed password attempts for one IP and user name lock that pair for an hour
  (`AXES_FAILURE_LIMIT`). This covers the staff console, member sign-in and `/control/`. Attempts
  against a user name from other IPs cannot lock the real user out.
- **Throttles:** sign-in, password reset, sign-up, SMS codes, two-step codes, public requests,
  station PINs and more have their own limits, per IP and where it matters per account, email or
  number. Defaults are listed under
  [Rate limits](/configure/environment-variables/#rate-limits).
- **Honeypot:** public request forms carry a hidden field that bots fill in.
- **Shared counters:** limits are counted in Redis (or the database when Redis is absent), never per
  process, so adding web workers does not multiply them.

## Control-plane access

The Django control plane at `/control/` is the superadmin's tool for platform settings, login
methods, sign-in providers and SMS. It is protected in layers:

- only active superadmins can use it; any other signed-in user is refused;
- a superadmin must pass two-step verification at `/mfa/control/` first;
- the bundled website, API edge and Caddy do **not** proxy `/control/`, and the backend port is not
  published by the bundled stack.

Reach it only over a private path you control, for example an SSH tunnel to the backend container's
port 8000. Most day-to-day platform settings (email, Google and Apple sign-in) are also available to
superadmins in the staff console under **Platform settings**, which is the safer route.

Internal routes under `/api/v1/internal/` are blocked at the public edge too.

## Account restriction

Each account has an access status: **active**, **restricted** or **suspended**. Restricted and
suspended accounts are refused by the API and cannot borrow, and staff actions also check it. The
accountability flow can restrict a borrower when hardware comes back lost or damaged. Staff manage it
under **Admin → Users**.

Switching a login method off does not end existing sessions. To cut someone off immediately,
restrict or suspend them. Changing a password or two-step settings invalidates that person's
older sessions and device grants.

## Superadmin and staff two-step verification

Superadmins must use an authenticator app. Require it for staff in a makerspace with the **Require
MFA for staff** feature. See [Authentication](/configure/authentication/#two-step-verification-totp).

## Hardening checklist

- [ ] Serve the site over HTTPS with `ENABLE_HTTPS=True` and correct `CSRF_TRUSTED_ORIGINS`.
- [ ] Set `TRUSTED_PROXY_COUNT` to match your real proxy chain.
- [ ] Set `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` to your own domains only.
- [ ] Store an offline copy of `SECRET_KEY`, `API_CLIENT_ENC_KEY` and `AUDIT_MAC_MASTER_KEY`.
- [ ] Change the generated superadmin password at first sign-in and enrol two-step verification.
- [ ] Turn on **Require MFA for staff** in each makerspace.
- [ ] Keep `/control/` and the storage console (port 9001) off the public internet.
- [ ] Restrict `MINIO_CORS_ALLOWED_ORIGINS` (or your bucket CORS) to your site.
- [ ] Keep the private evidence bucket private; only the public-image bucket is anonymous-read.
- [ ] Leave `DEBUG` off.
- [ ] Turn off login methods you do not use under **Platform login methods**.
- [ ] Back up the database **and** object storage regularly; see
  [Backup and restore](/install/backup-restore/).
- [ ] Consider `API_CLIENT_AUTH_REQUIRED` once your integrations sign their requests; run
  `manage.py api_client_enforcement_report` first. See [API clients](/api/api-clients/).
- [ ] Apply updates promptly; see [Updates](/install/updates/).

## Related

- [Authentication](/configure/authentication/)
- [Monitoring](/configure/monitoring/)
- [Environment variables](/configure/environment-variables/)
