---
title: Cloud and split deployments
description: What Space Works supports on cloud providers today — a VPS, a website on Netlify, external object storage, hosted-platform mode — and what is not ready yet.
sidebar:
  order: 7
---

Space Works is built to be self-hosted with Docker Compose. "Cloud" for Space Works therefore usually
means running that same stack on a rented server, optionally moving the website and the files to
managed services. This page sets out what is supported today and what isn't.

| Option | Status |
| --- | --- |
| [The standard stack on a cloud VPS](#a-cloud-vps) | Supported. The recommended way to run in the cloud. |
| [Website on Netlify (or another static host)](#website-on-netlify) | Supported, with the API in API-only mode. |
| [External S3-compatible storage](#external-object-storage) | Supported: AWS S3, Cloudflare R2, Supabase Storage and others. |
| [Hosted platform (multi-tenant SaaS mode)](#hosted-platform-mode) | Supported on your own server through the installer. |
| [Managed Postgres such as Supabase](#managed-postgres) | Settings exist, but there is no supported install path; demo or pilot use only. |
| [Render Blueprints](#render-blueprints) | Present in the repository but **not deployable today**. |

## A cloud VPS

Any Linux virtual server that meets the [requirements](/install/requirements/) works: a
DigitalOcean droplet, a Hetzner or AWS instance, an Oracle ARM VM and so on. Run the
[one-line install](/install/one-line-install/) on it exactly as you would at your makerspace and
pick **Automatic HTTPS**.

Open only ports 80 and 443 in the provider's firewall. The database, Redis, storage console and the
backend itself are never published on public ports.

## Website on Netlify

The repository's `netlify.toml` builds only the React website. It never touches the Docker files and
doesn't need to reach your server at build time.

1. **Install the API.** Run the installer and answer **No, API only** to the website question. Enter
   your site's HTTPS address (for example `https://tools.example.org` or
   `https://your-site.netlify.app`) when asked for site URLs, and choose **Automatic HTTPS** or your
   own proxy for the API domain. The installer sets CORS and CSRF and registers the first site URL as
   your makerspace's verified domain.
2. **Create the Netlify site** from your copy of the repository. `netlify.toml` already sets the base
   directory `frontend`, the build command `npm run build`, the publish directory `dist`, Node 22, and
   the catch-all rewrite to `index.html` that client-side routes such as `/m/<slug>` and `/admin`
   need.
3. **Set `VITE_API_URL`** in Netlify's environment variables to `https://<your-api-domain>/api`,
   then deploy.

Both sides must use HTTPS: sign-in cookies are sent cross-site, which browsers only allow on secure
connections. Object storage URLs must be public HTTPS addresses too, because they are embedded in
upload links and image `src` attributes. A `localhost` storage address gives a site whose images
only work on the server itself.

Cloudflare Pages and similar static hosts work the same way: build `frontend`, publish `dist`, add
the same rewrite, and set `VITE_API_URL`.

## External object storage

Choose **External S3-compatible buckets** during setup to keep files with a cloud provider instead
of on the server. You need two buckets:

| Bucket | Access | Holds |
| --- | --- | --- |
| Private (default name `evidence`) | Private | Evidence photos, print files, documents and backup archives |
| Public images (default `public-images`) | Public read | Item photos and makerspace logo and cover images only |

In the provider's dashboard, for **each** bucket: turn on versioning, add a CORS rule allowing your
website's origin for `PUT`, `GET` and `HEAD` (and `POST` if you use POST presigning), and consider a
lifecycle rule that expires old objects under the `staging/` prefix, where abandoned uploads land.

Provider notes:

- **Cloudflare R2:** use the S3 API endpoint `https://<account-id>.r2.cloudflarestorage.com` for the
  S3 endpoint, region `auto`, and presign method `put`. Signed uploads must use the S3 API host, not
  an `r2.dev` or custom domain. Give the public-image bucket a public domain and use it as the
  public image base URL.
- **Supabase Storage:** endpoint `https://<project>.storage.supabase.co/storage/v1/s3` and presign
  method `put`. The S3 keys bypass row-level security, so keep them server-side only.

More in [Object storage](/configure/object-storage/).

## Hosted-platform mode

Hosting model **3** in the installer runs one server as a platform where each makerspace has a
subdomain of your domain and can bring its own verified domain. It turns on protections that stay
dormant on an ordinary self-hosted server:

- tenant subdomains and on-demand certificates for hosts the backend recognises;
- DNS `TXT` verification before a makerspace's own domain is trusted, and a cooldown between domain
  changes;
- fair-use limits per makerspace (products, machines, events, staff, storage, email and more), which
  a superadmin can raise per makerspace in the `/control/` control plane.

The switch is the `PLATFORM_DOMAIN_SUFFIX` setting: when it's blank, as on every normal self-hosted
install, managed mode is off entirely. See
[Domains and TLS](/install/domains-and-tls/#hosted-platform-with-tenant-subdomains) for the DNS you
need.

## Managed Postgres

The backend has settings for running against a managed PostgreSQL service such as Supabase:

| Variable | Managed value | Why |
| --- | --- | --- |
| `MANAGED_POSTGRES` | `True` | Lets the makerspace purge work without database superuser rights |
| `CONN_MAX_AGE` | `0` | Required on a transaction pooler |
| `DISABLE_SERVER_SIDE_CURSORS` | `True` | Transaction poolers don't support server-side cursors |

However, the installer always runs its own PostgreSQL, and there is no supported way yet to point a
production install at an external database. The app keeps its database address in a root-owned
pointer file that safe restores depend on, and the adapter for managed databases isn't finished.
Treat a managed-Postgres setup as a demo or pilot only, not as something you can reliably back up
and restore. A free-tier database also fills up quickly, because audit logs, scans and evidence
records are kept permanently.

## Render Blueprints

The repository contains `render.yaml` (a single-tenant layout: Docker web service, Celery worker,
Celery beat, Redis and a static frontend) and `deploy/render.managed.yaml` (the same for
hosted-platform mode).

:::caution[Not deployable today]
The Space Works backend image refuses to start without a root-owned host marker that the bundled
Compose stack provides. Render can't mount it, so a deployment from these Blueprints is refused at
start-up until a provider adapter exists. Don't work around this by overriding the image's
entrypoint: that check is what keeps restores safe. Use a VPS with the standard stack instead.
:::

## Background jobs in split setups

However you split things up, keep the scheduler running alongside the API. The standard stack runs
Celery `beat`; the single box runs its own scheduler loop. Without a scheduler nothing looks broken,
yet return reminders, evidence-retention sweeps, membership renewals and nightly backups silently
never happen.

## Next steps

- [Domains and TLS](/install/domains-and-tls/)
- [Object storage](/configure/object-storage/)
- [Environment variables](/configure/environment-variables/)
