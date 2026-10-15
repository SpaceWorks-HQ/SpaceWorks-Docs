---
title: Events and bookings
description: Run events and recurring series with registration, approval, waitlists, QR and offline check-in, feedback, certificates and badges, and let members book rooms and benches.
sidebar:
  order: 7
---

Space Works has two separate modules for time-based activities:

- **Events** (`events` module): workshops, talks and open days that people register for and check in
  to. Staff need `manage_events`.
- **Bookings** (`bookings` module): rooms, benches and other spaces that people reserve for a time
  slot. Staff need `manage_bookings`.

Neither requires the Membership module. Both can charge money; charges are recorded whether or not
you take online payments.

## Events

### Who can register

Each event has a **registration audience**:

| Audience | Who can register | Needs |
| --- | --- | --- |
| **Members** (default) | Active members who have accepted the current waiver | The Membership module |
| **Authenticated accounts** | Anyone signed in with an active account | The **Account event registration** feature |
| **Invited accounts** | Signed-in accounts holding a valid invitation code | The **Event invitations** feature |

Set the audience for new events under **Settings → Event defaults**; existing events keep theirs.
Staff can also register an existing account or a walk-in record themselves from the event's roster.
Registering without any account is not supported.

### Create an event

1. Open **Events → Events** and choose to create an event.
2. Enter the title, description, location, date and time, duration and the event's timezone.
3. Set the **capacity** (or leave it unlimited), a **registration cutoff** and how many hours before
   the start members can still cancel.
4. Choose the registration audience, whether to **require staff approval for registrations**, and a
   **registration price** if it is paid.
5. Optionally add categories, tags and an image.
6. **Publish** when it is ready. A draft is visible only to staff.

Published public events appear at `/m/<slug>/events`, each with its own detail page showing price,
available tickets, a calendar download and share details. Attendee information is never public.

### Recurring series

Choose **Recurring series** instead of a one-time event to repeat it daily, weekly or monthly from a
first local date and start time, with a capacity and price per occurrence. You can then edit a single
occurrence (**Edit this occurrence**) without changing the rest.

### Approval and waitlists

- With approval required, registrations arrive as **pending approval**; staff **Approve** or **Reject**
  them from the roster.
- When an event is full, new registrations join the **waitlist**. Staff use **Promote** to move someone
  up when a place frees.

A paid event records the charge only when a place is actually confirmed: at sign-up, on approval with
room, or on promotion from the waitlist. Never while pending or waitlisted. Cancelling an event cancels
every still-pending charge; settled payments stay for staff to refund.

### Tickets, invitations and promo codes

Three optional features extend registration:

- **Event ticket types**: several ticket types per event, each with its own price, capacity and sales
  window, including member-only tickets. The price is fixed at registration.
- **Event invitations**: create invitation codes with an expiry, maximum uses and an optional
  recipient email. A code is shown once; copy it then.
- **Event promo codes** (needs ticket types): percentage or fixed-amount discounts with a maximum
  number of redemptions and an expiry.

### Check people in

On the day, open the event's **Attendance check-in**:

- Scan each attendee's check-in QR (from their registration) with the camera, or
- **Mark attended** by hand from the roster. **Correct attendance** fixes mistakes.

**Print check-in QR** produces the codes if you want them on paper.

### Check in without a connection

The **Offline & station check-in** feature adds two tools for a door with poor signal:

- **Offline-ready check-in**: download the roster to the device before the event. Check-ins are
  queued and synchronised when the connection returns. The roster expires; download it again if
  asked. Keep the page open while offline, because closing or reloading it cannot reopen it without a
  connection.
- **PIN check-in station**: create a PIN for the event, then open the station URL on a shared device.
  Attendees check themselves in there. The PIN only works for that event and its check-in window,
  **Rotate PIN** immediately ends old station sessions, and no attendee data is stored on the device.

### Feedback and certificates

Under **Post-event feedback**, add questions and **Open responses** after the event. Attendees answer
from their member area or the event's feedback page. **Close responses** when you are done. Answered
questions cannot be changed.

Tick **Require an attended member and issue an attendance certificate** to give attendees who
responded a certificate PDF. Staff can **Prepare certificate** or **Reissue** one from the roster.

### Badges

**Attendee badges** prints name badges as a PDF. The **Badge template** sets the card size in
millimetres, paper (A4 or Letter), orientation and which fields to print. Each badge can carry the
attendee's check-in QR.

### Calendars and reminders

- Each event page offers a calendar download.
- Members can create a private calendar subscription link under **My event calendar** in their member
  area. It works like a password: rotate or revoke it if shared by accident.
- Registered attendees get a reminder email before the event, 24 hours ahead by default. Change the
  lead times in the event reminders section of **Settings**; an empty list turns reminders off.

### Collaborative events

An event can be run with **partner makerspaces**. Invite a partner from the event; once they accept,
the event appears in both spaces and their members can register through their own makerspace.
Collaborating still requires membership of the collaborating space. Events hosted by an organization
are covered in [Organizations](/guides/organizations/).

## Bookings

### Create a bookable space

1. Open **Bookings** and choose **Create bookable space**.
2. Enter a name, a **space type** (Development room, Bench, Meeting room or Other), capacity, location
   and description.
3. Optionally link a **machine type for certification**, so only members certified on that machine
   type can book (when **Certification gating** is on).
4. Set a **booking price** (0 for free) and whether the booker gets confirmation emails.
5. Choose whether to **show this space on the public Bookings page**, whether to **publish confirmed
   booking intervals**, and whether to **show booker names** with them.

### Booking rules

A Space Manager sets the rules for each space under **Settings → Booking rules per space**:

| Rule | Meaning |
| --- | --- |
| Approval mode | **Instant confirmation** or **Staff approval required** |
| Minimum / maximum booking duration (minutes) | Shortest and longest booking allowed |
| Booking lead time (minutes) | How soon before the start a booking can be made |
| Maximum booking advance (days) | How far ahead people can book |
| Buffer before / cleanup after (minutes) | Reserved time around each booking |
| Cancellation cutoff (hours before start) | 0 lets members cancel any time before the start |

### How people book

Members book at `/m/<slug>/bookings`, which shows availability on a calendar. They need an active
account; if they hold a membership in the makerspace it must be active with the current waiver
accepted. Booking ahead never requires being checked in.

Members can see and reschedule their bookings from the member area. Rescheduling keeps the same
booking and re-checks opening hours, buffers, certification and the cancellation cutoff.

Staff can **Book for a member** from the Bookings tab. With the **Recurring bookings** feature, staff
can repeat a booking weekly for 2 to 52 occurrences; each one is booked and charged separately, and
any clashes are reported.

### Booking charges and reminders

A priced space records a charge only once a booking is **confirmed** (instantly, or on approval).
Bookers get a reminder email 24 hours before by default; change the lead times in the booking
reminders section of **Settings**. Members can also subscribe to a private calendar link for their
bookings.

## Reports

With the Reports module, **event-attendance** and **booking-utilization** reports cover both areas.
See [Reports and audit](/guides/reports/).

## Related

- [Membership](/guides/membership/)
- [Kiosk and front desk](/guides/kiosk/)
- [Payments](/configure/payments/)
- [Notifications](/configure/notifications/)
