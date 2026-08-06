# [ID] — [Module Name]

> **Status:** `not started` | `in discussion` | `planned` | `implemented`
> **Depends on:** [modules that must exist first]
> **Depended on by:** [modules that break if this changes]

Copy this file, fill every section, delete these instructions. A module is
`planned` only when all eleven sections are complete and §10 is empty.

---

## 1. Purpose

What this module owns, in two sentences. Then, equally important, **what it does
not own** — the boundary is where most design arguments actually happen.

---

## 2. Decisions

Every frozen decision with its reasoning. A decision without a *why* gets
re-argued in six months by someone who wasn't here.

| # | Decision | Why | Source |
| :--- | :--- | :--- | :--- |
| D1 | | | Q&A §_ / discussion _date_ |

**Rejected alternatives** — what was considered and why it lost. This is what
stops a future reader "improving" the design back into a known dead end.

---

## 3. Data model

For every field, the question is not just what it is but **why it lives here**.

### `ModelName`

| Field | Type | Null | Why here | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `String (UUID v7)` | no | | Primary key |

**Placement test.** For each field, answer: *what does this fact vary with?*
A field that varies with the academic year does not belong on Student. A field
that varies with the person does not belong on Enrollment. If a field would have
to be **copied** when a student is promoted, it is in the wrong table.

**Enums** — declare each with its full value set and what each value means.

---

## 4. Invariants

What the **database** enforces, not what services remember to check. Give the
exact constraint.

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | | `@@unique([...])` / partial index / composite FK / `CHECK` |

Prisma cannot express partial unique indexes — those go in raw SQL appended to
the generated migration. Write the exact `CREATE UNIQUE INDEX ... WHERE ...`
here so it is not reinvented.

---

## 5. Provenance

*Nothing should just appear.* For each row this module creates:

| Row created by | `originType` | Links back via | Reason required? |
| :--- | :--- | :--- | :--- |

**Append-only tables** — list them. For each, state what supersedes what, and
confirm that the superseded row is never edited or deleted.

**The correction test.** Show, concretely, what the rows look like after an
operator fixes a mistake. If a report cannot answer *"was this changed, when, by
whom, and why?"*, this section is not finished.

---

## 6. Lifecycle

States and legal transitions. A diagram plus a table — the diagram is read, the
table is implemented.

```
[STATE_A] ──action──> [STATE_B]
```

| From | To | Action | Who | Guard |
| :--- | :--- | :--- | :--- | :--- |

**Terminal states** — which, and what (if anything) may reopen them.
Every transition passes through the workflow engine. Direct status writes are
never permitted, including for administrators.

---

## 7. API surface

| Method | Path | Purpose | Roles | Guards |
| :--- | :--- | :--- | :--- | :--- |

Note required headers (`x-branch-id`, `x-academic-year-id`), pagination, and
filters. Follow [`../core/response-contract.md`](../core/response-contract.md).

**Error contract** — every rule from §4 that a client can trigger, with its
status code and `error.code`.

---

## 8. Events

| Event | When | Payload | Consumers |
| :--- | :--- | :--- | :--- |

Follow [`../core/events.md`](../core/events.md): the event carries **what**
happened; `RequestContext` supplies **who**. Do not duplicate actor or tenant
identity into the payload.

---

## 9. Dependencies

**Requires:** modules and tables that must exist first.
**Breaks if changed:** what downstream work assumes about this module.
**Foreign key contract:** what other modules should reference — `personId`,
`studentId`, `admissionId`, or `enrollmentId` — and why that one.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |

**Must be empty before implementation begins.** An assumption recorded here is
cheap; an assumption made silently in code is not.

---

## 11. Acceptance scenarios

Concrete cases, not abstract requirements. Each becomes an integration test.

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | | |

Include at least one **negative** case (something the database must refuse) and
one **concurrency** case where the module allocates a number, a seat, or a
unique slot.
