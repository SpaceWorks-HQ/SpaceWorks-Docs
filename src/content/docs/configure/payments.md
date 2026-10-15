---
title: Payments
description: Track money owed with or without a payment gateway, connect Stripe for online payment, record cash and bank settlements with receipts, and configure currencies, reminders and finance reports.
sidebar:
  order: 6
---

SpaceWorks separates two things that are easy to confuse:

- **Charge tracking** records that someone owes money: a booking fee, an event ticket, a machine job,
  membership dues, a loan deposit or a late fee. It needs **no gateway** and is on by default.
- **Online payment** lets the member pay that charge by card through Stripe. It is optional and
  needs the **Payments** module plus credentials.

A cash-only makerspace can therefore run its whole ledger, settle charges at the desk, issue
receipts and run finance reports without ever setting up Stripe.

## Charge tracking

Charge tracking is controlled per makerspace by features (see [Modules](/guides/modules/)):

| Feature | Default | Records |
| --- | --- | --- |
| `charges.enabled` | on | Master switch. Off means the makerspace charges for nothing. |
| `charges.bookings` | on | A charge when a paid booking is confirmed |
| `charges.events` | on | A charge when someone registers for a paid event |
| `charges.machines` | on | A charge when a priced machine service request completes |
| `charges.membership` | on | Dues and renewal charges |
| `charges.loans` | on | Loan deposits and late fees, when configured |

Each domain feature also needs its own module (bookings, events and so on). Switching tracking off
stops new charges; it never erases, settles or refunds existing ones.

A charge raised with no gateway is simply **pending**. Members see their own charges in the member
area, and staff settle them by hand (below). If you add a gateway later, the first checkout claims
the charge for that gateway exactly once.

## Online payment with Stripe

Online payment for a domain needs all of these, and turning one on never makes an unconfigured
makerspace start charging:

1. The **Payments** module (`payments`), which is opt-in.
2. The **Payments** master switch (`payments.enabled`, on by default once the module is installed).
3. The domain feature: `payments.bookings`, `payments.events`, `payments.machines`,
   `payments.membership` or `payments.loans` (loans is off by default).
4. Working credentials.

### Enter your Stripe keys

In the staff console, open **Admin → Settings → Stripe payments** and enter:

| Field | Where to find it in Stripe |
| --- | --- |
| Stripe publishable key | Developers → API keys (`pk_live_…` or `pk_test_…`) |
| Stripe secret key | Developers → API keys (`sk_…`, or a restricted key) |
| Stripe webhook secret | The signing secret of the webhook endpoint you create below (`whsec_…`) |
| Default payment currency | Three-letter ISO code, for example `usd`, `eur`, `inr` |

Secrets are validated against Stripe, stored encrypted with `API_CLIENT_ENC_KEY` and never shown
again. The badge next to the heading shows whether payments are available. The installer can also
ask for these keys during setup.

### Create the Stripe webhook

The webhook is how SpaceWorks learns that a payment succeeded. Each makerspace has its own endpoint,
keyed by its **makerspace code** (shown in the staff console header and under
**Admin → API access**):

```text
https://<your-api-host>/api/v1/webhooks/stripe/<makerspace-code>
```

In Stripe → Developers → Webhooks, add that URL and subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`, `charge.refund.updated`, `refund.created`, `refund.updated`, `refund.failed`

Copy the endpoint's signing secret into **Stripe webhook secret**. Every event is checked against
that secret and processed once, even if Stripe retries it.

:::note
A webhook settles a real payment **even if** you have since switched online payments off, so money
already taken is never stranded. A payment that arrives for a charge staff already settled or
waived is recorded in the audit log for you to refund.
:::

### Test mode

Use Stripe test keys (`pk_test_…`, `sk_test_…`) and a test-mode webhook while you try things out,
then replace all three values with live ones.

### Hosting platforms

On a subdomain hosting platform, makerspaces can connect through **Stripe Connect** instead of
pasting raw keys; the superadmin configures it under **Platform settings → Platform Stripe Connect**
and sets `STRIPE_CONNECT_REDIRECT_URI`. Self-hosted installs use per-makerspace keys.

### Razorpay

The payment engine also supports Razorpay, with a per-makerspace webhook at
`/api/v1/webhooks/razorpay/<makerspace-code>` that settles on `payment_link.paid`, `order.paid` and
`payment.captured`. In this release the staff console has fields for Stripe only.

## Settling charges by hand

Staff with the record-payment permission open **Operate → Payments** to see every charge and its
status: pending, paid online, paid offline, waived or cancelled.

- **Mark paid offline** records money taken at the desk. It always writes a **settlement receipt**
  in the same step, with the method (cash, UPI, bank transfer, card machine, cheque or other), an
  optional reference such as a UPI or cheque number (up to 64 characters), and the date the money
  was actually received.
- **Waive** forgives a charge.
- Both work one at a time or in bulk, and both cancel any open online checkout for that charge.
- **Refund offline** records money handed back on an offline-paid charge. **Release deposit**
  returns a loan deposit after the loan is closed. Card refunds go back through Stripe.

Settlement receipts and refunds are **append-only**. To fix a mistyped reference or date, use
**amend**: SpaceWorks keeps the original and adds a correction, so both stay visible. Amounts and
currencies cannot be amended.

Payment problems never block the work itself: completing a machine job or confirming a booking
succeeds even if creating the charge or the checkout fails. The one exception is opt-in: with
**loan deposit blocks issue** on, a reviewed loan cannot be handed over until its deposit is paid.

## Loan deposits and late fees

With the `payments.loans` feature on, **Admin → Settings** offers loan charges:

| Setting | Meaning |
| --- | --- |
| Deposit mode | None, a fixed amount per loan, or the sum of the items' deposits |
| Late fee per day | Charged once when an overdue loan is closed |
| Late fee cap | Maximum late fee; `0` means no cap |
| Grace days | Days late before a fee starts |
| Deposit blocks issue | Refuse the handover until the deposit is paid |

## Due dates and reminders

Each makerspace's billing settings (`/api/v1/admin/makerspace/<id>/billing-settings`) hold the
payment terms (due on the day a charge is raised, or a number of days later, up to 365) and the
reminder schedule. Bookings and events fall due at their start. Reminders are off by default
(`billing.reminders`) and need the **Notifications** and **Email** modules and the payments email
cell in the notification matrix. The default ladder is three days before, on the due day and seven
days after, capped at two steps; a reminder goes only to the person who owes the money.

## Currencies

Each makerspace has one **default currency**, used for new charges. Changing it never changes
existing charges. Amounts in different currencies are never added together in lists, reports or
dashboards. Currencies with no minor unit (such as JPY) or three decimal places (such as KWD) are
sent to providers correctly.

## Receipts and reports

The **Receipt documents** feature (`billing.documents`, on by default) issues a numbered receipt
whenever a charge is paid, online or offline, and a credit note for refunds and corrections.
Receipts and credit notes share one gapless sequence per makerspace. Set the number prefix, issuer
name, address, identifier, footer and accounting account codes under **Admin → Settings → Receipts
and accounting**. They are
PDF downloads, and the payer gets an email linking to their member page. They are simple
acknowledgements of the gross amount, **not** tax invoices.

Staff with finance access and the **Reports** module can export:

| Report | Contents |
| --- | --- |
| `payments-ledger` | Every charge, settlement, waiver and refund, with correction history |
| `revenue-over-time` | Collected, owed, refunded, waived and net amounts by day, week or month and currency |
| `cash-book` | Offline money in and out by period, method and currency |
| `accounting-journal` | A balanced, generic cash-basis CSV journal for your accounts package |

See [Reports](/guides/reports/).

## Related

- [Membership](/guides/membership/): dues and renewals
- [Events and bookings](/guides/events-and-bookings/): paid events and bookings
- [Security](/configure/security/): back up `API_CLIENT_ENC_KEY`
