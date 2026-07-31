# Tests

All tests live here, outside `src/`. See [docs/testing.md](../docs/testing.md)
for the full strategy.

```
tests/
├── unit/          # pure logic (utils, errors, query keys, headers)
├── integration/   # components with providers + API client against MSW
├── e2e/           # Playwright specs
├── fixtures/      # envelope builders + sample entities
├── mocks/         # MSW handlers + node/browser servers
└── setup/         # vitest setup + provider-aware render helper
```

| Layer       | Tool                       | Location             | Command               |
| ----------- | -------------------------- | -------------------- | --------------------- |
| Unit        | Vitest + Testing Library   | `tests/unit`         | `pnpm test`           |
| Integration | Vitest + MSW               | `tests/integration`  | `pnpm test`           |
| Component   | Storybook + Vitest browser | `src/**/*.stories.*` | `pnpm test:storybook` |
| End-to-end  | Playwright                 | `tests/e2e`          | `pnpm test:e2e`       |

- **Network mocking:** MSW. Node server `tests/mocks/server.ts` (wired in
  `tests/setup/vitest.setup.ts`); browser worker `tests/mocks/browser.ts`;
  shared handlers `tests/mocks/handlers.ts`. Unhandled requests fail tests.
- **Fixtures:** build envelopes with `@tests/fixtures/api`.
- **Rendering:** use `render` from `@tests/setup/render` (wraps components in the
  platform providers) instead of Testing Library's raw `render`.
- **Aliases:** `@/…` → `src`, `@tests/…` → `tests`.
