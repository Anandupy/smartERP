# State Management

Two distinct kinds of state, kept separate on purpose:

## Server state — TanStack Query

All remote data. Configured in `core/query`. Rules:

- Use `createQueryKeys(namespace)` for keys; never hand-write key arrays.
- Build services on `services/createResourceService`.
- Co-locate query/mutation hooks in the feature (`features/*/hooks`).
- Invalidate with `invalidateKeys`; use `optimisticUpdate` for optimistic writes.

## Client state — Zustand

Only **platform** stores live in `store/`. No business stores here.

| Store                 | Scope                                         | Persistence              |
| --------------------- | --------------------------------------------- | ------------------------ |
| `useUiStore`          | ephemeral UI chrome (sidebar/command menu)    | none                     |
| `usePreferencesStore` | durable UI prefs (density, sidebar collapsed) | Web Storage (namespaced) |

One platform store lives in `core` rather than `store/`:
`core/workspace`'s `useWorkspaceStore`, which holds the active
organization/branch/academic-year scope. It sits beside the policy that computes
it, and it is module-level because the API layer's header providers — plain
functions with no component context — read the same value components do. It
persists **only the three ids** through a swappable storage seam; the entities
are server state and stay in the query cache. See [Workspace](./workspace.md).

Feature-specific client state belongs to a store inside that feature
(`features/*/store`), following the same pattern.

## Choosing

- Comes from / goes to the server → **TanStack Query**.
- UI-only, ephemeral → local `useState` or `useUiStore`.
- UI-only, must survive reloads → `usePreferencesStore` (persisted).
