---
title: Adding a module
description: Register a new module key, gate its endpoints and UI, wire it into setup, purge and data classification, and document it.
sidebar:
  order: 8
---

A **module** is a whole capability a makerspace can switch on or off, such as `events`, `bookings`
or `procurement`. This page walks through adding one, using the real registry and guards in
`backend/apps/makerspaces/`.

Before you start, decide which level you need:

| Level | Who switches it | Use it for |
| --- | --- | --- |
| **Core module** | Nobody, always on | Only the six keys the hardware loan spine needs. Do not add new core modules. |
| **Module** | Superadmin (control plane, staff console Modules tab or CLI) | A whole capability with its own surfaces and data. |
| **Feature** | Space Manager (staff console settings) | A narrower switch inside a module, inert while its parent module is off. |

If what you are building is a refinement of an existing area, a [feature](#adding-a-feature-instead)
is usually the right answer.

## 1. Add the definition to the registry

`apps/makerspaces/module_registry.py` is the single source of truth for module keys; everything else
(defaults, workflows, dependency checks, the console's module list) derives from it. The entries
themselves live in `apps/makerspaces/module_registry_catalog.py`. Add yours to the `MODULES` tuple:

```python title="backend/apps/makerspaces/module_registry_catalog.py"
ModuleDefinition(
    "tool_library", "Tool library", "Long-term tool loans to partner organisations.",
    "tool_library", GUARD, group=GROUP_INVENTORY,
    requires_modules=("asset_units",),
    frontend_workflows=("tool_library",),
),
```

| Field | Meaning |
| --- | --- |
| `key` | The module key stored in `Makerspace.enabled_modules`. Never rename a shipped key. |
| `label`, `description` | Shown to operators in the console. |
| `app_label` | The Django app that implements the module. Several keys can share one app. |
| `enforcement` | `GUARD` (enforced by `require_module` call sites), `FEATURE_PARENT` (enforced only as the parent of features) or `NONE` (deliberately unenforced; justify it in the description). |
| `group` | Required. The operator-facing heading (`GROUP_INVENTORY`, `GROUP_MACHINES`, `GROUP_EVENTS`, ...). |
| `requires_modules` | Modules that must also be enabled. Installing yours pulls them in. |
| `default_enabled` | Whether new makerspaces get it automatically. Modules are opt-in, so leave this `False` unless you have a strong reason. |
| `is_core` | Leave `False`. |
| `frontend_exposed` | `False` hides an internal switch from the bootstrap payload. |
| `frontend_workflows` | Workflow names published to the frontend while the module is installed. |

The registry validates itself when it is imported, so mistakes fail `manage.py check` and server
start-up rather than surfacing later. It refuses duplicate keys, unknown dependencies, unknown groups
or enforcement values, a core module that requires an optional one, and a group with no modules.

## 2. Enforce it in the backend

Declaring a key does nothing on its own. Every endpoint that belongs to the module must check it,
using the guards in `apps/makerspaces/guards.py`:

```python
from apps.makerspaces.guards import require_module, require_module_locked

# At the view boundary: 400 {"module": "tool_library is disabled for this makerspace."}
makerspace = require_module(makerspace_id, "tool_library")

# Inside the creating service, in the same transaction.atomic() as the insert
locked = require_module_locked(makerspace, "tool_library")
```

`require_module_locked` re-checks under the makerspace row lock. Module install and uninstall take
the same lock, so this closes the window where a concurrent uninstall commits between the view check
and the insert.

Both guards go through `platform.module_enabled()`, which also checks that the deployment still ships
the owning app. Do not read `makerspace.enabled_modules` directly for gating; you would miss the
tombstone check.

Public surfaces that should disappear entirely for a deployment's edition use
`require_module_for_servable(...)`, which answers `404` for a hidden surface.

## 3. Gate the frontend

The makerspace bootstrap payload lists installed `modules` (and the `workflows` they publish). Render
your pages, navigation entries and buttons only when the key is present:

```tsx
{bootstrap.data?.modules.includes("tool_library") ? <ToolLibraryPanel /> : null}
```

Staff console tabs are also filtered by the signed-in member's actions in
`frontend/src/features/staff/staffAccess.ts`. If your module adds a new staff tab, add it there with
the action that grants it.

## 4. Place it in setup

The installer asks operators about **areas** rather than individual modules. Add your key to the
right area in `AREAS` in `apps/makerspaces/setup_areas.py`, so a makerspace that turns that area on
gets your module. If it belongs in one of the named install profiles (for example `lending` or
`workshop`), add it in `apps/makerspaces/module_profiles.py` too.

## 5. Keep existing makerspaces working

New modules are opt-in, so existing makerspaces will not have your key. That is correct for a
brand-new capability. But if you are putting a new key **in front of a surface that already existed
ungated**, existing makerspaces would silently lose that surface. In that case, add a data migration
that adds the key to `enabled_modules` for existing makerspaces, as earlier key introductions did.

## 6. Uninstall and purge

Uninstalling and purging are two deliberately separate steps:

- **Uninstall** hides the module's API and UI and **keeps every row**. Reinstalling brings it back
  with its history. Core modules cannot be uninstalled, and a module another installed module depends
  on cannot be uninstalled until the dependant is removed first.
- **Purge** irreversibly deletes one uninstalled module's data for one makerspace, while the
  makerspace and its other modules keep working. It is superadmin-only, runs in one transaction,
  writes audit entries, and deletes object-storage files after the commit.

For purge to work, register a `ModulePurgePlan` for your key in
`apps/makerspaces/module_purge_plans.py`:

| Plan field | What to provide |
| --- | --- |
| `key`, `summary` | The module key and a one-line description of exactly what goes. The summary is shown at the confirmation prompt. |
| `delete` | A function that deletes the module's rows in dependency order. |
| `pii_labels` | Model labels whose PII blind-index rows must be removed too (they have no foreign key, so nothing deletes them automatically). |
| `private_keys`, `private_key_sizes`, `public_image_keys` | Collectors for object-storage keys to delete, and the sizes to release from the storage quota. |

If your module's rows cannot be deleted independently of the makerspace, list it in `NOT_SEPARABLE`
with the reason instead. A plan for an unknown key, or a key that is both purgeable and not
separable, fails the `separability` system checks.

The operator commands are:

```bash
python manage.py list_modules --makerspace <slug>
python manage.py install_module tool_library --makerspace <slug>
python manage.py uninstall_module tool_library --makerspace <slug>
python manage.py purge_module_data --list
python manage.py purge_module_data tool_library --makerspace <slug> --actor <superuser>
```

In the dev stack, prefix them with `./scripts/dev.sh exec backend`.

## 7. Classify its data

Any models the module adds must go through the [new-model checklist](/develop/migrations-and-data/#checklist-for-a-new-model):
data-export classification, a decision for every foreign key to `accounts.User`, tenant-migration
safety, PII registration and the purge plan above.

## 8. Document it

- Add an entry to `docs/MODULES.md` in the main repository, in the same change: what the module is,
  what it adds to the screen, what disappears without it, and what a purge deletes. Nothing generates
  that page for you.
- Document every new endpoint with `@extend_schema` and regenerate the OpenAPI snapshot and the
  generated frontend client (see [Frontend](/develop/frontend/#generated-api-types)).

## Adding a feature instead

Features are namespaced keys such as `loans.renewals` or `events.ticket_types`. They are stored in
`Makerspace.enabled_features`, are editable by Space Managers, and are inert while their parent module
is off.

1. Add a `FeatureDefinition` to `apps/makerspaces/capability_definitions.py` (or the matching
   `capability_definitions_*.py` sibling) with its `key`, `parent_module` (or `None` for a standalone
   feature), `label`, `description`, and any `requires_modules` or `requires_features`.
2. Mirror it in `frontend/src/lib/features.ts`, one object literal per line with the keys in the same
   order (`key`, `parent_module`, `label`). The staff console's feature checkboxes are built from this
   list, and the two lists must not drift.
3. Gate the backend with `require_feature(...)` or `require_feature_locked(...)`, and the frontend with
   `bootstrap.features.includes("<key>")`.

## Related

- [Modules](/guides/modules/), the operator's view of modules
- [Architecture](/develop/architecture/#modules-and-separability)
- [Migrations and data](/develop/migrations-and-data/)
