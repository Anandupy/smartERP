# School ERP Testing Architecture & Safety Guard Guide

This document provides an enterprise-grade architectural breakdown of the **`test/`** folder structure, its setup, lifecycle configurations, mock definitions, and the specialized **Error Handling (EH) & Safety Flows** built to protect production environments from accidental destructive actions.

---

## 📂 Directory & File Map of the `test/` Architecture

Every folder and file in this architecture serves a specific, isolated role to optimize test speed, maintain clean environment states, and protect the live application.

| Location / File | Type / Category | Purpose | Key Contents |
| :--- | :--- | :--- | :--- |
| **[`test/setup/`](file:///d:/ERP/backend/test/setup)** | **Infrastructure** | Manages environment validations and Jest lifecycle hooks. | Sandbox initialization, Jest configurations, safety validation. |
| ├── **[`safety.guard.ts`](file:///d:/ERP/backend/test/setup/safety.guard.ts)** | TypeScript Guard | Throws instant fatal exceptions if pointed to a live production database. | Validates `NODE_ENV === 'test'`, checks for `_test` in database string, filters out keywords (`prod`, `live`, etc.). |
| ├── **[`test-db.ts`](file:///d:/ERP/backend/test/setup/test-db.ts)** | DB Core Setup | Manages sandbox setup and seeds database safely. | Triggers validation guards, loads database environment, runs safe seed scripts. |
| ├── **[`global-setup.ts`](file:///d:/ERP/backend/test/setup/global-setup.ts)** | Jest Global Hook | Hook running ONCE globally before any Jest tests begin executing. | Initializes environment sanity checks, seeds isolated test database. |
| ├── **[`global-teardown.ts`](file:///d:/ERP/backend/test/setup/global-teardown.ts)** | Jest Global Hook | Hook running ONCE globally after all Jest tests conclude. | Disconnects the global Prisma database clients to prevent memory leaks. |
| **[`test/seeds/`](file:///d:/ERP/backend/test/seeds)** | **Seeds** | Populates the sandbox with realistic Indian educational data structures. | Structured school trust groups, branches, programs, users. |
| └── **[`realistic-data.seed.ts`](file:///d:/ERP/backend/test/seeds/realistic-data.seed.ts)** | Seed Generator | Provides deterministic, consistent datasets across test environments. | Inserts trust data (e.g., Horizon Education Trust), academic branches, classes. |
| **[`test/helpers/`](file:///d:/ERP/backend/test/helpers)** | **Helpers** | Keeps your testing codebase DRY (Don't Repeat Yourself). | Dynamic JWT auth handlers, database transaction runners. |
| ├── **[`transaction.helper.ts`](file:///d:/ERP/backend/test/helpers/transaction.helper.ts)** | Helper | Runs database queries in an isolated transaction block and forces rollback. | Automatically rolls back DB changes inside tests. |
| ├── **[`auth.helper.ts`](file:///d:/ERP/backend/test/helpers/auth.helper.ts)** | Helper | Fast mock authorization token generation. | JWT creation and auth header utilities. |
| **[`test/factories/`](file:///d:/ERP/backend/test/factories)** | **Factories** | Generates dynamic model instances on-the-fly. | Sandbox mock model generation. |
| └── **[`user.factory.ts`](file:///d:/ERP/backend/test/factories/user.factory.ts)** | User Factory | Rapidly generates test users with real hashed passwords and roles. | Generators for `SUPER_ADMIN`, `ORG_ADMIN`, `STAFF`, etc. |
| **[`test/fixtures/`](file:///d:/ERP/backend/test/fixtures)** | **Fixtures** | Hosts raw static data models for comparison. | JSON permission models, sample configuration trees. |
| └── **[`roles.fixture.json`](file:///d:/ERP/backend/test/fixtures/roles.fixture.json)** | JSON | Static mapping of system permissions to roles. | Pre-defined arrays of permission codes mapped to specific roles. |
| **[`test/mocks/`](file:///d:/ERP/backend/test/mocks)** | **Mocks** | Replaces third-party integrations with fast mock proxies. | Deep mock mocks. |
| └── **[`prisma.mock.ts`](file:///d:/ERP/backend/test/mocks/prisma.mock.ts)** | TS Prisma Mock | Intercepts physical database calls during unit tests. | Standardized deep mock proxy context for `PrismaClient`. |
| **[`test/utils/`](file:///d:/ERP/backend/test/utils)** | **Utilities** | Small generic test scripts. | Timeouts, custom string builders. |
| └── **[`index.ts`](file:///d:/ERP/backend/test/utils/index.ts)** | TS File | Common sandbox utility functions. | `delay(ms)` and `randomString(len)`. |
| **[`test/integration/`](file:///d:/ERP/backend/test/integration)** | **Integration** | Validates internal service wiring, repositories, and physical DB layer. | Database integration tests. |
| └── **[`database.integration-spec.ts`](file:///d:/ERP/backend/test/integration/database.integration-spec.ts)** | Spec Test | Verifies raw database transactions, rollback reliability, and query safety. | Direct transactional execution test cases. |

---

## 🛡️ Core Safety & Error Handling (EH) Workflows

To ensure that normal developer testing can NEVER contaminate, destroy, or affect live client data, we have integrated three automated protective flows:

### 1. Environment Verification & Termination Flow
* **Goal**: Immediate script abort if the execution path targets a non-test schema, a production server, or an unsafe environment variable setup.
* **Mechanism**:
  * The script fetches environment configuration keys (`NODE_ENV` and `DATABASE_URL`).
  * It runs validation checks to ensure `NODE_ENV === 'test'` and checks that `DATABASE_URL` contains `_test`.
  * If any production-like keyword (e.g. `prod`, `live`, `main`) is found anywhere in the connection string, a **FATAL error** is thrown and the process immediately terminates with an exit code of `1`.

### 2. Transaction Rollback Pattern
* **Goal**: Allows tests to perform live database mutations (Create, Update, Delete) without permanently altering sandbox data.
* **Mechanism**:
  * By wrapping DB operations inside **[`transaction.helper.ts`](file:///d:/ERP/backend/test/helpers/transaction.helper.ts)**, queries run within a Prisma interactive transaction.
  * The wrapper executes the mock tests, asserts expectations, and then programmatically throws a generic `ROLLBACK_SAFE_TEST_TRANSACTION` error.
  * Prisma intercepts the throw, rolls back all SQL insertions/updates, and returns the DB connection safely to its pre-test baseline.

### 3. Graceful Seed Reconciliation Flow
* **Goal**: Prevents testing setups from crashing when executed consecutively due to database uniqueness constraint collisions (e.g., trying to re-insert `Horizon Education Trust` or duplicate admin emails).
* **Mechanism**:
  * In **[`realistic-data.seed.ts`](file:///d:/ERP/backend/test/seeds/realistic-data.seed.ts)**, seeding operations are wrapped in safe error catch blocks.
  * If the write fails with a Prisma unique constraint code (`P2002`), the catch block bypasses the collision gracefully and skips the insert:
  ```typescript
  catch (error) {
    if (error.code === 'P2002') {
      console.log('[Test Seed] Seed data already exists. Bypassing safely.');
    } else {
      throw error; // Re-throw actual runtime errors
    }
  }
  ```

---

## 🛠️ Supporting Configuration Ecosystem

1. **[`.env.test`](file:///d:/ERP/backend/.env.test)**: Standardizes a clean, pre-defined environment configuration explicitly pointing to local test databases (`erp_test`), shielding tests from reading `.env` parameters.
2. **[`scripts/safe-prisma.ts`](file:///d:/ERP/backend/scripts/safe-prisma.ts)**: Acts as a gateway wrapper for direct terminal commands (like `db push` or `migrate reset`), verifying environment scopes before executing them.
3. **[`.github/workflows/test.yml`](file:///d:/ERP/backend/.github/workflows/test.yml)**: Automated CI/CD script managing isolated workflow validation on GitHub, preventing live deployments from running test commands without sandbox protection.