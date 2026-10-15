---
title: Glossary
description: Alphabetical definitions of the terms Space Works uses in its interface, configuration and documentation.
sidebar:
  order: 4
---

Short definitions of the terms that have a specific meaning in Space Works. For how they fit together,
read [Concepts](/get-started/concepts/).

## A

**Access status**: Every user's standing: `active`, `restricted` or `suspended`. Only active users can borrow or use
  staff tools. Restricting someone does not delete anything.

**Accountability record**: An immutable record created when a return reports items as **damaged** or **missing**. It ties the
  loss to the borrower, and the request ends as [closed with issue](#c) once every item is
  accounted for.

**Action**: One permission from a fixed list, such as `accept_request`, `issue_request`, `edit_inventory` or
  `view_audit`. [Roles](#r) are bundles of actions. See [Roles and permissions](/guides/roles-and-permissions/).

**API client**: A registered integration that calls the Space Works API with its own credentials and scopes. See
  [API clients](/api/api-clients/).

**Area**: A bundle of related modules and features that the installer asks about with one yes/no question.
  There are eight: Inventory & lending, Machines, Events, Bookings, Membership, Online payments, Reports
  and Chat alerts. Areas are a convenience on top of [modules](#m), not a separate switch.

**Asset**: One individually tracked unit of a [product](#p), usually with its own QR code and serial number. An
  asset has a status: available, reserved, issued, damaged, lost, retired or maintenance.

**Audit log**: The append-only record of every state-changing action: who, what, when and in which makerspace.
  Entries are never edited or deleted.

## B

**Box**: A physical container, such as a bin, kit case or shelf, with its own QR code. Boxes can nest inside
  other boxes and can carry a kit checklist. Issuing hardware from a reviewed request requires a box
  QR scan.

## C

**Capability**: See [Feature](#f).

**Charge**: An amount someone owes the makerspace, for example a loan deposit, a late fee, a machine job, a
  booking, an event ticket or membership dues. Charges are recorded whether or not online
  [payments](#p) are set up, and can be settled offline with a [manual settlement](#m).

**Closed with issue**: The final request state when every item is accounted for but at least one was damaged or missing.
  The other final states are `returned` and `rejected`.

**Control plane**: The Django-based operator screen at `/control/`, for platform-wide settings and superadmin
  operations. Only active superadmins can use it, and it is not served on the public website port.

**Core module**: One of the six modules every makerspace always has: `public_inventory`, `request_workflow`,
  `staff_admin`, `evidence_uploads`, `qr_management` and `scanner`. They cannot be uninstalled because
  the handover rules depend on them.

**Custom role**: A role a makerspace creates itself, with whatever [actions](#a) it needs, alongside the four
  default roles.

## D

**Deployment**: One installation of Space Works, which can host many [makerspaces](#m).

**Direct handout**: Staff handing an item to someone with no prior reviewed request. It still needs uploaded evidence
  and an eligible scanned tool, and is recorded like any other loan.

## E

**Edition**: What a whole deployment is for, set with `SPACEWORKS_EDITION`: `makerspace` (default), `events`,
  `bookings` or `organization`. An edition hides public surfaces it does not need; it never removes
  data. See [Concepts](/get-started/concepts/#editions).

**Evidence photo**: A photo taken when an item is issued or returned. Stored in a private bucket, never public, and
  immutable once attached. The image file may expire under the retention policy while its record stays.
  See [Evidence retention](/configure/evidence-retention/).

## F

**Feature**: A switch inside a module, finer-grained than the module itself, such as `inventory.self_checkout`,
  `loans.renewals` or `events.offline_checkin`. A feature only works when its parent module is
  installed. Space Managers can turn features on and off. Also called a capability.

## H

**Handover role**: A [custom role](#c) for front-desk staff, holding the handout actions: issue accepted requests,
  make direct handouts, process returns and upload evidence. There is no built-in Guest Admin role.

## I

**Inventory Manager**: A default role that covers the full hardware lifecycle but not printing, staff or makerspace
  settings.

## K

**Kiosk**: A scanner and handover **station**, usually a shared device at the desk. A station PIN opens it, and
  every handover is attributed to the signed-in staff operator. Enabled with the `inventory.kiosk`
  feature. See [Kiosk](/guides/kiosk/).

## M

**Machine Manager**: A default role that manages machines, limited to the machine types the role is linked to.

**Makerspace**: A tenant of a deployment. It owns its inventory, public URL, staff, roles, notification channels,
  QR codes and audit log, and is isolated from other makerspaces. Public pages live at `/m/<slug>`.

**Manual settlement**: The receipt recorded when staff mark a charge as paid offline. It records the method (cash, UPI,
  bank transfer, card machine, cheque or other), a reference and the date received. Settlements are
  append-only; corrections are added as new entries.

**Member**: A person who belongs to a makerspace's community, holding the protected Member role, which grants
  no staff actions.

**Member accounts**: The module that lets people sign themselves up and sign in as members (password, Google, Apple or
  phone). Staff sign-in never depends on it.

**Module**: A part of Space Works that each makerspace can install or uninstall, such as `events`, `bookings`,
  `machines` or `reports`. There are 34. Uninstalling hides a module and keeps its data. See
  [Modules](/guides/modules/).

## O

**Organization**: A network, university or chain linked to several makerspaces, with a public profile at `/o/<slug>`.
  Organization grants give people actions in linked spaces, never a staff identity there. See
  [Organizations](/guides/organizations/).

## P

**Payments**: The optional module for taking money online through Stripe or Razorpay. Recording what people owe
  does not need it. See [Payments](/configure/payments/).

**Product**: A kind of item in the catalogue, with a total quantity. It may be tracked as a count or as
  individual [assets](#a).

**Public availability mode**: How much of a product's availability the public catalogue shows: `exact_count`, `status_only` or
  `hidden`. Exact counts also need `show_public_count` turned on.

**Purge**: Permanently deleting an uninstalled module's data for one makerspace. Superadmin only, separate
  from uninstalling, and cannot be undone.

## Q

**QR code**: A printed code that points at a box, product, asset or member card. Each code belongs to one
  makerspace. Codes can be revoked, and every scan is kept as an immutable record.

## R

**Request**: A borrow request for hardware. It moves through `draft`, `pending_approval`, then `rejected` or
  `accepted`, then `issued`, then `partially_returned`, `returned` or `closed_with_issue`. See
  [Loans](/guides/loans/).

**Role**: A named, editable bundle of actions inside one makerspace. Each makerspace starts with Space
  Manager, Inventory Manager, Machine Manager and Member, and can add custom roles.

## S

**Self-checkout**: Members checking eligible QR-tagged tools out and back in themselves, with photo evidence. Enabled
  per makerspace with the `inventory.self_checkout` feature and per product.

**Single box**: Running the whole application as one container beside PostgreSQL and object storage, for a small
  server. See [Single box](/install/single-box/).

**Slug**: The short, URL-friendly name of a makerspace, as in `/m/riverside-makerspace`.

**Space Manager**: The default role that runs a makerspace day to day, with nearly every action in that space.

**Space pack**: A JSON export of a makerspace's configuration, such as inventory definitions, booking rules and
  custom roles, that can be imported into another makerspace. It copies configuration only, never
  history, and is not a backup. Enabled with the `packs.import` feature.

**Staff console**: The React app at `/admin` where staff and the superadmin do day-to-day work.

**Superadmin**: The operator of a deployment. Can create makerspaces, install modules and use the control plane. A
  makerspace can switch off superadmin access to itself.

## T

**Tenant**: Another word for a [makerspace](#m) in the multi-tenant sense.

**Tombstone**: Removing an app's code surfaces (routes, admin screens, API docs) from a whole deployment with the
  `TOMBSTONED_APPS` setting, while keeping its database tables and data. Used when no makerspace on
  the deployment will ever use that app.

## W

**Walk-in**: A person record created at the front desk for someone without an account: a name and optionally an
  email and phone, with no password and no way to sign in. Enough to lend them a tool or register
  them for an event while keeping the handover attributable.
