# CampusFlow ERP — Frontend

Enterprise frontend platform for CampusFlow ERP. This repository is a **scalable
architecture foundation** (core platform, providers, design system, and feature
scaffolding) built to support 100+ pages across many ERP modules without
restructuring. Business modules are added under `src/features/*`.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn/ui (Radix) · TanStack Query/Table/Virtual · React Hook Form · Zod ·
Axios · Zustand · next-themes · Sonner · Motion · Lucide · Vitest · Playwright ·
MSW · ESLint · Prettier · Husky · lint-staged.

## Getting started

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Application source lives in `src/`; tests in `tests/`. See
[`docs/`](./docs/README.md) for the full architecture.

## Scripts

| Command               | Purpose                             |
| --------------------- | ----------------------------------- |
| `pnpm dev`            | Start the dev server                |
| `pnpm build`          | Production build                    |
| `pnpm lint`           | ESLint                              |
| `pnpm typecheck`      | `tsc --noEmit`                      |
| `pnpm test`           | Vitest unit + integration (jsdom)   |
| `pnpm test:e2e`       | Playwright end-to-end               |
| `pnpm test:storybook` | Storybook component tests (browser) |
| `pnpm format`         | Prettier write                      |

## Documentation

Start at [`docs/README.md`](./docs/README.md): architecture, source layout,
folder structure, core platform, API layer, response handling, providers,
layouts, state, forms, error handling, testing, coding standards, contributing,
and future theme integration.
