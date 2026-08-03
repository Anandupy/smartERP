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

## G. What is needed, in priority order

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

None of these blocks further frontend work. Each one, when answered, turns a
`Backend Pending` marker into a wired feature without restructuring anything.
