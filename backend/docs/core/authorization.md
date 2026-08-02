# Enterprise Authorization Platform (Phase 3 — Enforcement & Integration)

CampusFlow ERP incorporates a centralized, enterprise-grade **Authorization Platform**. It adheres strictly to Anti-Gravity clean architecture principles and acts as the single source of truth for permission resolution, authorization evaluation, role permission assignment, user permission overrides, security auditing, and API route enforcement across all ERP modules.

---

## Global Guard Execution Pipeline

The backend request processing pipeline evaluates global guards in strict sequence:

```mermaid
flowchart TD
    Client[Client HTTP Request] --> Throttle[0. PublicRouteThrottlerGuard]
    Throttle --> JwtGuard[1. JwtAuthGuard]
    JwtGuard --> SetupGuard[2. WorkspaceSetupGuard]
    SetupGuard --> ExecCtx[3. ExecutionContextGuard]
    ExecCtx --> RolesGuard[4. RolesGuard]
    RolesGuard --> PermGuard["5. PermissionGuard (Enforces @RequirePermission)"]
    PermGuard --> MaintGuard[6. MaintenanceGuard]
    MaintGuard --> BranchGuard[7. BranchGuard]
    BranchGuard --> AcadGuard[8. AcademicYearGuard]
    AcadGuard --> Controller[9. Controller Method Execution]

    PermGuard -- Missing Permission --> Forbidden[403 Forbidden Exception]
    Forbidden --> EventBus[Publish PermissionDeniedEvent]
    EventBus --> AuditLog[(Audit Infrastructure Logging)]
```

### Pipeline Guard Order

The order is the contract; see [Guard Pipeline](./guard-pipeline.md) for the
reasoning and [Execution Context](./execution-context.md) for who may write the
context.

| #   | Guard                       | Responsibility                                                                     |
| :-- | :-------------------------- | :--------------------------------------------------------------------------------- |
| 0   | `PublicRouteThrottlerGuard` | Rate limits public routes. Inert on authenticated ones.                            |
| 1   | `JwtAuthGuard`              | Authenticates the bearer token, populates `req.user`.                              |
| 2   | `WorkspaceSetupGuard`       | Blocks the ordinary API until bootstrap completes.                                 |
| 3   | `ExecutionContextGuard`     | **Sole writer** of identity and tenant scope.                                      |
| 4   | `RolesGuard`                | Validates the role hierarchy. Read-only.                                           |
| 5   | `PermissionGuard`           | Evaluates route permissions via `AuthorizationService.canUserAccess()`. Read-only. |
| 6   | `MaintenanceGuard`          | Enforces active maintenance rules.                                                 |
| 7   | `BranchGuard`               | Asserts a branch is in scope. No database access.                                  |
| 8   | `AcademicYearGuard`         | Asserts an academic year is in scope. No database access.                          |

> [!IMPORTANT]
> `PermissionGuard` runs **after** `ExecutionContextGuard`. It previously ran
> before it and evaluated permissions against an unpopulated context, falling
> back to `request.user` — so the identity that authorized a request was not
> necessarily the identity recorded in the audit log.

---

## Developer Guide: `@RequirePermission()` Decorator

Use the `@RequirePermission()` decorator from `@/common/decorators/permission.decorator` to protect controllers or route handlers.

### 1. Single Permission Requirement

```typescript
import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';

@Controller('admissions/applicants')
export class ApplicantController {
  @Get()
  @RequirePermission(PERMISSIONS.Admissions.View)
  async findAll() {
    return [];
  }
}
```

### 2. Multiple Permissions (ALL Mode - Default)

Requires the user to possess **all** listed permissions:

```typescript
@Post('export')
@RequirePermission([PERMISSIONS.Admissions.View, PERMISSIONS.Admissions.Export], { mode: 'ALL' })
async exportApplicants() {
  return [];
}
```

### 3. Multiple Permissions (ANY Mode)

Requires the user to possess **at least one** of the listed permissions:

```typescript
@Get('dashboard')
@RequirePermission([PERMISSIONS.Admissions.View, PERMISSIONS.Student.View], { mode: 'ANY' })
async getDashboard() {
  return {};
}
```

### 4. Swagger OpenAPI Integration

Every endpoint decorated with `@RequirePermission()` automatically injects an OpenAPI extension `x-required-permissions` into the generated Swagger spec without manual documentation duplication.

---

## Protected Module Reference Matrix

| Module              | Controller                 | Protected Endpoints                                                                                                                                    | Required Permission                                                                    |
| :------------------ | :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **Organizations**   | `OrganizationController`   | `GET /v1/organizations`<br>`POST/PATCH/DELETE /v1/organizations/*`                                                                                     | `settings.view`<br>`settings.manage`                                                   |
| **Branches**        | `BranchController`         | `GET /v1/branches`<br>`POST/PATCH/DELETE /v1/branches/*`                                                                                               | `settings.view`<br>`settings.manage`                                                   |
| **Academic Years**  | `AcademicYearController`   | `GET /v1/academic-years`<br>`POST/PATCH/DELETE /v1/academic-years/*`                                                                                   | `settings.view`<br>`settings.manage`                                                   |
| **Programs**        | `ProgramController`        | `GET /v1/programs`<br>`POST/PATCH/DELETE /v1/programs/*`                                                                                               | `settings.view`<br>`settings.manage`                                                   |
| **Academic Units**  | `AcademicUnitController`   | `GET /v1/academic-units`<br>`POST/PATCH/DELETE /v1/academic-units/*`                                                                                   | `settings.view`<br>`settings.manage`                                                   |
| **Admissions**      | `ApplicantController`      | `GET /v1/admissions/applicants`<br>`POST /v1/admissions/applicants`<br>`PATCH /v1/admissions/applicants/:id`<br>`DELETE /v1/admissions/applicants/:id` | `admissions.view`<br>`admissions.create`<br>`admissions.update`<br>`admissions.delete` |
| **System Settings** | `SystemSettingsController` | `GET /v1/system-settings`<br>`POST/PATCH /v1/system-settings/*`                                                                                        | `system.view`<br>`system.manage`                                                       |
| **Maintenance**     | `MaintenanceController`    | `GET /v1/maintenance-rules`<br>`POST/PATCH/DELETE /v1/maintenance-rules/*`                                                                             | `system.view`<br>`system.maintenance`                                                  |

---

## Migration Guide for Future ERP Modules

When introducing a new ERP module (Hostel, Transport, LMS, CRM, Procurement, Finance):

1. **Add Permission Contracts**:
   - Update `PERMISSIONS` catalog in `src/common/constants/permission.constants.ts`.
2. **Seed Categories & Permissions**:
   - Add new category and permissions to `src/infrastructure/database/seeder.service.ts`.
3. **Decorate Module Controllers**:
   - Add `@RequirePermission(PERMISSIONS.<Domain>.<Action>)` to route handlers.
4. **Write Tests**:
   - Add unit and integration tests verifying authorized access and unauthorized 403 Forbidden rejections.

---

## Security Audit & Logging

When permission evaluation fails:

1. `PermissionGuard` logs `WARN` with missing permissions and user context.
2. `AuthorizationService` publishes `PermissionDeniedEvent` to `EventBus`.
3. `AuditListener` captures event and persists an `AuditLog` entry:
   - Module: `AUTHORIZATION`
   - Action: `EXECUTE`
   - Status: `FAILED`
   - Severity: `WARNING`
   - Context: `userId`, `role`, `organizationId`, `branchId`, `academicYearId`, `requestId`, `route`, `httpMethod`.
