---
title: Inventory and QR codes
description: Add products, categories and asset units, organise boxes and containers, generate, print and revoke QR labels, control what the public sees, and import inventory from a spreadsheet.
sidebar:
  order: 4
---

Your inventory is the catalogue of things people can borrow, and QR codes are how Space Works proves
which physical box or tool changed hands. This guide covers setting both up. Handing things out is in
[Loans](/guides/loans/).

You need `edit_inventory` to change the catalogue and `manage_qr` for QR tools, containers and the
scanner. Inventory Managers and Space Managers hold both.

## The building blocks

| Thing | What it is | Where you manage it |
| --- | --- | --- |
| **Category** | A grouping on the public catalogue, with an optional icon and display order | **Inventory → Categories** |
| **Product** (inventory item) | One kind of thing: "Cordless drill", with quantities and visibility settings | **Inventory → Inventory** |
| **Asset unit** | One individually tracked unit of a product: "Drill #3", with its own asset tag, serial number and QR | Inside a product (needs the `asset_units` module) |
| **Box / container** | A physical container with its own QR code. Every reviewed loan is issued in a box | **Inventory → Containers** (needs the `containers` module) |
| **Storage location** | A free-text note on a product or container saying where it lives | The product or container form |

Storage locations, box IDs, QR codes and scan history are staff-only. They never appear on the public
catalogue.

## Add a category

1. Open **Inventory → Categories**.
2. Enter a name and slug, and optionally an icon and an order number.
3. Save. Categories can also carry a default loan period and renewal cap that apply to their
   products (see [Loans](/guides/loans/#loan-length-renewals-and-limits)).

## Add a product

1. Open **Inventory → Inventory** and choose **Add item**.
2. Fill in the product master data: name, category, description, manufacturer, model, barcode and
   supplier company. Keep personal supplier contacts out of this form.
3. Choose a **Tracking mode**:
   - **Quantity**: you track how many you have ("4 drills"). Simple, and fine for consumables and
     identical tools.
   - **Individual**: each unit is an asset with its own tag and QR, so you know exactly which unit
     went out.
4. Set the **Total quantity** and **Storage location**.
5. Set the public visibility options (see [below](#public-visibility)) and any **Public borrowing
   terms** text you want shown on the item page.
6. Optionally set a **Reorder point** and **Reorder quantity**. A reorder point of 0 turns low-stock
   alerts off; a reorder quantity lets Space Works draft a procurement entry.
7. Save. The item opens for editing so you can upload a photo.

Each product page also shows its lending history, QR history and, for individual tracking, its asset
units.

### Quantities and the to-be-fixed shelf

Space Works keeps available, reserved, issued, damaged, lost and to-be-fixed counts for you. You do not
edit "available" by hand: it changes when requests are accepted, issued and returned.

When you need to correct stock, use **Adjust quantities** with a reason. To take broken units out of
circulation, use **Move to Fix Shelf**; they stay in the total but are never available. **Inventory →
To-be-fixed** lists everything awaiting repair, and **Move back to inventory** returns repaired units.
Staff can also send broken units straight to this shelf while issuing.

**Archive item** hides a product you no longer lend without deleting its history. **Show archived**
brings archived items back into view. You can export the inventory list as CSV or XLSX from the same
screen.

## Public visibility

Each product has three settings that decide what visitors see on `/m/<slug>`.

| Setting | Default | Effect |
| --- | --- | --- |
| **Public** | On | Off removes the product from the public catalogue entirely |
| **Public visibility** | Status only | **Exact count**, **Status only** or **Hidden** |
| **Show count** | Off | A safety switch: an exact number is only shown when this is also on |

How they combine:

- **Hidden**: the product is listed but shows no availability.
- **Status only**: the product shows a label (see below).
- **Exact count**: shows the number available, but **only** if Show count is on. Otherwise it falls
  back to the status label.

The status label is worked out from the live counts:

| Label | When |
| --- | --- |
| **Unavailable** | Nothing available, or a total of zero |
| **Limited** | Available is at or below 20% of the total (rounded up) |
| **Available** | Anything more |

So a product with 10 units and 2 available shows **Limited**; with 3 available it shows **Available**.

The whole catalogue can also be switched off with **Show public inventory** in
**Settings → General**, which deletes nothing.

:::tip
"Status only" is the default for a reason: it tells people whether to come in without revealing that
you own exactly one very expensive oscilloscope.
:::

## Boxes and containers

Every reviewed loan is issued in a **box**: staff scan the box QR at issue and again at return, so the
scan history shows where things went. With the `containers` module, boxes can nest (a box inside a
shelf inside a room).

In **Inventory → Containers** you can, for each container:

- edit its label and location, or mark it inactive;
- see its contents (products, asset units and sub-containers) and its scan history;
- define kit components, if the **Kit checklists** feature is on, so staff count the parts at issue
  and return.

:::note
Creating new box records is not yet exposed as a button in the staff console. A superadmin can add
them from the control plane at `/control/`, or an integration can create them through the API.
:::

## Generate and print QR labels

QR codes can point at a **box**, a **product** or an **asset unit**. Every QR code is an opaque string;
it carries no information on its own.

To print labels for individually tracked units:

1. Open **Inventory → QR Tools** (needs the `qr_print_batches` module).
2. Create a QR print batch, giving it a title.
3. Choose the inventory item, a unit count and an optional label prefix, then generate the missing or
   new unit QRs. Use **Add/reprint item QR** for a product-level label, or reprint an existing unit's
   label.
4. Use **Download all (ZIP)** to get the label images for printing.

Batches are kept, so you can come back and download a sheet again. Without the `qr_print_batches`
module, a single unit's QR can still be shown and reprinted from its container's contents list.

## Scan and look up

**Inventory → Scanner** (or the standalone scanner page at `/scanner`) resolves any QR payload, typed,
pasted or read with the camera, to its box, product or asset. From the result you can see a box's
contents and, with `manage_qr`, act on the QR. Every scan is recorded and scan records cannot be
edited.

## Revoke or rebind a QR

If a label is lost, damaged or stuck on the wrong thing:

1. Scan or paste it in **Inventory → Scanner**.
2. Choose **Revoke QR**. A revoked code stops resolving for handovers and self-checkout.
3. Generate a replacement label for the box, product or asset.

The scanner can also re-point a QR at a different target where that is allowed. Revoked codes and
their history are kept.

## Public self-checkout

If the **Self checkout** feature is on, members who are checked in at the space can borrow eligible
tools themselves by scanning the tool's QR on the public site and uploading a photo. Eligibility is
per product and per asset: tick **Enabled for public self-checkout** (or use **Enable public QR**) on
the items you trust people to take without staff. See [Loans](/guides/loans/#qr-self-checkout).

## Import inventory from a spreadsheet

With the `bulk_import` module installed, **Inventory → Bulk import** loads many items at once:

1. Upload a CSV or XLSX file, or paste a table.
2. Map your columns to Space Works fields (or mark a column **Do not import**).
3. Preview. The preview lists rows to create or update, with errors and warnings.
4. Apply.

An **Advanced JSON** mode accepts rows as JSON for scripted imports. Without the module, items are
added one at a time in the console or through the API.

## Stocktake, transfers and procurement

- **Stocktake** (`stocktake` module): open a session, scan through the shelves, review variance and
  commit the adjustment. The **Stocktake discipline** feature adds blind counts, variance thresholds
  and a second manager's approval for large differences.
- **Transfers** (`stock_transfers` module): move stock between locations. Moving stock between
  makerspaces needs the superadmin.
- **To Buy** (`procurement` module): keep a to-buy list, attach receipts and move purchased items into
  stock. **Add to To Buy** on a product drafts an entry.

## Related

- [Loans](/guides/loans/)
- [Kiosk and front desk](/guides/kiosk/)
- [Reports and audit](/guides/reports/)
- [Modules](/guides/modules/)
