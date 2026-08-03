# CampusFlow ERP — Frontend Documentation

Engineering documentation for the CampusFlow ERP frontend platform. This is a
**scalable architecture foundation**: core platform, providers, design system,
and feature scaffolding designed to support 100+ pages across many ERP modules
without restructuring.

## Contents

1. [Architecture](./architecture.md)
2. [Source Layout](./source-layout.md)
3. [Folder Structure](./folder-structure.md)
4. [Core Platform](./core-platform.md)
5. [API Layer](./api-layer.md)
6. [Response Handling](./response-handling.md)
7. [Providers](./providers.md)
8. [Layouts](./layouts.md)
9. [State Management](./state-management.md)
10. [Forms](./forms.md)
11. [Error Handling](./error-handling.md)
12. [Authentication Screens & Startup Flow](./authentication.md)
13. [Workspace Scope Platform](./workspace.md)
14. [Dashboard Shell](./dashboard-shell.md)
15. [Administration Modules](./administration-modules.md)
16. [Organization Module](./organization-module.md)
17. [Backend Contract Gaps](./backend-gaps.md)
18. [Testing Strategy](./testing.md)
19. [Coding Standards](./coding-standards.md)
20. [Contribution Guide](./contributing.md)
21. [Future Theme Integration](./theme-integration.md)

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn/ui (Radix) · TanStack Query/Table/Virtual · React Hook Form · Zod ·
Axios · Zustand · next-themes · Sonner · Motion · Lucide · Vitest · Playwright ·
MSW · ESLint · Prettier · Husky · lint-staged.

## Verification

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest unit/integration (jsdom)
pnpm build       # Next.js production build
```
