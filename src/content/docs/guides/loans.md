---
title: Loans
description: The full hardware lending lifecycle in SpaceWorks, from a member's request through review, issue, return, partial returns and accountability, plus self-checkout, direct handouts, reminders and loan charges.
sidebar:
  order: 5
---

Lending is the heart of SpaceWorks, and it is built around one idea: **every handover leaves
evidence**. A tool cannot leave the shelf without a QR scan and a photo, and it cannot come back
without a photo and a written remark. Everything is written to the audit log.

There are three ways a tool goes out:

| Route | Who starts it | Needs staff review first? |
| --- | --- | --- |
| [Reviewed request](#the-reviewed-request-lifecycle) | A member asks on the public site | Yes |
| [QR self-checkout](#qr-self-checkout) | A checked-in member scans a tool | No |
| [Direct handout](#direct-handouts) | Staff at the counter | No |

All three are recorded through the same request workflow, so reports and history treat them alike.

## The reviewed request lifecycle

```
draft → pending approval → accepted → issued → returned
                         ↘ rejected            ↘ partially returned
                                               ↘ closed with issue
```

Staff work through these stages in **Operate → Requests**, which groups requests into **Pending
review**, **Ready for handover** and **Active loans**, with search by requester name, email, phone or
purpose.

### 1. A member submits a request

On the public catalogue, a member opens an item and asks to borrow it, choosing quantities and giving
a purpose. They can follow its status from their member area.

Who may submit is a makerspace setting:

| Situation | Who can submit |
| --- | --- |
| Membership module installed | Active members of the makerspace only |
| Membership module off (default) | Anyone signed in with an account |
| Membership module off, account-less requests allowed | Anyone, giving a name, email and phone |

Choose between the last two under **Settings → Borrow request access**. Installing the Membership
module switches account-less requests off again. Restricted or suspended accounts cannot borrow, and
if **Lapsed members cannot borrow** is on, neither can members whose plan term has ended.

### 2. Review: accept or reject

You need `accept_request` or `reject_request`.

To review a request:

1. Open it from **Pending review**.
2. To accept, choose how many units of each item to accept (you can accept fewer than asked) and
   confirm. Accepting reserves the stock.
3. To reject, give a reason. The member is told.

Requests are reviewed one at a time; there is no bulk accept. Decisions are only ever made in the
staff console or the control plane. Telegram and chat alerts tell staff a request is waiting but carry
no buttons.

You can also **Set due** to change the return date on an accepted or active request.

### 3. Issue: box scan and issue photo

You need `issue_request` and `upload_evidence` (plus `assign_box` to assign the box).

To issue an accepted request:

1. Open it from **Ready for handover** and choose **Guided issue** (or the assign-and-issue dialog).
2. **Scan the box QR** the items are going out in. A box QR is required.
3. For individually tracked items, **scan each asset QR**.
4. Check every unit. If one is broken, use **Reject as broken** and send it to the **To-be-fixed
   shelf** or remove it from inventory; the rest still go out.
5. **Upload an issue photo** showing what is being handed over.
6. If the box has a kit checklist, count the components.
7. Add a remark if useful and confirm.

The request becomes **issued**, the due date is set from the loan policy, and the member gets their
loan. If you require deposits to be paid before issue, an unpaid deposit blocks this step until it is
settled.

### 4. Return: return photo and remark

You need `return_request` and `upload_evidence`.

To process a return:

1. Open the loan from **Active loans** and choose **Guided return**.
2. **Scan the box QR.** It must match the box the loan went out in.
3. For each item, record how many came back **Returned**, **Damaged** or **Missing**, or leave some as
   **Not returned now**.
4. **Upload a return photo.** The issue photo is shown beside it for comparison.
5. **Write a return remark.** It is required.
6. Submit.

What happens next depends on the outcomes:

| Outcome | Request status |
| --- | --- |
| Some units still out | **Partially returned**. Process the rest later the same way |
| Everything back in good order | **Returned** |
| Everything resolved, but something was damaged or missing | **Closed with issue** |

A return is never blocked by unpaid fees or a lapsed membership.

## Damage, loss and accountability

When a return records damaged or missing units, SpaceWorks writes an **accountability record**
against the borrower, linked to the return photo. These records cannot be edited or deleted.

**Insights → Accountability** (needs `view_audit`) shows overdue loans, problems reported on public
returns, repeat offenders and restricted requesters. Restricting a borrower is a separate decision:
a superadmin can use **Restrict requester** there, with a reason. Nothing is restricted automatically.
See [Roles and permissions](/guides/roles-and-permissions/#restricted-and-suspended-accounts).

SpaceWorks does not raise an automatic charge for damage or loss. If you took a deposit, it stays on
the ledger for staff to refund or keep, as your policy says.

## QR self-checkout

With the **Self checkout** feature on, a member can borrow a tool without waiting for staff:

1. They check in at the makerspace from their member area (they must be an active member with a
   current presence session).
2. On `/m/<slug>/checkout` they scan the tool's QR code.
3. They upload a photo of the tool and confirm.

Only products and asset units marked **Enabled for public self-checkout** can be taken this way, and a
QR that is already checked out is refused. Borrow limits and loan periods still apply, and the loan
appears in **Active loans** like any other. Returning works the same way in reverse, with a return
photo.

## Direct handouts

A direct handout lets staff lend something on the spot, with no prior request. It needs the **Self
checkout** feature and the `issue_direct_loan` action.

To make a direct handout:

1. Open **Operate → Direct handout** and choose **Guided handout**.
2. **Choose the borrower**: select an active member, or scan their member card. If the person is not
   a member yet, use **Add a walk-in** to create a person record with a name and optional contact
   details.
3. **Scan or select the tools**: scan tool or asset QRs, or pick products and quantities. You can also
   attach a container.
4. **Upload an issue photo**, add a remark and confirm.
5. Print the receipt if the borrower wants one.

Returns of direct handouts are processed from the same tab, again with a return photo and remark.

## Loan length, renewals and limits

The loan period comes from the most specific setting available: the product's own loan days, then its
category's, then the makerspace's loan policy (default 7 days). An issue covering several items uses
the shortest period.

**Renewals** need the **Loan renewals** feature and the loan policy's renewal mode set to **Automatic
within policy**. Each renewal extends the due date by the renewal length, up to the maximum renewals
(products and categories can lower that cap). Members renew their own loans from the member area
when the Membership module is on; staff renew from **Active loans**. A renewal is refused if the
borrower is restricted, their membership has lapsed, the renewal count is used up, or someone else is
waiting for the item.

**Borrow limits** need the **Borrow limits** feature. The loan policy's maximum active loans and
maximum outstanding items (0 means unlimited) are checked when a request is submitted and again at
handover. A membership plan can set its own limits.

All of these are set as described in
[Set up your makerspace](/guides/makerspace-setup/#loan-policy-defaults).

## Overdue loans and reminders

Once a loan policy is saved, borrowers get reminder emails at the offsets you set (in hours relative
to the due time; the default is one reminder at the due time). Set **Escalate to staff after days
overdue** to alert staff about long-overdue loans.

Reminders go only to the borrower's own verified address and need the `email` module and a working
mail setup. Overdue loans are also listed in **Insights → Accountability** and **Operate → Ledger**.

## Deposits and late fees

With **Track loan charges** on (it is by default), you can record:

- **Deposits**: none, a fixed amount per loan, or a per-product amount. Optionally, require the
  deposit to be paid before the items can be issued.
- **Late fees**: an amount per day late, an optional cap, and grace days before fees start.

Set these with the payment settings in **Admin → Settings**. The late fee is calculated once, when the
loan comes back. A deposit that was never paid is cancelled when the loan closes.

Charges are recorded whether or not you take online payments. Staff with `record_payment` settle them
in person; with the `payments` module and the **Loan deposits and late fees** feature, members can pay
online. See [Payments](/configure/payments/).

## Related

- [Inventory and QR codes](/guides/inventory-and-qr/)
- [Kiosk and front desk](/guides/kiosk/)
- [Roles and permissions](/guides/roles-and-permissions/)
- [Membership](/guides/membership/)
