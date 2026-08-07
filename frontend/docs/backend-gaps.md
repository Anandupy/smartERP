# Backend Contract Gaps

Everything the administration modules could not wire, and exactly what is
missing. Compiled from `backend/docs/modules/system-settings.md`,
`backend/docs/modules/maintenance.md`, `backend/docs/core/audit.md` and the
Postman collection — no backend source was read.

Each entry states what the frontend does **today**, so nothing is blocked
waiting on an answer. Searching the source for `BACKEND_PENDING_LABEL` finds
every place this document is reflected in the UI.

---

## A. Missing response bodies

**The single largest gap.** The Postman collection records a response _status_
for every request in these three modules and a response **body for none of
them** — every `body` field is `""`.

For most endpoints this is survivable: the module docs describe the data
structure (`SystemSettings` fields, the `MaintenanceRule` table, the `AuditLog`
columns), and the platform's envelope is documented in
[Response Handling](./response-handling.md), so the read shape can be
transcribed rather than guessed.

For **three** endpoints it is not survivable, because they return something the
data-structure tables do not describe:

| Endpoint                               | What is undocumented                                       | What the frontend does now                                                         |
| -------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /maintenance-rules/active/status` | The whole resolved-status payload                          | Typed `unknown`; `readActiveStatus` reads known rule fields, else reports pending  |
| `GET /audit-logs/summary`              | The grouped distribution shape                             | Typed `unknown`; `readSummary` accepts four plausible shapes, else reports pending |
| `GET /audit-logs/timeline`             | The daily series **and** the "recent timeline events" list | Typed `unknown`; `readTimeline` reads the daily series, else reports pending       |

> **Needed:** one example response body per endpoint. That alone closes most of
> this document.

---

## B. System Settings

Endpoints wired: `GET`, `PATCH`, `POST /init`. The eight documented fields are
all wired.

| #   | Gap                                                                                                                                                                                                       | Impact                                                                 | Current behaviour                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **No record identity or audit metadata.** The data structure has no `id`, `createdAt`, `updatedAt` or "last changed by".                                                                                  | The design's per-section "Last updated · By" captions cannot be wired. | Captions omitted rather than faked. Change history is available via Audit instead.                                                      |
| B2  | **`PATCH` optionality unspecified.** Postman sends the full body; the docs state no partial-update rule.                                                                                                  | Unknown whether a subset is accepted.                                  | Every write sends the **complete** documented body, reconstructed from the loaded record plus the edits.                                |
| B3  | **No validation rules.** No lengths, formats or patterns; `productCode` is "unique" with no stated shape.                                                                                                 | Client-side rules would be invented.                                   | Schemas assert only the documented types and the one documented enum. Server `fieldErrors` bind to fields via `applyServerFieldErrors`. |
| B4  | **Branding & Identity has no backend at all.** No logo, favicon, icon or colour field; no upload endpoint anywhere in the module docs or Postman.                                                         | The whole screen is unwireable.                                        | Ships as layout with every control disabled and a `Backend Pending` banner. No field names invented.                                    |
| B5  | **No localization fields.** The design's General Settings shows default language, timezone, currency and date format. None exist in the contract.                                                         | Cannot be wired.                                                       | Omitted from the screen entirely rather than shown disabled — see note below.                                                           |
| B6  | **No security-policy fields.** The design shows a Security Policies section (2FA, session timeout, IP allowlisting). None exist in the contract.                                                          | Cannot be wired.                                                       | Omitted.                                                                                                                                |
| B7  | **No infrastructure or health contract.** System Information's uptime, build id, deployment region, database latency, node inventory and license tier have no documented endpoint in these three modules. | Cannot be wired.                                                       | Section ships with a `Backend Pending` marker naming each missing metric. No plausible numbers rendered.                                |
| B8  | **RBAC mechanism ambiguous.** The module doc says SUPER_ADMIN is "simulated via `x-role: SUPER_ADMIN` header"; the rest of the platform is JWT/`RolesGuard`.                                              | Unclear whether a header is still required.                            | No `x-role` header is sent. If one is required, it belongs in `headerRegistry` — a one-line addition, no refactor.                      |

> **On B5/B6:** these are omitted rather than shown as disabled fields, because
> a disabled field implies a value that exists and is merely uneditable.
> Branding (B4) _is_ shown disabled, because the user explicitly asked for that
> screen and its absence would be the more confusing outcome.

---

## C. Maintenance

All five CRUD endpoints wired. Every field in both the docs table and the
Postman body is on the form.

| #   | Gap                                                                                                                                                                                                                                                                                                                                                    | Impact                                            | Current behaviour                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Docs/Postman mismatch — 12 fields.** The Postman create and update bodies carry `title`, `shortMessage`, `description`, `reason`, `estimatedCompletion`, `maintenanceWindow`, `supportContact`, `bannerColor`, `severity`, `maintenanceIcon`, `announcementLink`, `externalStatusPageUrl`. **None appear in the module doc's data-structure table.** | Unknown whether they are persisted or returned.   | Sent (Postman is the request contract); typed **optional** on read, since the table does not promise them.                                                                                                          |
| C2  | **`severity` has no value set.** The only recorded sample is `"INFO"`.                                                                                                                                                                                                                                                                                 | An enum cannot be offered.                        | A free-text field, labelled as such. The notice banner deliberately does **not** colour by severity — inventing a CRITICAL/WARNING ladder would mean colouring real notices by a scale the backend never agreed to. |
| C3  | **`startAt` / `endAt` serialization unconfirmed.** Typed `DateTime?`; the Postman sample is the generator placeholder `"Sample Value"`.                                                                                                                                                                                                                | Wire format is a guess.                           | ISO-8601 is sent, in one function (`toIso`) — the single line that changes if it is wrong.                                                                                                                          |
| C4  | **`estimatedCompletion` type unknown.** A string in Postman, absent from the docs table.                                                                                                                                                                                                                                                               | Cannot tell a timestamp from free text.           | Treated as free text.                                                                                                                                                                                               |
| C5  | **`bypassRoles` vocabulary undocumented.** Samples show `DEVOPS`, `SYSTEM_ADMIN`; the platform's documented roles elsewhere are `SUPER_ADMIN`/`ORG_ADMIN`/`BRANCH_ADMIN`/`STAFF`/`STUDENT`/`PARENT`.                                                                                                                                                   | No select can be offered.                         | Comma-separated free text → the documented JSON array.                                                                                                                                                              |
| C6  | **The list endpoint documents no query parameters.** No `page`, `limit`, `search`, or filters.                                                                                                                                                                                                                                                         | Server-side narrowing is impossible.              | Search, filter and paging run **in the client** over the full list. The screen states this on the page. Suitable for a rules table; would not be for a log.                                                         |
| C7  | **No enumeration of valid module / feature names.** `scopeType: MODULE \| FEATURE` needs a `scopeId` the guard matches on, with no endpoint listing the legal values.                                                                                                                                                                                  | A typo silently produces a rule that never fires. | Free text with an example. `ORGANIZATION` and `BRANCH` scopes _do_ offer real options, from `useWorkspace()`.                                                                                                       |
| C8  | **`customStatus` has no documented default or constraint.** The table gives examples (503, 423) and no range.                                                                                                                                                                                                                                          | —                                                 | Defaults to the documented example 503; validated only as a syntactic HTTP status (100–599).                                                                                                                        |

---

## D. Audit Logs

The **query** contract is fully documented and fully wired: pagination, four
sort fields, fifteen filters, keyword search, `includeDetails`. No client-side
filtering anywhere in this module.

| #   | Gap                                                                                                                                                                                                                                         | Impact                                            | Current behaviour                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Filterable fields absent from the record.** `severity`, `status`, `executionTime`, `traceId`, `correlationId`, `httpMethod` and `route` are all documented as filters and sorts, but none is a column in the documented `AuditLog` table. | Unknown whether they are ever returned.           | Typed optional; rendered in the detail drawer **only when present**, rather than as a column of em dashes implying the backend reported nothing.                                                                                                                                                   |
| D2  | **`sortBy` mismatch.** The docs give the enum `timestamp \| severity \| module \| executionTime`. The Postman sample sends `createdAt`, which is not in it.                                                                                 | One of the two is wrong.                          | The **documentation** is followed; `createdAt` is never sent.                                                                                                                                                                                                                                      |
| D3  | **No value set for `severity` or `status`.** Both are filterable; neither has documented values.                                                                                                                                            | No filter controls can be offered for them.       | Filters omitted; the values are displayed when returned. `action` and `module` _do_ have documented vocabularies and are offered.                                                                                                                                                                  |
| D4  | **Pagination meta key unconfirmed.** The query uses `limit`; the platform envelope's `meta.pagination` is `{page, pageSize, total, totalPages}`. Whether audit echoes `pageSize` or `limit` is unstated.                                    | A mismatch silently breaks the page-size control. | Reads `meta.pagination` per the platform contract. **Worth confirming.**                                                                                                                                                                                                                           |
| D5  | **No export endpoint.** The API documents list, summary, timeline and detail — nothing else.                                                                                                                                                | Export cannot be wired.                           | The dialog ships and states which records an export _would_ cover, from the live query. Generating a CSV from the loaded page was deliberately rejected: it would export one page of a set the user believes they are exporting in full, which for an audit trail is worse than exporting nothing. |

---

## E. Organizations

All five documented endpoints are wired. The entity's fourteen request fields
are all on the form.

| #   | Gap                                                                                                                                                            | Impact                                                                      | Current behaviour                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **No response body documented** for any of the five endpoints — every Postman `body` is `""`.                                                                  | The read shape is the documented Data Structure only.                       | Transcribed from that table. `id` is the one field taken from an endpoint (`/:id`) rather than the table.                                                |
| E2  | **The list endpoint returns active organizations only**, and documents no parameter to widen it.                                                               | A platform-wide total, and any inactive or suspended count, are unknowable. | No screen reports one. The dashboard tile says "Listed"; the directory's inactive filter explains why it returns nothing.                                |
| E3  | **No query parameters on the list** — no `page`, `limit`, `search`, `sortBy` or filters.                                                                       | Server-side querying is impossible.                                         | Search, filter, sort and paging run in the client, and the directory says so on the page.                                                                |
| E4  | **`status` has no write path.** It is a documented field of the entity and of neither request body, and no endpoint sets it.                                   | `SUSPENDED` is unreachable; a deactivation cannot be reversed.              | No status control anywhere. The lifecycle screen marks suspend and reactivate as pending.                                                                |
| E5  | **No lifecycle beyond create and soft-delete.** The design's Draft and Expired stages have no status value and no endpoint; permanent deletion does not exist. | Three of five stages are unreachable.                                       | The timeline renders all five and marks each unsupported stage with its reason.                                                                          |
| E6  | **Whether expiry changes status is undocumented.** `masterExpiryDate` is a documented field; no rule connects it to `status`.                                  | An expired tenant's real state is unknown.                                  | Expiry is shown as a **date**, in its own banner, never as a status. The copy states the status is unchanged.                                            |
| E7  | **`masterExpiryDate` format is ambiguous.** Typed `DateTime`; the Postman sample sends `"2030-12-31"`.                                                         | Wire format is a judgement call.                                            | The sample wins — a date input, sent as `YYYY-MM-DD`. Reads tolerate a full ISO timestamp.                                                               |
| E8  | **No validation rules beyond one.** `code` is documented "unique slug-safe lowercase"; nothing else has a length, pattern or vocabulary.                       | Client rules would be invented.                                             | Only the slug rule is asserted. Uniqueness is left to the server — the list is active-only, so a client check would miss codes held by inactive records. |
| E9  | **No logo upload endpoint.** `logoUrl` is a documented string; nothing accepts a file.                                                                         | The design's drop-zone is unwireable.                                       | A URL field with a pending note, rather than a control with nowhere to send a file.                                                                      |
| E10 | **No export, bulk actions, or organization "type".** The design shows all three; none is in the contract.                                                      | Cannot be wired.                                                            | Export is rendered disabled; bulk actions and the type column are omitted.                                                                               |
| E11 | **No branch or student counts, stakeholders, tax id or licence tier** on the entity.                                                                           | The design's detail panels cannot be filled.                                | Omitted rather than shown empty.                                                                                                                         |

> **On E2 + E4 together:** these compound. Deactivating an organization removes
> it from the only list endpoint, and nothing can reactivate it — so from the
> frontend's point of view a deactivation is currently irreversible _and_
> invisible. The dialog says so. A documented way to list or restore inactive
> organizations would resolve both.

---

## F. Branches

All seven documented endpoints are wired. The seventeen request fields and
three enums are all documented.

| #   | Gap                                                                                                                                                                        | Impact                                                                                                | Current behaviour                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **No response body documented** for any of the seven endpoints.                                                                                                            | The read shape is the documented Data Structure plus the request fields.                              | Transcribed. `isActive` / `isDeleted` are typed optional, because it cannot be assumed they are returned.                                                            |
| F2  | **The two branch documents disagree.** `branch.md` has no Data Structure table and lists 5 endpoints; `branch-settings.md` has the table and lists 7. Neither is complete. | A reader of either one alone gets an incomplete contract.                                             | Both are transcribed; the union is the module's contract. **`branch-settings.md` should be renamed** — it documents the entity, not settings.                        |
| F3  | **No query parameters on any endpoint** — list, by-organization, or otherwise.                                                                                             | Server-side querying is impossible.                                                                   | Search, filter, sort and paging run in the client; the directory says so.                                                                                            |
| F4  | **The status toggle has no request body.** No `Content-Type`, no body, while every other `PATCH` has both.                                                                 | A target state cannot be requested — the call flips whatever `isActive` is, making it non-idempotent. | Sent bodyless. Confirmed before firing with the resulting state named, never retried, never optimistic, and **withheld entirely** when the current state is unknown. |
| F5  | **`isActive`/`isDeleted` are booleans, not a status enum.**                                                                                                                | The design's "Archived" stage has no field and no value.                                              | The lifecycle marks it pending rather than mapping it onto `isActive`.                                                                                               |
| F6  | **No permanent deletion.** Soft delete only.                                                                                                                               | The design's "Initiate Permanent Deletion" cannot be wired.                                           | Rendered disabled and marked.                                                                                                                                        |
| F7  | **Optionality unstated** for `registrationNumber`, `affiliationType`, `affiliationName` and `institutionType`. Only `logoUrl` is explicitly "Optional".                    | Required-ness is a judgement call.                                                                    | Read from the qualifying wording ("if provided", "can be affiliated"). `institutionType` and `structureMode` are treated as required with documented defaults.       |
| F8  | **No `id`, `createdAt` or `updatedAt`** in either Data Structure.                                                                                                          | No created/updated captions.                                                                          | `id` is taken from the `/:id` endpoints. Timestamps are omitted; change history comes from the audit trail.                                                          |
| F9  | **No counts.** Student, faculty and programme totals belong to other modules, with no branch-scoped endpoint documented.                                                   | The design's three headline tiles cannot be filled.                                                   | Omitted; the dashboard counts only what the branches endpoint returned.                                                                                              |
| F10 | **No uptime, latency or node health.**                                                                                                                                     | The design's "99.8% uptime / 42ms" panel has no source.                                               | Declared as pending rather than estimated.                                                                                                                           |
| F11 | **The parent organization is an id only.** No expansion is documented.                                                                                                     | A branch cannot show its organization's name.                                                         | The id is shown and linked, with the gap noted.                                                                                                                      |

### F12 — Branch Settings does not exist

The largest gap in this milestone, and worth stating separately.

**No endpoint anywhere in the collection has `settings` in its path under
`/branches`.** Every documented branch endpoint operates on the branch record.
`backend/docs/modules/branch-settings.md`, despite the filename, documents the
entity.

Missing entirely, for all five design sections:

| Missing                | Detail                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Settings entity**    | No resource, no id, no shape.                                                                                                                                                                                                                                                                                                                |
| **Endpoints**          | No read, no write, no reset-to-defaults.                                                                                                                                                                                                                                                                                                     |
| **Request contracts**  | No body for any section.                                                                                                                                                                                                                                                                                                                     |
| **Response contracts** | Nothing to type against.                                                                                                                                                                                                                                                                                                                     |
| **Validation rules**   | No lengths, formats, ranges or vocabularies.                                                                                                                                                                                                                                                                                                 |
| **Fields**             | Working hours, holiday calendar, locale/date/currency format, grading system, passing threshold, academic cycle, attendance policy and thresholds, biometric integration, email/SMS gateway, sender identity, push notifications, SSO, IP allowlist, session timeout, encryption standard, LMS provider and sync, API credentials, webhooks. |

The frontend ships all five screens as layout with the existing Backend Pending
components and **no service layer at all** — no DTO, no schema, no mutation, no
fake service method. History is the exception: it is the audit trail, and is
fully wired.

---

## G. Academic Years

All eight documented endpoints are wired. The four request fields and the three
state flags are all documented; the five validation rules are all honoured.

Compiled from `backend/docs/modules/academic-year.md` and the Postman
collection. The module doc and the collection **agree everywhere** — every gap
below is an absence in both, not a disagreement between them.

| #   | Gap                                                                                                                                                                                                                     | Impact                                                                                                       | Current behaviour                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **No response body documented** for any of the eight endpoints — every Postman `body` is `""`. There is also **no Data Structure table**; the three flags are described in prose under "States".                        | The read shape is the four request fields plus the three prose flags.                                        | Transcribed. All three flags typed **optional**; an absent flag renders "Not reported", never "No". `id` is the one field taken from an endpoint (`/:id`) rather than a table.        |
| G2  | **No `GET /academic-years/:id`.** Eight endpoints are documented and a read-by-id is not among them, though five of them take an `:id`.                                                                                 | A single record cannot be fetched. Detail, edit and lifecycle screens have no read endpoint.                 | The record is resolved out of the documented branch list. So viewing one year requires an active branch, "not found" means *not in this branch's list*, and there is no per-record refetch. |
| G3  | **No inverse for any lifecycle transition.** `activate`, `select` and `lock` are documented; **deactivate, deselect, unlock and restore are not.**                                                                      | The lifecycle is a one-way ratchet. Locking is unrecoverable, and a deletion cannot be undone.               | All four are listed by name on the lifecycle screen as `Backend Pending`, and every confirmation states that the action cannot be undone before it fires.                              |
| G4  | **Whether rule 4 covers the lifecycle endpoints is unstated.** "Locked academic years cannot be modified or deleted" — but the three transitions are separate endpoints, and none is explicitly named as blocked.       | Unclear whether `select` on a locked year is legal.                                                          | All three are **withheld** on a locked year — the conservative reading. If they are in fact allowed, removing the guard is a one-line change in `lifecycleActions`.                   |
| G5  | **No `isDeleted` field**, despite a documented soft delete.                                                                                                                                                             | A deleted year has no flag to read, so the frontend cannot show one, and cannot tell whether the list omits them. | The lifecycle marks Deleted as reachable but **not observable**. No dashboard figure is reported as a total, because it is unknown whether deleted years are included.                |
| G6  | **The list endpoint documents no query parameters** beyond the required `branchId`, which identifies the branch rather than narrowing the result. No `page`, `limit`, `search`, `sortBy` or status filter.               | Server-side querying is impossible.                                                                          | Search, filter, sort and paging run **in the client** over the branch's full list. The directory states this on the page.                                                              |
| G7  | **No cross-branch listing.** Every read is scoped to one branch, and no endpoint returns years for an organization or for the platform.                                                                                 | There is no "all academic years" view, and none can be built.                                                | Every screen is branch-scoped and says so. Without an active branch, each renders a "No active branch" state rather than an empty list.                                                |
| G8  | **No response documented for a branch with no current year.** `GET /academic-years/current` records a 200 and an empty body; no status code is stated for the empty case.                                               | Cannot distinguish "none selected" from a failure.                                                           | A `404` is read as **none selected** and surfaced as `null`; any other failure is still an error. If the backend returns `200` with `null` instead, that already works.                |
| G9  | **No initial flag values for a non-first year.** Auto-selection is documented only for the **first** year created for a branch; what `isActive`/`isSelected` are for a later one is unstated.                            | The state a newly created year lands in is unknown.                                                          | Nothing is assumed — the list is re-read after a create. The "Created" lifecycle stage names the auto-selection rule and states that later years are undocumented.                     |
| G10 | **No date format declaration.** `startDate`/`endDate` are typed nowhere; the only samples are `"2025-04-01"` and `"2026-03-31"`.                                                                                        | The wire format is read from two samples.                                                                    | `YYYY-MM-DD` is sent, from native date inputs. Reads tolerate a full ISO timestamp in one function (`toDateInputValue`) — the single line that changes if it is wrong.                |
| G11 | **No `name` format, length or uniqueness rule.** The only sample is `"2025-26"`.                                                                                                                                        | A client rule would be invented.                                                                             | None imposed beyond non-empty. Server `fieldErrors` bind to fields via `applyServerFieldErrors`.                                                                                       |
| G12 | **No error contracts.** No documented code, status or message for an overlap rejection, a locked-record write, deleting the selected year, or a duplicate name.                                                         | The UI cannot pre-empt a specific failure or map it to a field.                                              | Failures surface through the normalized `ApiError` and `getErrorMessage`. The overlap rule is additionally checked client-side as a courtesy — see G13.                               |
| G13 | **Overlap validation cannot be fully checked client-side**, because the list may not contain every year (G5).                                                                                                           | A client check can produce a false negative.                                                                 | `findOverlappingYear` warns in a banner and never blocks submission; the copy says the server decides.                                                                                 |
| G14 | **No calendar events of any kind.** No terms, semesters, holidays, non-instructional days, exam windows, admission windows, events or milestones — no field, no endpoint, nothing.                                      | The design's academic calendar has no data source beyond two dates.                                          | The timeline plots the documented spans and today's position. The five missing sections are enumerated by name as `Backend Pending`, and **no empty month grid is rendered**.          |
| G15 | **No audit events for the three transitions.** The audit event map documents `academic_year.created`, `.updated` and `.deleted` only.                                                                                   | Activating, selecting or locking a year leaves no trail.                                                     | The trail is wired and honest about what it contains. Nothing is synthesised to fill the gap.                                                                                          |
| G16 | **No `createdAt`, `updatedAt` or authorship.** No data structure table at all.                                                                                                                                          | No created/updated captions.                                                                                 | Omitted rather than faked. Change history comes from the audit trail.                                                                                                                  |
| G17 | **The branch is an id only.** No expansion is documented.                                                                                                                                                               | A year cannot show its branch's name.                                                                        | The id is shown and linked, with the gap noted.                                                                                                                                        |
| G18 | **No year-scoped counts.** Enrolled students, classes, academic units and exam schedules all reference an `academicYearId`, but no endpoint returns them per year.                                                      | The design's per-year detail panels cannot be filled.                                                        | Omitted rather than shown empty.                                                                                                                                                       |

### G19 — the scope header names disagree with the frontend

Not a gap in the backend contract but a **mismatch between it and this
codebase**, found while wiring this module and recorded here because it affects
every scoped request, not just academic years.

The backend documents the scope headers unanimously — `backend/docs/core/context.md`
("Priority 1: Header Resolution"), `execution-context.md`, `guard-pipeline.md`,
`academic-year.md`, and **18 requests in the Postman collection**:

| Backend documents    | `src/constants/headers.ts` sends | Verdict     |
| -------------------- | -------------------------------- | ----------- |
| `X-Organization-Id`  | `X-Tenant-Id`                    | ✗ mismatch  |
| `X-Branch-Id`        | `X-Branch-Id`                    | ✓ agrees    |
| `X-Academic-Year-Id` | `X-Academic-Year`                | ✗ mismatch  |

Two of the three scope headers the platform sends are therefore names the
backend does not read. Per its documented resolution algorithm it falls back to
**Priority 2, automatic resolution** — which silently produces the right answer
for a user with exactly one organization, branch and year, and a `409
CONTEXT_SELECTION_REQUIRED` for a `SUPER_ADMIN` or `ORG_ADMIN` who has more than
one. That is consistent with a workspace selection appearing to be ignored.

**This has not been changed.** It is a platform seam
([AGENTS.md §27](../AGENTS.md#27-workspace-scope), [Workspace](./workspace.md)),
not an academic-year concern, and renaming it is a one-line edit in
`headers.ts` plus its documentation — worth doing deliberately rather than as a
side effect of a feature commit. Academic Year is unaffected either way: its
endpoints are documented as **bypassing** academic-year context, and it passes
`branchId` explicitly as the documented query parameter.

> **Needed:** confirmation of the three wire names, then a one-line change.

---

## H. Programs

All seven documented endpoints are wired. The six request fields are all on the
form and all four validation rules are honoured.

Compiled from `backend/docs/modules/program.md` and the Postman collection.
Unlike Academic Year, these two sources **disagree** — see H1.

| #   | Gap                                                                                                                                                                              | Impact                                                                        | Current behaviour                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **Docs/Postman mismatch — `level`.** It is in both request bodies and in **no part** of the module doc, including its uniqueness rule. The single recorded value is `"SCHOOL"`.  | Unknown whether it is persisted, returned, or constrained to a value set.      | **Sent** (Postman is the request contract); typed **optional** on read. Rendered as **free text**, not a dropdown — one sample is not an enum.                 |
| H2  | **No response body documented** for any of the seven endpoints, and **no Data Structure table** at all. The doc is prose plus an endpoint table.                                  | The read shape is the request fields plus `isActive`, which the toggle implies. | Transcribed. `isActive` typed optional; an absent flag reads "Unknown", never "Inactive".                                                                       |
| H3  | **`GET /programs/tree` is documented by name only** — one table row, no response body, no nesting key, no envelope.                                                              | Its shape cannot be typed.                                                     | Typed `unknown`. `readProgramTree` accepts four plausible shapes and reports `isUnrecognized` otherwise. **Nothing depends on it**: the hierarchy is built from the flat list via `parentId`. |
| H4  | **The status toggle has no request body.** No `Content-Type`, no body, while create and update have both.                                                                        | A target state cannot be requested — the call flips `isActive`, so it is non-idempotent. | Sent bodyless. Confirmed before firing with the resulting state named, never retried, never optimistic, and **withheld** when the current state is unknown.    |
| H5  | **No `isDeleted` field**, despite a documented soft delete.                                                                                                                     | Cannot tell whether the list excludes deleted programs.                       | No dashboard figure is reported as a total. An orphaned child names its missing parent rather than being promoted to a root.                                    |
| H6  | **No query parameters** beyond the required `branchId`, which identifies the branch rather than narrowing the result. No `page`, `limit`, `search`, `sortBy` or filters.        | Server-side querying is impossible.                                            | Search, filter, sort and paging run **in the client**. The directory states this on the page.                                                                  |
| H7  | **No cross-branch listing.** No endpoint returns programs for an organization or the platform.                                                                                   | There is no "all programs" view, and none can be built.                       | Every screen is branch-scoped and says so.                                                                                                                     |
| H8  | **No value set, format or length for `level`, `medium` or `stream`.** Samples only: `"SCHOOL"`, `"English"`, `"Science (PCM)"`.                                                  | Client rules would be invented.                                                | None imposed. The directory's level filter is built from the values the branch actually returned.                                                              |
| H9  | **No optionality statement for any field.** Nothing is marked required or optional in either source.                                                                             | Required-ness is a judgement call.                                             | Read from the concept and rule 1: `name` required; `level`, `medium`, `stream`, `parentId` optional. Server `fieldErrors` bind via `applyServerFieldErrors`.   |
| H10 | **No error contracts.** No documented code, status or message for a uniqueness collision, a cross-branch parent, a circular parent, or a blocked delete.                         | The UI cannot map a failure to a field.                                        | Failures surface through the normalized `ApiError`. Rules 2 and 3 are made unexpressible by the controls; rules 1 and 4 are checked client-side as a courtesy. |
| H11 | **Uniqueness cannot be fully checked client-side** (H5), and **rule 4's "active child" is unverifiable** when `isActive` is not returned (H2).                                   | Both client checks can produce a false negative.                               | Rule 1 warns in a banner and never blocks. Rule 4 counts only children whose flag is **explicitly true** — an absent flag is not evidence of an active child.  |
| H12 | **No `program.*` audit event.** The audit event map documents `ACADEMIC` events for `academic_year.*` and `academic_unit.*` only.                                                | Program changes leave no trail.                                                | The `ACADEMIC` trail is shown, and the screens state that program changes may not appear in it.                                                                |
| H13 | **No `createdAt`, `updatedAt` or authorship**, and no `id` in any data structure.                                                                                               | No created/updated captions.                                                   | Omitted rather than faked. `id` is taken from the `/:id` endpoints.                                                                                            |
| H14 | **The branch is an id only.** No expansion documented.                                                                                                                          | A program cannot show its branch's name.                                       | The id is shown and linked, with the gap noted.                                                                                                                |
| H15 | **No counts of any kind.** Enrolled students, subjects, fee structures and academic units per program have no documented endpoint.                                               | The design's per-program panels cannot be filled.                              | Omitted rather than shown empty. The academic-unit panel links to that module and explains why no per-program total is shown (see I6).                          |

---

## I. Academic Units

All eight documented endpoints are wired. The ten request fields are all on the
form and every documented validation rule is honoured.

Compiled from `backend/docs/modules/academic-unit.md` and the Postman
collection. The module doc is **architectural prose only** — it has no endpoint
list and no data structure table, so the collection supplies both.

| #   | Gap                                                                                                                                                                                       | Impact                                                                                     | Current behaviour                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | **No response body documented** for any of the eight endpoints, **no Data Structure table**, and **no endpoint list in the module doc** — the eight are known only from Postman.          | Both the read shape and the endpoint set rest on one source each.                          | Transcribed from the union. `isActive` and `level` typed optional; an absent flag reads "Unknown", never "Inactive".                                                     |
| I2  | ~~**`unitType` has no value set.**~~ **Closed.** The docs name six values and warn against hardcoding; the backend confirmed the enum holds nine — `SECTION`, `CLASS`, `DIVISION`, `STREAM`, `DEPARTMENT`, `YEAR`, `SEMESTER`, `BATCH`, `CUSTOM`. | None. The value set is known.                                                    | **A select** over `ACADEMIC_UNIT_TYPES`, sending the constant unchanged. The warning still holds: filters are built from the data, reads render verbatim, and **nothing in the module branches on the value**. |
| I3  | **`GET /academic-units/tree` is documented by its Postman entry only** — no response body, no nesting key, no envelope.                                                                   | Its shape cannot be typed.                                                                 | Typed `unknown`; `readAcademicUnitTree` narrows defensively. **Nothing depends on it**: the hierarchy is built from the flat list via `parentId`.                        |
| I4  | **`parentId` is in the update body *and* there is a dedicated `PATCH /:id/move`.** Which is authoritative for a re-parent is unstated.                                                    | Two endpoints can change one relationship, possibly with different side effects on `level`. | The edit form **saves the parent as loaded** and re-parenting is done only through Move. The form says so. Move is the endpoint that documents the `level` recalculation. |
| I5  | **`isActive` is in the update body *and* there is a bodyless `PATCH /:id/status` toggle.** So a target state can be set through one endpoint and only flipped through the other.          | Inconsistent with the pattern in Branch and Program, where the toggle is the only path.     | The toggle is used for status changes and treated as non-idempotent (confirmed, never retried, withheld when unknown). The form's switch sends the documented field.     |
| I6  | **No `programId` filter**, though every unit carries one and it is a required field.                                                                                                     | Narrowing by program is impossible server-side.                                            | The program filter runs **in the client**, and the directory says so explicitly.                                                                                        |
| I7  | **No query parameters** beyond the two required scope ids, neither of which narrows the result.                                                                                          | Server-side querying is impossible.                                                        | Search, filter, sort and paging run in the client.                                                                                                                       |
| I8  | **No `isDeleted` field**, despite documented soft deletes ("Never permanently remove nodes if they have financial or academic trails").                                                  | Cannot tell whether the list excludes deleted units.                                       | No figure is reported as a total. Orphans are listed separately rather than promoted to roots.                                                                            |
| I9  | **`metadata` has no schema at all.** The doc names example *uses* — room capacities, minimum students, lab requirements, shift timings — and no keys.                                    | A structured editor would be an invented schema.                                            | Validated only as a JSON object; edited as raw JSON; rendered verbatim with no key interpreted.                                                                          |
| I10 | **`level`'s presence in responses is unconfirmed.** It is documented as server-computed, and no response body promises it.                                                               | The depth may be unavailable.                                                              | Preferred when present; otherwise derived from the built hierarchy and **marked `(derived)`** on the detail screen. Never sent.                                          |
| I11 | **`displayOrder` has no documented default or tie-break.** Sample is `1`.                                                                                                                | Ordering of units without one is undefined.                                                | Siblings order by `displayOrder`, then name. A unit with **no** order sorts **after** those that have one — treating it as `0` would jump it to the front.               |
| I12 | **No error contracts.** No documented code, status or message for a sibling-name collision, a cross-scope parent, a circular move, or a blocked delete.                                  | The UI cannot map a failure to a field.                                                    | Failures surface through the normalized `ApiError`. The consistency and tree rules are made unexpressible by the controls; uniqueness and the delete rule warn.          |
| I13 | **The delete rule's "active children" is unverifiable** when `isActive` is not returned (I1).                                                                                            | The client check can produce a false negative.                                             | Counts only children whose flag is **explicitly true**; the server remains the authority.                                                                                |
| I14 | **No audit event for `move` or `status`.** The map documents `academic_unit.created`, `.updated` and `.deleted` only.                                                                    | Re-parenting and deactivation leave no trail.                                              | The trail is wired and the screens state what it does not contain.                                                                                                       |
| I15 | **No `createdAt`, `updatedAt` or authorship.**                                                                                                                                          | No created/updated captions.                                                               | Omitted rather than faked.                                                                                                                                               |
| I16 | **Program, branch and academic year are ids only.** No expansion documented.                                                                                                            | A unit cannot show its program's name from its own response.                               | The **route** supplies program names as plain data from the Program module; branch and year ids are shown and linked, with the gap noted.                                |
| I17 | **No counts.** Enrolled students, timetables and subject allocation per unit have no documented endpoint.                                                                                | The design's per-unit panels cannot be filled.                                             | Omitted rather than shown empty.                                                                                                                                         |

### I18 — the scope header mismatch now bites

[G19](#g19--the-scope-header-names-disagree-with-the-frontend) recorded that the
platform sends `X-Tenant-Id` and `X-Academic-Year` where the backend documents
`X-Organization-Id` and `X-Academic-Year-Id`. For Academic Year it was
harmless — those endpoints are documented as *bypassing* academic-year context.

**Academic Units are different.** `academic-year.md` lists
`/v1/academic-units/*` under **"Endpoints Requiring Academic Year Context"**,
guarded by `AcademicYearGuard` via `req.context.academicYearId`, which
`ExecutionContextGuard` resolves "from `x-academic-year-id` header **or** branch
active/selected AY fallback". With the header named differently, the backend
falls back to the branch's *selected* year — which may not be the year the user
picked in the workspace switcher.

This module is insulated because it passes `academicYearId` explicitly as the
documented query parameter on both reads, and the integration tests assert
that. But a write (`POST`, `PATCH`, `DELETE`) carries the scope **only** in
headers, so a unit could be created against a different year than the screen
shows.

**Still not changed here**, for the reason given in G19: it is a platform seam
([AGENTS.md §27](../AGENTS.md#27-workspace-scope)), not a feature concern. It
has moved up the priority list below.

> **Needed:** confirmation of the three wire names. One line in
> `src/constants/headers.ts`.

---

## J. What is needed, in priority order

1. **One example response body** for `GET /maintenance-rules/active/status`,
   `GET /audit-logs/summary` and `GET /audit-logs/timeline` (A). Highest value
   per word — it closes three defensive readers.
2. **A decision on the twelve maintenance presentation fields** (C1): are they
   persisted and returned, or request-only?
3. **`PATCH /system-settings` optionality** (B2), and **`sortBy`: docs or
   Postman** (D2). Two one-line answers.
4. **Value sets** for maintenance `severity` (C2) and audit `severity`/`status`
   (D3).
5. **Confirmation of the audit pagination meta key** (D4).
6. **A way to reach inactive organizations** (E2 + E4) — either a list filter
   or a status write path. Today a deactivation is irreversible and the record
   disappears from the only list endpoint.
7. **A branch settings contract, or confirmation that none is planned** (F12).
   Five screens are currently layout with nothing behind them.
8. **Confirmation of the branch status toggle's semantics** (F4) — a body that
   sets a target state would make it idempotent and remove the need to withhold
   it when the current state is unknown.
9. Whether branding, localization, security policy and infrastructure metrics
   (B4–B7) are planned, and roughly when.

Added by the Academic Year milestone, in the same order of value:

10. **Confirmation of the three scope header names** (G19, **I18**). Two of the
    three the platform sends are not names the backend reads. One line to fix
    once confirmed, and it affects every scoped request in the app. **Raised in
    priority by the Academic Unit milestone**: `/v1/academic-units/*` is
    documented as *requiring* academic-year context, so a write currently
    carries its scope only in a header the backend does not read.
11. **A `GET /academic-years/:id`** (G2). Its absence is what makes every detail
    screen branch-dependent and removes per-record refetching.
12. **Whether the lock blocks the lifecycle endpoints** (G4), and **whether any
    inverse transition is planned** (G3) — unlock in particular, since locking
    is currently unrecoverable.
13. **An `isDeleted` field, or confirmation that the list excludes deleted
    years** (G5). Either one turns several "not a total" caveats into real
    figures.
14. **The empty-case response for `/academic-years/current`** (G8), and the
    **initial flags of a non-first year** (G9). Two one-line answers.
15. Whether an **academic calendar** — terms, holidays, exam windows — is
    planned (G14). It is the largest single absence in this module.

Added by the Program and Academic Unit milestone:

16. **Is `level` a real Program field, and does it have a value set?** (H1) The
    single most concrete docs/Postman disagreement in the codebase — it is sent
    on every write and documented nowhere.
17. **Which endpoint owns a re-parent** (I4) and **which owns a status change**
    (I5). Both relationships have two write paths with unstated precedence.
18. **A `programId` filter on the academic-unit list** (I6). Every unit has one
    and it cannot be queried on; a large branch loads its whole structure to
    show one program's.
19. ~~**A value set for `unitType`**~~ (I2) — **answered.** The enum holds nine
    values and the field is now a select. What remains open is whether the
    module doc will record them, since the answer came from the schema rather
    than from the documentation.
20. **One example response body per tree endpoint** (H3, I3). Both are currently
    called and ignored.
21. **`isDeleted`, or confirmation that the lists exclude deleted records**
    (H5, I8) — the same question already open for Academic Year (G5).

None of these blocks further frontend work. Each one, when answered, turns a
`Backend Pending` marker into a wired feature without restructuring anything.
