# Sections 16–27 — What The Question Set Doesn't Ask

Your 295 questions cover the **student record** thoroughly. They do not cover
the things that decide whether a school can actually run on the software, or
whether you can sell it. These are proposed as additional sections in your own
numbering scheme.

Ordered by how much damage their absence causes.

---

## SECTION 16 — Employee / Staff 🔴 blocking

Referenced three times in your existing sections (§2 Q9 staff across branches,
§9 employee documents, §10 faculty) and never designed. Nothing academic works
without it: attendance needs a marker, exams need an entry clerk and a
moderator, timetable needs a teacher, and every approval workflow needs an
approver who is a *person*, not just a `userId`.

**Key decisions to make:** Employee backed by `Person` (so a parent who is also
a teacher is one human). Employee is branch-*assigned*, not branch-owned, since
§2 Q9 permits multi-branch work — model `EmployeeBranchAssignment` with a date
range and a role, rather than a `branchId` column. Employee code is
organization-scoped (same class as `studentCode`). Teaching vs non-teaching
distinction drives timetable eligibility. Full HR — payroll, leave, appraisal —
is a separate product decision; the *academic* subset is not optional.

**Build:** before Attendance and Examination.

---

## SECTION 17 — Timetable & Scheduling 🔴 blocking

Period-wise attendance (§12 Q6) and subject teaching are undefined without it.
It is also the module schools evaluate hardest during a demo, because manual
timetabling is genuinely painful.

**Key decisions:** period grid per program (not per branch — a junior school and
a junior college in the same branch have different day shapes); teacher–subject–
section allocation with clash detection as a hard constraint; room and lab
allocation; **substitution** when a teacher is absent, which is the daily
operational reality and the most-used screen; and a timetable version per term
so history is preserved.

Do not attempt automatic timetable *generation* in v1. Ship a fast manual
builder with clash detection. Auto-generation is a constraint-solving problem
that will consume months.

**Build:** after Employee, before period-wise Attendance.

---

## SECTION 18 — Configuration Engine 🔴 blocking

Defect D6 from the review document. You have promised per-institution
configurability roughly twenty-three times across all sections. There is no
design.

**Key decisions:** typed keys with JSON-schema validation (not a
`key/value TEXT` table — that becomes untyped garbage within a year); three-tier
resolution SYSTEM → ORG → BRANCH; **versioned with effective dates**; and a
binding rule stating that long-running processes capture the config version at
start rather than reading live values mid-run.

The mid-year change problem is the one that bites: a branch edits its refund
percentage in November; a refund raised in October and approved in December
must use the October policy, and you must be able to *prove* which policy
applied. Section 15 Q20 already requires configuration changes to be audited —
that requirement is only meaningful if configuration is versioned.

**Build:** first. Everything downstream assumes it.

---

## SECTION 19 — Data Migration & Tenant Onboarding 🟠 commercial

§3 Q4 mentions "Migration Mode with elevated permissions" in one line. That line
is a whole module, and commercially it may be the most important one in the
product: **every sale begins by importing the incumbent system's data.** If
onboarding a 2,000-student school takes three weeks of manual work, the product
does not scale regardless of how good the domain model is.

**Key decisions:** staged import (upload → validate → preview → commit →
rollback) with a dry-run that reports every rejection *before* anything is
written; a stable external-id column on every importable entity so re-runs are
idempotent; migration-created Students legitimately having no Applicant (already
permitted by §3 Q4) and no Admission history before the join date; and how to
handle historical fee balances and past results, which every school will ask for
and most systems handle badly.

Also design **tenant provisioning**: creating an organization, seeding SYSTEM
masters, first branch, first academic year, first admin — as a repeatable,
scripted operation rather than manual DB work.

**Build:** in parallel with the core rewrite. Do not defer to "later" — the
schema decisions it forces (external ids, nullable provenance) are cheap now and
invasive later.

---

## SECTION 20 — Concurrency, Idempotency & Bulk Jobs 🟠 correctness

Your ERP has several operations that are neither single-row nor instantaneous,
and the current architecture treats everything as a synchronous HTTP request.

**The operations that break this:** promoting 2,000 students at year end;
generating 2,000 invoices; a bulk attendance upload; a result publish; a
payment-gateway callback that arrives twice; two counsellors approving the last
seat in the same second.

**Key decisions:** idempotency keys on every externally-triggered mutation
(payments especially); a job runner with progress, partial-failure reporting,
and resumption for bulk operations — a promotion run that fails at student 1,400
must not leave 1,399 students promoted and no record of it; optimistic locking
(`version` column) on Enrollment and Admission; and pessimistic locking or an
atomic decrement on seat allocation, which is the one place a race causes
over-admission.

Your numbering engine already has two documented races
(`numbering-review.md` §2A, §2B). Treat that as the canary, not an isolated bug.

**Build:** the primitives before Finance; the job runner before the first
promotion cycle.

---

## SECTION 21 — Data Protection & Consent (DPDP Act 2023) 🔴 legal

Defect D3 from the review document. Not mentioned anywhere in 295 questions,
and your entire user base is children in India.

**Key decisions:** verifiable parental consent captured at application and
re-captured on material change; a consent record per purpose (academic
operations vs photographs vs marketing vs third-party sharing); the erasure path
(crypto-erasure over hard delete, so the academic record survives while personal
data does not); data-residency (India) and sub-processor documentation; breach
notification readiness; and the statutory prohibition on tracking and
behavioural monitoring of children — which is a direct constraint on any
analytics you might otherwise be tempted to build, and on the face-recognition
attendance in §12 Q8.

Design this **with** Section 9's encryption, not after it. Retrofitting
per-subject key management into a system with live data is one of the most
expensive migrations there is.

**Build:** design now, implement alongside Document and Student.

---

## SECTION 22 — Reporting & Analytics 🟡 scaling

§2 Q13 promises cross-branch consolidated reporting for org admins. Running
those aggregates against the transactional database will degrade the
application for every user during exactly the periods when reports are most
wanted — admission season and result publication.

**Key decisions:** a read replica or a separate analytical store; scheduled
materialization of the heavy aggregates (fee collection, attendance
percentages, admission funnel); the rule that no report query touches the
primary write path; and export as a queued job with a download link rather than
a synchronous request that times out at 5,000 rows.

Tie exports back to §15 Q5 — every export is an audited event.

**Build:** when the first customer has more than one branch.

---

## SECTION 23 — Operational Modules 🟡 scope

§3 lists Library, Transport, Hostel, Discipline, Health Records, and Alumni as
depending on Student. None of them is designed, and none appears in the question
set.

They share one requirement worth deciding **now**, because it is structural:
each one attaches to Enrollment (year-scoped: a transport route, a hostel room,
a library membership are all per-year facts) while reporting against Student.
They also all generate **fee heads**, which means Finance must accept externally
generated charges rather than owning a closed list.

Decide the *integration shape* now; build the modules later.

---

## SECTION 24 — Certificates & Alumni 🟡 scope

Certificate issuance — TC, bonafide, character, migration, provisional — is the
final act of the student lifecycle and it is what the Admission layer exists to
support (§5). Two decisions worth taking early: issued certificates are
**snapshotted**, never re-derived (a TC reprinted in 2031 must match the 2026
original exactly), and certificate numbers are gapless and branch-scoped, like
receipts.

Alumni is simply `Student.status = GRADUATED` with a communication opt-in. It is
not a separate entity, and treating it as one is a common and expensive mistake.

---

## SECTION 25 — Low-Connectivity & Mobile 🟡 market fit

Not a question anywhere, and a real constraint in the Indian market. Teachers
mark attendance on phones in buildings with poor signal. Fee counters run during
power cuts.

**Key decisions:** which operations tolerate offline capture and later sync
(attendance yes; fee receipts absolutely not — never issue a receipt number
offline); conflict resolution on sync; and aggressive payload minimisation on
the mobile surfaces.

Decide the *policy* now — specifically the "no offline financial documents"
rule — even if the mobile app is far off.

---

## SECTION 26 — Platform Operations 🟡 durability

Not asked. Bites once, badly.

Backup and **tested** restore — an untested backup is not a backup; per-tenant
restore, since one customer's bad import must not require restoring everyone;
API versioning policy, since school integrations are long-lived and you will
break something; rate limiting per tenant, since one runaway integration must
not degrade the platform; maintenance mode (you already have `MaintenanceRule`);
and a health/readiness contract for deployments.

---

## SECTION 27 — Communication 🟢 already built

Absent from the question set, but the most complete module in the codebase
(`docs/modules/communication/` — templates, providers, OTP, delivery logs,
preferences, notifications).

The open question isn't architecture, it's **policy**: who may message whom,
what is transactional (absence alert, fee reminder — always delivered) versus
promotional (subject to preferences and consent), quiet hours, and rate caps so
a bulk send cannot exhaust an SMS balance in one run. Under DPDP, the
transactional/promotional line is a compliance boundary, not just a courtesy.

---

## Summary — the four that change what you build next

Everything above is worth having. These four change the schema, so they matter
before you write the migration rather than after:

| | Why it must come first |
| :--- | :--- |
| **§18 Configuration Engine** | Twenty-three existing promises depend on it. Versioned config is also a §15 Q20 audit requirement. |
| **§21 DPDP / consent** | Forces per-subject encryption into the Student and Document schema. Effectively impossible to retrofit. |
| **§19 Migration & onboarding** | Forces stable external ids onto every importable entity, and it's your commercial critical path. |
| **§16 Employee** | Attendance, exams, timetable, and every approval need a person on the other side. |
