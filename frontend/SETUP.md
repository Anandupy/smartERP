# EduOS Frontend — Developer Quickstart

## First-time setup

```bash
cd ERP/frontend

# 1. Install all dependencies
pnpm install

# 2. Copy and fill environment variables
cp .env.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:3000/v1

# 3. shadcn/ui is already initialized (Radix style, Nova preset)
#    globals.css and package.json already include shadcn configuration.
#    If you need to add more components:
pnpm dlx shadcn@latest add button input label select badge card table \
  dialog drawer tabs command form separator skeleton tooltip popover \
  dropdown-menu context-menu alert alert-dialog avatar checkbox \
  collapsible progress scroll-area switch

# 5. Install Playwright browsers (for E2E tests)
pnpm dlx playwright install chromium firefox

# 6. Set up Husky pre-commit hooks
pnpm prepare
# Then copy husky-pre-commit.sh content to .husky/pre-commit
# chmod +x .husky/pre-commit

# 7. Start development server
pnpm dev
```

## Quality gates (run before every commit)

```bash
pnpm lint          # ESLint — must pass with 0 warnings
pnpm type-check    # TypeScript — must have 0 errors
pnpm test          # Vitest unit tests — must all pass
pnpm build         # Next.js build — must succeed
```

## Architecture summary

See `docs/` for detailed documentation:
- `docs/architecture.md` — folder structure, component categories
- `docs/auth-strategy.md` — token storage, login flow, refresh
- `docs/state-management.md` — Zustand stores, TanStack Query
- `docs/routing.md` — route groups, protection, URL conventions
- `docs/theme-architecture.md` — CSS variables, Theme Studio
- `docs/context-architecture.md` — ERP context bar
- `docs/conventions.md` — naming, patterns, accessibility
- `docs/setup.md` — full setup guide

## What was built (Phase 1 Foundation)

- Next.js 15 App Router with TypeScript strict mode
- Complete folder structure (modules, core, components, stores, lib, types)
- 4 Zustand stores with SSR-safe persistence and hydration guards
- Axios API client with TokenService abstraction, interceptors, silent refresh
- Application Shell (Sidebar, TopBar, ContextBar) — fully accessible
- Login page + auth flow (forgot/reset password shells)
- Next.js middleware for route protection
- Theme Engine (CSS variables, next-themes, ThemeStudioProvider)
- Driver.js tour architecture with registry
- Setup Wizard foundation
- DataTable engine (TanStack Table v8)
- TreeView engine (ARIA-accessible, keyboard navigation)
- Shared components (StatusBadge, KPITile, EmptyState, ErrorBoundary)
- Global command menu (CMD+K)
- Testing infrastructure (Vitest + RTL + Playwright)
- Full architecture documentation

## What is NOT built yet (Phase 2+)

- Organization module (awaiting approval)
- Branch module
- Academic Year module
- Program module
- Academic Unit module
- Admissions module (awaiting backend contract — GAP-03)
- Audit module (awaiting backend contract — GAP-04)
- Theme Studio API persistence (awaiting backend — GAP-05)
- Forgot password / reset password API (awaiting backend — GAP-02)
- Dashboard widgets
- shadcn/ui components (must be installed via CLI — see step 4 above)
