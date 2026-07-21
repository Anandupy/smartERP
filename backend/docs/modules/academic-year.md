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
1. **RequestContextMiddleware**: Extracts `x-request-id`, `x-branch-id`, and `x-academic-year-id` from HTTP request headers into `req.context`.
2. **JwtAuthGuard**: Validates user authentication.
3. **RolesGuard**: Enforces RBAC permissions and user branch isolation.
4. **AcademicYearGuard**: Triggered via `@RequireAcademicYear()` metadata decorator on controllers requiring academic year context:
   - Validates UUID format of `x-branch-id` and `x-academic-year-id`.
   - Verifies the Academic Year exists and is active (`isDeleted: false`).
   - Verifies the Academic Year belongs to the target `branchId`.
   - If header is omitted, falls back to the branch's currently selected academic year (`isSelected == true`).
   - Attaches the validated `academicYear` object into `req.context.academicYear` and `req.context.academicYearId`.

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

## API Endpoints

### Academic Year Management
- `POST /v1/academic-years`: Create a new academic year.
- `GET /v1/academic-years?branchId=`: List all academic years for a branch.
- `GET /v1/academic-years/current?branchId=`: Get the currently selected academic year.
- `PATCH /v1/academic-years/:id`: Update details (if not locked).
- `PATCH /v1/academic-years/:id/activate`: Set as active.
- `PATCH /v1/academic-years/:id/select`: Set as the current working year.
- `PATCH /v1/academic-years/:id/lock`: Lock the year.
- `DELETE /v1/academic-years/:id`: Soft delete the year (if not locked or selected).

## Validation Rules
1. **Date Range**: `startDate` must be before `endDate`.
2. **No Overlaps**: Academic years within the same branch cannot have overlapping date ranges.
3. **Single Selection**: Only one academic year can be `isSelected` per branch.
4. **Lock Protection**: Locked academic years cannot be modified or deleted.
5. **Selection Protection**: The currently selected academic year cannot be deleted.

## Auto-Selection
When the first academic year is created for a branch, it is automatically set as both `isActive` and `isSelected`.
