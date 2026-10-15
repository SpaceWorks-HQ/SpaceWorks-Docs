---
title: Environment variables
description: Every environment variable SpaceWorks reads, grouped by area, with defaults, which ones are secrets, and which ones the bundled Docker stack passes through.
sidebar:
  order: 1
---

SpaceWorks is configured in two places. **Deployment-wide settings** (secrets, domains, storage,
security limits) are environment variables, covered on this page. **Per-makerspace and platform
settings** that staff change at runtime (SMTP for one space, Telegram rooms, Stripe keys, sign-in
providers, login methods) live encrypted in the database and are edited in the staff console or the
`/control/` control plane. Where a setting exists in both places, the database value wins and the
environment variable is the fallback.

The defaults on this page are the values in
[`backend/config/settings.py`](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/backend/config/settings.py).
Most of them are correct for production, so a typical install only sets the handful marked
**required** plus the ones for features it uses.

## Where the values live

| How you installed | File | Notes |
| --- | --- | --- |
| One-line install / [Docker Compose](/install/docker-compose/) | `.env` in the install directory | Written by setup with mode `600`. |
| [Cloud profile](/install/cloud/) | `/etc/spaceworks/cloud.env` | Same names; the cloud Compose file has its own defaults. |
| Anything else (Render, a PaaS, bare metal) | The process environment | Django also reads `backend/.env` when you run it from source. |

After editing `.env` on a Compose install, re-record the configuration checksum and apply it, as
described in [The `.env` file](/install/docker-compose/). The wrapper refuses to start if you skip
the checksum step.

### Which variables reach the backend in the bundled stack

:::caution[Editing `.env` is not always enough]
The bundled production stack (`docker-compose.prod.yml`, used by the one-line installer, the
single box and the TLS/platform layers) does **not** pass your whole `.env` to the backend. Each
backend container (`backend`, `live`, `worker`, `beat`, `migrate`, and `app` on the single box)
receives only the variables listed in that file's `environment:` block. Anything else you put in
`.env` is ignored by the backend, and the setting keeps its default.

The **Bundled** column in the tables below says whether a variable is forwarded (`yes`) or not
(`no`). To change a `no` variable you must add it to the backend environment block of
`docker-compose.prod.yml` yourself. The Compose wrapper refuses extra `-f` override files, and
updates install a fresh copy of `docker-compose.prod.yml`, so re-apply your edit after every update.
The cloud profile forwards a similar, slightly smaller list.
:::

Notable variables that the bundled stack does **not** forward include `SPACEWORKS_EDITION`,
`TOMBSTONED_APPS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, every `THROTTLE_*`, every
`PII_*`, `LOG_LEVEL`, `LOG_JSON`, `LIVE_REDIS_URL`, `AUTH_COOKIE_*`, `DEVICE_*`,
`PUBLIC_IMAGE_MAX_BYTES` and `PUBLIC_IMAGE_URL_TTL_SECONDS`, even though some of them appear in
`.env.example` or are written to `.env` by setup.

### Generating secrets

```bash title="Generate values (run anywhere with Python 3 and the cryptography package)"
# A Fernet key, for API_CLIENT_ENC_KEY, AUDIT_MAC_MASTER_KEY and PII_MASTER_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# A long random string, for SECRET_KEY, CRON_SECRET, METRICS_TOKEN, peppers and HMAC keys
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

The installer already generates `SECRET_KEY`, `API_CLIENT_ENC_KEY`, `AUDIT_MAC_MASTER_KEY`, the
database passwords and the storage credentials. See [Security](/configure/security/) for which keys
you must back up and why.

## Core Django and hosting

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `SECRET_KEY` | none | yes | **Required. Secret.** Django's signing key. Changing it signs everyone out and invalidates signed links (password resets, invitations, unsubscribe links). |
| `DEBUG` | `False` | fixed `False` | Developer mode. Never enable it off your own machine. It also switches logs to plain text and relaxes the proxy check below. |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | yes | **Required in the bundled stack.** Comma-separated host names the backend answers. Add every domain and custom domain, or requests fail with `DisallowedHost`. |
| `PUBLIC_APP_BASE_URL` | empty | yes | The public website origin, for example `https://makerspace.example.org`. Used to build links in email (password reset, invitations, receipts). Leave it empty and emailed links are bare paths that cannot be clicked. |
| `ADMIN_SITE_NAME` | `Space Works` | no | Title shown in the `/control/` control plane. |

## Database

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `DATABASE_URL` | none | from pointer | **Required.** PostgreSQL URL, for example `postgres://user:pass@host:5432/db`. On Compose installs it comes from the root-owned pointer file in `/var/lib/spaceworks/ops`; never put it in `.env`. |
| `CONN_MAX_AGE` | `60` | yes | Seconds a database connection is reused. Set `0` behind a transaction-mode pooler (Supabase port 6543, PgBouncer). |
| `CONN_HEALTH_CHECKS` | `True` | no | Check a reused connection before each request so a restarted database does not surface as an error. |
| `DISABLE_SERVER_SIDE_CURSORS` | `False` | yes | Set `True` behind a transaction-mode pooler, which cannot keep server-side cursors. |
| `MANAGED_POSTGRES` | `False` | yes | Set `True` on hosted PostgreSQL that forbids `session_replication_role` (Supabase, RDS). Changes how makerspace purges suspend immutability triggers. |
| `POSTGRES_USER` | `makerspace` | Compose only | Owner account of the bundled database. |
| `POSTGRES_PASSWORD` | none | Compose only | **Required. Secret.** Owner password; used for migrations and maintenance, never by the running app. |
| `POSTGRES_DB` | `makerspace_manager` | Compose only | Database name. |
| `POSTGRES_APP_USER` | `spaceworks_app` | Compose only | Separate least-privilege role the app processes run as. |
| `POSTGRES_APP_PASSWORD` | none | Compose only | **Required. Secret.** Password for that role. |

## Redis, Celery and live updates

Redis is the Celery broker, the shared cache (rate-limit counters, nonces) and the live-update
stream. The bundled stack runs one for you.

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `CELERY_BROKER_URL` | empty | yes (`redis://redis:6379/0`) | Redis URL for background jobs. Empty means jobs run inline in the web request instead of on a worker. |
| `CELERY_TASK_ALWAYS_EAGER` | `True` when no broker is set | no | Force inline execution. You rarely need to set this directly. |
| `CELERY_RESULT_BACKEND` | empty | no | Where Celery stores task results. SpaceWorks does not need one. |
| `CACHE_URL` | the broker URL | no | Redis URL for the cache. With neither this nor a broker, a database-backed cache is used so rate limits stay shared across workers. |
| `LIVE_REDIS_URL` | the broker URL | no | Redis used by the live-update stream at `/api/v1/live/`. When none is available the stream answers 503 and the staff console falls back to polling. |
| `LIVE_MAX_STREAM_SECONDS` | `3600` | no | Longest a single live stream stays open before the browser reconnects. |
| `REMINDER_SWEEP_BATCH_SIZE` | `200` | no | Batch size for the reminder sweep and delivery-log cleanup. Must be positive. |
| `CRON_SECRET` | empty | yes | **Secret.** Enables `POST /api/v1/internal/cron/return-reminders` with an `X-Cron-Secret` header, for hosts that cannot run a scheduler. The route answers 404 while unset. The bundled edge blocks `/api/v1/internal/` from the internet. |

## Domains, proxies, HTTPS and cookies

See [Domains and TLS](/install/domains-and-tls/) for the full setup and
[Security](/configure/security/) for what each switch protects.

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5000,http://localhost:5173` | yes | Browser origins allowed to call the API, comma-separated, with scheme. Set to your website origin(s). |
| `CSRF_TRUSTED_ORIGINS` | empty | yes | `https://` origins trusted for form posts and sign-in. Required when HTTPS is on. |
| `TRUSTED_PROXY_COUNT` | none | yes (`1`) | **Required when `DEBUG` is off.** How many reverse proxies sit in front of the backend. Rate limits and login lockout use it to find the real client IP. `0` for direct access. |
| `ENABLE_HTTPS` | `False` | yes | Turns on HTTPS redirect, `Secure` cookies and HSTS. Set it only when real TLS terminates in front of the backend. |
| `TRUST_X_FORWARDED_PROTO` | `False` | yes | Trust the proxy's `X-Forwarded-Proto` header. Only when a TLS proxy is the sole path to the backend. |
| `SECURE_SSL_REDIRECT` | same as `ENABLE_HTTPS` | no | Redirect plain HTTP to HTTPS. Health, metrics and internal routes are exempt. |
| `SECURE_HSTS_SECONDS` | `31536000` with HTTPS, else `0` | no | HSTS lifetime. Any value above 0 also sends `includeSubDomains` and `preload`. |
| `SESSION_COOKIE_SECURE` | same as `ENABLE_HTTPS` | no | Mark the `/control/` session cookie `Secure`. |
| `CSRF_COOKIE_SECURE` | same as `ENABLE_HTTPS` | no | Mark the CSRF cookie `Secure`. |
| `AUTH_COOKIE_SAMESITE` | `None` | no | `SameSite` for the refresh-token cookie. `None` lets separate frontend and API origins share it. |
| `AUTH_COOKIE_SECURE` | `True` | no | Mark the refresh-token cookie `Secure`. Browsers drop such cookies on plain HTTP except on `localhost`. |
| `BEHIND_TRUSTED_PROXY` | `False` | yes | Hosting-platform mode: the tenant host middleware becomes the host check (`ALLOWED_HOSTS` is then `*`). |
| `INFRA_HOSTS` | `localhost,127.0.0.1,backend,backend:8000` | yes | Internal host names treated as infrastructure callers in hosting-platform mode. |
| `PLATFORM_DOMAIN_SUFFIX` | empty | yes | Empty = self-hosted. Set to your platform domain (for example `.example.org`) to run subdomain hosting for many makerspaces, which also activates fair-use limits. |
| `PLATFORM_SUBDOMAIN_AUTO_TLS` | `False` | yes | Let Caddy issue certificates for registered, verified tenant subdomains. |
| `PLATFORM_ORIGIN_HOST` | empty | yes | Origin host name used by hosting-platform domain checks. |
| `PLATFORM_STAFF_ORIGINS` | empty | yes | Shared staff-console origins on a multi-makerspace deployment. |
| `DOMAIN_CHANGE_COOLDOWN_SECONDS` | `0` | platform layer only | Minimum wait between custom-domain changes in hosting-platform mode. |

## Object storage

See [Object storage](/configure/object-storage/).

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | empty | yes (`MINIO_ROOT_USER`) | **Secret.** Access key for the S3-compatible store. |
| `AWS_SECRET_ACCESS_KEY` | empty | yes (`MINIO_ROOT_PASSWORD`) | **Secret.** Secret key for the store. |
| `AWS_STORAGE_BUCKET_NAME` | `evidence` | yes | Private bucket for evidence photos, print files and documents. |
| `AWS_S3_ENDPOINT_URL` | `http://localhost:9000` | yes (`http://minio:9000`) | Endpoint the backend talks to. |
| `AWS_S3_PUBLIC_ENDPOINT_URL` | same as above | yes (`http://localhost:9000`) | Endpoint browsers use inside presigned URLs. Must be reachable from users' browsers, and HTTPS when your site is HTTPS. |
| `AWS_S3_REGION_NAME` | `us-east-1` | yes | Region for request signing (`auto` for Cloudflare R2). |
| `STORAGE_PRESIGN_METHOD` | `post` | yes | `post` (browser POST policy, MinIO/Silo/AWS) or `put` (presigned PUT, for R2 and Supabase Storage). |
| `PUBLIC_IMAGE_BUCKET` | `public-images` | yes | Anonymous-read bucket for item photos and makerspace logos. Must differ from the private bucket, or startup fails. |
| `PUBLIC_IMAGE_BASE_URL` | empty | yes | Browser URL of the public bucket, for example `https://files.example.org/public-images`. |
| `PUBLIC_IMAGE_MAX_BYTES` | `10485760` | no | Largest public image upload (10 MB). |
| `PUBLIC_IMAGE_URL_TTL_SECONDS` | `300` | no | Lifetime of a public-image upload URL. |
| `EVIDENCE_MAX_BYTES` | `10485760` | no | Largest evidence photo. Evidence must be JPEG, PNG or WebP. |
| `EVIDENCE_URL_TTL_SECONDS` | `300` | no | Lifetime of an evidence upload or view URL. |
| `PRINT_UPLOAD_MAX_BYTES` | `104857600` | no | Largest 3D print file (100 MB). |
| `PRINT_URL_TTL_SECONDS` | `300` | no | Lifetime of a print-file URL. |
| `PRINT_ALLOWED_MODEL_EXT` | `stl,3mf,step,stp,obj,amf,ply,gcode,gco,iges,igs,dxf` | no | Accepted print file extensions. |
| `PRINT_ALLOWED_MODEL_MIME` | a list of model MIME types | no | Accepted print file MIME types. |
| `MACHINE_DOC_MAX_BYTES` | `10485760` | no | Largest machine or maintenance document. |
| `MACHINE_DOC_ALLOWED_EXT` | PDF, images and CAD formats | no | Accepted machine document extensions. |
| `MACHINE_DOC_ALLOWED_MIME` | matching MIME list | no | Accepted machine document MIME types. |
| `WARRANTY_DOC_MAX_BYTES` | `10485760` | no | Largest warranty document. |
| `WARRANTY_DOC_ALLOWED_MIME` | `application/pdf,image/jpeg,image/png,image/webp` | no | Accepted warranty document types. |
| `PROCUREMENT_RECEIPT_MAX_BYTES` | `10485760` | no | Largest purchase receipt. |
| `PROCUREMENT_RECEIPT_ALLOWED_MIME` | `application/pdf,image/jpeg,image/png,image/webp` | no | Accepted receipt types. |
| `REPORT_DELIVERY_URL_TTL_SECONDS` | `21600` | no | Lifetime of a signed link in a scheduled report delivery (six hours). |
| `MINIO_ROOT_USER` | none | Compose only | **Required with bundled storage. Secret.** Silo/MinIO admin user, also the backend's default access key. |
| `MINIO_ROOT_PASSWORD` | none | Compose only | **Required with bundled storage. Secret.** Silo/MinIO admin password. |
| `MINIO_CORS_ALLOWED_ORIGINS` | `*` | Compose only | Origins allowed to upload to bundled storage. Set to your website origin. |
| `MINIO_API_BIND` / `MINIO_API_PORT` | `0.0.0.0` / `9000` | Compose only | Where bundled storage's S3 API listens on the host. |
| `MINIO_CONSOLE_BIND` / `MINIO_CONSOLE_PORT` | `127.0.0.1` / `9001` | Compose only | Where the storage admin console listens. Keep it on loopback. |
| `SILO_IMAGE_TAG` | a pinned release | Compose only | Silo image version. |

## Email

See [Email](/configure/email/). These are the deployment-wide fallback; platform SMTP set in the
staff console overrides them, and a makerspace's own SMTP overrides both for its mail.

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | yes (SMTP backend) | Must be `django.core.mail.backends.smtp.EmailBackend` for real delivery. The console backend only prints mail to the logs. |
| `EMAIL_HOST` | empty | yes | SMTP server host name. |
| `EMAIL_PORT` | `587` | yes | SMTP port. |
| `EMAIL_HOST_USER` | empty | yes | SMTP user name. |
| `EMAIL_HOST_PASSWORD` | empty | yes | **Secret.** SMTP password or API key. |
| `EMAIL_USE_TLS` | `True` | yes | Use STARTTLS. |
| `DEFAULT_FROM_EMAIL` | `Makerspace <noreply@makerspace.local>` | yes | Sender address when nothing more specific is set. Use a domain you control. |

## Sign-in and accounts

Provider credentials (Google, Apple, OpenID Connect, SMS) are not environment variables; see
[Authentication](/configure/authentication/). These tune timeouts and limits.

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `AXES_ENABLED` | `True` | no | Brute-force lockout on password sign-in (staff console, member login and `/control/`). |
| `AXES_FAILURE_LIMIT` | `5` | yes | Failed attempts for one IP and user name before a one-hour lockout. |
| `MFA_CHALLENGE_TTL_SECONDS` | `300` | no | How long a two-step sign-in challenge stays valid (60 to 600). |
| `MFA_MAX_ATTEMPTS` | `5` | no | Wrong codes per challenge before it is refused (1 to 10). |
| `SOCIAL_AUTH_NONCE_TTL_SECONDS` | `300` | no | Lifetime of a Google/Apple sign-in nonce. |
| `SOCIAL_AUTH_CLOCK_SKEW_SECONDS` | `60` | no | Clock skew tolerated when checking provider tokens. |
| `SOCIAL_AUTH_JWKS_TIMEOUT_SECONDS` | `5` | no | Timeout fetching a provider's signing keys. |
| `SOCIAL_AUTH_JWKS_CACHE_SECONDS` | `3600` | no | How long provider signing keys are cached. |
| `SOCIAL_AUTH_JWKS_MAX_BYTES` | `1048576` | no | Largest signing-key document accepted. |
| `SOCIAL_GOOGLE_JWKS_URL` | `https://www.googleapis.com/oauth2/v3/certs` | no | Google's signing keys. |
| `SOCIAL_APPLE_JWKS_URL` | `https://appleid.apple.com/auth/keys` | no | Apple's signing keys. |
| `OIDC_ATTEMPT_TTL_SECONDS` | `300` | no | How long an OpenID Connect sign-in may take from redirect to callback. |
| `OIDC_HTTP_TIMEOUT_SECONDS` | `5` | no | Timeout for discovery and token requests to your identity provider. |
| `OIDC_HTTP_MAX_BYTES` | `65536` | no | Largest provider response accepted. |
| `OIDC_DISCOVERY_CACHE_SECONDS` | `300` | no | How long the provider's discovery document is cached. |
| `MEMBER_CLAIM_CODE_TTL_SECONDS` | `900` | no | Lifetime of a staff-issued account claim code. |
| `MEMBER_CLAIM_SESSION_TTL_SECONDS` | `43200` | no | Lifetime of the session a claim code opens. |
| `PLATFORM_ADMIN_SSO` | `False` | no | Declares that `/control/` has a password-free way in. No such route ships today; leave it `False` so switching off passwords cannot lock you out of `/control/`. |

## SMS

Twilio credentials are set in `/control/` under **Platform SMS settings**, not in the environment.

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `OTP_SMS_DAILY_CAP` | `200` | no | Deployment-wide daily ceiling on sign-in text messages, applied on self-hosted installs too, because every text costs you money. |

## Telegram and chat

Slack, Mattermost, Discord and per-makerspace Telegram bots are configured in the staff console. See
[Notifications](/configure/notifications/).

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | empty | no | **Secret.** Fallback bot for makerspaces that have not set their own. |
| `TELEGRAM_WEBHOOK_SECRET` | empty | no | **Secret.** Secret registered with Telegram's `setWebhook`. The webhook answers 403 while unset. Callbacks are acknowledged and ignored. |
| `TELEGRAM_API_URL` | `https://api.telegram.org` | no | Telegram Bot API base URL, for a local Bot API server. |

## Payments

Stripe keys are entered per makerspace in the staff console. See [Payments](/configure/payments/).

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `STRIPE_CONNECT_REDIRECT_URI` | empty | no | OAuth callback for platform Stripe Connect on hosting platforms. Leave empty when self-hosting. |

## Encryption keys and integrity

See [Security](/configure/security/) for backup and rotation.

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `API_CLIENT_ENC_KEY` | empty | yes | **Required in practice. Secret.** Fernet key encrypting every stored credential: SMTP passwords, chat webhooks and bot tokens, Stripe keys, two-step sign-in secrets, API client secrets. Losing or changing it makes them unreadable. |
| `AUDIT_MAC_MASTER_KEY` | empty | yes | **Secret.** Fernet key for tamper-evident audit rows. Empty means new audit rows are stored without a MAC (a startup warning is logged). Setup generates one. |
| `EVENT_STATION_PIN_PEPPER` | empty | no | **Secret.** Independent key for event check-in and kiosk station PINs. Do not reuse another key. |
| `PUSH_TOKEN_HMAC_KEY` | empty | no | **Secret.** 32+ character key for push-token fingerprints. Mobile push registration answers 503 while unset. |
| `PII_ENCRYPTION_ENABLED` | `False` | no | Turn on scoped encryption of contact details. Follow the runbook; do not just flip it. |
| `PII_ENCRYPTION_DUAL_READ` | `True` | no | Also read legacy plaintext during the rollout window. |
| `PII_KEY_BROKER` | `local` | no | `local` (uses `PII_MASTER_KEY`) or `aws_kms`. |
| `PII_MASTER_KEY` | empty | no | **Secret.** Fernet key wrapping each makerspace's data key (local broker). |
| `PII_MASTER_KEY_PREVIOUS` | empty | no | **Secret.** The old master key during a rotation. |
| `PII_SEARCH_HASH_KEY` | empty | no | **Secret.** Key for searchable hashes of encrypted fields. |
| `PII_DEK_CACHE_TTL_SECONDS` | `300` | no | How long unwrapped data keys are cached in each process. |
| `PII_AWS_KMS_KEY_ID` | empty | no | KMS key or alias, with `PII_KEY_BROKER=aws_kms`. |
| `PII_AWS_KMS_REGION` | empty | no | KMS region. |
| `PII_AWS_KMS_ENDPOINT_URL` | empty | no | Alternative KMS-compatible endpoint. |

### Audit attestation (optional)

Publishes signed batches of audit history off the server so tampering is detectable even by
someone who controls the database. Dormant while `AUDIT_ATTESTATION_ANCHOR_BACKEND` is empty. All
are forwarded by the bundled stack.

| Variable | Default | What it does |
| --- | --- | --- |
| `AUDIT_ATTESTATION_ANCHOR_BACKEND` | empty | `object_storage` or `http`. |
| `AUDIT_ATTESTATION_DEPLOYMENT_ID` | empty | Stable identifier for this deployment in the anchor. |
| `AUDIT_ATTESTATION_S3_BUCKET` | empty | Bucket for anchors (use a separate account or bucket with object lock). |
| `AUDIT_ATTESTATION_S3_PREFIX` | `spaceworks-audit/v1` | Key prefix. |
| `AUDIT_ATTESTATION_RETENTION_DAYS` | `2555` | Object-lock retention (about seven years). |
| `AUDIT_ATTESTATION_S3_OBJECT_LOCK_MODE` | `COMPLIANCE` | S3 object lock mode. |
| `AUDIT_ATTESTATION_S3_ENDPOINT_URL` | `AWS_S3_ENDPOINT_URL` | Endpoint for the anchor bucket. |
| `AUDIT_ATTESTATION_S3_ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` | **Secret.** Credentials for the anchor bucket. |
| `AUDIT_ATTESTATION_S3_SECRET_ACCESS_KEY` | `AWS_SECRET_ACCESS_KEY` | **Secret.** |
| `AUDIT_ATTESTATION_S3_REGION_NAME` | `AWS_S3_REGION_NAME` | Region for the anchor bucket. |
| `AUDIT_ATTESTATION_HTTP_URL` | empty | Collector URL, with the `http` backend. |
| `AUDIT_ATTESTATION_HTTP_BEARER_TOKEN` | empty | **Secret.** Bearer token for the collector. |
| `AUDIT_ATTESTATION_HTTP_TIMEOUT` | `10` | Seconds before a collector request times out. |

## Evidence retention

See [Evidence retention](/configure/evidence-retention/). All are forwarded by the bundled stack.

| Variable | Default | What it does |
| --- | --- | --- |
| `EVIDENCE_OBJECT_EXPIRY_ENABLED` | `False` | Deployment switch that lets old evidence photo bytes be deleted. |
| `EVIDENCE_OBJECT_RETENTION_DAYS` | `365` | Default age before photo bytes expire (30 to 3650). Makerspaces can override it. |
| `EVIDENCE_RETENTION_BATCH_SIZE` | `100` | Photos per makerspace per sweep (1 to 1000). |
| `EVIDENCE_ABANDONED_UPLOAD_CLEANUP_ENABLED` | `False` | Deployment switch for deleting upload slots that no handover ever used. |
| `EVIDENCE_ABANDONED_UPLOAD_RETENTION_DAYS` | `7` | Default age before an unused slot is eligible (1 to 3650, longer than the upload URL lifetime). |

## Rate limits

Each value is a rate such as `10/min`, `5/hour` or `3/day`. The defaults suit production; raise one
only when real users hit it. None of these is forwarded by the bundled stack. Limits are counted per
client IP (see `TRUSTED_PROXY_COUNT`) or per account, email or token as noted.

| Variable | Default | Limits |
| --- | --- | --- |
| `THROTTLE_LOGIN` | `10/min` | Password sign-in |
| `THROTTLE_MFA_VERIFY` | `10/min` | Two-step code checks per IP, including `/control/` |
| `THROTTLE_MFA_CHALLENGE` | `10/min` | Attempts on one challenge |
| `THROTTLE_MFA_USER` | `20/hour` | Two-step attempts per account |
| `THROTTLE_MFA_MANAGE` | `10/hour` | Enrolling, regenerating or disabling two-step sign-in |
| `THROTTLE_SOCIAL_NONCE` | `10/min` | Starting a Google/Apple sign-in |
| `THROTTLE_SOCIAL_LOGIN` | `10/min` | Completing a provider sign-in |
| `THROTTLE_PHONE_OTP_REQUEST` | `5/min` | Requesting an SMS code, per IP |
| `THROTTLE_PHONE_OTP_NUMBER` | `5/hour` | SMS codes sent to one number |
| `THROTTLE_PHONE_LOGIN_CONFIRM` | `10/min` | Entering an SMS code, per IP |
| `THROTTLE_PHONE_CONFIRM_NUMBER` | `15/hour` | Code guesses for one number |
| `THROTTLE_PASSWORD_RESET_REQUEST` | `5/min` | Forgot-password requests, per IP |
| `THROTTLE_PASSWORD_RESET_EMAIL` | `5/hour` | Reset emails to one address |
| `THROTTLE_PASSWORD_RESET_CONFIRM` | `10/min` | Reset confirmations, per IP |
| `THROTTLE_PASSWORD_RESET_CONFIRM_EMAIL` | `15/hour` | Reset confirmations for one address |
| `THROTTLE_MEMBER_SIGN_UP` | `5/min` | Member self sign-up |
| `THROTTLE_EMAIL_VERIFICATION_RESEND` | `5/min` | Resending a verification email |
| `THROTTLE_EMAIL_VERIFICATION_CONFIRM` | `10/min` | Confirming a verification code |
| `THROTTLE_MEMBER_VERIFICATION_EMAIL` | `5/hour` | Verification emails to one address |
| `THROTTLE_MEMBER_CLAIM_ISSUE` | `10/hour` | Staff issuing account claim codes |
| `THROTTLE_MEMBER_CLAIM_REDEEM` | `10/min` | Redeeming a claim code |
| `THROTTLE_STAFF_INVITE` | `20/hour` | Creating, resending or revoking staff invitations |
| `THROTTLE_STAFF_INVITE_ACCEPT` | `10/min` | Accepting an invitation |
| `THROTTLE_PUBLIC_READ` | `120/min` | Public catalogue reads |
| `THROTTLE_PUBLIC_STATS` | `30/min` | Public statistics |
| `THROTTLE_PUBLIC_REQUEST_SUBMIT` | `10/min` | Public borrow-request submission |
| `THROTTLE_REQUEST_SUBMIT` | `10/min` | Borrow-request submission |
| `THROTTLE_REQUEST_STATUS` | `60/min` | Request status lookups |
| `THROTTLE_ANONYMOUS_REQUEST_IP_BURST` | `2/min` | Account-less requests, per IP |
| `THROTTLE_ANONYMOUS_REQUEST_IP_HOUR` | `10/hour` | Account-less requests, per IP per hour |
| `THROTTLE_ANONYMOUS_REQUEST_EMAIL` | `3/day` | Account-less requests per email address |
| `THROTTLE_PUBLIC_INVITATION_REQUEST` | `10/hour` | Public membership invitation requests |
| `THROTTLE_PRINT_REQUEST_SUBMIT` | `10/min` | 3D print requests |
| `THROTTLE_PUBLIC_TOOL_CHECKOUT` | `10/min` | Self-checkout of a tool |
| `THROTTLE_PUBLIC_TOOL_RETURN` | `10/min` | Self-return of a tool |
| `THROTTLE_BOOKING_SUBMIT` | `10/hour` | Booking requests |
| `THROTTLE_MEMBERSHIP_REQUEST` | `10/hour` | Membership join requests |
| `THROTTLE_PRESENCE_START` | `10/hour` | Starting a presence (check-in) session |
| `THROTTLE_MEMBER_IMAGE_PRESIGN` | `20/hour` | Member profile image uploads |
| `THROTTLE_EVENT_REGISTER` | `10/hour` | Event registrations |
| `THROTTLE_EVENT_REGISTRATION_RETRY` | `30/hour` | Retrying a registration |
| `THROTTLE_EVENT_CHECKIN_RESOLVE` | `60/min` | Event check-in scans |
| `THROTTLE_EVENT_OFFLINE_ROSTER` | `10/hour` | Downloading an offline check-in roster |
| `THROTTLE_EVENT_OFFLINE_SYNC` | `60/hour` | Syncing offline check-ins |
| `THROTTLE_EVENT_STATION_PIN_TOKEN` | `10/hour` | Station PIN attempts per station |
| `THROTTLE_EVENT_STATION_PIN_IP` | `30/hour` | Station PIN attempts per IP |
| `THROTTLE_EVENT_STATION_SESSION` | `120/hour` | Station session calls |
| `THROTTLE_EVENT_STATION_REVEAL` | `5/hour` | Revealing a station PIN |
| `THROTTLE_EVENT_CALENDAR_FEED_TOKEN` | `120/hour` | Calendar feed reads per feed (events and bookings) |
| `THROTTLE_EVENT_CALENDAR_FEED_IP` | `300/hour` | Calendar feed reads per IP |
| `THROTTLE_KIOSK_STATION_PIN_TOKEN` | `10/hour` | Kiosk PIN attempts per station |
| `THROTTLE_KIOSK_STATION_PIN_IP` | `30/hour` | Kiosk PIN attempts per IP |
| `THROTTLE_KIOSK_STATION_SESSION` | `120/hour` | Kiosk session calls |
| `THROTTLE_KIOSK_OPERATOR_LEASE` | `30/hour` | Staff taking over a kiosk |
| `THROTTLE_KIOSK_REPLAY_PREPARE` | `60/hour` | Preparing offline kiosk replays |
| `THROTTLE_KIOSK_REPLAY_EXECUTE` | `240/hour` | Executing offline kiosk replays |
| `THROTTLE_DEVICE_ATTESTATION_CHALLENGE` | `5/min` | Mobile app attestation challenges |
| `THROTTLE_DEVICE_LOGIN` | `5/min` | Mobile app sign-in, per IP |
| `THROTTLE_DEVICE_LOGIN_USER` | `10/hour` | Mobile app sign-in, per account |
| `THROTTLE_DEVICE_REFRESH` | `30/min` | Mobile token refresh |
| `THROTTLE_PUSH_DEVICE_REGISTRATION` | `10/min` | Push device registration |
| `THROTTLE_CLIENT_PUBLIC` | `30/min` | API clients on the `public` tier |
| `THROTTLE_CLIENT_STANDARD` | `120/min` | API clients on the `standard` tier |
| `THROTTLE_CLIENT_TRUSTED` | `600/min` | API clients on the `trusted` tier |
| `THROTTLE_TELEGRAM_WEBHOOK` | `60/min` | Telegram webhook calls |
| `THROTTLE_AUDIT_VERIFICATION` | `6/hour` | On-demand audit integrity checks |
| `THROTTLE_DATA_EXPORT_CREATE` | `3/hour` | Starting a data export |
| `THROTTLE_ARCHIVE_RECIPIENT_VERIFY` | `10/min` | Verifying a backup archive recipient |
| `THROTTLE_TENANT_MIGRATION_READ` | `120/min` | Tenant migration reads |
| `THROTTLE_TENANT_MIGRATION_WRITE` | `30/hour` | Tenant migration writes |

Two related limits for account-less borrow requests:

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `ANONYMOUS_REQUEST_OUTSTANDING_LIMIT` | `50` | no | Maximum open account-less requests per makerspace. |
| `ANONYMOUS_REQUEST_IDEMPOTENCY_KEY_MAX_LENGTH` | `128` | no | Longest accepted `Idempotency-Key` header. |

## Monitoring

See [Monitoring](/configure/monitoring/).

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `LOG_LEVEL` | `INFO` | no | Minimum log level. |
| `LOG_JSON` | `True` unless `DEBUG` | no | One JSON object per log line, each with the request ID. |
| `METRICS_TOKEN` | empty | yes | **Secret.** Bearer token for `GET /api/v1/metrics/`. The route answers 404 while unset. |
| `SENTRY_DSN` | empty | yes | **Secret.** Turns on Sentry error reporting, with personal data off. |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.0` | yes | Share of requests traced for performance (0 to 1). |
| `SENTRY_ENVIRONMENT` | `production` unless `DEBUG` | yes | Environment label shown in Sentry. |

## Editions and modules

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `SPACEWORKS_EDITION` | `makerspace` | no | What the deployment is for: `makerspace`, `events`, `bookings` or `organization`. Hides the surfaces it does not need. Any other value stops startup. See [Modules](/guides/modules/). |
| `TOMBSTONED_APPS` | empty | no | Comma-separated optional apps to remove from the build entirely (routes, admin, API docs), keeping their data: `procurement`, `notifications`, `warranty`, `maintenance`, `presence`, `events`, `bookings`, `payments_rail` (or `payments`), `tenant_migration`, `devices`. `manage.py suggest_tombstones` prints a safe value. |

## API clients

See [API clients](/api/api-clients/).

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `API_CLIENT_AUTH_REQUIRED` | `False` | no | Require a signed client or publishable key on the protected public paths. While off, would-be rejections are only logged. |
| `APICLIENT_REQUIRE_NONCE` | `False` | no | Refuse signed requests without an `X-Nonce`. |
| `HMAC_PROTECTED_PATH_PREFIXES` | `/api/public/,/api/v1/public/` | no | Paths covered by API-client enforcement. |
| `HMAC_MAX_CLOCK_SKEW_SECONDS` | `300` | no | Accepted clock difference on signed requests. |
| `HMAC_CLIENT_ID` | empty | no | Legacy single deployment client ID. |
| `HMAC_SECRET` | empty | no | **Secret.** Legacy single deployment client secret. |

## Mobile apps and connected devices

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `DEVICE_ATTESTATION_APPS` | `{}` | no | JSON allowlist of native apps. Native sign-in stays off until this and a verifier are set. |
| `DEVICE_APPLE_ATTESTATION_VERIFY_URL` | empty | no | Your Apple App Attest verifier service. |
| `DEVICE_APPLE_ATTESTATION_VERIFY_TOKEN` | empty | no | **Secret.** Bearer token for it. |
| `DEVICE_ANDROID_ATTESTATION_VERIFY_URL` | empty | no | Your Play Integrity verifier service. |
| `DEVICE_ANDROID_ATTESTATION_VERIFY_TOKEN` | empty | no | **Secret.** Bearer token for it. |
| `DEVICE_ATTESTATION_CHALLENGE_TTL_SECONDS` | `180` | no | Lifetime of an attestation challenge. |
| `DEVICE_ATTESTATION_PROVIDER_TIMEOUT_SECONDS` | `10` | no | Timeout calling a verifier. |
| `DEVICE_SIGNATURE_MAX_SKEW_SECONDS` | `300` | no | Clock skew allowed on signed requests from enrolled printers and label printers. |
| `DEVICE_NONCE_TTL_SECONDS` | `86400` | no | Replay-protection window. Must be at least twice the skew, or startup fails. |
| `DEVICE_ENROLLMENT_TTL_SECONDS` | `900` | no | Lifetime of a one-time device enrollment code. |
| `DEVICE_COMMAND_LEASE_SECONDS` | `60` | no | Time a device has to acknowledge a delivered command. |
| `DEVICE_COMMAND_MAX_ATTEMPTS` | `10` | no | Delivery attempts before a command fails. |

## Events, kiosks and stations

| Variable | Default | What it does |
| --- | --- | --- |
| `EVENT_CHECKIN_WINDOW_BEFORE_HOURS` | `24` | How early check-in opens before an event. |
| `EVENT_CHECKIN_WINDOW_AFTER_HOURS` | `2` | How long after the end check-in stays open. |
| `EVENT_CHECKIN_SYNC_GRACE_HOURS` | `24` | How late offline check-ins may sync. |
| `EVENT_CHECKIN_ROSTER_LIFETIME_HOURS` | `24` | Lifetime of a downloaded offline roster. |
| `EVENT_CHECKIN_CLOCK_SKEW_SECONDS` | `300` | Clock skew tolerated on offline check-ins. |
| `EVENT_CHECKIN_ROSTER_MAX` | `1000` | Largest offline roster. |
| `KIOSK_STATION_SESSION_TTL_SECONDS` | `43200` | Lifetime of a kiosk station session. |
| `KIOSK_OPERATOR_LEASE_TTL_SECONDS` | `28800` | How long one staff member stays signed in at a kiosk. |
| `KIOSK_OPERATOR_LEASE_RETENTION_SECONDS` | `604800` | How long ended operator sessions are kept. |
| `KIOSK_COMMAND_MAX_AGE_SECONDS` | `28800` | Oldest offline kiosk action a replay accepts. |
| `KIOSK_REPLAY_RETENTION_SECONDS` | `604800` | How long completed replays are kept. |
| `KIOSK_REPLAY_CLAIM_TIMEOUT_SECONDS` | `300` | When a stuck replay is released for retry. |
| `KIOSK_REPLAY_CLEANUP_BATCH_SIZE` | `500` | Rows per nightly replay cleanup batch. |

None of these is forwarded by the bundled stack.

## Backups, exports and tenant migration

These are mostly host-orchestration settings managed by the installer. See
[Backup and restore](/install/backup-restore/).

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `BACKUP_AGE_RECIPIENT` | empty | yes | `age` public key that deployment backup archives are encrypted to. |
| `BACKUP_ARCHIVE_SIGNING_PRIVATE_KEY` | empty | yes | **Secret.** Base64 Ed25519 key that signs archives. |
| `BACKUP_ARCHIVE_VERIFY_PUBLIC_KEY` | empty | yes | Matching public key; the only half a restore host needs. |
| `BACKUP_DOWNLOAD_TTL_SECONDS` | `300` | no | Lifetime of a backup download link. |
| `BACKUP_LEASE_SECONDS` | `7200` | no | Longest a backup operation holds its lock. |
| `BACKUP_DECISION_SECONDS` | `300` | no | Time allowed to confirm a pending backup decision. |
| `BACKUP_RECIPIENT_CHALLENGE_TTL_SECONDS` | `900` | no | Lifetime of an archive-recipient challenge. |
| `BACKUP_PRESIGN_DRAIN_SECONDS` | longest upload URL TTL | no | Wait for in-flight uploads before a capture. |
| `BACKUP_OPS_DIR` | `/var/lib/spaceworks/ops` | fixed | Working directory for backup operations. |
| `DATA_EXPORT_DEADLINE_SECONDS` | `900` | no | Longest an export may run. |
| `DATA_EXPORT_PAGE_SIZE` | `500` | no | Rows per export batch. |
| `DATA_EXPORT_RETENTION_SECONDS` | `604800` | no | How long finished exports are kept (seven days). |
| `DATA_EXPORT_DOWNLOAD_TTL_SECONDS` | `300` | no | Lifetime of an export download link. |
| `TENANT_MIGRATION_AGE_RECIPIENT` | empty | no | `age` key that tenant migration archives are encrypted to. |
| `TENANT_MIGRATION_AGE_IDENTITY_FILE` | empty | no | Path to the matching private identity on the target. |
| `TENANT_MIGRATION_GATE_LEASE_SECONDS` | `7200` | no | Longest a migration holds a makerspace's write gate. |
| `TENANT_MIGRATION_PRESIGN_DRAIN_SECONDS` | longest upload URL TTL | no | Wait for in-flight uploads before a migration capture. |
| `TENANT_DUMP_STAGING_DIR` | empty | no | Staging directory for tenant dumps. |
| `TENANT_DUMP_STAGING_MAX_AGE_SECONDS` | `604800` | no | When stale staged dumps are removed. |
| `SPACEWORKS_HOST_MARKER_PATH` | `/run/spaceworks-host/restore-marker.json` | fixed | Host restore marker checked by readiness. |
| `BACKUP_PRODUCER_CAPABILITY_MARKER_PATH`, `BACKUP_PRODUCER_PRIVILEGED_SCRIPTS_DIR`, `BACKUP_PRODUCER_ENTRYPOINT_PATH`, `BACKUP_PRODUCER_MIGRATIONS_DIR` | container paths | fixed | Internal paths used by the backup producer. Do not change. |

The installer and host scripts also use `SPACEWORKS_RUNTIME_DATABASE_URL`,
`SPACEWORKS_GRANTS_ONLY`, `SPACEWORKS_GRANT_DATABASE_NAME`, `SPACEWORKS_HOST_MARKER_WRITE_PATH`,
`SPACEWORKS_OCI_DIGEST`, `SPACEWORKS_DB_POINTER_GENERATION` and the `SPACEWORKS_SCHEDULER_*`
variables. They are set by Compose and the wrapper; you never set them by hand.

## Other

| Variable | Default | Bundled | What it does |
| --- | --- | --- | --- |
| `GITHUB_API_TOKEN` | empty | no | **Secret.** Read-only GitHub token used once a day to show contribution counts on maker profiles. Empty keeps the feature dormant. |

## Frontend

The website reads these. `VITE_*` values are baked in when the image is built; `TENANT_*` values are
read when the frontend container starts.

| Variable | Default | When | What it does |
| --- | --- | --- | --- |
| `VITE_API_URL` | `/api` | build | API base URL. Set `https://api.example.org/api` for a frontend hosted elsewhere. |
| `VITE_TENANT_TOKEN` | empty | build | Pins the build to one makerspace by its code. |
| `VITE_PUBLIC_API_KEY` | empty | build | Publishable key, when public-key hardening is on. |
| `VITE_PUBLIC_CLIENT_ID` | empty | build | Public client ID that goes with it. |
| `TENANT_API_URL` | `VITE_API_URL` or `/api` | runtime | API base URL, overriding the build value. |
| `TENANT_TOKEN` | `VITE_TENANT_TOKEN` | runtime | Makerspace code for a single-makerspace frontend. |
| `TENANT_ORIGIN_BOOTSTRAP` | `false` | runtime | `true` resolves the makerspace from the site's domain. |
| `TENANT_CONFIG_PATH` | `/usr/share/nginx/html/config.js` | runtime | Where the runtime config file is written. |

## Docker Compose and installer

These are read by Compose files, Caddy and the scripts, never by Django. Setup writes most of them.

| Variable | Default | What it does |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `spaceworks` | Container name prefix. |
| `SPACEWORKS_REPOSITORY` | `SpaceWorks-HQ/SpaceWorks` | GitHub `owner/repo` for releases, updates and default image names. Forks set their own. |
| `MAKERSPACE_BACKEND_IMAGE` | `ghcr.io/spaceworks-hq/spaceworks-backend` | Backend image. |
| `MAKERSPACE_FRONTEND_IMAGE` | `ghcr.io/spaceworks-hq/spaceworks-frontend` | Frontend image. |
| `MAKERSPACE_ALLINONE_IMAGE` | `ghcr.io/spaceworks-hq/spaceworks-allinone` | Single-box image. |
| `MAKERSPACE_IMAGE_TAG` | the installed release | Image tag. Normally pinned by the installer. |
| `HTTP_PORT` / `HTTP_PORT_BIND` | `80` / `0.0.0.0` | Where the website listens on the host. |
| `API_PORT` / `API_BIND` | `80` / `0.0.0.0` | API listener when the website is not hosted here. |
| `GUNICORN_WORKERS` | `3` | API worker processes. |
| `GUNICORN_TIMEOUT` | `60` | Seconds before a slow request is stopped. |
| `LIVE_THREADS` | `32` | Concurrent live-update streams. |
| `CELERY_CONCURRENCY` | `4` | Parallel background jobs. |
| `PUBLIC_DOMAIN` | none | Your domain, for the built-in Caddy HTTPS layer. |
| `TLS_EMAIL` | empty | Contact email for automatic certificates. |
| `TLS_HTTP_PORT` / `TLS_HTTPS_PORT` | `80` / `443` | Caddy's host ports. |
| `STORAGE_DOMAIN` | empty | Host name that serves bundled storage over HTTPS, usually `files.<your-domain>`. |
| `STORAGE_CADDY_CONFIG` | storage disabled | Whether Caddy serves bundled storage. Setup chooses this. |
| `SPACEWORKS_WEB_UPSTREAM` | `frontend:80` | What Caddy forwards website traffic to. |
| `SPACEWORKS_HOSTING_MODEL` | from setup | `1` one makerspace, `2` shared `/m/<slug>` spaces, `3` subdomain platform. |
| `SPACEWORKS_RUN_FRONTEND` | `yes` | `no` serves the API only. |
| `SPACEWORKS_STORAGE` | `bundled` | `external` disables bundled storage. |
| `PLATFORM_DOMAIN`, `PLATFORM_FIRST_HOST`, `CADDY_SAAS_CONFIG`, `CADDY_CERTS_DIR` | from setup | Subdomain-platform Caddy settings. |
| `SPACEWORKS_OPS_HOST_DIR` / `SPACEWORKS_HOST_STATE_DIR` | `/var/lib/spaceworks/ops` / `/var/lib/spaceworks/host` | Host directories for operations state. |
| `BACKEND_PORT` / `FRONTEND_PORT` / `CRON_INTERVAL_SECONDS` | `8000` / `8080` / `900` | Cloud profile only: published ports and how often the scheduler runs. |
| `SPACEWORKS_MAINTENANCE_DATABASE_URL` | none | Cloud profile only: direct database URL used for migrations. |

The first-run command `setup_instance` also reads `SETUP_SUPERADMIN_USERNAME`,
`SETUP_SUPERADMIN_EMAIL`, `SETUP_SUPERADMIN_PASSWORD`, `SETUP_MAKERSPACE_NAME`,
`SETUP_MAKERSPACE_SLUG` and `SETUP_MODULE_PROFILE` when they are set. They are only needed once.

## Related

- [Security](/configure/security/): the secrets checklist
- [The `.env` file and applying changes](/install/docker-compose/)
- [Setup questions](/install/setup-questions/): what the installer writes for you
