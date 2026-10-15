---
title: Docker Compose stack
description: The services in a production SpaceWorks install, how the Compose files layer, and the commands to start, stop, inspect and tune it.
sidebar:
  order: 4
---

Every SpaceWorks install, including one made with the one-line installer, is a Docker Compose
project. This page explains what runs, how the configuration is put together, and how to operate it
day to day.

## Always use the wrapper

Run Compose through `scripts/spaceworks-compose.sh` from the install directory, never with a plain
`docker compose` command:

```bash title="In /opt/spaceworks"
scripts/spaceworks-compose.sh bundled ps
```

`bundled` is the topology name for the standard self-hosted stack. The wrapper:

- picks the right Compose files for the shape you chose at setup (it reads `.spaceworks-layer`);
- loads `.env` and the root-owned database pointer in `/var/lib/spaceworks/ops` (the app's database
  address is never stored in `.env`);
- checks the configuration against checksums recorded at setup, and refuses to start if `.env` or a
  Compose file has changed since then;
- pins the image tag to the installed release from `.spaceworks-version`.

It rejects `-f`, `--env-file` and `--project-directory`. Everything else is passed straight to
`docker compose`. Run it as the user that owns the install.

## Services

| Service | Image | What it does |
| --- | --- | --- |
| `db` | `postgres:16` | The PostgreSQL database. |
| `redis` | `redis:7-alpine` | Celery broker, cache and the live-updates channel. |
| `minio` | `pgsty/silo` | Bundled S3-compatible object storage (Silo, a maintained fork of MinIO). Not started with external storage. |
| `createbuckets` | `pgsty/silo` | Runs once: creates the private evidence bucket and the public-image bucket, and turns on versioning. |
| `orchestration-init` | backend | Runs once before migrations: a start-up safety check that prepares host and database state. |
| `migrate` | backend | Runs once: applies database migrations, then stops. |
| `orchestration-ready` | backend | Runs once after migrations: the final safety check, including the app's least-privilege database access, before the app starts. |
| `backend` | backend | The Django API (gunicorn). Also serves `/static/`, the API docs and the `/control/` control plane. |
| `live` | backend | A separate gunicorn process for the live-updates stream at `/api/v1/live/`. |
| `worker` | backend | Celery worker: email delivery, alerts, backups and other background jobs. |
| `beat` | backend | Celery beat: the scheduler for reminders, retention sweeps, nightly backups and more. |
| `frontend` | frontend | nginx serving the React app. Proxies `/api/`, `/static/` and the docs to the backend. Not started in API-only mode. |
| `caddy` | `caddy:2-alpine` / `caddy:2` | Automatic HTTPS edge. Only with automatic HTTPS or a hosted platform. |
| `api-edge` | `nginx:alpine` | API-only edge that exposes the API, docs and live routes without a website. Only in API-only mode. |
| `app` | allinone | The single-box container. Only in the single-box shape. |
| `candidate-backend` | backend | Used only during restore recovery. Never started in normal operation. |

The **backend** image is `ghcr.io/spaceworks-hq/spaceworks-backend` and the **frontend** image is
`ghcr.io/spaceworks-hq/spaceworks-frontend` (forks use their own owner). Each backend container runs
with an explicit role (`backend`, `worker`, `beat`, `migrate`, `management`) and refuses to start
outside the safe start-up sequence.

The three run-once services exit after they finish. That's expected: `ps -a` shows them as
`Exited (0)`. The summary at the end of setup puts it this way: "migrate builds the database tables.
It runs once and stops."

## Compose files and layers

The base file is `docker-compose.prod.yml`. Your answers at setup add overlay files from `docker/`:

| Overlay | Added when |
| --- | --- |
| `docker/compose.tls.yml` | Automatic HTTPS (layer `tls`). Adds Caddy on ports 80/443 and stops publishing the frontend port. |
| `docker/compose.saas.yml` | Hosted platform (layer `saas`). Caddy with on-demand certificates; only Caddy publishes ports. |
| `docker/compose.single.yml` | Single box (layer `single`). Parks the multi-container services and runs `app`. |
| `docker/compose.build.yml` | `setup.sh --build`. Builds images from source instead of pulling them. |
| `docker/compose.api-only.yml` | `SPACEWORKS_RUN_FRONTEND=no`. Replaces the website with `api-edge`. |
| `docker/compose.api-only-edge.yml` | API-only together with Caddy. |
| `docker/compose.external-storage.yml` | `SPACEWORKS_STORAGE=external`. Turns off `minio` and `createbuckets`. |

The primary layer (`none`, `tls`, `saas` or `single`) is stored in `.spaceworks-layer`. The website
and storage choices are stored in `.env`. Updates and restores reuse all of them, so an update never
changes the shape of your install.

The repository also contains `docker-compose.yml`, `docker-compose.dev.yml` and
`docker-compose.override.yml`. Those are for development only; see
[Local development](/develop/local-development/).

## Everyday commands

Run these from the install directory (`/opt/spaceworks` by default):

```bash
# What's running
scripts/spaceworks-compose.sh bundled ps -a

# Follow the API logs (single box: use "app" instead of "backend")
scripts/spaceworks-compose.sh bundled logs -f backend

# Logs for the start-up sequence
scripts/spaceworks-compose.sh bundled logs orchestration-init migrate orchestration-ready

# Start everything (also applies changes after you edit .env, see below)
scripts/spaceworks-compose.sh bundled up -d

# Restart one service
scripts/spaceworks-compose.sh bundled restart worker

# Stop everything without removing containers or data
scripts/spaceworks-compose.sh bundled stop
```

Run a management command in a one-off container:

```bash
scripts/spaceworks-compose.sh bundled run --rm --no-deps backend --role management python manage.py <command>
```

:::note
`down` removes containers but keeps volumes, so your data is safe. Never add `-v` to `down`: that
deletes the database and object storage volumes.
:::

## The `.env` file

`.env` holds your secrets and settings. It is created by setup with mode `600`. Keep a secure copy
of it: it contains `API_CLIENT_ENC_KEY`, without which encrypted integration credentials (SMTP
passwords, chat tokens, payment keys) cannot be decrypted, plus the storage credentials.

Because the wrapper checks `.env` against a checksum recorded at setup, editing it is a three-step
job:

```bash title="In /opt/spaceworks"
# 1. Edit the file with any editor
nano .env

# 2. Re-record the configuration checksums for the installed release
MAKERSPACE_IMAGE_TAG="$(cat .spaceworks-version)" bash scripts/init-host-orchestration.sh

# 3. Apply
scripts/spaceworks-compose.sh bundled up -d
```

If you skip step 2, the wrapper refuses to run with "Compose configuration digest drifted." Never
put `DATABASE_URL` in `.env`: the database address comes only from the pointer file.

### Not every variable reaches the app

`docker-compose.prod.yml` hands the backend an **explicit list** of variables; it doesn't load
`.env` wholesale. A variable only takes effect if the Compose file names it. The list covers the
settings setup writes (hosts and origins, HTTPS, storage, email, backup keys, platform mode,
monitoring and evidence retention), but not, for example, `LOG_LEVEL`, the `PII_*` encryption
settings, `THROTTLE_*`, `TELEGRAM_*`, `AUTH_COOKIE_*` or `LIVE_REDIS_URL`. Adding those to `.env`
changes nothing, and the Compose files can't be edited without failing the wrapper's checksum
check. Before relying on a setting, search `docker-compose.prod.yml` for its name.

Every setting is described in [Environment variables](/configure/environment-variables/).

## Tuning capacity

These `.env` settings control how much work each container does:

| Variable | Default | Controls |
| --- | --- | --- |
| `GUNICORN_WORKERS` | `3` | API worker processes in `backend` |
| `GUNICORN_TIMEOUT` | `60` | Seconds before a slow API request is cut off |
| `LIVE_THREADS` | `32` | Concurrent live-update streams the `live` process can hold |
| `CELERY_CONCURRENCY` | `4` | Background jobs the worker runs in parallel |

To give background jobs more capacity, raise `CELERY_CONCURRENCY` and apply it as shown above. Keep
exactly **one** `beat` scheduler. Running two would schedule every periodic job twice.

## Volumes and where data lives

| Location | Contents |
| --- | --- |
| Volume `makerspace_manager_pgdata` | The PostgreSQL database |
| Volume `minio_data` | Bundled object storage: evidence photos, print files, public images and backup archives |
| Volume `celerybeat_data` | The beat scheduler's state |
| Volumes `caddy_data`, `caddy_config` | TLS certificates and Caddy state (HTTPS installs) |
| Volume `allinone_state` | Redis data for the single box |
| `<install>/.env` | Secrets and settings |
| `<install>/backups/` | Database dumps taken before each update |
| `/var/lib/spaceworks/ops` | Database pointer, configuration checksums, the operation lock, and the backup encryption identity in `work/age-identity.txt` |
| `/var/lib/spaceworks/host` | Host state used to start and restore safely |

Compose prefixes volume names with the project name, which is the install folder's name. For the
default `/opt/spaceworks` that gives names like `spaceworks_minio_data`. List them with
`docker volume ls`.

[Backup and restore](/install/backup-restore/) explains how to protect all of this.

## Setting up the stack by hand

The installer is the supported path, but you can assemble the same stack yourself from a checkout:

```bash
cp .env.example .env
# Fill in every required value, including POSTGRES_APP_PASSWORD and SPACEWORKS_SCHEDULER_MODE
export MAKERSPACE_IMAGE_TAG=latest   # or an exact release version
bash scripts/init-host-orchestration.sh
scripts/spaceworks-compose.sh bundled up -d
```

Then create the first superadmin and makerspace as described in
[First run](/install/first-run/#creating-the-superadmin-by-hand).

## Next steps

- [Domains and TLS](/install/domains-and-tls/)
- [Updates](/install/updates/)
