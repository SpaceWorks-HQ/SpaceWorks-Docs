---
title: Evidence retention
description: Decide how long handover photo bytes are kept, what SpaceWorks keeps forever, what an expired photo looks like, and how optional cleanup of never-used uploads works.
sidebar:
  order: 7
---

Every handover in SpaceWorks leaves evidence: QR scans, issue and return photos, remarks and audit
entries. Photos are the bulky part. Retention lets you delete old **photo bytes** from storage after
a set time while keeping the **record** of each handover forever. Both cleanup mechanisms are off by
default; nothing is deleted until you turn them on.

## What is kept and what can expire

| Kept forever | Can expire |
| --- | --- |
| The evidence photo record: who uploaded it, when, for which request, its type and storage key | The image file in object storage, including all its stored versions |
| Remarks and return notes | |
| QR scan history | |
| The audit log (append-only) | |

Evidence records are immutable. Expiry never edits or deletes the record, and the database itself
refuses such changes. The accountability trail (who handed what to whom, when, with what remark)
survives; only the picture goes.

:::caution
Expiry is irreversible in live storage. Backups taken before expiry may still contain the photos and
could bring them back on restore, so retention limits what is kept live; it is not erasure from your
backups.
:::

## Photo expiry

### Turn it on for the deployment

Set these in your environment (all are passed through by the bundled Docker stack), then apply
the change as described in [The `.env` file](/install/docker-compose/):

```bash title=".env"
EVIDENCE_OBJECT_EXPIRY_ENABLED=True
# Default age in days for every makerspace (30 to 3650)
EVIDENCE_OBJECT_RETENTION_DAYS=365
# Photos per makerspace per sweep (1 to 1000)
EVIDENCE_RETENTION_BATCH_SIZE=100
```

Out-of-range values stop the backend at startup, so a typo cannot silently delete photos early.

### Override per makerspace

Staff who manage a makerspace open **Admin → Settings → Evidence photo retention**:

- **Retention days** sets an override between 30 and 3650 days. **Use platform default** removes it.
- The panel shows whether automatic expiry is enabled on this deployment.
- A **preview** shows how many photo objects and how many bytes are already old enough, before
  anything is deleted. You can set and preview a policy while expiry is still switched off.

### How the sweep works

A background job runs every six hours (at 10 minutes past). For each makerspace it takes a bounded
batch of photos older than the effective window, marks each one as **expiring** so no workflow can
attach it, deletes every stored version of both the final file and its staging copy, and only after
storage confirms the deletion marks the photo **expired** and writes an `evidence.object_expired`
audit entry. Storage quota on hosting platforms is released once.

If deletion fails (network, permissions, or a provider that cannot list object versions), the photo
is retried on a later sweep rather than recorded as expired. The sweep does not run while a
deployment restore is in progress.

### What people see afterwards

An expired photo still appears in the request timeline with its metadata. Opening it returns
`410 Gone` with an expired state instead of an image, without contacting storage. Backups and tenant
migrations treat expired photos as deliberately absent rather than as missing data.

Monitor the sweep with the `spaceworks_evidence_retention_states` and
`spaceworks_evidence_retention_last_expiry_timestamp_seconds` metrics (see
[Monitoring](/configure/monitoring/)).

## Abandoned-upload cleanup

A photo upload slot is created as soon as staff start a handover. If the form is cancelled, an
unused slot (and possibly an uploaded file) is left behind. Abandoned-upload cleanup removes these,
and only these.

It needs **two switches**, both off by default:

1. **Deployment:** `EVIDENCE_ABANDONED_UPLOAD_CLEANUP_ENABLED=True`, with a default age in
   `EVIDENCE_ABANDONED_UPLOAD_RETENTION_DAYS` (default 7, range 1 to 3650; it must be longer than the
   upload link lifetime, `EVIDENCE_URL_TTL_SECONDS`).
2. **Makerspace:** in **Evidence photo retention → Abandoned upload cleanup**, tick **Clean up
   never-used uploads for this space** and optionally set **Abandoned upload age (days)**.

What it will and will not delete:

- It deletes only upload slots that SpaceWorks has **proven** were never used by any handover,
  self-checkout, direct handout or problem report.
- Attached evidence is never deleted.
- Photos recorded before this feature existed, and photos brought in by an import, are never
  eligible.
- Each deletion leaves a permanent receipt and an `evidence.abandoned_upload_deleted` audit entry.

The cleanup job runs every six hours (at 40 minutes past). An upload that finishes after its slot
was cleaned is caught too: the job keeps re-checking those storage keys and deletes late arrivals,
even after you switch cleanup off.

## Choosing a policy

- Keep photos at least as long as you might need them to resolve a dispute about damaged or missing
  hardware.
- Shorter windows save storage and reduce how much personal imagery you hold; check any local data
  protection rules that apply to you.
- Abandoned-upload cleanup is low risk and mainly saves storage; enable it once you are comfortable
  with the preview numbers.

## Related

- [Object storage](/configure/object-storage/)
- [Loans](/guides/loans/): where evidence is captured
- [Backup and restore](/install/backup-restore/)
