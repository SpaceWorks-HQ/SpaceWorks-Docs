---
title: First run
description: After installing SpaceWorks, sign in as the superadmin, check the server is healthy, send test alerts and get your first makerspace ready.
sidebar:
  order: 8
---

When the installer finishes, SpaceWorks is running with your superadmin account and your first
makerspace already created. This page walks you through checking that everything works.

## What the installer printed

At the end of setup you'll see something like:

```text
All done!
  Website: http://192.168.1.20 (admin: admin)
  API: http://192.168.1.20/api
  Control plane: /control/ on the backend only, through a private connection.
  Generated admin password: ...   (save this now)
```

The generated password line only appears if you left the password blank, and it's shown **only
once**. Store it in a password manager before you close the terminal.

## Sign in to the staff console

Open the website address followed by `/admin`, for example `http://192.168.1.20/admin` or
`https://tools.example.org/admin`, and sign in with the admin username and password.

| Address | What it is |
| --- | --- |
| `/` and `/m/<slug>` | The public site and your makerspace's public page |
| `/admin` | The **staff console**, where staff and the superadmin do day-to-day work |
| `/docs/` | Interactive API documentation |
| `/control/` | The superadmin **control plane**. Not reachable from the website, see below. |

The account you created is the **superadmin**. It can see and manage every makerspace on the
server, so keep it for administration and give day-to-day staff their own accounts.

### Two-step sign-in

Superadmins must use two-step sign-in. When you first sign in, SpaceWorks asks you to set up an
authenticator app. It then shows ten one-time **recovery codes**, only once. Save them somewhere
separate from your password.

If you lose the authenticator, someone with access to the server can reset it. The next sign-in then
asks you to enrol again:

```bash title="In /opt/spaceworks"
scripts/spaceworks-compose.sh bundled run --rm --no-deps backend --role management \
  python manage.py recover_superadmin admin --reset-mfa
```

`recover_superadmin` also sets a new password for that account: the one you pass with `--password`,
or a generated one that it prints once.

## Check the server is healthy

From the server:

```bash title="In /opt/spaceworks"
scripts/spaceworks-compose.sh bundled ps -a
```

The long-running services (`db`, `redis`, `backend`, `live`, `worker`, `beat`, `frontend`, and
`minio`/`caddy` when used, or `app` on a single box) should be `Up` and, where they have a health
check, `healthy`. The run-once jobs `orchestration-init`, `migrate`, `orchestration-ready` and
`createbuckets` should show `Exited (0)`. That's normal.

The API has two health endpoints you can use from anywhere, for example in an uptime monitor:

```bash
curl -fsS http://192.168.1.20/api/v1/health/
curl -fsS http://192.168.1.20/api/v1/health/readiness/
```

`/api/v1/health/` returns `{"status": "ok"}` while the API is up and its database reachable.
`/readiness/` returns `{"status": "ready", ...}` only when the host state, database, migrations and
encryption keys all check out, and `503` with a reason otherwise. The containers' own health checks
use it. Superadmins also get a
**Platform dashboard** in the staff console (**Admin** group). See [Monitoring](/configure/monitoring/)
for metrics and error tracking.

If something isn't healthy, start with the logs:

```bash
scripts/spaceworks-compose.sh bundled logs --tail 100 backend
scripts/spaceworks-compose.sh bundled logs orchestration-init migrate orchestration-ready
```

## Your first makerspace

Setup created the makerspace you named and applied the areas you picked. Its public page is at
`/m/<slug>`, where the slug comes from the name (for example `/m/my-makerspace`). On a hosted
platform it lives on its own subdomain instead.

To add more makerspaces later, as the superadmin open **Admin → Users** in the staff console and
choose **Create makerspace**.

## The control plane at `/control/`

`/control/` is the Django control plane: superadmin-only screens for low-level administration such
as fair-use overrides, failed-delivery re-queues and offsite backup destinations. Normal operation
never needs it; everything day to day happens in the staff console.

It's deliberately **not** proxied by the website or Caddy, so makerspace staff can never reach it
from the internet. To use it you need a private connection straight to the backend container on
port 8000, for example through an SSH tunnel to the server. Only active superadmins can sign in, and
two-step verification is required before the control plane opens.

## Send test alerts

SpaceWorks works without email, but you'll want it for password resets and notifications.

1. **Set up SMTP.** As the superadmin, open **Admin → Platform settings → Platform email** and enter
   your SMTP host, port, username, password and sender address. This is used whenever a makerspace
   has no SMTP of its own. See [Email](/configure/email/).
2. **Send a test email.** Open **Admin → Delivery logs**, leave **Test target** on
   **Email to my account**, and choose **Send test**. Refresh the log to see whether it was sent or
   why it failed.
3. **Telegram (optional).** With the Chat alerts area on, open **Admin → API access**, enter the
   Telegram group chat ID and bot token under **Integration settings**, save, and choose
   **Send Telegram test alert**. Other chat rooms (Slack, Mattermost, Discord, webhooks) can be tested
   from **Delivery logs** by picking them as the test target. See
   [Notifications](/configure/notifications/).

## Turn on backups

Nightly backups are **off** until you turn them on. As the superadmin, open
**Admin → Backup & restore** and tick **Create a full deployment archive each day**. Then follow
[Backup and restore](/install/backup-restore/) to copy the backup key and archives off the server.

## Creating the superadmin by hand

If you assembled the stack yourself rather than with the installer, create the superadmin and first
makerspace with `setup_instance`:

```bash title="In the install directory"
scripts/spaceworks-compose.sh bundled run --rm --no-deps backend --role management \
  python manage.py setup_instance \
  --username admin \
  --email admin@example.org \
  --password 'change-me-to-a-strong-password' \
  --makerspace-name 'My Makerspace'
```

The command is safe to run again: it creates whatever is missing and leaves existing records alone.
Run it with no options and it creates a user called `superadmin` with a generated password, prints
the password once and makes you change it at first sign-in.

## Next steps

- [Set up your makerspace](/guides/makerspace-setup/): inventory, public visibility, staff and roles
- [Turn modules on or off](/guides/modules/)
- [Keep SpaceWorks updated](/install/updates/)
