# Error Handling

Layered so failures are caught at the right altitude and always shown with
friendly, consistent copy.

## Transport → normalized errors

The API response interceptor turns every failure into a typed `ApiError`
(`kind`, `status`, `message`, `fieldErrors`, `requestId`). See
[API Layer](./api-layer.md). `lib/getErrorMessage(error)` maps any thrown value
to display-ready copy; `getFieldErrors(error)` extracts field-level issues.

## Query/mutation errors → toasts

`QueryProvider` routes cache errors to Sonner toasts (skipping `canceled`), so
data-fetching failures surface globally without per-call handling.

## Rendering errors → boundaries

| Boundary                   | Catches                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `src/app/error.tsx`        | errors within a route segment (uses Next 16 `unstable_retry`) |
| `src/app/global-error.tsx` | errors in the root layout (self-contained html/body)          |
| `shared/ErrorBoundary`     | component-subtree errors not tied to a route                  |

## Standard UI states

`shared/components/feedback` provides consistent, reusable states:

- `LoadingState` / `Spinner` — pending UI (also `src/app/loading.tsx`).
- `EmptyState` — no-data situations.
- `ErrorState` — error panel with optional retry; maps errors via
  `getErrorMessage`.

## 404

`src/app/not-found.tsx` renders the global 404; call `notFound()` in a segment to
trigger it.

## Guidance

- Expected/validation errors: model as values / field errors, not thrown.
- Unexpected errors: let them throw to the nearest boundary.
- Event-handler/async errors: catch and surface via toast or local state
  (React error boundaries don't catch these).
