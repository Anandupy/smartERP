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

Feature-specific client state belongs to a store inside that feature
(`features/*/store`), following the same pattern.

## Choosing

- Comes from / goes to the server → **TanStack Query**.
- UI-only, ephemeral → local `useState` or `useUiStore`.
- UI-only, must survive reloads → `usePreferencesStore` (persisted).
