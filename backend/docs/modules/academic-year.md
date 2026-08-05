# Academic Year Module

The Academic Year module manages the administrative timeframes for each branch in the ERP system. It allows branches to define school years, isolate data by year, and manage transitions between active academic periods.

## Architecture
- **Branch-Level**: Each academic year belongs to a specific branch.
- **Isolation**: Data such as attendance, marks, fees, admissions, and academic units are linked to an `academicYearId`.
- **States**:
  - `isActive`: Indicates the year is valid and available for data entry.
  - `isSelected`: Indicates the current working year for the system. Only one can be selected per branch.
  - `isLocked`: Prevents further modification or deletion of the academic year data.

## Request Context Resolution & Pipeline Integration

Centralized Academic Year context is integrated throughout the backend pipeline using standard HTTP request headers:
- `x-branch-id`: Active Branch UUID
- `x-academic-year-id`: Active Academic Year UUID

### Resolution Flow & Guard Pipeline
1. **RequestContextMiddleware**: Extracts `x-request-id`, `trace-id` into `req.context`.
2. **JwtAuthGuard**: Validates user authentication.
3. **RolesGuard**: Enforces RBAC permissions.
4. **PermissionGuard**: Resolves fine-grained permissions.
5. **ExecutionContextGuard**: Automatically resolves and validates `academicYearId` via `ContextResolverService` (from `x-academic-year-id` header or branch active/selected AY fallback). Populates `req.context.academicYearId`.
6. **AcademicYearGuard**: Consumes pre-validated `req.context.academicYearId` for `@RequireAcademicYear()` decorated endpoints.

### Endpoints Requiring Academic Year Context
- **Academic Units** (`/v1/academic-units/*`)
- **Applicants** (`/v1/admissions/applicants/*`)
- **Enrollments** (`/v1/admissions/applicants/:id/enrollment`)
- **Admissions Workflow** (`/v1/admissions/applicants/:id/workflow`)

### Endpoints Bypassing Academic Year Context
- **Authentication & User Management** (`/v1/auth/*`, `/v1/users/*`)
- **System & Organization Configuration** (`/v1/system-settings/*`, `/v1/organizations/*`, `/v1/branches/*`)
- **Academic Year Administration** (`/v1/academic-years/*`)
- **Admissions Masters** (`/v1/admissions/masters/*`)

## Lifecycle
1. **Creation**: Admin creates an academic year with a name and date range.
2. **Activation**: The year is activated to allow use.
3. **Selection**: The year is set as "Current" for system-wide operations.
4. **Locking**: Once the year is finished and audited, it is locked to prevent changes.

## Data Structure

Every field of the response, as `AcademicYearDto` documents it in Swagger.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `String (UUID v7)` | |
| `branchId` | `String` | FK to Branch. An id only — the branch is not hydrated. |
| `name` | `String` | Required. No format, length or uniqueness rule is enforced. |
| `startDate` | `DateTime` | ISO 8601 on the wire. |
| `endDate` | `DateTime` | ISO 8601 on the wire. |
| `isActive` | `Boolean` | Always returned. |
| `isSelected` | `Boolean` | Always returned. |
| `isLocked` | `Boolean` | Always returned. |
| `isDeleted` | `Boolean` | Always returned. Soft-delete flag. |
| `createdBy` / `updatedBy` | `String?` | User id. |
| `createdAt` / `updatedAt` | `DateTime` | ISO 8601. |

All four flags are non-null booleans, so a client never has to treat an absent
flag as unknown.

## API Endpoints

### Academic Year Management
- `POST /v1/academic-years`: Create a new academic year.
- `GET /v1/academic-years?branchId=`: List all academic years for a branch.
- `GET /v1/academic-years/current?branchId=`: Get the currently selected academic year.
- `GET /v1/academic-years/:id`: Read one academic year.
- `PATCH /v1/academic-years/:id`: Update details (if not locked). **Accepts a partial body.**
- `PATCH /v1/academic-years/:id/activate`: Set as active.
- `PATCH /v1/academic-years/:id/select`: Set as the current working year.
- `PATCH /v1/academic-years/:id/lock`: Lock the year.
- `DELETE /v1/academic-years/:id`: Soft delete the year (if not locked or selected).

### Reads

- **Both lists exclude soft-deleted years**, as does the read by id — so a
  deleted year is unreachable through the API, and a list count is the branch's
  live years.
- **`GET /:id` is not branch-scoped.** It resolves a year by id alone.
- **`GET /current` returns `200` with `data: null`** when the branch has no
  selected year. It is not a `404`.
- **The list is ordered by `startDate` ascending** and takes no other
  parameters — no `page`, `limit`, `search`, `sortBy` or status filter.
- **Every read is scoped to one branch** except `GET /:id`. There is no
  organization-wide or platform-wide listing.

### Transitions

- `activate` and `select` return **`data: null`**, not the updated year. Re-read
  the record to see the new flags. `lock` returns the updated year.
- **The lock blocks `PATCH /:id` and `DELETE /:id` only.** `activate`, `select`
  and `lock` all remain legal on a locked year — a locked year can still be made
  the current one.
- **There is no inverse for any transition.** No deactivate, no deselect, no
  unlock, no restore. Locking is not reversible through the API.
- Each transition publishes `academic_year.updated`, the same event a field edit
  publishes, so the [audit trail](../core/audit.md) records that the year changed
  but not which transition changed it.

### Initial flag values

The auto-selection rule below covers the **first** year in a branch. A later one
is created with `isActive: false` and `isSelected: false` — it must be activated
and selected explicitly. `isLocked` and `isDeleted` are always `false` at
creation.

## Validation Rules
1. **Date Range**: `startDate` must be before `endDate`.
2. **No Overlaps**: Academic years within the same branch cannot have overlapping date ranges.
3. **Single Selection**: Only one academic year can be `isSelected` per branch.
4. **Lock Protection**: Locked academic years cannot be modified or deleted.
5. **Selection Protection**: The currently selected academic year cannot be deleted.

## Auto-Selection
When the first academic year is created for a branch, it is automatically set as both `isActive` and `isSelected`. Later years are created with both flags `false` — see [Initial flag values](#initial-flag-values).

## Error Contracts

Every failure uses the shared envelope, with the exception class name under
`error.code` — see [Response Contract](../core/response-contract.md).

| Rule broken | Status | `error.code` | Message |
| :--- | :--- | :--- | :--- |
| `startDate` not before `endDate` | `400` | `BadRequestException` | `Invalid date range` |
| Overlapping range in the branch | `400` | `BadRequestException` | `Academic year already overlaps with existing year` |
| Deleting the selected year | `400` | `BadRequestException` | Selection protection |
| Write to a locked year | `403` | `ForbiddenException` | `Academic year is locked and cannot be modified` |
| Branch does not exist (on create) | `404` | `NotFoundException` | `Branch not found` |
| Year does not exist, or is deleted | `404` | `NotFoundException` | `Academic year not found` |

`name` has **no** uniqueness constraint, so a duplicate name is accepted and
produces no error.

## Not in this module

- **No calendar events.** No terms, semesters, holidays, non-instructional days,
  exam windows, admission windows or milestones — no field and no endpoint. A
  year is its two dates.
- **No per-year counts.** Enrolled students, classes, academic units and exam
  schedules all reference an `academicYearId`, but no endpoint aggregates them
  by year.
- **No branch expansion.** `branchId` is an id; read the branch separately.
