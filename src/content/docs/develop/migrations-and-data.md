---
title: Migrations and data
description: Write Django migrations safely, and register every new model with the export, tenant-migration, encryption and purge registries.
sidebar:
  order: 7
---

SpaceWorks keeps more promises about data than a typical Django app. Records can be exported by a
Space Manager, moved between deployments, encrypted per makerspace, purged module by module, and some
tables can never be updated or deleted at all. Each of those features has a registry, and a new model
or column has to be placed in each one deliberately. This page walks through that checklist.

## Writing migrations

Every schema change is a Django migration in the app that owns the model, under
`backend/apps/<app>/migrations/`.

```bash
# Generate (the file is written into your checkout and owned by you)
./scripts/dev.sh exec backend python manage.py makemigrations bookings

# Apply: re-running `up` re-runs the migrate step from your working tree
./scripts/dev.sh up
```

:::tip[Apply migrations with `up`, not `exec`]
The running backend connects with a least-privilege application role. The `migrate` step that `up`
runs connects as the database owner, which is what schema changes need.
:::

Rules that keep the migration graph healthy:

- **Chain off the actual leaf.** Before you write or rename a migration, list
  `backend/apps/<app>/migrations/` and depend on the newest file that is really there. Numbers quoted
  in an issue or design note go stale quickly.
- **Never edit a migration that has shipped.** Add a forward migration instead. Deployments apply
  migrations during updates, and a rewritten history breaks them.
- **Rebase before merging.** If someone else added a migration to the same app, regenerate or
  renumber yours on top of theirs so the app has a single leaf.
- **Put database guarantees in the migration.** When a model-level guard is not enough (immutability,
  append-only, conditional uniqueness), add the constraint or trigger in the migration with
  `RunSQL` and a matching `reverse_sql`.
- Check for forgotten migrations with
  `./scripts/dev.sh exec backend python manage.py makemigrations --check --dry-run`.

## Append-only and immutable tables

Several tables are protected by PostgreSQL triggers as well as by model methods: the audit log,
attached evidence photos, box scans, QR scan events, device events and settlement receipts, among
others. A trigger looks like this (from `apps/audit/migrations/0002_auditlog_append_only_triggers.py`):

```sql
CREATE TRIGGER audit_auditlog_no_update
BEFORE UPDATE ON audit_auditlog
FOR EACH ROW EXECUTE FUNCTION audit_reject_mutation();
```

Never work around these with raw SQL. Corrections to an append-only record are new rows that amend
it, not updates. The only sanctioned deletes are the superadmin purge paths (a whole archived
makerspace, or one uninstalled module's data). They run in a single transaction and bypass the
triggers for `DELETE` only, using a transaction-local setting: `session_replication_role = 'replica'`
on self-hosted PostgreSQL, or the `app.allow_immutable_delete` setting on managed PostgreSQL where
the replication role is not available.

## Checklist for a new model

### 1. Scope it to a makerspace

Every domain row must belong to a makerspace, directly through a `makerspace` foreign key or through
its parent. Staff queries for it must go through `rbac.scope_by_action(...)` or
`rbac.scope_by_makerspace(...)`. See [Backend conventions](/develop/backend-conventions/#scope-every-query-by-makerspace).

### 2. Classify it for data export

`apps/data_export` holds a literal registry of what a tenant export includes, references and omits.
It is deliberately **not** derived from model metadata, so a new column can never export itself
before someone has decided whether it should.

For every new model, decide one of:

- **Exported**: list its exported fields explicitly. Core domain fields live in
  `classification_domain.py`, and feature areas have sibling files (`classification_*.py`) that
  `classification.py` combines.
- **Global or omitted**: deployment-level or non-tenant data, recorded with a reason in
  `classification_platform.py`.

### 3. Decide every foreign key to `accounts.User`

This is the step most often missed. A model classification says nothing about the model's links to
user accounts, and an undeclared user edge could pull that account into the portable export.
Declare each relation to `accounts.User` (including many-to-many fields and raw integer user IDs)
in `apps/data_export/references_core.py` or the matching `references_*.py` sibling, either as part of
the user closure or as an explicitly excluded edge.

You can run the export registry's consistency checks from a Django shell:

```bash
./scripts/dev.sh exec backend python manage.py shell -c "from apps.data_export.guards import validate_all; validate_all()"
```

It raises if any model or field is unclassified or any user edge is undeclared.

### 4. Make it safe to move between deployments

A makerspace can be migrated from one deployment to another, which reallocates primary keys and
checks uniqueness on the target:

- **Primary keys must be auto-integers or UUIDs.** Avoid `OneToOneField(primary_key=True)` on any
  model that travels; use a normal primary key plus a unique `OneToOneField`.
- **Deployment-wide unique columns need a rule.** Any uniqueness that is not scoped by makerspace
  must have an entry in `DEPLOYMENT_GLOBAL_UNIQUE_RULES` (`apps/tenant_migration/unique_values.py`)
  deciding whether a colliding value is regenerated or preserved.
- **Object-storage key columns must be declared.** A field ending in `_key` is either captured as an
  object pointer or exempted with a reason in `apps/backup/archive_objects.py`, so backups and moves
  carry the right files.

### 5. Register personal data for encryption

If the model stores personal data (names, email addresses, phone numbers, free-text answers) on a
makerspace-owned row, it must inherit `ScopedPiiModelMixin` (`apps/encryption/mappers.py`) and its
fields must be registered in `apps/encryption/registry.py`.

A missing registration **fails open**: writes would skip encryption and store plaintext without any
error. That is why the `separability.E001` system check refuses to start the application when a
model uses the mixin without a registration, and `E002`/`E003` refuse stale or misspelled
registrations. The check runs even when encryption is switched off, because the gap has to be
caught before an operator turns it on.

Per-makerspace encryption itself is dormant until an operator enables it; disabled installations
need no key material. See [Security](/configure/security/).

### 6. Make it purgeable with its module

If the model belongs to an optional module, add it to that module's purge plan in
`apps/makerspaces/module_purge_plans.py`: rows in dependency order, any PII blind-index labels, and
collectors for private and public object-storage keys. Without a plan, the module's data cannot be
deleted on request. See [Adding a module](/develop/adding-a-module/#6-uninstall-and-purge).

## Separability and `TOMBSTONED_APPS`

A deployment can **tombstone** a separable app by listing its label in `TOMBSTONED_APPS` (for example
`TOMBSTONED_APPS=events,bookings`). Its URLs, admin pages, sidebar entries and OpenAPI paths are not
shipped. Tombstoning never touches data: rows stay, migrations stay installed, and reversing it is just
removing the label.

Two registries with opposite lifetimes make this safe:

| Registry | Registered when | Contains |
| --- | --- | --- |
| **Retention** | Always, even when the app is tombstoned | PII field mappings, purge plans, storage collectors |
| **Runtime** | Only while the app is active | URLs, reports, admin, frontend surfaces |

If you work on a separable app:

- Register it in its `AppConfig.ready()` with `register_separable_app("<label>")`, and keep `ready()`
  query-free and idempotent, because it also runs for migrations, tests and Celery.
- Never deregister retention data for a tombstoned app. Doing so would leave retained rows
  unpurgeable and unencryptable, and strand private objects that nothing can name.
- Ask `runtime_active(app_label)` whether surfaces are live; `apps.is_installed()` is still true for
  a tombstoned app, because its tables must remain.
- An `admin.py` must check `app_is_tombstoned()` before registering, since admin autodiscovery runs
  before the app's `ready()`.

Only apps in `SEPARABLE_APPS` (`apps/separability/tombstones.py`) can be tombstoned:
`procurement`, `notifications`, `warranty`, `maintenance`, `presence`, `events`, `bookings`,
`payments_rail`, `tenant_migration` and `devices`. Naming any other label refuses startup with
`separability.E007`. The payment **ledger** (`payments`) is never separable, because a deployment must
always be able to read and settle money it is owed; only the online payment rail (`payments_rail`) can
be removed. The legacy value `TOMBSTONED_APPS=payments` is still accepted and means `payments_rail`.

## Related

- [Backend conventions](/develop/backend-conventions/)
- [Adding a module](/develop/adding-a-module/)
- [Backup and restore](/install/backup-restore/)
- [Testing](/develop/testing/)
