# Testing Strategy

Tests live entirely under `tests/` (never in `src/`), organized by kind.

```
tests/
├── unit/          # pure logic: utils, errors, query keys, header registry
├── integration/   # components with providers + API client against MSW
├── e2e/           # Playwright specs
├── fixtures/      # shared test data (envelope builders, sample entities)
├── mocks/         # MSW handlers + node/browser servers
└── setup/         # vitest global setup + provider-aware render helper
```

| Layer       | Tool                       | Location              | Command               |
| ----------- | -------------------------- | --------------------- | --------------------- |
| Unit        | Vitest + Testing Library   | `tests/unit`          | `pnpm test`           |
| Integration | Vitest + MSW               | `tests/integration`   | `pnpm test`           |
| Component   | Storybook + Vitest browser | `src/**/*.stories.*`  | `pnpm test:storybook` |
| End-to-end  | Playwright                 | `tests/e2e/*.spec.ts` | `pnpm test:e2e`       |

## Vitest projects

`vitest.config.ts` defines two projects and mirrors the `@`/`@tests` aliases:

- **`unit`** — jsdom, React plugin, setup `tests/setup/vitest.setup.ts`. Includes
  `tests/unit`, `tests/integration`, and co-located `src/**/*.test.*`. This is
  what `pnpm test` runs; fast and deterministic.
- **`storybook`** — real browser (Playwright) for story interaction/a11y tests.

## Network mocking — MSW

- Shared handlers: `tests/mocks/handlers.ts` (emit the backend success envelope
  via `tests/fixtures/api.ts` builders).
- Node server (jsdom tests): `tests/mocks/server.ts`, wired in
  `tests/setup/vitest.setup.ts`.
- Browser worker (Storybook/dev): `tests/mocks/browser.ts`.
- Unhandled requests **fail** tests (`onUnhandledRequest: "error"`) to catch
  accidental real network calls. Override per test with `server.use(...)`.

## Fixtures

`tests/fixtures/api.ts` exposes `successEnvelope(data, opts)` and
`errorEnvelope(overrides)` so tests and mocks build responses matching the real
wire format. Import via `@tests/fixtures/api`.

`tests/fixtures/workspace.ts` builds `/auth/me` identities, shaped so the
interesting cases are one call apart: `identityDto()` has a real choice at every
level, `singleChoiceIdentity()` has none, and `scopedRoleIdentity()` is a role
the backend scopes itself. The default handler lives in
`tests/mocks/workspace-handlers.ts`.

Module-level platform state does not reset itself between tests in a file. Specs
touching the workspace scope swap in `createMemoryWorkspaceStorage()` and call
`useWorkspaceStore.getState().clear()` in `beforeEach`, the same way auth specs
swap in `createMemoryTokenStorage()`.

## Rendering helper

Use `render` from `@tests/setup/render` — it mirrors `AppProviders`: a
test-tuned `QueryClient` (retries off), then `SessionProvider` → `AuthProvider`
→ `PermissionProvider` → `TooltipProvider`, in the real order. The theme
provider and toaster are omitted as irrelevant in jsdom.
`createTestQueryClient` is exported for custom setups.

`WorkspaceProvider` is deliberately **not** in the helper: `useWorkspace()`
reads a module-level store rather than a context, so components under test need
no wrapper for it — and the provider's real job (registering request headers) is
not something every render should do.

Web Storage is cleared after every test, so a spec that signs in cannot leak a
session into the next one.

## Auth fixtures

`tests/mocks/auth-handlers.ts` holds the default MSW handlers for the auth API
plus the builders scenarios need: `makeAccessToken(claims)` mints a JWT-shaped
token whose payload is real (nothing client-side verifies signatures), and
`invalidCredentialsEnvelope` / `accountLockedEnvelope` reproduce the backend's
exact failure bodies. Override per test with `server.use(...)`.

## jsdom gaps

`tests/setup/vitest.setup.ts` stubs the layout APIs jsdom omits but headless UI
libraries call from layout effects and timers:

| Stub                               | Needed by                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `ResizeObserver`                   | Radix checkbox, tooltip, popover, select                                                   |
| `Element.prototype.scrollIntoView` | Radix focus management                                                                     |
| `document.elementFromPoint`        | `input-otp` caret tracking                                                                 |
| `window.matchMedia`                | `useMediaQuery` → `useBreakpoint` / `useIsMobile`, and the sidebar's rail-vs-drawer choice |
| Pointer Capture API                | Radix Select's drag detection                                                              |

Nothing asserts on measured geometry; the stubs only keep the primitives
mountable.

`matchMedia` reports **no match**, so component tests render the desktop layout
— the one with the most structure to assert against. A spec that needs the
mobile branch overrides `window.matchMedia` for its own case, rather than every
other spec having to opt out of one.

## Routing

jsdom has no Next.js App Router, so screens that navigate need
`@tests/mocks/next-navigation` — the one place module-boundary mocking is
correct, because the router is a _framework_ boundary (the network boundary
stays on MSW):

```ts
vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});
```

Assert against `routerMock.push` / `routerMock.replace`, and call
`resetRouterMock()` in `beforeEach`. Screens that read the query string — the
reset-password link, for one — get it from `setSearchParams({ token: "…" })`.
Navigation chrome derives its own state from the URL (which sidebar entry is
current, what the breadcrumb trail is), so those specs set it with
`setPathname("/app/settings/general")`.

## Timers

Components driven by staged timers (e.g. the splash boot sequence, resend
throttles, lockout countdowns) schedule the next timeout from the effect that
runs _after_ the previous state update commits. Advance **one tick per `act`** —
a single bulk `advanceTimersByTime(n * step)` fires only the first timer.

Fake timers and `userEvent` do not mix here: `userEvent` awaits its own internal
delays and stalls when the clock is frozen. Keep timer assertions and click
assertions in **separate `describe` blocks**, with fake timers installed only in
the former — see `tests/integration/auth-recovery-flow.test.tsx`.

`useCountdown` ticks on a persistent `setInterval`, so a single bulk
`advanceTimersByTime` fires every tick — the one-tick-per-`act` rule applies only
to chained timeouts like the splash boot sequence.

`testTimeout` is raised to 15 s for the `unit` project: integration specs mount
the full provider tree and round-trip through MSW, and the first spec in a file
also pays its module-loading cost.

## Writing tests

- Prefer role/text queries (`getByRole`, `getByText`) over test ids.
- Mock at the network boundary (MSW), not the module boundary — the App Router
  mock above is the documented exception.
- Keep unit tests fast; use integration tests for provider/transport wiring and
  Playwright for full user flows.
- **Unit tests import the module under test, not the feature barrel.** A test
  for a mapper or a payload reader has no business loading its module's tables
  and drawers: doing so multiplied per-worker import cost enough to starve the
  worker pool. Application code still imports through the barrel (AGENTS.md §7).
- **Assert on what reaches the wire**, not just on what renders. The
  administration specs check that a partial edit still sends a complete body,
  that the maintenance list sends _no_ query parameters, and that the audit list
  sends the documented ones — the properties a screenshot cannot show and a
  refactor can silently break.
- **Fixtures carry only documented fields.** `tests/fixtures/{system-settings,
maintenance,audit}.ts` deliberately omit anything the backend has not
  promised, so a test cannot pass against an invented property.
