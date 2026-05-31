# EduOS — Routing Architecture

## Route Groups

```
(public)    → /maintenance
(auth)      → /login, /forgot-password, /reset-password, /setup
(dashboard) → All protected ERP routes
```

## Protection Strategy

### Middleware (Edge)
`middleware.ts` runs at the Edge before every request:
- Unauthenticated → `(dashboard)/*` redirects to `/login`
- Authenticated → `(auth)/*` redirects to `/dashboard`
- Maintenance mode → all routes redirect to `/maintenance`

### Client Guard
`(dashboard)/layout.tsx` uses an `<AuthGuard>` component for client-side protection after hydration. This covers cases where Zustand auth state isn't reflected in cookies.

## Role-Based Redirects After Login

| Role | Redirect |
|---|---|
| SUPER_ADMIN | `/administration/organizations` |
| ORG_ADMIN | `/dashboard` |
| BRANCH_ADMIN | `/dashboard` |
| STAFF | `/admissions` |
| STUDENT / PARENT | `/dashboard` |

## URL State Conventions

| Pattern | Example | Purpose |
|---|---|---|
| `?view=kanban\|table` | `/admissions?view=kanban` | View mode |
| `?status=ACTIVE` | `/admissions?status=UNDER_REVIEW` | Filter |
| `?detail=<id>` | `/admissions?detail=APP-123` | Open drawer |
| `?page=2&limit=50` | `/users?page=2` | Pagination |
| `?q=john` | `/users?q=john` | Search |
| `?tab=branches` | `/settings?tab=branches` | Active tab |

## Complete Route Map

```
/                               → redirect to /dashboard or /login
/maintenance                    → maintenance page (public)
/login                          → login form (auth)
/forgot-password               → forgot password (auth, shell only)
/reset-password                → reset password (auth, shell only)
/setup                          → system init wizard (auth, SUPER_ADMIN)
/dashboard                      → role-adaptive dashboard
/admissions                     → admission pipeline
/admissions/new                 → new application wizard
/admissions/[applicantId]       → applicant detail
/academic                       → academic unit explorer
/academic/hierarchy             → enterprise tree view
/academic/programs              → program list
/academic/programs/tree         → program tree
/academic/programs/new          → create program
/academic/programs/[programId]  → program detail
/academic/units/[unitId]        → unit detail
/students                       → student list (future)
/attendance                     → attendance (future)
/finance                        → finance (future)
/hr                             → HR (future)
/reports                        → reports (future)
/administration                 → redirect to /administration/organizations
/administration/organizations   → org directory (SUPER_ADMIN)
/administration/organizations/new → create org wizard
/administration/organizations/[orgId] → org detail
/administration/users           → user directory
/administration/users/new       → create user
/administration/users/[userId]  → user detail
/administration/audit           → audit center
/settings                       → redirect to /settings/general
/settings/general               → system settings
/settings/organization          → org settings
/settings/branches              → branch list
/settings/branches/new          → create branch
/settings/academic              → academic year workspace
/settings/theme                 → theme studio
/settings/roles                 → role management
/settings/audit                 → audit (settings context)
/profile                        → user profile
/profile/sessions               → active sessions
/plugins                        → plugin marketplace (future)
```
