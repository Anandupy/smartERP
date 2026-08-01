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

## Rendering helper

Use `render` from `@tests/setup/render` — it wraps components in the platform
providers (a test-tuned `QueryClient` with retries off, plus `TooltipProvider`).
`createTestQueryClient` is exported for custom setups.

## jsdom gaps

`tests/setup/vitest.setup.ts` stubs the layout APIs jsdom omits but headless UI
libraries call from layout effects and timers:

| Stub                               | Needed by                                |
| ---------------------------------- | ---------------------------------------- |
| `ResizeObserver`                   | Radix checkbox, tooltip, popover, select |
| `Element.prototype.scrollIntoView` | Radix focus management                   |
| `document.elementFromPoint`        | `input-otp` caret tracking               |

Nothing asserts on measured geometry; the stubs only keep the primitives
mountable.

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
`resetRouterMock()` in `beforeEach`.

## Timers

Components driven by staged timers (e.g. the splash boot sequence, resend
throttles, lockout countdowns) schedule the next timeout from the effect that
runs _after_ the previous state update commits. Advance **one tick per `act`** —
a single bulk `advanceTimersByTime(n * step)` fires only the first timer.

Fake timers and `userEvent` do not mix here: `userEvent` awaits its own internal
delays and stalls when the clock is frozen. Keep timer assertions and click
assertions in **separate `describe` blocks**, with fake timers installed only in
the former — see `tests/integration/auth-recovery-flow.test.tsx`.

## Writing tests

- Prefer role/text queries (`getByRole`, `getByText`) over test ids.
- Mock at the network boundary (MSW), not the module boundary — the App Router
  mock above is the documented exception.
- Keep unit tests fast; use integration tests for provider/transport wiring and
  Playwright for full user flows.
