# Contribution Guide

## Prerequisites

- Node 20+, pnpm.
- `pnpm install` (runs `husky` via the `prepare` script to enable git hooks).

## Adding a feature module

1. Copy `src/features/_template` to `src/features/<name>`.
2. Replace the example entity/schema/service with the real domain.
3. Add query/mutation hooks in `hooks/`, feature UI in `components/`.
4. Export the public surface from `index.ts` — the **only** entry point other
   code may import.
5. Add pages under the appropriate route group in `src/app/` (thin — render feature
   components/hooks).

### Rules

- Never import another feature's internals. Promote shared code into
  `shared`/`core`.
- Build services on `createResourceService`, keys on `createQueryKeys`.
- No business logic in `components/ui` or `shared`.

## Adding shared UI

- Atomic primitive → `components/ui` (shadcn conventions, `data-slot`, `cn`).
- Composed, generic, presentational → `shared/components`.

## Commits & hooks

`lint-staged` runs ESLint + Prettier on staged files at commit time. Keep the
build green — do not bypass hooks.

## Definition of done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

All four must pass. Add/adjust tests for new behavior. Update `docs/` when you
change architecture or platform seams.

## Environment

Configure via `NEXT_PUBLIC_*` env vars (see `config/env.ts`, which validates them
at boot). Do not read `process.env` directly outside `config/`.
