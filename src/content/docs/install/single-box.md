---
title: Single-box install
description: Run the whole Space Works application in one container beside PostgreSQL and Silo storage, when it fits and what it can't do.
sidebar:
  order: 6
---

The single box is a simpler shape for small installs. Instead of separate containers for the API,
live updates, worker, scheduler and website, one **application container** runs them all. It sits
beside PostgreSQL and the Silo object store, so you manage three main containers instead of eight.

It runs the same code with the same safety checks; it only reduces how many things you operate.

## What runs inside the box

The `app` container uses the `spaceworks-allinone` image (built from `Dockerfile.allinone`). A small
supervisor script starts:

| Process | Notes |
| --- | --- |
| nginx | Serves the website and proxies the API. Listens on `8080` inside the container, published on `HTTP_PORT` (default `80`). |
| API (gunicorn) | 3 workers |
| Live updates (gunicorn) | The Server-Sent Events stream, 32 threads |
| Celery worker | Runs **2** jobs at a time |
| Scheduler loop | Runs due scheduled tasks and flushes the email outbox every 15 minutes, instead of Celery beat |
| Redis | Bound to loopback inside the container; its data is kept in the `allinone_state` volume so rate-limit counters survive restarts |

If any of these processes exits, the whole container stops and Docker restarts it, so you never
end up with a half-working box (for example, a website with no worker behind it).

Next to `app` the stack still runs `db` (PostgreSQL 16), `minio` (Silo) with its one-off
`createbuckets` job, a `redis` container used by the start-up jobs, and the run-once
`orchestration-init`, `migrate` and `orchestration-ready` services.

## When to choose it

Choose the single box when:

- you run **one or a few makerspaces** on a local network;
- you're happy with **plain HTTP** on the LAN, or for a trial;
- you'd like fewer containers to watch on a modest machine.

Choose **standard containers** instead when you need any of these, because the installer won't
combine them with a single box:

- automatic HTTPS, or your own HTTPS reverse proxy;
- a website hosted elsewhere (API-only mode);
- a hosted platform with tenant subdomains;
- building images from source with `setup.sh --build`.

## Installing it

Run the [one-line install](/install/one-line-install/) and answer:

- **Website:** `1` (Yes)
- **HTTPS:** `1` (None)
- **How should it run?** `2` (Single box)

Setup writes `single` to `.spaceworks-layer`. The Compose wrapper reads that file, so every later
command, update and rollback keeps the single-box shape.

## Operating it

The commands are the same as for the standard stack, except that the application service is called
`app`:

```bash title="In /opt/spaceworks"
scripts/spaceworks-compose.sh bundled ps -a
scripts/spaceworks-compose.sh bundled logs -f app
scripts/spaceworks-compose.sh bundled restart app
```

Management commands still run in a one-off container from the standard backend image, not inside
`app`:

```bash
scripts/spaceworks-compose.sh bundled run --rm --no-deps backend --role management python manage.py <command>
```

Updates work exactly as described in [Updates](/install/updates/). The updater pulls the new
all-in-one image and checks readiness on `app`.

## Limits

- **HTTP only through the installer.** HTTPS, API-only and hosted-platform setups need standard
  containers.
- **Fixed capacity.** The worker runs 2 jobs at a time and scheduled work is checked every 15
  minutes rather than to the minute. The production Compose file doesn't pass the tuning variables
  (`GUNICORN_WORKERS`, `CELERY_CONCURRENCY`, `LIVE_THREADS`, `CRON_INTERVAL_SECONDS`) into the `app`
  container, so setting them in `.env` has no effect here. If you need more capacity, use standard
  containers.
- **Everything restarts together.** A crash in any process restarts the whole application.
- **No control plane on the web port.** As with the standard stack, `/control/` is not proxied by
  the box's nginx.
- **In-place restore isn't supported.** The restore tool refuses single-box installs. Keep backups,
  but plan to restore onto a standard-container install. See [Backup and restore](/install/backup-restore/).

## Switching shape

The shape is just the word in `.spaceworks-layer` (`single` for the single box, `none` for standard
containers over plain HTTP). Both shapes use the same database and storage volumes. To switch an
existing plain-HTTP install, take a backup first, then remove the old shape's containers **before**
changing the word, so the old and new web servers don't compete for port 80:

```bash title="In /opt/spaceworks"
scripts/spaceworks-compose.sh bundled down   # removes containers, keeps all volumes
echo none > .spaceworks-layer                # or: echo single > .spaceworks-layer
scripts/spaceworks-compose.sh bundled up -d
```

## Next steps

- [First run](/install/first-run/)
- [Docker Compose stack](/install/docker-compose/)
