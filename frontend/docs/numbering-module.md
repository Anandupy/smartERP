# Numbering Module

The format configuration for every human-facing business identifier the
platform generates — `studentCode`, `admissionNo`, and others.
`src/features/numbering`, wired from
`backend/postman/erp.postman_collection.json`'s "Numbering / Config" folder
and `backend/docs/planning/00-foundation/03-numbering.md` (design spec,
`Status: planned`; §12 is the R6 addendum — configurable `{year}` rendering
and the widened format-freeze rule — and is implemented, not planned).

Related: [Applicant Admission Lifecycle](./admission-lifecycle-module.md) ·
[Backend Contract Gaps](./backend-gaps.md)

---

## There is no "generate a number" endpoint

One engine allocates every sequence value, and it is called only from
inside a business operation that is about to persist the result —
`admit()` allocates `STUDENT_CODE` and `ADMISSION_NO` internally. **This
module never allocates a number.** It configures the *format* (Create,
Edit) and can render a sample of that format (Preview) — both without
touching the counter. No screen in this module calls Preview and then
feeds the rendered value into another request.

---

## Endpoints

| Endpoint | Note |
| --- | --- |
| `GET /numbering/configs` | No documented query parameters — every sequence readable from the current organization/branch scope |
| `POST /numbering/configs` | `purpose, prefix, suffix, includeBranchCode, includeAcademicYear, sequencePadding, format, yearFormat?` — `scope`, `allocationMode` and `resetStrategy` are **not** accepted; the Postman example's own description states they are derived from `purpose`. `yearFormat` is optional; an omitted value defaults server-side to `NAME` |
| `PATCH /numbering/configs/:id` | Same body, `yearFormat` required, plus `isActive` — `purpose` is not editable |
| `POST /numbering/configs/:id/preview` | `sampleValue`, optional `academicYearId` → `{ purpose, sampleValue, rendered }`. Consumes no number. |

**No `GET /:id` and no `DELETE` are documented.** A record for editing is
resolved out of the list read — the same "resolve from the list" pattern
Academic Year's missing `GET /:id` established (AGENTS.md §28). There is no
delete: an unwanted sequence is deactivated (`isActive: false`), never
removed, and the directory's `BackendPendingNote` says so rather than a
delete button being added speculatively.

---

## Purposes: only two are confirmed live

`backend/docs/planning/00-foundation/03-numbering.md` §3.2 documents nine
purposes with their designed scope/reset/allocation-mode — but that
document's own status line reads `planned`. Independently, the admission
trace confirms exactly two are live: the `/admit` response returns
`studentCode` and `admissionNo`, naming `STUDENT_CODE` and `ADMISSION_NO`
as the purposes the final transaction actually consumes.

The Create form's Purpose select offers all nine documented values (the
only enumeration available — `docs/backend-gaps.md` NUM1) with a note that
only the first two are confirmed in live use. Selecting one the backend
does not yet recognise surfaces as the server's own `400`, not a
client-side pre-filter — this module does not guess which of the seven
undocumented-as-live purposes actually exist.

---

## `scope`, `allocationMode` and `resetStrategy` are never form fields

All three are present on `NumberingConfigDto` (read) but absent from both
`CreateNumberingConfigRequest` and `UpdateNumberingConfigRequest` — derived
server-side from `purpose`. The form renders them nowhere as inputs; the
directory and detail views show them read-only, exactly as the backend
returns them.

---

## Year format (`yearFormat`)

R6 added a `yearFormat` field to `NumberSequenceConfig` — how `{year}`
renders when a format uses one (design spec §12.2). Five values, all
confirmed against the design spec and the regenerated Postman collection:

| Value | Renders | Computed from |
| --- | --- | --- |
| `NAME` (default) | `AcademicYear.name` verbatim, e.g. `2026-27` | The name field itself — no guaranteed width |
| `FULL_START` | `2026` | `AcademicYear.startDate`'s year |
| `SHORT_START` | `26` | Last two digits of the start year |
| `FULL_RANGE` | `20262027` | Start and end years concatenated |
| `SHORT_RANGE` | `2627` | Last two digits of each, concatenated |

The Create/Edit form exposes a Year Format select next to "Include academic
year." `NAME` is the default so a config created before this field existed
renders exactly as it always has — nothing is migrated or rewritten. The
Preview dialog and the directory table both label the record's configured
`yearFormat` next to its format string, and Preview now sends
`academicYearId` whenever the format renders `{year}` **or**
`includeAcademicYear` is set (mirroring the allocator's own test, design
spec §12.4) — not only when the flag is set, which is what this module did
before R6.

## Editability is not exposed on load, but a rejected save is now handled specifically

The design spec states a `NEVER`-reset sequence's rendered shape — not only
`prefix`/`sequencePadding` as first written, but every field that decides
what it renders (`suffix`, `format`, `includeBranchCode`,
`includeAcademicYear`, `yearFormat` too) — becomes immutable once it has
issued its first value (design spec §12.6, `error.code:
SEQUENCE_WIDTH_IMMUTABLE`). No field on `NumberingConfigDto` says whether
that has happened ahead of time (`docs/backend-gaps.md` NUM2, still open —
this is a reactive answer, not a proactive one), so the Edit form still
loads every field editable.

What changed: the form now recognises `SEQUENCE_WIDTH_IMMUTABLE`
specifically. The first time a save is rejected with that code, the form
shows a "Format is locked" banner and disables every field the backend
freezes, so a second save attempt cannot repeat the same rejected request —
only `isActive` stays editable. This is still not proactive (nothing renders
locked before a save is attempted), but it stops the form from offering a
disabled-looking edit that silently keeps submitting a doomed PATCH.

---

## Where Numbering meets Admissions

The Admit review (`AdmitApplicantDialog`) and the post-admit success screen
display `studentCode`/`admissionNo` **only as returned by
`POST /admissions/applicants/:id/admit`**. Neither screen calls
`GET /numbering/configs` or the preview endpoint — Numbering's own screens
are pure configuration, entirely separate from the moment a number is
actually allocated. This is deliberate: the task that added both modules
explicitly forbids the frontend generating or previewing a number and then
submitting it to `/admit`.

---

## Routing

```
/app/settings/numbering              → directory
/app/settings/numbering/new          → create
/app/settings/numbering/:id/edit     → edit (no detail route — no GET /:id)
```

Placed under System Settings, not a new top-level navigation module — this
is platform configuration, the same category as Maintenance and System
Information.

---

## UX layer: explaining the format, not changing it

The R7 UX refinement (this pass) reorganizes how the same four documented
endpoints are presented — no new endpoint, request field, or business rule
was added. Everything below is presentation/documentation over the existing
contract, driven by one shared vocabulary in `constants.ts`
(`FORMAT_PLACEHOLDERS`): the format field's Zod validation
(`schemas/numbering.schema.ts`), the insertable placeholder chips
(`FormatPlaceholderChips`), and the "how this format works" explanation
(`FormatExplanation`) all read from the same list, so a placeholder can never
be offered without being valid, or explained without being offered.

- **`FormatBreakdown`** (`components/format-breakdown.tsx`) parses a format
  string into its literal and `{placeholder}` segments and renders each
  placeholder as a labelled chip. It is a *structural* explainer, never a
  claimed generated identifier: `{prefix}`/`{suffix}` show the record's real
  configured value, `{sequence}` shows a zero string the width of
  `sequencePadding` (an honest implication of the configured padding, not an
  invented number), and `{branchCode}`/`{year}` — values this module cannot
  know without calling the real allocator — show what they resolve to
  (`{year}` reuses `YEAR_FORMAT_EXAMPLE`, already documented as illustrative
  only) styled with a dashed border to visually distinguish "example" from
  "configured value." A `compact` variant renders one line of label badges
  for table cells; the default `full` variant renders the two-tier
  sample-then-label chips for the create/edit form and the Edit screen's
  configuration summary.
- **The one real generated example still only ever comes from
  `POST /numbering/configs/:id/preview`.** `NumberingPreviewPanel`
  (`components/numbering-preview-panel.tsx`) holds that call and is shared by
  the directory's `PreviewNumberingDialog` (quick action) and the Edit
  screen, which embeds it inline in a dedicated "Preview" card — since Edit
  is also this module's closest thing to a detail view (there is no
  `GET /:id`, so no separate detail route), embedding Preview there was
  judged more prominent than leaving it reachable only through a dialog.
  Create cannot embed a real preview: the endpoint needs an existing `:id`,
  so a not-yet-created sequence only ever gets the structural
  `FormatBreakdown`, never a value claiming to be a real generated identifier.
- **The directory's summary tiles** (`NumberingSummaryCards`) count Active,
  Purposes configured, Branch scoped, and Organization scoped directly from
  the same list already fetched for the table — no dedicated summary
  endpoint exists, and none is called to produce these. There is
  deliberately no "generated today/this month," "remaining," or counter tile
  — nothing in the documented contract exposes allocation counts.
- **System behavior** (`scope`, `allocationMode`, `resetStrategy`) is now
  also shown on the Edit screen itself, not only the directory table — a
  read-only card labelled "Determined automatically from Purpose. Not
  editable here," so the user understands *why* no input exists for these
  three fields without having to infer it from their absence.

## Testing

`tests/mocks/numbering-handlers.ts` provides default CRUD + preview
handlers; `tests/integration/numbering.test.tsx` drives the directory
(list/search/empty/error/preview via the row's own Preview button, summary
tiles, plus the year-format hint and the `{year}`-without-
`includeAcademicYear` preview case), create (documented-fields-only, format
validation including the mirrored §12.5 rules, `yearFormat` sent, no Active
toggle, placeholder chips insert into the format field) and edit (purpose
locked, system behavior card renders the loaded record's scope/allocation/
reset, embedded Preview card, `yearFormat` seeded and backward-compatible
for a `NAME` record, `isActive` sent, `SEQUENCE_WIDTH_IMMUTABLE` locks the
format fields, not-found handling) flows.
