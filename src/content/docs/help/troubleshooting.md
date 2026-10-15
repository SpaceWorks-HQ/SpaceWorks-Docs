---
title: Troubleshooting
description: Symptoms, causes and fixes for common Space Works install, update, storage, email and login problems.
sidebar:
  order: 2
---

Each entry below starts with what you see, then explains the likely cause and the fix. Most messages
are quoted exactly as Space Works prints them, so you can search this page for the text on your
screen.

Run every command on the server, from the install directory (`/opt/spaceworks` unless you chose
another), as the user who owns the install.

## Start here: read the logs

Production installs run Docker Compose through a wrapper. It loads your `.env`, the database pointer
and the overlays you chose (HTTPS, single box, API only, external storage), so **always use the
wrapper instead of plain `docker compose`**:

```bash title="See every container, including ones that exited"
scripts/spaceworks-compose.sh bundled ps -a
```

```bash title="Read or follow logs"
scripts/spaceworks-compose.sh bundled logs backend
scripts/spaceworks-compose.sh bundled logs -f backend worker
```

| Service | What it does |
| --- | --- |
| `backend` | The API (gunicorn). Most application errors appear here. |
| `worker`, `beat` | The Celery worker (email, chat alerts, exports) and the scheduler. |
| `live` | The live-update stream behind `/api/v1/live/`. |
| `frontend` | nginx serving the web app and proxying `/api/` to the backend. |
| `caddy` | Automatic HTTPS, present only if you chose it. |
| `db`, `redis`, `minio` | PostgreSQL, Redis and the bundled object store (Silo). |
| `orchestration-init`, `migrate`, `orchestration-ready`, `createbuckets` | Start-up jobs. Each runs once and stops, and the app only starts if they all succeed. |

On a **single-box** install, the API, worker, scheduler and live stream all log from one service
called `app`.

### Follow one request through the logs

Every API response carries an `X-Request-ID` header, and every backend log line (and every Celery
task started by that request) records the same ID as `request_id`. Find the header in your
browser's developer tools (the **Network** tab), then search for it:

```bash
scripts/spaceworks-compose.sh bundled logs backend worker | grep <request-id>
```

### Check readiness

`GET /api/v1/health/readiness/` returns `"status": "ready"` when the app is healthy. A `503` with
`"status": "unavailable"` includes a `detail` field explaining what isn't ready, for example the
database identity, migrations or an encryption key.

## Installer errors

| Message | Cause | Fix |
| --- | --- | --- |
| `An interactive terminal is required.` | The installer asks questions, and no terminal is attached. | Run it from an interactive SSH or terminal session, not from a script or CI job. |
| `Unsupported architecture '…'. SpaceWorks release images support only x86_64 and aarch64.` | A 32-bit or other CPU. | Use a 64-bit machine. |
| `Unsupported Linux distribution '…'` | The distribution family isn't Debian/Ubuntu, RHEL/Fedora/Alma/Rocky, Arch or SUSE. | Use a supported distribution. See [Requirements](/install/requirements/). |
| `Docker Desktop is installed but not running. Start it and wait until it is ready, then rerun; no state was changed.` | macOS or Windows, and Docker Desktop is stopped. | Start Docker Desktop, wait until it's ready, then run the installer again. |
| `Docker is inaccessible. Run sudo systemctl start docker; …` | The Docker daemon is stopped, or your user can't reach its socket. | Run `sudo systemctl start docker`. For non-root use, run `sudo usermod -aG docker $(id -un)`, sign out and back in, then run the installer again. |
| `At least 8 GiB free is required; … has … MiB.` | Not enough free disk where Space Works installs. | Free space, or set `SPACEWORKS_DIR` to a larger disk. |
| `TCP port N is already in use. Free it before installing.` | Another service is listening on a port Space Works needs. | See [Ports already in use](#ports-already-in-use). |
| `… already contains state but has no .spaceworks-version marker. Refusing to reuse or overwrite it.` | The install directory isn't empty and isn't a Space Works install. | Choose an empty directory with `SPACEWORKS_DIR`, or move the existing files away. |
| `No published release found for owner/name. …` | The repository name is wrong, or a fork has never published a release. | Check the `owner/name` spelling. For a fork, run its **Continuous Release** workflow on `main` once. |
| `The app did not become ready in time. Check logs with: … logs backend` | The stack started, but the backend never passed its readiness check. | Read the `backend` logs and the start-up jobs (`ps -a`), then fix the cause. Your private answers file is kept, so you can retry. |

### A fork installs, but its images won't pull

**Cause:** GitHub may create a fork's container images as **private** packages, and a server can't
pull those without signing in.

**Fix:** after the fork's first release, open your profile or organization → **Packages**, then for
both `spaceworks-backend` and `spaceworks-frontend` choose **Package settings → Change visibility →
Public**.

### Ports already in use

**Cause:** the installer checks ports after you answer the HTTPS and storage questions:

| Your choice | Ports needed |
| --- | --- |
| Plain HTTP | 80 |
| Automatic HTTPS (Caddy) | 80 and 443 |
| Existing reverse proxy | 8080 (on `127.0.0.1`) |
| Bundled storage, not a hosted platform | 9000 and 9001 as well |

**Fix:** stop the other service, for example an existing web server on port 80. If you can't free
port 80 for a plain-HTTP install, set `HTTP_PORT` in `.env` to another port after installing, then
apply the change as described under
[`Compose configuration digest drifted.`](#compose-configuration-digest-drifted).
Automatic HTTPS needs ports 80 and 443 reachable from the internet so certificates can be issued.

## Docker and Compose errors

### `use scripts/spaceworks-compose.sh`

**Symptom:** a plain `docker compose …` command fails with a missing-value error ending in
`use scripts/spaceworks-compose.sh`.

**Cause:** the production Compose file deliberately gets its database settings only from the
wrapper, which reads them from a protected file on the host.

**Fix:** run the same command through the wrapper, for example
`scripts/spaceworks-compose.sh bundled up -d`. The wrapper also refuses `-f`, `--env-file` and
`--project-directory`
(`Compose file, env-file and project-directory overrides are forbidden by the committed wrapper.`).

### `Compose configuration digest drifted.`

**Symptom:** every wrapper command fails with `Compose configuration digest drifted.` right after you
edit `.env` (or a Compose file).

**Cause:** the wrapper keeps a fingerprint of your `.env` and Compose files. A hand edit changes the
fingerprint, and the wrapper refuses to run until it is recorded again.

**Fix:** record the new configuration, then restart the stack:

```bash
MAKERSPACE_IMAGE_TAG="$(cat .spaceworks-version)" bash scripts/init-host-orchestration.sh
scripts/spaceworks-compose.sh bundled up -d
```

Setting `MAKERSPACE_IMAGE_TAG` keeps the helper on your installed release instead of `latest`.

### `Compose wrapper input is misowned.`

**Cause:** `.env` must belong to the install owner (or root) and must not be readable by group or
others. Copying or editing the file can change that.

**Fix:** as the install owner, run `chmod 600 .env`, and check the file's owner with `ls -l .env`.

### A setting in `.env` has no effect

**Cause:** Compose only passes the variables named in the Compose file to the containers. A variable
that isn't listed there never reaches the backend, whatever `.env` says.

**Fix:** check that the variable appears in `docker-compose.prod.yml`. After changing a variable that
does appear there, record and restart as in
[`Compose configuration digest drifted.`](#compose-configuration-digest-drifted).

### `SpaceWorks entrypoint refused startup: …`

**Cause:** every Space Works process starts through a safety check that compares the database it's
about to use with the host's records, and checks whether that kind of process is allowed in the
deployment's current state. Common reasons:

- `role management is refused in …`: a one-off command isn't allowed while a restore or recovery
  is in progress.
- `live database identity disagrees with the host marker`: the process is pointed at a different
  database from the one the host has recorded.
- `DATABASE_URL is missing`: the command didn't go through the wrapper.

**Fix:** use the wrapper, and don't start processes by hand while a restore is running. If the
identity check fails after manual database work, stop and follow the recovery steps in
[Backup and restore](/install/backup-restore/) rather than forcing the process to start.

## Configuration errors at start-up

The backend checks its configuration when it starts and stops with a clear message instead of
failing later. Fix the setting, [record the change](#compose-configuration-digest-drifted) and start
again.

| Message | Fix |
| --- | --- |
| `TRUSTED_PROXY_COUNT must be explicitly set when DEBUG is False. …` | Set `TRUSTED_PROXY_COUNT` to the number of reverse proxies in front of the backend. The bundled stack has `1` (its nginx). The installer writes `2` for an existing reverse proxy. Use `0` only for direct access. |
| `PUBLIC_IMAGE_BUCKET must differ from AWS_STORAGE_BUCKET_NAME; …` or `Private and public storage bucket names must be different.` | Give the private evidence bucket and the public image bucket different names. |
| `EVIDENCE_OBJECT_RETENTION_DAYS must be between 30 and 3650.` | Set a value in range. See [Evidence retention](/configure/evidence-retention/). |
| `SPACEWORKS_EDITION='…' is not an edition …` | Use `makerspace`, `events`, `bookings` or `organization`. |
| `PII_ENCRYPTION_ENABLED is true but PII_MASTER_KEY is missing or invalid for the local key broker.` | Provide the key, or leave personal-data encryption off. See [Security](/configure/security/). |

## HTTPS and certificates

### Caddy can't get a certificate

**Symptom:** the site doesn't load over HTTPS, and `scripts/spaceworks-compose.sh bundled logs caddy`
shows certificate errors.

**Cause:** Caddy must prove to the certificate authority that it controls the domain. That fails if
DNS doesn't point at this server yet, or if ports 80 and 443 aren't reachable from the internet.

**Fix:**

1. Point an `A` (or `AAAA`) record for your domain at the server's public IP address. With bundled
   storage, add `files.<your-domain>` as well.
2. Open ports 80 and 443 in your firewall and your cloud provider's security group.
3. Restart Caddy with `scripts/spaceworks-compose.sh bundled restart caddy` and watch its logs.

On a hosted platform with tenant subdomains, certificates are issued individually for each
registered tenant host, even if you use wildcard DNS.

### `set PUBLIC_DOMAIN` or `set CSRF_TRUSTED_ORIGINS`

**Cause:** the HTTPS overlay requires both variables in `.env`.

**Fix:** set `PUBLIC_DOMAIN=example.org` and `CSRF_TRUSTED_ORIGINS=https://example.org`, then
[record the change](#compose-configuration-digest-drifted).

### Endless redirects or "not secure" behind your own proxy

**Cause:** with HTTPS on, the backend redirects plain-HTTP requests to HTTPS. It only knows a request
arrived over HTTPS if your proxy says so.

**Fix:** make your proxy forward to `127.0.0.1:8080`, preserve the `Host` header and set
`X-Forwarded-Proto: https`. See [Domains and TLS](/install/domains-and-tls/).

## After changing your domain

The installer writes your web address into several settings. When you move to a new domain or IP
address, update **all** of them in `.env`, then
[record the change](#compose-configuration-digest-drifted):

| Variable | Set it to |
| --- | --- |
| `ALLOWED_HOSTS` | The new host name (keep `localhost,127.0.0.1,backend`). |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | The new origin, for example `https://new.example.org`. |
| `PUBLIC_APP_BASE_URL` | The new origin. Links in emails use it. |
| `PUBLIC_DOMAIN` | The new host name, when Caddy handles HTTPS. |
| `STORAGE_DOMAIN`, `AWS_S3_PUBLIC_ENDPOINT_URL`, `PUBLIC_IMAGE_BASE_URL`, `MINIO_CORS_ALLOWED_ORIGINS` | The new storage address and site origin, with bundled storage. |

If the makerspace has a **Custom domain** set in its settings, a superadmin must update it too. That
field decides which origin may hold a staff session.

### `400 Bad Request` for every page

**Cause:** Django only answers for host names listed in `ALLOWED_HOSTS` and rejects everything else
with `DisallowedHost`.

**Fix:** add the new host name to `ALLOWED_HOSTS`.

### Sign-in fails, or you're signed out on every reload

**Symptom:** the browser console shows CORS errors, or the API answers `Origin not allowed.` or
`Staff session origin does not match.`

**Cause:** the site's origin isn't in `CORS_ALLOWED_ORIGINS` or `CSRF_TRUSTED_ORIGINS`, or the
makerspace's Custom domain still names the old host. Staff sign-in on a custom domain also requires
HTTPS. Only `localhost` is allowed over plain HTTP.

**Fix:** update the variables in the table above and the makerspace's Custom domain, then sign in
again.

## Photo uploads and images

Browsers upload photos **directly to object storage** through short-lived signed URLs, so the
storage address must be reachable from every staff and member device, not just from the server.

### Uploads fail in the browser

**Symptom:** choosing a photo fails with a network or CORS error, and issuing then fails with
`409` `evidence_not_uploaded` (`Evidence has not been uploaded.`).

**Causes and fixes:**

- **`AWS_S3_PUBLIC_ENDPOINT_URL` points at `localhost`.** Its Compose default is
  `http://localhost:9000`, which only works on the server itself. Set it to an address browsers can
  reach. On plain HTTP that's `http://<server>:9000`, and port 9000 must be open. With HTTPS it's
  `https://files.<your-domain>`.
- **Storage CORS doesn't allow your site.** For bundled storage, set `MINIO_CORS_ALLOWED_ORIGINS` to
  your site's origin. For external storage, add a CORS rule in your provider's dashboard for **both**
  the private and the public bucket (allow `PUT`, `GET` and `HEAD` for your site's origin). If only
  the public bucket is missing its rule, evidence uploads work but item, logo and cover image uploads
  fail.
- **Wrong signing method for your provider.** Cloudflare R2 and Supabase Storage need
  `STORAGE_PRESIGN_METHOD=put`. The default `post` suits Silo, MinIO and AWS S3.
- **Your proxy rejects large files.** If you forward `files.<your-domain>` through your own proxy,
  raise its request size limit.

See [Object storage](/configure/object-storage/) for the full setup.

### Public item photos or logos are broken

**Cause:** `PUBLIC_IMAGE_BASE_URL` is built into every public image address. A `localhost` value
works only on the server.

**Fix:** set it to the public bucket's browser-reachable URL, for example
`https://files.example.org/public-images`.

### `503` with `storage_unavailable` or `evidence_storage_unavailable`

**Cause:** the backend couldn't reach object storage.

**Fix:** check `scripts/spaceworks-compose.sh bundled logs minio` for bundled storage, or your
provider's status and credentials for external storage. Check `AWS_S3_ENDPOINT_URL`, which is the
address the backend itself uses (`http://minio:9000` for bundled storage).

### A photo shows as expired, or the API returns `410` `evidence_expired`

**Cause:** this is expected. When evidence retention is on, photo files are deleted after the
makerspace's retention window. The photo's record, remarks, scans and audit history are kept, and
the API reports the photo as expired instead of pretending it never existed.

**Fix:** none is needed. To keep photos longer, raise the makerspace's retention period before files
expire. See [Evidence retention](/configure/evidence-retention/).

A `409` with `evidence_cleanup_in_progress` means an upload slot that no handover ever used is being
cleaned up. That's also expected, if you've turned on abandoned-upload cleanup.

## Email isn't sending

Work through these in order:

1. **Is a real mail backend set?** If `EMAIL_BACKEND` isn't Django's SMTP backend
   (`django.core.mail.backends.smtp.EmailBackend`), mail is only written to the logs. Check
   `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` and
   `DEFAULT_FROM_EMAIL`. A makerspace can also set its own SMTP server in its settings.
2. **Is the `email` module on** for the makerspace? It controls that makerspace's mail.
3. **Is the worker running?** Email is sent by the Celery worker. Check
   `scripts/spaceworks-compose.sh bundled logs worker` for SMTP errors.
4. **Check the Email log** in the staff console. Failed messages can be retried from there.
5. **Links in emails aren't clickable?** Set `PUBLIC_APP_BASE_URL`. Without it, password-reset and
   invitation links are bare paths.

If your deployment has no Celery worker, mail is sent during the request, and failed messages wait
for a retry. Schedule `manage.py flush_email_outbox` to retry them automatically.

When email isn't configured, the **Forgot password?** link is hidden. Staff can still reset
passwords with **Reset password** in the Users panel. See [Email](/configure/email/).

## Telegram and chat alerts aren't arriving

Use **Send Telegram test alert** in the makerspace's settings first. Its reply tells you which side
is wrong:

- `Telegram is not configured — save a bot token and group chat ID first.`: add the bot token and
  the group's chat ID for this makerspace.
- `Telegram rejected the message. Check the bot token is correct and the bot has been added to the
  group chat.`: fix the token, or add the bot to the group.

If the test works but real alerts don't arrive:

- Check that the channel's module (`telegram`, `slack`, `mattermost` or `discord`) is on for the
  makerspace, and that the event is enabled for that channel in the notification matrix. Turning a
  channel on never starts sending by itself.
- Check that the Celery worker is running, because alerts are delivered in the background.
- Open **Delivery logs** in the staff console. A row failed with
  `notification_channel_not_configured` means the destination has no usable token or webhook URL.

Alerts are outbound only and never carry accept or reject buttons. That's by design, not a
fault. See [Notifications](/configure/notifications/).

## Migrations and updates

### The app won't start, and `migrate` exited with an error

**Cause:** the `migrate` job runs before the app starts, and the backend waits for it to succeed.

**Fix:** read the job's output, then fix the cause and start again:

```bash
scripts/spaceworks-compose.sh bundled ps -a
scripts/spaceworks-compose.sh bundled logs orchestration-init migrate orchestration-ready backend
```

Failed start-up jobs are kept so you can inspect them. If this happened during an update, see the
next entry.

### `Release … did not become ready. The backup is backups/….`

**Cause:** the new release failed its readiness check. The updater then tries to start the previous
application images again.

**Fix:** look for `Rollback complete: … is healthy.` in the output. If you see it, you're running the
previous release again. Database migrations from the failed attempt remain applied, and the database
backup is kept. Read the logs to find out why the new release failed before you retry.

If you see `ERROR: automatic rollback to … failed.` instead, keep the failed containers for
inspection and recover in a maintenance window using the pre-update backup and the previous image
tag. See [Backup and restore](/install/backup-restore/).

### Other updater messages

| Message | Fix |
| --- | --- |
| `Could not validate an eligible published main release. Start the app, then retry.` | The updater checks releases inside the running app. Start it with `scripts/spaceworks-compose.sh bundled up -d`, then run the update again. |
| `--version requires X.Y.Z-main.<run>.<12 lowercase hex SHA>.` | Pass a full release version, such as `0.9.2-main.42.a1b2c3d4e5f6`, without the leading `v`. |
| `Another update owns … (PID …, age …). If that PID is unrelated or wedged, verify it first, then rerun with --override-lock.` | Wait for the other update to finish. Only use `--override-lock` once you've confirmed no update is running. |
| `Another backup, restore, verification, or update is running.` | Wait for that operation to finish, then try again. |
| `ERROR: … is root-owned. Run sudo bash …` or `ERROR: … belongs to … Sign in as that user and run bash …` | Run the updater as the user who owns the install, or with `sudo` for a root-owned install. |
| `Interactive module selection needs a terminal; use --all-modules/--without or --no-module-changes.` | Run interactively, or pass explicit module flags. |
| `Host configuration upgrade stopped before deployment; the database was not replaced.` | Restore the files from the `backups/host-config-*` directory it names, run `bash scripts/init-host-orchestration.sh`, then retry with `bash scripts/update.sh --force --no-module-changes`. |

With more than one makerspace, a non-interactive module change refuses to guess. Pass
`--makerspace <slug>` or `--all-makerspaces`. See [Updates](/install/updates/).

## Restore and backup import

| Message | Cause and fix |
| --- | --- |
| `In-place restore must run under WSL2 (not native Git Bash/Windows). …` | Restore needs Linux file locking. On Windows, open the install from a WSL2 shell with Docker Desktop's WSL2 integration on, and run it there. |
| `The age identity file is missing: …` | The decryption key for backup archives isn't where restore expects it. Restore it from your secure backup before retrying. |
| `Usage: scripts/restore.sh <restore-uuid>` | `restore.sh` takes the ID of a restore you requested in the backup console, not a file. Don't pass it a `.sql.gz` dump; restoring a pre-update dump is a separate, manual procedure. |
| `scripts/restore.sh is the legacy in-place path and cannot execute a compound restore; …` | This archive type needs a different restore procedure. Don't force it through `restore.sh`. |

After a disaster restore, the API answers `503` with the code `deployment_quarantined`
(`This deployment is in recovery quarantine. Only recovery routes are available.`). That's
deliberate. A superadmin must complete the recovery workflow and acknowledge the remaining risk
before normal use resumes. While a restore runs, you may see
`This deployment is temporarily unavailable for restore.` See
[Backup and restore](/install/backup-restore/).

## `PostgresClientUnavailable`

**Symptom:** a backup, export or tenant-migration operation fails with
`No PostgreSQL N client is installed, so pg_dump cannot run against this deployment's server. Install
postgresql-client-N; the client major must match the database server.`

**Cause:** these operations refuse to use a PostgreSQL client whose major version differs from the
server's, because a mismatched client can write archives that can't be restored. The Space Works
images include clients 16 and 17, which match the bundled PostgreSQL 16. You'll usually see this
error when the backend runs outside those images, or against a managed database with another major
version.

**Fix:** run the backend from the published images, or install the matching client
(`postgresql-client-N`) wherever the backend runs. Contributors running the `tests/backup` or
`tests/tenant_migration` suites should use the isolated runner, which supplies the right client:
`./scripts/dev.sh test tests/backup tests/tenant_migration`. See
[Testing](/develop/testing/).

## Live updates aren't live

**Symptom:** the staff console only refreshes every so often, and requests to `/api/v1/live/` return
`503`.

**Cause:** live updates use Server-Sent Events over Redis. When the deployment has no Redis, or the
`live` service can't reach it, the stream answers `503` and the console falls back to polling.
Everything still works, just less instantly.

**Fix:** check `scripts/spaceworks-compose.sh bundled logs redis live`. The stream uses
`LIVE_REDIS_URL`, which defaults to the Celery broker (`redis://redis:6379/0` in the bundled stack).
If you run your own reverse proxy, it must not buffer `/api/v1/live/` responses.

## Too many requests (429) and lockouts

**Symptom:** sign-in or form submissions return `429`, or several people are locked out at once.

**Causes and fixes:**

- **Wrong proxy count.** Rate limits and login lockouts are tracked per client IP address. If
  `TRUSTED_PROXY_COUNT` doesn't match the number of proxies in front of the backend, every user can
  appear to come from your proxy's IP and share one limit. Set it to `1` for the bundled stack, plus
  one for each extra proxy or CDN you add.
- **Login lockout.** After `AXES_FAILURE_LIMIT` failed sign-ins (5 by default) for the same username
  from the same IP address, that combination is locked for one hour. A successful sign-in resets the
  count.
- **Normal throttling.** Endpoints such as sign-in (10 per minute by default) have their own
  limits. Wait and try again.
- **`anonymous_request_outstanding_limit`.** A makerspace that accepts requests without an account
  stops taking new ones while too many are waiting for review. Review the pending requests to clear
  it.

## Getting help

If none of this solves your problem, open an issue on
[GitHub](https://github.com/SpaceWorks-HQ/SpaceWorks/issues/new/choose) using the **Bug report**
form. Include:

- **What happened** and **what you expected** to happen.
- **Steps to reproduce**, as short as you can make them.
- **Your deployment mode** and the **version**. The version is in `.spaceworks-version` in the
  install directory. Also mention your install shape (standard or single box, HTTPS mode, bundled or
  external storage).
- **Relevant logs**, ideally filtered by the request's `X-Request-ID`.

:::caution[Redact before you paste]
Never post your `.env`, passwords, tokens, keys or personal data from your members. Report security
vulnerabilities **privately** through the
[security policy](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/.github/SECURITY.md), not in
a public issue.
:::

## Related

- [FAQ](/help/faq/)
- [Updates](/install/updates/)
- [Backup and restore](/install/backup-restore/)
- [Environment variables](/configure/environment-variables/)
- [Monitoring](/configure/monitoring/)
