---
title: Releases
description: How Space Works versions, changelog entries, release builds, container images and image verification work.
sidebar:
  order: 10
---

Space Works uses continuous releases: **every commit that reaches `main` is a releasable build**. A
GitHub Actions workflow builds the container images, publishes them to the GitHub Container Registry
(GHCR), and creates a GitHub Release. Self-hosted installations update by pulling one of those exact
builds. This page is mostly for maintainers, but it is useful for anyone who wants to understand what
an installation is running.

## Versions

The root `VERSION` file holds a semantic version such as `0.9.2`. It selects the **release series**
shown to people; ordinary commits leave it unchanged, and it is bumped when a new series starts.

Every build then gets an immutable, unique version derived from it:

```text
<VERSION>-main.<workflow run number>.<first 12 characters of the commit SHA>
e.g.  0.9.2-main.42.a1b2c3d4e5f6
```

| Identifier | Example | Used for |
| --- | --- | --- |
| Release title | `SpaceWorks 0.9.2` | What people read on the Releases page |
| Git tag | `v0.9.2-main.42.a1b2c3d4e5f6` | What a deployment pins to; never reused |
| Series | `0.9` | The rolling `:X.Y` image tag |

The workflow refuses to run if `VERSION` is not a plain `X.Y.Z` version.

### Bumping the version

A version bump is its own commit (subject `release: SpaceWorks X.Y.Z`) that changes, together:

1. `VERSION`.
2. `SPECTACULAR_SETTINGS["VERSION"]` in `backend/config/settings.py`. The backend image is built from
   `./backend` alone, so it cannot read the root `VERSION` file and keeps its own copy.
3. `frontend/openapi-schema.json` and `frontend/src/generated/api.ts`, regenerated so they carry the
   new version (see [Frontend](/develop/frontend/#generated-api-types)).
4. `CHANGELOG.md`, with the new entry.

## The changelog

`CHANGELOG.md` has one section per release series, newest first, headed with the version and date
(for example `## 0.9.2 (2026-10-14)`). Each entry is a bullet that leads with the user-visible change
in bold, followed by what an operator needs to know: new settings, removed features, migration or
upgrade behaviour. GitHub Releases additionally carry automatically generated notes.

## The release workflow

`.github/workflows/release.yml` runs on every push to `main` (and can be started manually). Its jobs:

1. **prepare**: validates `VERSION` and computes the version, tag and series.
2. **publish**: builds and pushes three images in parallel, each tagged with the full version and
   `sha-<short SHA>`:

   | Image | Built from |
   | --- | --- |
   | `ghcr.io/<owner>/spaceworks-backend` | `backend/Dockerfile` |
   | `ghcr.io/<owner>/spaceworks-frontend` | `frontend/Dockerfile` |
   | `ghcr.io/<owner>/spaceworks-allinone` | `Dockerfile.allinone` at the repository root (the single-box image) |

   `<owner>` is the lowercased repository owner, `spaceworks-hq` for the main project.
3. **github-release**: creates the GitHub Release titled `SpaceWorks <VERSION>` on the immutable tag,
   with generated notes and the image references. It is not marked as latest yet.
4. **promote-latest**: runs only if this commit is **still the head of `main`**, so an older build
   that finishes late can never overwrite a newer one. It then:
   - points the rolling tags `:X.Y`, `:main` and `:latest` of all three images at this build,
   - marks the GitHub Release as latest,
   - prunes superseded container image versions, keeping the current build and the immediately
     previous release so installations can roll back,
   - verifies that the immutable images can be pulled.
5. **deploy** (optional): see [Automatic deployment](#automatic-deployment).

GitHub Releases and their tags are kept permanently. Only container image versions are pruned,
because they consume registry storage.

:::note
The release workflow does not run the test suites. Maintainers run them locally with
`./scripts/dev.sh test` before changes are pushed to `main`.
:::

## Image verification

After promotion, the workflow runs `scripts/verify-release-images.sh` with the full version. It pulls
the backend, frontend and all-in-one images for that exact tag and fails the job if any of them
cannot be pulled. You can run the same check yourself:

```bash
GHCR_OWNER=spaceworks-hq ./scripts/verify-release-images.sh 0.9.2-main.42.a1b2c3d4e5f6
```

The GHCR packages are public, so pulling needs no login.

## How installations choose a release

Installations never build from source on update. `scripts/update.sh` asks GitHub for releases and
uses `scripts/select-main-release.py` to pick one, failing closed:

- Without `--version`, it chooses the newest **published, non-draft, non-prerelease** release whose
  tag matches the `vX.Y.Z-main.<run>.<sha>` pattern.
- With `--version <X.Y.Z-main.<run>.<sha>>`, it accepts that exact release only if it is published,
  not a prerelease, and belongs to the expected repository.

Forks work the same way: setting `SPACEWORKS_REPOSITORY` makes updates follow the fork's releases
and its GHCR images. See [Updates](/install/updates/) for the operator side.

## Automatic deployment

The workflow's final `deploy` job can deploy each release to a server running a **self-hosted GitHub
Actions runner** labelled `spaceworks-prod`. It is off unless the repository variable
`SPACEWORKS_DEPLOY` is set to `true`. When enabled, it runs on the server:

```bash
bash "${SPACEWORKS_DIR:-/opt/spaceworks}/scripts/update.sh" --force --no-module-changes --version "<this release>"
```

The job uses the `production` environment, never overlaps another deploy, and uses no checkout or
third-party actions. `scripts/install-runner.sh` installs, re-registers or removes the runner; it
uses `scripts/runner-release.py` to select the official Linux runner download and its published
SHA-256 checksum, and refuses to continue if there is no unambiguous checksum.

:::danger[Self-hosted runners on a public repository]
The runner controls Docker on the server, which is effectively root. Register it only to your own
repository, require approval for workflow runs from outside contributors, and never target it from
a `pull_request` workflow.
:::

## Related

- [Updates](/install/updates/)
- [Contributing](/develop/contributing/)
- [Testing](/develop/testing/)
