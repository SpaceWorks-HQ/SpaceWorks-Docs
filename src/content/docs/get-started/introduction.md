---
title: Introduction
description: What Space Works is, who it is for, what it does, and what it deliberately does not do.
sidebar:
  order: 1
---

Space Works is a free, open-source, self-hosted platform for running a makerspace. It keeps track of
your tools and equipment, who has borrowed what, what is available right now, and how every loan,
print job, event and booking moves from request to done. One installation can host many makerspaces,
each fully isolated from the others.

The design goal is **traceable handovers**. When a physical item changes hands, Space Works records
evidence of it, so responsibility for shared gear never has to be guessed.

## Who it is for

Space Works suits any community that lends out physical things and needs to know where they went:

- **Makerspaces and hackerspaces**: a tool wall, electronics kits, 3D printers and a front desk.
- **Tool libraries**: a catalogue members can browse, borrow requests, returns and overdue tracking.
- **Universities and colleges**: labs and fab studios with staff roles, sign-in through your own
  identity provider, and cross-lab reporting.
- **Networks and chains of spaces**: one deployment hosting many makerspaces, optionally grouped under
  an **organization** with a shared public profile and event catalogue.

It also works for spaces that only run events or only take bookings. See
[Editions and modules](#editions-and-modules) below.

## Where it came from

Space Works started inside the **TinkerSpace Kochi** community, from a simple need: make it easy for a
makerspace to know what tools exist, who borrowed what, what is available, and how each loan and print
job moves from request to done. It is built by makers for makers. You can run it at your space, fork it,
or use it as the starting point for something that fits your community better.

## The core idea: traceable handovers

Every issue and every return produces evidence:

| Evidence | What it proves |
| --- | --- |
| **QR scans** | Which box, tool or asset was physically handed over. Scan history is immutable. |
| **Photos** | What the item looked like when it went out and when it came back. Attached photo records are immutable. |
| **Remarks** | Notes from the person handling the return, for example "missing one probe". |
| **Audit log** | Who did what, when, in which makerspace. Append-only. |

The rules are enforced by the server, not left to habit:

- Hardware from a reviewed request **cannot be issued** without a box QR scan and an issue photo.
- Hardware **cannot be returned** without a return photo and a return remark.
- Self-checkout and staff direct handouts also need uploaded evidence and an eligible scanned tool.

Photo files can be set to expire after a retention period. The photo's record, the remarks, the scans
and the audit history stay, so the accountability trail outlives the image itself. See
[Evidence retention](/configure/evidence-retention/).

## Feature tour

### Lending and inventory

- **Public catalogue.** People browse what a makerspace has, by category, and ask to borrow it. Each
  item controls how much it reveals: an exact count, an Available/Limited/Unavailable label, or nothing.
- **The full loan lifecycle.** Request, accept or reject, issue with a box scan and photo, return with a
  photo and remark, including partial returns. Damaged or missing items close the loan "with issue" and
  create an accountability record for the borrower.
- **Self-checkout.** When a makerspace turns it on, signed-in members can check eligible QR-tagged
  tools out and back in themselves, with photo evidence.
- **Direct handouts.** Front-desk staff can hand an item over without a prior request, under the same
  evidence rules.
- **QR everywhere.** QR codes for boxes, products and individual assets, with printable QR sheets.
- **Stock tools.** Individually tracked asset units, nested storage containers, spreadsheet import,
  stock transfers (including between makerspaces), scan-first stocktakes and a "to buy" list.
- **Kiosk stations.** A scanner and handover station at the desk, where every handover is still
  attributed to a signed-in staff operator. See [Kiosk](/guides/kiosk/).

### Machines and 3D printing

- A machine registry, a service and job queue, scheduled and reactive maintenance, and warranty tracking.
- A **3D-printing manager** on top of the job queue: public print requests, printer and spool
  management, filament tracking and slicer estimates.
- Optional machine certifications, so members need a current certification for a machine type before
  they can book it or request work on it.

### Events and bookings

- One-off events and recurring series, registration with optional approval and waitlists, QR check-in
  at the door (including an offline roster for a desk with no signal), feedback, attendance
  certificates, printable badges and member calendar feeds.
- Bookable spaces and resources, with public self-booking.

### People and organizations

- **Membership.** Join requests, waivers, referrals, vouching, membership plans and renewals, and a
  member dashboard.
- **Maker profiles.** An opt-in profile with projects and interests, plus a member directory that only
  lists people who chose to be listed.
- **Organizations.** A network, university or chain linked to any number of makerspaces, with a public
  profile and a cross-makerspace event catalogue. An organization grant gives people *actions* in those
  spaces, never a staff identity there.

### Money

- Money owed (loan deposits and late fees, machine jobs, bookings, events, membership dues) can be
  recorded without any payment provider. Staff mark cash, bank transfer or other offline payments as
  paid, with a receipt.
- Online card payments through **Stripe** or **Razorpay** are an optional extra on top.

### Running the space

- **Reports.** What is out, who has it, overdue tracking, charts with table fallbacks, and CSV/XLSX
  export.
- **Notifications.** An in-app inbox, email, and alerts to **Telegram, Slack, Mattermost and Discord**,
  plus signed JSON webhooks to your own systems. You choose which events go to which channel and who
  receives them.
- **Live staff console.** Queues, loans and check-ins update as soon as something changes, and lists
  support typo-tolerant search.
- **Action-based roles.** Editable per-makerspace roles over a fixed set of actions, with four seeded
  defaults. See [Roles and permissions](/guides/roles-and-permissions/).

### Sign-in options

Username and password works out of the box. You can also enable Google, Apple, any OpenID Connect
provider (Keycloak, Authentik, Azure AD, Okta and others) and phone sign-in with an SMS code. Each
method can be switched off on its own. A makerspace can even run with **no member accounts at all**,
using your own identity provider plus front-desk **walk-in** records. See
[Authentication](/configure/authentication/).

### Editions and modules

- **Modules.** Space Works ships 34 modules. Six core modules (the catalogue, request workflow, staff
  console, evidence uploads, QR management and the scanner) are always on. The rest are opt-in per
  makerspace, and switching one off hides it while keeping its data. See [Modules](/guides/modules/).
- **Editions.** A deployment can be set up as a makerspace (the default), as an events-only or
  bookings-only installation that hides the lending screens it does not use, or as an "organization"
  that relabels the tenant. See [Concepts](/get-started/concepts/#editions).
- **Single box.** The whole application can run as one container beside PostgreSQL and object storage,
  for a space with one small server and nobody to look after a larger stack. See
  [Single box](/install/single-box/).

## What Space Works is not

- **Not a chat bot.** Telegram, Slack, Mattermost and Discord receive alerts only. No chat message
  carries accept or reject buttons; decisions are made in the staff console.
- **Not a door or machine controller.** It records machines and their jobs, but it does not read job
  state from printers or CNC controllers or drive access-control hardware. The location check at
  check-in is advisory and never blocks anyone.
- **Not an accounting package.** It records what people owe the space and how it was settled. It is
  not a general ledger for your organization.
- **Not a hosted service you sign up for.** You run it on your own server, with your own data.

## License and cost

Space Works is free and open-source software under the
[GNU Affero General Public License v3.0 or later](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/LICENSE)
(`AGPL-3.0-or-later`). You may use, study, share and modify it for any purpose, commercial or not.
Because the AGPL is a network copyleft licence, if you run a **modified** version and let people use it
over a network, you must offer those users the source code of your modified version under the same
licence.

There is no licence fee and no paid tier in the code. Your costs are the server you run it on and any
third-party services you choose to connect, such as an SMS provider or a payment gateway.

The same code can also run as a hosted platform that gives each makerspace its own subdomain. That mode
stays off unless a platform domain is configured, and the extras it brings (such as per-tenant
resource limits) do nothing on an ordinary self-hosted install.

Contributions are welcome and no CLA is required: by opening a pull request you offer your work under
the project's AGPL-3.0-or-later licence. See [Contributing](/develop/contributing/).

## Tech stack at a glance

| Layer | Technology |
| --- | --- |
| Backend | Django 6 and Django REST Framework (Python 3.12+), OpenAPI through drf-spectacular |
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS 4, TanStack Query v5 |
| Database | PostgreSQL 16 |
| Background work | Celery worker and beat, with Redis |
| File storage | Any S3-compatible service; bundled **Silo** (the maintained fork of MinIO) by default |
| HTTPS | Optional automatic certificates through Caddy, or your own reverse proxy |
| Delivery | Two Docker images, `spaceworks-backend` and `spaceworks-frontend`, published to GHCR |

Every API endpoint is described in OpenAPI, and a running install serves Swagger UI at `/docs/`. See
the [API overview](/api/overview/).

## Next steps

- [Quick start](/get-started/quick-start/): get a running install in a few minutes.
- [Concepts](/get-started/concepts/): the mental model behind makerspaces, roles, requests and modules.
- [Glossary](/get-started/glossary/): every term specific to Space Works, in one place.
- [Requirements](/install/requirements/): what your server needs.
