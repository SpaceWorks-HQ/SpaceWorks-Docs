---
title: Testing
description: Run the backend test runner in disposable infrastructure, the frontend unit tests and type checks, the Playwright end-to-end suite, and the static checks.
sidebar:
  order: 6
---

Space Works tests external behaviour: what an API returns, what a workflow refuses, what a page
renders. This page covers the test runners and checks available in the repository and how to use
them on your change.

:::note[Where the test suites live]
The project's full test suites (`backend/tests/`, the frontend `*.test.ts(x)` files and the
Playwright specs in `frontend/e2e/`) are currently maintained outside the public repository; those
paths are listed in `.gitignore`. A fresh clone ships the **runners and configuration** described
below, but not the maintainers' tests. Maintainers run the full suites before a change is released.
When you open a pull request, describe how you tested it, and mention any tests you wrote so a
maintainer can tell you how to include them.
:::

## Backend: `./scripts/dev.sh test`

The backend runner starts a completely isolated, throwaway environment for every invocation:

- a dedicated Docker network,
- PostgreSQL 16 on a `tmpfs` volume,
- Redis 7,
- S3-compatible storage with the `evidence` (private, versioned) and `public-images` (public read)
  buckets created,
- two freshly generated Fernet keys (`API_CLIENT_ENC_KEY` and `AUDIT_MAC_MASTER_KEY`).

It mounts your working tree at `/workspace` and runs `pytest` in `/workspace/backend` inside the
`spaceworks-backend` image, with no host ports published. When pytest exits, or you press Ctrl+C,
every container and the network are removed.

```bash
./scripts/dev.sh up --build        # once, to build the spaceworks-backend image
./scripts/dev.sh test              # default arguments: -q
```

Any arguments are passed straight to pytest:

```bash
./scripts/dev.sh test tests/inventory            # one directory
./scripts/dev.sh test tests/test_capabilities.py -x -vv
./scripts/dev.sh test -k "reserve and not stocktake"
```

`backend/pytest.ini` points pytest at Django's `config.settings`, discovers files named `test_*.py`
and uses `tests/` as the test path. Explicit test environment values override anything in a mounted
`backend/.env`, so your local settings cannot leak into a run.

### Ground rules

- **The baseline is zero failures.** The suite is expected to be fully green, so any red test is a
  regression introduced by the change under test. There is no list of known failures.
- **One pytest process per database.** Concurrent pytest processes against the same database race on
  teardown and produce false failures. Each `dev.sh test` run has its own database, so separate runs
  do not collide.
- **Large runs can be chunked.** If a full run is too long for your session, split it:
  `./scripts/dev.sh test tests/<subdir>`, `./scripts/dev.sh test tests/test_[a-l]*.py`, and
  `./scripts/dev.sh test tests/test_[m-z]*.py`.

### Backup and tenant-migration tests need a matching PostgreSQL client

The backup and tenant-migration code shells out to `pg_dump` and `pg_restore`, and refuses to run
unless the client's major version equals the server's (16). It looks for the client in
`/usr/lib/postgresql/16/bin` (Debian/PGDG layout), then `/usr/pgsql-16/bin` (RHEL layout), then a
`pg_dump` on `PATH` whose major version matches. If none is found it raises
`PostgresClientUnavailable`.

That error means your environment lacks the right client, **not** that the code regressed. The
backend image installs PostgreSQL clients 16 and 17 on purpose, so run these suites through the
Docker runner:

```bash
./scripts/dev.sh test tests/backup tests/tenant_migration
```

### Tombstoned-app profile

Tests that check a deployment with some apps removed run only when `TOMBSTONED_APPS` is exported,
and the runner passes that variable through:

```bash
TOMBSTONED_APPS=bookings,events ./scripts/dev.sh test tests/tombstone
```

## Frontend unit tests and type checks

Frontend tests use Vitest with jsdom, configured in `frontend/vite.config.ts` (setup file
`src/test/setup.ts`). Test files sit next to the code they test as `*.test.ts` or `*.test.tsx`.

```bash
cd frontend
npm ci
npx tsc -b        # type check the whole project
npm test          # vitest run
npm run build     # type check, production build and PWA artefact check
```

Or, inside the dev stack, without Node on the host:

```bash
./scripts/dev.sh exec frontend npx tsc -b
./scripts/dev.sh exec frontend npm test
```

For accessibility, component tests can run axe through the helper in `src/test/axe.ts`. jsdom cannot
compute colour contrast, so contrast is covered by the browser tests.

## End-to-end tests (Playwright)

The end-to-end suite drives a **real** stack, never mocks. It pins the hard rules (issue needs a box
scan and a real presigned photo upload, return needs a photo and a remark) through a browser, and
checks that the public catalogue never leaks storage locations or box codes.

```bash
./scripts/dev.sh up --build
cd frontend && npm ci && npx playwright install --with-deps chromium && cd ..
./scripts/dev.sh e2e
```

What `dev.sh e2e` does:

1. Waits up to 60 seconds for the dev stack (`http://localhost:8000/api/v1/health/` and
   `http://localhost:5000/`).
2. Runs `python manage.py seed_e2e` in the backend. Each run creates a fresh, randomly named
   `e2e-<token>` makerspace with its users and records, and writes the identifiers to
   `frontend/e2e/.seed.json`. Seeding refuses unless `DEBUG` is on or `E2E_SEED_ALLOWED=1`.
3. Builds the frontend for production and serves it with `vite preview` on port 5173
   (`E2E_PREVIEW_PORT`), proxying `/api` to the backend, because the kiosk service worker only
   exists in a production build.
4. Runs `npx playwright test` with any extra arguments you passed.

Seeded tenants accumulate in your dev database. `./scripts/dev.sh down -v` wipes it when you want a
clean slate. The dev stack raises the login throttle to `200/min` because the suite signs in many
times from one IP.

:::note
`dev.sh e2e` needs the Playwright test runner and the specs in `frontend/e2e/`, which are part of the
maintainers' suite rather than the public tree.
:::

## Static checks

| Check | Command |
| --- | --- |
| Django system checks (separability, PII registration, route registries and more) | `./scripts/dev.sh exec backend python manage.py check` |
| No missing migrations | `./scripts/dev.sh exec backend python manage.py makemigrations --check --dry-run` |
| TypeScript | `npx tsc -b` in `frontend/` |
| Dependency audit | `pip-audit -r backend/requirements.txt` |

The module registry validates itself when it is imported, so a malformed module entry already fails
`manage.py check` and server start-up.

The repository does not ship a Python linter configuration. If you use Ruff, set `src = ["backend"]`
so `apps.*` and `config.*` imports sort as first-party, and exclude `**/migrations`.

## What runs on GitHub

Pull requests run the **Security Audit** workflow, which executes `pip-audit` against
`backend/requirements.txt` and fails on a known-vulnerable dependency. The release workflow does not
run tests; maintainers run the full suites locally before changes reach `main`. See
[Releases](/develop/releases/).

## Related

- [Local development](/develop/local-development/)
- [Contributing](/develop/contributing/)
- [Migrations and data](/develop/migrations-and-data/)
