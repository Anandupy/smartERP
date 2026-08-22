# Numbering Module

The format configuration for every human-facing business identifier the
platform generates — `studentCode`, `admissionNo`, and others.
`src/features/numbering`, wired from
`backend/postman/erp.postman_collection.json`'s "Numbering / Config" folder
and `backend/docs/planning/00-foundation/03-numbering.md` (design spec,
`Status: planned`).

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
| `POST /numbering/configs` | `purpose, prefix, suffix, includeBranchCode, includeAcademicYear, sequencePadding, format` — `scope`, `allocationMode` and `resetStrategy` are **not** accepted; the Postman example's own description states they are derived from `purpose` |
| `PATCH /numbering/configs/:id` | Same body, plus `isActive` — `purpose` is not editable |
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

## Editability is not exposed, so nothing is locked client-side

The design spec states a `NEVER`-reset sequence's `prefix`/`sequencePadding`
become immutable once it has issued its first value (design spec §5). No
field on `NumberingConfigDto` says whether that has happened
(`docs/backend-gaps.md` NUM2). Per AGENTS.md §28 ("a rule the UI can make
unexpressible beats a rule it validates" — inapplicable here, since there is
no confirmed signal to build that rule from at all), the Edit form leaves
every field editable and lets a rejected save surface the server's own
error, rather than guessing which fields are locked.

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

## Testing

`tests/mocks/numbering-handlers.ts` provides default CRUD + preview
handlers; `tests/integration/numbering.test.tsx` drives the directory
(list/search/empty/error/preview), create (documented-fields-only, format
validation, no Active toggle) and edit (purpose locked, `isActive` sent,
not-found handling) flows.
