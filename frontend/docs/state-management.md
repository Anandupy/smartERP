# EduOS — State Management

## Principle: Strict State Separation

| Category | Tool | Notes |
|---|---|---|
| Server data (API responses) | TanStack Query | Cache, mutations, background sync |
| Auth state | Zustand `auth.store` | User, role, token (access in-memory) |
| App context | Zustand `context.store` | Org/Branch/Year/Program selections |
| UI state | Zustand `ui.store` | Sidebar, dialogs, command menu |
| Theme state | Zustand `theme.store` | Colors, density, layout mode |
| Form state | React Hook Form | Component-scoped |
| URL state | Next.js `useSearchParams` | Filters, pagination, drawer open |

**Rule: Never put server data in Zustand. Never put UI state in TanStack Query.**

---

## Zustand Stores

### `auth.store` — Authentication State

```typescript
interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isInitialized: boolean;     // true after boot check completes
}
```

Persistence: Only `isAuthenticated` is checked on boot. The access token is **not persisted**. On boot, if a refresh token exists in localStorage, a silent refresh is attempted.

### `context.store` — ERP Workspace Context

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

Persistence: `localStorage` — survives tab close. Context is **validated on boot** against API (in case a branch was deleted).

### `ui.store` — UI State

```typescript
interface UIState {
  sidebarCollapsed: boolean;
  activeDrawerId: string | null;
  commandMenuOpen: boolean;
  notificationPanelOpen: boolean;
  activeTourId: string | null;
}
```

Persistence: `sidebarCollapsed` only — rest is in-memory.

### `theme.store` — Theme State

```typescript
interface ThemeState {
  // Active theme (applied to CSS vars)
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  density: DataDensity;
  sidebarLayout: SidebarLayout;
  headerLayout: HeaderLayout;
  contentLayout: ContentLayout;
  // Draft (live preview in Theme Studio, not yet published)
  draft: Partial<ThemeState> | null;
}
```

Persistence: `localStorage` — so theme persists across sessions.

---

## TanStack Query

### Query Key Factory

All query keys are defined in `src/lib/api/query-keys.ts`. Never inline query keys in hooks.

```typescript
queryKeys.organizations.list(filters)
queryKeys.branches.detail(id)
queryKeys.academicYears.current(branchId)
```

### Default Options

- `staleTime`: 5 minutes — ERP data doesn't change frequently
- `gcTime`: 30 minutes — keep cache for fast back-navigation
- `refetchOnWindowFocus`: false — ERP users don't expect auto-refresh
- `retry`: 0 on 401/403/404, 2 otherwise

### Optimistic Updates

Mutations use optimistic updates for list operations:
1. `onMutate` — update cache immediately
2. `onError` — rollback to previous data
3. `onSettled` — invalidate and refetch

---

## URL State

Filters, pagination, search, and drawer state live in URL search params:

```
/admissions?view=kanban&status=UNDER_REVIEW&detail=APP-2024-089
/administration/users?page=2&limit=50&q=john
```

This enables:
- Deep linking to filtered views
- Back button support
- Shareable URLs

Use `useSearchParams()` and `useRouter()` from `next/navigation`.

---

## Hydration Safety

### Problem
Zustand's `persist` middleware reads from `localStorage` on the client. Server renders don't have localStorage. If a component reads persisted state during SSR, the HTML won't match the hydrated state → **hydration mismatch error**.

### Solution
1. **`useIsHydrated()` hook** — returns `false` until after first render
2. All Zustand persisted state reads are gated behind `isHydrated`
3. Skeleton/loading states shown during hydration window
4. Stores use `skipHydration: true` in SSR contexts

```typescript
// Pattern: safe Zustand read
const { sidebarCollapsed } = useUIStore();
const isHydrated = useIsHydrated();

if (!isHydrated) return <SidebarSkeleton />;
return <Sidebar collapsed={sidebarCollapsed} />;
```
