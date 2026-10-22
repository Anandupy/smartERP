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
