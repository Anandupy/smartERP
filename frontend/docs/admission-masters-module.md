# Admission Masters Module

The 10 branch-scoped reference-data resources behind the admission and
applicant workflows: Admission Sources, Categories, Castes, Religions,
Genders, Languages, Blood Groups, Disabilities, Relation Types and Quotas.
`src/features/admission-masters`, wired from
`backend/docs/modules/admissions.md` and the Postman collection's
"Admissions › Masters" folder in `backend/postman/erp.postman_collection.json`.

Related: [Branch Module](./branch-module.md) ·
[Administration Modules](./administration-modules.md) ·
[Backend Contract Gaps](./backend-gaps.md#l-admission-masters)

---

## One config, ten resources

All 10 masters are **byte-identical in contract** — verified directly in the
Postman collection, not assumed: every one of the 10 "Masters" sub-folders has
the same five requests (List, Get by ID, Create, Update, Soft delete), the
same headers, and the same request/response body shape. The only thing that
differs between, say, Blood Groups and Relation Types is the URL's resource
segment.

`config/admission-master-registry.ts` is therefore the **one** place the
resources differ:

```ts
export type AdmissionMasterType =
  | "admission-sources" | "categories" | "castes" | "religions"
  | "genders" | "languages" | "blood-groups" | "disabilities"
  | "relation-types" | "quotas";
```

Every `resource` string is the exact kebab-case path segment the collection
documents — not guessed, not pluralized by convention. Everything downstream
(service, query keys, hooks, screens) takes a `resource` string or an
`AdmissionMasterConfig`, never a template. Adding an eleventh master, should
the backend ever ship one, means one registry entry — no new feature folder,
no new screens.

This is deliberately **not** a generic CRUD framework: there is one registry,
one service factory, one hook set and five screen components. Nothing here
is templated beyond what the 10 resources' identical contract already
justifies.

---

## Endpoints

Wired for every one of the 10 resources (`<resource>` is one of the 10 kebab
segments above):

| Endpoint                                              | Note                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `GET /admissions/masters/<resource>?includeInactive=`  | `includeInactive` is marked **Required** on every list request |
| `GET /admissions/masters/<resource>/:id`                |                                                              |
| `POST /admissions/masters/<resource>`                   | 5 documented fields: `code, name, description, displayOrder, isActive, metadata` |
| `PATCH /admissions/masters/<resource>/:id`               | Full body — no partial-update rule documented               |
| `DELETE /admissions/masters/<resource>/:id`              | **Soft delete** — every folder in the collection literally names it that |

The service is written out rather than built from `createResourceService`, for
the same reason branch, academic-year and organization are: the factory's
`list` appends `?page=…&pageSize=…`, and the only query parameter any of these
endpoints documents is `includeInactive`.

`x-branch-id` is required on every request but is never passed by hand — the
platform's `headerRegistry` (`core/workspace/workspace-headers.ts`) attaches
it automatically once the workspace scope is `ready`. Every hook in this
module gates on an active branch first (`useAdmissionMastersBranch`, mirroring
`academic-year`'s `useAcademicYearBranch`).

---

## Three facts that shape the module

**1. `includeInactive` is the only query parameter documented.** No `page`,
`limit`, `search` or `sortBy` exists on any of the 10 list endpoints, so
search, status filtering, sorting and paging all run in the client over one
fetch (`useAdmissionMasterList` always requests `includeInactive=true`), and
the directory's toolbar says so via `BackendPendingNote`.

**2. There is no dedicated status-toggle endpoint.** Unlike branch
(`PATCH /branches/:id/status`), academic-year's three transition endpoints, or
academic-unit's own `/status` route, admission masters have only the one
generic `PATCH /:id`, and its documented body is the complete record. So
`useToggleAdmissionMasterActive` resends the whole record with `isActive`
flipped (`toAdmissionMasterToggleRequest`) rather than a partial body — the
same "complete body" rule an edit follows, applied to the one place there is
no dedicated endpoint to lean on instead.

**3. `isActive` and `deletedAt` are separate, documented fields.** Toggling
active/inactive and deleting are two distinct actions with two distinct
dialogs (`ToggleAdmissionMasterActiveDialog`, `DeleteAdmissionMasterDialog`),
the same split `branch-dialogs.tsx` established. The delete dialog states the
record is soft-deleted and retained — never that the data is destroyed — and
never implies it can be restored from this app, since no restore endpoint is
documented for any of the 10.

---

## `metadata` is not a form field

Every request and response body documents a `metadata: Record<string, unknown>`
field, but neither `admissions.md` nor the Postman examples describe its
intended shape or purpose. Rather than build a raw-JSON editor for a contract
nobody has specified, the module never collects it from the user:

- **Create** sends `metadata: {}`, matching the Postman example's type.
- **Edit and toggle** carry the loaded record's `metadata` through unchanged
  (`toAdmissionMasterRequest(values, source)`), so saving a form the user can
  see never silently clears a field they cannot.

---

## Routing: one dynamic segment, ten resources

```
/app/admissions/masters                          → Overview
/app/admissions/masters/<resource>                → directory
/app/admissions/masters/<resource>/new            → create
/app/admissions/masters/<resource>/:id            → detail
/app/admissions/masters/<resource>/:id/edit       → edit
```

Five route files under `src/app/(app)/app/admissions/masters/`, with `[resource]`
validated against `isAdmissionMasterType` and `notFound()` on an unknown
segment — not 10 near-identical folders, since every resource renders the same
generic screens. This produces the same 10 distinct URLs a hand-written folder
per master would; it is an internal file-count reduction, not a behavior
change.

The generic detail screen (`AdmissionMasterDetailScreen`) also satisfies the
one resource that specifically needed a details view — Relation Types — by
being reusable across all 10 rather than building it once and leaving the
other nine without one.

---

## No invented permissions

No `admission.masters.*` permission string exists in `backend/docs/` or the
Postman collection, and no shipped feature (`branch`, `academic-year`,
`organization`) does button-level permission gating today — auth/role
protection happens once, at the `(app)` route-group layout. This module
follows the same precedent rather than inventing capability names the backend
has never declared. See
[Backend Contract Gaps §L](./backend-gaps.md#l-admission-masters) for the
full gap list, including the missing role matrix (L7).

---

## Testing

`tests/mocks/admission-masters-handlers.ts` builds MSW handlers by iterating
`ADMISSION_MASTER_TYPES` — the same registry the app is driven by — so all 10
resource paths are actually handled, not just one. `tests/integration/admission-masters.test.tsx`
drives the full flow (list load/empty/error, search/status filtering, create,
edit, activate/deactivate, delete, cancel) against one representative
resource (`blood-groups`), plus a data-driven spec that repeats the list-load
happy path across all 10 resources to catch a registry path/label typo.
`tests/unit/admission-master-registry.test.ts` guards the registry itself
against drifting from the verified kebab-case path list.
