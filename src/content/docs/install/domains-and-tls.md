---
title: Domains and TLS
description: Serve SpaceWorks over plain HTTP, automatic HTTPS with Caddy, your own reverse proxy, API-only or as a hosted platform, and give makerspaces their own domains.
sidebar:
  order: 5
---

The **HTTPS** and **hosting model** questions in setup decide how SpaceWorks is reached from a
browser. This page explains each option, what it sets up and what DNS it needs.

| Setup | Who terminates TLS | Public ports |
| --- | --- | --- |
| [Plain HTTP](#plain-http-local-network-or-trial) | Nobody | `80` (plus `9000` for bundled storage) |
| [Automatic HTTPS](#automatic-https-with-caddy) | Built-in Caddy | `80`, `443` |
| [Your own reverse proxy](#behind-your-own-reverse-proxy) | Your proxy | None. SpaceWorks listens on `127.0.0.1:8080` |
| [API only](#api-only-website-hosted-elsewhere) | Caddy or your proxy | As above |
| [Hosted platform](#hosted-platform-with-tenant-subdomains) | Built-in Caddy, on demand | `80`, `443` |

Whatever you choose, these paths are always handled the same way:

| Path | Goes to |
| --- | --- |
| `/api/`, `/static/`, `/docs/`, `/redoc/`, `/schema/` | The Django API |
| `/api/v1/live/` | The separate live-updates process (a long-lived stream) |
| `/api/v1/internal/` | Blocked from the internet (`403`) |
| Everything else | The React website, including the staff console at `/admin` |
| `/control/` | **Not exposed.** The superadmin control plane is reachable only on the backend itself. |

## Plain HTTP (local network or trial)

The default. No domain or certificate is involved:

- the website and API are published on port `80`;
- with bundled storage, browsers upload and view photos at `http://<web address>:9000`.

The **web address** you enter during setup is baked into links and storage URLs, so use one that
everyone's browser can reach, such as the server's LAN IP (`192.168.1.20`) or a local host name.
`localhost` only works from the server itself.

:::caution
Plain HTTP sends passwords unencrypted. Use it only on a network you trust or for a trial. Logins
from a separately hosted website (API-only mode) require HTTPS.
:::

## Automatic HTTPS with Caddy

Choose **Automatic HTTPS** and enter your domain and a certificate email. Setup adds the `tls`
layer, which puts Caddy in front of everything on ports 80 and 443. Caddy obtains and renews the
certificates for you and stores them in the `caddy_data` volume.

Before you install:

1. Create an `A` (and/or `AAAA`) record for your domain, for example `tools.example.org`, pointing
   at the server.
2. With bundled storage, also create `files.tools.example.org` pointing at the same server. Caddy
   serves the storage API on that name; port 9000 stays on loopback.
3. Make sure inbound ports 80 and 443 reach the server, so the certificate challenge succeeds.

Setup then writes, among others:

```ini title=".env (excerpt)"
PUBLIC_DOMAIN='tools.example.org'
TLS_EMAIL='admin@example.org'
ENABLE_HTTPS='true'
TRUST_X_FORWARDED_PROTO='true'
STORAGE_DOMAIN='files.tools.example.org'
AWS_S3_PUBLIC_ENDPOINT_URL='https://files.tools.example.org'
PUBLIC_IMAGE_BASE_URL='https://files.tools.example.org/public-images'
```

With `ENABLE_HTTPS` on, Django redirects to HTTPS, marks cookies `Secure` and sends HSTS. If ports
80 and 443 are taken on the host, `TLS_HTTP_PORT` and `TLS_HTTPS_PORT` change the ports Caddy
publishes.

## Behind your own reverse proxy

Choose **I already run a reverse proxy** if something else (nginx, Traefik, HAProxy, a tunnel)
already owns ports 80 and 443. SpaceWorks then publishes only on loopback:

| Name | Forward to |
| --- | --- |
| `https://tools.example.org` | `http://127.0.0.1:8080` |
| `https://files.tools.example.org` (bundled storage) | `http://127.0.0.1:9000` |

Your proxy must:

- preserve the original `Host` header;
- send `X-Forwarded-Proto: https` and `X-Forwarded-For`;
- allow uploads as large as your evidence and print files;
- not buffer `/api/v1/live/`, which is a long-lived Server-Sent Events stream.

Setup sets `TRUSTED_PROXY_COUNT=2`, because requests pass through your proxy and then SpaceWorks'
own nginx before reaching Django. Rate limits rely on this count to find the real client address,
so if you put another proxy or CDN in front, raise it to match.

A minimal nginx site for your proxy might look like this:

```nginx title="Example: your own nginx"
server {
    listen 443 ssl;
    server_name tools.example.org;
    # ssl_certificate ... ; ssl_certificate_key ... ;
    client_max_body_size 110m;

    location /api/v1/live/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## API only (website hosted elsewhere)

Answer **No, API only** to the website question if your React site lives on Netlify, Cloudflare
Pages or similar. Setup then:

- requires HTTPS for the API (automatic Caddy or your own proxy);
- replaces the website container with a small nginx `api-edge` that serves only the API, docs,
  static files and the live stream, and answers `404` for anything else;
- trusts your site URLs for CORS and CSRF;
- registers the **first** site URL as the first makerspace's verified domain, so staff can sign in
  from it.

On your external site, set `VITE_API_URL` to `https://<api-domain>/api`. Object storage URLs must
also be public HTTPS addresses, because they're embedded in upload links and image `src` attributes.
See [Cloud and split deployments](/install/cloud/#website-on-netlify).

## Hosted platform with tenant subdomains

Hosting model **3** turns one server into a platform where each makerspace gets a subdomain of your
platform domain, for example `riverside.spaces.example.org`. Setup adds the `saas` layer, where Caddy
is the only container that publishes ports and issues certificates **on demand**: before issuing one,
Caddy asks the backend whether the host belongs to a known makerspace, so random names pointed at
your server don't get certificates.

DNS you need, pointing at the server:

| Record | Purpose |
| --- | --- |
| `spaces.example.org` | The platform itself (also a staff origin) |
| `origin.spaces.example.org` | Origin host that makerspaces' own custom domains point at |
| `files.spaces.example.org` | Bundled object storage |
| `<slug>.spaces.example.org` | Each makerspace. A wildcard `*.spaces.example.org` record is convenient. |

Hosted-platform mode also switches on managed protections: fair-use limits per makerspace and DNS
verification before a makerspace's own custom domain is trusted (see below).

## Per-makerspace domains

Each makerspace has a **Custom domain** setting (`frontend_domain`). Inside the app, that one value
drives everything a branded website on that domain needs: cross-origin API access, working out which
makerspace the site belongs to, and permission to hold a staff session.

| Install type | How a custom domain becomes trusted |
| --- | --- |
| Self-hosted (models 1 and 2) | Trusted as soon as a **superadmin** saves it in the makerspace's Settings. No DNS challenge, because you control both DNS and the server. |
| Hosted platform (model 3) | The makerspace proves ownership with a DNS `TXT` record at `_spaceworks-verify.<domain>` before it's trusted. Changes are rate-limited. |

Only a superadmin can set the custom domain on a self-hosted server, because a trusted domain can
mint staff sessions for the whole server.

For the domain to work you also need DNS pointing at your server and a certificate for it. The
built-in `tls` layer issues a certificate only for `PUBLIC_DOMAIN`, so on a self-hosted server either
make the custom domain your `PUBLIC_DOMAIN`, serve it through your own reverse proxy, or host the
branded website separately. Self-hosted installs must also list the hostname in `ALLOWED_HOSTS`.
[Makerspace setup](/guides/makerspace-setup/) covers the Settings screen.

## Changing your address later

Setup writes your address into several `.env` values and, for HTTPS, chooses a layer. To change the
web address of a plain-HTTP install, update these values to the new host, keeping the rest of each
value as it is:

| Variable | Example |
| --- | --- |
| `ALLOWED_HOSTS` | `192.168.1.30,localhost,127.0.0.1,backend` |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `MINIO_CORS_ALLOWED_ORIGINS` | `http://192.168.1.30` |
| `PUBLIC_APP_BASE_URL` | `http://192.168.1.30` |
| `AWS_S3_PUBLIC_ENDPOINT_URL` | `http://192.168.1.30:9000` |
| `PUBLIC_IMAGE_BASE_URL` | `http://192.168.1.30:9000/public-images` |

To move a standard install from plain HTTP to automatic HTTPS, also write `tls` into
`.spaceworks-layer` and set the values shown under
[Automatic HTTPS](#automatic-https-with-caddy), plus `STORAGE_CADDY_CONFIG='/etc/caddy/storage.caddy'`
and `MINIO_API_BIND='127.0.0.1'` for bundled storage, using `https://` origins throughout.

Then re-record and apply, as described in
[editing `.env`](/install/docker-compose/#the-env-file):

```bash title="In /opt/spaceworks"
MAKERSPACE_IMAGE_TAG="$(cat .spaceworks-version)" bash scripts/init-host-orchestration.sh
scripts/spaceworks-compose.sh bundled up -d --remove-orphans
```

:::caution[Back up first]
Take a backup and keep a copy of `.env` before changing the topology, and point DNS at the server
before switching to HTTPS so Caddy can get a certificate straight away.
:::

## Next steps

- [First run](/install/first-run/)
- [Security settings](/configure/security/)
