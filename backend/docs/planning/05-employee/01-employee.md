# S4 — Employee / Staff

> **Status:** `planned` — §10 has three open questions
> **Depends on:** F1, F3 (numbering), I1 (Person)
> **Depended on by:** A3 (subject competency), A4 (timetable), O1 (attendance marker), O2 (marks entry, moderation), every approval workflow

**New module.** There is no `Employee`, `Staff`, `Teacher` or `Department`
model. Staff exist today only as `User` rows with `role: STAFF`.

---

## 1. Purpose

S4 owns the **person who works at the institution** in their working capacity —
employee code, designation, department, employment period, branch assignments,
and what they are qualified to teach.

It does **not** own authentication or permissions (`User`, `modules/auth`,
`modules/authorization`), nor the human's identity (Person, I1).

**Scope boundary:** this is the *academic* subset of HR. Payroll, leave
balances, appraisals and statutory returns are a separate product decision
(§10 Q1). Attendance marking, exam entry, timetabling and approvals all need an
employee record; none of them needs a salary.

---

## 2. Decisions

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | **Employee is backed by `Person`** | A teacher whose child studies at the school is one human. Without Person they are two unlinkable rows, and §14 Q1 (one login, many identities) becomes impossible. |
| D2 | **Employee is organization-scoped; branches are *assigned*, not owned** | §2 Q9 permits staff to work across branches. A `branchId` column cannot express "teaches at Mumbai on Mondays, Pune on Thursdays" or "transferred in June". |
| D3 | **`EmployeeBranchAssignment` is date-ranged** | An assignment that ends must remain visible — last year's attendance was marked by someone who no longer works at that branch, and that record must still resolve. |
| D4 | **`employeeCode` is organization-scoped and permanent** | Same class as `studentCode` (F3 D7). A branch transfer must not change it. |
| D5 | **Employee is never deleted** | Historical attendance, marks and approvals reference them. Exit is a status and a date. |
| D6 | **`isTeaching` gates timetable and exam-entry eligibility** | A librarian must not appear in a subject-teacher dropdown. |
| D7 | **Subject competency is recorded here, scheduling is not** | *Which subjects this person can teach* is an employee fact; *which period they teach it in* is A4's. |
| D8 | **Employee and `User` are linked, never merged** | The domain record exists whether or not the person has a login. A visiting lecturer may never log in; they still mark attendance via the office. |

---

## 3. Data model

### 3.1 `Employee`

| Field | Type | Null | Why here |
| :--- | :--- | :--- | :--- |
| `id` | `UUID v7` | no | |
| `organizationId` | `String` | no | D2 |
| `personId` | `String` | no | The human (I1) |
| `employeeCode` | `String` | no | `@@unique([organizationId, employeeCode])` |
| `firstName`, `middleName?`, `lastName`, `displayName` | `String` | | Current official truth |
| `designationId` | `String` | no | Master — Principal, PGT, TGT, Clerk, Librarian |
| `departmentId?` | `String?` | yes | Master; college-relevant, usually null in schools |
| `employmentType` | `EmploymentType` | no | `PERMANENT`, `CONTRACT`, `VISITING`, `PART_TIME`, `PROBATION` |
| `isTeaching` | `Boolean` | no | D6 |
| `joiningDate` | `DateTime` | no | |
| `confirmationDate?` | `DateTime?` | yes | End of probation |
| `status` | `EmployeeStatus` | no | `ACTIVE`, `ON_LEAVE`, `SUSPENDED`, `RESIGNED`, `TERMINATED`, `RETIRED` |
| `exitDate?`, `exitReason?` | | yes | |
| `highestQualification?`, `totalExperienceYears?` | | yes | Board reporting asks for these |
| `photoFileId?` | `String?` | yes | S3 |
| `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt?` | | | |

> Aadhaar, PAN and bank details are **not** here. Aadhaar lives on
> `PersonSensitive` (F1 D11); bank details belong to payroll, which is out of
> scope (§10 Q1). Adding a `panNo` column now would create a plaintext
> government identifier — the exact defect F1 exists to prevent.

### 3.2 `EmployeeBranchAssignment`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `UUID v7` | |
| `employeeId`, `branchId` | `String` | |
| `isPrimary` | `Boolean` | Exactly one active per employee |
| `assignedFrom` / `assignedTo?` | `DateTime` / `DateTime?` | D3 |
| `assignmentReason?` | `String?` | Transfer, additional charge, cover |

Multiple concurrent assignments are legal (§2 Q9); exactly one is primary.

### 3.3 `EmployeeSubject` — competency (D7)

| Field | Type | Notes |
| :--- | :--- | :--- |
| `employeeId`, `subjectId` | `String` | `subjectId` → A3 |
| `proficiency?` | `String?` | Free text — "PG in Mathematics" |
| `canTeachUpToLevel?` | `ProgramLevel?` | A TGT may teach to Std 10 but not Std 12 |

Populates subject-teacher dropdowns and lets A4 reject an impossible allocation.

### 3.4 Masters

`Designation` and `Department`, following the existing three-tier master pattern
(`organizationId?`/`branchId?` nullable, SYSTEM when both null).

---

## 4. Invariants

| # | Invariant | Mechanism |
| :--- | :--- | :--- |
| 1 | `employeeCode` unique per organization | `@@unique([organizationId, employeeCode])` |
| 2 | One Employee per Person per organization | `@@unique([organizationId, personId])` |
| 3 | Exactly one primary branch assignment | `CREATE UNIQUE INDEX employee_one_primary_branch ON "EmployeeBranchAssignment" ("employeeId") WHERE "isPrimary" AND "assignedTo" IS NULL` |
| 4 | No duplicate concurrent assignment to one branch | Exclusion constraint over `tstzrange("assignedFrom","assignedTo")` with `employeeId`, `branchId` equal |
| 5 | Assignment window ordered | `CHECK ("assignedTo" IS NULL OR "assignedFrom" < "assignedTo")` |
| 6 | Exit date not before joining | `CHECK ("exitDate" IS NULL OR "exitDate" >= "joiningDate")` |
| 7 | An exited employee has a date and reason | `CHECK ("status" NOT IN ('RESIGNED','TERMINATED','RETIRED') OR ("exitDate" IS NOT NULL AND "exitReason" IS NOT NULL))` |
| 8 | Only teaching staff hold subject competencies | Application-validated against `isTeaching` |
| 9 | No hard delete | No service method, no endpoint (D5) |

---

## 5. Provenance

Branch assignments are **ended, never deleted** (D3). A transfer closes one row
and opens another, so "who was the class teacher in 2026?" stays answerable
after three transfers.

Employment status changes are audited transitions carrying actor, date and
reason.

### The correction test

A teacher transfers from Mumbai to Pune in June:

```
EmployeeBranchAssignment  Mumbai  isPrimary: true   from: 2024-04-01  to: 2027-06-01
EmployeeBranchAssignment  Pune    isPrimary: true   from: 2027-06-01  to: null
                                  assignmentReason: "inter-branch transfer, order HR-2027-88"
```

`employeeCode` is unchanged (D4). Attendance marked at Mumbai in May still
resolves to this employee, and still shows they were at Mumbai when they marked it.

---

## 6. Lifecycle

```
[PROBATION] ──confirm──> [ACTIVE] ──┬──> [ON_LEAVE] ──> [ACTIVE]
                                    ├──> [SUSPENDED] ──> [ACTIVE]
                                    └──> [RESIGNED | TERMINATED | RETIRED]   (terminal)
```

Terminal statuses require a date and reason (invariant 7). An exited employee's
`User` account must be disabled — but the Employee record and every assignment
persist, because their historical work does.

> **`SUSPENDED` here is an employment status**, unlike the student case where
> §6 Q18 recommends a separate `DisciplinaryAction`. The difference is real: a
> suspended student still occupies a seat and still owes fees, so suspension is
> not their enrollment state. A suspended employee genuinely stops working.

---

## 7. API surface

| Method | Path | Purpose | Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/employees` | Create (resolves a Person, allocates `employeeCode`) | `ORG_ADMIN`+ |
| `GET` | `/v1/employees` | List, filtered by branch, teaching, status | `BRANCH_ADMIN`+ |
| `GET` | `/v1/employees/:id` | With assignments and competencies | `BRANCH_ADMIN`+ |
| `PATCH` | `/v1/employees/:id` | Update details | `ORG_ADMIN`+ |
| `POST` | `/v1/employees/:id/assignments` | Assign to a branch | `ORG_ADMIN`+ |
| `POST` | `/v1/employees/:id/assignments/:aid/end` | End an assignment | `ORG_ADMIN`+ |
| `POST` | `/v1/employees/:id/exit` | Resignation, termination, retirement | `ORG_ADMIN`+ |
| `PUT` | `/v1/employees/:id/subjects` | Set competencies | `BRANCH_ADMIN`+ |
| `GET` | `/v1/employees/teachers?subjectId=&branchId=` | Eligible teachers — feeds A4 | `BRANCH_ADMIN`+ |

**No `DELETE`** (D5). Branch assignment is `ORG_ADMIN`+ because a
`BRANCH_ADMIN` granting themselves another branch is a privilege-escalation path.

| Rule broken | Status | `error.code` |
| :--- | :--- | :--- |
| Second primary assignment | `409` | `ConflictException` |
| Overlapping assignment to one branch | `409` | `ConflictException` |
| Competency for non-teaching staff | `400` | `BadRequestException` |
| Exit without a reason | `400` | `BadRequestException` |
| Person already an employee here | `409` | `ConflictException` — names the existing `employeeCode` |

---

## 8. Events

| Event | When | Consumers |
| :--- | :--- | :--- |
| `employee.created` | New employee | Audit, user provisioning |
| `employee.assigned_to_branch` | Assignment created | Authorization (branch scope) |
| `employee.assignment_ended` | Assignment closed | Authorization, timetable |
| `employee.exited` | Terminal status | **Auth — disable the login**; timetable — reallocate their classes |
| `employee.competency_changed` | Subjects changed | Timetable validation |

`employee.exited` is the one that matters most: an exited teacher whose account
stays live is the most common insider-access gap in a school system.

---

## 9. Dependencies

**Requires:** F1, F3 (`EMPLOYEE_CODE`, organization-scoped, `MONOTONIC`), I1,
Designation and Department masters, Branch.

**Depended on by:** A3 (`EmployeeSubject.subjectId`), A4 (timetable allocation),
O1 (attendance marker), O2 (marks entry, moderation, result approval), every
workflow needing a named approver.

### ⚠️ Two conflicts with the existing `User` model

**1. `User.role` is a single enum.** `User.role: RoleType` permits exactly one
role, and `RoleType` contains both `STAFF` and `PARENT`. A teacher whose child
studies at the school **cannot be both** — the schema forbids it, and §14 Q1
requires it. Resolving this means either a `UserRole` join table or per-identity
role resolution through `UserIdentityLink`. **That is §14's work, not S4's**,
but S4 is where it becomes unavoidable.

**2. `User.phone` is globally `@unique`.** Indian households share one mobile
number routinely. A parent and their child cannot both hold accounts, and two
siblings cannot both be reached. §14 Q7 already flags mobile as the primary
guardian identifier — a global unique constraint on it will block the parent
portal. Likely fix: unique per organization, or unique only among users who
authenticate by phone.

Neither is S4's to fix. Both are recorded here because S4 is the first module
that cannot be built without knowing the answer.

---

## 10. Open questions

| # | Question | Blocks | Options |
| :--- | :--- | :--- | :--- |
| **Q1** | **Is payroll in scope?** | The module's extent | Payroll pulls in salary structure, statutory deductions (PF, ESI, TDS), payslips and bank files — comfortably larger than this module. **Recommendation: out of scope for v1.** Design `Employee` so payroll can attach later via a separate table rather than columns here. Needs your confirmation, because it materially changes what "staff module" means to a customer. |
| **Q2** | **Does an employee need a `User` account to mark attendance?** | O1's design | If yes, every visiting lecturer needs provisioning. If no, attendance needs a "marked on behalf of" concept. **Recommendation: no** — the office marks on behalf of staff without logins, recorded as `markedBy` (the user) plus `attributedTo` (the employee). Two fields, and it matches how schools actually work. |
| **Q3** | **Can one Person be an employee at two organizations?** | Invariant 2 | Person is organization-scoped (I1 D1), so this is already two Persons and two Employees. Consistent, but a genuinely shared visiting lecturer appears twice with no link. **Recommendation: accept**, same reasoning as S1 Q2 — tenant isolation outranks the convenience. |

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| :--- | :--- | :--- |
| 1 | Create a teacher | Person resolved, `employeeCode` allocated, primary branch assigned |
| 2 | **Teacher's child is admitted to the same school** | **One Person**, one Employee, one Student. Guardianship links them (S1). |
| 3 | Teacher assigned to a second branch | Both assignments active, exactly one primary (invariant 3) |
| 4 | Transfer Mumbai → Pune | Old assignment closed, new one opened, `employeeCode` **unchanged** |
| 5 | Second primary assignment attempted | `409` (invariant 3) |
| 6 | Overlapping assignment to the same branch | `409` (invariant 4) |
| 7 | Teacher resigns | Status terminal, exit date and reason recorded, **`employee.exited` published so auth disables the login** |
| 8 | Query last year's attendance marked by an exited teacher | **Still resolves** — record retained (D5) |
| 9 | Assign a subject competency to a librarian | `400` (invariant 8) |
| 10 | Eligible-teacher lookup for Mathematics at Pune | Returns only teaching staff with that competency, currently assigned to Pune |
| 11 | **Raw SQL**: exit date before joining date | Rejected (invariant 6) |
| 12 | **Raw SQL**: `RESIGNED` with no exit reason | Rejected (invariant 7) |

Scenario 2 is the one Person exists for. 11 and 12 must run as raw SQL.
