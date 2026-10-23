# Admission Form Scanning (OCR)

The **New Admission** page can read a parent's filled paper admission form —
a PDF, a scan, or a phone photo forwarded on WhatsApp — and pre-fill the
Applicant Information form. Nothing is saved by scanning: the clerk reviews
every field and submits as usual.

## Engines

| Engine                        | Cost          | Works offline                   | Best for                                          |
| ----------------------------- | ------------- | ------------------------------- | ------------------------------------------------- |
| **Offline scanner** (default) | Free          | Yes — nothing leaves the server | The Shree Siddhi Vinayagar form; neat handwriting |
| **Claude vision** (optional)  | Paid per scan | No                              | Messy handwriting, any form layout                |

Chosen by `ADMISSION_OCR_ENGINE` in `frontend/.env.local` (read only by
`src/config/server-env.ts`):

- `auto` (default) — Claude when `ANTHROPIC_API_KEY` is set, otherwise the
  offline scanner. If the Claude _service_ fails (outage, rate limit, invalid
  key), the offline scanner reads the same form instead and the clerk is told.
- `offline` — always the offline scanner.
- `claude` — always Claude; fails if no key is set.

Neither engine ever substitutes sample data: an unreadable field stays empty
and is listed for the clerk under **Check carefully**.

## The offline scanner

Code: `src/features/admissions/ocr/`, server-only, exposed to the route
through `src/features/admissions/server.ts`.

1. **Pages** (`load-pages.ts`). A digital PDF's text layer is read directly
   with pdf.js — exact and instant (~0.5 s). A scanned PDF page is rendered at
   ~200 dpi; photos are decoded with sharp (EXIF-rotated). Up to 3 files: one
   PDF, or one photo per page.
2. **OCR** (`paddle-ocr.ts`). PaddleOCR PP-OCRv4 detection + recognition run
   locally with ONNX Runtime. Models (Apache-2.0, ~16 MB) come from the
   `@gutenye/ocr-models` package; recognition only lets printable ASCII win.
   Digits written one per box (DOB, Aadhaar, mobile, PIN) are read by a
   dedicated reader that paints the box borders out and reads the row as one
   line, keeping only a reading with a valid length.
3. **Template** (`ssv-form-template.ts`). Every field is anchored to its
   **printed label**, never to page coordinates, so printed copies, the
   digital form and imperfect photos all work. A value is read from below
   (or right of) its label up to the next label in the row; ticks are read
   from the ✓ glyph (PDF) or the ink inside the checkbox (photo). To support
   a revised form, edit the label keys there.
4. **Extraction** (`extract-form.ts`) produces the same `AdmissionOcrResult`
   as Claude; the date of birth is cross-checked against the date in words.
5. **Normalisation** (`normalise-result.ts`, both engines) blanks and flags
   any Aadhaar / mobile / PIN / DOB without a valid shape.

### Measured accuracy

On the 50 sample forms in the repository (`filled_admission_forms`,
`10_new_admission_forms`, `new_admissions_batch_2`):

Offline scanner on photos (each form's 2 pages rendered at 200 dpi, as a
scanner would produce), compared field by field with the exact text layer;
average ~9 s per form on a Core i3 laptop. Digital PDFs: all 50 read with
every required field present (~0.5 s each).

| Field             | Correct        | Blank, flagged | Wrong, flagged | Wrong, **not** flagged |
| ----------------- | -------------- | -------------- | -------------- | ---------------------- |
| First name        | 46             | 0              | 3              | 1                      |
| Middle name       | 46             | 0              | 2              | 2                      |
| Last name         | 47             | 0              | 3              | 0                      |
| Date of birth     | 45             | 5              | 0              | 0                      |
| Place of birth    | 49             | 0              | 1              | 0                      |
| Aadhaar           | 31             | 17             | 2              | 0                      |
| APAAR ID          | 45             | 0              | 5              | 0                      |
| Specially abled   | 50             | 0              | 0              | 0                      |
| Primary mobile    | 27             | 17             | 6              | 0                      |
| Alternate mobile  | 39             | 11             | 0              | 0                      |
| Email             | 29             | 8              | 13             | 0                      |
| Address line 1    | 20             | 0              | 26             | 4                      |
| Address line 2    | 40             | 0              | 10             | 0                      |
| City              | 49             | 0              | 1              | 0                      |
| State             | 50             | 0              | 0              | 0                      |
| Country           | 50             | 0              | 0              | 0                      |
| PIN code          | 17             | 33             | 0              | 0                      |
| Previous school   | 24             | 0              | 25             | 1                      |
| Board             | 47             | 0              | 2              | 1                      |
| Last class        | 39             | 0              | 9              | 2                      |
| % / grade         | 35             | 0              | 7              | 8                      |
| TC no.            | 39             | 0              | 10             | 1                      |
| Transport         | 50             | 0              | 0              | 0                      |
| Gender            | 41             | 9              | 0              | 0                      |
| Religion          | 48             | 0              | 0              | 2                      |
| Caste             | 46             | 0              | 3              | 1                      |
| Category          | 47             | 0              | 2              | 1                      |
| Mother tongue     | 45             | 0              | 4              | 1                      |
| Blood group       | 41             | 4              | 4              | 1                      |
| Class applied for | 35             | 1              | 13             | 1                      |
| **All fields**    | **1217 (81%)** | 105            | 151            | **27 (1.8%)**          |

Digital PDFs are read exactly. "Wrong & not flagged" is the number to watch:
those are the only values the clerk is not prompted to check. Real
handwriting and skewed phone photos will do worse than these clean renders —
ask parents for a straight, well-lit photo of each page, or use a scanner app.

### Limits

- Only the Shree Siddhi Vinayagar form layout is supported offline (an upload
  with fewer than 8 of its printed labels is rejected). Claude reads any form.
- Photos are not perspective-corrected; strongly tilted photos lose fields.
- A PDF from a scanner app that adds its own text layer is read from that
  layer.
- First scan after a server start loads the models (~1–2 s); a photo-based
  form then takes ~10–15 s on a modest laptop.

## Parents added as guardians on save

The scan also reads the parents' table (name, mobile, occupation, Aadhaar,
annual family income). When the clerk saves the new applicant — and leaves
**Add as guardians when saving** ticked — each parent is:

1. **Reused** if a guardian in the branch already has the same mobile and
   first name (a sibling's parent), otherwise **created** with the family's
   residential address from the form (titles such as "Dr." / "Smt." are
   stripped; an Aadhaar without 12 digits is dropped).
2. **Linked** with the branch's **Father** / **Mother** relation type. The
   first parent is primary and financial guardian (and carries the family
   income); both are emergency contacts allowed to pick up.

A parent without a 10-digit mobile, or a branch without Father / Mother
relation types (add them under Admission Masters), produces a warning
instead; the applicant is always saved first, and a guardian failure never
undoes it. Code: `scanned-guardians.ts` (pure plan) and
`useAddScannedGuardians` in `applicant-composition.tsx` — the route is where
Admissions and Guardians meet (AGENTS.md §28).

## Bulk entry from one PDF

**Admissions → Applicants → Bulk entry from PDF**
(`/app/admissions/applicants/import`). The office scans a whole bundle of
filled forms into one PDF (up to 80 pages / 40 MB); each student is read and
listed in a review queue while the rest is still being read.

- **Splitting** (`ocr/page-kind.ts`, `ocr/read-batch.ts`): every page carrying
  the form's page-1 labels starts a new student; the page-2 that follows is
  attached. Any other page (cover sheet, attached certificate) is skipped and
  reported. Bulk entry always uses the offline reader.
- **Streaming**: `POST /api/admissions/ocr/batch` returns newline-delimited
  JSON `AdmissionBatchEvent`s (`start`, `progress`, one `form` per student,
  `done`); `useBulkScan` renders them as they arrive. Leaving the page stops
  the read.
- **Queue** (`BulkImportScreen`): **Ready** = every required field read, no
  doubtful field, no default used; **Needs check** lists exactly what to look
  at. _Review & save_ opens the normal applicant form pre-filled in a side
  panel; _Save all ready_ saves the Ready rows one by one. Every save also adds
  the parents as guardians.
- Measured: a digital 10-student PDF is read in ~2 s, 30 students (60 pages)
  in a few seconds; scanned bundles take ~10 s per student.

## Master fields: matched or defaulted

The route's resolver (`useOcrMasterResolver`) matches the scanned gender,
religion, caste, category, mother tongue, blood group, programme and admission
source (now read from the form's tick boxes) to the branch's records. When a
label matches nothing, it **fills a sensible default** (e.g. the first gender,
"Walk-in") so the clerk has less to pick — but every defaulted field is
reported (`defaulted`) and shown as **"Default used — confirm"** in the
scanner and as **Needs check** in the bulk queue, so a default is never saved
unseen by "Save all ready".

## Route

`POST /api/admissions/ocr` (`src/app/api/admissions/ocr/route.ts`) —
multipart `file` fields (≤ 3, ≤ 10 MB each, JPG/PNG/WebP/PDF). Requires a
CampusFlow bearer token, checked against the backend's `GET /auth/me`.
Returns `{ result, engine, notices }` (`AdmissionOcrResponse`).

Native packages (`onnxruntime-node`, `sharp`, `@napi-rs/canvas`, `pdfjs-dist`)
are listed in `serverExternalPackages` in `next.config.ts`.

## UI

`AdmissionOcrUploader` renders inside `ApplicantForm` (its `header` slot) and
fills fields with `setValue`, so anything the clerk already typed survives.
Gender, religion, category, mother tongue, blood group and programme labels
are resolved to the branch's master records by the route composition
(`applicant-composition.tsx`); unmatched labels are listed for manual
selection.
