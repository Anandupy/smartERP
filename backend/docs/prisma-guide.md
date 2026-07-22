# Comprehensive Prisma & Database Management Guide

## 1. Project Architecture

This application utilizes a **Modular Prisma Schema Architecture** designed to scale seamlessly across enterprise domain boundaries without maintaining a single monolithic schema file.

### Architecture Overview

```
prisma/modules/
├── academic/
│   ├── academic-unit.prisma
│   └── academic-year.prisma
├── admissions/
│   └── applicant.prisma
├── system/
│   ├── audit-log.prisma
│   └── system-setting.prisma
└── shared/
    └── datasource.prisma
           │
           ▼ (npm run prisma:build / node scripts/merge-prisma.js)
  prisma/schema.prisma (Merged output schema)
           │
           ▼ (npm run prisma:generate / prisma generate)
  prisma/generated/ (Generated Prisma Client)
           │
           ├──► src/infrastructure/database/prisma.service.ts (@PrismaClient)
           └──► tsconfig.json alias (@/generated/client)
```

### Components

1. **Modular Schemas (`prisma/modules/**/*.prisma`)**: Domain-specific schema chunks defining models, enums, and relations.
2. **Merge Script (`scripts/merge-prisma.js`)**: Automatically scans `prisma/modules/`, prioritizes `shared/datasource.prisma` (which contains `generator client` and `datasource db`), and concatenates all `.prisma` files into `prisma/schema.prisma`.
3. **Merged Schema (`prisma/schema.prisma`)**: Generated single schema file read directly by Prisma CLI for migrations and code generation. **Do not edit manually.**
4. **Generated Client (`prisma/generated`)**: The target directory where `prisma generate` outputs the compiled TypeScript client definitions. Configured via `output = "./generated"` in `datasource.prisma`.
5. **PrismaService (`src/infrastructure/database/prisma.service.ts`)**: NestJS injectable service extending `PrismaClient`. Inherits all model delegates (e.g. `prisma.auditLog`, `prisma.user`, `prisma.academicUnit`).

---

## 2. Development Workflow

### Standard Model Operations

When creating or updating database models, always work within `prisma/modules/` rather than modifying `prisma/schema.prisma`.

#### Adding a New Model
1. Locate or create a domain `.prisma` file under `prisma/modules/<domain>/<model>.prisma`.
2. Define the model with UUIDv7 primary keys and necessary relations.
3. Run `npm run prisma:generate` (or `npm run prisma:migrate:dev` if database changes are ready).

```prisma
// Example: prisma/modules/system/audit-log.prisma
model AuditLog {
  id        String   @id @default(uuid(7))
  timestamp DateTime @default(now())
  eventName String
  action    String
  module    String
  // ...
}
```

#### Modifying a Model
1. Edit the relevant file in `prisma/modules/`.
2. Format and validate schema:
   ```bash
   npm run prisma:format
   npm run prisma:validate
   ```
3. Generate new types:
   ```bash
   npm run prisma:generate
   ```

#### Deleting or Renaming Models / Columns
1. Update references across `src/` first.
2. Update model definition in `prisma/modules/`.
3. Create migration:
   ```bash
   npm run prisma:migrate:dev -- --name rename_or_remove_field
   ```

---

## 3. Safe Migration & Script Workflows

All Prisma commands are wrapped with build steps in `package.json` to ensure the schema is merged prior to execution.

| Command | Purpose | When to Use |
| :--- | :--- | :--- |
| `npm run prisma:build` | Concatenates modular schemas into `prisma/schema.prisma`. | Automated internal script. |
| `npm run prisma:format` | Formats all modular & merged schema files. | Before committing code. |
| `npm run prisma:validate` | Validates schema syntax and entity relations. | CI pipelines & pre-commit checks. |
| `npm run prisma:generate` | Merges schema and regenerates Prisma Client types. | After schema edits, git pull, or npm install. |
| `npm run prisma:migrate:dev` | Merges schema, creates SQL migration, and applies to dev DB. | Local development schema changes. |
| `npm run prisma:migrate:deploy` | Applies pending SQL migrations to target DB without prompt. | Production and Staging deployments. |
| `npm run prisma:studio` | Opens interactive Web UI for database records. | Local data debugging. |
| `npm run prisma:push:safe` | Pushes schema directly without creating migration files. | Prototyping in local test DBs. (Blocked in prod). |
| `npm run prisma:reset:safe` | Drops database, reapplies all migrations, and seeds data. | Resetting local development DB. (Blocked in prod). |

---

## 4. Production-Safe Deployment Workflow

### General Rules for Zero-Downtime Deployments

Production database changes must be executed using additive schema patterns.

#### 1. Additive Schema Changes (Safe)
- Adding new models, optional fields (`String?`), or fields with defaults (`@default(...)`).
- Safe to deploy in a single step using `npm run prisma:migrate:deploy`.

#### 2. Nullable-to-Required Migration (Multi-Step)
To make an existing column non-nullable without downtime:
- **Step 1**: Add the field as optional (`String?`) and deploy application code that writes to it.
- **Step 2**: Backfill existing rows with non-null values via a data migration script.
- **Step 3**: Change field definition to required (`String`) and deploy migration.

#### 3. Field or Table Renames (Multi-Step)
Never execute direct SQL `RENAME COLUMN` in a single deployment step as old code will crash during rolling update.
- **Step 1**: Add the new column/table.
- **Step 2**: Dual-write to old and new columns in application code.
- **Step 3**: Backfill existing data from old to new column.
- **Step 4**: Deprecate and remove old column in a subsequent release.

#### 4. Destructive Prevention Safety Guard
The project includes `scripts/safe-prisma.ts`. Attempts to run destructive commands (`migrate reset`, `db push`) against production database strings (or environment `NODE_ENV=production`) will be automatically terminated with an error.

---

## 5. Dangerous Commands & Best Practices

### `prisma migrate reset`
- **What it does**: Drops the database schema, recreates it from scratch, applies all migration files from the beginning, and seeds data.
- **Data Loss**: **100% Data Destruction.**
- **Safe Environment**: Only local development or disposable test databases. **NEVER run in production or staging.**

### `prisma db push`
- **What it does**: Directs current Prisma schema directly to the database without generating SQL migration files.
- **When to use**: Quick local prototyping where migration history is not tracked.
- **Why avoid in production**: Skips migration history tracking in `_prisma_migrations`, makes deployment rollbacks impossible, and can silently drop columns or tables.

---

## 6. Troubleshooting & Common Issues

### Issue 1: `Property 'X' does not exist on type 'PrismaService'`
- **Cause**: Prisma Client was not regenerated after adding model `X` to a modular schema file, or `output` path in `generator client` was missing/misconfigured.
- **Solution**:
  1. Verify `prisma/modules/shared/datasource.prisma` contains:
     ```prisma
     generator client {
       provider = "prisma-client-js"
       output   = "./generated"
     }
     ```
  2. Run:
     ```bash
     npm run prisma:generate
     ```
  3. Restart TypeScript server in IDE if cache persists.

### Issue 2: Direct CLI `npx prisma generate` doesn't pick up new models
- **Cause**: Running `npx prisma generate` directly reads `prisma/schema.prisma` directly without executing `scripts/merge-prisma.js`.
- **Solution**: Always use the project script `npm run prisma:generate` which runs `prisma:build` first.

### Issue 3: TypeScript or Jest uses stale client
- **Cause**: `@/generated/client` alias or `node_modules/@prisma/client` pointing to stale files.
- **Solution**: Running `npm run prisma:generate` updates `prisma/generated` and updates module redirects in `node_modules/@prisma/client` simultaneously.

---

## 7. Version Synchronization & CI/CD Checklist

1. **Version Parity**: Keep `prisma` (devDependencies) and `@prisma/client` (dependencies) on identical major/minor version strings in `package.json`.
2. **CI Pipeline Order**:
   ```bash
   # 1. Install dependencies & trigger postinstall prisma:generate
   npm ci

   # 2. Validate schema syntax
   npm run prisma:validate

   # 3. Type check application
   npx tsc --noEmit

   # 4. Execute unit & integration tests
   npm run test:unit
   ```
