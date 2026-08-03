# Branch Module

The campuses inside an organization. `src/features/branch`, wired from
`backend/docs/modules/branch.md`, `backend/docs/modules/branch-settings.md` and
the Postman collection.

Related: [Organization Module](./organization-module.md) ·
[Administration Modules](./administration-modules.md) ·
[Backend Contract Gaps](./backend-gaps.md)

---

## Two documents, one entity

Branch is documented **twice**, and neither document is complete alone. This is
worth knowing before reading either.

|                                       | `branch.md` | `branch-settings.md`                     |
| ------------------------------------- | ----------- | ---------------------------------------- |
| Data Structure table                  | absent      | 10 fields, incl. `isActive`, `isDeleted` |
| `institutionType` (7 values)          | ✅          | —                                        |
| `affiliationType` / `affiliationName` | ✅          | —                                        |
| `registrationNumber`                  | ✅          | —                                        |
| `structureMode`                       | ✅          | ✅                                       |
| Endpoint list                         | 5           | **7**                                    |
| Role matrix                           | —           | ✅                                       |

**`branch-settings.md` is not a settings document.** It is titled "Branch
Module" and describes the branch entity. There is no branch settings API — see
[Branch Settings](#branch-settings) below.

`branch.md`'s endpoint list omits `GET /branches/organization/:orgId` and
`PATCH /branches/:id/status`. Postman and `branch-settings.md` both have them,
so the module follows the seven.

---

## Endpoints

All seven are wired.

| Endpoint                            | Note                                      |
| ----------------------------------- | ----------------------------------------- |
| `POST /branches`                    | 17 documented fields                      |
| `GET /branches`                     | Documented as listing **active** branches |
| `GET /branches/organization/:orgId` | The only scoped read                      |
| `GET /branches/:id`                 |                                           |
| `PATCH /branches/:id`               | Full body — no partial update documented  |
| `PATCH /branches/:id/status`        | **Toggle.** No request body               |
| `DELETE /branches/:id`              | **Soft delete** → `isDeleted`             |

The service is written out rather than built from `createResourceService`: no
endpoint documents a query parameter, and the factory would append
`?page=…&pageSize=…` to every request.

---

## Three facts that shape the module

**1. No endpoint takes a query parameter.**
Search, status and type filtering, sorting and paging all run in the client over
the full list, and the directory says so on the page.

**2. Status is a pair of booleans, not an enum.**
`isActive` and `isDeleted` are documented fields; neither is in a request body.
`branchState()` derives one of four values from them — and the fourth is
`unknown`, which matters: no response body is documented, so `isActive` may
genuinely be absent, and reading an absent flag as `false` would show a working
campus as suspended.

**3. The status toggle takes no request body.**
It is sent bodyless because the recorded request has none — no `Content-Type`,
no `body` key, while every other `PATCH` in the collection has both. The
consequence is that a _target_ state cannot be requested: the call flips
whatever `isActive` currently is. So the toggle is

- **confirmed before firing**, with the resulting state named in the prompt,
- **never retried** (`retry: false`) and never optimistic,
- **withheld entirely** when the current state is `unknown`, because flipping
  from an unknown start has an unpredictable result.

That last one is the rule `nextToggleAction` encodes, and it is asserted by
both a unit and an integration test.

---

## Screens

| Screen    | Route                                         |
| --------- | --------------------------------------------- |
| Dashboard | `/app/branches`                               |
| Directory | `/app/branches/directory`                     |
| Create    | `/app/branches/new`                           |
| Details   | `/app/branches/[id]`                          |
| Edit      | `/app/branches/[id]/edit`                     |
| Lifecycle | `/app/branches/[id]/lifecycle`                |
| Settings  | `/app/branches/[id]/settings` + five sections |

Settings are nested **under** a branch rather than beside it, because every one
of them is scoped to a single campus.

**"Branch System States" is not a route.** Loading, empty, error, success,
Backend Pending, delete confirmation, active/inactive, permission and not-found
are states of the real screens, each built from the existing shared components
and each covered by an integration test. `BranchBoundary` resolves five of them
once — loading, not found, forbidden, failed, loaded — so four screens do not
each re-decide what a `403` means.

---

## Lifecycle

Better supported than Organization's: `isActive` has a real write path and
`isDeleted` a documented soft delete, so three of the design's five stages are
reachable and the active/inactive transition works **in both directions**.

| Stage              | Reality                                            |
| ------------------ | -------------------------------------------------- |
| Active             | `isActive: true`. Reachable — the status toggle.   |
| Inactive           | `isActive: false`. Reachable — the same toggle.    |
| Archived           | No field, no value, no endpoint. Backend Pending.  |
| Deleted            | `isDeleted: true` via the documented soft delete.  |
| Permanent deletion | Does not exist. Soft delete only. Backend Pending. |

---

## Branch Settings

**There is no Branch Settings API.** Every path in the Postman collection
containing "branch" is one of the seven entity endpoints; none has `settings`
in it.

So four of the five sections ship as **layout only**:

- No service methods, no DTOs, no schemas, no mutations. A fake
  `branchSettingsService` would be a lie that later has to be unpicked.
- Real controls — `Input`, `Switch`, `Select`, `Textarea` — every one
  `disabled`, so a keyboard user never lands on something unfillable. Real
  controls rather than skeletons, because the point of shipping these now is to
  agree the shape before the API is written, and a grey rectangle communicates
  nothing about what a field is.
- Each group states precisely what the backend has not published, through the
  existing `BackendPendingNote`.

`PendingSettingsGroup` is a composition of existing primitives, not a new
placeholder component — the platform's Backend Pending components are used
unchanged.

Two sections point users at what _is_ editable: General links to the branch
record for name, code, contact and address; Academic notes that `structureMode`
is a documented field.

**History is the exception** and is fully wired — the audit explorer pinned to
this branch by `module` and `aggregateId`, both documented filters, composed at
the route so neither feature imports the other.

---

## Reuse

Nothing here duplicates existing infrastructure: `DataTable` and its toolbar,
pagination and sortable headers; `useZodForm`, `TextField`, `SelectField`,
`applyServerFieldErrors`; `FormSkeleton`, `EmptyState`, `ApiErrorState`,
`ForbiddenState`, `BackendPendingBadge`/`Note`, `Banner`; `ConfirmDialog`;
`StatCard`, `StatusBadge`, `DescriptionList`, `LinkCard`; `PageHeader`.

The module adds only what is genuinely domain-specific: `BranchStatusBadge`
(deriving a state from two booleans), `BranchBoundary`, the two confirmation
dialogs, and the lifecycle model.
