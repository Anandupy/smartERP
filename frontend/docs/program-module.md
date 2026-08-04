# Program Module

The academic classification inside a branch. `src/features/program`, wired from
`backend/docs/modules/program.md` and the Postman collection.

Related: [Academic Unit Module](./academic-unit-module.md) ·
[Branch Module](./branch-module.md) ·
[Backend Contract Gaps](./backend-gaps.md)

---

## What a program is

A **branch** is the legal and geographical institution; a **program** is a
vertical structure inside it — "Primary (English)", "Jr. College (Science)",
"B.Tech (Engineering)". Programs are static and span years, which is what
distinguishes them from academic years (time-bound) and academic units
(per-year, and the thing that actually changes with enrolment).

Programs may nest: *School → Primary, Secondary*.

---

## Endpoints

All seven are wired.

| Endpoint                     | Note                                    |
| ---------------------------- | --------------------------------------- |
| `POST /programs`             | 6 documented fields                     |
| `GET /programs?branchId=`    | `branchId` **required**                 |
| `GET /programs/tree?branchId=` | Documented by **name only**           |
| `GET /programs/:id`          |                                         |
| `PATCH /programs/:id`        | Full body — no partial update documented |
| `PATCH /programs/:id/status` | **Toggle.** No request body              |
| `DELETE /programs/:id`       | **Soft delete**                          |

The service is written out rather than built from `createResourceService`: the
factory would append `?page=…&pageSize=…`, and `branchId` is the only documented
query parameter.

---

## Four facts that shape the module

### 1. The docs and Postman disagree about `level`

`level` is in **both request bodies** and in **no part of the module
documentation** — not the concepts, not the examples, and notably not
uniqueness rule 1, which combines `branchId + name + medium + stream`.

Resolution, following the maintenance module's precedent for the same class of
mismatch: `level` is **sent**, because Postman is the request contract, and
typed **optional on read**, because no data structure promises it comes back.

Its only recorded value is `"SCHOOL"` — one sample, not a value set — so the
field is **free text** and the directory's level filter is built from the values
the branch actually returned. An invented `SCHOOL | COLLEGE | UNIVERSITY` enum
would hide real data behind options that do not match it.

### 2. The tree endpoint is documented by name only

`GET /programs/tree` is one row in a table reading "Get hierarchical tree". No
response body, no nesting key, no envelope.

So **nothing depends on its shape.** The hierarchy screen builds its tree from
the **flat list** with the shared `buildTree`, which needs only `parentId` — a
field both request bodies document. The endpoint is still called and narrowed by
`readProgramTree`, which accepts four plausible shapes and reports
`isUnrecognized` otherwise; that turns a wrong guess into a note rather than a
broken screen.

### 3. The status toggle takes no request body

Same shape as the branch toggle, and treated the same way: it **flips**
`isActive` rather than setting it, which makes it non-idempotent. So it is
confirmed before firing, never retried, never optimistic, and **withheld
entirely** when the current state was not reported — flipping from an unknown
start has an unpredictable result.

### 4. Two validation rules live in the controls, not in a check

| # | Rule                                                 | Where it is enforced                                    |
| - | ---------------------------------------------------- | ------------------------------------------------------- |
| 1 | `branchId + name + medium + stream` unique per branch | `findDuplicateProgram` — a **warning**, not a block.    |
| 2 | A child must share its parent's branch                | Structural: the picker offers one branch's programs.    |
| 3 | No circular parent-child loops                        | `eligibleParents` removes self and all descendants.     |
| 4 | Cannot delete with active children                    | `deleteBlockedReason` withholds it and names them.      |

Rules 2 and 3 **cannot be expressed** through the UI at all, which is a better
outcome than validating them after the fact. Rule 1 warns rather than blocks
because the list it compares against is not guaranteed to be every program that
exists — the endpoint documents a soft delete and no flag for one.

Rule 4's check counts children whose `isActive` is *explicitly* `true`. A child
whose flag was not reported is not evidence of an active child, and blocking on
it would make deletion impossible against a backend that omits the field.

---

## Screens

| Screen    | Route                       |
| --------- | --------------------------- |
| Dashboard | `/app/programs`             |
| Directory | `/app/programs/directory`   |
| Hierarchy | `/app/programs/tree`        |
| Create    | `/app/programs/new`         |
| Details   | `/app/programs/[id]`        |
| Edit      | `/app/programs/[id]/edit`   |

No path carries a branch segment: every screen reads the workspace's current
scope. `ProgramBoundary` resolves no-branch, loading, not-found, forbidden,
failed and loaded once, so details and edit do not each re-decide what a `403`
means.

---

## `ProgramPicker` — the cross-feature seam

An academic unit's request body names a `programId`, so its form needs a program
list. A feature may not import another feature
([AGENTS.md §7](../AGENTS.md#7-dependency-rules), §28).

`ProgramPicker` is this module's answer: a client component on the public
surface that calls `useFormContext()` and binds itself to whatever form it is
rendered inside — possible because `@/components/form`'s `Form` **is** React Hook
Form's `FormProvider`.

The route renders it and passes it to Academic Unit's form as an opaque
`ReactNode`. Academic Unit never learns that a Program module exists. See
`src/app/(app)/app/academic-units/program-composition.tsx` and
[Academic Unit Module](./academic-unit-module.md#the-program-seam).

---

## Reuse

Nothing here duplicates existing infrastructure: `DataTable` and its toolbar,
pagination and sortable headers; the new shared `TreeView`; `useZodForm`,
`TextField`, `SelectField`, `applyServerFieldErrors`; `FormSkeleton`,
`EmptyState`, `ApiErrorState`, `ForbiddenState`, `BackendPendingBadge`/`Note`,
`Banner`; `ConfirmDialog`; `StatCard`, `StatusBadge`, `DescriptionList`,
`LinkCard`; `PageHeader`.

Hierarchy logic is **not** duplicated: `buildTree`, `collectDescendantIds` and
`ancestorPath` live in `@/utils/tree` and are shared with Academic Unit. This
module adds only the domain part — which field is the parent, how siblings
order, and what the documented rules mean.

---

## Audit trail

The audit event map documents `ACADEMIC` events for `academic_year.*` and
`academic_unit.*` and **no `program.*` event at all**. The trail on the dashboard
and detail screens is therefore the `ACADEMIC` module's, and may contain nothing
from this one — which the screens say, so an empty trail does not read as "no
activity".
