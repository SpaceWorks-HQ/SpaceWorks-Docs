---
title: Email
description: Set up SMTP for SpaceWorks at the deployment, platform and makerspace level, understand background delivery and the email module, send a test message, and keep mail out of spam folders.
sidebar:
  order: 3
---

SpaceWorks sends two kinds of email:

- **Platform mail** belongs to the deployment rather than any makerspace: password reset codes and
  links, email verification and similar account messages.
- **Makerspace mail** belongs to one makerspace: request and handover alerts, booking and event
  messages, reminders, receipts and staff notifications.

Both go out over SMTP. Any SMTP provider works (your own mail server, Brevo, Postmark, Amazon SES,
Mailgun, Resend, Google Workspace relay and so on).

## Where SMTP is configured

There are three layers. The most specific one that is set wins.

| Layer | Who sets it | Where | Used for |
| --- | --- | --- | --- |
| Makerspace SMTP | Staff who manage the makerspace | Staff console → **Settings** → **Email (SMTP)** | That makerspace's own mail |
| Platform SMTP | Superadmin | Staff console → **Platform settings** → **Platform email** (also in `/control/`) | Platform mail, and makerspace mail when the makerspace has no SMTP of its own |
| Environment | Server operator | `EMAIL_*` variables | Everything, when neither of the above is set |

Platform mail **never** uses a makerspace's SMTP. Passwords entered in the console are encrypted with
`API_CLIENT_ENC_KEY` and are write-only: the form shows "SMTP password set" rather than the value.

### SMTP through environment variables

```bash title=".env"
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.org
EMAIL_PORT=587
EMAIL_HOST_USER=<smtp-user>
EMAIL_HOST_PASSWORD=<smtp-password>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=Example Makerspace <noreply@example.org>
```

:::caution[`EMAIL_BACKEND` decides whether anything is sent]
`EMAIL_BACKEND` is the delivery engine for **all three layers**, including SMTP you enter in the
console. With Django's default console backend, mail is only written to the logs. The bundled
Docker stack defaults it to the SMTP backend for you; on other hosts set it explicitly.
:::

See [Environment variables](/configure/environment-variables/#email) for every option and default.
After editing `.env`, apply it as described in [The `.env` file](/install/docker-compose/).

### SMTP in the console

The console forms take a host, port, user name, password, a from address, and **TLS** (STARTTLS,
usually port 587) or **SSL** (implicit TLS, usually port 465). If both are ticked, SSL is used.

To stop the console being used to reach internal machines, SMTP entered there must:

- be a bare host name (no scheme, port, path or `@`);
- resolve to a **public** address (private, loopback and similar ranges are refused);
- use port **25, 465, 587 or 2525**.

If your mail server is on your private network, configure it through the `EMAIL_*` environment
variables instead.

## When email counts as "configured"

The **Forgot password?** link appears on the sign-in screen only when SpaceWorks can really send
mail: `EMAIL_BACKEND` is the SMTP backend **and** either platform SMTP or `EMAIL_HOST` is set. If
you skip email entirely, leave all of it unset so the link stays hidden rather than promising mail
that never arrives.

Also set `PUBLIC_APP_BASE_URL` to your website origin. Links in email are built from it; without it,
reset and invitation links are bare paths that cannot be clicked.

## Background delivery

When a Celery broker is configured (the bundled stack always has one), makerspace mail is written to
a delivery log, then sent by the `worker` container after the database transaction commits. A slow or
failing SMTP server never slows down or breaks the action that triggered the email. Password reset
mail is sent straight away.

Without a broker, mail is sent inline in the request instead. On hosts that run no worker (the cloud
profile), the scheduler also runs `manage.py flush_email_outbox` to retry stuck mail.

Every message is recorded with a status: pending, sending, sent, failed or skipped. Staff with
makerspace-management rights see them under **Admin → Delivery logs** and can retry a failed row.
The log screen shows outcomes, never message bodies, addresses or credentials. Sent and skipped rows are kept for 90 days,
failed rows for 365 days.

## The `email` module

Each makerspace has an **Email** module that switches its makerspace mail on or off. When it is off,
messages are recorded as **skipped** rather than sent, so you can still see what was suppressed.

These messages are sent even when the module is off, because people depend on them:

- password reset;
- email verification;
- overdue return reminders;
- backup custody alarms.

Platform mail is never affected by the module. Turning the module on does not make an unconfigured
makerspace start sending either; you still need working SMTP at one of the three layers, and the
relevant cells ticked in the notification matrix (see [Notifications](/configure/notifications/)).

## Send a test email

- **From the console:** **Admin → Delivery logs → Send test** sends a message to your own account's
  address through the makerspace's mail path, then shows the result in the log.
- **From the server**, to check the environment-level settings, use Django's built-in command:

```bash title="In the install directory"
scripts/spaceworks-compose.sh bundled run --rm --no-deps backend --role management \
  python manage.py sendtestemail you@example.org
```

If the test fails, read the delivery log status, then the `worker` logs
(`scripts/spaceworks-compose.sh bundled logs worker`). Error messages stored in the log are reduced
to the error type so they never leak credentials.

## Deliverability tips

- **Send from a domain you control.** Set `DEFAULT_FROM_EMAIL` and the console "From email" to an
  address on your own domain, and use the SMTP provider's verified sender.
- **Publish SPF, DKIM and DMARC** records for that domain, as your SMTP provider describes. Mail
  without them is likely to land in spam.
- **One-click unsubscribe.** Optional mail to members carries `List-Unsubscribe` and
  `List-Unsubscribe-Post` headers when the member preferences feature is on and
  `PUBLIC_APP_BASE_URL` uses HTTPS. Make sure your provider DKIM-signs those headers.
- **Suppress bad addresses.** Under **Delivery logs**, staff can add an address that hard-bounced or
  complained; SpaceWorks then stops all mail to it for that makerspace, including transactional mail.
  Superadmins have the same list for platform mail in `/control/`. Addresses are stored as keyed
  hashes, never in plain text.
- **Automate bounces (optional).** A provider or relay you control can report hard bounces and
  complaints to `POST /api/v1/integrations/makerspace/<id>/bounce-webhook`. Set a shared secret with
  `PATCH /api/v1/integrations/makerspace/<id>/timing-policy` (`bounce_secret`), then sign each call:
  `X-SpaceWorks-Timestamp` is the Unix time and `X-SpaceWorks-Signature` is the hex HMAC-SHA256 of
  `<timestamp>.<raw JSON body>` with that secret. The body is
  `{"event_id": "...", "address": "...", "reason": "bounce" | "complaint"}`; calls older than five
  minutes are refused.
- **Mind provider limits.** On hosting platforms, email is also subject to a daily fair-use limit
  per makerspace.

## Next steps

- [Notifications](/configure/notifications/): choose which events email whom
- [Authentication](/configure/authentication/): password reset depends on email
- [Monitoring](/configure/monitoring/): delivery failures in metrics and the platform dashboard
