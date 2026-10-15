---
title: Backend conventions
description: How backend code in Space Works is structured, scoped, audited and documented, with the patterns reviewers look for.
sidebar:
  order: 4
---

The backend is Django 6 with Django REST Framework (DRF), PostgreSQL 16 and Celery. This page
collects the conventions that every backend change is expected to follow. Most of them exist because
the system's job is accountability for physical hardware: a missing audit entry or an unscoped query
is a real-world problem, not a style issue.

## Layering: views, serializers, services

Keep each layer to its own job:

| Layer | Responsibility |
| --- | --- |
| **Serializer** | Validate and normalize input at the boundary. Shape output. No side effects. |
| **View** (`APIView` / generic views) | Authenticate, resolve the makerspace, check the module and the action, call one service, return the response. |
| **Service module** (`services*.py`, `*_workflow.py`) | Own the transaction, row locks, state transitions, quantity changes, audit entries and notifications. |
| **Model** | Schema, constraints and model-level guards. Immutable models refuse `save()` on update and `delete()`. |

A typical staff endpoint looks like this (simplified from `apps/maintenance/views_schedules.py`):

```python
from drf_spectacular.utils import extend_schema
from rest_framework.views import APIView

from apps.accounts import rbac
from apps.admin_api.permissions import IsActiveStaff
from apps.openapi_errors import errors


class MaintenanceScheduleListCreateView(APIView):
    permission_classes = [IsActiveStaff]

    @extend_schema(
        tags=["Admin maintenance"],
        summary="Create a machine maintenance schedule",
        request=MaintenanceScheduleWriteSerializer,
        responses={201: MaintenanceScheduleSerializer, **errors(400, 401, 403, 404, 409, 423)},
    )
    def post(self, request, makerspace_id, machine_id):
        machine = resolve_collection(request.user, makerspace_id, machine_id, manage=True)
        serializer = MaintenanceScheduleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        schedule = services.create_schedule(
            machine, actor=request.user, **serializer.validated_data,
        )
        return Response(MaintenanceScheduleSerializer(schedule).data, status=201)
```

The view never writes a status field or a count. The service does, inside a transaction, and records
the audit entry.

:::caution[Never write status or quantities from a view]
Hardware request transitions go through `apps.hardware_requests.workflow`, and every quantity change
goes through `apps.inventory.availability`. Other domains have their own transition service (for
example `machines.service_workflow`). See [Architecture](/develop/architecture/#the-two-load-bearing-rules).
:::

## Keep files small, and split with thin barrels

Aim for files of around 200 lines with one clear responsibility, and split a file before it grows
past about 300. `backend/config/settings.py` is the accepted exception.

When a module such as `views.py`, `serializers.py`, `services.py` or `admin.py` outgrows that, split it
into domain submodules (`views_schedules.py`, `views_logs.py`, `services_documents.py` and so on) and
keep the original file as a **thin re-export barrel** so existing imports keep working:

```python title="apps/maintenance/views.py"
from apps.maintenance.views_documents import (
    MaintenanceLogDocumentDetailView,
    MaintenanceLogDocumentPresignView,
)
from apps.maintenance.views_logs import MaintenanceLogListCreateView
from apps.maintenance.views_schedules import (
    MaintenanceScheduleDetailView,
    MaintenanceScheduleListCreateView,
)

__all__ = [
    "MaintenanceLogDocumentDetailView",
    "MaintenanceLogDocumentPresignView",
    "MaintenanceLogListCreateView",
    "MaintenanceScheduleDetailView",
    "MaintenanceScheduleListCreateView",
]
```

Rules for barrels:

- Use explicit imports. Never `from .submodule import *`.
- An `admin.py` barrel must still import every admin submodule, so the `@admin.register` side
  effects run.
- Split a large file in its own commit before adding new code to it, so reviewers can see the move
  separately from the change.

## Permissions are deny-by-default

DRF is configured with `IsAuthenticated` as the default permission and the project's JWT
authentication class. A view is public only if it explicitly opts in with `AllowAny`. Public
submission endpoints additionally pass through the member eligibility gate when the makerspace
requires membership.

## Scope every query by makerspace

Every makerspace-scoped list or lookup made on behalf of a staff actor goes through the Auth and RBAC
module in `apps/accounts/rbac.py`:

| Function | Use it to |
| --- | --- |
| `rbac.scope_by_action(actor, action, queryset, field="makerspace_id")` | Filter to makerspaces where the actor holds a specific action. The usual choice for staff lists. |
| `rbac.scope_by_makerspace(actor, queryset, makerspace_field="makerspace_id")` | Filter to every makerspace the actor is an active member of. |
| `rbac.can(actor, action, makerspace_id)` | Authorize a single action in a single makerspace. |

Pass the related-field path when the makerspace is not a direct column, for example
`makerspace_field="machine__makerspace_id"`. Superadmins pass through unchanged except for makerspaces
that have disabled superadmin access, and archived makerspaces are excluded for everyone.

:::danger
An unscoped staff query is a cross-tenant data leak. Reviewers treat it as a security bug.
:::

## Gate endpoints on their module

Every endpoint that belongs to an optional module calls a guard from `apps/makerspaces/guards.py`:

- `require_module(makerspace, "bookings")` at the view boundary returns
  `400 {"module": "bookings is disabled for this makerspace."}` when the module is off.
- `require_module_locked(makerspace, key)` re-checks under the makerspace row lock. Call it inside the
  creating service's `transaction.atomic()`, so a concurrent uninstall cannot slip in between the check
  and the insert.
- `require_feature(...)` and `require_feature_locked(...)` do the same for features.

See [Adding a module](/develop/adding-a-module/) for the full picture.

## Transactions and row locks

- Wrap every state change in `transaction.atomic()` (or decorate the service with
  `@transaction.atomic`), and take `select_for_update()` on the rows you are about to change.
- **`select_for_update()` cannot be combined with `select_related()` across a nullable foreign key.**
  PostgreSQL rejects it with *"FOR UPDATE cannot be applied to the nullable side of an outer join"*.
  Drop the `select_related()` for that relation and let it lazy-load; the extra query is negligible
  next to the writes. Non-nullable relations (such as `makerspace`) are fine to join.
- **Never do network I/O while holding a row lock.** HTTP calls and object-storage operations belong
  after the commit. Use `transaction.on_commit(...)` for notifications and other side effects.

## Audit every state change

Every state-changing endpoint must emit an audit entry through the one writer, normally from inside
the service that makes the change (this example is from `apps/maintenance/services_workflows.py`):

```python
from apps.audit.services import record

record(
    actor,
    "maintenance.schedule_created",
    makerspace=machine.makerspace,
    target=schedule,
    meta={"machine_id": machine.pk},
)
```

- `target` can be a model instance; its label and primary key are recorded for you.
- Email addresses and IP addresses inside `meta` are replaced with keyed fingerprints before storage,
  but you should still keep `meta` free of personal data you do not need.
- Recording an audit entry also publishes the live-update hint the staff console listens to, so you
  do not need a second hook for real-time refresh.

### Append-only and immutable tables

`AuditLog`, evidence photo rows, box scans and QR scan events are protected twice: model methods
refuse updates and deletes, and PostgreSQL triggers (added in migrations) reject `UPDATE` and `DELETE`
at the database level. Do not try to work around them. The only sanctioned exceptions are the
superadmin purge paths, which bypass the triggers for `DELETE` only, inside a single transaction, with
a transaction-local setting.

## Errors: consistent and typed

- Raise DRF exceptions (`ValidationError`, `PermissionDenied`, `NotFound`) for boundary problems.
- Raise domain exceptions from services (for example `InvalidTransition` or `InsufficientStock`).
  The project's exception handler, `apps.hardware_requests.exceptions.workflow_exception_handler`,
  maps them to a status code and a stable body of the form `{"detail": "...", "code": "..."}`.
- When you add a new domain exception that can reach a client, register it in that handler's map so
  it does not surface as a `500`.

## Outbound integrations fail safe

Email, Telegram, Slack, Mattermost, Discord, webhooks, Stripe and object storage are all external.
A failure in any of them must never break the request that triggered it:

- Dispatch after commit, through the integrations layer (`apps.integrations`), which records a
  delivery log and retries asynchronously when Celery is available.
- Catch transport errors, log them with context, and return normally.
- Integration credentials are stored encrypted. Serializers accept them write-only and expose only a
  `*_set` flag.

## Structured logging

Use a module logger and log an event name plus structured context rather than a formatted sentence:

```python
import logging

logger = logging.getLogger(__name__)

logger.warning("evidence_finalize_failed", extra={"makerspace_id": makerspace.pk, "photo_id": photo.pk})
```

Production emits one JSON object per line with a request ID on every record. Development (`DEBUG`)
uses a readable single-line format. `LOG_JSON` and `LOG_LEVEL` override either.

## Document every endpoint in OpenAPI

An undocumented endpoint is incomplete. Every route needs a drf-spectacular `@extend_schema` with:

- `tags` and a `summary`,
- the request serializer (or `request=None`),
- the success response serializer,
- the error responses it can really return. Use `apps.openapi_errors.errors(400, 403, ...)` instead of
  spelling out each `OpenApiResponse`.

After changing routes or serializers, regenerate the checked-in schema snapshot and the generated
frontend client. See [Frontend](/develop/frontend/#generated-api-types).

## Pagination and list responses

List endpoints use DRF's `PageNumberPagination` with a page size of 24 and return:

```json
{ "count": 120, "next": "...?page=2", "previous": null, "results": [] }
```

Follow this shape for new list endpoints rather than inventing another envelope.

## Public data rules

Public endpoints use allowlist-only serializers. Never expose storage locations, box IDs, QR codes,
scan history, evidence photos, requester history or hidden counts. Inventory visibility is controlled
per item:

- `is_public = false`: the item is excluded from the public list.
- `public_availability_mode = hidden`: listed with `availability: null`.
- `status_only`: a label only (`Available`, `Limited` or `Unavailable`).
- `exact_count`: the exact count, but only when `show_public_count` is also true; otherwise it falls
  back to `status_only`.

## Related

- [Migrations and data](/develop/migrations-and-data/)
- [Adding a module](/develop/adding-a-module/)
- [Testing](/develop/testing/)
