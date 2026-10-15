---
title: Set up your makerspace
description: Configure a makerspace's name, public address, branding, catalogue visibility, modules, staff, alerts and loan defaults, with a checklist to work through.
sidebar:
  order: 1
---

This guide walks a Space Manager (or the platform superadmin) through turning a freshly created
makerspace into one your community can use. Everything here happens in the **staff console**; you do
not need a terminal unless a step says so.

If SpaceWorks is not installed yet, start with [the one-line install](/install/one-line-install/) and
[first run](/install/first-run/). The installer creates your first makerspace and its admin account.

## Where things live

A SpaceWorks deployment has three faces. Bookmark the ones you use.

| Surface | Address | Who uses it |
| --- | --- | --- |
| Public site | `/m/<slug>` (or `/` on a makerspace's own domain) | Your community: browse, borrow, book, register |
| Staff console | `/admin` (or `/m/<slug>/admin`) | Staff, with tabs shown according to their role |
| Control plane | `/control/` on the backend | The platform superadmin only; never exposed on the public website |

The staff console groups its tabs under **Operate**, **Inventory**, **Machines**, **Events**,
**Bookings**, **Members**, **Insights**, **Organizations** and **Admin**. You only see the tabs your
role allows and your installed modules provide, so two staff members can see quite different menus.

## Create another makerspace

One deployment can host many makerspaces, each with its own inventory, staff, public address and
settings. Only a superadmin can create one.

To create a makerspace:

1. In the staff console, open **Admin → Users** and choose **Create makerspace**.
2. **Identity**: enter the name, a four-character public code (letters and digits) and a slug. The
   slug becomes the public address `/m/<slug>`; the public code works as a short alternative
   identifier.
3. **Profile and hours** (optional): override the timezone, default currency and opening hours.
4. **Modules and pack** (optional): choose module families, or apply a saved space pack profile. Core
   modules are always installed and dependencies are added for you.
5. **First staff** (optional): enter an email and pick **Space Manager**, **Inventory Manager** or
   **Machine Manager** to invite the first staff member.
6. **Review**, then create the makerspace.

## Work through the setup checklist

A new makerspace's **Dashboard** shows a "Set up" checklist. Progress comes from your actual records,
so an item ticks itself off once you have done the work. The steps are:

| Step | Where you do it |
| --- | --- |
| Set the profile and location | **Admin → Settings** |
| Set opening hours | **Admin → Settings** (Location & hours) |
| Add your first item | **Inventory → Inventory** |
| Invite staff | **Admin → Users** |
| Choose modules | **Admin → Modules** (superadmin) |

Staff who lack access to a step see "ask an administrator" beside it. Dismissing the checklist is
remembered on that browser only.

## Name, slug and public address

Under **Admin → Settings → Branding**:

- **Registered name** is the official name of the makerspace. It is used across the app and as the
  public wordmark when there is no logo or public display name.
- **Public display name** overrides what visitors see, if you want something shorter or friendlier.

The slug in `/m/<slug>` is set when the makerspace is created. If you want the makerspace on its own
domain, use the **Custom domain** section of Settings; once a domain is set you can also hide the
makerspace from the central directory. DNS and certificates are an operator task, covered in
[Domains and TLS](/install/domains-and-tls/). On managed hosting, a **Request a subdomain** section
appears instead.

## Branding

Also under **Settings → Branding**:

- **Logo** and **Cover image (wide banner)** for the public site.
- **Public and member colours**: a primary fill colour and a link colour seed, applied to the public
  and member pages.

## Location and opening hours

The **Location & hours** section holds the makerspace's IANA timezone, address and weekly opening
hours (with exceptions). The timezone matters more than it looks: loan due dates, reminders, report
months and quiet hours are all calculated in the makerspace's local time.

## Public site and catalogue

Three switches decide what the public sees. All are in **Settings → General**.

| Setting | Effect |
| --- | --- |
| **Publish public site** | Controls directory visibility, embed keys and public machine pages |
| **Public home** | Which page `/m/<slug>` opens on: Automatic, Inventory, Events, Bookings, Machines or Membership. If the chosen area is switched off, an available one is used |
| **Show public inventory** | Shows or hides the public catalogue. Turning it off deletes nothing |

Further down Settings, **Public stats page** and **Public borrower names** control the optional
statistics page at `/m/<slug>/stats`. How much of each item's stock the public sees is set per item;
see [Inventory and QR codes](/guides/inventory-and-qr/#public-visibility).

## Modules and features

Modules are whole capabilities (events, bookings, machines and so on). Only a superadmin installs or
uninstalls them, from **Admin → Modules**. Uninstalling hides the surfaces and keeps every row of data.

Features are narrower switches inside a module, such as loan renewals, kiosk stations or event promo
codes. A Space Manager turns them on and off under **Settings → Feature settings**. A feature stays
inert while its parent module is off; the settings page says "Module disabled by the platform
administrator" in that case.

The [Modules guide](/guides/modules/) lists every module, what it adds and its default.

## Loan policy defaults

If your makerspace lends hardware, set its loan rules in **Settings → General → Loan policy**. Saving
this form for the first time also turns on the loan reminder schedule.

| Field | Default | Meaning |
| --- | --- | --- |
| Loan period in days | 7 | How long a loan runs when issued |
| Renewal mode | Off | **Automatic within policy** lets loans be renewed within the limits below |
| Maximum renewals | 1 | Renewals allowed per loan |
| Renewal length in days | 7 | How far each renewal extends the due date |
| Maximum active loans | 0 (unlimited) | Loans one borrower may hold at once |
| Maximum outstanding items | 0 (unlimited) | Items one borrower may hold at once |
| Reminder offsets in hours | `0` | Borrower reminders relative to the due time: negative is before, `0` is at due, positive is overdue. Empty turns reminders off |
| Escalate to staff after days overdue | 0 (off) | Alerts staff when a loan is this many days overdue |

Renewals and borrow limits also need the **Loan renewals** and **Borrow limits** features switched on.
Products and categories can override the loan period and renewal cap; see
[Loans](/guides/loans/#loan-length-renewals-and-limits).

Two more lending settings live elsewhere in Settings:

- **Borrow request access** chooses who may submit a borrow request: anyone with an account, or anyone
  without an account. While the Membership module is installed this is fixed to active members only.
- **Loan deposits and late fees** (deposit mode, deposit amount, late fee per day, late fee cap and
  grace days) sit with the payment settings. They are recorded as money owed even if you take no
  online payments.

## Invite your staff

You need the `manage_makerspace` action (Space Managers have it) to add staff.

To invite a staff member:

1. Open **Admin → Users**.
2. In **Staff invitations**, enter their email and choose a role.
3. Choose **Invite staff**. They receive a single-use link; you can also copy the invitation link,
   resend it or revoke it.

You can also create an account directly with a username and password, which is useful for a shared
front-desk login you hand out yourself. Pick roles with care: see
[Roles and permissions](/guides/roles-and-permissions/) for what each one can do and how to build a
narrow front-desk role.

:::tip
Turn on **Require MFA for staff** in Feature settings if you want everyone holding staff actions in
this makerspace to use an authenticator app.
:::

## Alerts: Telegram, chat and email

SpaceWorks sends alerts to your team; it never takes decisions from chat. Requests are always
accepted or rejected in the staff console.

- **Telegram**: a superadmin enters the **Telegram group chat ID** and **Telegram bot token** under
  **Admin → API access → Integration settings**. The token is stored encrypted and never shown again.
- **Slack, Mattermost and Discord**: paste incoming-webhook URLs under **Settings → Chat webhooks**.
- **Email**: enter your SMTP details under **Settings → Email (SMTP)**.
- **Who hears what**: under **Settings → Notification channels** you choose which alerts go to which
  channel, who receives each one, and extra "rooms" narrowed to a machine or category.

Each channel is also a module, so it must be installed for the makerspace. **Integration health** in
Settings shows whether email, Telegram and the background worker are working. For the deployment-side
setup see [Notifications](/configure/notifications/) and [Email](/configure/email/).

## Setup checklist

Use this list for a new makerspace:

- [ ] Registered name, logo and cover image set
- [ ] Timezone, address and opening hours set
- [ ] Modules match what your space actually does
- [ ] Features switched on for the parts you use (renewals, self-checkout, kiosk, and so on)
- [ ] Loan policy saved, and borrow request access chosen
- [ ] At least one inventory item added, with public visibility checked
- [ ] Staff invited with the narrowest role that fits each person
- [ ] Email configured, and Telegram or chat alerts if you want them
- [ ] Notification channels reviewed so the right people get each alert
- [ ] **Publish public site** and **Show public inventory** on when you are ready to go live

## Next steps

- [Modules](/guides/modules/)
- [Roles and permissions](/guides/roles-and-permissions/)
- [Inventory and QR codes](/guides/inventory-and-qr/)
- [Loans](/guides/loans/)
