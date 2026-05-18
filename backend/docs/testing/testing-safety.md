# Testing Safety & Architecture

## Overview
This document outlines the testing architecture for the ERP backend, focusing heavily on **Production Database Safety**. Due to the destructive nature of some test operations (like seeding and schema resets), we have implemented multiple defense-in-depth layers to ensure that production data is never accidentally compromised.

## 1. Destructive Truncation Removed
Previously, tests would issue `TRUNCATE TABLE ... CASCADE` before running to ensure a clean state. This practice is inherently dangerous if a misconfiguration points the test runner at a production database.
**Solution**: We have entirely removed destructive global truncation. 

## 2. Transaction-Based Isolation
Instead of truncating tables, tests now utilize **Transaction-Based Isolation**. 
- Each test suite or test case begins a Prisma transaction.
- All database modifications happen within this isolated transaction.
- At the end of the test, the transaction is **rolled back**, leaving the database untouched.

## 3. Strict Test Database Validation (Safety Guard)
Before any test or seed executes, a strict validation runs via `test/setup/safety.guard.ts`. This guard requires:
1. `NODE_ENV` **must** exactly equal `test`.
2. `DATABASE_URL` **must** be present.
3. `DATABASE_URL` **must** contain the string `_test`.
4. `DATABASE_URL` **must not** contain forbidden keywords like `prod`, `production`, `live`, or `main`.

If any condition fails, the process exits with a fatal error immediately.

## 4. Environment Isolation
We use a dedicated `.env.test` file. The test commands in `package.json` use `dotenv-cli` or `cross-env` to strictly load `.env.test` and set `NODE_ENV=test`. Tests will never inherit the default `.env` automatically.

## 5. Safe Test Commands
Never run tests manually with `jest`. Always use the npm scripts which enforce the correct environment:
- `pnpm run test:unit`
- `pnpm run test:integration`
- `pnpm run test:e2e`

## 6. CI/CD Safety
In our CI pipelines (e.g., GitHub Actions), we explicitly:
- Provision a temporary, isolated PostgreSQL instance named `erp_test`.
- Pass only test environment variables.
- The `safety.guard.ts` provides an extra runtime layer even in CI.

## 7. Forbidden Practices
- ❌ **NEVER** hardcode `DATABASE_URL` in test files.
- ❌ **NEVER** run `prisma migrate reset` locally without explicitly ensuring you are pointing to a local dev/test db.
- ❌ **NEVER** use `TRUNCATE` or `DELETE FROM` without `WHERE` in any setup scripts.
