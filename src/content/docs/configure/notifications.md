---
title: Notifications
description: Send Space Works alerts to email, Telegram, Slack, Mattermost, Discord, signed webhooks, the in-app inbox and mobile push, and choose which events go where and to whom.
sidebar:
  order: 5
---

Space Works tells people when something happens: a borrow request arrives, a booking is confirmed, a
machine needs maintenance, a payment is received. Each makerspace decides **which events** go to
**which channels** and **who** receives them. Chat credentials belong to the makerspace, are stored
encrypted with `API_CLIENT_ENC_KEY`, and are write-only once saved.

## Channels

| Channel | Module | What you configure |
| --- | --- | --- |
| In-app inbox | `notifications` | Nothing. Staff inboxes work once the module is on. |
| Email | `email` | SMTP, see [Email](/configure/email/). |
| Telegram | `telegram` | A bot token and a group chat ID. |
| Slack | `slack` | An incoming-webhook URL. |
| Mattermost | `mattermost` | An incoming-webhook URL. |
| Discord | `discord` | A channel webhook URL. |
| Signed webhook | `webhook` | An HTTPS endpoint of yours and a signing secret. See [Webhooks](/api/webhooks/). |
| Mobile push | the `mobile.push` feature | Platform push credentials (FCM and APNs) in `/control/`, plus the mobile apps. |

Each channel is its own module, so a makerspace that lives in Discord ships no Slack screens. Turning
a module on never makes a channel start sending by itself: you still add the credential and tick the
events you want. Turning it off stops delivery but **keeps** the stored credential, so turning it
back on needs no re-entry. To destroy a channel's stored secrets, purge the module's data (see
[Modules](/guides/modules/)).

## Telegram

Telegram is **outbound only**. Messages are posted to your group; there are no buttons, and accepting
or rejecting requests always happens in the staff console.

1. In Telegram, talk to **@BotFather**, create a bot and copy its token.
2. Add the bot to your staff group.
3. Find the group's chat ID (group IDs are negative numbers, for example `-1001234567890`). One way is
   to send a message in the group and read `chat.id` from
   `https://api.telegram.org/bot<your-token>/getUpdates`.
4. In the staff console, open **Admin → API access → Integration settings** and enter the
   **Telegram group chat ID** and **Telegram bot token**. Save.
5. Click **Send Telegram test alert**.

Each makerspace posts as one bot. To post to several groups, add **rooms** (below) and add the same
bot to each group; do not create a second bot.

A deployment-wide fallback bot can be set with `TELEGRAM_BOT_TOKEN`; it is used by makerspaces that
have no token of their own. In the bundled Docker stack this variable is not passed to the backend
by default (see [Environment variables](/configure/environment-variables/#telegram-and-chat)), so
prefer the per-makerspace token.

### The Telegram webhook

You do not need to register a webhook with Telegram. Older versions used one for request buttons;
the route `POST /api/v1/integrations/telegram/webhook` still exists so an already-registered webhook
does not error. It acknowledges every update and takes no action. It answers 403 unless
`TELEGRAM_WEBHOOK_SECRET` is set and Telegram sends the same value in its secret-token header. If you
registered a webhook in the past, you can remove it with Telegram's `deleteWebhook`.

## Slack, Mattermost and Discord

1. Create an incoming webhook in Slack or Mattermost, or a channel webhook in Discord, and copy its
   URL.
2. Make sure the matching module is on for the makerspace.
3. Paste the URL under **Admin → Settings → Chat webhooks**.

Long messages are trimmed to each service's limit (Telegram 4,096 characters, Discord 2,000,
Mattermost 16,383, Slack 40,000) rather than rejected.

## Rooms

A room is one destination: a Slack channel, a Discord channel, a Telegram group or a signed webhook.
Add rooms under **Admin → Settings → Notification channels → Rooms**.

- A room with no selection receives **everything** for its channel. Narrow a room to particular
  machines, machine types or inventory categories and it receives only those alerts.
- Telegram rooms take only a chat ID; they all use the makerspace's bot.
- A makerspace with no rooms keeps using the single webhook or chat ID above.
- Chat rooms only ever receive the **staff** wording of a message. Member-facing text goes to email,
  the member's inbox or their phone, never to a shared room.

## The event and channel matrix

**Admin → Settings → Notification channels** shows a grid: one row per feature, one column per
channel that the makerspace has turned on. Tick a cell to send that feature's events on that channel.
A channel whose module is off is hidden rather than shown disabled.

Default cells for a new makerspace:

| Feature | On by default |
| --- | --- |
| Hardware requests | Email, Telegram |
| Printing | Email |
| Bookings | Email, Telegram, Inbox |
| API access | Email, Telegram, Inbox |
| Events, maintenance, members, devices, payments, stock and procurement, certifications | Inbox only |

Slack, Mattermost, Discord, signed webhooks and mobile push are always opt-in. For payments, the
payer's own receipt email is sent unless you switch the payments email cell off.

## Who receives what

By default an alert goes to everyone whose role covers it, so a booking alert reaches whoever can
manage bookings. Under **Notification channels → Who gets notified** you can choose recipients per
event for **events, bookings, maintenance and members**:

| Recipient | Means |
| --- | --- |
| A role | Everyone currently holding that role |
| A named member | One person, who must belong to this makerspace |
| All members | The whole membership |
| The person it is about | The requester, booker or registrant |

Removing every recipient restores the role-based default; it never means "nobody". Recipients can be
narrowed by machine or category, and narrowing only ever reduces who is told. A person who switched
their own notifications off is never mailed, even when selected.

## Member inbox and preferences

Two makerspace features, both off by default:

- **Member inbox** (`notifications.member_inbox`) gives members a personal inbox for messages about
  their own requests, bookings and payments.
- **Member communication preferences** (`notifications.member_preferences`) lets members mute
  optional message families per channel. Safety mail (password reset, verification, overdue return
  reminders) always goes out.

## Reminders

| Reminder | How it runs |
| --- | --- |
| Overdue returns | The beat scheduler checks every hour. Without a scheduler, run `manage.py send_return_reminders` from cron every 15 to 60 minutes, or call the cron endpoint protected by `CRON_SECRET`. |
| Event and booking reminders | Lead times are set per makerspace. |
| Payment due and overdue | The **Payment reminders** feature (`billing.reminders`), see [Payments](/configure/payments/#due-dates-and-reminders). |
| Maintenance and certification expiry | The `maintenance.reminders` and `machines.certification_reminders` features. |

The shared reminder sweep runs every five minutes. Each makerspace also has a timing policy with quiet
hours (22:00 to 08:00 by default) and a daily digest time (08:00), readable and editable at
`/api/v1/integrations/makerspace/<id>/timing-policy`.

## Checking delivery

- **Admin → Delivery logs** lists every email and chat delivery with its status, lets you retry
  failures and send a test to yourself or to a selected room.
- **Admin → Settings → Integration health** reports each room: whether a credential is stored, when it
  last delivered, and its last error. A revoked webhook first shows up here.
- Rows for a channel whose module is off are recorded as **skipped**, not failed.

On hosting platforms, each channel also has a daily fair-use limit per makerspace.

## Related

- [Email](/configure/email/)
- [Webhooks](/api/webhooks/): the signed JSON format
- [Monitoring](/configure/monitoring/): delivery counts in metrics
