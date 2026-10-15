---
title: Organizations
description: Register a network, university or chain as an organization spanning several makerspaces, publish its public profile and events, and grant its staff actions across linked spaces.
sidebar:
  order: 9
---

An **organization** groups makerspaces that belong together: a city-wide network, a university with
several labs, or a chain of spaces. It lets you:

- publish one public profile listing upcoming events across all its spaces;
- give the organization's staff authority in every linked makerspace without a separate role in each;
- credit an organization as the organizer of an event hosted by one of its spaces;
- see combined analytics across its makerspaces.

Each makerspace still owns its own inventory, members, settings and data. An organization never
replaces a makerspace; it reaches across them.

:::note[Organization edition]
Separately, a deployment can be labelled as an organization with the `organization` edition, which
simply presents one makerspace as "the organization". That is a naming choice for the whole
deployment, not the multi-space organizations described here. See
[Modules](/guides/modules/#editions).
:::

## Create an organization and link makerspaces

Creating organizations and linking them to makerspaces is a superadmin task.

1. Open **Organizations** in the staff console and choose **Create organization**.
2. Enter its name and slug (the slug becomes its public address, `/o/<slug>`).
3. Under **Linked makerspaces**, choose a makerspace and a **Relationship**: **Owner**, **Manager** or
   **Affiliate**, then link it.
4. Repeat for each makerspace.

The relationship is a label describing the connection. All three extend the organization's granted
actions to that space, so linking a makerspace is a decision about authority, and the console asks you
to confirm it. **Unlink** removes the reach.

## The public profile

Organization members with profile governance edit the **Public profile**, which controls the
organization's directory page. The logo is managed by the platform.

When the profile is published, `/o/<slug>` shows the organization with its **Upcoming events** across
makerspaces. Only published, public events appear; attendee details never do.

## Organization members and grants

Organization members are people who act on the organization's behalf. Each membership carries two
separate kinds of authority:

| Kind | Examples | Applies to |
| --- | --- | --- |
| **Organization governance** | Edit the public profile; manage organization members and invitations | The organization itself |
| **Makerspace actions** | `manage_events`, `view_audit`, `accept_request` and so on | Every linked makerspace |

The rule to remember: **an organization grants actions, never identity.** An organization member with
`manage_events` can run events in every linked space while being Space Manager of none of them. They
do not appear on a makerspace's staff list; each makerspace sees its own people plus a separate,
read-only view of which organizations reach in.

Limits:

- Every staff action can be granted through an organization **except** `manage_machines` and
  `manage_devices`. Machine and device trust is physical and must be granted inside the makerspace
  concerned.
- A makerspace hidden from the platform superadmin stays hidden. Organization authority cannot be used
  to reach into it.
- Suspending an organization membership, or deactivating the organization, withdraws its grants
  immediately.

### Invite organization members

1. Open the organization and go to **Invitations**.
2. Choose the **organization governance** and **makerspace actions** the invitee should receive, and
   how many days the invitation is valid.
3. **Create invitation**, then copy the link straight away. It is shown only once.
4. Send the link to the person. It works once; they redeem it while signed in.

Unused invitations can be revoked. **Organization memberships** lists current members, their
governance and their makerspace actions.

## Organization events

An event always belongs to the makerspace that hosts it. An organization can be credited as an
**organizer**:

1. When editing an event, open **Organization organizers**.
2. Choose the organization memberships to credit, and save.

Organizers get attribution and authority over that specific event; the host makerspace remains the
owner. Organization members see the events they organize in **Events → Organized events**, which works
across makerspaces.

For events shared between two makerspaces as equals, use partner makerspaces instead; see
[Events and bookings](/guides/events-and-bookings/#collaborative-events).

## Organization analytics

**Insights → Organization analytics** shows reports totalled across the organization's makerspaces,
with a breakdown by makerspace. You only see figures for spaces and reports your grants cover.

## Related

- [Roles and permissions](/guides/roles-and-permissions/#organization-grants)
- [Events and bookings](/guides/events-and-bookings/)
- [Reports and audit](/guides/reports/)
