---
title: Object storage
description: Configure the S3-compatible storage SpaceWorks uses for evidence photos, files and public images, including the two endpoint URLs, the private and public buckets, CORS and presigned uploads.
sidebar:
  order: 4
---

SpaceWorks keeps files in S3-compatible object storage, not in the database: handover evidence
photos, 3D print files, machine and warranty documents, receipts, report deliveries, backup archives,
and public images such as item photos and makerspace logos. Object storage is required; there is no
mode that runs without it.

You can use the bundled **Silo** container (the maintained fork of MinIO, installed by default) or
any external S3-compatible service such as AWS S3, Cloudflare R2, Backblaze B2, Wasabi or Supabase
Storage.

## Two buckets

| Bucket | Variable | Default | Access | Holds |
| --- | --- | --- | --- | --- |
| Private | `AWS_STORAGE_BUCKET_NAME` | `evidence` | Private. Every read and write uses a short-lived signed URL. | Evidence photos, print files, documents, receipts, exports, backups |
| Public | `PUBLIC_IMAGE_BUCKET` | `public-images` | Anonymous read | Item photos, makerspace logo and cover images, published member profile images |

The two names must differ; SpaceWorks refuses to start otherwise, so a public-read policy can never
apply to evidence. Keep evidence and documents out of the public bucket.

Inside the private bucket, files are separated by key prefix (module, makerspace and resource), not
by one bucket per makerspace. Object keys are identifiers, not secrets: privacy comes from the
private bucket and the signed URLs, which expire after five minutes by default
(`EVIDENCE_URL_TTL_SECONDS`, `PRINT_URL_TTL_SECONDS`, `PUBLIC_IMAGE_URL_TTL_SECONDS`).

## Two endpoint URLs

| Variable | Who uses it | Example |
| --- | --- | --- |
| `AWS_S3_ENDPOINT_URL` | The backend, server to server | `http://minio:9000` inside Compose |
| `AWS_S3_PUBLIC_ENDPOINT_URL` | Browsers, inside presigned upload and download URLs | `https://files.makerspace.example.org` |

Uploads go **directly from the browser to storage**, so the public endpoint must be reachable from
your users' browsers. It must never be `localhost` on a real deployment, and it must be HTTPS when
your site is HTTPS, or browsers block the upload as mixed content. A presigned URL is signed for a
specific host, so for an external provider both endpoints are usually the same S3 API address.

`PUBLIC_IMAGE_BASE_URL` is a third address: the browser URL at which objects in the public bucket
can be read, for example `https://files.makerspace.example.org/public-images` or an R2 public
domain.

## How uploads work

1. The browser asks the API for an upload slot.
2. The API returns a presigned request restricted to one key, one content type and a size limit.
3. The browser uploads straight to storage.
4. When the workflow uses the file (for example a handover is issued), the backend checks it.

`STORAGE_PRESIGN_METHOD` chooses the style:

| Value | Style | Use with |
| --- | --- | --- |
| `post` (default) | Browser POST policy with a size range enforced by storage | Silo/MinIO, AWS S3 |
| `put` | Presigned PUT; the backend re-checks size when the file is attached | Cloudflare R2, Supabase Storage |

Evidence photos are uploaded to a `staging/` copy of their key and moved to the final key exactly once
when a handover attaches them. The final key is never writable from a browser, so an accepted photo
cannot be swapped through a still-valid upload link.

Size and type limits: evidence and public images must be JPEG, PNG or WebP (10 MB each by default);
print files accept common model and toolpath formats up to 100 MB. See
[Environment variables](/configure/environment-variables/#object-storage) for every limit.

## Bundled storage (Silo)

The installer creates both buckets, turns on versioning for both, makes the private bucket private
and the public bucket anonymous-read. It uses `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` as the
backend's credentials unless you set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

| Site served over | Browser endpoint the installer sets |
| --- | --- |
| HTTPS with built-in Caddy | `https://files.<your-domain>`; Caddy serves this host and forwards it to Silo. Create a DNS record for it. |
| HTTPS behind your own proxy | Forward `files.<your-domain>` to `127.0.0.1:9000` yourself. |
| Plain HTTP | `http://<server>:9000` |

Other settings for bundled storage:

- `MINIO_CORS_ALLOWED_ORIGINS` sets which origins may upload. It defaults to `*`; set it to your
  website origin(s), comma-separated.
- The storage console listens on `127.0.0.1:9001`. Keep it private.
- Configure upload-size limits on any proxy in front of storage so 100 MB print files fit.

## External S3-compatible storage

Choose **External S3-compatible buckets** during setup, or set these yourself:

```bash title=".env (Cloudflare R2 example)"
AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
AWS_S3_PUBLIC_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
AWS_S3_REGION_NAME=auto
AWS_ACCESS_KEY_ID=<access-key-id>
AWS_SECRET_ACCESS_KEY=<secret-access-key>
AWS_STORAGE_BUCKET_NAME=makerspace-evidence
PUBLIC_IMAGE_BUCKET=makerspace-public-images
PUBLIC_IMAGE_BASE_URL=https://images.example.org
STORAGE_PRESIGN_METHOD=put
```

With external storage the bundled Silo container is not started. The installer never changes your
provider's bucket settings, so set these up in the provider's dashboard:

1. **Two buckets** with different names.
2. **Private bucket:** no public access.
3. **Public bucket:** anonymous read, exposed at the URL you put in `PUBLIC_IMAGE_BASE_URL`.
4. **Versioning** on both, if your provider supports it.
5. **CORS** on both buckets, allowing your website origin(s) to `GET`, `PUT`, `POST` and `HEAD`
   with any request headers. Without it, uploads fail in the browser.
6. **Credentials** limited to these two buckets.

Provider notes:

- **Cloudflare R2:** use the S3 API endpoint (`…r2.cloudflarestorage.com`) for **both** endpoint
  variables, region `auto` and `put`. Do not use an `r2.dev` or custom public domain as an endpoint;
  use it only for `PUBLIC_IMAGE_BASE_URL`.
- **Supabase Storage:** use its S3 endpoint and `put`.
- **AWS S3:** use `https://s3.<region>.amazonaws.com` and the matching `AWS_S3_REGION_NAME`.
- SpaceWorks uses **path-style** addressing (`https://endpoint/bucket/key`) and Signature V4. The
  provider must accept both.

:::tip
Evidence expiry deletes every stored version of a photo, so it needs a provider that supports
listing object versions. See [Evidence retention](/configure/evidence-retention/).
:::

## Troubleshooting

| Symptom | Usual cause |
| --- | --- |
| Upload fails with a CORS error in the browser console | Bucket CORS (or `MINIO_CORS_ALLOWED_ORIGINS`) does not include your site origin. |
| Upload works on the server but not for users | `AWS_S3_PUBLIC_ENDPOINT_URL` points at `localhost` or a private address. |
| Upload blocked as mixed content | Site is HTTPS but the storage endpoint is HTTP. |
| `SignatureDoesNotMatch` | Public endpoint differs from the host the URL was signed for, or a proxy rewrites the `Host` header. |
| Item photos do not show | `PUBLIC_IMAGE_BASE_URL` is wrong or the public bucket is not anonymous-read. |
| Startup error about bucket names | `PUBLIC_IMAGE_BUCKET` equals `AWS_STORAGE_BUCKET_NAME`. |

## Related

- [Evidence retention](/configure/evidence-retention/)
- [Domains and TLS](/install/domains-and-tls/): the `files.` host name
- [Backup and restore](/install/backup-restore/): back up the `minio_data` volume too
