---
title: Modules
description: Every SpaceWorks module with its purpose, default and dependencies, plus setup areas, features, install versus purge, editions and space packs.
sidebar:
  order: 2
---

A makerspace only carries the parts it uses. SpaceWorks ships **34 modules**. Six are **core** and
always on, one (`backup`) is on by default, and the rest are opt-in. Modules are switched per
makerspace, so one deployment can run a tool library next door to an events-only space.

There are three levels of switch:

| Level | Who changes it | What it means |
| --- | --- | --- |
| **Core module** | Nobody | Always on. Handing hardware over needs a box QR scan **and** an issue photo, so the catalogue, request workflow, staff console, evidence, QR codes and scanner ship with every install |
| **Module** | Superadmin (console or command line) | A whole capability. Installing adds its screens; uninstalling hides them and keeps every row |
| **Feature** | Space Manager, in **Settings → Feature settings** | A narrower switch inside a module. Inert while its parent module is off |

## Every module

"Default" means the module is on in a makerspace created without choosing any modules. The guided
installer turns on more than this; see [Setup areas](#setup-areas).

### Inventory (always on)

| Module | Default | What it adds | Requires |
| --- | --- | --- | --- |
| `public_inventory` | Core | The public catalogue and item pages at `/m/<slug>` | |
| `request_workflow` | Core | Borrow requests, the staff review queue and the loan state machine | |
| `staff_admin` | Core | The staff console's inventory and request administration, and the audit explorer | |
| `evidence_uploads` | Core | Issue and return photos, immutable once attached | |
| `qr_management` | Core | Generating, revoking and printing QR codes | |
| `scanner` | Core | The camera scanner and container lookup | |
| `asset_units` | Off | Individually QR-tracked units ("drill #3"), selectable at issue time | |
| `containers` | Off | The container hierarchy (boxes inside shelves inside rooms) and moves | |
| `bulk_import` | Off | Spreadsheet import: upload, map columns, preview, apply | |
| `stock_transfers` | Off | Moving stock between locations, including between makerspaces | |
| `qr_print_batches` | Off | Batches of QR labels downloadable as a ZIP | |
| `guest_handover` | Off | The narrow front-desk handover console and direct handouts at the counter | |
| `procurement` | Off | The "to buy" list, receipts and moving purchases into stock | |

### Other areas

| Area | Module | Default | What it adds | Requires |
| --- | --- | --- | --- | --- |
| Stocktake | `stocktake` | Off | Scan-first stock counts, variance review and ledger adjustments | |
| Machines | `machines` | Off | The machine registry: operators, usage, documents, consumables, warranty | |
| Machines | `machine_service` | Off | The service/job queue: requests, uploads, consumption and usage records | |
| Machines | `printing` | Off | 3D printing intake and the printer view of the queue | `machine_service` |
| Machines | `maintenance` | Off | Preventive maintenance schedules and immutable maintenance logs | `machines` |
| Events | `events` | Off | Events and series, registration, check-in, feedback, certificates, badges | |
| Bookings | `bookings` | Off | Bookable spaces and public self-booking | |
| Membership | `membership` | Off | Join requests, waivers, referrals, plans, maker profiles, directory, member cards | |
| Membership | `member_accounts` | Off | Member self sign-up and member sign-in (password, Google, Apple, phone) | |
| Notifications | `notifications` | Off | The in-app notification inbox | |
| Notifications | `email` | Off | Outbound email for this makerspace | |
| Notifications | `telegram` | Off | Telegram group alerts (outbound only) | |
| Notifications | `slack` | Off | Slack incoming-webhook alerts | |
| Notifications | `mattermost` | Off | Mattermost incoming-webhook alerts | |
| Notifications | `discord` | Off | Discord incoming-webhook alerts | |
| Notifications | `webhook` | Off | Signed JSON webhooks to your own systems | |
| Reports | `reports` | Off | Analytics, the report catalogue, CSV/XLSX exports and scheduled reports | |
| Payments | `payments` | Off | Online card payment through Stripe or Razorpay | |
| Mobile apps | `mobile` | Off | Device sessions for the native apps, native push and the in-app payment sheet | `member_accounts` |
| Backup & custody | `backup` | **On** | Makerspace archive requests and downloads, archive-recipient keys, custody status | |
| Connected devices | `devices` | Off | Printers and label printers enrolled with their own signing key | |

Installing a module also installs what it requires. A module that another installed module depends
on cannot be uninstalled until the dependant goes first.

### Notes on a few modules

- **`membership` decides who may borrow.** With it on, only active members can submit borrow
  requests. With it off, anyone with an account can, or (if you opt in) people with no account at all.
- **`membership` does not require `member_accounts`.** People can come from your own identity
  provider or from walk-in records staff create at the counter.
- **Bookings and events do not require `membership`.** They accept signed-in accounts; an existing
  membership still has to be active with a current waiver.
- **`payments` is only the online rail.** Money owed (deposits, late fees, booking and event prices,
  machine jobs, dues) is recorded and can be settled in person without it. See
  [Payments](/configure/payments/).
- **Each notification channel is its own module.** Installing one never makes it start sending: you
  still add the credential and choose which alerts it carries. Uninstalling stops delivery but keeps
  the stored credential.
- **Staff sign-in is never gated.** Turning off `member_accounts` removes member sign-up and member
  sign-in methods, not staff logins.
- **`backup` covers the makerspace-facing half only.** Deployment backups cover every makerspace
  whether or not it is on.

## Setup areas

The installer does not ask about 34 modules. It asks yes or no about eight **areas**, each a bundle of
modules and features.

| Area (`--areas` key) | Default | Modules |
| --- | --- | --- |
| Inventory & lending (`inventory`) | Yes | Core six, plus `guest_handover`, `asset_units`, `containers`, `bulk_import`, `stock_transfers`, `qr_print_batches`, `procurement`, `stocktake`, `devices` |
| Machines (`machines`) | Yes | `machines`, `machine_service`, `printing`, `maintenance` |
| Events (`events`) | No | `events` |
| Bookings (`bookings`) | No | `bookings` |
| Membership (`membership`) | No | `membership`, `mobile` |
| Online payments (`payments`) | No | `payments` |
| Reports (`reports`) | Yes | `reports` |
| Chat alerts (`chat`) | No | `telegram`, `slack`, `mattermost`, `discord`, `webhook` |

Always on, whatever you answer: the six core modules, `backup`, `notifications`, `email` and
`member_accounts`, plus charge tracking, receipt documents, payment reminders, staff invitations and
the advisory presence geofence.

Saying yes to an area also switches on the features inside it that your selected modules support.
Saying no to Inventory & lending keeps the core modules (they cannot be removed) but turns off the
**Hardware loans** feature, which hides the catalogue, borrowing and loan consoles without touching
any loan data. The setup questions are described in [Setup questions](/install/setup-questions/).

To change areas later, rerun the installer and choose the module menu, or run the updater from the
install directory:

```bash title="On the server"
bash scripts/update.sh --modules-only --makerspace my-space
```

Add `--areas=inventory,machines` to select an exact set, `--all-makerspaces` to apply to every
makerspace, and `--confirm-removals` to accept unticked areas without a prompt. The menu shows each
area as on, partial or off, and only asks follow-up questions for newly enabled areas. Unticking an
area uninstalls its optional modules and keeps their data.

## Common features

Features are switched by a Space Manager in **Settings → Feature settings**. A few you are likely to
look for:

| Feature | Inside | Default | What it does |
| --- | --- | --- | --- |
| Hardware loans (`loans.enabled`) | `staff_admin` | On | Shows the loan catalogue, borrowing and staff loan consoles |
| Self checkout (`inventory.self_checkout`) | Standalone | On | Member QR self-checkout and staff direct handouts |
| Kiosk (`inventory.kiosk`) | Standalone | Off | Scanner and handover kiosk stations |
| Loan renewals (`loans.renewals`) | `request_workflow` | Off | Policy-bound loan extensions |
| Borrow limits (`loans.limits`) | `request_workflow` | Off | Caps on active loans and outstanding items |
| Kit checklists (`loans.kit_checklist`) | `containers` | Off | Count kit components at issue and return |
| Track money owed (`charges.enabled`) | Standalone | On | Master switch for recording charges |
| Certification gating (`machines.certifications`) | `machines` | Off | Members need a current certification for a machine type |
| Offline & station check-in (`events.offline_checkin`) | `events` | Off | Offline event roster and PIN check-in stations |
| Space packs (`packs.import`) | `staff_admin` | Off | Export and import configuration packs |
| Require MFA for staff (`security.staff_mfa_required`) | Standalone | Off | Staff with actions here must use an authenticator app |

The guided installer switches on most features of the areas you pick, so a makerspace set up that way
may differ from these defaults.

## Install, uninstall and purge

**In the console**, a superadmin opens **Admin → Modules**, expands an area and installs or uninstalls
a module. Core modules show as always on, and modules this deployment does not ship are marked.

**From the command line**, run these from your install directory:

```bash title="On the server"
docker compose run --rm --no-deps backend --role management python manage.py list_modules
docker compose run --rm --no-deps backend --role management python manage.py install_module bookings --makerspace my-space
docker compose run --rm --no-deps backend --role management python manage.py uninstall_module bookings --makerspace my-space
```

`--makerspace` can be left out when the deployment has only one makerspace.

**Uninstalling only hides.** The API refuses the module's endpoints and the console stops showing its
screens, but every row, upload and history entry stays. Reinstalling brings it all back.

**Purging deletes**, and is deliberately a separate second step:

```bash title="On the server"
docker compose run --rm --no-deps backend --role management python manage.py purge_module_data --list
docker compose run --rm --no-deps backend --role management python manage.py purge_module_data bookings --makerspace my-space
```

:::danger[Purging cannot be undone]
- The module must already be uninstalled; purging an installed module is refused.
- It is superadmin only and asks you to type the makerspace slug back to confirm.
- Payment records are never purged with a module. Receipts stay readable and pending charges stay
  payable.
- Some modules own no separate data, and `machines` cannot be purged on its own because other
  modules hang off it. The command tells you which case applies.
:::

A deployment that will never use an area can also drop that code entirely with the
`TOMBSTONED_APPS` setting; the `suggest_tombstones` command names the apps that are safe to remove.
That is an operator decision; see [Environment variables](/configure/environment-variables/).

## Editions

An **edition** says what a whole deployment is for. It is set once per deployment with
`SPACEWORKS_EDITION`, not per makerspace.

| Edition | What it hides | Public home |
| --- | --- | --- |
| `makerspace` (default) | Nothing | The catalogue |
| `events` | Every lending, inventory and machine module, plus `bookings` | The events page |
| `bookings` | Every lending, inventory and machine module, plus `events` | The bookings page |
| `organization` | Nothing; one makerspace is presented as "the organization" | The catalogue |

An edition only hides public screens (their routes answer "not found"). It deletes nothing, and staff
screens keep working so no data becomes unreachable. The installer picks the `events` or `bookings`
edition only when that is the single primary area you choose.

## Space packs

A space pack copies a makerspace's **configuration** (not its data) so you can reuse it for another
space. Turn on the **Space packs** feature, then use the Space packs panel in **Admin → Settings**.

- **Export** downloads a JSON pack: enabled modules and features, settings, opening hours, custom
  roles, loan policy, membership plans and admission settings, the current waiver text, booking rules,
  notification defaults, email and chat templates, categories and item templates.
- **Import** always previews first, listing every change. Applying it adds or updates entries and
  never deletes anything already there. New catalogue items start with zero stock.
- Packs never carry members, loans, bookings, stock counts, QR codes, credentials, or anything that
  identifies a person.

A superadmin can save a pack as a named install profile and apply it when creating a new makerspace.
Only a superadmin can change the module set through a pack.

## Related

- [Set up your makerspace](/guides/makerspace-setup/)
- [Setup questions](/install/setup-questions/)
- [Roles and permissions](/guides/roles-and-permissions/)
