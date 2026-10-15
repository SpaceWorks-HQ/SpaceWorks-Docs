---
title: Updates
description: How SpaceWorks releases work, how to update by hand or automatically with a GitHub Actions runner, and what happens when an update fails.
sidebar:
  order: 9
---

SpaceWorks updates are pulled by your server: nothing is ever pushed into it. Every update backs up
the database first, runs migrations through the same safety checks as a fresh install, and rolls the
application back automatically if the new version doesn't come up healthy.

## Releases and versions

Every change merged into the project's `main` branch produces a GitHub release with published
images. Release versions look like this:

```text
0.9.2-main.412.a1b2c3d4e5f6
│     │    │   └── first 12 characters of the commit
│     │    └────── build number
│     └─────────── built from main
└───────────────── release series (the VERSION file)
```

There are no release channels. "Latest" means the newest published, non-draft, non-prerelease
release built from `main` in the repository your install follows (`SPACEWORKS_REPOSITORY` in `.env`).
Each install is pinned to one exact version, recorded in `.spaceworks-version`.

Check what you're running:

```bash title="In /opt/spaceworks"
cat .spaceworks-version
```

## Updating by hand

Either paste the [one-line install](/install/one-line-install/) command again and choose
**1) Update to the latest release**, or run the updater directly as the install's owner:

```bash title="In /opt/spaceworks"
bash scripts/update.sh --force
```

To deploy one exact release instead of the latest, give its version:

```bash
bash scripts/update.sh --force --version 0.9.2-main.412.a1b2c3d4e5f6
```

The version must be a published, non-draft, non-prerelease release of your repository, or the
updater refuses.

:::note
The app must be running when you update: the updater uses the backend container to validate the
release it found. On Windows, run the updater from WSL2 or Git Bash; `scripts/update.ps1` only
tells you to use WSL2.
:::

When you run `update.sh` in a terminal without any area option, it ends by showing the area menu so
you can review your modules. Add `--no-module-changes` to skip that.

## What an update does

1. Takes the update lock, so two updates, backups or restores can't run at once.
2. Looks up the target release and stops if it's already installed.
3. Dumps the database to `backups/pre-update-<timestamp>-<pid>.sql.gz`. If the dump fails, the update
   is cancelled before anything changes.
4. Pulls the new backend image, then replaces the release's scripts, Compose files and edge
   configuration. The previous copies are kept in `backups/host-config-*`. Your `.env`, volumes and
   backups are left in place.
5. Re-records the configuration checksums and pulls all the new images.
6. Recreates the containers. `orchestration-init`, `migrate` and `orchestration-ready` run in order
   before the app starts.
7. Waits up to about three minutes for the readiness check to pass.
8. Writes the new version to `.spaceworks-version`, removes finished run-once containers, and deletes
   pre-update dumps older than 14 days.
9. Optionally applies module changes.

## Updater options

| Option | What it does |
| --- | --- |
| `--force` | Accepted for compatibility; updates run without it too. |
| `--version <version>` | Deploy this exact published release. |
| `--no-module-changes` | Update images only; don't touch areas or modules. |
| `--modules` | After updating, review areas interactively (on/partial/off). |
| `--modules-only` | Change areas without checking for a release. |
| `--areas=inventory,machines,...` | Set exactly these areas. Empty selects only the core and always-on services. |
| `--all-modules` | Turn on every area and supported feature. |
| `--without=key1,key2` | Keep the current state (or all modules, with `--all-modules`) except these module keys. |
| `--makerspace <slug>` | Apply area changes to one makerspace. |
| `--all-makerspaces` | Apply area changes to every makerspace. |
| `--confirm-removals` | Confirm, without a prompt, that turning modules off is intended. Data is always kept. |
| `--override-lock` | Clear an update lock you have checked is stale. |

Valid area names are `inventory`, `machines`, `events`, `bookings`, `membership`, `payments`,
`reports` and `chat`. For example:

```bash
bash scripts/update.sh --modules-only --makerspace my-space
bash scripts/update.sh --modules-only --areas=inventory,events,reports --makerspace my-space --confirm-removals
```

With several makerspaces, pick one with `--makerspace` or all of them with `--all-makerspaces`.
Turning an area off hides its screens and never deletes data.

## Automatic deploys with a GitHub Actions runner

Instead of updating by hand, you can let each new release deploy itself. A GitHub Actions runner on
your server picks up a `deploy` job after a release is published and runs, on the server:

```bash
bash scripts/update.sh --force --no-module-changes --version <that release>
```

No inbound port is opened for GitHub. You need **Linux with systemd** and admin access to the GitHub
repository your install follows, because only a repository admin can register a runner. For most
self-hosters that means [installing from your own fork](/install/one-line-install/#installing-a-fork).

:::danger[Read this before enabling a runner]
A runner with Docker access effectively has root on your server. GitHub recommends self-hosted
runners only for private repositories, because a pull request from a fork can change workflows to
target them. Require approval for all outside contributors' workflow runs, restrict the runner to
this repository, never use the self-hosted label in a `pull_request` workflow, and leave the
runner's automatic updates on.
:::

1. **Install the runner.** Answer yes to the runner question during setup, choose option 5 when you
   re-run the installer, or run as the install owner:

   ```bash title="In /opt/spaceworks"
   bash scripts/install-runner.sh
   ```

   It asks for a short-lived **registration token**: on GitHub, open the repository's
   **Settings → Actions → Runners → New self-hosted runner** and copy the token. It isn't echoed or
   saved. The script downloads GitHub's official runner, verifies its SHA-256 checksum, registers it
   as `<hostname>-spaceworks` with the label `spaceworks-prod`, and installs it as a systemd service
   in `/opt/spaceworks-runner` (override with `SPACEWORKS_RUNNER_DIR`), owned by the install owner.
2. **Check it's online.** **Settings → Actions → Runners** should show it as **Idle** with the label
   `spaceworks-prod`.
3. **Turn deploys on.** In **Settings → Secrets and variables → Actions → Variables**, add a repository
   variable `SPACEWORKS_DEPLOY` with the value `true`. Without it the deploy job is skipped.
4. **Lock it down.** In **Settings → Actions → General → Fork pull request workflows**, choose
   **Require approval for all external contributors**. In an organization, put the runner in a runner
   group limited to this repository and, if your plan allows, to the release workflow on `main`.
5. **Test it.** Re-run the latest **Continuous Release** workflow. It should end with a `deploy` job
   that runs on your server; the job log shows each step.

Deploys queue rather than overlap. To remove the runner, run `bash scripts/install-runner.sh --remove`,
which asks for a removal token from the same GitHub page.

## The update lock

Updates, backups, restores and verifications share one lock, so they never run at the same time.
The updater holds two:

- `.spaceworks-update.lock`, a directory in the install folder recording the updater's process ID;
- the host operation lock at `/var/lib/spaceworks/ops/operation.lock`.

A lock left behind by a crashed updater whose process has gone is cleared automatically. If the
updater says another update owns the lock, check that no update is actually running
(`ps -p <PID>`) before you rerun with `--override-lock`. If it reports
"Another backup, restore, verification, or update is running", wait for that to finish.

## When an update fails

If the new version doesn't become ready, the updater **rolls the application back automatically**:
it restarts the previous release's containers, resets `.spaceworks-version` and checks readiness
again.

- **Database migrations stay applied.** The rollback only swaps images; it never restores the
  database on its own. The previous release is expected to run against the newer schema.
- **The pre-update dump is kept** in `backups/` for recovery.
- **Object storage isn't touched.**

To see what went wrong:

```bash title="In /opt/spaceworks"
scripts/spaceworks-compose.sh bundled ps -a
scripts/spaceworks-compose.sh bundled logs orchestration-init migrate orchestration-ready backend
```

Failed run-once containers stay in place so you can inspect them. Once you've fixed the cause, run
the update again.

### If the update stopped while replacing files

If the error mentions a `backups/host-config-*` directory, the update stopped while installing the
new scripts and configuration, before the database was touched. Copy the saved files back to their
original places, then recreate the configuration records for the installed version and retry:

```bash title="In /opt/spaceworks"
MAKERSPACE_IMAGE_TAG="$(cat .spaceworks-version)" bash scripts/init-host-orchestration.sh
bash scripts/update.sh --force --no-module-changes
```

### If you need the pre-update database back

Restoring a `pre-update-*.sql.gz` dump is a manual, offline job for someone comfortable with
PostgreSQL. Everything written since the dump is lost, and the dump holds no uploaded files. In
outline:

1. Pause automatic deploys (set `SPACEWORKS_DEPLOY` to `false` and stop the runner service), and make
   sure no update, backup or restore is running.
2. Save the current database, `.env`, version marker and host configuration before replacing
   anything. Leave the object-storage volumes and encryption keys alone.
3. Confirm which database the app actually uses from the host's active database pointer; don't
   assume it's `POSTGRES_DB`.
4. Stop every application container, leaving only `db` running, and check the dump with
   `gzip -t`.
5. Recreate that database and load the dump with `psql` and `ON_ERROR_STOP=1`, inside the `db`
   container.
6. Re-grant the app's least-privilege database access through `orchestration-ready`, set the previous
   release's version, and start the stack through the normal start-up checks.

The full runbook, including the exact safeguards, is
[docs/update-recovery.md](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/docs/update-recovery.md)
in the repository. For recovery that also covers files, use a verified backup archive instead; see
[Backup and restore](/install/backup-restore/).

## Next steps

- [Backup and restore](/install/backup-restore/)
- [Releases](/develop/releases/), for how releases are built
