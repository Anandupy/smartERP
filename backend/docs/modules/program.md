# Program Module

## Overview
The **Program** module represents the internal academic classification within a Branch. While a Branch is a legal and geographical entity, a Program is a way to organize students and curriculum (e.g., "Primary", "Secondary", "Degree in CS").

## Concepts
- **Branch vs. Program**: A Branch is the physical/legal institution. A Program is a vertical structure *inside* that branch.
- **AcademicYear vs. Program**: Academic Years are time-bound cycles. Programs are static structures that span multiple years.
- **AcademicUnit**: Individual classes or sections (e.g., "Grade 10-A") will eventually belong to a Program.

## Examples
- **School**: Primary (Medium: English), Secondary (Medium: Hindi).
- **College**: Jr. College (Stream: Science), Jr. College (Stream: Commerce).
- **University**: B.Tech (Stream: Engineering), M.B.B.S (Stream: Medical).

## Hierarchy
Programs support an optional parent-child hierarchy. This allows grouping, such as:
- **School (Parent)**
  - Primary (Child)
  - Secondary (Child)

## Data Structure

Every field of the response, as `ProgramDto` documents it in Swagger.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `String (UUID v7)` | |
| `branchId` | `String` | FK to Branch. Required. |
| `name` | `String` | Required. |
| `level` | `ProgramLevel?` | **`SCHOOL`, `COLLEGE` or `DEGREE`.** Optional. A real, persisted, enum-constrained column. |
| `medium` | `String?` | Optional free text, e.g. `"English"`. Trimmed on write. |
| `stream` | `String?` | Optional free text, e.g. `"Science"`. Trimmed on write. |
| `parentId` | `String?` | Optional. Parent program for the hierarchy. |
| `isActive` | `Boolean` | Default `true`. Always returned. |
| `isDeleted` | `Boolean` | Default `false`. Always returned. Soft-delete flag. |
| `createdBy` / `updatedBy` | `String?` | User id. |
| `createdAt` / `updatedAt` | `DateTime` | ISO 8601. |

`level` is an enum with exactly three values. It is safe to offer as a select.
`medium` and `stream` are unconstrained strings with no vocabulary.

### Hydrated relations

Three read shapes, and they differ:

| Endpoint | Shape | Hydrates |
| :--- | :--- | :--- |
| `GET /programs` | `ProgramWithParentDto` | `parent` (null at the root) |
| `GET /programs/:id` | `ProgramDetailDto` | `parent` **and** `branch` |
| `GET /programs/tree` | `ProgramTreeNodeDto[]` | `children`, recursively |

The write endpoints — create, update, delete, status — return the bare
`ProgramDto` with no relation hydrated.

`GET /programs/:id` is the one endpoint that hydrates `branch`, so it is where a
program's branch name comes from.

### The tree endpoint

`GET /programs/tree?branchId=` returns the **same programs** as the flat list,
nested under their parents instead. Each node is a full `ProgramDto` plus a
`children` array, present at every depth and empty at the leaves. Roots are the
programs whose `parentId` is null. It is an array at the top level, not an
object with a nesting key.

Building the hierarchy client-side from the flat list via `parentId` gives an
identical result.

## API Endpoints

### Base URL: `/programs`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/programs` | ADMIN | Create a new program |
| GET | `/programs?branchId=...` | ALL | List programs for a branch |
| GET | `/programs/tree?branchId=...` | ALL | Get hierarchical tree |
| GET | `/programs/:id` | ALL | Get program details |
| PATCH | `/programs/:id` | ADMIN | Update program |
| DELETE | `/programs/:id` | ADMIN | Soft delete program |
| PATCH | `/programs/:id/status` | ADMIN | Toggle active status |

### Endpoint notes

- **The list excludes soft-deleted programs**, so its count is the branch's live
  programs. Ordered by `name` ascending.
- **No query parameters** beyond the required `branchId`, which selects the
  branch rather than narrowing the result. No `page`, `limit`, `search`,
  `sortBy` or filters.
- **Every read is scoped to one branch.** There is no organization-wide or
  platform-wide listing.
- **`PATCH /:id` accepts a partial body.**
- **`PATCH /:id/status` takes no body.** It flips the current `isActive` rather
  than setting a target, so it is **not idempotent**.
- **Soft delete only.** `DELETE` sets `isDeleted` and returns the updated
  record. There is no permanent deletion and no restore.

## Validation Rules
1. **Uniqueness**: The combination of `branchId`, `name`, `medium`, and `stream` must be unique per branch.
2. **Same-Branch Hierarchy**: A child program must belong to the same branch as its parent.
3. **Circular Prevention**: The system prevents creating circular parent-child loops.
4. **Active Deletion**: A program cannot be deleted if it has active child programs.

Uniqueness is checked case-insensitively, among non-deleted programs only.
`name`, `medium` and `stream` are trimmed before the comparison.

## Error Contracts

| Rule broken | Status | `error.code` | Message |
| :--- | :--- | :--- | :--- |
| Uniqueness collision (rule 1) | `409` | `ConflictException` | `Program already exists in this branch` |
| Cross-branch parent (rule 2) | `400` | `BadRequestException` | `Parent program must belong to the same branch` |
| Program set as its own parent | `400` | `BadRequestException` | `Program cannot be its own parent` |
| Circular hierarchy (rule 3) | `400` | `BadRequestException` | `Circular hierarchy detected` |
| Delete with active children (rule 4) | `400` | `BadRequestException` | `Cannot delete program with active sub-programs` |
| Branch does not exist | `404` | `NotFoundException` | `Branch not found` |
| Program does not exist, or is deleted | `404` | `NotFoundException` | `Program not found` |

## Audit

Programs publish `program.created`, `program.updated` and `program.deleted`,
which the [audit trail](../core/audit.md) records under the `ACADEMIC` module.
The status toggle publishes `program.updated`, the same event as a field edit.

## Not in this module

- **No per-program counts.** Enrolled students, subjects, fee structures and
  academic units all reference a program, but no endpoint aggregates them by
  program.
- **No branch expansion on the list.** Only `GET /programs/:id` hydrates
  `branch`.
