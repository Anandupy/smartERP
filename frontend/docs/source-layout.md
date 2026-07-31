# Source Layout

The project separates **application source** from **everything else**, mirroring
the backend's philosophy.

## What lives where

| Location  | Contents                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/`    | All application code (see [Folder Structure](./folder-structure.md)).                                                    |
| `tests/`  | All tests + test infrastructure (kept out of `src`).                                                                     |
| `docs/`   | Engineering documentation.                                                                                               |
| `public/` | Static files served as-is.                                                                                               |
| root      | Tooling/config only: `package.json`, `tsconfig.json`, `next.config.ts`, ESLint, Prettier, Vitest, Playwright, Storybook. |

## Why `src/`

- **One obvious home for code.** Config noise stays at the root; everything you
  author lives under `src`.
- **Cleaner tooling globs.** Lint/format/type scopes map to `src` and `tests`.
- **Next.js native support.** The App Router is detected at `src/app` with no
  extra configuration.

## Aliases

`tsconfig.json` defines:

```jsonc
"paths": {
  "@/*": ["./src/*"],       // application imports
  "@tests/*": ["./tests/*"] // test-only infrastructure
}
```

`vitest.config.ts` mirrors both aliases. Application code imports with `@/…`;
tests may use `@/…` for source under test and `@tests/…` for fixtures, mocks,
and setup.

## Tooling wired to this layout

| Tool       | Configuration                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| TypeScript | `@/*` → `src/*`, `@tests/*` → `tests/*`.                                                              |
| Next.js    | Auto-detects `src/app`; no change to `next.config.ts`.                                                |
| Vitest     | `resolve.alias` mirrors tsconfig; includes `tests/{unit,integration}` and co-located `src/**/*.test`. |
| Playwright | `testDir: ./tests/e2e`.                                                                               |
| Storybook  | stories glob `../src/**/*.stories.*`.                                                                 |
| shadcn     | `components.json` css → `src/app/globals.css`; aliases via `@`.                                       |
| MSW        | handlers in `tests/mocks`; import source config via `@`.                                              |
