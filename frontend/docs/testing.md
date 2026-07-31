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
providers (a test-tuned `QueryClient` with retries off). `createTestQueryClient`
is exported for custom setups.

## Writing tests

- Prefer role/text queries (`getByRole`, `getByText`) over test ids.
- Mock at the network boundary (MSW), not the module boundary.
- Keep unit tests fast; use integration tests for provider/transport wiring and
  Playwright for full user flows.
