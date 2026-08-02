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
- Import a feature only through its `index.ts` barrel — and **never from
  another feature**, not even its barrel. When two features need the same
  thing, promote it: `BrandMark`/`BrandCanvas` moved to `shared`, and the
  workspace scope lives in `core/workspace`. Where two features genuinely have
  to meet, the **route** composes them (see `app/(workspace)/workspace/page.tsx`,
  which passes auth's `SignOutButton` into the workspace screen's slot).
- Build services on `services/createResourceService` and keys on
  `core/query/createQueryKeys` for consistency.
- Pages under `app/` should be thin: they render feature components/hooks.
