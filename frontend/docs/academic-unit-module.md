# Academic Unit Module

The operational structure inside a program — departments, classes, divisions,
batches. `src/features/academic-unit`, wired from
`backend/docs/modules/academic-unit.md` and the Postman collection.

Related: [Program Module](./program-module.md) ·
[Academic Year Module](./academic-year-module.md) ·
[Applicant Admission Lifecycle](./admission-lifecycle-module.md) ·
[Workspace Scope Platform](./workspace.md) ·
[Backend Contract Gaps](./backend-gaps.md)

---

## What an academic unit is

Where a **program** is a stable grouping ("Primary English", "Engineering"), an
academic unit is **dynamic and tightly scoped to one academic year** — because
sections, divisions and batches grow, shrink and split with enrolment for that
year specifically. That premise is the module's most important design input:
an empty structure in a new year is normal, not data loss.

The documentation's own examples:

```
Primary English (Program)          Engineering (Program)
└── Std 1 (CLASS)                  └── IT Department (DEPARTMENT)
    ├── Div A (DIVISION)               └── FYIT (YEAR)
    └── Div B (DIVISION)                   └── Batch A (BATCH)
```

Depth is unlimited and driven by `parentId`.

---

## Endpoints

All eight are wired.

| Endpoint                             | Note                                        |
| ------------------------------------ | ------------------------------------------- |
| `POST /academic-units`               | 10 documented fields                        |
| `GET /academic-units?…`              | `branchId` **and** `academicYearId` required |
| `GET /academic-units/tree?…`         | Documented by its Postman entry only        |
| `GET /academic-units/:id`            |                                             |
| `PATCH /academic-units/:id`          | Full body — no partial update documented    |
| `PATCH /academic-units/:id/move`     | **The only action with a request body**     |
| `PATCH /academic-units/:id/status`   | **Toggle.** No request body                 |
| `DELETE /academic-units/:id`         | **Soft delete**                             |

---

## Six facts that shape the module

### 1. It needs two levels of workspace scope

Every module before this needed one. Here `branchId` **and** `academicYearId`
are both documented `(Required)` on the list and tree endpoints, and every
request carries both `x-branch-id` and `x-academic-year-id`.

So "no scope" is two different problems with two different fixes, and
`AcademicUnitScopeGate` says **which half** is missing. A branch with no
selected academic year is the likelier case and the one whose remedy is
non-obvious — it lives in the Academic Year module, not the workspace switcher
— so that state links there.

### 2. `unitType` is picked from a nine-value enum

The documentation names six values across its two examples (`CLASS`,
`DIVISION`, `DEPARTMENT`, `YEAR`, `BATCH`, plus `SECTION` from the Postman
body) and then says, explicitly:

> **Avoid Hardcoding Enums:** `AcademicUnitType` serves mainly as UI tags.
> Always depend on tree structure and node references rather than hardcoding
> logic targeting a specific level like "CLASS".

The backend has since confirmed the whole set — `SECTION`, `CLASS`, `DIVISION`,
`STREAM`, `DEPARTMENT`, `YEAR`, `SEMESTER`, `BATCH`, `CUSTOM` — recorded once in
`ACADEMIC_UNIT_TYPES`. A write can therefore only be one of nine values, so the
form offers a **select** rather than a text box a user has to spell correctly.

Two things the warning asks for are unchanged:

- **Nothing branches on the value.** The list decides what can be *picked*; no
  screen behaves differently because a unit is a `CLASS`.
- **What is read back is rendered verbatim.** No lookup stands between a stored
  value and the screen, and the directory's type filter is still built from the
  values the data actually contains — a filter listing all nine would offer
  eight that narrow to nothing.

The picker shows a title-case label (`Section`) beside the constant it sends
(`SECTION`), because every other screen displays the raw constant. The request
body carries the constant exactly, unchanged.

### 3. `level` is server-computed and never sent

> The `level` variable is auto-calculated starting at `0` for roots. It is
> maintained across moves dynamically by traversing the subtree. Do not update
> manually.

It appears in no request body, so it appears in none of this module's request
types either. On read it is preferred when present; when the response omits it —
no response body is documented — the depth is derived from the hierarchy the
browser built, and the detail screen marks it `(derived)`.

### 4. `move` is the only action with a request body

Across both academic modules, every other action endpoint is a bodyless flip.
`PATCH /:id/move` carries `{ parentId }`, so it **names its target** and is
idempotent — safe to confirm, fire and retry.

The destination list comes from `eligibleParents`, which encodes two documented
rule groups at once, so the control cannot offer a destination the server will
refuse:

- **Consistency** — a unit shares its parent's `branchId`, `programId` and
  `academicYearId`. Branch and year are already fixed by the scope, so only the
  program is matched, and it is matched strictly.
- **Tree** — self-parenting and circular references are prevented, so the record
  and every one of its descendants are excluded.

The dialog also warns that a move **rewrites every descendant's level**, which
is a documented consequence a user moving one node would not otherwise expect.

### 5. The tree endpoint is documented by name only

As with Programs: no response body, no nesting key, no envelope. The hierarchy
is built from the **flat list** with the shared `buildTree`;
`readAcademicUnitTree` narrows the endpoint defensively and reports
`isUnrecognized` when it cannot, so a wrong guess is a note rather than a broken
screen.

### 6. Placement targets — `displayPath` and `isPlacementTarget`

Unlike everything above, this fact is **not** from Postman. `GET
/academic-units`, `/tree` and `/:id` now also return `displayPath` (the full
path from the root, `"Grade 1 → Division A"`) and `isPlacementTarget` (whether
the unit has no active children); `/:id` additionally returns the root-first
`ancestors` chain. The source is direct, verified backend code —
`backend/docs/planning/academic-placement-refinement.md` §4–§7 — not a Postman
transcription, and that document is itself the record of the backend change
that added the fields.

**Why it exists.** Nothing previously distinguished "Grade 1" (a structural
node with children) from "Grade 1 → Division A" (an actual place a learner
sits) on the wire — a picker built from `name`/`parentId` alone could offer
either, and "Division A" read on its own is ambiguous the moment a program has
more than one class. The backend refuses a structural node as an Enrollment or
admission `academicUnitId` with `ACADEMIC_UNIT_NOT_PLACEMENT_TARGET`; this
module's `AcademicUnitPicker` is the UI half of the same rule — it filters to
`isPlacementTarget === true` by default (`placementTargetsOnly`, on unless a
caller explicitly needs the raw hierarchy) and labels every option with
`displayPath`, never the bare `name`. `placementTargetState` (mirroring the
existing `academicUnitState`) reads the field defensively: `"unknown"` for the
create/update/move/status-toggle responses, which return the bare record and
never carry these three fields at all — never guessed as a placement target,
since offering a structural node is exactly the defect the field exists to
prevent.

Nothing is recomputed client-side: `displayPath` is rendered exactly as the
backend returns it, both in the picker and anywhere else a unit's path is
shown (`academicUnitDisplayPath`), so it can never disagree with the rule the
backend itself enforces.

---

## Validation

| Rule group   | Documented as                                                        | Where it is enforced                                   |
| ------------ | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Existence    | Branch, Program and AcademicYear must strictly exist                 | Structural — all three come from loaded, scoped data.  |
| Consistency  | A unit shares its parent's `branchId`, `programId`, `academicYearId` | The parent picker offers same-program units only.      |
| Tree         | Self-parenting and circular references prevented                     | The picker excludes the record and its descendants.    |
| Uniqueness   | Siblings sharing a parent and year must have unique names            | `findDuplicateSibling` — a **warning**, not a block.   |
| Best practice | The engine prevents deleting a parent with active children          | `deleteBlockedReason` withholds it and names them.     |

`metadata` is validated **only** as a JSON object. The documentation describes
it as the escape hatch for attributes that "don't need strict relational
schemas" — room capacities, minimum students, lab requirements, shift timings —
and names no keys, so the raw JSON is edited directly. A structured editor would
be a schema this app invented.

---

## Screens

| Screen    | Route                             |
| --------- | --------------------------------- |
| Dashboard | `/app/academic-units`             |
| Hierarchy | `/app/academic-units/tree`        |
| Directory | `/app/academic-units/directory`   |
| Create    | `/app/academic-units/new`         |
| Details   | `/app/academic-units/[id]`        |
| Edit      | `/app/academic-units/[id]/edit`   |

The **hierarchy is the primary screen**: the documentation's premise is
structural, and a flat list of "Div A, Div B, FYIT, Batch A" is close to
meaningless without showing what sits under what. The directory exists beside it
because a flat table is what can be searched, sorted and filtered.

Move is a **dialog, not a route** — it is one field, and it is reachable from
the tree, the directory row menu and the detail header.

---

## The Program seam

An academic unit's request body names a `programId`, and features may not import
each other ([AGENTS.md §28](../AGENTS.md#28-contract-driven-modules): *"Two
features that meet do so at the route, through slots"*).

`src/app/(app)/app/academic-units/program-composition.tsx` is that route
composition — the **only** module in the app that imports both feature barrels.
It exists because a Server Component cannot call the hooks that fetch programs,
so the join has to be a client component, and it belongs to neither feature.

Exactly two things cross the boundary:

| What                                   | How                                                            |
| -------------------------------------- | -------------------------------------------------------------- |
| The program **selector**               | An opaque `ReactNode`; binds itself via `useFormContext()`.     |
| Program **names**                      | A plain `ReadonlyMap<string, string>`.                          |

Without the slot the form falls back to a disabled field with a pending note
rather than silently submitting an empty `programId`.

---

## Reuse

`DataTable` and its toolbar and pagination; the shared `TreeView`; `useZodForm`,
`TextField`, `SelectField`, `SwitchField`, `TextareaField`,
`applyServerFieldErrors`; `FormSkeleton`, `EmptyState`, `ApiErrorState`,
`ForbiddenState`, `BackendPendingBadge`/`Note`, `Banner`; `ConfirmDialog`;
`StatCard`, `StatusBadge`, `DescriptionList`, `LinkCard`; `PageHeader`.

Hierarchy logic is shared with Program through `@/utils/tree` — `buildTree`,
`flattenTree`, `collectDescendantIds`, `ancestorPath`. This module adds only the
domain part: `displayOrder`-then-name sibling ordering, the program-scoped
parent rule, and the delete rule.

---

## Audit trail

Academic unit events are recorded under the **`ACADEMIC`** audit module
(`academic_unit.created`, `.updated`, `.deleted`), so the trails are real —
composed at the route through slots.

The map documents **no event for the move or status endpoints**, so re-parenting
or deactivating a unit will not appear in the trail. The screens say so.
