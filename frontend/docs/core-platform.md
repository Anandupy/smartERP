# Core Platform

`src/core/` owns cross-cutting infrastructure with **zero business logic**. Four
sub-domains:

## `core/api`

Axios transport, backend-envelope handling, typed `ApiError`, and `Result`
helpers. See [API Layer](./api-layer.md) and
[Response Handling](./response-handling.md).

## `core/auth`

Interfaces + contexts only — the backend auth flow is not final, so nothing
implements login here.

- **Token storage abstraction** (`token-storage.ts`): `TokenStorage` interface
  with memory (default) and Web Storage implementations; swap via
  `setTokenStorage`. Refresh-token handling is a documented seam.
- **Contexts**: `AuthProvider`/`useAuth`, `SessionProvider`/`useSession`
  (tenant/branch/academic-year/workspace scope), `PermissionProvider`/
  `usePermissions` (`can`, `canAny`, `canAll`, `hasRole`).
- **Guards**: `ProtectedRoute` (auth + optional permission gate) and
  `GuestRoute`.

## `core/query`

TanStack Query configuration.

- `createQueryClient(handlers)` — platform defaults (staleTime, gc, retry policy
  that never retries 4xx), with injectable error handlers so the layer stays
  UI-free.
- `createQueryKeys(namespace)` — type-safe, consistent key factory.
- `invalidateKeys` / `optimisticUpdate` — reusable mutation helpers.

## `core/theme`

Theme **abstraction** — dynamic theming is intentionally not implemented.

- `ThemeProvider` wraps `next-themes` (light/dark today).
- `themeRegistry` + `baseTheme` — registrable theme definitions.
- Design-token interfaces (`DesignTokens` and friends).
- `adaptWorkspaceTheme` / `registerWorkspaceTheme` — future workspace theming
  seam. See [Theme Integration](./theme-integration.md).

## Configurability

Every seam is configurable without editing core: header providers
(`headerRegistry`), token storage (`setTokenStorage`), unauthorized handling
(`setUnauthorizedHandler`), query error handling (provider), and theme
registration (`themeRegistry`).
