---
title: FAQ
description: Short answers to the questions people ask most about running, hosting and extending Space Works.
sidebar:
  order: 1
---

Short answers to common questions, with links to the pages that cover each topic in depth. If
something is broken rather than unclear, start with [Troubleshooting](/help/troubleshooting/).

Commands on this page run on the server, from the install directory (`/opt/spaceworks` unless you
chose another), as the user who owns the install. Production installs run every Compose command
through the `scripts/spaceworks-compose.sh` wrapper rather than plain `docker compose`.

## General

### What is Space Works?

Space Works is an open-source, self-hosted manager for makerspaces. It covers inventory and tool
lending, machines and 3D printing, events, bookings, membership and reports. Every tool handover
leaves evidence behind: QR scans, photos, remarks and an append-only audit log. One install can host
many makerspaces, each kept separate from the others. Read the
[Introduction](/get-started/introduction/) for the full tour.

### How much does it cost?

The software is free. You pay for whatever you run it on: your own server, a VPS, or a spare machine
at your space. Optional services such as an SMTP provider, external S3 storage or a payment gateway
cost whatever their providers charge.

### What license is it under?

The GNU Affero General Public License v3 or later (`AGPL-3.0-or-later`). The full text is in the
repository's
[`LICENSE`](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/LICENSE) file.

### Can I use it commercially? What does the AGPL ask of me?

Yes. The AGPL lets you use, study, share and modify Space Works for any purpose, commercial or not.
It is a network copyleft license: if you run a **modified** version and let people use it over a
network, you must offer those users the source code of your modified version under the same
license. Running an unmodified release carries no such duty. This is a summary, not legal advice, so
read the license itself if your situation is unusual.

### Who builds it?

Space Works started in the TinkerSpace Kochi community and is developed in the open on
[GitHub](https://github.com/SpaceWorks-HQ/SpaceWorks) by its contributors. No contributor license
agreement is required.

### Is there a hosted version?

The project is built for self-hosting, and the documentation covers running it yourself. Because
Space Works is multi-tenant, a makerspace without a server can also run as a tenant on another
makerspace's install. The code also has a managed, multi-tenant platform mode with tenant subdomains,
switched on with `PLATFORM_DOMAIN_SUFFIX`, so you can run a hosted service for other spaces yourself.
See [Cloud deployment](/install/cloud/).

### How are releases numbered?

Every merge to `main` publishes a release. The `VERSION` file sets the series (currently `0.9.2`),
and each build is tagged `X.Y.Z-main.<run>.<12-character commit>`. Your server pins that exact tag,
which it records in `.spaceworks-version`. See [Releases](/develop/releases/).

## Install and hosting

### What's the minimum server?

A 64-bit x86_64 machine (arm64 works only if you build the images yourself, see below) with at least **8 GiB of free disk**. The installer checks the
disk space and refuses to continue without it. The project doesn't publish a RAM or CPU minimum. On
a small machine, consider the [single-box install](/install/single-box/). The full list is on
[Requirements](/install/requirements/).

### Can I run it on Windows or macOS?

Yes, with Docker Desktop installed and running. On macOS you run the installer in a terminal. On
Windows, installs, updates and module changes work in Git Bash or WSL. In-place restore, backup
import and other host recovery operations need **WSL2**, because they rely on Linux file locking and
permissions. The PowerShell entry points (`setup.ps1`, `scripts/update.ps1`) refuse to run and send
you to bash instead.

### Do I need a domain name?

No. The installer's default is plain HTTP for a local network or a trial, using the server's host
name or IP address. You need a domain for automatic HTTPS, which in turn is required for staff login
on a custom domain and for hosting the website separately from the API. See
[Domains and TLS](/install/domains-and-tls/).

### Can I run it on a Raspberry Pi or another ARM server?

The installer accepts 64-bit ARM (`aarch64`/`arm64`) and refuses 32-bit systems. However, the
release workflow builds its images on a standard x86_64 runner and doesn't declare an arm64 platform,
so the published images may not pull on an ARM machine. If they don't, build from source on the
device with `bash setup.sh --build`. See [Local development](/develop/local-development/) for what
a source build needs.

### Can I put it behind my own reverse proxy?

Yes. Choose **existing reverse proxy** when the installer asks about HTTPS. Space Works then listens
on `127.0.0.1:8080`. Forward your public domain there and preserve the `Host` header, the client
forwarding headers and `X-Forwarded-Proto: https`. With bundled storage, also forward
`files.<your-domain>` to `127.0.0.1:9000` and raise your proxy's upload size limit for evidence
photos. See [Domains and TLS](/install/domains-and-tls/).

### Can one install host several makerspaces?

Yes. The installer's first question is the hosting model: one makerspace, several makerspaces at
`/m/<slug>`, or a platform with a subdomain per makerspace. A superadmin adds more spaces later from
**Users → Create makerspace** in the staff console. Each makerspace has its own inventory, staff,
roles, QR namespace, notification channels and audit scope. See
[Concepts](/get-started/concepts/).

### What is the single-box install?

It runs nginx, the web app, the API, the live-update stream, a Celery worker, the scheduler and Redis
in **one container**, alongside PostgreSQL and object storage. It's the same code, with fewer things
to operate. It serves a local website over HTTP. For HTTPS, API-only or a hosted platform, choose
the standard containers. See [Single box](/install/single-box/).

### Can I host the website on Netlify and the API on my server?

Yes. Answer **No, API only** to the website question and enter your HTTPS site address. Both sides
must use HTTPS. See [Cloud deployment](/install/cloud/).

### Can I use my own S3 storage instead of the bundled one?

Yes. Choose **External S3-compatible buckets** in the installer. You need a private bucket for
evidence and documents and a separate public bucket for catalogue images. You set up CORS and
versioning in your provider's dashboard, because the installer never changes remote bucket policies.
See [Object storage](/configure/object-storage/).

### Why can't I open `/control/` in my browser?

The Django control plane at `/control/` is for superadmins only and is deliberately not served on
the public port. Reach it through a private connection to the backend. Day-to-day staff work happens
in the React staff console at `/admin`. See [Security](/configure/security/).

## Data and privacy

### Where are photos stored?

In S3-compatible object storage. By default that's the bundled Silo container (the maintained fork
of the archived MinIO), with its data in the `minio_data` Docker volume. Evidence photos and print
files go in a **private** bucket (`evidence` by default). Catalogue item photos and makerspace
logos go in a separate **public-read** bucket (`public-images` by default). The two must have
different names. Space Works refuses to start if they collide.

### Are evidence photos public?

No. Evidence lives in the private bucket and is only shown through short-lived signed URLs. Those
URLs are issued to staff who hold the evidence permission in that makerspace, and every view is
written to the audit log. The public catalogue never exposes evidence photos, storage locations, box
IDs, QR codes, scan history or borrower history.

### How long are photos kept?

Until you turn on retention. Evidence object expiry is off by default
(`EVIDENCE_OBJECT_EXPIRY_ENABLED=False`). When it's on, photo files are deleted after the retention
window: 365 days by default, and a makerspace can choose 30 to 3650 days. The photo's record,
remarks, scans and audit history are kept, so an expired photo reads as "expired" rather than
missing. See [Evidence retention](/configure/evidence-retention/).

### Can I export my data?

Yes, in several ways:

- **Reports**: Reports and the ledger export to CSV or XLSX.
- **Whole makerspace**: a superadmin can create a data export of a makerspace from the staff
  console.
- **Moving servers**: a superadmin can export one makerspace into an encrypted archive and import
  it on another Space Works deployment.
- **Members**: members can download their own data. This needs the Membership area, member accounts
  and the member self-export feature turned on for that makerspace.

See [Backup and restore](/install/backup-restore/) and [Reports](/guides/reports/).

### How do I delete a makerspace?

In two deliberate steps. First the makerspace is archived: a Space Manager requests it and a
superadmin confirms it. Archived spaces disappear everywhere except `/control/`. Purging the archived
space then permanently deletes its records and uploaded files. Purging is a superadmin-only action in
`/control/` and **cannot be undone**, so take a backup first.

### How do I handle a GDPR-style request?

Members can download their own data with the self-export feature, and can leave a makerspace from
their account. Be aware that Space Works is built for accountability. Audit logs are append-only, and
the records of attached evidence and QR scans are immutable. There is no one-click erasure for one
person's history, so decide how your space answers erasure requests and keep that policy in mind when
you enable [evidence retention](/configure/evidence-retention/).

### Is personal data encrypted?

Integration secrets such as SMTP passwords, Telegram bot tokens, webhook URLs and API-client secrets
are always encrypted at rest with `API_CLIENT_ENC_KEY`. Back that key up, because without it those
secrets can't be decrypted. Scoped encryption of personal data is also available. It is off by
default, and enabling it is a staged operation. See [Security](/configure/security/).

### What happens to my data if I turn a module off?

Nothing is deleted. Turning a module or area off hides its screens and stops new activity, and
turning it back on brings everything back. Deleting a module's rows is a separate,
superadmin-only command (`purge_module_data`). It only works on a module that is already off, and it
cannot be undone. See [Modules](/guides/modules/).

## Features

### Can members check tools out themselves?

Yes, when self-checkout is on for the makerspace (the `inventory.self_checkout` feature). Members
sign in, scan an eligible QR-tracked tool and upload a photo as evidence. Returns need a photo and a
remark, just like staff returns. See [Loans](/guides/loans/).

### Can people borrow without an account?

There are a few options:

- **Walk-ins**: front-desk staff can create a walk-in person record (a name, optionally an email and
  phone) with no password, and issue tools to them.
- **Account-less requests**: a makerspace can accept borrow requests from anyone, with no account
  needed. Set this during setup or later with
  `manage.py set_request_access --mode anyone`. Turning on member accounts switches account-less
  requests back off.
- **Your own sign-in**: with member accounts turned off, people can still sign in through your own
  OIDC identity provider.

See [Membership](/guides/membership/) and [Authentication](/configure/authentication/).

### Can I charge money without Stripe or Razorpay?

Yes. Charges are recorded whether or not an online payment gateway is set up. You mark a charge as
paid offline with a settlement receipt that records the method, a reference and the date received.
The `payments` module only adds online card payments. See [Payments](/configure/payments/).

### Can staff accept or reject requests from Telegram?

No. Telegram, Slack, Mattermost and Discord alerts are **outbound only**, and no message carries
accept or reject buttons. Decisions are made in the staff console or `/control/`, so every one goes
through the same workflow and audit trail. See [Notifications](/configure/notifications/).

### Which notification channels are supported?

Email, Telegram, Slack, Mattermost, Discord and signed JSON webhooks. Each is its own module, so you
only switch on the ones you use. A per-feature and per-channel matrix decides which events go where.
See [Notifications](/configure/notifications/) and [Webhooks](/api/webhooks/).

### Can I run it just for events, or just for bookings?

Yes. Choose only the areas you need during setup. The installer derives an **edition** from them
(`SPACEWORKS_EDITION`: `makerspace`, `events`, `bookings` or `organization`), which hides the public
surfaces you don't use. Turning areas off never deletes data. See
[Modules](/guides/modules/) and [Setup questions](/install/setup-questions/).

### Is the interface available in other languages?

Not yet. The interface is in English and has no language switcher. Translation contributions are
welcome. See [Contributing](/develop/contributing/).

### Is there a mobile app?

There is no native app in the repository. The member area is a Progressive Web App that members can
install from their browser ("Add to Home Screen" on iPhone), and it can keep a member card and loans
readable offline. The optional `mobile` module provides the server side for native clients:
attested device sessions, push notifications and an in-app payment sheet. See
[Devices](/api/devices/).

### Does the staff console update live?

Yes. Queues, loans and check-ins update as soon as a change is saved, through Server-Sent Events
over the deployment's Redis. Without Redis, the console falls back to polling and still works.

## Accounts and roles

### I forgot the superadmin password. How do I get back in?

If email is configured, use the **Forgot password?** link on the sign-in page. Otherwise, reset it
from the server with Django's built-in `changepassword` command. It prompts you for the new password
twice:

```bash title="On the server, in the install directory"
scripts/spaceworks-compose.sh bundled run --rm --no-deps backend --role management \
  python manage.py changepassword <username>
```

If you don't remember the username: the installer used the admin username you entered, and a manual
`setup_instance` with no `--username` creates `superadmin`. To reset another staff member's
password, use **Reset password** in the staff console's Users panel. It generates a temporary
password the person must change at their next sign-in.

### I lost my authenticator app.

Two-factor sign-in (TOTP) is mandatory for superadmins, and you received ten one-time recovery codes
when you enrolled. Use one of them at the sign-in prompt, then enroll a new authenticator. The
host-side `recover_superadmin` command is a break-glass tool for a deployment in recovery quarantine
after a restore, not a general lockout fix. It refuses to run on a normal deployment.

### Someone is locked out after too many failed logins.

After `AXES_FAILURE_LIMIT` failed attempts (5 by default) for the same username from the same IP
address, that combination is locked for one hour. If everyone keeps getting locked out at once, the
server probably can't see real client IPs. See
[Troubleshooting](/help/troubleshooting/#too-many-requests-429-and-lockouts).

### How do I add staff?

From the Users panel in the staff console, invite an email address to a role. The invitation gives
you a link you can copy and send yourself, even if email isn't set up. You can only grant actions you
hold yourself. See [Roles and permissions](/guides/roles-and-permissions/).

### Can I create my own roles?

Yes. Every makerspace starts with four protected roles: **Space Manager**, **Inventory Manager**,
**Machine Manager** and **Member**. A Space Manager can rename and narrow these and create custom
roles from any actions they hold. Permissions are based on actions, not role names. See
[Roles and permissions](/guides/roles-and-permissions/).

### Where did the Guest Admin role go?

It was retired. Front-desk handover is now a **custom role** you create with the handout actions
(`view_inventory`, `assign_box`, `issue_request`, `issue_direct_loan`, `return_request`,
`upload_evidence`, and `collect_service_request` for machine jobs). Existing Guest Admin roles were
converted in place and kept their name, actions and people. The old Print Manager role was folded
into Machine Manager the same way.

## Updates and backups

### How do I update?

Run the updater as the install owner:

```bash title="On the server, in the install directory"
bash scripts/update.sh --force
```

You can also run the original one-line install command again and pick **Update to the latest
release** from the menu. The updater backs up the database, pulls the new pinned images, runs
migrations and waits until the app is healthy. See [Updates](/install/updates/).

### Can updates happen automatically?

Yes, on a Linux server with systemd. You install a GitHub Actions runner on the server
(`bash scripts/install-runner.sh`) and set the `SPACEWORKS_DEPLOY=true` repository variable. Each new
release then deploys itself. Read the runner security settings on [Updates](/install/updates/) before
you turn this on.

### What happens if an update fails? How do I roll back?

If the new release doesn't become healthy, the updater automatically starts the previous application
images again. Database migrations that already ran stay applied. The database backup taken just
before the update is kept in `backups/pre-update-<timestamp>.sql.gz`, but it is **never** restored
automatically. Restoring it is a manual recovery step. See
[Backup and restore](/install/backup-restore/).

### How do I back up?

Back up three things: the PostgreSQL database, the object-storage volume (`minio_data`) and your
`.env` file. The `.env` holds `API_CLIENT_ENC_KEY` and the storage credentials, and without it the
other backups are much less useful. The built-in `backup` module also creates signed, encrypted
makerspace archives from the staff console. See [Backup and restore](/install/backup-restore/).

### Do update backups include photos?

No. The automatic pre-update dumps contain database rows only. They're kept for 14 days. Back up
object storage separately.

## Development

### What is Space Works built with?

Django 6 and Django REST Framework, React 19 with Vite, TypeScript, Tailwind CSS 4 and TanStack
Query, PostgreSQL 16, Celery with Redis, and S3-compatible object storage. It ships as published
Docker images. See [Architecture](/develop/architecture/).

### How can I contribute?

Fork the repository, work on a branch from `dev` and open a pull request. By opening one, you agree
your contribution is offered under the project's AGPL license; there is no CLA. Code, docs,
translations and bug reports from running it at your space all help. See
[Contributing](/develop/contributing/).

### Is there an API?

Yes. Every endpoint is documented with OpenAPI. Your install serves Swagger UI at `/docs/`, ReDoc at
`/redoc/` and the schema at `/schema/`. Outside integrations use HMAC-signed API clients that a
superadmin issues. See the [API overview](/api/overview/) and [API clients](/api/api-clients/).

### How do I report a security vulnerability?

Privately, by following the
[security policy](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/.github/SECURITY.md). Don't
open a public issue for a vulnerability.

## Related

- [Troubleshooting](/help/troubleshooting/)
- [Requirements](/install/requirements/)
- [Environment variables](/configure/environment-variables/)
- [Glossary](/get-started/glossary/)
