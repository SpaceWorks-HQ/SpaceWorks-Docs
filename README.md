# Space Works Docs

The documentation site for [Space Works](https://github.com/SpaceWorks-HQ/SpaceWorks), the open-source
makerspace manager: install and setup, configuration, guides for makerspace staff, the developer guide,
the API, and the FAQ.

It is built with [Astro Starlight](https://starlight.astro.build/): every page is a Markdown file, and the
build produces a static site with search, a sidebar, per-page contents and light/dark themes.

## Run it locally

Requires Node 20.19+ or 22.12+.

```bash
npm ci
npm run dev
```

Then open <http://localhost:4321/>. Pages reload as you edit.

```bash
npm run build     # static site in dist/, fails on any broken internal link
npm run preview   # serve the built site
```

## Where things are

```
src/content/docs/
  index.mdx        home page
  get-started/     introduction, quick start, concepts, glossary
  install/         requirements, installer, setup questions, compose, TLS, cloud, updates, backups
  configure/       environment variables, auth, email, storage, notifications, payments, security
  guides/          running a makerspace: modules, roles, inventory, loans, printing, events
  develop/         architecture, local dev, conventions, testing, contributing, releases
  api/             REST API, authentication, API clients, webhooks, devices
  help/            FAQ and troubleshooting
src/styles/custom.css   brand colours
astro.config.mjs        site title, sidebar groups, plugins
```

The sidebar is generated from the folders. Order pages inside a group with `sidebar.order` in the
frontmatter:

```md
---
title: Page title
description: One sentence for search and link previews.
sidebar:
  order: 3
---
```

## Writing rules

- Check facts against the Space Works source (settings, scripts, compose files), not only its older
  Markdown docs.
- Link between pages with absolute paths and a trailing slash: `[Updates](/install/updates/)`.
- Use placeholders (`example.org`, `change-me`) — never real keys or personal data.

## Deploying

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages on every push to `main`.

1. In the repository settings, set **Pages → Source** to **GitHub Actions**.
2. Add a repository variable `DOCS_SITE_URL` with the public address (for example
   `https://docs.example.org`) so the sitemap and canonical links are correct.
3. For a custom domain, set it under **Pages → Custom domain** and point a `CNAME` DNS record at
   `<owner>.github.io`.

The output in `dist/` is plain static files, so Netlify, Cloudflare Pages or any web server work too.

## License

AGPL-3.0-or-later, the same as Space Works.
