#!/usr/bin/env sh
# Save this as frontend/.husky/pre-commit after running: pnpm prepare
. "$(dirname -- "$0")/_/husky.sh"

cd frontend
npx lint-staged
