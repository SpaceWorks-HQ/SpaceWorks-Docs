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

Then open <http://localhost:4321/SpaceWorks-Docs/>. Pages reload as you edit.

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
- Link between pages with absolute paths and a trailing slash: `[Updates](/install/updates/)`. The
  site is served under `/SpaceWorks-Docs/`, and `src/plugins/base-links.mjs` adds that prefix to
  Markdown links and MDX `href` props for you. Frontmatter links (the home page's `hero.actions`) are
  not processed, so write those with the prefix: `/SpaceWorks-Docs/get-started/quick-start/`.
- Use placeholders (`example.org`, `change-me`) — never real keys or personal data.

## Deploying

`.github/workflows/deploy.yml` builds the site and publishes it to
<https://spaceworks-hq.github.io/SpaceWorks-Docs/> on every push to `main`.

**Pages → Source** in the repository settings must be **GitHub Actions**. With *Deploy from a branch*,
GitHub runs Jekyll over the Astro sources instead, which fails, and the workflow's deploy step gets a 404.

To move the site to a custom domain, set it under **Pages → Custom domain**, point a `CNAME` DNS record
at `spaceworks-hq.github.io`, set the repository variable `DOCS_SITE_URL` to the new address, and change
`base` in `astro.config.mjs` (and the two hero links in `index.mdx`) to `/`.

The output in `dist/` is plain static files, so Netlify, Cloudflare Pages or any web server work too.

## Contributing

Open a pull request against `main`. Only the maintainer,
[@Shaan-Shoukath](https://github.com/Shaan-Shoukath), can merge into `main`: every push to it
publishes the site, so `main` is protected and nobody else can push to it or merge into it.

## License

AGPL-3.0-or-later, the same as Space Works.
