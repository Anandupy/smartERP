# Database Migration Strategy

The schema is owned by `prisma/migrations/`. Every environment — development,
test, CI and production — reaches its schema by running those migrations, and
nothing else.

> [!IMPORTANT]
> `prisma db push` is not part of any workflow. It is what caused the failure
> described below.

---

## 1. What went wrong, and what fixed it

Development evolved the schema with `db push`, and CI pushed the schema too. The
migration path was therefore never executed by anything. It drifted silently:

|                                   | Tables |
| :-------------------------------- | :----- |
| Declared in `schema.prisma`       | 43     |
| Produced by the migration history | **9**  |

`prisma migrate deploy` against a fresh database produced a system with no
audit log, no admissions, no communication, no authorization and no navigation
tables. The application would have started and failed on first use.

Two changes make this unrepeatable:

1. **A single baseline migration** (`00000000000000_baseline`) that creates the
   complete schema — 43 tables, 22 enums, 41 foreign keys.
2. **CI deploys migrations and then asserts zero drift**
   (`pnpm migrate:verify`). A schema change without a migration now fails the
   build.

The old history was removed rather than repaired. It described a schema that had
not existed for months, so preserving it would have preserved a fiction.

---

## 2. Migration layout

```text
prisma/migrations/
├── 00000000000000_baseline/            # complete schema
├── 20260802000100_backfill_workspace_state/
└── migration_lock.toml
```

The backfill runs **after** the baseline and marks an already-populated
workspace as initialized, so that upgrading an existing deployment does not trip
the setup gate and lock every user out. On a genuinely fresh database it is a
no-op — no organization, branch or academic year exists — and the installation
correctly reports `setupRequired`. It is idempotent (`ON CONFLICT DO NOTHING`).

---

## 3. Deploying

### Fresh database

```bash
pnpm prisma:migrate:deploy
```

Produces the full schema. Verified: 43 tables, 22 enums, zero drift, no
`db push`.

Then seed the reference data (permissions, modules, menus):

```bash
pnpm seed
```

### Existing database that already has this schema

A database created with `db push` — any pre-existing development, staging or
production instance — already holds the baseline's tables. Running the baseline
against it would fail on `CREATE TABLE ... already exists`.

Baseline it once, then deploy:

```bash
# 1. Record the baseline as already applied. Changes no tables, only Prisma's
#    bookkeeping in _prisma_migrations.
npx prisma migrate resolve --applied 00000000000000_baseline

# 2. Apply anything after the baseline.
pnpm prisma:migrate:deploy

# 3. Confirm the database and schema.prisma agree.
pnpm migrate:verify
```

If the database also carries rows in `_prisma_migrations` from the removed
history, delete them first — they reference migration folders that no longer
exist and `migrate status` will report them as missing:

```sql
DELETE FROM "_prisma_migrations";
```

This is bookkeeping only; it does not touch application data.

> [!WARNING]
> Confirm the database really does match `schema.prisma` before baselining. Run
> `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
> and expect `-- This is an empty migration.` Baselining a database that is
> actually behind will mark missing tables as present and the failure will
> surface later, at runtime.

### What was done here

- **Development** — baselined; drift verified empty.
- **Test** — dropped and rebuilt from migrations alone; 271 integration tests
  pass against it. It had been missing 34 tables.
- **CI** — deploys migrations, then fails the build on any drift.

---

## 4. Changing the schema

```bash
# 1. Edit the modular schema, never prisma/schema.prisma
$EDITOR prisma/modules/<domain>/<model>.prisma

# 2. Generate a migration and apply it locally
pnpm prisma:migrate:dev -- --name add_student_photo

# 3. Confirm no drift remains
pnpm migrate:verify
```

Commit the generated folder under `prisma/migrations/`. CI will fail the build
if a schema change arrives without one.

---

## 5. Rollback

Prisma has no `migrate down`. Rollback is therefore planned per migration, and
the plan depends on whether the change is additive.

### Additive changes — new tables, optional columns, columns with defaults

Backward compatible. The previous application version runs unchanged against the
new schema.

**Roll back the application only.** Leave the schema in place and remove the
unused object in a later release. Rolling the schema back is unnecessary and
risks data written since the deploy.

### Destructive changes — dropped or renamed columns, tightened constraints

Not backward compatible: the previous application version cannot run against the
new schema, and the data is already gone.

Never ship these as a single step. Use the expand/contract sequence documented
in [Prisma Guide §4](../prisma-guide.md#4-production-safe-deployment-workflow):

```text
Release N     add the new column, dual-write
Release N+1   backfill
Release N+2   read from the new column only
Release N+3   drop the old column
```

Each release is independently reversible by rolling back the application.

### If a migration fails partway

`migrate deploy` stops at the failed migration and marks it failed; later
migrations do not run. Postgres DDL is transactional, so the failed migration
leaves nothing half-applied.

```bash
# After fixing the cause
npx prisma migrate resolve --rolled-back <migration_name>
pnpm prisma:migrate:deploy
```

### Emergency restore

For a destructive migration already applied to production, the point-in-time
backup is the recovery path, not a reverse migration. Take one immediately
before any release containing a `DROP` or a constraint tightening.

---

## 6. Safety rails

| Guard                    | Where                                   | Blocks                                  |
| :----------------------- | :-------------------------------------- | :-------------------------------------- |
| `pnpm migrate:verify`    | CI, local                               | Schema drift                            |
| `scripts/safe-prisma.ts` | `prisma:push:safe`, `prisma:reset:safe` | Destructive commands against production |
| Test environment guard   | `test/setup/safety.guard.ts`            | Tests against a non-`_test` database    |
