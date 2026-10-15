---
title: Contributing
description: How to report issues, propose changes, prepare a pull request and license your contribution to Space Works.
sidebar:
  order: 9
---

Space Works is free and open-source software, and contributions of every size are welcome: bug
reports, documentation fixes, translations of rough edges into clear behaviour, and new features.
This page explains how to get a change from an idea to a merged pull request.

## Code of conduct

Everyone taking part in the project is expected to follow the
[Code of Conduct](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/.github/CODE_OF_CONDUCT.md),
adapted from the Contributor Covenant 2.1. It also lists how to report unacceptable behaviour.

## Reporting issues

Open an issue on [GitHub](https://github.com/SpaceWorks-HQ/SpaceWorks/issues). Blank issues are
turned off, so pick one of the two templates:

| Template | What it asks for |
| --- | --- |
| **Bug report** | What happened, the smallest reliable steps to reproduce it, the expected behaviour, the deployment mode (central multi-tenant, single-tenant custom domain, hosted, or local dev), the version or commit, and relevant backend logs. |
| **Feature request** | The problem or motivation, the outcome you want, alternatives you considered, and the affected area. |

Do not include secrets, tokens or personal data in an issue or its logs.

:::danger[Security vulnerabilities]
Never report a vulnerability in a public issue. Follow the private reporting process in the
[security policy](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/.github/SECURITY.md) and
include the affected version or commit, reproduction steps and the potential impact.
:::

## Before you write code

For anything larger than a small fix, open or comment on an issue first so the approach can be agreed
before you invest time. Read these pages before your first backend change; they describe the rules
reviewers check for:

- [Architecture](/develop/architecture/), especially the two load-bearing rules and makerspace scoping
- [Backend conventions](/develop/backend-conventions/)
- [Migrations and data](/develop/migrations-and-data/) if you add or change models

## Branches

Work happens on `dev`; `main` only receives tested changes through the release process.

```bash
git checkout dev
git pull --ff-only origin dev
git checkout -b feature/<short-slug>   # or fix/<short-slug>
```

If you are working from a fork, branch from your fork's up-to-date `dev` in the same way. Do not
commit directly to `dev` or `main`, and keep each branch focused on one concern.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) style subjects on one line, scoped to
the area you changed:

```text
feat(inventory): show reserved counts on the product drawer
fix(printing): keep the queue order after a reprint
docs: explain module purge plans
chore: bump drf-spectacular
```

## Checks to run before opening a pull request

The maintainers' full test suites are not part of the public repository (see
[Testing](/develop/testing/)), so verify your change with the checks the repository does ship:

```bash
./scripts/dev.sh up --build                                   # the stack builds and starts
./scripts/dev.sh exec backend python manage.py check          # Django system checks
./scripts/dev.sh exec backend python manage.py makemigrations --check --dry-run
./scripts/dev.sh exec frontend npx tsc -b                     # TypeScript
```

Then:

- Exercise the change by hand in the dev stack (see [Local development](/develop/local-development/))
  and note what you tried.
- Run any tests you wrote with `./scripts/dev.sh test <path>` or `npm test`.
- If you changed routes, serializers or models that reach the API, regenerate
  `frontend/openapi-schema.json` and `frontend/src/generated/api.ts`
  ([how](/develop/frontend/#generated-api-types)) and commit them with the change.
- Build the frontend for production (`npm run build` in `frontend/`) if you touched it.
- Update documentation alongside the code: the README, files in `docs/` such as `docs/MODULES.md`
  when you add or change a module, and this documentation site when user-visible behaviour changes.

## Opening the pull request

Open the pull request **against `dev`**, not `main`. The template asks for:

- **Summary**: what the change does and why.
- **Related issue**: for example `Closes #123`.
- **Type of change**: bug fix, new feature, documentation, refactor or maintenance, or breaking change.
- **How tested**: the checks you ran and any manual verification.
- **Checklist**: tests pass for the affected areas, documentation and OpenAPI artefacts are updated if
  endpoints changed, and you accept the licensing terms below.

Call out anything an operator must do: new environment variables, migrations, or manual steps.

On GitHub, pull requests run the **Security Audit** workflow (`pip-audit` against
`backend/requirements.txt`). A dependency with a known vulnerability fails it.

## Code review

Reviewers look first at correctness against the project's rules: state changes routed through the
right workflow service, quantities only through inventory availability, every staff query scoped by
makerspace, an audit entry for every state change, OpenAPI documentation for every endpoint, and no
leaks of private data on public surfaces. Expect questions as well as suggestions. Verify feedback
technically rather than applying it blindly, and reply when you disagree. Once approved, a maintainer
merges the branch into `dev`; maintainers later promote `dev` to `main` through a
[release](/develop/releases/).

## License and credit

Space Works is licensed under the
[GNU Affero General Public License v3 or later](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/LICENSE)
(AGPL-3.0-or-later).

- **No CLA and no DCO sign-off are required.** By submitting a pull request you agree that your
  contribution is offered under the same AGPL-3.0-or-later license as the project
  (inbound = outbound). You keep the copyright in your contribution.
- Because the AGPL is a network copyleft licence, anyone who runs a modified version for users over
  a network must offer those users the corresponding source code.
- Everyone whose contribution is merged is credited in
  [CONTRIBUTORS.md](https://github.com/SpaceWorks-HQ/SpaceWorks/blob/main/.github/CONTRIBUTORS.md).

## Related

- [Local development](/develop/local-development/)
- [Testing](/develop/testing/)
- [Releases](/develop/releases/)
