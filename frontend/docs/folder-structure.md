# Folder Structure

Application source lives under `src/`. Only tooling, tests, docs, and static
assets stay at the repository root. See [Source Layout](./source-layout.md) for
the rationale and alias configuration.

```
frontend/
├── src/                    # ALL application source
│   ├── app/                # Next.js App Router (routing only)
│   │   ├── (auth)/layout.tsx    # guest-only route group shell
│   │   ├── (app)/layout.tsx     # authenticated route group shell
│   │   ├── (public)/layout.tsx  # public route group shell
│   │   ├── layout.tsx      # root layout (fonts, metadata, providers)
│   │   ├── page.tsx        # landing placeholder
│   │   ├── error.tsx       # route-level error boundary
│   │   ├── global-error.tsx# root error boundary
│   │   ├── loading.tsx     # route-level loading UI
│   │   └── not-found.tsx   # 404
│   ├── features/           # isolated business modules (see _template)
│   ├── components/
│   │   ├── ui/             # shadcn/ui primitives (button, input, label, form)
│   │   ├── form/           # RHF + Zod form infrastructure
│   │   └── layouts/        # Auth/App/Public/Workspace shells
│   ├── shared/             # cross-feature UI: feedback, layout, error boundary
│   ├── core/               # platform: api, auth, query, theme
│   ├── providers/          # provider composition root
│   ├── hooks/              # generic React hooks
│   ├── store/              # Zustand platform stores
│   ├── services/           # resource service factory
│   ├── schemas/            # shared Zod schemas
│   ├── lib/                # third-party glue (cn, error-message)
│   ├── utils/              # pure utilities
│   ├── config/             # env + app/api config
│   ├── constants/          # breakpoints, routes, headers, storage keys, http
│   ├── types/              # shared TS contracts (incl. response envelopes)
│   ├── styles/             # design-token CSS
│   └── assets/             # curated icons, static asset accessors
│
├── tests/                  # ALL tests (kept out of src)
│   ├── unit/               # pure unit tests
│   ├── integration/        # component + API integration tests
│   ├── e2e/                # Playwright specs
│   ├── fixtures/           # shared test data (envelope builders, entities)
│   ├── mocks/              # MSW handlers + node/browser servers
│   └── setup/              # vitest setup + provider-aware render helper
│
├── docs/                   # this documentation
├── public/                 # static assets served as-is
├── package.json · tsconfig.json · next.config.ts
├── eslint.config.mjs · .prettierrc.json · vitest.config.ts · playwright.config.ts
└── .storybook/ · components.json
```

## Path aliases (`tsconfig.json`)

| Alias      | Resolves to | Use                                 |
| ---------- | ----------- | ----------------------------------- |
| `@/*`      | `src/*`     | all application imports             |
| `@tests/*` | `tests/*`   | test infra (fixtures, mocks, setup) |

These aliases are mirrored in `vitest.config.ts`. Because `@/*` points at `src`,
application imports are unchanged by the `src` migration.

## Barrel exports

Every top-level module has an `index.ts`. Import from the module root
(`@/core/api`) rather than deep paths, except Next.js file conventions and
shadcn primitives.
