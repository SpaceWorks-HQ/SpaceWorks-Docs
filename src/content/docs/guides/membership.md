---
title: Membership
description: Run your community with the Membership module, covering admission and join modes, waivers, plans and renewals, the member area, maker profiles and directory, member cards and walk-in records.
sidebar:
  order: 8
---

The **Membership** module (`membership`) is the community layer of Space Works: who belongs to your
makerspace, how they join, what they pay, and what they see. It is optional. Without it, people can
still sign in, borrow, book and register for events, and staff can still create walk-in records.

Staff who handle membership need `manage_members` (the **Membership Coordinator** preset). Setting
join rules, plan prices and publishing waivers stays with `manage_makerspace`.

:::note[Membership changes who can borrow]
With the Membership module installed, only **active members** can submit borrow requests, and
account-less requests are switched off. See [Loans](/guides/loans/#1-a-member-submits-a-request).
:::

## Accounts and members are different things

| Concept | What it is |
| --- | --- |
| **Account** | A person who can sign in (from the `member_accounts` module, your own identity provider, or a staff-created record) |
| **Membership** | That person's relationship with one makerspace: status, plan terms, waiver acceptance |
| **Walk-in** | A person record staff create at the counter: a name and optional contact details, with no password |

The guided installer always turns on member accounts (self sign-up and password, Google, Apple or
phone sign-in) so people have a way to register. Sign-in methods are configured for the whole
deployment; see [Authentication](/configure/authentication/).

## How people join

Set the admission rules under **Members → Membership admission** (or **Settings → Membership
joining** for the simple policy).

| Join mode | What happens |
| --- | --- |
| **Join instantly** | Membership activates as soon as any form and payment conditions are met |
| **Request approval** | A membership reviewer approves each application |
| **Vouch** | Existing members vouch for the applicant, then a reviewer approves (or vouches alone, if **Vouches replace staff approval** is on) |
| **Invite-only** | The applicant must claim an invitation, then a reviewer approves |
| **Closed** | Every new joining path is refused |

**Admission recipes** prefill sensible combinations, which you can then adjust.

### Application form

With the **Membership application form** feature, applicants answer your questions (by default "Why
would you like to join?"). Answers are stored encrypted and shown only in the review queue and to the
applicant.

### Vouching

With the **Membership vouching** feature, the defaults are one vouch, from a member with at least 30
days' active tenure, each voucher backing at most three pending applicants, and vouches valid for 30
days. Restricted, suspended or revoked accounts cannot vouch. Vouches are kept as a record of who
vouched; they never restrict the voucher automatically.

### Joining fees and payment timing

You can charge a **joining fee** (once per person, or on every re-join) and the first term of a plan.
Choose the **payment timing**:

- **Pay before activation**: the application waits for payment (online, recorded in person, or
  waived), then activates.
- **Activate then charge**: membership starts immediately and the charge is raised at the same time.

### Review applications

Open **Members** to see the **Membership requests** queue. Approve, decline, or invite people from the
same place. Prospective members can also send an invitation request from the public site, which lands
in the same queue.

**Member referrals** (in Settings) lets eligible active members invite someone, and the roster controls
who **Can refer** and who **Can verify** other members.

## Waivers

A waiver is the liability agreement members accept. It is core, so it works even without the
Membership module.

1. In **Members**, open the waiver panel and **Publish waiver** with a new version label.
2. Members must accept the new version before they can book, borrow by self-checkout or join
   members-only events.
3. For someone who signs on paper, use **Record witnessed acceptance**.

Publishing a new version requires everyone to accept again. Old versions and every acceptance are
kept.

## Plans and renewals

Create plans under **Members → Membership plans**.

1. Choose **Create plan** and give it a name.
2. Pick an interval: monthly, yearly, or a custom number of days.
3. Set the amount and currency (0 for free).
4. Set renewal options: days before expiry the renewal opens (default 7), grace days (default 0),
   retries for failed online checkout (0 to 3), and reminder days before and after expiry (default 14,
   7 and 1 days before).
5. Optionally set borrow limits for members on this plan.

Staff assign plan terms to members from the roster. Two features automate the rest:

- **Automatic membership renewal** opens the next term once the renewal charge is settled or waived.
  Free plans simply extend.
- **Membership lifecycle mail** emails members about their renewal.

Renewal charges are recorded first and can be settled in person; with the `payments` module and the
**Membership payments** feature, members can pay online. No stored card is ever charged
automatically.

Turn on **Lapsed members cannot borrow** to stop members whose term has ended or been cancelled from
borrowing until they start a new term. Returning a tool is never refused. Grace days delay this; they
never revoke anyone.

## The member area

Members reach their area at `/m/<slug>/member`. Depending on the modules installed, it shows:

- their borrow requests, active loans (with renewal, if enabled) and returned items;
- their membership status, plan, fee and anything outstanding, by currency;
- payments and receipts;
- bookings, events, feedback and certificates;
- training and certifications for machines;
- notices about their own requests and membership;
- check-in and check-out at the space (a presence session).

The account page (`/m/<slug>/member/account`) lets members edit their name and phone, sign out other
sessions, and cancel or leave, when the **Member account self-service** feature is on. With **Member
data export**, they can request a ZIP of their own data once a day.

### Checking in

Members check in from the member area when they arrive. Self-checkout and some members-only actions
need an active check-in. If you configure a geofence, check-in records whether the member appeared to
be nearby; this is **advisory only** and never blocks anyone. **Members** shows who is currently
present.

## Maker profiles and the directory

Members can opt in to a public **maker profile** with projects, interests, languages and education,
and optionally a GitHub contribution count (if the deployment has a GitHub token configured). The
member **directory** lists only people who chose to publish a profile, and shows events they attended.

## Member cards

A member card is a printable ID with a QR code tied to one membership. Manage them in **Members →
Member cards** (needs `manage_member_cards`, which Space Managers and Membership Coordinators have).

- **Issue**, **reissue** and **revoke** cards. A photo is stored only with the member's recorded
  consent.
- Print a single card (CR80 size) or a sheet on A4 or Letter.
- Front-desk staff with `scan_member_cards` can scan a card to identify the member, for example during
  a direct handout. The inventory scanner never resolves a card to a person.

Revoking a card deletes its photo and blanks the name straight away, while keeping the scan history.
Revoking a membership revokes its card too.

## Walk-in records

When someone without an account needs to borrow a tool, register for an event or have a job run,
staff can add them at the counter: on the direct handout screen choose **Add a walk-in**. The record
has a name and optional email and phone, and cannot sign in. It keeps every handover attributable to a
real person.

If the Membership module is on, a walk-in goes through your admission rules too, and any admission
charge must be settled before the membership activates.

## Broadcasts

With the **Member broadcasts** feature (needs the Notifications module), staff with `manage_members`
can email members from the Notifications tab, filtered by plan, lapsed or current term, and
certification. Each message also lands in the member's own inbox.

## Without the Membership module

Turning Membership off removes join requests, referrals, plans, profiles, the directory and member
cards. It keeps waivers, staff invitations, walk-in records and everyone's history. Data is never
deleted by uninstalling.

## Related

- [Loans](/guides/loans/)
- [Events and bookings](/guides/events-and-bookings/)
- [Authentication](/configure/authentication/)
- [Payments](/configure/payments/)
