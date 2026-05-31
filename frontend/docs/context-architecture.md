# EduOS — Context Architecture

## What Is the ERP Context?

The ERP context is the currently selected workspace scope:

```
Organization → Branch → Academic Year → Program → Financial Year
```

Every data fetch, mutation, and display in EduOS is scoped to this context. The ContextBar at the top of the app shell lets users switch context.

## Context Store

Defined in `src/stores/context.store.ts`:

```typescript
interface AppContextState {
  organizationId: string | null;
  organizationName: string | null;
  branchId: string | null;
  branchName: string | null;
  academicYearId: string | null;
  academicYearName: string | null;
  programId: string | null;
  programName: string | null;
  financialYearId: string | null;
  financialYearName: string | null;
}
```

## Context Initialization Flow

On app boot:
1. Restore context from `localStorage`
2. Validate stored `branchId` is still accessible (via API)
3. If invalid → clear context, show picker
4. If valid → auto-populate `academicYearId` from `GET /v1/academic-years/current?branchId=`

## Context Cascade Rules

Changing context at one level clears all downstream:
- Change **Branch** → clear Academic Year, Program
- Change **Academic Year** → clear Program
- Change **Organization** → clear Branch, Academic Year, Program

## Axios Header Injection

The context is automatically injected into all API requests via the Axios request interceptor:

```
x-organization-id: <organizationId>
x-branch-id: <branchId>
```

Note: The backend currently derives context from the JWT payload. These headers are sent for future-proofing when the backend adds explicit multi-tenant header support.

## Role-Based Context Availability

| Role | Can Switch Org | Can Switch Branch |
|---|---|---|
| SUPER_ADMIN | Yes (all orgs) | Yes (all branches) |
| ORG_ADMIN | No (own org only) | Yes (own org's branches) |
| BRANCH_ADMIN | No | No (own branch only) |
| STAFF | No | No |
| STUDENT/PARENT | No | No |

## ContextBar Component

The `ContextBar` is always visible in the `(dashboard)` layout. Each segment is a dropdown selector that:
1. Shows the current selection
2. Fetches available options when opened (TanStack Query)
3. Dispatches to the context store on selection
4. Cascades downstream context resets
