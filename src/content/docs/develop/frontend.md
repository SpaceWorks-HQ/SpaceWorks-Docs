---
title: Frontend
description: The React, TanStack Query and Tailwind conventions in the SpaceWorks frontend, from routing and server state to generated API types, theming and accessibility.
sidebar:
  order: 5
---

The frontend in `frontend/` is a single React application that serves the public site, the member
area, kiosk stations and the staff console. It is a thin client: business rules, permissions and
state transitions live in the backend, and the frontend renders what the API allows.

## Stack

| Piece | Version (from `package.json`) |
| --- | --- |
| React and React DOM | 19.2 |
| Vite | 8.1 |
| TypeScript | 6 |
| React Router | 7 |
| TanStack Query | 5 |
| Tailwind CSS (via `@tailwindcss/postcss`) | 4 |
| Vitest, Testing Library, jsdom, axe-core | Unit and accessibility tests |

QR scanning uses the browser's native `BarcodeDetector` with `zxing-wasm` as the fallback.

### npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5000, proxying `/api` to the backend. |
| `npm run build` | `tsc -b`, then `vite build`, then a check of the generated PWA artefacts. |
| `npm test` | `vitest run` in a jsdom environment. |
| `npm run generate:api` | Regenerates `src/generated/api.ts` from `openapi-schema.json`. |
| `npm run preview` | Serves the production build locally. |

In the Docker dev stack you do not need to run these on the host. The `frontend` container runs the
dev server, and you can run any script inside it with `./scripts/dev.sh exec frontend npm run <script>`.

## Routes and surfaces

`src/AppRoutes.tsx` installs two route families:

- **Central deployments** serve many makerspaces from one domain, with public routes under
  `/m/:slug/...` (for example `/m/:slug/events` or `/m/:slug/member`).
- **Single-tenant deployments** resolve the makerspace from a configured tenant token or from the
  domain, and serve the same pages at the domain root (`/events`, `/member`, ...).

| Path | Surface |
| --- | --- |
| `/m/:slug`, `/` | Public home and catalogue for a makerspace |
| `/member`, `/member/:memberTab` | Member area |
| `/admin/*` | The **React staff console**: every day-to-day staff operation |
| `/guest-admin/*` | The same console restricted to handover work |
| `/scanner` | QR scanner |
| `/kiosk/...` | Kiosk and check-in stations |
| `/control/` | **Not part of the SPA.** The Django admin on the backend, superadmin only |

:::note
`/admin/` is the React staff console and `/control/` is the Django admin. Every lifecycle action a
superadmin can take in `/control/` should also have a React console surface for normal staff; new
workflow actions ship their staff UI in the same change.
:::

### Module and feature gating

Each makerspace's bootstrap payload lists the `modules` and `features` it has enabled. Check them
before rendering a surface, for example
`bootstrap.data?.modules.includes("events")` or `bootstrap.features.includes("machines.public_detail")`.
The backend refuses requests to a disabled module anyway, so gating in the UI is about not showing
dead controls, not about security. Staff tabs are additionally derived from the signed-in member's
actions in `src/features/staff/staffAccess.ts`.

## Server state with TanStack Query

Server data lives in the TanStack Query cache, not in component state. Component state is for form
drafts and UI toggles only.

The shared client in `src/lib/queryClient.ts` sets these defaults: `staleTime` of 30 seconds, no refetch
on window focus, and one retry.

### Query keys

Keys are arrays that start with a domain word and include the identifiers that scope the data, almost
always the makerspace ID. Define a small key factory next to the API helpers and reuse it for both the
query and the invalidation:

```ts title="src/features/staff/apiClientsApi.ts"
export const apiClientsQueryKey = (makerspaceId: number) => ["api-clients", makerspaceId];
```

```tsx
// Illustrative: `fetchApiClients` stands for whichever API helper loads the list.
const clients = useQuery({
  queryKey: apiClientsQueryKey(makerspace.id),
  queryFn: () => fetchApiClients(makerspace.id),
});
```

Use descriptive domain words in keys (`"inventory"`, `"booking"`, `"machine"`, `"member"`). The
live-update client matches incoming change hints against the serialized key, so a key that names its
domain is refreshed automatically when that domain changes.

### Mutations and invalidation

A mutation calls the API and then invalidates the keys whose data it changed. Do not patch the cache
by hand to mirror server-side logic; let the backend be the source of truth and refetch.

```tsx
const deleteClient = useMutation({
  mutationFn: deleteApiClient,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: apiClientsQueryKey(makerspace.id) });
  },
});
```

Render loading, empty and error states for every query. Shared components such as `EmptyState`,
`ErrorBlock`, `Skeleton` and `Spinner` live in `src/components/ui/`.

### Live updates

`src/lib/live.ts` reads the Server-Sent Events stream at `/api/v1/live/`. Each event is a hint (an
action name and a target), never data. On a hint, the client invalidates the matching queries so they
refetch through the normal, permission-scoped endpoints. If the deployment has no Redis the stream
answers `503` and the console keeps polling.

## The API client

`src/lib/api.ts` and `src/lib/api/` are the hand-written client. They handle:

- the access token, which is kept **in memory only** and refreshed from an HTTP-only refresh cookie
  when a request returns `401`,
- tenant bootstrap and the public publishable key header,
- structured API errors (`StructuredApiError`) with the backend's `detail` and `code`.

## Generated API types

The OpenAPI contract is checked in as `frontend/openapi-schema.json`, and
`frontend/src/generated/api.ts` (route constants and types) is generated from it. Regenerate both
whenever you change backend routes, serializers or models that reach the API.

With the dev stack running:

```bash
# 1. Export the schema from the backend (written into ./backend, then moved)
./scripts/dev.sh exec backend python manage.py spectacular --format openapi-json --file openapi-schema.json
mv backend/openapi-schema.json frontend/openapi-schema.json

# 2. Regenerate the TypeScript client from the snapshot
./scripts/dev.sh exec frontend npm run generate:api
```

You can also point the generator at a running server with
`OPENAPI_SCHEMA_URL=http://localhost:8000/schema/?format=json npm run generate:api`.

:::caution
Use the drf-spectacular version pinned in `backend/requirements.txt` (the one in the backend image).
An older version rewrites hundreds of unrelated lines. Your schema diff should contain only what you
changed. Commit `openapi-schema.json` and `api.ts` together with the backend change.
:::

## Styling and theme tokens

Tailwind 4 is configured CSS-first. `src/index.css` starts with `@import "tailwindcss"` and
`@config "../tailwind.config.ts"`, and defines every colour as an RGB triple on `:root` and
`:root.dark`:

```css
:root {
  --color-ink: 31 46 53;
  --color-bg: 250 249 244;
  --color-muted: 92 103 112;
  --color-focus: 12 74 110;
}
```

`tailwind.config.ts` exposes them as utilities with alpha support (`bg-surface`, `text-muted`,
`bg-accent/15`). Use the semantic names, never raw hex values:

| Token | Meaning |
| --- | --- |
| `accent` | Interaction, primary actions, active navigation, staff chrome |
| `secondary` | Stranger-facing surfaces: public catalogue, member area, sign-in, kiosk |
| `success`, `warn`, `info` | Status |
| `danger` | Destructive actions and errors |
| `ink`, `muted`, `bg`, `surface`, `panel`, `line`, `outline` | Text and neutral surfaces |
| `focus` | The keyboard focus ring |

Two kinds of text colour exist for each pastel, and mixing them up breaks dark mode:

- `{name}-ink` (for example `accent-ink`) is for **standalone** coloured text and `/15` tints. It turns
  light in dark mode.
- `on-{name}` (for example `on-success`) is for text **on a solid pastel fill**. It stays dark in both
  modes.

Shared building blocks live in `src/styles/components.css`: a closed family of buttons
(`desk-button`, `desk-button-primary`, `desk-button-secondary`, `-success`, `-warn`, `-danger`,
`-ghost`), each with a 44px minimum height and the shared focus ring, and title classes such as
`title-page`, `title-panel`, `title-section` and `eyebrow`. Prefer these over one-off class strings.

### Light and dark mode

Dark mode is class-based: `src/lib/theme.ts` toggles `dark` on `<html>`. The app follows the operating
system's preference until the user picks a theme with the toggle, which is then remembered in local
storage. Makerspaces can also set their own brand colours; `src/lib/brandColours.ts` derives
foreground and tint values that keep contrast in both modes.

## Accessibility floor

Accessibility rules are enforced, not optional:

- **Contrast.** Text tokens must reach WCAG AA (4.5:1) on `bg`, `surface` and `panel`, and the focus
  colour must reach 3:1. For body copy use `text-muted`, never `text-ink/<alpha>`.
- **Focus.** Never use `focus:outline-none`. Interactive elements carry
  `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`.
- **Skip links.** The target needs `tabIndex={-1}` and must always render, even while content loads.
- **Collapsed content** is unmounted, not hidden-but-present, so keyboard users never tab into
  controls they cannot see.
- **Tests.** Component tests can run axe through `src/test/axe.ts` (jsdom cannot check colour
  contrast, so contrast is covered in browser tests). An axe violation fails the build; there is no
  allow-list.

## Related

- [Local development](/develop/local-development/)
- [Testing](/develop/testing/)
- [Backend conventions](/develop/backend-conventions/)
- [API overview](/api/overview/)
