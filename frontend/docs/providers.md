# Providers

`providers/` is the single client-side composition root, mounted once in
`src/app/layout.tsx` via `<AppProviders>`.

## Composition order

```
ThemeProvider              # color mode (next-themes) — reaches toasts too
  QueryProvider            # TanStack Query cache + Devtools (dev only)
    SessionProvider        # active tenant/branch/workspace scope
      AuthProvider         # authentication state
        PermissionProvider # derived permission checks (depends on auth)
Toaster                    # Sonner portal (theme-aware)
```

Order matters: `PermissionProvider` derives from `AuthProvider`; the toaster is
theme-aware so it sits under `ThemeProvider`.

## Why the query provider owns toasts

`core/query` stays UI-agnostic. `QueryProvider` injects `onQueryError` /
`onMutationError` handlers that surface errors as Sonner toasts (skipping benign
`canceled` errors), keeping the toast dependency out of core.

## Adding a provider

Add it to `app-providers.tsx` in the correct position and export from
`providers/index.ts`. Keep `src/app/layout.tsx` a thin server component.
