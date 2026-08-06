# I1 — Person

> **Status:** `planned` — §10 has two open questions
> **Depends on:** F1 (data protection), Organization
> **Depended on by:** Applicant (I2), Student (I4), Guardian (S1), Employee (S4)

---

## 1. Purpose

Person answers exactly one question: **"is this the same human?"** It is a
deduplication index with no lifecycle, no status, and no behaviour of its own.

It does **not** own names for display, addresses, photographs, contact details,
or any attribute a user edits. Those belong to `Applicant` (a frozen legal
snapshot of what was declared), `Student` (current official truth), and
`Guardian` (current truth) — three records that legitimately diverge from each
other over time.

> **The sprawl rule.** The moment Person exists there will be pressure to move
> "just the name" onto it, then the photo, then the address. Every one of those
> changes independently per role. **Person holds only matching keys.** A pull
> request adding a display or contact attribute here is rejected on sight.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **Person is organization-scoped** | §4 Q6 forbids a global applicant registry. A Person never spans tenants. |
| D2 | **No direct create API.** Person is only ever created as a side effect of creating an Applicant, Guardian, Employee or migrated Student | Person has no independent meaning. A standalone create endpoint would let staff manufacture identity rows with nothing attached, which is pure noise. |
| D3 | **Person is never deleted** — no soft delete, no hard delete | Historical records point at it. DPDP erasure nulls the *sensitive* data (F1 D10) and leaves the Person row standing. |
| D4 | **Two distinct operations: `resolve()` and `findCandidates()`** | Deterministic identity (same Aadhaar = same human) and fuzzy suggestion (might be the same human) are different problems with different failure costs. Conflating them is why duplicate detection in most ERPs is either useless or infuriating. |
| D5 | **`resolve()` never blocks. It reuses.** | A matching `govtIdHash` is not a "duplicate warning" — it is the same person. Return the existing row. |
| D6 | **`findCandidates()` warns, never blocks** | §4 Q14. Twins share address, phone, DOB and parents. Blocking on that rejects valid applicants. |
| D7 | **A reviewed non-match is recorded, so the warning does not recur** | Without this, staff see the same twin warning at every step of every year and learn to dismiss all warnings reflexively — which destroys the value of the ones that matter. |
| D8 | **Merge repoints foreign keys AND leaves a tombstone** | Repointing keeps queries simple; the tombstone means any stale or cached reference still resolves. Doing only one of the two leaves a sharp edge. |
| D9 | **Merge is irreversible** | §4 Q13. An undo path would need to reconstruct which references originally belonged to which side — that information is gone the moment they are repointed. |
| D10 | **Merge chains are collapsed, never followed** | Merging A→B when B is already merged into C writes A→C directly. Chains turn every identity lookup into a recursive walk and eventually a cycle bug. |
| D11 | **`dob` is required** | It is the only field that meaningfully discriminates between same-named people, and Indian admission is impossible without it. A nullable DOB would silently degrade every medium- and low-confidence match. |
| D12 | **One Person pool for students, guardians and staff** | A teacher whose child studies at the school is one human. An older sibling acting as guardian is one human. Separate pools make those cases unrepresentable. |

### Rejected alternatives

| Rejected | Why |
| :--- | :--- |
| A `personType` column (`STUDENT` / `GUARDIAN` / `STAFF`) | A person is frequently more than one at once. Role is expressed by which records reference the Person, not by a column on it. |
| Storing Aadhaar plaintext on Person for matching | F1 D4. The blind index gives exact-match search without holding the value. |
| Making Person global across organizations | Would let one tenant discover another's students by probing Aadhaar. Directly violates §4 Q6. |
| Deleting the losing row on merge | Every historical foreign key pointing at it would break, including audit rows that must never dangle. |
| Auto-merging on a high-confidence match | Merge is irreversible (D9). An automatic irreversible operation triggered by a heuristic is how you lose a student's twelve-year record. |

---

## 3. Data model

### 3.1 `Person`

| Field | Type | Null | Why here | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `String (UUID v7)` | no | | Primary key |
| `organizationId` | `String` | no | D1 — the matching scope | |
| `govtIdHash` | `String?` | yes | Blind index over Aadhaar (F1 §3.5) | Null until an Aadhaar is supplied |
| `phoneHash` | `String?` | yes | Blind index over the contact number | Last 10 digits, normalised |
| `dob` | `DateTime` | no | D11 — the primary discriminator | |
| `nameNormalized` | `String` | no | Low-confidence fuzzy matching | Never rendered to a user |
| `mergedIntoPersonId` | `String?` | yes | Tombstone target (D8) | Non-null ⇒ this row is retired |
| `createdAt` / `updatedAt` | `DateTime` | no | | |

**Placement test.** Every field above is either a matching key or merge
bookkeeping. Nothing varies with a role, a year, or a branch. If a proposed
field would have to be *different* for the same human depending on whether they
are being viewed as a student or as a guardian, it does not belong here.

> **Note there is no `deletedAt`.** D3. A Person whose sensitive data has been
> erased still exists, and still deduplicates.

### 3.2 `PersonMatchDecision`

Records that a human reviewed two candidates and judged them distinct (D7).

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `String (UUID v7)` | |
| `organizationId` | `String` | |
| `personAId` / `personBId` | `String` | Stored with `personAId < personBId` so the pair is order-independent |
| `decision` | `MatchDecision` | `DISTINCT` — reviewed and confirmed different people |
| `reason` | `String` | Mandatory. "Twins", "father and son, same name" |
| `decidedBy` | `String` | User id |
| `decidedAt` | `DateTime` | |

Only `DISTINCT` is recorded. The opposite conclusion is not a decision row — it
is a merge, which is §5.

### 3.3 `PersonMergeLog`

Append-only. Merge is irreversible (D9), so the evidence must be reconstructable.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `String (UUID v7)` | |
| `organizationId` | `String` | |
| `survivorPersonId` | `String` | The Person that remains active |
| `mergedPersonId` | `String` | The Person that becomes a tombstone |
| `reason` | `String` | Mandatory |
| `repointedRefs` | `Json` | `{"applicant": [...], "student": [...], "guardian": [...]}` — exactly what moved |
| `mergedBy` / `mergedAt` | `String` / `DateTime` | |

`repointedRefs` is what makes the operation auditable after the fact. Without
it, "which records used to belong to the other person?" is unanswerable.

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | One government id per organization | `@@unique([organizationId, govtIdHash])` — Postgres treats NULLs as distinct, so any number of people may have no Aadhaar |
| 2 | `dob` is plausible | `CHECK ("dob" > '1900-01-01' AND "dob" <= CURRENT_DATE)` |
| 3 | `nameNormalized` is never blank | `CHECK (length(trim("nameNormalized")) > 0)` |
| 4 | A tombstone never points at another tombstone | Enforced in `merge()` by resolving the target to its final survivor first (D10); asserted by scenario 5 |
| 5 | A Person never merges into itself | `CHECK ("mergedIntoPersonId" IS NULL OR "mergedIntoPersonId" <> "id")` |
| 6 | A match decision pair is stored once, in a canonical order | `@@unique([personAId, personBId])` plus `CHECK ("personAId" < "personBId")` |
| 7 | An active Person is never referenced by a tombstone's live records | After merge, zero rows in Applicant/Student/Guardian reference `mergedPersonId` |

Invariant 1 is the one that resolves the two-branch collision from
`docs/domain/01-04-review-of-frozen-decisions.md` (defect D4): a child approved
at Mumbai and at Pune resolves to the same Person, and the second `admit` then
fails on Student's own uniqueness rule rather than quietly creating a second
identity.

---

## 5. Provenance

`Person` rows are **created**, **merged**, and otherwise immutable except for
two controlled mutations:

| Mutation | When | Guard |
| :--- | :--- | :--- |
| `govtIdHash` null → set | An Aadhaar is supplied after the Person already exists | May trigger a merge (§6.3) |
| `phoneHash` change | Contact number updated | Free — phone is a weak signal |
| `mergedIntoPersonId` null → set | Merge | Irreversible |

`nameNormalized` and `dob` are **not** freely editable. A name or DOB correction
is a correction to the *Applicant* or *Student* record; Person's copy is
recomputed as a consequence, and if that recomputation would change a match
outcome the change requires the same privilege as a merge.

### The correction test

Staff realise two records are the same child and merge Person B into Person A:

```
Person A   (survivor)     mergedIntoPersonId: null
                          ← Applicant #1201, Student STU0000000412, Guardian link

Person B   (tombstone)    mergedIntoPersonId: A
                          ← no live references remain

PersonMergeLog            survivor: A   merged: B
                          reason:  "same child, applied twice with different spellings"
                          repointedRefs: { applicant: [#1188], guardian: [g-77] }
                          mergedBy: <user>   mergedAt: 2027-02-11
```

A stale link to Person B still resolves — it lands on the tombstone and follows
`mergedIntoPersonId` to A. Nothing dangles, and the log answers *what moved,
when, by whom, and why*.

---

## 6. Lifecycle

Person has no status field. Its only state change is retirement by merge.

```
[created via another module's write]
        │
        ├── govtIdHash attached later ──> may require merge (§6.3)
        │
        └── merged ──> [tombstone]   (terminal, irreversible)
```

### 6.1 `resolve(orgId, identifiers) → Person`

Deterministic find-or-create. Used by every module that creates a human.

1. If an Aadhaar is supplied, compute `govtIdHash`. On an exact match, **return
   that Person** (D5). Done — no warning, no prompt.
2. Otherwise create a new Person from `dob`, `nameNormalized`, `phoneHash`.
3. Independently, run `findCandidates()` and return its results **alongside** the
   Person as non-blocking warnings.

The caller always gets a usable Person. Warnings never interrupt the write.

### 6.2 `findCandidates(orgId, identifiers) → ScoredMatch[]`

| Confidence | Signal | Interpretation |
| :--- | :--- | :--- |
| **HIGH** | `govtIdHash` exact | The same human. Handled by `resolve()`, never surfaced as a warning. |
| **MEDIUM** | `phoneHash` + `dob` exact | Likely the same, or a sibling — households share numbers |
| **LOW** | `nameNormalized` + `dob` exact | Weak. Common names plus a shared birthday are not rare. |

Pairs already recorded `DISTINCT` in `PersonMatchDecision` are **excluded from
results** (D7).

> **The twins case, concretely.** Two children, same DOB, same parent's mobile,
> different names, no Aadhaar yet. The second application raises a MEDIUM
> warning. The clerk confirms they are twins; a `DISTINCT` decision is written;
> the warning never appears for that pair again. Both Persons persist. Nothing
> was blocked at any point.

### 6.3 `attachGovernmentId(personId, aadhaar)`

The late-binding case, and the one most likely to be got wrong.

A child is admitted without Aadhaar, so `govtIdHash` is null. Two years later
the Aadhaar arrives — and it turns out to belong to a Person already in the
system from an earlier application.

1. Compute the hash.
2. If no other Person holds it → set it. Done.
3. If another Person holds it → **this is a merge, not an update.** Setting the
   value would violate invariant 1 and surface as an opaque database error. The
   operation must return a conflict naming the other Person and requiring an
   explicit merge decision.

Step 3 is the reason `attachGovernmentId` is its own operation rather than a
field on a generic update endpoint.

### 6.4 `merge(survivorId, mergedId, reason)`

Privileged, irreversible, one transaction:

1. Resolve both to their final survivors (D10 — collapse, never chain)
2. Reject if they are the same Person
3. Repoint every Applicant, Student, Guardian and Employee reference
4. Set `mergedIntoPersonId` on the loser
5. If the loser held a `govtIdHash` and the survivor did not, carry it across
6. Write `PersonMergeLog` including `repointedRefs`
7. Publish `person.merged`

Step 5 matters: the whole reason for merging is usually that one record had the
Aadhaar and the other did not.

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/persons/match` | Fuzzy candidate search for the admission UI | `STAFF`+ |
| `GET` | `/v1/persons/:id` | Identity summary and linked roles | `STAFF`+ |
| `POST` | `/v1/persons/:id/government-id` | Attach a late-arriving Aadhaar (§6.3) | `BRANCH_ADMIN`+ |
| `POST` | `/v1/persons/:id/merge` | Merge another Person into this one | `ORG_ADMIN`, `SUPER_ADMIN` |
| `POST` | `/v1/persons/match-decisions` | Record a reviewed non-match (D7) | `BRANCH_ADMIN`+ |

**There is no `POST /v1/persons`** (D2) and no `DELETE` (D3).

`GET /v1/persons/:id` returns identity linkage — which Applicants, Students,
Guardians and Employees reference this Person — **not** personal detail. It
never returns a decrypted identifier; that is F1's separately-permissioned
endpoint. Requesting a tombstone returns `308` with the survivor's id rather
than `404`, so stale references self-heal.

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Government id already held by another Person | `409` | `ConflictException` — body names the conflicting `personId` |
| Merging a Person into itself | `400` | `BadRequestException` |
| Merge without a reason | `400` | `BadRequestException` |
| Person not found | `404` | `NotFoundException` |
| Person is a tombstone | `308` | redirect to survivor |

---

## 8. Events

| Event | When | Payload | Consumers |
| :--- | :--- | :--- | :--- |
| `person.created` | A new Person is minted | `personId`, `organizationId` | audit |
| `person.merged` | Merge completes | `survivorPersonId`, `mergedPersonId`, counts by type | audit, caches, search index |
| `person.government_id_attached` | Aadhaar bound to an existing Person | `personId` | audit |
| `person.match_reviewed` | A `DISTINCT` decision is recorded | both ids, `decidedBy` | audit |

Per [`../../core/events.md`](../../core/events.md) the payload carries **what**
happened; `RequestContext` supplies **who**. `person.merged` is the one any
cache or search index must subscribe to — a stale index pointing at a tombstone
is the most likely post-merge bug.

---

## 9. Dependencies

**Requires:** F1 (`IdentityHashService` for the blind index, and the pepper),
`Organization`.

**Depended on by:** Applicant (I2) gains `personId`; Student (I4) gains
`personId` with `@@unique([organizationId, personId])`; Guardian (S1) gains
`personId`, replacing its current standalone `aadhaarNo`
(`schema.prisma:296`); Employee (S4).

**Foreign key contract:** modules reference `personId` **only** for facts about
the human across every role — guardian relationships, sibling discovery, DPDP
consent and erasure. Everything academic references `studentId` or
`enrollmentId` instead. A module reaching for `personId` to store an academic
fact has made a mistake.

**Migration note:** the existing `Guardian.aadhaarNo` column holds plaintext
Aadhaar today. Moving guardians onto Person means hashing those values,
encrypting them per F1, and dropping the column. That is a data migration, and
it belongs in this module's implementation rather than being discovered later.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **What is the minimum signal for a MEDIUM match?** | `findCandidates()` tuning | Currently specified as `phoneHash + dob`. In practice one household mobile serves every child, so in a school of 1,000 this may fire on every sibling admission and become noise. Alternatives: require `phoneHash + dob + nameNormalized` similarity above a threshold, or drop MEDIUM to LOW when the organization has more than N persons sharing that phone. **Recommendation: ship as specified, instrument the false-positive rate, tune with real data.** Needs a decision on whether shipping a knowingly-noisy heuristic is acceptable. |
| **Q2** | **Does a merge need approval by a second person?** | The merge endpoint | Merge is irreversible and moves a student's entire history. A two-person rule (request → approve) is standard for irreversible operations at this blast radius, but doubles the friction for what is usually an obvious data-entry fix. **Recommendation: single-actor for v1**, with the mandatory reason and full `PersonMergeLog` as the control, revisited if merges prove error-prone. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Same Aadhaar applies at Mumbai and Pune | **One** Person. `resolve()` returns the existing row on the second application, silently — no warning, no duplicate. |
| 2 | Twins, no Aadhaar, same parent mobile and DOB | Second application raises a MEDIUM warning; clerk records `DISTINCT`; **two** Persons exist; the warning never fires for that pair again |
| 3 | Applicant admitted without Aadhaar; two years later it is attached and belongs to an existing Person | `409` naming the other Person — **not** a unique-constraint error, and **not** a silent overwrite |
| 4 | Merge B into A | Applicant, Student and Guardian references repointed to A; B survives as a tombstone; `PersonMergeLog.repointedRefs` lists exactly what moved |
| 5 | Merge A→B, then later B→C | A's tombstone points **directly at C**, not at B. No chain, no recursive lookup. |
| 6 | Guardian later enrols as a student (adult education) | One Person, referenced by both a Guardian and a Student row |
| 7 | Same Aadhaar registered in two different organizations | Two independent Persons, different `govtIdHash` values, no linkage discoverable from either side |
| 8 | `GET` a tombstone's id | `308` to the survivor — a stale bookmark self-heals |
| 9 | **Raw SQL** insert of a second Person with an existing `govtIdHash` in one org | **Rejected by Postgres** (invariant 1). Run outside Prisma or it proves nothing. |
| 10 | Person with `dob` in the future | Rejected by invariant 2 |
| 11 | 20 concurrent `resolve()` calls for the same Aadhaar | Exactly **one** Person created; the other 19 return it. No unique-violation crash surfaced to the caller. |
| 12 | Erase a person's data (F1), then apply again with the same Aadhaar | `govtIdHash` still matches — the same Person is returned, so an erased subject cannot re-enrol as a stranger. **Conditional on F1 §10 Q2 resolving in favour of retaining the hash.** |

Scenarios 9 and 11 prove the design rather than the implementation. Scenario 11
is the concurrency case: two clerks entering the same child simultaneously must
not produce two identities, which requires the unique index plus a caught
constraint violation retried as a read.
