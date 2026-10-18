# Documents Management Module

The generic, owner-polymorphic document module: what a `DocumentType` is,
which owners need which documents (`DocumentRequirement`), and the documents
themselves. `src/features/documents`, wired from
`backend/docs/planning/document-management-specification.md` (the R5 design
spec) and directly verified against `backend/postman/erp.postman_collection.json`'s
"Document", "Document Type" and "Document Requirement" folders.

Related: [Admission Masters Module](./admission-masters-module.md) ·
[Admission Lifecycle Module](./admission-lifecycle-module.md) ·
[Backend Contract Gaps](./backend-gaps.md)

This document covers what the **Documents Management** milestone added:
admin CRUD for Document Types and Document Requirements, the Documents
overview hub, and the corrections it made to the R5 foundation phase's
assumptions (`backend-gaps.md` DOC1/DOC2/DOC5/DOC6). It does not re-describe
the owner-document experience (upload, verify, reject, replace,
`ApplicantDocumentsPanel`) — that shipped in the R5 foundation phase and is
unchanged here beyond the `useDocumentRequirements()` fix below.

---

## Domain model

Four distinct concepts, never collapsed into one object:

```
DocumentType (config)              DocumentRequirement (config)
      |                                    |
      | 1                                  | references
      v                                    v
  Document ---------- currentVersionId -> DocumentVersion
      |  (ownerType, ownerId)                 |
      |  polymorphic                          1..n, append-only
      v
  Person | Applicant | Admission | Enrollment | Student | Organization | Branch
```

- **`DocumentType`** — the catalogue entry: code, name, sensitivity, expiry
  rule, retention, allowed MIME types, size limit, active status.
- **`DocumentRequirement`** — the rule that a document type must exist for a
  given branch × program × quota × category × workflow stage. Each
  `appliesTo*Id` is nullable, meaning "applies to all" (design spec §8).
- **`Document`** — one owner's instance of a type: current status, current
  version pointer.
- **`DocumentVersion`** — one uploaded file. Append-only; replacing a
  document creates a new version rather than overwriting the old one.

---

## Endpoints

| Endpoint | Note |
| --- | --- |
| `GET /document-types?includeInactive=` | `includeInactive` is the only documented query parameter, marked **Required** |
| `GET /document-types/:id` | |
| `POST /document-types` | `code, name, description, isSensitive, hasExpiry, defaultValidityMonths, retentionYears, allowedMimeTypes, maxSizeBytes, displayOrder` |
| `PATCH /document-types/:id` | Same body, plus `isActive` — full record, no partial-update rule documented |
| `DELETE /document-types/:id` | |
| `GET /document-requirements?branchId=` | `branchId` is the only documented query parameter, marked **Required** — supersedes the R5 foundation phase's `programId`/`quotaId`/`categoryId` assumption (DOC6) |
| `GET /document-requirements/:id` | |
| `POST /document-requirements` | `branchId, documentTypeId, appliesToProgramId, appliesToQuotaId, appliesToCategoryId, requiredByStage, isMandatory` — no `isActive` in the captured example |
| `PATCH /document-requirements/:id` | Same body, plus `isActive` — full record |
| `DELETE /document-requirements/:id` | |
| `GET /documents?ownerType=&ownerId=` | Both required |
| `POST /documents` | multipart: `ownerType`, `ownerId`, `documentTypeId`, `file` |
| `GET /documents/:id` | Named "with Its Version History" — response carries only `currentVersion`, not a `versions[]` array (DOC2) |
| `POST /documents/:id/replace` | multipart: `file` |
| `POST /documents/:id/verify` | No body |
| `POST /documents/:id/reject` | `reason` required, 3–500 chars |
| `POST /documents/:id/archive` | `reason` optional |
| `GET /documents/:id/download` | Streamed bytes, never a signed/public URL |

`DocumentType` response examples never include `displayOrder` in their field
list, though Create/Update both accept it (DOC5) — typed optional in
`DocumentTypeDto`; sorting falls back to `0` when absent.

---

## Two corrections to the R5 foundation phase

**1. `document-requirements` is filtered by `branchId`, not
`programId`/`quotaId`/`categoryId`.** The R5 foundation phase's
`useDocumentRequirements({ programId, quotaId, categoryId })` sent query
params the endpoint does not document. This milestone confirmed the real
contract directly against the Postman collection and rebuilt the hook:
`useDocumentRequirements()` now takes no arguments, fetches the complete
branch-scoped list (from `useDocumentsBranch()`, mirroring
`useAdmissionMastersBranch()`), and narrowing by program/quota/category
happened client-side via `matchesRequirementScope()` in `utils/checklist.ts`.

> **Superseded 2026-10-17.** That client-side matching ignored a
> requirement's branch, so the Applicant panel could list another branch's
> requirements. The panel now renders the backend's own checklist
> (`GET /admissions/applicants/:id/checklist`, the rules the workflow guards
> enforce), handed in by the route composition as plain data;
> `checklistFromServer()` only attaches the requirement and document records
> the rows need to act. `matchesRequirementScope()` and `buildChecklist()`
> were removed. See `docs/admission-lifecycle-module.md` §4.10.

**2. Admin CRUD for both configuration resources.** The R5 foundation phase
shipped `DocumentType` and `DocumentRequirement` as read-only — "a separate
'Document Masters' concern, out of this phase's scope." This milestone
confirmed full Create/Update/Delete for both directly against the Postman
collection's "Document Type" and "Document Requirement" folders and built
their directories, forms, detail screens (Document Type only — see below) and
delete/toggle-active dialogs.

---

## Screens

```
/app/documents                          → Overview hub
/app/documents/types                    → Document Types directory
/app/documents/types/new                → create
/app/documents/types/:id                → detail
/app/documents/types/:id/edit           → edit
/app/documents/requirements             → Document Requirements directory
/app/documents/requirements/new         → create
/app/documents/requirements/:id/edit    → edit
```

Document Requirements has no standalone detail route: every documented field
is already visible on the directory row (document, program, quota, category,
stage, mandatory, status), so "view" and "edit" are the same destination —
the same reasoning that keeps the directory's row click going straight to
Edit.

Both directories follow the Admission Masters shape exactly: the only
documented list filter (`includeInactive` / `branchId`) is fetched once, and
search/status/program/stage filtering, sorting and paging all run client-side
with a `BackendPendingNote` saying so.

---

## The three requirement-scope pickers are not `ProgramPicker`/`AdmissionMasterPicker`

`DocumentRequirement.appliesToProgramId`/`appliesToQuotaId`/`appliesToCategoryId`
are each nullable, meaning "applies to all" (design spec §8). `ProgramPicker`
and `AdmissionMasterPicker` both bind a *required* selection with no "applies
to all" affordance — correctly, since every other consumer of those two
pickers (Applicant create/edit) legitimately needs a real value.

Rather than add an "all" mode to two pickers every other caller must keep
treating as required, Documents ships its own generic
`OptionalSelectField` — a `SelectField` with a leading "applies to all"
sentinel option (`APPLIES_TO_ALL`), fed by pre-resolved `{value, label}[]`
options. The route composition
(`app/(app)/app/documents/documents-composition.tsx`) resolves those options
from Program's and Admission Masters' own list hooks
(`usePrograms`/`useAdmissionMasterList`) and passes them in — the same
"two features meet at the route, through slots" rule
`applicant-composition.tsx` follows (AGENTS.md §28). The `documents` feature
itself never imports Program or Admission Masters.

`requiredByStage` reuses `AdmissionApplicationStatus` directly rather than a
parallel enum (design spec §8); its thirteen options come from Admissions'
own `ADMISSION_APPLICATION_STATUSES`/`STATUS_LABEL`, passed into the form as
a plain `{value, label}[]` prop by the same composition file — Documents
never imports the Admissions feature either.

---

## Backend Pending

Marked with `BackendPendingNote`/`BackendPendingBadge` where a screen touches
them; tracked in full in [`backend-gaps.md`](./backend-gaps.md#documents):

- **A true multi-version history list.** `GET /documents/:id`'s name
  promises it; its response schema does not deliver it. The version-history
  UI described in the original design brief (§18) is not built.
- **Academic Unit as a fourth requirement axis.** The backend's
  `DocumentRequirement` model has no `academicUnitId` column — only
  `appliesToProgramId`/`appliesToQuotaId`/`appliesToCategoryId`. The form and
  table are built so this can be added as a fourth `OptionalSelectField`
  slot later without restructuring either.
- **Secure inline preview**, distinct from the download-and-save flow `GET
  /documents/:id/download` provides.
- **Virus/malware scanning status beyond the four documented `scanStatus`
  values**, OCR extraction, Aadhaar/DigiLocker verification, automatic
  expiry notifications, bulk verification, bulk upload, parent-side upload,
  digital signatures, checksum/integrity display, document comparison
  between versions, duplicate-document detection, and automated retention —
  none are documented anywhere in the collection or the design spec (§21's
  own `DEFERRED` list). Not built, and not stubbed with disabled UI, since no
  screen was ever designed around them.

---

## Testing

`tests/mocks/document-types-handlers.ts` and
`tests/mocks/document-requirements-handlers.ts` provide default CRUD
handlers; `tests/integration/document-types.test.tsx` and
`tests/integration/document-requirements.test.tsx` drive the directory,
create, edit, activate/deactivate and delete flows.
`tests/unit/document-checklist.test.ts` covers `checklistFromServer()` —
that it renders exactly the server's requirements, maps each status, and
attaches the right document — and `checklistSummary()`.
