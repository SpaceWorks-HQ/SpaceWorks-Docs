---
title: Roles and permissions
description: How action-based roles work in Space Works, what the four default roles can do, every staff action explained, custom roles, superadmins, organization grants and restricted accounts.
sidebar:
  order: 3
---

Space Works decides what a person can do from **actions**, not from the name of their role. A role is
a list of actions owned by one makerspace, and every check asks "does this person hold this action
here?". You can rename roles, narrow them or invent new ones, and nothing else in the system needs to
know.

Access is always **per makerspace**. Someone can be a Space Manager in one makerspace and hold no role
at all in the next. The only global role is the platform **superadmin**.

## The four default roles

Every makerspace starts with four protected roles. You can rename them and narrow what they grant,
but you cannot delete them.

| Role | What it can do |
| --- | --- |
| **Space Manager** | Everything grantable in the makerspace: the full hardware lifecycle, inventory and QR codes, evidence, machines, events, bookings, members and member cards, devices, finance, the audit log, and makerspace settings, roles and staff |
| **Inventory Manager** | The full hardware lifecycle: inventory, QR codes, reviewing, issuing and returning requests, direct handouts, evidence and the audit log. No machines, printing, staff, finance or settings |
| **Machine Manager** | Every machine in the makerspace end to end: the registry, the print and service queue, maintenance, warranty, usage and handing finished jobs over |
| **Member** | No staff actions. A role with no actions is a community membership; it is how Space Works tells a member from a staff member |

The Space Manager role must always keep `manage_makerspace`, and the Member role can never be given
staff actions.

:::note
Earlier versions had built-in "Guest Admin" and "Print Manager" roles. Both are retired: front-desk
work is now a [custom role](#build-a-front-desk-role), and Machine Manager absorbed printing. Existing
roles were converted in place and kept their people.
:::

## Every action

These are the actions you can grant in the role editor, grouped as the editor shows them.

| Group | Action | Lets the holder |
| --- | --- | --- |
| Inventory | `view_inventory` | See inventory and the outstanding-loans ledger |
| Inventory | `edit_inventory` | Edit the catalogue and stock, the to-be-fixed shelf, stocktakes, asset warranty, procurement and containers |
| Inventory | `manage_qr` | Generate, print and revoke QR codes, and use the scanner and QR tools |
| Requests / Handover | `accept_request` | Review and accept borrow requests (and renew loans) |
| Requests / Handover | `reject_request` | Reject borrow requests |
| Requests / Handover | `assign_box` | Assign a physical box to an accepted request |
| Requests / Handover | `issue_request` | Issue accepted requests |
| Requests / Handover | `issue_direct_loan` | Hand tools out directly, with no prior request |
| Requests / Handover | `return_request` | Process returns |
| Requests / Handover | `upload_evidence` | Upload the issue and return photos a handover needs |
| Requests / Handover | `collect_service_request` | Hand a finished machine job (a print, a laser cut) to its requester, without managing machines |
| Machines | `manage_machines` | Manage machines, warranty, maintenance, documents, operators, usage and machine reports |
| Printing | `manage_printing` | Run the print queue, printers and materials |
| Events | `manage_events` | Administer events and record attendance |
| Bookings | `manage_bookings` | Manage bookable spaces and bookings |
| Members | `manage_members` | Handle membership requests, invitations, the roster, verification, plan assignment and member cards |
| Finance | `view_finance` | Read the payment ledger, receipts, reconciliation and money reports |
| Finance | `record_payment` | Record money received in person, correct receipts and record offline refunds |
| Member cards | `manage_member_cards` | Issue, revoke and print member ID cards (includes scanning) |
| Member cards | `scan_member_cards` | Scan a member card to identify its holder |
| Devices | `manage_devices` | Enroll, rename, rotate and revoke connected printers and label printers |
| Reports / Audit | `view_audit` | Use analytics, the accountability view, the audit log, timelines and exports |
| Makerspace admin | `manage_makerspace` | Change settings and integrations, manage roles and staff |

Some actions include others automatically:

- `manage_machines` includes `manage_printing` and `collect_service_request`.
- `manage_members` includes `manage_member_cards`, which includes `scan_member_cards`.

Two further actions, `transfer_stock` (moving stock between makerspaces) and `manage_staff`, belong to
the superadmin only and can never be put in a role.

### What each action shows in the console

Tabs appear only when the person holds a matching action and the makerspace has the module
installed. For example, **Inventory → Containers**, **QR Tools** and **Scanner** need `manage_qr`;
**Admin → Settings** and **Users** need `manage_makerspace`; **Operate → Payments** needs
`view_finance` or `record_payment`; and **Insights → Audit log** and **Accountability** need
`view_audit`.

## Custom roles

To create a custom role:

1. Open **Admin → Users** and go to the role manager.
2. Start a new role. You can begin from a preset: Space Manager, Inventory Manager, Machine Manager,
   Membership Coordinator, Treasurer, Front-desk cashier or Front Desk. A preset only fills in the name
   and ticks; nothing is granted until you save.
3. Name the role and tick the actions it should grant.
4. Save the role, then assign it to staff from the user list.

The rules that keep roles safe:

- You need `manage_makerspace` to create or edit roles.
- You can only grant actions you hold yourself. The editor greys out the rest and says why.
- Only a superadmin can grant `manage_makerspace`.
- A custom role can be deleted once nobody holds it.
- Someone with only `manage_members` (a Membership Coordinator) can assign community roles that grant
  no actions, but cannot change anyone's staff role.

### Build a front-desk role

Most makerspaces want volunteers who can hand tools out and take them back without seeing the rest of
the console. Create a role (the **Front Desk** preset does this) holding:

`view_inventory`, `assign_box`, `issue_request`, `issue_direct_loan`, `return_request`,
`upload_evidence`

Add `collect_service_request` if they also hand over finished prints, and `record_payment` if they take
cash at the counter (the **Front-desk cashier** preset). A role made only of these actions gets a
deliberately narrow console: **Requests**, **Direct handout**, **Job handover**, **Payments** and
**Notifications**, according to what it holds. It cannot accept or reject requests, edit inventory or
manage QR codes unless you grant those too.

For the full handover flow see [Loans](/guides/loans/).

### Finance and membership roles

Money and community work can be delegated without handing over settings:

| Preset | Actions | Suits |
| --- | --- | --- |
| Membership Coordinator | `manage_members` | Someone who reviews join requests and runs the roster |
| Treasurer | `view_finance`, `record_payment` | Someone who reads the ledger and records cash |
| Front-desk cashier | `record_payment` plus the front-desk actions | Counter staff who take payment at handover |

Creating staff accounts, makerspace settings, plan prices and publishing waivers stay with
`manage_makerspace`.

### Machine scope

`manage_machines` can be narrowed to particular machines or machine types per role, so a laser
maintainer sees only the laser. Set this in the role editor's machine scope section. A Machine
Manager role created with a new makerspace starts with scope over the built-in machine types.

## The superadmin

The superadmin is the platform operator. They hold every action in every makerspace and additionally:

- create makerspaces, and install or uninstall modules (**Admin → Modules**);
- grant `manage_makerspace` to a role;
- restrict, suspend and restore accounts;
- create organizations and link them to makerspaces;
- use **Platform settings**, the platform dashboard and the Django control plane at `/control/`.

A makerspace can hide itself from the superadmin. While hidden, the superadmin's global powers do not
apply there; they get only what an explicit role in that makerspace grants.

## Organization grants

An organization (a network, university or chain) can be linked to several makerspaces. Its members can
be given makerspace actions that apply in every linked space, without a separate role in each. An
organization grant confers **actions, never identity**: someone can hold `manage_events` across a
network while being Space Manager of none of its spaces.

- Every grantable action can be given through an organization except `manage_machines` and
  `manage_devices`, which must be granted inside the one makerspace they concern.
- A makerspace's staff list shows only its own people, with a separate read-only view of which
  organizations reach in.
- A makerspace hidden from the superadmin stays hidden; authority cannot be routed in through an
  organization.

See [Organizations](/guides/organizations/).

## Restricted and suspended accounts

A superadmin can set an account to **Restricted** or **Suspended**, with a reason. Either status takes
the account out of active standing: it loses staff access and cannot act as a member (borrow, book,
register, vouch and so on). The change and its reason are written to the audit log.

To restrict someone:

- from **Admin → Users**, open the person and choose to restrict them, picking the status and reason;
  or
- from **Insights → Accountability**, use **Restrict requester** on someone with damage or loss
  records.

**Restore access** on the user list returns the account to active.

:::note
Recording a damaged or missing item does not restrict anyone automatically. It creates an
accountability record; restricting the person is a separate, deliberate decision. See
[Loans](/guides/loans/#damage-loss-and-accountability).
:::

## Related

- [Set up your makerspace](/guides/makerspace-setup/)
- [Loans](/guides/loans/)
- [Organizations](/guides/organizations/)
- [Security](/configure/security/)
