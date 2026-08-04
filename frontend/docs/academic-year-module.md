# Academic Year Module

The administrative timeframes inside a branch. `src/features/academic-year`,
wired from `backend/docs/modules/academic-year.md` and the Postman collection.

Related: [Branch Module](./branch-module.md) ·
[Administration Modules](./administration-modules.md) ·
[Workspace Scope Platform](./workspace.md) ·
[Backend Contract Gaps](./backend-gaps.md)

---

## Why this module is the academic reference

It is the first module where the backend documents a **real lifecycle** rather
than a single flag, and the first that is scoped to something other than the
whole platform. Both of those recur in Programs, Academic Units, Timetables,
Examinations and Attendance, so the shapes established here are the ones those
modules should copy:

- a **branch-scoped** feature that reads its scope only from `useWorkspace()`,
- a **one-way lifecycle** modelled as data, with the missing inverses named,
- a **timeline** computed from documented dates, with undocumented calendar
  events declared rather than sketched.

---

## Endpoints

All eight are wired.

| Endpoint                            | Note                                            |
| ----------------------------------- | ----------------------------------------------- |
| `POST /academic-years`              | 4 documented fields                             |
| `GET /academic-years?branchId=`     | `branchId` **required**                         |
| `GET /academic-years/current?branchId=` | The branch's selected year                  |
| `PATCH /academic-years/:id`         | Full body — documented "if not locked"          |
| `PATCH /academic-years/:id/activate` | **No request body**                            |
| `PATCH /academic-years/:id/select`  | **No request body**                             |
| `PATCH /academic-years/:id/lock`    | **No request body**                             |
| `DELETE /academic-years/:id`        | **Soft delete**, if not locked and not selected |

The service is written out rather than built from `createResourceService`: the
factory's `list` appends `?page=…&pageSize=…`, and the only query parameter
documented anywhere here is `branchId`.

**There is no `GET /academic-years/:id`.** See below — it is the single fact
that most shapes this module.

---

## Five facts that shape the module

### 1. There is no read-by-id

Eight endpoints are documented and a read of one record is not among them.
`PATCH`, `DELETE` and the three transitions all take an `:id`; nothing returns a
single year. The module doc and the collection agree, so this is an **absence**,
not a disagreement — and inventing `GET /academic-years/:id` is exactly the
plausible guess that ships a 404.

So `useAcademicYear(id, branchId)` resolves a record **out of the documented
branch list**. Three consequences, all visible in the UI:

- viewing one year needs an **active branch**, so a detail link is not shareable
  across branches;
- "not found" means *not in this branch's list* — a weaker claim than a 404, and
  the empty state says so;
- there is no per-record refetch, which is why every mutation invalidates the
  list.

### 2. Everything is branch-scoped

`branchId` is documented `(Required)` on both reads, every request in the
collection carries `x-branch-id`, and **no endpoint lists years across
branches**. `useAcademicYearBranch()` is the module's one point of contact with
`useWorkspace()`; every query is gated on it, and without a branch each screen
says so rather than rendering an empty list that looks like a branch with no
years.

### 3. The lifecycle is a one-way ratchet

This is the best-supported lifecycle shipped so far, and the reason is worth
naming. Organization's status has no write path; Branch has one endpoint that
*flips* a flag and is therefore non-idempotent, which is why the branch toggle
must be withheld when the current state is unknown.

Academic Year has three endpoints that each **name a target state in the path**.
`activate`, `select` and `lock` are idempotent, so nothing here is withheld for
uncertainty — firing `lock` on a year whose flags never came back still produces
a locked year.

What the contract has none of is an **inverse**:

| Documented forward | Documented reverse |
| ------------------ | ------------------ |
| `activate`         | none               |
| `select`           | none               |
| `lock`             | none               |
| `DELETE` (soft)    | none               |

So the module is built to make that unmissable: the four missing transitions get
a panel of their own on the lifecycle screen rather than being silently absent,
every confirmation carries the warning, and a locked year has **all** of its
actions withheld with the documented reason.

Whether the backend applies documented rule 4 ("locked years cannot be
modified") to the lifecycle endpoints specifically is *not* stated. Withholding
is the conservative reading; the gap is recorded rather than resolved by
guessing.

### 4. Three independent flags, not one enum

`isActive`, `isSelected` and `isLocked` are documented in prose under "States",
and a year can legitimately be **current and locked at once**.

- `academicYearState()` picks one label by operational consequence — locked
  first, because that is the flag that stops writes.
- The detail screen reports all three **separately**, because the badge has to
  pick one and a current-and-locked year would otherwise lose the fact that the
  branch is still writing into it.
- An unreported flag reads **"Not reported"**, never "No". No response body is
  documented, so the flags genuinely may be absent, and reading an absent
  `isLocked` as `false` is what loses an audited year's data.

### 5. A calendar needs events, and there are none

`startDate` and `endDate` are real documented fields in both request bodies, so
spans, elapsed days, percentage complete and the position of today are all
**computed from data** — the one part of the design's calendar that can be wired
honestly.

Terms, semesters, holidays, exam windows and milestones have no field and no
endpoint anywhere. They are enumerated by name with `BackendPendingBadge` /
`BackendPendingNote`, and **no empty month grid is drawn**: a calendar with
nothing in it invites the reading "nothing is scheduled", which is a claim this
app has no endpoint to support.

---

## Screens

| Screen             | Route                                    |
| ------------------ | ---------------------------------------- |
| Dashboard          | `/app/academic-years`                    |
| Directory          | `/app/academic-years/directory`          |
| Calendar & timeline | `/app/academic-years/calendar`          |
| Create             | `/app/academic-years/new`                |
| Details            | `/app/academic-years/[id]`               |
| Edit               | `/app/academic-years/[id]/edit`          |
| Lifecycle          | `/app/academic-years/[id]/lifecycle`     |

No path carries a branch segment: every screen reads the workspace's current
scope, which is where the branch already lives.

**"Academic Year States" is not a route.** Loading, empty, error, success,
permission-denied, Backend Pending and the four confirmations are states of the
real screens, each built from the existing shared components and each covered by
an integration test. `AcademicYearBoundary` resolves five of them once —
no-branch, loading, not-found, forbidden, failed, loaded — so details, edit and
lifecycle do not each re-decide what a `403` means.

---

## Validation

The backend documents five rules. The module asserts the one a browser can
decide alone, and withholds the actions the others govern.

| # | Rule                                          | Where it is enforced                          |
| - | --------------------------------------------- | --------------------------------------------- |
| 1 | `startDate` before `endDate`                  | **Schema** — the form knows both values.      |
| 2 | No overlapping ranges within a branch         | Schema *and* server (advisory — see below).   |
| 3 | One `isSelected` year per branch              | Server. No client equivalent.                 |
| 4 | Locked years cannot be modified or deleted    | UI withholds the action; server enforces.     |
| 5 | The selected year cannot be deleted           | UI withholds the action; server enforces.     |

Rule 2 is a **courtesy check**, not an authority: `findOverlappingYear` compares
against the years the list returned, and the documentation does not say whether
soft-deleted years are excluded — there is no `isDeleted` field to test. It
catches the common mistake while the form is still open and says the server
decides.

Nothing else is asserted. `name` has no documented format (the only sample is
`"2025-26"`), so none is imposed — an invented pattern would reject
"Academic Year 2025 (Spring Intake)" with no backend to blame.

---

## Dates

The recorded samples are bare `YYYY-MM-DD`, so:

- the form uses **native `date` inputs**, whose output is already the wire
  format — no parsing step to get wrong, and keyboard access comes free;
- rule 1 is checked by **string comparison**, because `YYYY-MM-DD` sorts
  lexicographically in date order and therefore needs no timezone;
- the timeline parses to **UTC midnight**, so a year does not start a day
  earlier or later depending on where the operator is sitting;
- reads tolerate a full ISO timestamp (`toDateInputValue` truncates it), because
  the field is typed nowhere and tolerating costs nothing.

---

## Reuse

Nothing here duplicates existing infrastructure: `DataTable` and its toolbar,
pagination and sortable headers; `useZodForm`, `TextField`,
`applyServerFieldErrors`; `FormSkeleton`, `PageSkeleton`, `EmptyState`,
`ApiErrorState`, `ForbiddenState`, `BackendPendingBadge`/`Note`, `Banner`;
`ConfirmDialog`; `StatCard`, `StatusBadge`, `DescriptionList`, `LinkCard`;
`Progress`; `PageHeader`.

The module adds only what is genuinely domain-specific: `AcademicYearBoundary`,
`AcademicYearStatusBadge` (three flags → one label), the two confirmation
dialogs, the lifecycle model, and the timeline geometry
(`academicYearProgress`, `buildTimelineLayout`).

Three icons were added to the curated registry — `CalendarCheck`,
`CalendarRange`, `LockOpen`.

---

## Audit trail

Academic year events are recorded under the **`ACADEMIC`** audit module
(`academic_year.created`, `.updated`, `.deleted`), so the dashboard and details
trails are real — composed at the route through slots, so neither feature
imports the other.

The event map documents **no event for the three lifecycle transitions**.
Activating, selecting or locking a year will not appear in the trail; that gap
is recorded in [Backend Contract Gaps](./backend-gaps.md).
