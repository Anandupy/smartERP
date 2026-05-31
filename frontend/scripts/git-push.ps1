# EduOS Frontend - Granular Git Push Script
# Run from D:\ERP:
#   cd D:\ERP
#   .\frontend\scripts\git-push.ps1

$ErrorActionPreference = "Stop"

if (-not (Test-Path "frontend\package.json")) {
    Write-Error "Run from D:\ERP (the repo root), not from inside frontend\"
    exit 1
}

Write-Host "EduOS - Starting granular git push" -ForegroundColor Cyan
Write-Host "Working dir: $(Get-Location)" -ForegroundColor Gray

# ── Commit 1: Root gitignore ──────────────────────────────────────────
Write-Host "`n[1/18] Root gitignore" -ForegroundColor Yellow
git add ".gitignore"
$s = git diff --cached --name-only
if ($s) { git commit -m "chore(root): update gitignore for frontend" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 2: Project configuration ──────────────────────────────────
Write-Host "[2/18] Project configuration" -ForegroundColor Yellow
git add "frontend\package.json" "frontend\tsconfig.json" "frontend\next.config.ts"
git add "frontend\postcss.config.mjs" "frontend\.prettierrc" "frontend\.prettierignore"
git add "frontend\eslint.config.mjs" "frontend\vitest.config.ts" "frontend\playwright.config.ts"
git add "frontend\.env.example" "frontend\husky-pre-commit.sh" "frontend\SETUP.md"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(config): initialize nextjs 15 with pnpm, typescript strict, eslint, prettier" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 3: Design system ───────────────────────────────────────────
Write-Host "[3/18] Design system" -ForegroundColor Yellow
git add "frontend\tailwind.config.ts" "frontend\src\app\globals.css"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(design-system): add tailwind config, global css tokens, and shadcn radix/nova setup" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 4: Documentation ───────────────────────────────────────────
Write-Host "[4/18] Documentation" -ForegroundColor Yellow
git add "frontend\docs"
$s = git diff --cached --name-only
if ($s) { git commit -m "docs(frontend): add architecture, routing, auth, state, theme, and context documentation" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 5: Types ───────────────────────────────────────────────────
Write-Host "[5/18] TypeScript types" -ForegroundColor Yellow
git add "frontend\src\types"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(types): add domain, api, and ui type definitions" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 6: Lib / constants / config ───────────────────────────────
Write-Host "[6/18] Lib, constants, config" -ForegroundColor Yellow
git add "frontend\src\lib\utils.ts"
git add "frontend\src\lib\utils\cn.ts" "frontend\src\lib\utils\format.ts" "frontend\src\lib\utils\permissions.ts"
git add "frontend\src\lib\constants\enums.ts" "frontend\src\lib\constants\workflow-states.ts"
git add "frontend\src\config\env.ts" "frontend\src\config\navigation.ts" "frontend\src\config\query-client.ts"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(lib): add enums, workflow states, permissions, format utils, endpoints, and query client config" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 7: Zustand stores ──────────────────────────────────────────
Write-Host "[7/18] Zustand stores" -ForegroundColor Yellow
git add "frontend\src\stores"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(stores): add zustand auth, context, ui, and theme stores with ssr-safe hydration" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 8: Global hooks ────────────────────────────────────────────
Write-Host "[8/18] Global hooks" -ForegroundColor Yellow
git add "frontend\src\hooks"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(hooks): add global hooks (hydration, permission, context, debounce, media-query, local-storage)" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 9: API layer ───────────────────────────────────────────────
Write-Host "[9/18] API layer" -ForegroundColor Yellow
git add "frontend\src\lib\api"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(api): add token service abstraction, axios client with interceptors, endpoints, and query keys" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 10: Providers ──────────────────────────────────────────────
Write-Host "[10/18] Providers" -ForegroundColor Yellow
git add "frontend\src\core\providers"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(providers): add react-query, next-themes, and theme-studio providers" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 11: Middleware ─────────────────────────────────────────────
Write-Host "[11/18] Middleware" -ForegroundColor Yellow
git add "frontend\src\middleware.ts"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(middleware): add nextjs edge route protection middleware" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 12: Application shell ──────────────────────────────────────
Write-Host "[12/18] Application shell" -ForegroundColor Yellow
git add "frontend\src\components\layout"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(shell): add app shell, sidebar, topbar, context bar, and page header" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 13: Shared components and engines ──────────────────────────
Write-Host "[13/18] Shared components and engines" -ForegroundColor Yellow
git add "frontend\src\components\shared"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(engines): add datatable engine, treeview engine, status-badge, kpi-tile, empty-state, error-boundary, and command menu" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 14: Auth module ────────────────────────────────────────────
Write-Host "[14/18] Auth module" -ForegroundColor Yellow
git add "frontend\src\modules\auth"
git add "frontend\src\core\guards\auth-guard.tsx"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(auth): add login page, auth hooks, schemas, token service usage, and auth guard" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 15: Tour architecture ──────────────────────────────────────
Write-Host "[15/18] Tour architecture" -ForegroundColor Yellow
git add "frontend\src\core\tours"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(tours): add driverjs tour registry, built-in tours, and useTour hook" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 16: Setup wizard ───────────────────────────────────────────
Write-Host "[16/18] Setup wizard" -ForegroundColor Yellow
git add "frontend\src\core\guards\setup-guard.tsx"
git add "frontend\src\app\(auth)\setup"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(setup): add setup wizard foundation, setup guard, and onboarding step definitions" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 17: App Router pages ───────────────────────────────────────
Write-Host "[17/18] App Router pages and layouts" -ForegroundColor Yellow
git add "frontend\src\app\layout.tsx" "frontend\src\app\not-found.tsx" "frontend\src\app\error.tsx"
git add "frontend\src\app\(public)"
git add "frontend\src\app\(auth)\layout.tsx"
git add "frontend\src\app\(auth)\login"
git add "frontend\src\app\(auth)\forgot-password"
git add "frontend\src\app\(auth)\reset-password"
git add "frontend\src\app\(dashboard)"
git add "frontend\src\app\globals.css"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(pages): add root layout, auth layouts, dashboard, maintenance, login, forgot-password, reset-password, 404, and 500 pages" }
else { Write-Host "  skipped - nothing to commit" }

# ── Commit 18: Testing infrastructure ────────────────────────────────
Write-Host "[18/18] Testing infrastructure" -ForegroundColor Yellow
git add "frontend\src\tests"
git add "frontend\src\lib\utils\format.test.ts"
git add "frontend\src\lib\utils\permissions.test.ts"
git add "frontend\src\lib\constants\workflow-states.test.ts"
git add "frontend\e2e"
git add "frontend\scripts"
$s = git diff --cached --name-only
if ($s) { git commit -m "feat(testing): add vitest, react testing library, and playwright with unit tests" }
else { Write-Host "  skipped - nothing to commit" }

# ── Push ──────────────────────────────────────────────────────────────
Write-Host "`nPushing all commits to origin main..." -ForegroundColor Cyan
git push origin main

Write-Host "`nDone! View at: https://github.com/Amaan63/ERP" -ForegroundColor Green
