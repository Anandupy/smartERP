#!/usr/bin/env bash
# ==============================================================
# EduOS Frontend — Granular Git Push Script (bash version)
# Run from the ERP/ root directory:
#   cd /path/to/ERP
#   bash frontend/scripts/git-push.sh
# ==============================================================

set -euo pipefail

# Verify we are at the ERP root
if [ ! -f "frontend/package.json" ]; then
  echo "ERROR: Run this script from the ERP/ root directory."
  exit 1
fi

echo ""
echo "=== EduOS Frontend — Granular Git Push ==="
echo "Working directory: $(pwd)"

# ------------------------------------------------------------------
# Helper: stage paths and commit if there are staged changes
# ------------------------------------------------------------------
commit_group() {
  local message="$1"
  shift
  local paths=("$@")

  # Filter existing paths
  local existing=()
  for p in "${paths[@]}"; do
    [ -e "$p" ] && existing+=("$p")
  done

  if [ ${#existing[@]} -eq 0 ]; then
    echo "  [SKIP] $message — no files found"
    return
  fi

  git add "${existing[@]}"

  if git diff --cached --quiet; then
    echo "  [SKIP] $message — nothing staged (already committed?)"
    return
  fi

  git commit -m "$message"
  echo "  [OK]   $message"
}

# ------------------------------------------------------------------
# Commit 1 — Root gitignore
# ------------------------------------------------------------------
commit_group \
  "chore(root): update gitignore for frontend" \
  ".gitignore"

# ------------------------------------------------------------------
# Commit 2 — Project configuration
# ------------------------------------------------------------------
commit_group \
  "feat(config): initialize nextjs 15 with pnpm, typescript strict, eslint, prettier" \
  "frontend/package.json" \
  "frontend/tsconfig.json" \
  "frontend/next.config.ts" \
  "frontend/postcss.config.mjs" \
  "frontend/.prettierrc" \
  "frontend/.prettierignore" \
  "frontend/eslint.config.mjs" \
  "frontend/vitest.config.ts" \
  "frontend/playwright.config.ts" \
  "frontend/.env.example" \
  "frontend/husky-pre-commit.sh" \
  "frontend/SETUP.md"

# ------------------------------------------------------------------
# Commit 3 — Design system
# ------------------------------------------------------------------
commit_group \
  "feat(design-system): add tailwind config, global css tokens, and shadcn radix/nova setup" \
  "frontend/tailwind.config.ts" \
  "frontend/src/app/globals.css"

# ------------------------------------------------------------------
# Commit 4 — Documentation
# ------------------------------------------------------------------
commit_group \
  "docs(frontend): add architecture, routing, auth, state, theme, and context documentation" \
  "frontend/docs"

# ------------------------------------------------------------------
# Commit 5 — Types
# ------------------------------------------------------------------
commit_group \
  "feat(types): add domain, api, and ui type definitions" \
  "frontend/src/types"

# ------------------------------------------------------------------
# Commit 6 — Constants, utilities, config
# ------------------------------------------------------------------
commit_group \
  "feat(lib): add enums, workflow states, permissions, format utils, endpoints, and query client config" \
  "frontend/src/lib/utils.ts" \
  "frontend/src/lib/utils/cn.ts" \
  "frontend/src/lib/utils/format.ts" \
  "frontend/src/lib/utils/permissions.ts" \
  "frontend/src/lib/constants/enums.ts" \
  "frontend/src/lib/constants/workflow-states.ts" \
  "frontend/src/config/env.ts" \
  "frontend/src/config/navigation.ts" \
  "frontend/src/config/query-client.ts"

# ------------------------------------------------------------------
# Commit 7 — Zustand stores
# ------------------------------------------------------------------
commit_group \
  "feat(stores): add zustand auth, context, ui, and theme stores with ssr-safe hydration" \
  "frontend/src/stores"

# ------------------------------------------------------------------
# Commit 8 — Global hooks
# ------------------------------------------------------------------
commit_group \
  "feat(hooks): add global hooks (hydration, permission, context, debounce, media-query, local-storage)" \
  "frontend/src/hooks"

# ------------------------------------------------------------------
# Commit 9 — API layer
# ------------------------------------------------------------------
commit_group \
  "feat(api): add token service abstraction, axios client with interceptors, endpoints, and query keys" \
  "frontend/src/lib/api"

# ------------------------------------------------------------------
# Commit 10 — Providers
# ------------------------------------------------------------------
commit_group \
  "feat(providers): add react-query, next-themes, and theme-studio providers" \
  "frontend/src/core/providers"

# ------------------------------------------------------------------
# Commit 11 — Middleware
# ------------------------------------------------------------------
commit_group \
  "feat(middleware): add nextjs edge route protection middleware" \
  "frontend/src/middleware.ts"

# ------------------------------------------------------------------
# Commit 12 — Application shell
# ------------------------------------------------------------------
commit_group \
  "feat(shell): add app shell, sidebar, topbar, context bar, and page header" \
  "frontend/src/components/layout"

# ------------------------------------------------------------------
# Commit 13 — Shared components and engines
# ------------------------------------------------------------------
commit_group \
  "feat(engines): add datatable engine, treeview engine, status-badge, kpi-tile, empty-state, error-boundary, and command menu" \
  "frontend/src/components/shared"

# ------------------------------------------------------------------
# Commit 14 — Auth module
# ------------------------------------------------------------------
commit_group \
  "feat(auth): add login page, auth hooks, schemas, token service usage, and auth guard" \
  "frontend/src/modules/auth" \
  "frontend/src/core/guards/auth-guard.tsx"

# ------------------------------------------------------------------
# Commit 15 — Tour architecture
# ------------------------------------------------------------------
commit_group \
  "feat(tours): add driverjs tour registry, built-in tours, and useTour hook" \
  "frontend/src/core/tours"

# ------------------------------------------------------------------
# Commit 16 — Setup wizard
# ------------------------------------------------------------------
commit_group \
  "feat(setup): add setup wizard foundation, setup guard, and onboarding step definitions" \
  "frontend/src/core/guards/setup-guard.tsx" \
  "frontend/src/app/(auth)/setup"

# ------------------------------------------------------------------
# Commit 17 — App Router pages and layouts
# ------------------------------------------------------------------
commit_group \
  "feat(pages): add root layout, auth layouts, dashboard, maintenance, login, forgot-password, reset-password, 404, and 500 pages" \
  "frontend/src/app/layout.tsx" \
  "frontend/src/app/not-found.tsx" \
  "frontend/src/app/error.tsx" \
  "frontend/src/app/(public)" \
  "frontend/src/app/(auth)/layout.tsx" \
  "frontend/src/app/(auth)/login" \
  "frontend/src/app/(auth)/forgot-password" \
  "frontend/src/app/(auth)/reset-password" \
  "frontend/src/app/(dashboard)"

# ------------------------------------------------------------------
# Commit 18 — Testing infrastructure
# ------------------------------------------------------------------
commit_group \
  "feat(testing): add vitest, react testing library, and playwright with unit tests for format, permissions, and workflow" \
  "frontend/src/tests" \
  "frontend/src/lib/utils/format.test.ts" \
  "frontend/src/lib/utils/permissions.test.ts" \
  "frontend/src/lib/constants/workflow-states.test.ts" \
  "frontend/e2e"

# ------------------------------------------------------------------
# Push
# ------------------------------------------------------------------
echo ""
echo "Pushing to origin main..."
git push origin main

echo ""
echo "=== Done! All commits pushed to GitHub. ==="
echo "View at: https://github.com/Amaan63/ERP"
