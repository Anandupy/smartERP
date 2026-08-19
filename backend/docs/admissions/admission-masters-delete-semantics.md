# CampusFlow ERP – Admission Masters Delete Semantics
**Document ID:** `admission-masters-delete-semantics.md`
**Scope:** How `DELETE /v1/admissions/masters/**` decides `MASTER_IN_USE` vs. a
successful soft-delete, for all ten reference-data types served by
`BaseMasterService` (Religion, Caste, Category, Gender, Blood Group,
Language, Disability, Relation Type, Quota, Admission Source).

---

## 1. Lifecycle states

A master row has three, not two:

| State | Meaning | Set by |
|---|---|---|
| **ACTIVE** | `isActive: true`, `deletedAt: null` | default |
| **INACTIVE** | `isActive: false`, `deletedAt: null` | `PATCH .../:id` with `{ isActive: false }` |
| **DELETED** | `deletedAt` set | `DELETE .../:id`, only when unreferenced |

Deactivation and deletion are different operations with different
consequences. Deactivating hides a row from `findAll()` unless
`includeInactive=true` is passed, but the row (and every reference to it)
stays intact — this is the safe default for "we don't offer this option
anymore, but historical records that used it must keep resolving it."
Deletion soft-deletes the row (`deletedAt` set), permanently removing it from
every list — this is only offered when nothing depends on the row.

## 2. What `remove()` checks

`BaseMasterService.remove(id, scope)`:

1. Confirms the caller's branch owns the row (404, not 403, on a miss —
   preserved from the R3 tenant-isolation hardening).
2. If the master type declares `referenceRelations`, re-reads the row with
   each relation selected (`take: 1`) and blocks with `409 MASTER_IN_USE` if
   any relation returns a row.
3. Otherwise, sets `deletedAt` and publishes `AdmissionsMasterDeletedEvent`.

Deletion is **soft** — the row is never removed from Postgres, only
timestamped. Because of that, the database's foreign keys are never actually
exercised by this path (`UPDATE ... SET "deletedAt" = now()` doesn't touch
referential integrity at all). `MASTER_IN_USE` is a **business rule**, not a
database-enforced one: without it, a master could be soft-deleted out from
under active dependents, silently vanishing from every picker and list while
their foreign key still points at it.

## 3. The reference matrix

| Master | Referenced by | Relation field(s) | Excludes soft-deleted far side? |
|---|---|---|---|
| Religion | Applicant, Student | `applicants`, `students` | Yes (both have `deletedAt`) |
| Caste | Applicant, Student | `applicants`, `students` | Yes |
| Category | Applicant, Student | `applicants`, `students` | Yes |
| Gender | Applicant, Student | `applicants`, `students` | Yes |
| Blood Group | Applicant, Student | `applicants`, `students` | Yes |
| Language | Applicant, Student | `applicants`, `students` | Yes |
| Disability | Applicant, Student | `applicants`, `students` | Yes |
| Relation Type | ApplicantGuardianMapping, Guardianship | `mappings`, `guardianships` | No — neither model has its own `deletedAt` |
| Quota | Applicant, Admission | `applicants`, `admissions` | Yes |
| Admission Source | Applicant, Admission | `applicants`, `admissions` | Yes |

Each relation is declared on the master's `XxxService` constructor as a
`MasterReferenceRelation` (`src/modules/admissions/masters/base-master.service.ts`):

```ts
export interface MasterReferenceRelation {
  relation: string;
  filterSoftDeleted: boolean;
}
```

`filterSoftDeleted: true` tells `remove()` to add `where: { deletedAt: null }`
to that relation's nested `select`, so a soft-deleted row on the far side is
excluded from the "in use" check. It is only ever `true` for a relation whose
target model actually carries a `deletedAt` column — passing that filter to a
model without one is a Prisma validation error, not a silent no-op, so the
per-relation flag is deliberately explicit rather than inferred.

Category and Quota also carry a `documentRequirements` relation
(`DocumentRequirement.categoryId` / `.quotaId`) that `remove()` does **not**
check. That is a pre-existing gap, out of scope for this fix (see §6) — it is
not part of what "referenced by existing applicant, student or admission
records" (the current `MASTER_IN_USE` message) claims to protect, and
changing it would touch the Document Requirement module, not the deletion
defect this document describes.

### Why `Guardianship` needed adding

`Guardianship` (Person↔Person, append-only, never hard-deleted — it is the
permanent record of a sibling relationship or an authorised pickup contact,
even after `endedAt` is set) carries its own `relationTypeId` FK, declared on
the same `RelationType` Prisma model as `ApplicantGuardianMapping.relationTypeId`.
Before this fix, `RelationTypeService` only checked `mappings`. A
`RelationType` referenced solely by a `Guardianship` — no
`ApplicantGuardianMapping` left, e.g. after `removeMapping()` cleared the
working-application-scoped mapping but the permanent Person-level
relationship survives — was incorrectly deletable. It is now checked
alongside `mappings`, and (per the append-only design) blocks regardless of
whether the `Guardianship` row is still active or has an `endedAt`: an ended
guardianship is still a permanent historical fact that names this relation
type, not evidence the reference no longer exists.

## 4. Why soft-deleted references stop blocking

`Applicant.remove()` (`src/modules/admissions/applicant/applicant.service.ts`)
sets `deletedAt` on non-frozen-status applicants — in practice, an
administrator deleting a duplicate or erroneous **DRAFT**. Before this fix,
`remove()`'s usage query had no `where` at all on the nested relation select,
so it selected *any* row on the far side, deleted or not. A single deleted
DRAFT applicant that once referenced a Gender/Religion/... row would keep
that master permanently un-deletable — `MASTER_IN_USE` forever, with no path
to actually remove it, even though the applicant it names no longer exists
anywhere the product surfaces.

`Student` and `Admission` both carry `deletedAt` in schema for consistency,
but neither has a code path that sets it today (`Student`'s own doc comment:
*"leaving is a lifecycle status; deletion is not a lifecycle operation"*) —
so the same `filterSoftDeleted: true` treatment is applied to their relations
for correctness and forward-compatibility, even though it currently changes
no observed behaviour for those two.

## 5. Concurrency

The pre-check and the soft-delete write are not atomic with respect to a
concurrent reference being created — a new Applicant could, in principle, be
created against a master between the usage check and the `deletedAt` write.
This is pre-existing and out of scope for this fix: because deletion here is
a soft `UPDATE`, not a hard `DELETE FROM`, there is no foreign-key violation
for Postgres to raise as a backstop the way there would be for a real row
removal, and closing the race would require either a serializable
transaction around both steps or a trigger-level check — a larger change than
"correct the reference check" calls for. It is noted here, not fixed, so it
is not mistaken for a side effect of this change.

## 6. What this fix did not touch

- `DocumentRequirement` references on `Category`/`Quota` (§3) — a distinct
  gap, not the reported symptom.
- The master architecture, endpoints, or the `PATCH .../:id` deactivate path
  — both were already correct and are the intended workaround the
  `MASTER_IN_USE` message points to.
- `applicant.service.ts`'s `assertMasterReferencesExist()`, which validates a
  master id exists but not that it belongs to the caller's organization —
  a separate, pre-existing scope gap in applicant *creation*, unrelated to
  master *deletion*.
- R3's tenant-scoped `findOne`/`update`/`remove`, 404-not-403 behaviour, and
  duplicate-code/name conflicts — all re-verified by the existing
  `base-master.service.spec.ts` suite, extended rather than replaced.

## 7. Tests

- `test/unit/base-master.service.spec.ts` — mocked-Prisma coverage of the
  exact `select` shape `remove()` now builds per relation, plus the
  soft-deleted-only and `filterSoftDeleted: false` regression cases.
- `test/integration/admission-masters-delete.integration-spec.ts` — real
  Postgres (`erp_test`), real `GenderService`/`DisabilityService`/
  `RelationTypeService`/`ApplicantService` instances: unused-deletes,
  in-use-blocks, soft-deleted-applicant-unblocks, cross-organization
  isolation, and the `Guardianship`-only `RelationType` case.
