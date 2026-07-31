# Features

Each feature is a **self-contained, isolated module** for one ERP domain (Auth,
Students, Fees, …). Features may depend on `core`, `shared`, `components`,
`hooks`, `lib`, `utils`, `services`, `schemas`, `types`, and `config` — but
**never** on another feature's internals. Cross-feature sharing is promoted up
into `shared`/`core`, never imported sideways.

## Anatomy

Copy `_template/` to start a new feature. A feature typically contains:

```
features/<name>/
├── api/            # services (transport) + query keys
├── components/     # feature-specific UI (composes shared + ui)
├── hooks/          # data + interaction hooks (useQuery/useMutation)
├── schemas/        # Zod schemas for this feature's forms/DTOs
├── store/          # optional feature-scoped Zustand store
├── types.ts        # feature DTOs and view models
└── index.ts        # public surface — the ONLY thing outside code imports
```

## Rules

- No business logic in `shared` or `components/ui`. Those stay generic.
- Import a feature only through its `index.ts` barrel.
- Build services on `services/createResourceService` and keys on
  `core/query/createQueryKeys` for consistency.
- Pages under `app/` should be thin: they render feature components/hooks.
