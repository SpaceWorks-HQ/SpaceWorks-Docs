---
title: Setup questions
description: Every question the SpaceWorks installer asks, in order, with its options, defaults and what each answer configures.
sidebar:
  order: 3
---

The installer asks all of its questions before it touches your server. This page lists them in the
order you'll see them, with the default (press <kbd>Enter</kbd> to accept it) and what each answer
changes. Invalid answers are simply asked again.

At the end you get one summary, with secrets hidden, and `Proceed? [Y/n]`. Answering `n` leaves your
machine exactly as it was.

## 1. GitHub repository

| Question | Default | Notes |
| --- | --- | --- |
| GitHub repository | `SpaceWorks-HQ/SpaceWorks` | Asked first by the one-line installer, before it downloads anything, because the repository decides which release is installed. Skipped if you passed `--repo`. Type a fork as `owner/name`. |

Running `bash setup.sh` from a checkout asks this question near the end instead, as
**GitHub repository to follow**.

## 2. Hosting model

```text
1) One makerspace on this server - one community, at /m/<slug>.
2) Several makerspaces - shared server, each at /m/<slug>; the superadmin adds more later.
3) Hosted platform - each makerspace has a subdomain of your platform domain.
```

Default: **1**. Options 1 and 2 serve every makerspace from one address, at `/m/<slug>`. Option 3
turns on hosted-platform mode, where each makerspace gets its own subdomain, and asks one more
question:

| Question | Default | Notes |
| --- | --- | --- |
| Platform domain | required | For example `spaces.example.org`. Makerspaces become `<slug>.spaces.example.org`. |

## 3. Website

| Question | Options | Default |
| --- | --- | --- |
| Run the website (web frontend) on this server? | `1` Yes, `2` No, API only | `1` |

Choose **API only** if you host the website elsewhere, for example on Netlify. You're then asked:

| Question | Notes |
| --- | --- |
| Site URL(s) | Comma-separated `https://` origins with no path or trailing slash. The **first** one is your staff site. |

## 4. HTTPS

On a hosted platform, HTTPS is always automatic and you're only asked for the **HTTPS certificate
email**. Otherwise:

```text
1) None - plain HTTP for a LAN or trial.
2) Automatic HTTPS - built-in Caddy; point DNS at this server.
3) I already run a reverse proxy - forward HTTPS to this server.
```

The default is **1**, or **2** if you chose API only. API-only installs can't use plain HTTP, because
browsers only send login cookies across sites over HTTPS.

| Follow-up | When | Notes |
| --- | --- | --- |
| Public API/server domain | HTTPS 2 or 3 | A DNS name such as `tools.example.org`, without `https://`. |
| HTTPS certificate email | HTTPS 2, or a hosted platform | The address Let's Encrypt uses for certificate notices. |

See [Domains and TLS](/install/domains-and-tls/) for what each mode sets up.

## 5. How it runs

| Option | What runs |
| --- | --- |
| `1` Standard containers (default) | Separate API, live-updates, worker, scheduler and web server containers. |
| `2` Single box | One application container beside the database and storage. |

Single box only works with the website on this server, plain HTTP and one or several makerspaces
(not a hosted platform), and not with `setup.sh --build`. If you pick an incompatible combination
you're asked again. See [Single-box install](/install/single-box/).

## 6. File storage

| Option | Notes |
| --- | --- |
| `1` Bundled Silo object storage (default) | Private evidence and public images on this server. Nothing more to answer. |
| `2` External S3-compatible buckets | You create the buckets, versioning, privacy and CORS yourself. |

External storage asks:

| Question | Default | Notes |
| --- | --- | --- |
| S3 endpoint | required | Must be reachable by browsers too. Must be `https://` unless you chose plain HTTP. |
| S3 region | `us-east-1` | |
| Private evidence bucket | `evidence` | |
| Public-image bucket | `public-images` | Must be a different bucket from the evidence one. |
| S3 access key | required | |
| S3 secret key | required | Typed without echo. |
| Public image base URL | required | Includes the bucket or path, for example `https://files.example.org/public-images`. |
| Presign method | `post` | `post` or `put`. Use `put` for Cloudflare R2 and Supabase Storage. |

## 7. Your makerspace

| Question | Default | Notes |
| --- | --- | --- |
| Web address | `localhost` | Asked only for plain HTTP, where no domain was given. A host name or IPv4 address, no `http://`. Use the address people on your network will type, such as `192.168.1.20`; `localhost` only works on the server itself. |
| Name of your makerspace | `My Makerspace` | Its URL slug is derived from the name (lower-case letters, digits and hyphens, up to 50 characters). |
| First makerspace subdomain | `makerspace` | Hosted platform only. Reserved names such as `www`, `api`, `admin`, `control`, `files` and `origin` are refused. |

## 8. Feature areas

Next come eight yes/no **areas**. Each area switches on a bundle of modules and every feature those
modules support, then asks a few follow-up questions straight away.

| Area | Default | Turns on these modules |
| --- | --- | --- |
| Inventory & lending | **Yes** | `public_inventory`, `request_workflow`, `staff_admin`, `scanner`, `evidence_uploads`, `qr_management`, `guest_handover`, `asset_units`, `containers`, `bulk_import`, `stock_transfers`, `qr_print_batches`, `procurement`, `stocktake`, `devices` |
| Machines | **Yes** | `machines`, `machine_service`, `printing`, `maintenance` |
| Events | No | `events` |
| Bookings | No | `bookings` |
| Membership | No | `membership`, `mobile` |
| Online payments | No | `payments` |
| Reports | **Yes** | `reports` |
| Chat alerts | No | `telegram`, `slack`, `mattermost`, `discord`, `webhook` |

**Always on**, whatever you answer: the core modules, personal accounts (sign-up and the member area),
backup, notifications, email, money tracking, receipt documents, payment reminders, staff
invitations and the advisory geofence.

The core lending modules are always installed. Saying **no** to Inventory & lending only hides
lending: no new loans can be made. Charges and receipts work without Online payments, which only
adds card checkout. [Modules](/guides/modules/) explains each module.

### Inventory & lending

| Question | Default | Range or options |
| --- | --- | --- |
| Maximum active loans per borrower | `0` | `0` means unlimited |
| Maximum outstanding items per borrower | `0` | `0` means unlimited |
| Default loan length (days) | `7` | 1–365 |
| Maximum renewals per loan | `1` | 0–100 |
| Length of each renewal (days) | `7` | 1–365 |
| Enable self-checkout? | Yes | Signed-in borrowers issue eligible QR tools themselves, with photo evidence |
| Enable kiosk stations? | Yes | Shared stations unlocked by a PIN and a staff operator |
| Loan deposit mode | `none` | `none`, `fixed`, `per_product` |
| Fixed deposit per loan | `0.00` | Only with `fixed` |
| Late fee per day | `0.00` | |
| Late fee cap | `0.00` | `0` means uncapped |
| Late fee grace period (days) | `0` | |
| Require deposit settlement before issuing? | No | Only when a deposit mode is set |
| Default currency for charges | `usd` | Three lower-case letters |
| Borrow requests (Membership off) | `accounts` | `accounts` (signed-in accounts) or `anyone` (no account, rate-limited contact details) |

If you also turn on Membership, borrow requests are limited to active members.

### Machines

| Question | Default | Notes |
| --- | --- | --- |
| Enforce machine certification gating? | Yes | Members can't use a machine type until certified for it |
| Certification expiry reminder lead (days) | `14` | 0–365; `0` turns off advance notice |
| Maintenance reminder lead (days) | `7` | 0–365; `0` turns off advance notice |

The reminder leads apply to the machine types that already exist. You can change them per type later.

### Events

| Question | Default | Options |
| --- | --- | --- |
| Default registration audience | `accounts` | `members`, `accounts`, `invite` |
| Default currency for ticket prices | `usd` | Asked only if no currency was asked earlier |

Ticket types and promo codes are turned on. Events priced at zero stay free.

### Bookings

No questions. Bookings and recurring bookings are turned on. Buffers and cancellation cut-offs are
set per bookable resource in the console.

### Membership

| Question | Default | Notes |
| --- | --- | --- |
| How people join | `approval` | `approval` (staff review), `vouch` (members vouch), `open`, `invite_only`, `closed` |
| Vouches required | `1` | Only with `vouch`; 1–5 |
| Minimum voucher tenure (days) | `30` | Only with `vouch` |
| Pending applicants per voucher | `3` | Only with `vouch` |
| Vouch validity (days) | `30` | Only with `vouch` |
| Do vouches replace staff approval? | No | Only with `vouch` |
| Collect a membership application form? | Yes | Adds a "Why would you like to join?" question you can edit later |
| Create the first membership plan? | No | |

If you create a plan:

| Question | Default | Notes |
| --- | --- | --- |
| Plan name | `Standard` | |
| Plan interval | `monthly` | `monthly`, `yearly`, `custom_days` |
| Custom interval length (days) | `30` | Only with `custom_days` |
| Plan amount | `0.00` | `0` for a free plan |
| Plan currency | `usd` | |
| Automatically renew memberships? | Yes | Records the next term's charge; no payment provider needed |
| Open renewal this many days before expiry | `7` | Only with auto-renew |
| Renewal grace period (days) | `0` | Only with auto-renew |
| Automatic renewal retries | `0` | 0–3 |
| Reminder days before expiry | `14,7,1` | Comma-separated, or `none` |
| Reminder days after expiry | `none` | Comma-separated, or `none` |

### Online payments, Reports and Chat alerts

- **Online payments** asks for the default checkout currency only if no currency was asked earlier.
  Debt tracking and receipts stay on without it.
- **Reports** has no questions; reports and saved report views are turned on.
- **Chat alerts** has no questions. Telegram, Slack, Mattermost, Discord and signed webhooks stay idle
  until you add their URL or token in settings. See [Notifications](/configure/notifications/).

## 9. Labels and defaults for everyone

| Question | Default | Notes |
| --- | --- | --- |
| Label this as an organization instead of a makerspace? | No | Changes wording only. Tenancy and permissions are the same. |
| Makerspace timezone for local schedules | `UTC` (or your `TZ`) | An IANA name such as `Asia/Kolkata` |
| Quiet hours start | `22:00` | Optional alerts wait until quiet hours end; safety messages are sent immediately |
| Quiet hours end | `08:00` | The same start and end time turns quiet hours off |
| Daily digests on by default? | No | Members can override this in their preferences |
| Daily digest delivery time | `08:00` | Only if digests are on |
| Require two-step sign-in (MFA) for staff? | No | Staff with any actions must enrol an authenticator app |

### Edition

You aren't asked for an edition; it's worked out from your areas and shown in the summary:

| Your answers | Edition |
| --- | --- |
| Organization label is on | `organization` |
| Events is the only one of Inventory, Machines, Events and Bookings | `events` |
| Bookings is the only one of those four | `bookings` |
| Anything else | `makerspace` |

## 10. Admin account

| Question | Default | Notes |
| --- | --- | --- |
| Admin login username | `admin` | Letters, digits and `. @ + - _` |
| Admin email | required | |
| Admin password | auto-generate | Typed without echo. Leave it blank and a strong password is generated and printed once at the end. |

This account becomes the **superadmin**: it controls the whole server, not just one makerspace.

## 11. Optional integrations

| Question | When | Notes |
| --- | --- | --- |
| Google Web client ID | Always (skippable) | Ends in `.apps.googleusercontent.com`. The installer prints the authorised JavaScript origin to register with Google. |
| Stripe secret key | Online payments on | Optional. Enter both Stripe values or neither. |
| Stripe webhook secret | Online payments on | |

You can add any of these later. See [Authentication](/configure/authentication/) and
[Payments](/configure/payments/).

## 12. Automatic deploys

| Question | Default | Notes |
| --- | --- | --- |
| Install a GitHub Actions runner on this server for automatic deploys? | No | Only offered on Linux with systemd running. If you say yes, after you confirm the summary you're asked for a short-lived registration token from GitHub. |

See [Updates](/install/updates/#automatic-deploys-with-a-github-actions-runner) before you turn this on.

## What your answers write

Setup turns your answers into a private `.env` file (mode 600) in the install directory and
generates every secret itself: database passwords, storage keys, `SECRET_KEY`, the encryption keys
and the backup keys. The values that follow directly from your answers include:

| Setting | Comes from |
| --- | --- |
| `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `PUBLIC_APP_BASE_URL` | Web address or domain, and any external site URLs |
| `ENABLE_HTTPS`, `TRUST_X_FORWARDED_PROTO`, `HTTP_PORT`, `TRUSTED_PROXY_COUNT` | HTTPS mode |
| `PUBLIC_DOMAIN`, `TLS_EMAIL` | HTTPS domain and certificate email |
| `PLATFORM_DOMAIN`, `PLATFORM_DOMAIN_SUFFIX`, `PLATFORM_STAFF_ORIGINS` and related | Hosted platform |
| `SPACEWORKS_RUN_FRONTEND`, `SPACEWORKS_STORAGE`, `SPACEWORKS_EDITION`, `SPACEWORKS_HOSTING_MODEL` | Website, storage and area choices |
| `AWS_S3_*`, `AWS_STORAGE_BUCKET_NAME`, `PUBLIC_IMAGE_BUCKET`, `PUBLIC_IMAGE_BASE_URL`, `STORAGE_PRESIGN_METHOD` | Storage answers |
| `SPACEWORKS_REPOSITORY` and the image names | GitHub repository |

The container shape (`none`, `tls`, `saas` or `single`) is saved in `.spaceworks-layer`. Your area
choices and their settings are applied to the first makerspace through the app itself, and every
change is recorded in the audit log. Production installs never load demo data.

[Environment variables](/configure/environment-variables/) describes every setting.

## Changing your answers later

- **Areas and their settings:** run `bash scripts/update.sh --modules-only` from the install
  directory for the same area menu, or change settings in the staff console. Turning an area off hides
  its screens and **keeps all its data**.
- **Admin, integrations and notifications:** change them in the staff console.
- **Hosting, HTTPS and storage:** these live in `.env` and `.spaceworks-layer`. See
  [Domains and TLS](/install/domains-and-tls/#changing-your-address-later).

## Next steps

- [First run](/install/first-run/)
- [Docker Compose stack](/install/docker-compose/)
