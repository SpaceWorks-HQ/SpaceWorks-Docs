---
title: 3D printing
description: Run a 3D print service with Space Works, from public print requests and the printer queue to filament pools, slicer estimates, pricing and handing finished prints over.
sidebar:
  order: 6
---

Space Works runs 3D printing as a service queue: members ask for something to be printed, staff accept
the job, print it, record what it used and hand it over. Printing is a machine type on top of the
general machine service queue, so the same ideas apply to laser cutters and other machines.

## What you need

| Requirement | Why |
| --- | --- |
| `machines` module | Registers your printers as machines |
| `machine_service` module | The job queue itself |
| `printing` module | Print-specific intake, the public print page and the printer console. Installing it pulls in `machine_service` |
| `manage_printing` or `manage_machines` | Staff who run the queue (Machine Managers and Space Managers have them) |
| `collect_service_request` | Front-desk staff who only hand finished prints over |

The Machines setup area in the installer turns all three modules on.

## Set up your printers

1. Open **Machines → Machines** and add each printer as a machine of a printer type. You can attach
   documents, operators and warranty details to each machine.
2. On the machine type page, review **Machine types and pricing** (see [Pricing](#pricing-and-charges)).
3. Add your filament as **consumable pools** (below).
4. Optionally turn on **Certification gating** in Feature settings so only trained members can request
   work on a machine type.

## Filament and spools

Filament is tracked as **consumable pools**, measured in grams.

To add filament:

1. Open the printer's consumables, or the shared consumables on its machine type page.
2. Choose **Add filament** and pick the material and colour, with a colour swatch for the staff
   console.
3. Set the scope: one specific machine, **or** a whole machine type. A type-wide pool lets one roll of
   PLA serve every printer of that type without entering it twice.
4. Choose **Visible to requesters** or **Hidden from requesters**.

A visible pool appears on the public print form as material and colour name only, and only while it
is active and has stock left. Lot codes, remaining grams and the swatch value are never public.

**Filament low-stock threshold** in **Admin → Settings** sets when staff are warned that a pool is
running low. The **Local material catalogue** feature lets you define the materials and colours your
space offers per machine type, instead of the built-in printer list.

## Public print requests

Members request prints at `/m/<slug>/print`.

Who can submit:

- With the Membership module installed: active members who have accepted the current waiver and are
  checked in at the space.
- Without it: anyone signed in with an active account.

The print form asks for:

| Field | Notes |
| --- | --- |
| Title and project brief | What they want made |
| Model, CAD or toolpath files | STL, 3MF, STEP, OBJ, AMF, PLY or G-code |
| Estimated print-time screenshots | A screenshot of the slicer's time and material estimate (the form mentions Bambu Lab) |
| Slicer settings / personal preferences | Free text: layer height, infill, supports and so on |
| Filament / material and colour | From the visible pools, or no preference |
| Source link | Optional |

After submitting, the requester gets a private status tracker showing **Requested**, **Accepted**,
**Printing**, **Ready to collect** and **Collected**. The link is kept in their browser and should not
be shared.

Under **Settings → Public print status recovery** you choose whether a lost status link can be
recovered from an email address (**Email lookup**) or only with the original link (**Token only**).

## Run the print queue

Open the printer type's page under **Machines** to reach the printer service console. Its job is
summed up on screen: accept jobs, reserve filament, start work, reconcile actual grams, then complete,
fail, collect or reprint.

A job moves through these states:

| State | What happens |
| --- | --- |
| Pending | Newly submitted. **Accept** or **Reject** (with a reason) |
| Accepted | Assign the printer and filament pool, and record the planned grams and estimated minutes |
| In progress | Started on a printer. You can record percent complete |
| Completed | Record the actual grams and minutes. The filament is deducted from the pool |
| Failed | Record a failure reason. **Reprint** starts it again |
| Collected | Handed to the requester |

**Log usage** records printer time that did not come through the queue, such as a staff test print,
so usage reports stay accurate. **Printer reports** shows completed hours and failures per printer
(the Reports module adds the full printer-service report).

## Pricing and charges

Prices are set per machine type, per makerspace, under **Machine types and pricing**:

- **Rate per unit**: the price per metering unit. For printers that is per gram of filament actually
  used; for minute-metered machines it is per minute.
- **Flat fee**: added to every job.
- **Enable payment**: off by default. Nothing is charged until you tick it.

When a priced job is **completed**, Space Works records a charge against the requester for
`rate × actual quantity + flat fee`, in the makerspace's default currency. This needs the **Track
machine job charges** feature, which is on by default. A failed job creates no charge.

The charge is money owed, not an online payment. Staff with `record_payment` settle it in person (cash,
bank transfer, card machine and so on) and the receipt is kept on the ledger. If the `payments` module
and the **Machine payments** feature are on, the member can pay online instead. See
[Payments](/configure/payments/).

## Hand prints over

Finished prints wait in **Operate → Job handover**, which lists everything awaiting collection with a
**Unpaid** or **Waived** badge where a charge applies.

To hand over a print:

1. Find the job in **Job handover**.
2. Settle any charge first if your space requires payment at collection (staff with `record_payment`
   can record it from the Payments tab).
3. Mark it collected.

A front-desk role with only `collect_service_request` can do this without any other machine access.

## Connected printers

With the `devices` module, printers on your network can be enrolled with their own signing key, so
staff can send a scoped job command to a bound printer and receive its status. This is an advanced,
opt-in feature; see [Devices](/api/devices/).

## Related

- [Modules](/guides/modules/)
- [Roles and permissions](/guides/roles-and-permissions/)
- [Reports and audit](/guides/reports/)
- [Payments](/configure/payments/)
