---
title: Kiosk and front desk
description: Set up front-desk and kiosk devices in Space Works, including station PINs, operator sign-in, what each station can do, how offline handovers are queued, and how to recover failed ones.
sidebar:
  order: 11
---

Most makerspaces have a desk, a tablet by the door, or a laptop on the tool wall. Space Works offers
several ways to run them, from a simple public catalogue screen to a handover station that keeps
working when the Wi-Fi drops.

| Surface | Address | Signed in? | Use it for |
| --- | --- | --- | --- |
| **Front-desk console** | `/admin` | Yes, with a front-desk role | Day-to-day handovers by volunteers |
| **Public desk** | `/kiosk/<slug>` | No | A browse-only catalogue screen for visitors |
| **Station kiosk** | `/m/<slug>/kiosk/<station>` | Station PIN, then a staff operator | A shared handover or scanner device, with offline continuity |
| **Event check-in station** | `/m/<slug>/event-check-in/<station>` | Event PIN | Self check-in at an event door; see [Events](/guides/events-and-bookings/#check-in-without-a-connection) |
| **Staff scanner** | `/scanner` | Yes | A standalone QR lookup page |

## The front-desk console

The simplest setup is a normal staff login with a narrow role. Create a **Front Desk** role (see
[Roles and permissions](/guides/roles-and-permissions/#build-a-front-desk-role)) and the console shows
only **Requests**, **Direct handout**, **Job handover**, **Payments** and **Notifications**, according
to what the role holds. Guided issue and return wizards walk volunteers through the box scan, photo
and remark.

## The public desk

`/kiosk/<slug>` shows your public catalogue in a kiosk frame, with no sign-in. Use it on a screen where
visitors browse what you have. It changes nothing and needs no setup beyond a published catalogue.

## Station kiosks

A **station** is a named, shared device for handovers or scanning. It is designed so the device itself
holds no lasting authority:

- a **Station PIN** only unlocks the kiosk;
- every handover still needs a **signed-in staff operator**, and is recorded against that person;
- the operator can only do what their own role allows.

### Set up a station

You need the **Kiosk** feature (off by default) and `manage_makerspace`.

1. In **Settings → Feature settings**, turn on **Kiosk**. For direct handouts at the station, **Self
   checkout** must be on too.
2. In **Settings → Kiosk stations**, enter a name and choose a **Kind**: **Handover** or **Scanner**.
3. Choose **Create station**. The PIN and the station URL are shown **once**; note them down.
4. Open the station URL on the device and enter the PIN to unlock it.
5. A staff member signs in to start their operator shift. Use **Full screen** for a cleaner display.

From the stations list you can **Rotate PIN**, **Reveal PIN** (you must re-enter your own password),
**Disable** a station, or **Re-enable with new PIN**.

### What each kind of station can do

| Operation | Scanner station | Handover station | Operator needs |
| --- | :--: | :--: | --- |
| Look up a QR code | Yes | Yes | `view_inventory` |
| Assign a box to a request | | Yes | `assign_box` |
| Issue a reviewed request | | Yes | `issue_request` + `upload_evidence` |
| Return a reviewed request | | Yes | `return_request` + `upload_evidence` |
| Direct handout | | Yes | `issue_direct_loan` + `upload_evidence` (and Self checkout on) |
| Return a direct handout | | Yes | `return_request` + `upload_evidence` (and Self checkout on) |

Each operation also needs its modules to be installed. The station never reaches the general staff
console.

### Run a handover at a station

1. Load the request by its number.
2. Scan the box (and assign it, if it has none yet).
3. Take the evidence photo with the device camera.
4. Add a remark (required for returns).
5. Choose **Issue items** or **Return all items**.

A station return records every outstanding item as returned. If something came back damaged or
missing, process the return in the staff console instead, where you can record each outcome. See
[Loans](/guides/loans/#4-return-return-photo-and-remark).

## Working offline

A handover station can finish handovers during a network outage, within strict limits.

**What works offline:** only a handover that was loaded while online, by an operator whose shift was
started while online. The operator can take the photo, add the remark and confirm. The work is shown
as **Queued** until the server accepts it.

**What does not work offline:** unlocking the station, signing in, and looking up people, requests or
QR codes. An offline device also cannot learn that a PIN was rotated or an operator's access removed
until it reconnects.

How queued work is kept:

- Queued handovers and their photos are stored **encrypted** in the browser on that device. Nothing is
  stored in plain text.
- Photos are resized (at most 1600 pixels on the longest edge), re-encoded as JPEG and stripped of
  metadata before they are stored.
- A device holds at most 50 unconfirmed handovers and 100 MiB of photos. Beyond that, capture is
  refused and existing work is kept.
- If the browser lacks the storage and encryption features this needs, the station simply works
  online only.

When the connection returns, the station replays the queue automatically: on reconnect, every 15
seconds while there is pending work, and when you choose **Retry queued work**. Each handover is sent
exactly as it was captured, and the server applies all its normal checks (box, photo, remark,
permissions) at that moment.

Queued work expires with the station session, the operator's shift, or the loaded handover, whichever
comes first.

:::caution[Locking a station discards its queue]
**Lock station** (or signing out) clears the station's encrypted work and photos, including anything
still pending or failed. The station asks you to confirm before discarding work. Let the queue empty,
or have failed items reviewed, before locking.
:::

## When a queued handover fails

Sometimes the server refuses a replayed handover, for example because the request was already
returned at the counter, or the borrower's membership lapsed. Failed work is kept and marked for staff
review; other queued handovers carry on.

Failed replays are listed in **Operate → Requests** for staff who hold the matching action. To resolve
one:

1. Open the failed handover and inspect it, including its photo.
2. Decide what really happened:
   - If nothing physically changed hands, **acknowledge** it after checking.
   - If the handover did happen, make a **correction** from a station: it uses the current station
     session, a fresh operator shift, the request loaded online and a new photo. Once the correction
     succeeds, link it to the failed attempt.
3. The review is recorded in the audit log against the reviewing staff member.

Reviewing a failure never changes stock or loan status by itself; only a successful corrective
handover does. Failed direct handouts can only be acknowledged, because the details needed to match a
replacement automatically are not retained.

## Tips

- Give each physical device its own station, so a lost tablet means rotating one PIN.
- Rotate PINs when volunteers change.
- Mount the device where the camera can see the box and tools clearly; the photo is the evidence.

## Related

- [Loans](/guides/loans/)
- [Roles and permissions](/guides/roles-and-permissions/)
- [Events and bookings](/guides/events-and-bookings/)
- [Troubleshooting](/help/troubleshooting/)
