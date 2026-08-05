# Branch Module

The Branch module manages the individual campuses or units of an Educational Organization. Each branch can have its own settings, academic years, and structure modes.

## Request Context Resolution & Pipeline Integration

Centralized Branch context is integrated throughout the backend request pipeline using standard HTTP request headers:
- `x-branch-id`: Active Branch UUID

### Resolution Flow & Guard Pipeline
1. **RequestContextMiddleware**: Extracts `x-request-id`, `trace-id` into `req.context`.
2. **JwtAuthGuard**: Validates user authentication.
3. **RolesGuard**: Enforces RBAC permissions.
4. **PermissionGuard**: Resolves fine-grained permissions.
5. **ExecutionContextGuard**: Resolves and validates execution scope (`organizationId`, `branchId`, `academicYearId`) from headers or auto-discovery via `ContextResolverService`. Populates `req.context`.
6. **BranchGuard**: Consumes pre-validated `req.context.branchId` for `@RequireBranch()` decorated endpoints.
7. **AcademicYearGuard**: Consumes pre-validated `req.context.academicYearId`.

### Endpoints Requiring Branch Context (`@RequireBranch()`)
- **Academic Years** (`/v1/academic-years/*`)
- **Programs** (`/v1/programs/*`)
- **Academic Units** (`/v1/academic-units/*`)
- **Applicants** (`/v1/admissions/applicants/*`)
- **Enrollments** (`/v1/admissions/applicants/:id/enrollment`)
- **Admissions Workflow** (`/v1/admissions/applicants/:id/workflow`)
- **Guardians** (`/v1/admissions/guardians/*`)
- **Numbering Configurations** (`/v1/admissions/numbering/configs/*`)
- **Admissions Masters** (`/v1/admissions/masters/*`: Quotas, Religions, Castes, Categories, Disabilities, Genders, Languages, Admission Sources, Blood Groups, Relation Types)

### Endpoints Bypassing Branch Context
- **Authentication** (`/v1/auth/*`)
- **System Settings** (`/v1/system-settings/*`)
- **Organization Management** (`/v1/organizations/*`)
- **Branch Management Itself** (`/v1/branches/*`: creating a new branch or listing organization branches)

## Institutional Support
To support diverse educational institutions, the Branch model includes specific categorization:

### Institution Types
- **SCHOOL**: K-12 education.
- **JUNIOR_COLLEGE**: Higher secondary or pre-university education.
- **DEGREE_COLLEGE**: Undergraduate and postgraduate studies.
- **UNIVERSITY**: Higher education and research institutions.
- **ENGINEERING**: Engineering colleges and technical institutes.
- **MEDICAL**: Medical, dental, and nursing colleges.
- **OTHER**: Specialized training centers or vocational schools.

### Affiliations
Branches can be affiliated with different educational boards or universities:
- `affiliationType`: BOARD, UNIVERSITY, or OTHER.
- `affiliationName`: The specific name of the body (e.g., CBSE, Mumbai University).

## Registration
Each branch can store a `registrationNumber` as a generic identifier provided by government or educational authorities. This field is unique across the system if provided.

## Structure Mode
- **DEFAULT**: Standard organizational structure provided by the ERP.
- **CUSTOM**: Allows manual definition of programs, batches, and sections (to be used by the Program module).

## Branch vs. Program
- **Branch**: Represents a physical or administrative unit (e.g., "Main Campus", "South Branch").
- **Program**: Represents a course of study offered by the branch (e.g., "Bachelor of Science", "Grade 10"). A branch can host multiple programs.

## Data Structure

Every field of the response, as `BranchDto` documents it in Swagger.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `String (UUID v7)` | |
| `organizationId` | `String` | FK to Organization. |
| `name` | `String` | Required. |
| `code` | `String` | Required. Unique, stored lower-cased. |
| `registrationNumber` | `String?` | Optional. Unique if provided. |
| `institutionType` | `InstitutionType` | Required. See [Institution Types](#institution-types). |
| `affiliationType` | `AffiliationType?` | Optional. `BOARD`, `UNIVERSITY`, `OTHER`. |
| `affiliationName` | `String?` | Optional. |
| `logoUrl` | `String?` | Optional. A URL — there is no upload endpoint. |
| `contactEmail` | `String` | Required. |
| `contactPhone` | `String` | Required. |
| `addressLine1` | `String` | Required. |
| `addressLine2` | `String?` | Optional. |
| `city` | `String` | Required. |
| `state` | `String` | Required. |
| `country` | `String` | Required. |
| `pincode` | `String` | Required. |
| `structureMode` | `StructureMode` | `DEFAULT` (default) or `CUSTOM`. |
| `isActive` | `Boolean` | Default `true`. Always returned. |
| `isDeleted` | `Boolean` | Default `false`. Always returned. |
| `createdBy` / `updatedBy` | `String?` | User id. |
| `createdAt` / `updatedAt` | `DateTime` | ISO 8601. |

### Hydrated relations

`GET /v1/branches` and `GET /v1/branches/:id` **include the parent
organization** under `organization`, as `BranchWithOrganizationDto`. So a branch
can render its organization's name without a second call. The write endpoints —
create, update, delete, status — return the bare `BranchDto` with no
`organization` key.

## API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/v1/branches` | Create a new branch. |
| `GET` | `/v1/branches` | List branches. Includes `organization`. |
| `GET` | `/v1/branches/:id` | Get one branch. Includes `organization`. |
| `GET` | `/v1/branches/organization/:orgId` | List one organization's branches. |
| `PATCH` | `/v1/branches/:id` | Update. **Accepts a partial body.** |
| `DELETE` | `/v1/branches/:id` | Soft delete. |
| `PATCH` | `/v1/branches/:id/status` | Toggle active status. |

Notes:

- **The list is scoped by the caller's organization** for every role except
  `SUPER_ADMIN`, which sees all. Soft-deleted branches are excluded everywhere.
- **No query parameters** on any endpoint — no `page`, `limit`, `search`,
  `sortBy` or filters. A client that needs them narrows the list itself.
- **`PATCH /:id/status` takes no body.** It flips the current `isActive` rather
  than setting a target, so it is **not idempotent** — sending it twice returns
  to where it started. Read the branch first if the resulting state matters.
- **Soft delete only.** `DELETE` sets `isDeleted` and `isActive: false` and
  returns the updated record. There is no permanent deletion and no restore.
- **Status is two booleans**, `isActive` and `isDeleted` — there is no status
  enum and no "archived" value.

## Role Hierarchy & Access

The system uses a weighted hierarchy:
`SUPER_ADMIN (5) > ORG_ADMIN (4) > BRANCH_ADMIN (3) > STAFF (2) > STUDENT/PARENT (1)`

- **CREATE**: SUPER_ADMIN, ORG_ADMIN
- **UPDATE**: SUPER_ADMIN, ORG_ADMIN
- **DELETE**: SUPER_ADMIN only
- **GET**: All roles with `settings.view`
- **TOGGLE STATUS**: SUPER_ADMIN, ORG_ADMIN

## Response contract

Every response uses the shared envelope — see
[Response Contract](../core/response-contract.md).

| Status | When |
| :--- | :--- |
| `200` | Read, update, delete or status toggle succeeded. |
| `201` | Create succeeded. |
| `400` | Validation failed. |
| `401` | Missing or invalid credentials. |
| `403` | Authenticated but not permitted. |
| `404` | Branch, or the parent organization on create, does not exist. |
| `409` | `code` or `registrationNumber` already taken. |
| `500` | Unexpected server error. |

## Not in this module

- **No branch settings resource.** See [Branch Settings](./branch-settings.md).
- **No counts** — students, faculty or programmes per branch. Those belong to
  other modules and none exposes a branch-scoped total.
- **No uptime, latency or node health.** The [health probes](../core/health-and-lifecycle.md)
  report the process and its database, not a per-branch figure.
- **No logo upload.** `logoUrl` is a string; nothing accepts a file.
