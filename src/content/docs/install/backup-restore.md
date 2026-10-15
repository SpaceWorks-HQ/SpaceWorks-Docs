---
title: Backup and restore
description: What SpaceWorks backs up, how to schedule and download encrypted archives, copy them offsite, restore a server, and move one makerspace to another deployment.
sidebar:
  order: 10
---

SpaceWorks has a built-in backup system that captures the database **and** the uploaded files
together, encrypts them, and can restore them with safety checks along the way. This page covers
how to use it, what you must keep off the server, and how to move a single makerspace to another
deployment.

## What gets backed up

| Kind | Contains | Who can create it |
| --- | --- | --- |
| **Full deployment archive** | Every makerspace's data, the uploaded files (evidence photos, print files, documents, images) and the server's continuity secrets (the keys needed to read encrypted data) | Superadmin |
| **Makerspace archive** | One makerspace's data | Superadmin, or staff who can manage that makerspace |
| **Pre-update database dump** | The database only, as SQL, taken automatically before every update | The updater |

Archives are encrypted with [age](https://age-encryption.org/) to the server's backup key and
signed, so a tampered archive is refused at restore time. They're stored in the server's private
object storage until they expire.

Only **full deployment archives** can be restored. Makerspace archives are downloadable copies of
one makerspace's data.

:::caution
A downloaded archive is a complete copy of production data. Once it's outside SpaceWorks, deleting
a makerspace doesn't delete it, so keep downloaded copies somewhere safe and delete them when you no
longer need them.
:::

## Keep these off the server

A backup is only useful if you can decrypt it. Setup created the encryption key on the server
itself, so copy these somewhere safe **today**, for example an encrypted password vault:

| What | Where | Why |
| --- | --- | --- |
| Backup age identity | `/var/lib/spaceworks/ops/work/age-identity.txt` | Decrypts every archive. Without it, archives are unreadable. |
| `.env` | The install directory | Holds the archive signing keys and `API_CLIENT_ENC_KEY`, which decrypts stored integration credentials |

Both are secrets: anyone holding the identity and an archive can read all your data. The identity
file belongs to the app's container user, so read it with `sudo`:

```bash
sudo cat /var/lib/spaceworks/ops/work/age-identity.txt
```

## Schedule automatic backups

Automatic backups are **off** by default. As the superadmin, open the staff console at
**Admin → Backup & restore** and, under **Deployment backup and restore**:

1. Tick **Create a full deployment archive each day**. The archive is built around 02:00 UTC.
2. Set **Archive retention (days)**: how long archives are kept on the server. The default is 30 days
   (1–3650). Expired archives are removed nightly.

The panel shows when the last archive succeeded and the last error, if any.

## Create and download an archive now

On the same screen, choose **Create full deployment archive**. The archive is built in the
background; its row shows `pending`, then `running`, then `available` with its size. Choose
**Download** to save the encrypted `.tar.age` file. The download link is short-lived.

Makerspace managers see a **Makerspace backups** section on the same tab with
**Create makerspace archive**.

## Copy archives offsite

Archives stored on the server don't help if the server is lost. Add an **offsite destination** and
every new full deployment archive is pushed there automatically and verified:

1. Open the control plane at `/control/` (see [First run](/install/first-run/#the-control-plane-at-control)).
2. Add a **backup destination**: an S3-compatible bucket on AWS, Cloudflare R2, Supabase Storage or
   MinIO, with its endpoint, bucket, region, optional prefix and access keys. The keys are stored
   encrypted and never shown again.
3. Set the destination's **retention** (default 90 days).

Use a bucket at a different provider or site from the server, and give its keys write access to
that bucket only.

## Restore on the same server

Restoring replaces the live database and files with the archive's contents. It runs in two halves:
the request in the staff console and a privileged supervisor on the server.

1. As the superadmin, in **Admin → Backup & restore**, pick an `available` full deployment archive
   and choose:
   - **Rollback here** to roll this server back to that point in time; or
   - **Disaster restore** to rebuild after a serious incident.
2. Find the restore operation's ID in the control plane under **Restore operations**.
3. On the server, under Linux or WSL2, run the restore supervisor as root:

   ```bash title="In /opt/spaceworks"
   sudo bash scripts/restore.sh <restore-id>
   ```

4. The supervisor checks the archive's signature and compatibility **before** changing anything,
   stops the app's writers, takes its own pre-restore snapshot, then prepares the restore.
5. Back in the console, review the comparison of live and archived data, table by table. Within the
   decision window (5 minutes by default) choose **Proceed**, **Proceed and reset authority** (signs
   everyone out and invalidates restored credentials) or **Abort safely**.
6. The supervisor restores the database and files and checks readiness. If anything fails part-way,
   it uses its rollback journal to put things back.

A **disaster restore** leaves the server in quarantine: the superadmin must finish the recovery
steps and acknowledge the remaining risk before normal use resumes.

:::note[Limits]
- Restore needs Linux or WSL2. It refuses to run under native Windows.
- In-place restore isn't supported on the [single box](/install/single-box/).
- Some newer archive formats need their dedicated host coordinator; `restore.sh` tells you if it
  can't handle an archive. Don't try to force it.
:::

## Restore onto a new server

If the original server is gone:

1. Install SpaceWorks on the new server with the [one-line install](/install/one-line-install/),
   using the same hosting, HTTPS and storage choices.
2. Copy the **original** server's backup age identity next to the new one, without overwriting the
   new server's own identity (the new server keeps encrypting future backups to that one):

   ```bash
   sudo install -m 600 -o 10001 -g 10001 original-age-identity.txt \
     /var/lib/spaceworks/ops/work/original-age-identity.txt
   ```

3. Copy the archive onto the server. If it's only in your offsite bucket, the
   `fetch_offsite_archive` management command can list, download and verify it; run it with `--help`
   for its options.
4. Import it, pointing at the original identity and naming a superadmin on the new server. Add the
   archive's SHA-256 as a third argument if you recorded it:

   ```bash title="In /opt/spaceworks"
   sudo BACKUP_AGE_IDENTITY_FILE=/var/lib/spaceworks/ops/work/original-age-identity.txt \
     bash scripts/import-backup.sh /path/to/archive.tar.age admin
   ```

The import decrypts and checks the archive, installs its continuity secrets into `.env` (keeping
your previous file as `.env.pre-restore-<timestamp>`), records a restore, and hands over to
`restore.sh` to finish as above. The identity file must sit inside `/var/lib/spaceworks/ops/work`,
because that's the only part of the host the app's container can read.

:::tip[Practise first]
Do a trial restore onto a spare machine before you need it for real. An archive you've never
restored is only a hope.
:::

## Pre-update database dumps

Every update writes `backups/pre-update-<timestamp>.sql.gz` in the install directory before it
changes anything, and dumps older than 14 days are deleted. They hold the database only, not
uploaded files, and restoring one is a manual job. See
[Updates](/install/updates/#if-you-need-the-pre-update-database-back).

## Move a makerspace to another deployment

A makerspace that started as a tenant on someone else's server can move to its own, taking its
data, its people's details (with approval) and its uploaded files. Superadmins on both servers do
this from **Admin → Tenant migration** in the staff console; no shell is needed.

In outline:

1. **Review who travels.** On the source, a superadmin reviews the list of people whose contact
   details would be included and approves each one. Anyone not approved travels as an anonymous
   reference instead. If the list changes, the approval no longer counts.
2. **Pair the deployments.** Each side shows its deployment identity (ID, fingerprint and age
   recipient). Pin the source and target identities to each other.
3. **Export.** The source creates an archive encrypted to the target's recipient. Download the
   one-use archive.
4. **Freeze the source.** Quiesce the makerspace on the source so nothing changes after the export.
   It stays frozen through cutover.
5. **Import and verify.** On the target, upload the archive and enter its digest from the source.
   Review the identities, run the import, and check the result. The new makerspace stays in an
   importing state, closed to users, until you activate it.
6. **Cut over.** Activation needs a signed receipt from the source, so only one side is ever live.
   The source makerspace is then **archived, not deleted**.

If you abort on the target instead, its signed abort receipt lets the source recover and reopen.
Activation can't be undone from the screen, so verify the imported makerspace carefully first.
Staff invitations and sign-in credentials don't travel: staff are invited again on the new server.

## Next steps

- [Updates](/install/updates/)
- [Evidence retention](/configure/evidence-retention/)
- [Troubleshooting](/help/troubleshooting/)
