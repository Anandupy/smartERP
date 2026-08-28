# Academic placement refinement

> **Status:** `reconciled` — audit against the implemented Phase 4 Enrollment
> spine and the Program/AcademicUnit model, plus one closed defect
> (§6, §9 — placement-target enforcement).
> **Reconciled against:** the repository as of this change, on top of the
> Phase 0–5.5 / R1–R14 state recorded in
> [`core-admission-lifecycle-specification.md`](core-admission-lifecycle-specification.md)
> and [`student-admission-enrollment-architecture.md`](student-admission-enrollment-architecture.md).

## 1. Problem

The brief asked for the backend to make

    Grade 1 → Division A

resolvable and enforceable, rather than an ambiguous `Division A`, and to
settle capacity, roll number and class-list-lock ownership along the way. Most
of this was already decided and implemented in Phase 4 (Enrollment) and the
core lifecycle spec's §19–§22; this document is the audit that verified that,
names the one place the implementation fell short of its own documented
intent, and closes it.

## 2. Current architecture (verified, not redesigned)

```
Program  →  AcademicYear  →  AcademicUnit hierarchy  →  Enrollment  →  Student
```

Confirmed against `prisma/modules/academic/*.prisma`,
`prisma/modules/enrollment/*.prisma` and the corresponding services:

| # | Relationship | Verified as |
| :-- | :-- | :-- |
| 1 | Program → AcademicYear | Indirect and correct: `AcademicUnit` composite-keys both, so a unit — and therefore an Enrollment — cannot combine a programme and a year that don't belong to the same branch (`Program.@@unique([id, branchId])`, `AcademicUnit.@@unique([id, branchId, programId, academicYearId])`). Program itself is year-independent by design (§3). |
| 2 | AcademicUnit → Program | `AcademicUnit.programId`, FK to `Program`, `@@index([programId])` |
| 3 | AcademicUnit → AcademicYear | `AcademicUnit.academicYearId`, FK, `@@index([academicYearId])` |
| 4 | AcademicUnit → Branch | `AcademicUnit.branchId`, FK, `@@index([branchId])` |
| 5 | AcademicUnit parent/child | Self-relation `parentId` → `AcademicUnitHierarchy`, unlimited depth |
| 6 | AcademicUnit level | `level: Int`, server-computed on create, recalculated across the subtree on move (`updateDescendantLevels`) |
| 7 | AcademicUnit type | `unitType: AcademicUnitType` — `SECTION, CLASS, DIVISION, STREAM, DEPARTMENT, YEAR, SEMESTER, BATCH, CUSTOM` |
| 8 | Enrollment → AcademicUnit | Composite FK `(academicUnitId, branchId, programId, academicYearId) → AcademicUnit(id, …)` — INV-ENR-010 |
| 9 | Enrollment → Program | Composite FK `(programId, branchId) → Program(id, branchId)` |
| 10 | Enrollment → AcademicYear | `academicYearId`, kept honest by #8 rather than trusted directly |
| 11 | Enrollment composite integrity | `enrollment_one_primary_per_year` (partial unique), `enrollment_rollno_unique` (partial unique), plus five CHECK constraints — see migration `20260812000000_phase4_enrollment` |
| 12 | AcademicUnit active/inactive | `isActive: Boolean`, `isDeleted: Boolean` (soft delete) |

All twelve already held. Nothing here needed a schema change.

### 2.1 Program vs AcademicUnit — the semantic already enforced

The brief's central invariant — *Program is a stable academic offering,
AcademicUnit is the year-specific structure of that offering* — is already
what the schema says: `Program` carries no `academicYearId` at all, and
`AcademicUnit` is the only place a year enters the hierarchy. An institution
does not recreate "Grade 1" every year; it creates a new `AcademicUnit` tree
under the same `Program` for each `AcademicYear`. Verified in the realistic
seed (`test/seeds/realistic-data.seed.ts`), which builds exactly the brief's
example — one `Program` "Grade 1", one `AcademicUnit` "Grade 1" for
`academicYear24`, two children "Division A"/"Division B" — and in the
integration fixtures, which build the same shape for "Std 1-A"/"Std 1-B".

No code change. `DECIDED`, pre-existing.

## 3. AcademicUnit hierarchy — not redesigned

Confirmed the existing model already expresses every shape in the brief
without a dedicated `Class`/`Division`/`Section`/`Batch` table:

```
Grade 1 (CLASS)                    FYJC Science (CUSTOM)
  ├─ Division A (DIVISION)           ├─ Division A (DIVISION)
  └─ Division B (DIVISION)           └─ Division B (DIVISION)

B.Sc Computer Science (DEPARTMENT)   Diploma XYZ (CUSTOM)
  └─ Year 1 (YEAR)                     └─ Batch 2026 (BATCH)
       ├─ Division A (DIVISION)             ├─ Section A (SECTION)
       └─ Division B (DIVISION)             └─ Section B (SECTION)
```

`unitType` is exactly what §18 asks it to be shown to be: a classification
label an institution picks for its own vocabulary, carrying no structural
authority. Nothing in `AcademicUnitService`, `EnrollmentService` or
`AdmissionConversionService` branches on its value. Depth, parentage and
placement eligibility are 100% derived from `parentId`/`level` and — after
this change — the presence of active children, never from `unitType`. No new
table was created; none was needed.

## 4. Placement target — the one defect this refinement closes

### 4.1 What was documented but not enforced

`EnrollmentDto.academicUnitId` already carried this comment before this
change:

> "The leaf placement node — the section, not the class above it."

Nothing enforced it. The composite foreign key
(`academicUnitId, branchId, programId, academicYearId`) proves a unit
*belongs* to the right branch, programme and year; it says nothing about
whether that unit is a leaf. Before this change, both
`AdmissionConversionService.resolvePlacement` (the `admit()` pre-transaction
guard) and `EnrollmentService` (`createInitialEnrollment`,
`supersedeEnrollment` — the sole write paths for `Enrollment.academicUnitId`,
reachable today via `correct`/`transfer` as well as `admit()`) accepted a
**non-leaf** unit — "Grade 1" itself, with live "Division A"/"Division B"
children — as a placement target. That is precisely the ambiguity item 6 of
the brief asks to be closed: a registrar could place a student directly on
the structural node, producing an Enrollment whose "class" is indistinguishable
from the parent of the section it should have been.

This is a **genuine, demonstrated defect** — reachable over HTTP via
`PATCH /enrollments/:id/correct` and `/transfer` in addition to `admit()` —
not a hypothetical, which is why it is fixed here rather than only documented.

### 4.2 The fix — reuse the hierarchy, no new field

Per §6's instruction not to infer placement eligibility from `unitType` and to
reuse the existing hierarchy where it already carries the meaning: a unit is a
**valid placement target** exactly when it has **no active (non-deleted)
children**. This is derived at write time from data that already exists —
`AcademicUnit.parentId` — and needs no new schema field, no `isLeaf` column,
and no per-institution configuration. It generalizes to every shape in §3
without special-casing: an institution with no intermediate level places
students directly on "Grade 1" (which then has zero children and is itself
the leaf); one with a four-level tree places them on the actual bottom node,
whatever depth that is.

**Where it is enforced (defense in depth, matching the existing isActive
precedent):**

| Call site | What changed |
| :-- | :-- |
| `EnrollmentService.writeInitialEnrollment` | New `assertPlacementTarget` guard: rejects a soft-deleted unit (`ACADEMIC_UNIT_NOT_FOUND`), an inactive unit (`ACADEMIC_UNIT_INACTIVE`), or a unit with active children (`ACADEMIC_UNIT_NOT_PLACEMENT_TARGET`) |
| `EnrollmentService.supersedeEnrollment` | Same guard, applied to the *resolved* `academicUnitId` of the replacement (whether the caller changed it or it was carried over) — closes the correction/transfer paths, which had no such check at all before this change |
| `AdmissionConversionService.resolvePlacement` | Same three-way check added alongside the pre-existing branch/year/programme/isActive checks, for the same reason `isActive` is checked there: a friendly `400` before a transaction opens, rather than only inside `EnrollmentService` |

`isActive` was already checked in `resolvePlacement` but — as the blueprint's
own carried-forward note said — **not** in `EnrollmentService` itself, "only
reachable by the future importer." Since `correctPlacement`/`transferPlacement`
are reachable today and had no `isActive` check either, this refinement closes
that gap at the same time as the leaf check, rather than leaving it
half-fixed.

**Verified safe against every existing fixture.** Every `AcademicUnit` created
by the integration/e2e fixtures and the realistic seed that is ever used as an
Enrollment or Admission placement target is already a leaf (the seed's
"Grade 1"/"Grade 2" parents are used only as parents, never as a placement).
The full unit and integration suite (1227 tests, real Postgres) passes
unchanged.

## 5. Full placement path — §7

### 5.1 What Enrollment continues to store

`Enrollment.academicUnitId` remains the sole authoritative FK — unchanged, not
redesigned. `EnrollmentDto` is unchanged: it still exposes only
`academicUnitId`, following the same rule that keeps it free of demographics
("a client that needs a name asks Student for it"). Duplicating a
computed path into Enrollment would make it stale the moment a unit is
renamed or re-parented, which is exactly the failure mode INV-ENR-012 already
rules out for names.

### 5.2 What AcademicUnit's read side now returns

The gap was on the read side of `AcademicUnit`, not `Enrollment`: before this
change, `GET /academic-units/:id` returned one level of `parent`, and
`GET /academic-units` / `GET /academic-units/tree` returned bare units with no
way to tell a leaf from a structural node without walking the tree
client-side. A client resolving `enrollment.academicUnitId` (or building an
admission-conversion placement picker, §9) had to guess.

Added, computed at read time from the current hierarchy and **never
persisted** — a rename or a re-parent is reflected on the next read with
nothing to backfill:

| Field | On | Meaning |
| :-- | :-- | :-- |
| `displayPath: string` | every `AcademicUnitDto`-derived read response (`GET /academic-units`, `/tree`, `/:id`) | `"Grade 1 → Division A"` — root to self, joined |
| `isPlacementTarget: boolean` | same | the §4.2 rule, exposed so a client never has to re-derive it |
| `ancestors: AcademicUnitAncestorDto[]` | `GET /academic-units/:id` only | root-first chain, excluding self — the structured form the brief's §7 sketch asked for |

`getAllAcademicUnits`/`getAcademicTree` compute this in memory from the
already-fetched, branch-and-year-scoped flat list (every ancestor of a
returned unit is guaranteed to be in the same result set, since a unit's
`parentId` chain never crosses branch or year — enforced at create/move) — no
per-unit round trip. `getAcademicUnitById` walks the ancestor chain once,
since a single detail lookup does not have the sibling list already loaded.

This closes §7, §9: a client resolving an Enrollment's placement, or building
an admission-conversion picker, now gets the disambiguated path and the
leaf/structural distinction directly from `AcademicUnit`'s own read API,
without guessing and without a derived field living on `Enrollment`.

## 6. Enrollment mapping — §8, unchanged

`Student + Program + AcademicYear + AcademicUnit placement = Enrollment`
was already the implemented shape (§19.3–§19.4 of the lifecycle spec), and
`admit()`'s contract already matched §8–§9 exactly: the caller supplies only
`academicUnitId`; organization, branch, academic year, programme, quota and
admission source all come from the applicant's own lineage; `programId` is
explicitly not an input. `resolvePlacement` already rejected a wrong branch,
wrong year, wrong programme and an inactive unit before this change — §4.2
above adds the missing placement-target check to the same function.

## 7. Capacity — remains `DEFERRED`

**Not implemented in this change.** The ownership and concurrency analysis
already on file (`core-admission-lifecycle-specification.md` §22) was
reviewed against the current code and found to still be current and correct
— nothing has changed that would move it forward:

- **No capacity column exists anywhere** (`AcademicUnit` or otherwise) —
  re-verified by search.
- **Ownership, if built:** `AcademicUnit.maxCapacity`/`minCapacity` (nullable
  columns — a fact about the specific placement unit, not the Program or
  AcademicYear), with a separate seat-matrix module deferred until quota-wise
  allocation is actually required.
- **Concurrency, if built:** lock the `AcademicUnit` row (`FOR UPDATE`)
  *before* counting live `PRIMARY` enrolments, inside `admit()`'s existing
  transaction, second in lock order after the `Applicant` — a plain
  count-then-insert is provably race-prone under `READ COMMITTED` and is
  explicitly rejected as an option.
- **Why still deferred:** this is a `REQUIRES BUSINESS DECISION` item
  (blueprint §50 Q3) — whether capacity enforcement is wanted at all, and at
  what default (`OFF`/`WARN`/`BLOCK`), is a product decision no code change
  can make. Building the column without that decision would invent a
  constraint nobody agreed to, which the existing analysis already correctly
  refuses to do (§22.1: "a fake check is worse than a stated absence").

No schema change, no service change. Capacity stays exactly as documented.

## 8. Roll number — confirmed, unchanged

Verified against `EnrollmentService.assignRollNumber`,
`enrollment_rollno_unique`, and `EnrollmentConfigProvider.rollNumberPolicy`:

- **Owned by Enrollment**, not Student, not a numbering-engine sequence — it
  is the one mutable field on an otherwise-immutable placement row, and it is
  never a foreign key.
- **Scope:** `(academicUnitId, academicYearId, rollNumber)`, partial-unique,
  excluding `SUPERSEDED`/`CANCELLED` — "Grade 1 → Division A → Roll 1" and
  "Grade 1 → Division B → Roll 1" are both valid, verified by
  `enrollment.integration-spec.ts`'s "allows the same roll number in a
  different class".
- **Default policy: `MANUAL`.** `SEQUENTIAL_ON_ADMISSION` and
  `ALPHABETICAL_ON_LOCK` are named in `RollNumberPolicy` but unbuilt — correct
  per the brief's instruction not to implement bulk renumbering for
  completeness; `SEQUENTIAL_ON_ADMISSION` in particular needs its own
  concurrency design before it ships, which is out of scope here.
- **Lifecycle:** editable until the class list locks; not editable on a
  closed placement (`ENROLLMENT_CLOSED`); a correction/transfer carries the
  roll number forward unless the caller explicitly overrides it; withdrawal
  and cancellation leave the number on the closed row rather than freeing it
  for reuse within the same register (nothing re-numbers on cancel).

No change made or needed.

## 9. Class-list lock — confirmed, unchanged

`EnrollmentConfigProvider.classListLocked()` derives from
`AcademicYear.isLocked` and nothing else — no second lock column exists. This
is coarser than the eventual per-class-list rule and never weaker, and remains
correctly `DEFERRED` to F2 (the Configuration Engine). No change made.

## 10. AcademicUnit capability matrix — §18

| `unitType` | Can be parent? | Can have children? | Can be enrollment target? | Can carry roll numbers? | Structural only? |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `SECTION` | yes | yes | **only if it has no active children** | only if a target | only if it has children |
| `CLASS` | yes | yes | **only if it has no active children** | only if a target | only if it has children |
| `DIVISION` | yes | yes | **only if it has no active children** | only if a target | only if it has children |
| `STREAM` | yes | yes | **only if it has no active children** | only if a target | only if it has children |
| `DEPARTMENT` | yes | yes | **only if it has no active children** | only if a target | only if it has children |
| `YEAR` | yes | yes | **only if it has no active children** | only if a target | only if it has children |
| `SEMESTER` | yes | yes | **only if it has no active children** | only if a target | only if it has children |
| `BATCH` | yes | yes | **only if it has no active children** | only if a target | only if it has children |
| `CUSTOM` | yes | yes | **only if it has no active children** | only if a target | only if it has children |

Every row is identical. `unitType` is confirmed to be **purely a
classification/UI label** — an institution's own vocabulary for what it calls
a level of its hierarchy — and carries **no structural or placement
authority**. Capacity (§7) and roll numbers (§8) both attach to the placement
target regardless of what it is called. This table will only diverge by row
if a future decision deliberately restricts a specific `unitType` (e.g.
forbidding `DEPARTMENT` from ever being a leaf) — nothing in this refinement
does that, since no such rule was asked for or evidenced.

## 11. API / database changes made

**Database:** none. No migration in this change.

**Service:**

- `EnrollmentService`: new private `assertPlacementTarget`, called from
  `writeInitialEnrollment` and `supersedeEnrollment`.
- `AdmissionConversionService.resolvePlacement`: added the same leaf check
  alongside the pre-existing branch/year/programme/`isActive` checks.
- `AcademicUnitService`: `getAllAcademicUnits`, `getAcademicTree`,
  `getAcademicUnitById` now return `displayPath`/`isPlacementTarget`
  (and `getAcademicUnitById` also `ancestors`), computed at read time.

**API surface (additive, non-breaking):**

- New error codes: `ACADEMIC_UNIT_NOT_PLACEMENT_TARGET` (400),
  `ACADEMIC_UNIT_NOT_FOUND` (400, from `EnrollmentService`'s write path —
  distinct from the existing 404 `getAcademicUnitById` raises on a direct
  read), `ACADEMIC_UNIT_INACTIVE` (400, now also raised from
  `EnrollmentService`, not only `AdmissionConversionService`).
- New response fields `displayPath`, `isPlacementTarget`, `ancestors` on the
  `AcademicUnit` read endpoints. No existing field removed, renamed or
  retyped; `EnrollmentDto` is unchanged.

No route was added, removed or renamed. No existing client's request shape
changed.

## 12. Database invariants — audit result

Every correctness-critical invariant the brief asks about was already
database-enforced (§21) *except* placement-target eligibility, which cannot
be — it depends on mutable state (whether children currently exist) that a
static `CHECK` or FK cannot express without a trigger, which this refinement
deliberately does not introduce (matches §25 — prefer strict core semantics
over a speculative extra mechanism). It is instead enforced at the one
Enrollment write chokepoint (`EnrollmentService`) plus the `admit()`
pre-transaction guard, matching exactly how `isActive` was already handled.
Documented as the accepted trade-off rather than silently assumed.

| Invariant | Mechanism |
| :-- | :-- |
| AcademicUnit identity, hierarchy, Program/year ownership | Composite unique indexes, FKs — unchanged |
| Enrollment placement matches branch/programme/year | Composite FK (INV-ENR-010) — unchanged |
| One active PRIMARY enrolment per admission/year | Partial unique index — unchanged |
| Roll-number uniqueness | Partial unique index, scoped per unit+year — unchanged |
| **Placement target is a leaf** | **New — service-level, both write paths** (cannot be a static constraint; see above) |
| Capacity safety | N/A — capacity itself remains unimplemented (§7) |

## 13. Testing

Ran before changing anything, and again after: full unit suite (878 tests)
and full integration suite against real Postgres (1227 tests total across
unit+integration configs) — all green both times.

**New tests added**, covering the invariant-test matrix items this refinement
actually changes (items 3–6, 8 of the brief's list; the rest were already
covered by the existing Phase 4 suite and re-verified unchanged):

| Area | File | Cases added |
| :-- | :-- | :-- |
| Placement-target enforcement, initial write | `test/unit/enrollment.service.spec.ts` | refuses a unit with active children; refuses an inactive unit; refuses a unit that does not exist |
| Placement-target enforcement, correction/transfer | `test/unit/enrollment.service.spec.ts` | refuses moving a placement onto a unit with active children |
| Placement-target enforcement, `admit()` | `test/unit/admission-conversion.service.spec.ts` | refuses a unit that has child units |
| Path resolution, flat list | `test/unit/academic-unit.service.spec.ts` | builds the full path and marks only leaves as placement targets; a unit with no children is a placement target |
| Path resolution, detail | `test/unit/academic-unit.service.spec.ts` | returns the root-first ancestor chain and joined display path; no ancestors/no prefix at the root |

Not added, deliberately: a real-Postgres integration test for the leaf check.
The rule is enforced in application code (§12 explains why it cannot be a
database constraint), so a unit test against the service is the correct level
— the existing integration suite already proves every fixture unit used as a
placement target is a leaf, which is the regression this would otherwise
guard.

## 14. Regression

Verified unchanged: Person identity/crypto, Applicant workflow, Guardian/
Guardianship, Address, Documents, Student identity, Student Code generation,
Admission numbering, the `admit()` transaction shape. No route removed. No
existing DTO field removed or retyped. Every pre-existing test (unit +
integration, 1227 total) passes without modification to its assertions —
only two test *fixtures* needed updating, both because they mocked
`AcademicUnit` shallower than the real Prisma shape now requires
(`children: []` in a `softDeleteAcademicUnit` mock; an `academicUnit` mock
model added where a service under test now queries it) — not because any
existing behavior changed.

## 15. Deferred / carried forward

- **Capacity** — `REQUIRES BUSINESS DECISION` (blueprint §50 Q3), analysis
  unchanged and current (§7 above).
- **Class-list lock** — `DEFERRED` to F2, unchanged (§9 above).
- **`SEQUENTIAL_ON_ADMISSION`/`ALPHABETICAL_ON_LOCK` roll-number policies** —
  unbuilt, unchanged; the former needs its own concurrency design.
- **A unit sprouting a child after enrolments already exist on it** — not
  guarded. A unit that was a valid placement target at write time can later
  gain a child (e.g. an institution decides mid-year to split a class into
  divisions), leaving existing Enrollments pointing at a now-non-leaf unit.
  This is a pre-existing possibility the brief did not ask to be closed and
  this refinement does not add a guard for (it would require blocking
  `createAcademicUnit`/`moveAcademicUnit` whenever the new parent already has
  live enrolments — a real design question about whether that split should be
  *allowed* at all, not a validation gap). Flagged here as `PROPOSED` for
  whoever designs the promotion/repeat and mid-year restructuring operations.
- **Guardian boundary** — out of scope for this refinement, tracked
  separately in the lifecycle spec's §8/§46/§47.

## 16. Final decision

The Program → AcademicYear → AcademicUnit → Enrollment → Student model, and
the semantic split between Program (stable offering) and AcademicUnit
(year-specific structure), were already correctly designed and implemented.
The one genuine gap — nothing enforced that an Enrollment's `academicUnitId`
is a leaf of the hierarchy, despite the response DTO documenting that
intent — is now closed at the single write chokepoint (`EnrollmentService`)
and the `admit()` pre-flight check, using the hierarchy that already exists
rather than a new field or table. The read side of `AcademicUnit` now exposes
the disambiguated path and the leaf/structural distinction directly, closing
the "Division A" vs "Grade 1 → Division A" ambiguity without duplicating
anything onto `Enrollment`. Capacity, roll number and the class-list lock
were audited and found to already match the brief's own reasoning; none
needed a code change.
