-- F2 — Configuration engine core (admissions policy is its first consumer).
--
-- Additive only: two enums and two tables, nothing existing is altered. With
-- no rows present every key resolves to its registered default, so deploying
-- this migration changes no behaviour. See
-- docs/planning/00-foundation/02-configuration.md.

-- CreateEnum
CREATE TYPE "ConfigScope" AS ENUM ('SYSTEM', 'ORGANIZATION', 'BRANCH');

-- CreateEnum
CREATE TYPE "ConfigValueType" AS ENUM ('STRING', 'INT', 'DECIMAL', 'BOOLEAN', 'ENUM', 'JSON');

-- CreateTable
CREATE TABLE "ConfigDefinition" (
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL,
    "defaultValue" JSONB NOT NULL,
    "allowedScopes" "ConfigScope"[],
    "isVersioned" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ConfigValue" (
    "id" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "scopeType" "ConfigScope" NOT NULL,
    "scopeId" TEXT,
    "value" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL,
    "setBy" TEXT,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "ConfigValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfigValue_definitionKey_scopeType_scopeId_idx" ON "ConfigValue"("definitionKey", "scopeType", "scopeId");

-- AddForeignKey
ALTER TABLE "ConfigValue" ADD CONSTRAINT "ConfigValue_definitionKey_fkey" FOREIGN KEY ("definitionKey") REFERENCES "ConfigDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariants (F2 §4) not expressible in Prisma's declarative schema
-- ---------------------------------------------------------------------------

-- Invariant 1: one value in force per key per scope. COALESCE because a
-- SYSTEM row has a null scopeId and NULLs never collide in a unique index.
CREATE UNIQUE INDEX "ConfigValue_current_key"
  ON "ConfigValue" ("definitionKey", "scopeType", COALESCE("scopeId", ''))
  WHERE "effectiveTo" IS NULL;

-- Invariant 2: scopeId present exactly when the scope is not SYSTEM.
ALTER TABLE "ConfigValue"
  ADD CONSTRAINT "ConfigValue_scope_id_check"
  CHECK (("scopeType" = 'SYSTEM') = ("scopeId" IS NULL));

-- Invariant 4: a closed window is ordered.
ALTER TABLE "ConfigValue"
  ADD CONSTRAINT "ConfigValue_window_check"
  CHECK ("effectiveTo" IS NULL OR "effectiveFrom" < "effectiveTo");

-- Invariant 5: no overlapping windows for one key and scope, closed rows
-- included. This is what makes `resolve(key, scope, asOf)` unambiguous; an
-- open window (effectiveTo IS NULL) extends to infinity. scopeType is not a
-- column of the constraint: an enum has no gist operator class on every
-- supported Postgres version, and it adds nothing — organization and branch
-- ids are UUIDs and never collide, and invariant 2 makes SYSTEM the only scope
-- with a null scopeId.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ConfigValue"
  ADD CONSTRAINT "ConfigValue_no_overlapping_windows"
  EXCLUDE USING gist (
    "definitionKey" WITH =,
    (COALESCE("scopeId", '')) WITH =,
    tsrange("effectiveFrom", "effectiveTo") WITH &&
  );

-- Version numbers start at 1.
ALTER TABLE "ConfigValue"
  ADD CONSTRAINT "ConfigValue_version_check"
  CHECK ("version" >= 1);
