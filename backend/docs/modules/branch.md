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

## API Endpoints
- `POST /v1/branches`: Create a new branch.
- `GET /v1/branches`: List all active branches.
- `GET /v1/branches/:id`: Get detailed information for a branch.
- `PATCH /v1/branches/:id`: Update branch details.
- `DELETE /v1/branches/:id`: Soft delete a branch.
