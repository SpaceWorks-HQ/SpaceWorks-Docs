---
title: Concepts
description: The mental model behind SpaceWorks, from deployments and makerspaces to roles, requests, evidence, modules and public visibility.
sidebar:
  order: 3
---

This page explains the ideas you need to understand SpaceWorks as a whole. Each section links to the
guide that covers it in depth. For quick definitions, see the [Glossary](/get-started/glossary/).

## Deployment and makerspaces

A **deployment** is one installation of SpaceWorks: one database, one set of containers, one web
address (or several). A deployment hosts one or more **makerspaces**, the tenants of the system.

Every makerspace owns its own:

- inventory, boxes and QR codes;
- public URL (`/m/<slug>`, or a dedicated domain);
- staff, roles and members;
- notification channels, such as its Telegram group or Slack webhook;
- audit log.

Makerspaces are isolated from each other. A staff member in one makerspace cannot list, see or change
anything in another unless they also hold a role there. Every staff query is filtered by makerspace on
the server, so this is enforced rather than a matter of which screens you show.

Some things belong to the deployment rather than to any one makerspace: the
[edition](#editions), sign-in providers such as Google or OpenID Connect, and settings in the
environment file.

## People

| Who | What they are |
| --- | --- |
| **Superadmin** | Operates the whole deployment. Creates makerspaces, installs modules, and is the only person who can use the `/control/` control plane. |
| **Staff** | People who hold a role in a makerspace that grants them actions, such as accepting requests or editing inventory. They work in the staff console at `/admin`. |
| **Members** | People who belong to a makerspace's community. They hold the protected **Member** role, which grants no staff actions. |
| **Users** | Anyone with an account. A user can be staff in one makerspace and a member in another. |
| **Walk-ins** | Person records created by front-desk staff for someone at the counter: a name and optionally contact details, with **no password and no way to sign in**. |

Every user has an **access status**: `active`, `restricted` or `suspended`. Only active users can act.
Restricting or suspending someone is how a makerspace stops a person borrowing, for example after an
unresolved loss.

:::note
A makerspace can switch off superadmin access to itself. When it does, the deployment's superadmin
can no longer see into that space through the application, apart from a minimal row that shows the
space exists.
:::

## Roles and actions

Permissions in SpaceWorks are **action-based** and **per makerspace**. There is a fixed set of
actions, such as `accept_request`, `issue_request`, `edit_inventory`, `manage_qr`, `upload_evidence`,
`manage_events` and `view_audit`. A **role** is a named, editable bundle of actions inside one
makerspace, and a person's role in a makerspace decides what they can do there.

Each makerspace starts with four protected default roles:

| Role | What it covers |
| --- | --- |
| **Space Manager** | Runs the makerspace: the full loan lifecycle, inventory, QR, machines, printing, events, bookings, members, finance and settings. |
| **Inventory Manager** | The full hardware lifecycle (requests, issue, return, inventory, QR, evidence, audit). **Not** printing, staff or makerspace settings. |
| **Machine Manager** | Manages machines, scoped to the machine types the role is linked to. |
| **Member** | The community role. No staff actions. |

You can create **custom roles** for anything else. A front desk is the common example: a "Front desk"
or "Handover" role holding the handout actions can issue accepted requests, make direct handouts,
process returns and upload evidence, without being able to accept or reject requests or edit inventory.
There is no built-in Guest Admin role; handover staff get a custom role instead.

See [Roles and permissions](/guides/roles-and-permissions/).

## Inventory, boxes and QR codes

| Thing | What it is |
| --- | --- |
| **Product** | A kind of item in the catalogue, such as "Arduino Uno R4", with a total quantity. |
| **Asset** | One individually tracked unit of a product, with its own status: available, reserved, issued, damaged, lost, retired or in maintenance. |
| **Box** | A physical container (a bin, kit case or shelf) with its own QR code. Boxes can nest inside other boxes and can carry a kit checklist. |
| **QR code** | A printed code that points at a box, a product, an asset or a member card. Codes can be revoked, and every scan is recorded and cannot be edited. |

All quantity counting (available, reserved, issued, lost) happens in one place on the server, and
availability can never go below zero. See [Inventory and QR](/guides/inventory-and-qr/).

## The request lifecycle

A borrow **request** moves through a fixed set of states. Only the allowed transitions are possible,
and every one goes through the same server-side workflow, whether it starts in the staff console, the
front-desk screen or the control plane.

```text
  draft ──► pending_approval ──┬──► rejected
                               │
                               └──► accepted ──► issued ──┬──► partially_returned
                                                          │            │
                                                          │            ▼
                                                          ├──► returned
                                                          │
                                                          └──► closed_with_issue
```

- **draft** and **pending_approval**: the borrower has asked; nothing is reserved yet.
- **accepted**: staff approved it and the stock is reserved.
- **issued**: the items were handed over, with a box QR scan and an issue photo.
- **partially_returned**: some items are back and some are still out.
- **returned**: everything came back in good condition.
- **closed_with_issue**: everything is accounted for, but something was damaged or missing.

Two other routes hand items over without a reviewed request: **direct handouts** by staff and
**self-checkout** by members. Both require uploaded evidence and an eligible scanned tool.

See [Loans](/guides/loans/).

## Evidence and retention

An **evidence photo** is a picture taken at issue or return. Photos go to a private storage bucket
through a short-lived upload link, are linked to the person, request and QR scans involved, and are
never public. Once attached, a photo's record cannot be changed or deleted.

Photo *files* can expire. When expiry is switched on for the deployment, photo files older than the
retention period (365 days by default, adjustable per makerspace) are deleted from storage. The photo's
record stays, and an expired photo shows as expired rather than missing. See
[Evidence retention](/configure/evidence-retention/).

## The audit log

Every state-changing action writes an entry to the **audit log**: who did it, what they did, to what,
and in which makerspace. The log is append-only. The application never edits or deletes entries, and
database triggers block attempts to do so.

## Accountability and access restriction

When a return reports items as **damaged** or **missing**, SpaceWorks creates an **accountability
record** against the borrower, and the request ends as `closed_with_issue` once every item is
accounted for. Accountability records are
immutable. They are the link between a physical loss and the person responsible, and they are what
staff look at when deciding whether to restrict that person's access.

## Modules, areas and features

SpaceWorks is split into **modules** that each makerspace turns on or off.

- **Core modules** are always on, because the handover rules depend on them: the public catalogue, the
  request workflow, the staff console, evidence uploads, QR management and the scanner.
- **Opt-in modules** cover everything else: machines, printing, events, bookings, membership, reports,
  payments, each notification channel and more. There are 34 modules in total.
- **Uninstalling** a module hides its screens and routes, but **keeps all its data**. Reinstalling
  brings it back.
- **Purging** is a separate, deliberate step that permanently deletes an uninstalled module's data for
  one makerspace. Only a superadmin can do it, and it cannot be undone.

To keep this manageable, modules are grouped. The installer asks about eight **areas** (Inventory &
lending, Machines, Events, Bookings, Membership, Online payments, Reports and Chat alerts) and turns on
every module and feature in each area you choose. The console shows modules under similar headings.

Inside modules there is a second, finer level: **features** (also called capabilities), such as
`inventory.self_checkout`, `loans.renewals` or `events.offline_checkin`. A feature only works when its
parent module is installed. Superadmins install modules; Space Managers can switch features on and off.

See [Modules](/guides/modules/).

## Editions

An **edition** says what a whole deployment is *for*. It is set once for the deployment with the
`SPACEWORKS_EDITION` environment variable, and the installer derives it from the areas you choose.

| Edition | Effect |
| --- | --- |
| `makerspace` | The default. Nothing is hidden. |
| `events` | Hides the lending, machine and bookings surfaces. The public home is the events page. |
| `bookings` | Hides the lending, machine and events surfaces. The public home is the bookings page. |
| `organization` | Hides nothing. Labels the makerspace as "the organization". |

An edition only **hides** public surfaces; hidden public routes answer "not found". It never removes
core modules, data or staff endpoints, so anything recorded stays reachable.

## Organizations

An **organization** is a network, university or chain that spans several makerspaces. It is not a
module and it does not replace the makerspace as the unit of isolation. Each makerspace keeps its own
data. An organization links to makerspaces as owner, manager or affiliate, has a public profile, and
can show a combined event catalogue.

Organization members can be granted **actions** across the organization's makerspaces. A grant gives
the ability to do specific things there, but never makes the person staff of those spaces. See
[Organizations](/guides/organizations/).

## Public visibility

The public catalogue shows only what a makerspace chooses to show, and never shows storage locations,
box IDs, QR codes, scan history, evidence photos, borrower history or hidden counts.

Three settings on each product control what the public sees:

| Setting | Values | Default |
| --- | --- | --- |
| `is_public` | Whether the product appears in the public catalogue at all. | `true` |
| `public_availability_mode` | `exact_count`, `status_only` or `hidden` | `status_only` |
| `show_public_count` | A safety switch that must also be on for an exact count to show. | `false` |

How they combine:

- `is_public` off: the product is not listed.
- `hidden`: the product is listed with no availability.
- `status_only`: the product shows a label.
- `exact_count`: the product shows the exact available count **only if** `show_public_count` is on.
  Otherwise it falls back to the label.

The label is worked out from the available and total quantities:

| Label | When |
| --- | --- |
| **Unavailable** | Nothing is available, or the total is zero. |
| **Limited** | The available count is at or below 20% of the total, rounded up. |
| **Available** | Anything more. |

For example, a product with 10 units shows **Limited** when 2 or fewer are available.

## Next steps

- [Glossary](/get-started/glossary/): short definitions of every term on this page.
- [Makerspace setup](/guides/makerspace-setup/): put these concepts to work in your own space.
- [Architecture](/develop/architecture/): how the code enforces them.
