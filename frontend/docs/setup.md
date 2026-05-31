# EduOS Frontend — Setup Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Git

## Initial Setup

```bash
# Navigate to frontend directory
cd ERP/frontend

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your backend URL

# shadcn/ui is already initialized with:
#   Style:  Radix
#   Preset: Nova
#   (globals.css and package.json already reflect this)
#
# If re-initializing from scratch, run:
#   pnpm dlx shadcn@latest init
#   → Select: Radix style, Nova preset, TypeScript, src dir, @/* alias
#
# Add any additional components as needed:
pnpm dlx shadcn@latest add button input label select badge card table dialog \
  drawer tabs command form separator skeleton tooltip popover dropdown-menu \
  context-menu alert alert-dialog avatar checkbox collapsible progress \
  scroll-area switch

# Set up Husky
pnpm prepare
# Create .husky/pre-commit manually (see husky-pre-commit.sh)

# Run development server
pnpm dev
```

## Available Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Start development server (Turbopack) |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint (zero warnings) |
| `pnpm lint:fix` | Run ESLint with auto-fix |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm format` | Run Prettier |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm test:e2e` | Run E2E tests (Playwright) |

## Environment Variables

See `.env.example` for all required variables.

Minimum required for development:
```
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
```

## Quality Gates

Before any commit:
1. `pnpm lint` — must pass with zero warnings
2. `pnpm type-check` — must pass with zero errors
3. `pnpm test` — all tests must pass
4. `pnpm build` — must succeed without errors

Before any PR:
1. All above quality gates
2. `pnpm test:e2e` — all E2E tests pass
3. No `console.log` statements (only `console.warn`/`console.error`)
4. No `any` types without explicit justification comment
5. No hydration warnings in browser console
