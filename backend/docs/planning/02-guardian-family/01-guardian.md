# S1 — Guardian & Family

> **Status:** `planned` — §10 has two open questions
> **Depends on:** F1, I1 (Person), RelationType master
> **Depended on by:** parent portal, communication, fee dunning, attendance notifications, transport

**Delta document.** `Guardian` and `ApplicantGuardianMapping` exist
(`schema.prisma:296–365`, `src/modules/admissions/guardians/`).

---

## 1. Purpose

S1 owns the **relationship between a guardian and a child**, and the
institution-specific permissions attached to it — who is primary, who pays, who
may collect the child, who is called in an emergency.

It does **not** own the guardian *as a human* — that is Person (I1). Every
attribute that answers "is this the same person?" lives there.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **Guardianship links two Persons, not a Guardian to an Applicant** | The decisive change. A guardianship survives the applicant→student transition with **zero re-mapping**, because both ends are Persons and Person does not change at admission. |
| D2 | **Guardian becomes organization-scoped** (it is branch-scoped today) | §7 Q11: one parent login shows every child, and siblings frequently sit in different branches. A branch-scoped guardian makes that impossible. |
| D3 | **Guardian drops `aadhaarNo`; gains `personId`** | F1 D10 — one plaintext copy defeats encryption as thoroughly as three. |
| D4 | **Exactly one primary and exactly one financial guardian per ward** — enforced by partial unique index | See §2.1. This is currently attempted in service code for one flag and **not attempted at all** for the other. |
| D5 | **Siblings are derived, never stored** | Two wards sharing a guardian are siblings. An explicit sibling edge is a second source of truth that drifts the moment a guardianship changes. |
| D6 | **No `Household` entity** | §7 Q12. It adds a mandatory join to every address and contact read and pays off only for the minority of genuinely shared cases. Shared addresses are handled in S2 instead. |
| D7 | **Guardian merge is Person merge** | I1 §6.4 already does the work. There is no separate guardian-merge path. |
| D8 | **Emergency contacts are ordered and multiple; primary and financial are singular** | An escalation list is the point of emergency contacts. Exactly one person pays the bill. |

### 2.1 Two defects in the current implementation

**Defect 1 — the primary-guardian toggle is not transactional.**
`guardians.service.ts:111–144` runs `updateMany` (clearing every `isPrimary`)
and then `upsert`. These are separate statements with no transaction. If the
upsert fails, **the child is left with no primary guardian at all** — every
previous flag has already been cleared. Flagged in
[`../../admissions/admissions-production-audit.md`](../../admissions/admissions-production-audit.md) §4.

**Defect 2 — `isFinancialGuardian` has no exclusivity logic whatsoever.**
Not documented anywhere. `isPrimary` at least *attempts* the clear-then-set
dance; `isFinancialGuardian` is written straight through at
`guardians.service.ts:132` and `:140`. **A ward can have three financial
guardians**, and the fee module will have to pick one arbitrarily — or send
three invoices.

Both disappear under D4: a partial unique index makes the invalid state
unrepresentable, and the service stops needing to be careful.

---

## 3. Data model

### 3.1 `Guardian` — changes

| Change | Field | Detail |
| :--- | :--- | :--- |
| **add** | `personId` | `String` — FK to Person, required |
| **change** | `branchId` | Removed; organization-scoped now (D2) |
| **remove** | `aadhaarNo` | Moves to `PersonSensitive` (D3) |
| **remove** | address columns | `addressLine1`, `addressLine2`, `city`, `state`, `country`, `pincode` move to S2 |

What remains is contact and professional detail: names, `mobilePrimary`,
`mobileSecondary`, `email`, `occupation`, `income`.

> `Guardian` is now thin enough to ask whether it should exist at all rather
> than being fields on Person. It survives because occupation, income and
> employer are guardian-role facts that a Person who is only a student never
> has — and Person must stay a matching index (I1 §1).

### 3.2 `Guardianship` — replaces `ApplicantGuardianMapping`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `organizationId` | `String` | |
| `guardianPersonId` | `String` | The adult |
| `wardPersonId` | `String` | The child |
| `relationTypeId` | `String` | Existing master |
| `isPrimary` | `Boolean` | At most one per ward (D4) |
| `isFinancialGuardian` | `Boolean` | At most one per ward (D4) |
| `isEmergencyContact` | `Boolean` | Many permitted |
| `emergencyPriority` | `Int?` | Escalation order |
| `pickupAllowed` | `Boolean` | |
| `pickupValidFrom` / `pickupValidTo` | `DateTime?` | A temporary arrangement — an uncle collecting for one term |
| `isLegalGuardian` | `Boolean` | Custody, legally distinct from biology |
| `startedAt` / `endedAt` | `DateTime` / `DateTime?` | Guardianships end — custody changes, a guardian dies |
| `createdBy`, `createdAt`, `updatedAt` | | |

**Person-to-Person (D1).** At admission, `admit()` does nothing about guardians
— the relationships already point at the ward's Person and remain valid.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One guardianship per pair | `@@unique([guardianPersonId, wardPersonId])` |
| 2 | **At most one primary per ward** | `CREATE UNIQUE INDEX guardianship_one_primary ON "Guardianship" ("wardPersonId") WHERE "isPrimary" AND "endedAt" IS NULL` |
| 3 | **At most one financial guardian per ward** | `CREATE UNIQUE INDEX guardianship_one_financial ON "Guardianship" ("wardPersonId") WHERE "isFinancialGuardian" AND "endedAt" IS NULL` |
| 4 | Nobody is their own guardian | `CHECK ("guardianPersonId" <> "wardPersonId")` |
| 5 | Pickup window is ordered | `CHECK ("pickupValidTo" IS NULL OR "pickupValidFrom" < "pickupValidTo")` |
| 6 | A ward with an active enrollment has a primary guardian | Application-level; cannot be a constraint, since the guardianship is created before the enrollment |

Invariants 2 and 3 are the fix for §2.1. Setting a new primary becomes
"end the old row, insert the new" **in one transaction** — and if that
transaction fails, the database still holds exactly one primary, because it
never permitted zero-or-two in the first place.

---

## 5. Provenance

Guardianships are **ended, never deleted** — `endedAt` with a reason. A custody
change is a fact worth keeping: a school needs to show why a parent stopped
being an authorised contact on a given date.

Flag changes are ordinary audited updates, except primary and financial
transfers, which end one row and start another so the handover has a date.

### The correction test

Father was primary; mother becomes primary in March:

```
Guardianship  father → child   isPrimary: false   endedAt: null
                               (flag cleared, row still active — he is
                                still a guardian, just not the primary)

Guardianship  mother → child   isPrimary: true    startedAt: 2027-03-04
```

Both rows persist. The audit trail shows the exact date the primary contact
changed, which is what matters when someone asks who should have been called.

---

## 6. Lifecycle

```
[created] ──> [active] ──┬──> [ended]        (custody change, death, withdrawal)
                         └──> flags change   (primary/financial handover)
```

No status column — `endedAt` carries it. A guardianship is never hard-deleted
(D5 depends on it: an ended guardianship still explains a historical sibling
relationship).

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/guardians` | Create a guardian (resolves a Person) | `STAFF`+ |
| `GET` | `/v1/guardians/search` | By mobile, name, or hashed government id | `STAFF`+ |
| `GET` | `/v1/guardians/:id` | Guardian with all wards | `STAFF`+ |
| `POST` | `/v1/guardianships` | Link guardian to ward | `STAFF`+ |
| `PATCH` | `/v1/guardianships/:id` | Change flags | `STAFF`+ |
| `POST` | `/v1/guardianships/:id/end` | End with a reason | `BRANCH_ADMIN`+ |
| `GET` | `/v1/persons/:id/siblings` | **Derived** from shared guardianships (D5) | `STAFF`+ |

### The nested-write recommendation, adopted

`admissions-production-audit.md` §9 recommends accepting guardians nested inside
the applicant payload rather than requiring three round-trips (create guardian,
search, map). That is adopted: `POST /v1/admissions/applicants` accepts a
`guardians[]` array, resolves or creates each Person and Guardian, and
establishes guardianships — **in one transaction**.

The current three-call flow is what makes the untransacted toggle in §2.1
reachable from the client.

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Second primary guardian | `409` | `ConflictException` |
| Second financial guardian | `409` | `ConflictException` |
| Guardian is the ward | `400` | `BadRequestException` |
| Duplicate guardianship | `409` | `ConflictException` |

---

## 8. Events

Existing: `guardian.created`, `guardian.updated`, `guardian.mapped`,
`guardian.unmapped`.

| New / changed | When |
| :--- | :--- |
| `guardianship.created` | Replaces `guardian.mapped` |
| `guardianship.ended` | Replaces `guardian.unmapped`; carries the reason |
| `guardianship.primary_changed` | Primary handover — **communication must resubscribe** |
| `guardianship.financial_changed` | Financial handover — **finance must redirect invoices** |

The last two exist because a silent primary change is how a school ends up
calling the wrong parent in an emergency.

---

## 9. Dependencies

**Requires:** F1, I1, RelationType master.

**Depended on by:** parent portal (§14 Q11 — one login, all children), fee
dunning (financial guardian), attendance and emergency notification, transport,
pickup authorisation.

### Migration

1. Resolve a Person for every existing `Guardian`, hashing `aadhaarNo` into
   `Person.govtIdHash` and encrypting it into `PersonSensitive` (F1)
2. Move guardian addresses to S2
3. **Convert `ApplicantGuardianMapping` → `Guardianship`**, translating
   `applicantId` to that applicant's `wardPersonId`
4. Drop `Guardian.aadhaarNo`, `Guardian.branchId`, and the address columns
5. Reconcile pre-existing violations of invariants 2 and 3 **before** creating
   the indexes — index creation will fail on any ward that already has two
   financial guardians, which defect 2 makes possible

Step 5 is the one that will surprise: the data may already be invalid, because
nothing has been stopping it.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **Should a ward be *required* to have a primary guardian?** | Invariant 6 | For a minor, obviously yes. For an adult learner (§1 Q14 distance education, §1 Q3 coaching) there may be no guardian at all. Options: (a) required below a configurable age, optional above; (b) always optional, with a warning; (c) required per program type. **Recommendation: (a)** using F2 configuration, since the age threshold differs by institution. |
| **Q2** | **Can one Person be guardian to a ward across two organizations?** | Guardianship scoping | Person is organization-scoped (I1 D1), so the same human in two tenants is two Persons and therefore two unrelated guardianships. That is correct for isolation but means a parent with children at two CampusFlow customers has two logins. **Recommendation: accept it** — §4 Q6's tenant isolation is worth more than the convenience, and cross-tenant identity would require the global registry §4 Q6 forbids. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Applicant with two guardians is admitted | Guardianships **unchanged** — no re-mapping, because both ends are Persons (D1) |
| 2 | Second child admitted, same father | Father's Person reused; new guardianship; **both children appear under one login** |
| 3 | Siblings in different branches | Both visible to the same guardian (D2) |
| 4 | Set a second primary guardian | `409` (invariant 2) |
| 5 | **Set a second financial guardian** | `409` (invariant 3) — **fails against today's code**, which permits it silently |
| 6 | Primary handover fails mid-operation | Original primary **still primary**. Guards defect 1, which currently leaves the ward with none. |
| 7 | Uncle granted pickup for one term | `pickupValidFrom`/`To` set; outside the window pickup is refused |
| 8 | Custody change ends a guardianship | `endedAt` set with reason; row retained; sibling derivation still explains the historical link |
| 9 | Query siblings | Derived from shared guardianships — **no sibling table** (D5) |
| 10 | Guardian merged via Person merge | Both wards move to the survivor; no duplicate guardianship (I1 §6.4) |
| 11 | **Raw SQL**: two active primaries for one ward | Rejected (invariant 2) |
| 12 | **Raw SQL**: guardian equals ward | Rejected (invariant 4) |

Scenarios 5 and 6 are regression tests for defects that exist today. 11 and 12
must run as raw SQL.
