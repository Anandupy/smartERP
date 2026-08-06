# Review of Sections 1–4 — What Holds, What Breaks

An honest audit of the decisions already frozen in
`ERP QUESTIONS AND ANSWERS.docx`. Written because "was my flow right?" deserves
a real answer rather than agreement.

**Verdict in one line:** the domain thinking is above average for an ERP at this
stage — several decisions are ones that commercial school ERPs get wrong — but
there are **seven defects**, three of which will be expensive to fix after data
exists.

---

## Part 1 — What you got right

These are not filler. Each is a decision that mainstream school ERPs commonly
get wrong, and reversing them later is very costly.

| Decision | Why it matters |
| :--- | :--- |
| **§3: Applicant ≠ Student** | The single most common fatal design error in school ERPs is one `students` table holding enquiries, applicants, and enrolled students with a `status` column. It poisons every downstream count, report, and fee run. You avoided it. |
| **§4 Q1: Applicant = admission *attempt*, not person** | Correct, and you reasoned it out with the right trade-offs. Keeping Applicant temporary is what keeps the lifecycle clean. |
| **§4 Q14: confidence-based duplicate detection, never auto-reject** | The twins example shows genuine domain thinking. Hard-blocking on name+DOB+address is a real bug in shipped products. Scoring and letting a human decide is the correct design. |
| **§4 Q17: WITHDRAWN ≠ CANCELLED** | Applicant-initiated vs institution-initiated exit are different facts with different reporting and refund consequences. Most systems collapse them into one status and permanently lose the distinction. |
| **§4 Q19: no direct status edits, everything through a workflow engine** | This is what makes the audit trail trustworthy. Including the Super Admin force-transition *through* the engine rather than around it is exactly right. |
| **§4 Q12: soft delete only from DRAFT/CANCELLED** | Correct. Deletion permitted only where no history exists yet. |
| **§3 Q25: UUID internal, business code external** | Correct, and the module-by-module table is more rigour than most teams apply. |
| **§3: centralized Numbering & Identity Engine** | Correct and forward-looking. Per-module generators are how ERPs end up with six incompatible numbering schemes. |
| **§3 Q3: student creation in one atomic transaction** | Correct. Partial student creation is unrecoverable in practice. |
| **§2 Q13: branch-isolated reports by default** | Correct default. Opt-in consolidation for higher roles is the right direction of travel. |

---

## Part 2 — The seven defects

Ranked by cost-to-fix-later, not by how wrong they are.

### D1 — Student Code globally unique across all tenants (§3 Q13, Q15) 🔴 CRITICAL

You decided one global sequence across the entire ERP, spanning every
organization. Two problems:

**Tenant information leak.** If Org A's codes run `STU0000410` … `STU0000455`
across a week, and their next one is `STU0000892`, Org A has just learned that
other tenants issued ~437 student codes that week. Sequence gaps are a
side-channel. For a multi-tenant SaaS this is a genuine isolation breach, and
§4 Q6 already commits you to *"complete tenant isolation."* The two decisions
contradict each other.

**Global write bottleneck.** One counter row serialises student creation across
every tenant on the platform. Your own `numbering-review.md` §2C already flags
row-lock contention on a *per-branch* counter. A global counter is that problem
multiplied by your customer count.

**The stated reasons don't require it.** §3 lists branch transfers, central
reporting, parent portal, certificates, and alumni. Every one of those operates
*inside one organization*.

> **Fix:** `@@unique([organizationId, studentCode])`. Uniqueness per
> organization. The UUID remains globally unique and is what any cross-tenant
> mechanism should use anyway.

### D2 — Master data defaults to Branch-level (§2 Q10) 🔴 CRITICAL

"Maximum flexibility" is the reasoning, and it is the wrong instinct here.

Your masters include `Religion`, `Caste`, `Category`, `Gender`, `BloodGroup`,
`Language`, `Disability`, `RelationType`. Most of these are **government-defined
or biologically fixed**. Caste and Category lists come from state and central
government schedules. There is no such thing as "Mumbai branch's definition of
OBC."

Branch-scoping them causes:

- **Duplication.** 3 branches × ~200 caste entries = 600 rows to maintain in
  sync, forever, per organization.
- **Broken branch transfer.** A student's `categoryId` points at a Mumbai row.
  Transfer to Pune and that FK references a master row that isn't in Pune's
  scope. §2 Q6 promises "complete history must remain preserved" — it can't.
- **Broken consolidated reporting.** §2 Q13 promises org-level reports for
  admins. You cannot `GROUP BY category` across branches when each branch has
  its own category rows with its own UUIDs. You'd need a mapping table nobody
  will maintain.
- **Broken government reporting.** UDISE+ and state returns want standard codes.

**The schema already disagrees with the policy.** Per
`admissions-production-audit.md` §1, `organizationId` and `branchId` on the
masters are both *nullable* — "Global if null." The implementation already
supports three-tier scoping. Only the written policy is wrong.

> **Fix:** three-tier resolution, most-specific-wins:
> **SYSTEM** (platform-seeded, immutable: Gender, BloodGroup, Caste, Category,
> Religion, Language, Disability, RelationType) →
> **ORGANIZATION** (additions and overrides) →
> **BRANCH** (only where genuinely local: `Quota`, `AdmissionSource`).
> Branch-level remains *possible* everywhere; it stops being the *default*.

### D3 — "Never delete a Student" vs the DPDP Act 2023 🔴 CRITICAL (legal)

§3 Q7/Q8 freeze: students are never deleted, only archived, retained
permanently. §4 Q10 says the same for applicants.

India's **Digital Personal Data Protection Act 2023** grants a right to erasure
and imposes heightened obligations on children's data — verifiable parental
consent, and a prohibition on tracking and behavioural monitoring of children.
Your entire user base under 18 is in that category. "We keep everything
forever" is not a defensible position, and this is your primary market.

The tension is real and resolvable, but it must be *designed*, not discovered
during a compliance review.

> **Fix:** separate **retention of the academic record** (legitimate, often
> statutorily required — results, transcripts, fee receipts) from **retention of
> personal data** (Aadhaar, photographs, biometrics, contact details, health
> notes). Design a **crypto-erasure** path: personal fields encrypted per
> subject, erasure = destroy the key, leaving the academic and financial record
> structurally intact and still reportable. Add explicit consent capture at
> application, and a retention schedule per data class.

Also: an unrejected applicant's Aadhaar sitting in your database for seven
years, for a child who never joined the school, is very hard to justify.

### D4 — No person-level identity anywhere (§4 Q1 + Q4 + Q6) 🟠 HIGH

This follows from a decision that is *individually* correct. Applicant = one
attempt (Q1). Different branch = new Applicant (Q4). Different org = new
Applicant (Q6). Duplicate detection runs per branch.

Together they mean **the system can never recognise a human being.** It cannot
tell that:

- this applicant is the same child who was rejected last year,
- this applicant is a sibling of an existing student,
- this applicant is currently enrolled at your Pune branch,
- these two approved applicants at two branches are one person (this is the Q1
  I raised in the Sections 5–6 doc, and this is its root cause).

> **Fix:** an organization-scoped **`Person`** index — a thin identity record
> holding a hashed government ID, DOB, and normalised name, with no lifecycle of
> its own. `Applicant`, `Student`, and `Guardian` all *reference* a Person;
> none owns it. Applicant stays temporary exactly as you decided. This single
> addition resolves duplicate detection, sibling discovery, readmission
> recognition, and the two-branch collision at once.

### D5 — "Playgroup to PhD" but universities are out of scope (§1 Q2 vs Q12) 🟠 HIGH

These cannot both be true. PhD is a university construct — it needs
supervisor allocation, coursework/research phase split, synopsis and thesis
workflow, viva panels, and an examination *authority* separate from the
teaching institution. Q12 explicitly excludes exactly those capabilities.

The risk isn't the contradiction on paper, it's that "PhD" in the vision
document quietly justifies generality in the data model that costs you
everywhere and is never used.

> **Fix:** state v1 scope as **Playgroup → Postgraduate**. Drop PhD and M.Phil
> explicitly. Revisit with universities in v2. Nothing in the 4-layer model
> blocks adding them later.

### D6 — "Configurable" promised ~15 times, with no configuration engine 🟠 HIGH

Across Sections 1–4 you commit to per-institution configurability for: fee
structures, admission rules, refund policy, deferment policy, seat reservation,
archival retention, program preference limits, numbering formats, boards,
mediums, and multi-language. My Sections 5–6 doc adds another eight.

There is no design for **where configuration lives, how it resolves, how it is
versioned, or what happens when it changes mid-year.** That last one is the
dangerous one: if a branch changes its refund percentage in November, what
happens to a refund initiated in October and approved in December?

> **Fix:** design a **Configuration Engine** before the modules that depend on
> it — same three-tier resolution as masters (SYSTEM → ORG → BRANCH), typed
> keys with schema validation, **versioned with effective dates**, and a rule
> that long-running processes bind the config version at start rather than
> reading live values. Without this, "configurable" becomes fifteen
> inconsistent settings tables.

### D7 — Coaching institutes in scope (§1 Q3) 🟡 MEDIUM

Coaching institutes have no academic year, no promotion, no board, no section,
and often no fixed duration. Their unit of work is a *batch on a course over a
date range*. Your core model is `AcademicYear → Program → AcademicUnit →
Enrollment`, all of which they lack.

Supporting them isn't wrong — but letting them influence v1 modelling means
making `academicYearId` nullable on things that should never have it nullable,
and that nullable column will cause bugs in every school deployment.

> **Fix:** defer to v2 as a separate *institution profile* that reuses Person,
> Guardian, Document, Finance, and Communication, but has its own enrollment
> shape. Do not weaken the school/college model to accommodate it now.

---

## Part 3 — Smaller corrections

| Ref | Issue | Correction |
| :--- | :--- | :--- |
| §2 Q11 | "Numbering is branch-specific" — stated flatly, but §3 makes `studentCode` global | Numbering has **two classes**: *operational* numbers (admissionNo, receiptNo, rollNumber) are branch+year scoped; *identity* numbers (studentCode, employeeCode) are organization scoped. Say so explicitly. |
| §1 Q15 | Multilingual left as an open architecture question | **Resolve it now**, because it affects every master table's shape. Recommendation: `nameI18n JSONB` on master rows (`{"en":"General","hi":"सामान्य","mr":"सर्वसाधारण"}`) plus a separate UI string catalogue. Masters are low-cardinality and read-heavy, so a translation join per dropdown is wasted work. Index with GIN if search across languages is needed. **Do not** translate transactional data (names, addresses) — store as entered. |
| §2 Q15 | Branch closure — "records cannot be modified" | Also specify what happens to **in-flight** work: pending applications, unpaid fees, and undelivered certificates at the moment of closure. Closure needs a pre-flight check, not just a flag. |
| §3 Q9 | UUID v7 as primary key | Correct choice (time-ordered, avoids the index fragmentation of v4). Worth noting explicitly that **v7 leaks creation time** — fine internally, one more reason not to expose it publicly, which §3 Q24 already recommends. |
| §4 Q11 | Archive after 3/5/7 years, configurable | Add: archival must be **explicit and reversible**, and archived rows must remain in the same table with a flag rather than being moved to shadow tables. Shadow-table archival breaks every FK and every report. |

---

## Part 4 — Was the admission flow right?

**The flow itself: yes.** `Applicant → approval → Student → Enrollment` is
correct, and the atomic-transaction requirement at approval is correct.

**What was missing: the Admission layer**, covered in
[05-06-admission-enrollment.md](05-06-admission-enrollment.md). Without it,
Sections 5's questions 3, 5, 6, and 19 have no clean answer — there is nowhere
to record a continuous spell of study, which is what a Transfer Certificate is
issued against.

**What would make it genuinely better than what you have now**, in order:

1. **The `Person` index (D4).** Turns duplicate detection from a per-branch
   string match into real identity resolution. One change, four problems solved.
2. **The Configuration Engine (D6).** You have already promised it fifteen
   times. Build it once, deliberately.
3. **Three-tier master resolution (D2).** Your schema already supports it.
4. **Per-org student codes (D1).** A one-line index change now; a data migration
   across every tenant later.
5. **The DPDP erasure path (D3).** Cheap to design now, structurally invasive to
   retrofit, and it is the one that carries legal risk.
