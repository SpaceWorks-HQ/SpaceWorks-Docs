---
title: Requirements
description: What you need before installing Space Works — hardware, operating system, Docker, ports, DNS, email and object storage.
sidebar:
  order: 1
---

Space Works runs as a set of Docker containers on one server. The installer checks most of the
requirements on this page for you and refuses to change anything until they pass, but it helps to
have them sorted out before you start.

## The short version

For a first install on your local network you need:

- a 64-bit x86_64 (amd64) Linux machine you can `sudo` on, with internet access;
- at least **8 GiB of free disk** where Space Works will be installed (`/opt/spaceworks` by default);
- `curl` (or `wget`) and `tar`.

That's it. The installer sets up Docker itself on Linux. Everything else on this page, like a domain
name, HTTPS, email and external storage, is optional and can be added when you're ready.

## Operating system

The installer reads `/etc/os-release` to work out how to install packages. It supports these
families:

| Platform | Supported | How Docker gets installed |
| --- | --- | --- |
| Debian, Ubuntu, Linux Mint | Yes | `apt` (`docker.io` plus the Compose V2 plugin) |
| Fedora, RHEL, CentOS, Rocky, AlmaLinux | Yes | `dnf`/`yum` from Docker's official repository |
| Arch, Manjaro | Yes | `pacman` |
| openSUSE, SLES | Yes | `zypper` |
| macOS | Yes | Install and start Docker Desktop yourself first |
| Windows | Yes, with limits (see below) | Install and start Docker Desktop yourself first |

Any other Linux distribution is refused with a clear message.

### Windows

On Windows, Space Works needs Docker Desktop and a bash shell. What works depends on which shell you
use:

| Task | Git Bash | WSL2 | PowerShell |
| --- | --- | --- | --- |
| Install (`install.sh`, `setup.sh`) | Yes | Yes | No: `setup.ps1` stops and points you to WSL2 |
| Day-to-day Compose commands | Yes | Yes | No |
| Updates (`scripts/update.sh`) | Yes | Yes | No: `scripts/update.ps1` stops and points you to WSL2 |
| Restore and backup import | **No** | Yes | No |

Restore and backup import need Linux file locking (`flock`), sockets and file-ownership rules that
Git Bash doesn't provide, so they refuse to run there. Updates under Git Bash fall back to a simpler
lock. If you might ever need to restore, use WSL2 from the start.

### CPU architecture

The published release images are built for **x86_64 (amd64) only**. The installer accepts an
`aarch64`/arm64 machine, such as a Raspberry Pi 4/5 on a 64-bit OS or an ARM cloud server, but
there are no arm64 images to pull. On ARM, build the images on the machine itself from a full
checkout of the repository with `bash setup.sh --build` (see
[One-line install](/install/one-line-install/#building-from-source-instead)). The single-box shape
isn't available that way. 32-bit systems aren't supported at all.

## Hardware

The installer requires **8 GiB of free disk space** on the filesystem that holds the install
directory. The project does not publish a minimum RAM or CPU figure. When you size a machine, keep
in mind what the standard install runs:

- PostgreSQL 16, Redis and the Silo object store;
- the API (3 gunicorn workers by default), a separate live-updates process, a Celery worker
  (concurrency 4 by default) and a Celery beat scheduler;
- the web frontend (nginx), plus Caddy if you choose automatic HTTPS.

On a small machine, the [single-box install](/install/single-box/) runs the API, worker,
scheduler, live updates and website in one container instead.

Disk use grows over time with evidence photos, public images, print files and backups. Evidence
photos are kept until your [evidence retention](/configure/evidence-retention/) policy expires them,
so plan your storage with that in mind.

## Software

| Software | Version | Notes |
| --- | --- | --- |
| Docker Engine | Any current release | Installed by the installer on Linux. On macOS and Windows, use Docker Desktop. |
| Docker Compose | V2 plugin (`docker compose`), **2.24.4 or newer** recommended | 2.24.4 is the first version that understands the `!reset` and `!override` tags the HTTPS, hosted-platform, API-only and external-storage layers use. If the plugin is missing, the installer downloads the latest release from GitHub. |
| curl or wget, and tar | Any | Must already exist: the installer needs them to read its questions before it installs anything. |
| sudo (or root) | Any | Linux only. Run the installer as a normal user and it asks for your password when it needs root. |
| Python 3 | 3.10 or newer, optional | Only needed on the host if you install the GitHub Actions runner. Without it, configuration checks run inside a container instead. |

## Network access

During install and updates the server needs outbound HTTPS access to:

- `github.com` and `api.github.com`, to find and download releases;
- `ghcr.io`, for the Space Works images (`spaceworks-backend`, `spaceworks-frontend` and, for the
  single box, `spaceworks-allinone`), all built for amd64;
- Docker Hub, for the supporting images: `postgres:16`, `redis:7-alpine`, `pgsty/silo`, plus
  `caddy` and `nginx` when you use HTTPS or API-only mode.

## Ports

The installer checks the ports your answers need after you've answered the questions, and stops if
one is already in use.

| Your choice | Ports that must be free |
| --- | --- |
| Plain HTTP (LAN or trial) | `80` |
| Automatic HTTPS (built-in Caddy) | `80` and `443` |
| Your own reverse proxy | `8080` (bound to `127.0.0.1` only) |
| Bundled Silo storage (not on a hosted platform) | `9000` and `9001` as well |

With bundled storage, port `9000` is the storage API. On a plain HTTP install it is published so
browsers on your network can upload and view photos; with HTTPS it is bound to loopback and served as
`files.<your-domain>` instead. The storage console on `9001` always stays on `127.0.0.1`.

## Domain name and DNS

| Setup | DNS you need |
| --- | --- |
| Plain HTTP on a LAN | None. Use the server's IP address or local host name. |
| Automatic HTTPS | An `A`/`AAAA` record for your domain pointing at the server, plus `files.<your-domain>` if you use bundled storage. Inbound ports 80 and 443 must reach the server so certificates can be issued. |
| Your own reverse proxy | Your domain (and `files.<your-domain>` with bundled storage) pointing at your proxy. |
| Hosted platform with tenant subdomains | The platform domain, `origin.<platform>`, `files.<platform>` and each tenant subdomain (a wildcard record is convenient). |

Point DNS at the server **before** you install with HTTPS, so the first certificate request succeeds.
[Domains and TLS](/install/domains-and-tls/) covers each option in detail.

## Outbound email (optional)

Space Works does not need email to run. Without it, password-reset emails can't be sent, so the
"Forgot password?" link is hidden and staff reset passwords for people from the console instead.

When you're ready, add an SMTP server. You can set an instance-wide one in the staff console under
**Platform settings → Platform email**, or per makerspace. Your server needs outbound access to the
SMTP port your provider uses (587 by default). See [Email](/configure/email/).

## Object storage

Evidence photos, print files, backups and public images live in S3-compatible object storage. You
have two choices during setup:

- **Bundled Silo** (default): a maintained, S3-compatible fork of MinIO runs on the same server.
  The installer creates the two buckets, turns on versioning, keeps the evidence bucket private and
  makes the public-image bucket readable. Nothing to prepare.
- **External S3-compatible buckets** such as AWS S3, Cloudflare R2 or Supabase Storage. You create
  **two separate buckets** (a private one for evidence and a public-read one for images), turn on
  versioning and set CORS to allow your website's origin, all in your provider's dashboard. The
  installer never changes remote bucket policies.

See [Object storage](/configure/object-storage/) for the provider details.

## Optional extras

You can skip all of these during setup and add them later:

- a **Google OAuth Web client ID** for "Sign in with Google";
- **Stripe** secret and webhook keys, if you turn on online payments;
- a **GitHub Actions runner** for automatic deploys (Linux with systemd only), see
  [Updates](/install/updates/#automatic-deploys-with-a-github-actions-runner).

## Next steps

- [Run the one-line install](/install/one-line-install/)
- [Preview every setup question](/install/setup-questions/)
