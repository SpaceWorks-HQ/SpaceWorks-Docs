---
title: Reports and audit
description: Use Space Works reports and charts, export CSV and XLSX, schedule report deliveries, read the outstanding-loans ledger and audit log, and request a full makerspace data export.
sidebar:
  order: 10
---

Space Works records everything that happens, so most questions ("what is out right now?", "who keeps
returning things damaged?", "how busy were the printers last month?") already have an answer. This
guide shows where to find it.

| Screen | Tab | Needs |
| --- | --- | --- |
| Reports and charts | **Insights → Reports** | The `reports` module, plus `view_audit`, `view_finance`, `manage_printing` or `manage_machines` depending on the report |
| Outstanding loans | **Operate → Ledger** | `view_inventory` |
| Damage, loss and overdue | **Insights → Accountability** | `view_audit` |
| Audit log | **Insights → Audit log** | `view_audit` |
| Payments | **Operate → Payments** | `view_finance` or `record_payment` |
| Full data export | **Admin → Data export** | `manage_makerspace` |

## Reports

**Insights → Reports** shows a catalogue of reports supplied by the server. You only see reports for
modules your makerspace has installed and actions you hold. Each report can be filtered by date range
and other fields, and is shown as an accessible chart with a table alongside.

### Available reports

| Area | Reports |
| --- | --- |
| Lending | Summary, taken items, active loans, returns, damaged and missing, damaged and lost, most lent, top borrowers, recently added, QR scans, loan throughput |
| Inventory | Inventory control, import quality, procurement performance, evidence compliance |
| Machines | Machine usage, machine service, printer service, maintenance activity, certification coverage |
| Events and bookings | Event attendance, booking utilization |
| Members | Member activity, community engagement, member retention, membership revenue |
| Money | Payments ledger, payment reconciliation, revenue over time, cash book, accounting journal |
| Operations | FabLab health, communications health, module operational health, audit trail |

Money reports need `view_finance`. Membership retention and revenue need the Membership module, and
revenue (MRR/ARR) is a projection from current plan prices, separate from money actually collected.
Months follow the makerspace's timezone.

Every installed module is covered either by its own report or by a row in the module operational
health report, so nothing you run is invisible.

### Export CSV or XLSX

Choose **Export CSV** or **Export XLSX** on a report. Every export carries a provenance record (who
generated it, when, for which makerspace, the report version and the filters used) as the first line
of a CSV or a **Provenance** sheet in XLSX, so a file found later can be traced.

The inventory list and several other staff lists have their own export buttons too.

### Saved views

With the **Saved report views** feature (on by default), save a report's filters and visible columns
as a named view. A manager can **share with makerspace** so other staff can open it. Opening a shared
view still checks that you are allowed to see the report.

### Schedule a report

To have a report delivered regularly:

1. In **Insights → Reports**, start a new report schedule.
2. Pick the report, a **cadence** (daily, weekly or monthly), the format, and the time window.
3. Choose recipients: a **chat destination**, a list of **recipient emails**, or staff by **recipient
   role slugs** or **recipient actions** (resolved when the report is sent, so new staff are included
   automatically).
4. Optionally **send only when non-empty**, or set a **threshold** on a metric so the report is only
   sent when it matters.
5. **Save schedule**.

Recipients get a short-lived private download link, not an attachment.

## The outstanding-loans ledger

**Operate → Ledger** lists every item currently out: holder, item, quantity, when it went out and when
it is due, with overdue loans flagged. Search by holder, email, item or box. It covers reviewed loans,
direct handouts and self-checkouts together.

## Accountability

**Insights → Accountability** brings together overdue loans, problems reported on public returns,
repeat offenders with damage or loss records, and requesters who are currently restricted. See
[Loans](/guides/loans/#damage-loss-and-accountability).

## The audit log

Every state-changing action in Space Works writes an audit entry: who did it, what, to which record and
when. The log is append-only; entries cannot be edited or deleted.

**Insights → Audit log** lets you filter by action, actor, target, source and date range. Each loan
also has a timeline combining its audit entries, scans and evidence state.

You can run an **integrity verification** over a range of the log. It checks the entries and reports
either **Fully verified** or the integrity problems it found.

## Payments

**Operate → Payments** lists charges (loan deposits and late fees, bookings, events, machine jobs and
dues) with their status. Staff with `record_payment` record money received in person, choosing the
method and reference, and the receipt is kept on an append-only ledger. Read-only finance staff see the
amounts without the controls. See [Payments](/configure/payments/).

## Full makerspace data export

**Admin → Data export** produces a downloadable archive of the makerspace's data. Read the on-screen
disclosure first: a full export contains member contact details. Choose **Request redacted export** for
a version with personal details withheld. Exports run in the background; the list shows when each one
is ready to download.

For whole-makerspace backups and archives, see [Backup and restore](/install/backup-restore/).

## Public statistics

If you switch on the **Public stats page** in Settings, `/m/<slug>/stats` shows aggregate figures to
the public. **Public borrower names** separately controls whether any names appear there.

## How figures stay consistent

Closed periods are stored as metric rollups that are never rewritten. If a figure has to be corrected,
a new revision is added instead, so a report you exported last month still matches the history.

## Related

- [Loans](/guides/loans/)
- [Roles and permissions](/guides/roles-and-permissions/)
- [Organizations](/guides/organizations/#organization-analytics)
- [Monitoring](/configure/monitoring/)
