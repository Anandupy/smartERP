# Architecture

## Principles

- **Source under `src/`.** All application code lives in `src/` (aliased as
  `@/…`); tests, docs, and config stay at the root. See
  [Source Layout](./source-layout.md).
- **Feature-first & isolated.** Each ERP domain lives under `src/features/<name>`
  and exposes a single `index.ts`. Features never import each other's internals;
  anything shared is promoted into `core` or `shared`.
- **Layered dependencies flow one way.** Higher layers may depend on lower ones,
  never the reverse:

  ```
  app  →  features  →  components / shared  →  core  →  config / constants / types
                         ↘ hooks / lib / utils / services / schemas / store ↗
  ```

- **No business logic in shared UI.** `components/` and `shared/` are generic and
  presentational. Domain rules live in features.
- **Cross-feature needs move up, never sideways.** When a second feature needs
  something, it is promoted into `shared` or `core` rather than imported from
  its current owner — as `BrandMark`/`BrandCanvas` were when workspace selection
  joined authentication in opening on the brand, and as the workspace _scope_
  is, so that every future module reads it from `core/workspace`. See
  [Workspace](./workspace.md).
- **Swappable platform seams.** Auth, theming, tokens, headers, token storage,
  and the response envelope are behind interfaces so unfinished backends can be
  filled in later without touching consumers.
- **Strict typing.** `strict` TypeScript, no `any`, normalized error shapes.

## Layer responsibilities

| Layer                                  | Responsibility                                                 |
| -------------------------------------- | -------------------------------------------------------------- |
| `app`                                  | Routing, layouts, route-level error/loading/404 (thin).        |
| `features`                             | Business modules; the only place with domain logic.            |
| `components`                           | Design-system primitives (`ui`), form infra, layout shells.    |
| `shared`                               | Cross-feature presentational building blocks + error boundary. |
| `core`                                 | API transport, auth contracts, query config, theming, scope.   |
| `providers`                            | Client provider composition root.                              |
| `hooks`/`utils`/`lib`                  | Generic, reusable, framework-light helpers.                    |
| `services`                             | Transport service factories features build on.                 |
| `store`                                | Platform-only Zustand stores (UI + preferences).               |
| `config`/`constants`/`types`/`schemas` | Foundation: env, tokens, contracts.                            |

## Why this scales to 100+ pages

- Adding a module = copy `src/features/_template`, add a route under `src/app/` —
  no edits to platform code.
- One API client, one query config, one error contract, one design token source.
- Barrel exports keep import paths stable during refactors.
