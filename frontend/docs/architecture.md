# EduOS ERP — Frontend Architecture

## Overview

EduOS is a multi-tenant Educational ERP Platform. The frontend is a **Next.js 15** application using the **App Router**, built for long-term maintainability (5–10 year horizon).

---

## Technology Stack

| Concern | Technology | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR, RSC, routing |
| Language | TypeScript (strict) | Type safety |
| Styling | TailwindCSS + CSS vars | Design token system |
| UI Components | shadcn/ui — **Radix style, Nova preset** | Accessible, composable |
| Server State | TanStack Query v5 | Caching, mutations, sync |
| UI State | Zustand v5 | Lightweight, typed |
| HTTP | Axios | Interceptors, error handling |
| Forms | React Hook Form + Zod | Performance, validation |
| Theme | next-themes + CSS vars | Dark/light/system |
| Icons | Lucide React | Consistent icon system |
| Toasts | Sonner | Non-blocking notifications |
| Tours | Driver.js | Onboarding flows |
| Charts | Recharts | Dashboard visualizations |
| DnD | @dnd-kit | Tree drag-and-drop |
| Testing | Vitest + RTL + Playwright | Unit + E2E |

---

## Folder Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (public)/           # No auth — /maintenance
│   ├── (auth)/             # Unauthenticated — /login, /setup, /forgot-password
│   ├── (dashboard)/        # Protected — all ERP routes
│   ├── globals.css         # Global CSS + design tokens
│   └── layout.tsx          # Root layout
│
├── modules/                # Feature modules (feature-first architecture)
│   ├── auth/               # Authentication module
│   ├── dashboard/          # Dashboard module
│   ├── organization/       # Organization management
│   ├── branch/             # Branch management
│   ├── academic-year/      # Academic year lifecycle
│   ├── program/            # Program hierarchy
│   ├── academic-unit/      # Academic unit tree
│   ├── admissions/         # Admissions pipeline
│   ├── system-settings/    # System configuration
│   ├── theme-studio/       # Theme customization
│   ├── audit/              # Audit logs
│   └── users/              # User management
│
├── components/             # Shared UI components
│   ├── layout/             # AppShell, Sidebar, TopBar, ContextBar
│   ├── ui/                 # shadcn/ui components (auto-generated)
│   └── shared/             # Cross-module components
│
├── core/                   # Cross-cutting concerns
│   ├── providers/          # React context providers
│   ├── tours/              # Driver.js tour registry
│   ├── plugins/            # Plugin extension architecture
│   └── guards/             # Auth and permission guards
│
├── hooks/                  # Global custom hooks
├── stores/                 # Zustand stores
├── lib/                    # Utilities, API client, constants
├── types/                  # Global TypeScript types
└── config/                 # App configuration
```

---

## Module Structure

Each module under `src/modules/` is self-contained:

```
modules/[module-name]/
├── api/         # API functions (axios calls)
├── components/  # Module-specific components
├── hooks/       # Data hooks (useQuery, useMutation)
├── schemas/     # Zod validation schemas
├── types/       # Module-specific TypeScript interfaces
└── index.ts     # Public API (barrel export)
```

Modules expose a clean public API via `index.ts`. Cross-module imports only go through `index.ts`, never into internal files.

---

## Component Categories

### 1. Server Components (default)
- Route pages (`app/(dashboard)/*/page.tsx`)
- Layout files
- Static UI that doesn't need interactivity

### 2. Client Components (`'use client'`)
- Interactive forms, buttons
- Components using Zustand stores
- Components using browser APIs
- Components with `useState`/`useEffect`

### 3. Shared Components (`components/shared/`)
- `DataTable` — reusable table engine
- `TreeView` — hierarchical data display
- `StatusBadge` — status pill component
- `KPITile` — dashboard metric card
- `EmptyState` — empty list/error states
- `ConfirmDialog` — destructive action confirmation
- `CommandMenu` — CMD+K global search
- `DetailDrawer` — slide-in detail panel
- `ErrorBoundary` — module-level error containment

---

## Engineering Principles

1. **Feature-first architecture** — modules are self-contained, portable
2. **Strong module boundaries** — no cross-module internal imports
3. **Server Components by default** — minimize client bundle
4. **SSR-safe patterns** — no browser APIs in server components
5. **Hydration safety** — Zustand persistence with mounted guards
6. **No any types** — TypeScript strict, no ESLint bypasses
7. **Clean dependency flow** — components → hooks → api functions → types
8. **Business logic in hooks** — never in pages or components directly
