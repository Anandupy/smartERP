# Coding Standards

## TypeScript

- `strict` mode; **no `any`** — use `unknown` + narrowing, or precise types.
- Model data with `interface`/`type` in `types/` or the owning feature.
- Prefer discriminated unions (e.g. `ApiErrorKind`) over boolean flags.
- Public module APIs are exported via `index.ts` barrels.

## Naming

- Files: `kebab-case.ts(x)`. React components: `PascalCase`. Hooks: `useX`.
- Schemas: `*.schema.ts`. Services: `*.service.ts`. Query keys: `*.keys.ts`.
- Constants: `SCREAMING_SNAKE_CASE` for frozen registries.

## React / Next

- Server Components by default; add `"use client"` only when needed (state,
  effects, browser APIs, context).
- Keep `src/app/` files thin — delegate to features and shared components.
- Guard client-only rendering with `useMounted` to avoid hydration mismatches.
- Follow the bundled Next.js docs in `node_modules/next/dist/docs` — this is
  Next 16 and some APIs differ from older versions (e.g. `error.tsx` uses
  `unstable_retry`, `params` is a Promise).

## Styling

- Tailwind v4, mobile-first, no fixed pixel widths for layout.
- Compose classes with `cn()`. Use design tokens (CSS variables / Tailwind
  utilities) rather than hard-coded colors and shadows.

## Imports

- Use the `@/` alias; import from module barrels, not deep paths.
- Order: node/react → third-party → `@/` internal → relative.

## Tooling

ESLint + Prettier enforce style; Husky + lint-staged run them pre-commit. Run
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` before opening a PR.
