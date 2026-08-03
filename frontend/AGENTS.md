# CampusFlow ERP — Frontend AI Engineering Guide

> **This file is the single source of truth for every AI coding assistant**
> (Claude Code, Codex, Cursor, Gemini CLI, …) working in `frontend/`. Read it in
> full before modifying anything. It is an **index + rulebook**, not a manual —
> detailed explanations live in [`docs/`](./docs/README.md). Keep it in sync:
> see [§25](#25-when-agentsmd-itself-must-be-updated).

Scope: this guide covers the **frontend workspace only** (`D:/ERP/frontend`).
The backend lives in a sibling workspace and is out of scope here; the only
shared contract is the API response envelope ([§21](#21-backend-api-response-contract)).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## 1. Project Overview

CampusFlow ERP frontend is an **enterprise platform foundation** built to support
100+ pages across many ERP modules (Auth, Admissions, Students, Attendance, Fees,
HR, Payroll, Library, Transport, Examination, Reports, Settings, …) **without
restructuring**. This repo ships the platform (core, providers, design system,
testing, feature scaffolding); business modules are added under `src/features/*`.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind
CSS v4 · shadcn/ui (Radix) · TanStack Query/Table/Virtual · React Hook Form ·
Zod · Axios · Zustand · next-themes · Sonner · Motion · Lucide · Vitest ·
Playwright · MSW · ESLint · Prettier · Husky · lint-staged.

## 2. Repository Structure

```
frontend/
├── src/            # ALL application source (aliased @/*)
├── tests/          # ALL tests (aliased @tests/*) — never inside src
├── docs/           # engineering documentation (detailed reference)
├── public/         # static assets served as-is
├── AGENTS.md       # this file · CLAUDE.md re-exports it via @AGENTS.md
└── config: package.json, tsconfig.json, next.config.ts, eslint.config.mjs,
           .prettierrc.json, vitest.config.ts, playwright.config.ts,
           components.json, .env.example (every supported env var)
```

Full tree and rationale: [`docs/folder-structure.md`](./docs/folder-structure.md)
and [`docs/source-layout.md`](./docs/source-layout.md).

## 3. High-Level Architecture

Layered, feature-first, one-way dependencies. See
[`docs/architecture.md`](./docs/architecture.md).

```
app  →  features  →  components / shared  →  core  →  config / constants / types
                       ↘ hooks / lib / utils / services / schemas / store ↗
```

- **core** = cross-cutting platform (api, auth, query, startup, theme, workspace)
  with zero business logic.
- **features** = the only place domain logic lives; fully isolated.
- **shared / components** = generic, presentational; no business logic.

## 4. Required Reading Order

Always read top-down before implementing:

```
AGENTS.md (this file)
      ↓
docs/architecture.md  +  docs/source-layout.md
      ↓
module docs for the area you touch
  (docs/api-layer.md, docs/response-handling.md, docs/core-platform.md,
   docs/providers.md, docs/layouts.md, docs/state-management.md,
   docs/forms.md, docs/error-handling.md, docs/authentication.md,
   docs/workspace.md, docs/dashboard-shell.md,
   docs/administration-modules.md, docs/backend-gaps.md,
   docs/theme-integration.md)
      ↓
docs/contributing.md  +  src/features/_template  (feature conventions)
      ↓
Implement → verify (§24) → update docs (§9) → commit (§11)
```

Doc index: [`docs/README.md`](./docs/README.md).

## 5. Coding Standards

Full detail: [`docs/coding-standards.md`](./docs/coding-standards.md). Essentials:

- **Strict TypeScript, no `any`.** Use `unknown` + narrowing or precise types.
- Server Components by default; add `"use client"` only for state/effects/browser
  APIs/context.
- Files `kebab-case`; components `PascalCase`; hooks `useX`; schemas `*.schema.ts`;
  services `*.service.ts`; query keys `*.keys.ts`.
- Import via `@/…` (never deep relative across layers); expose modules through
  `index.ts` barrels. Import order: node/react → third-party → `@/` → relative.
- Style with `cn()` and semantic design tokens — never hard-coded colors/shadows.
- Keep `src/app/*` files thin; delegate to features and shared components.

## 6. Folder Responsibilities

| Path                                                | Responsibility                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`                                           | Routing, layouts, route-level error/loading/404 (thin).                                                                                                 |
| `src/features/*`                                    | Business modules; the only place with domain logic. Shipped: `auth`, `workspace`, `navigation`, `dashboard`, `system-settings`, `maintenance`, `audit`. |
| `src/components/{ui,form,layouts}`                  | Design-system primitives, form infra, layout shells.                                                                                                    |
| `src/shared/components/{data,data-display,overlay}` | Table system, tiles/badges/cards, dialogs and drawers.                                                                                                  |
| `src/shared`                                        | Cross-feature presentational building blocks + error boundary.                                                                                          |
| `src/core/{api,auth,query,startup,theme,workspace}` | Platform infrastructure; no business logic.                                                                                                             |
| `src/providers`                                     | Client provider composition root.                                                                                                                       |
| `src/services`                                      | Transport service factories features build on.                                                                                                          |
| `src/store`                                         | Platform-only Zustand stores (UI + preferences).                                                                                                        |
| `src/hooks` `src/lib` `src/utils`                   | Generic reusable helpers.                                                                                                                               |
| `src/schemas`                                       | Shared Zod schemas.                                                                                                                                     |
| `src/config` `src/constants` `src/types`            | Env/app config, constants, shared contracts.                                                                                                            |
| `src/styles` `src/assets`                           | Design-token CSS, curated icons/static accessors.                                                                                                       |

## 7. Dependency Rules

- Dependencies flow **one way** (see §3). Never make a lower layer import a higher one.
- **Features are isolated:** a feature may import `core`, `shared`, `components`,
  `hooks`, `lib`, `utils`, `services`, `schemas`, `types`, `config` — **never
  another feature's internals**. Import a feature only through its `index.ts`.
- Cross-feature needs are **promoted up** into `shared`/`core`, never imported sideways.
- `components/ui` and `shared` contain **no business logic**.
- Only `config/*` reads `process.env` (via the validated `env` module).

## 8. Module Development Workflow

1. Read the reading order (§4) and [`docs/contributing.md`](./docs/contributing.md).
2. `cp -r src/features/_template src/features/<name>` (see §23).
3. Replace the example entity/schema/service with the real domain.
4. Build services on `services/createResourceService`; keys on `core/query/createQueryKeys`.
5. Add query/mutation hooks (`hooks/`), feature UI (`components/`), Zod schemas (`schemas/`).
6. Export the public surface from the feature `index.ts` (the only import entry point).
7. Add thin pages under the right route group in `src/app/` ([§ layouts](./docs/layouts.md)).
8. Verify (§24) → update docs (§9) → commit (§11).

## 9. Documentation Rules

- **Docs must never drift from implementation.** Update docs in the **same commit**
  that changes the behavior they describe.
- Detailed explanations go in `docs/`; AGENTS.md only **indexes and rules** — do
  not duplicate large content here.
- New platform capability → add/extend the matching `docs/*.md` and link it from
  [`docs/README.md`](./docs/README.md).
- Architecture change → also update AGENTS.md (§25).

## 10. Testing Rules

Full detail: [`docs/testing.md`](./docs/testing.md).

- Tests live under `tests/{unit,integration,e2e,fixtures,mocks,setup}` — never in `src`.
- Mock at the **network boundary** with MSW (`tests/mocks`), not the module boundary;
  build responses with `tests/fixtures` envelope builders. Unhandled requests fail tests.
  The one sanctioned module mock is the App Router (`@tests/mocks/next-navigation`),
  a framework boundary jsdom cannot provide.
- Render components with `render` from `@tests/setup/render` (wraps platform providers).
- Prefer role/text queries over test ids. Add/adjust tests for every behavior change.
- `pnpm test` = Vitest unit + integration; `pnpm test:e2e` = Playwright; `pnpm
test:storybook` = browser component tests.

## 11. Commit Rules

- **Conventional Commits**, scoped, atomic — one architectural responsibility per commit.
- Never mix unrelated changes; preserve git rename detection (stage a move's
  deletion + addition together).
- Update docs in the same commit as the feature (§9).
- End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Do not commit or push until **all verification gates pass** (§24). Do not skip hooks.

## 12. Review Checklist

Before committing, confirm:

- [ ] No `any`; strict types; imports resolve via `@/`/`@tests/`.
- [ ] Dependency + isolation rules honored (§7).
- [ ] No business logic in `components/ui` or `shared`.
- [ ] Errors normalized through `ApiError`; envelopes handled via `api`/`getEnvelope`.
- [ ] Mobile-first, token-based styling; a11y roles/labels present.
- [ ] Tests updated; docs updated (§9); AGENTS.md updated if architecture changed (§25).
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all green.

## 13. Do

- Reuse platform primitives (`api`, `createResourceService`, `createQueryKeys`,
  `useZodForm`, feedback/layout components, hooks).
- Keep the API/query/theme layers UI-agnostic and configurable via their seams.
- Branch UI on `ApiError.kind`; surface friendly copy via `getErrorMessage`.
- Keep `src/app` thin and Server-Component-first.

## 14. Don't

- Don't import one feature from another, or reach past a barrel.
- Don't hard-code business logic, colors, shadows, header values, or `process.env`.
- Don't add business logic to `shared`/`components/ui`.
- Don't implement dynamic theming or theme-customization UI (still out of scope).
- Don't invent auth endpoints, payloads, or response shapes. The verified
  contract is in [`docs/authentication.md`](./docs/authentication.md); the
  Postman collection records no response bodies and is wrong about logout.
- Don't build password recovery around OTP — the backend uses an **emailed
  reset link**, and `verify-otp` issues no token.
- Don't scatter account-lock detection: it lives only in
  `features/auth/utils/auth-errors.ts`, and backend messages are displayed
  verbatim, never parsed for a duration.
- Don't send form-only fields to the backend (`rememberMe`, `confirmPassword`):
  it runs `forbidNonWhitelisted`, so an extra property is a 400. Translation
  belongs in `features/auth/mappers`.
- Don't put startup/navigation decisions in page components — they belong in
  `core/startup` ([§26](#26-application-startup-flow)) or, after sign-in, in
  `core/workspace` ([§27](#27-workspace-scope)).
- Don't read the active organization/branch/academic year from anywhere but
  `useWorkspace()`, and don't re-implement its filtering — `narrowSelection`,
  `branchesFor` and `academicYearsFor` are the only implementations.
- Don't build a bespoke loading/empty/error panel. `shared/components/feedback`
  owns them, and `ApiErrorState` is the only place `ApiError.kind` becomes UI.
- Don't hand-roll a list. `shared/components/data` owns the table system
  (`DataTable` + toolbar + pagination + sortable header) and already resolves
  loading/error/empty/loaded; features supply column definitions only.
- Don't invent a backend contract to fill a screen. Where the docs and Postman
  record no endpoint, request or response, ship the UI, disable the write, and
  mark it with `BackendPendingBadge` / `BackendPendingNote`
  ([§28](#28-contract-driven-modules)).
- Don't leave TODOs that break compilation, or skip verification gates.

## 15. Common Mistakes

- Assuming stale Next.js APIs — this is Next 16 (e.g. `error.tsx` uses
  `unstable_retry`, `params` is a `Promise`). Read `node_modules/next/dist/docs/`.
- Reading `process.env` directly instead of `@/config`.
- Hand-writing query keys instead of `createQueryKeys`.
- Consuming raw Axios errors instead of the normalized `ApiError`.
- Forgetting `meta.pagination` — use `api.getEnvelope` for lists.
- Adding tests inside `src/`, or hitting real network in tests.

## 16. Performance Rules

- Server Components by default; push `"use client"` to the leaves.
- Respect TanStack Query cache defaults; use `createQueryKeys` for precise
  invalidation; don't over-fetch or duplicate server state in Zustand.
- Use `@tanstack/react-virtual` for large lists/tables.
- Lazy-load heavy client-only widgets; keep the root layout minimal.

## 17. Security Rules

- Never persist secrets in code or client storage. Access token defaults to
  in-memory storage (`core/auth` token-storage abstraction).
- Never trust or render unsanitized server data; avoid `dangerouslySetInnerHTML`.
- Only `NEXT_PUBLIC_*` env is client-readable and must pass through validated `@/config`.
- Auth/permission checks via `core/auth` (`ProtectedRoute`, `usePermissions`);
  client guards are convenience only — pair with server checks.

## 18. Accessibility Rules

- Use semantic elements and Radix/shadcn primitives; preserve their a11y wiring.
- Every interactive control has an accessible name; associate labels/descriptions
  (the form layer does this — see [`docs/forms.md`](./docs/forms.md)).
- Loading/empty/error states use the `shared` feedback components (correct
  `role`/`aria-live`). Maintain visible focus and keyboard operability.

## 19. Responsive Design Rules

- **Mobile-first, no fixed pixel layout widths.** Support 320→1920px.
- Use breakpoints from `constants/breakpoints.ts` and the `useBreakpoint`/
  `useIsMobile` hooks; use `Container`/responsive utilities, not magic numbers.
- See [`docs/layouts.md`](./docs/layouts.md).

## 20. Future Workspace Theme Rules

- Dynamic/per-workspace theming is **not implemented** — only the abstraction ships.
- Always style against **semantic tokens** (`bg-primary`, `var(--elevation-md)`),
  never literals, so future themes restyle automatically.
- Add token interfaces to `src/core/theme/types.ts` and values to
  `src/styles/design-tokens.css` **together**. Register themes via `themeRegistry`
  / `registerWorkspaceTheme`. Do not build theme-customization UI.
- Detail: [`docs/theme-integration.md`](./docs/theme-integration.md).

## 21. Backend API Response Contract

The backend always returns one of two envelopes; the frontend never leaks raw
wire shapes into features. Full detail: [`docs/response-handling.md`](./docs/response-handling.md).

```ts
// success
{ success: true,  message: string | null, data: T, meta: ApiMeta | null, error: null }
// failure
{ success: false, code: string, message: string, requestId?: string, timestamp?: string }
```

- The backend is **versioned**. `NEXT_PUBLIC_API_URL` is the unversioned root and
  `NEXT_PUBLIC_API_VERSION` (`v1` today) is appended once in `config/api.config.ts`.
  Never write a version segment into a service path.
- The 401 seam (`setUnauthorizedHandler`) may resolve `true` to replay a request
  **once**; the auth feature uses it for a single-flight refresh. Tokens reach
  the client only through `headerRegistry` — core never learns what a token is.
- `api.get/post/…` unwrap `data`; `api.getEnvelope` returns `data` + `meta`
  (pagination in `meta.pagination`).
- Failures are normalized to a typed **`ApiError`** (`kind`, `status`, `code`,
  `requestId`, `timestamp`, `fieldErrors`); branch on `error.kind`.
- `Result`/`toResult` provide throw-free call sites; `applyServerFieldErrors`
  binds field errors to forms. See [`docs/api-layer.md`](./docs/api-layer.md).

## 22. Provider Architecture

Single client composition root in `src/providers` (`AppProviders`), mounted once
in `src/app/layout.tsx`. Order matters:

```
ThemeProvider → QueryProvider → SessionProvider → AuthProvider →
PermissionProvider → WorkspaceProvider → TooltipProvider
                                         (+ theme-aware Toaster)
```

`QueryProvider` owns the toast dependency so `core/query` stays UI-free. Detail:
[`docs/providers.md`](./docs/providers.md). Header providers for Authorization /
Tenant / Branch / Academic-Year / Workspace / Request-Id are registered via
`headerRegistry` — configurable, never hard-coded ([`docs/api-layer.md`](./docs/api-layer.md)).

## 23. Feature Template Usage

- Start every module from `src/features/_template` (compile-checked reference).
- Anatomy: `api/` (service + keys), `components/`, `hooks/`, `schemas/`,
  optional `store/`, `types.ts`, `index.ts` (public surface). Modules that must
  reconcile a form shape with a different wire shape add `types/` (DTOs),
  `mappers/`, and `utils/` — see `features/auth` for the reference.
- Follow the rules in `src/features/README.md` and §7. Detail on wiring:
  [`docs/contributing.md`](./docs/contributing.md).

## 24. Required Verification Gates

Run from `frontend/` and fix everything before committing/pushing:

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest unit + integration
pnpm build       # Next.js production build
```

Also available: `pnpm format:check`, `pnpm test:e2e`, `pnpm test:storybook`.
A documentation-only change must introduce **no code changes** and must still
pass all four gates.

## 25. When AGENTS.md Itself Must Be Updated

Update this file (and the relevant `docs/*.md`) whenever any of these change:

- Folder structure, path aliases, or dependency rules.
- Core platform seams (API client/envelope, headers, auth, query, theme,
  workspace scope).
- Provider composition or its order.
- Testing structure, tooling, or verification gates.
- Coding/commit/documentation standards, or the feature-module convention.

- The set of shipped feature modules, or the contract-driven rules in §28.

Rule: **documentation must never drift from implementation.** If a change makes
any statement here false, fix it in the same commit. Keep this file concise
(~250–400 lines) — push detail into `docs/` and cross-reference it.

## 26. Application Startup Flow

Where the app goes after `/splash` is **one decision in one place** — `core/startup`.
Never hard-code navigation in a page component.

- `resolveStartupRoute(context)` is the pure policy function; `useStartupRoute()`
  reads the first-run flag through the `OnboardingStorage` seam.
- The flag lives under `campusflow.onboarding.completed` and is **independent of
  authentication**: a returning visitor with an expired session still skips welcome.
- The onboarding check is temporary. Session validation slots into the resolver's
  existing `session` parameter — do not restructure it, and do not implement
  session/token validation until that phase.

Detail: [`docs/authentication.md`](./docs/authentication.md) and
[`docs/core-platform.md`](./docs/core-platform.md).

## 27. Workspace Scope

Every ERP screen operates inside one organization, one branch and one academic
year. That scope is platform, not feature state.

- **Consume it one way:** `const { organization, branch, academicYear } =
useWorkspace()` from `@/core/workspace`. Never re-fetch it, never prop-drill it.
- **`core/workspace` decides, `features/workspace` fetches and renders.** The
  feature owns `GET /auth/me`, its mapper and the selection screen; the policy,
  store, storage seam, headers and guards live in core.
- **One policy function.** `resolveWorkspaceAccess` returns `ready` /
  `selecting` / `unavailable`. Selection is required for
  `ROLES_REQUIRING_SELECTION` (`SUPER_ADMIN`, `ORG_ADMIN`); every other role is
  scoped by the backend and never sees the screen.
- **Whether a resolvable scope may skip the screen is a setting, not a rule.**
  `canSkipSelection` is the only place it is decided, reading
  `alwaysShowSelection` from the `workspace-settings` seam (shipped `true`, so a
  single-workspace user still confirms with **Continue**). The seam exists so a
  future backend setting needs no refactor — the resolver stays pure and takes
  the policy as an argument.
- **`context` from `/auth/me` is a default, not a command.** Seeding order is
  remembered selection → backend default → nothing, always clamped to what is
  currently offered.
- **Scope headers (`X-Tenant-Id`, `X-Branch-Id`, `X-Academic-Year`) are sent
  only when the scope is `ready`**, so a half-made selection never reaches the
  wire.
- Sign-out must clear the scope — it is persisted and would otherwise carry to
  the next user on that machine.

Detail: [`docs/workspace.md`](./docs/workspace.md).

## 28. Contract-Driven Modules

Business modules are wired **only** from `backend/docs/` and the Postman
collection. Backend source is never read, and no request or response is
inferred.

- **Where a contract is missing, the screen still ships** — laid out, validated,
  wired to its query hooks — with writes disabled and the gap declared through
  `BackendPendingBadge` / `BackendPendingNote`. Grep `BACKEND_PENDING_LABEL` to
  enumerate every one.
- **DTOs record their source.** `types/*.dto.ts` names which document each field
  came from, and types anything absent from the documented data structure as
  optional rather than assuming it arrives.
- **An undocumented response is `unknown`, never a guessed interface.** Narrow it
  with a defensive reader that accepts the plausible shapes and reports
  `isUnrecognized` otherwise, so a wrong guess degrades to a visible marker and
  never to a fabricated figure (`readActiveStatus`, `readSummary`,
  `readTimeline`).
- **No partial write unless the backend documents one.** Both settings and
  maintenance rebuild the complete documented body from the loaded record plus
  the user's edits.
- **Two features that meet do so at the route**, through slots — never by
  importing each other.

Detail: [`docs/administration-modules.md`](./docs/administration-modules.md),
[`docs/dashboard-shell.md`](./docs/dashboard-shell.md), and the running gap
inventory in [`docs/backend-gaps.md`](./docs/backend-gaps.md).
