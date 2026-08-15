-- R4.5 — Guardian Identity & Guardianship reconciliation
--
-- Adds Guardian.personId (nullable) and Guardianship (Person-to-Person,
-- persistent). Additive only, matching R4's own additive discipline.
--
-- `personId` is nullable, not required as the spec's §8.5 target states:
-- resolving a Person requires a DOB (`Person.dob` is NOT NULL), and Guardian
-- has never collected one. Making it required here would mean either
-- inventing a DOB for the one existing Guardian row (destructive guessing,
-- explicitly forbidden) or widening Person.dob to nullable everywhere else
-- it is used for matching quality (an unrelated, much larger change). Both
-- were rejected; see the R4.5 report for the full reasoning.
--
-- Guardian's legacy `aadhaarNo`/address columns are untouched for the same
-- reason R4 left them alone: there is no Person to migrate them onto for the
-- one existing row, and inventing one is not this migration's job.


-- ---------------------------------------------------------------------------
-- 1. Guardian.personId
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "Guardian" ADD COLUMN "personId" TEXT;

-- CreateIndex
CREATE INDEX "Guardian_personId_idx" ON "Guardian"("personId");

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- 2. Guardianship
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "Guardianship" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "guardianPersonId" TEXT NOT NULL,
    "wardPersonId" TEXT NOT NULL,
    "relationTypeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isFinancialGuardian" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "emergencyPriority" INTEGER,
    "isLegalGuardian" BOOLEAN NOT NULL DEFAULT false,
    "pickupAllowed" BOOLEAN NOT NULL DEFAULT true,
    "pickupValidFrom" TIMESTAMP(3),
    "pickupValidTo" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardianship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Guardianship_organizationId_idx" ON "Guardianship"("organizationId");

-- CreateIndex
CREATE INDEX "Guardianship_guardianPersonId_idx" ON "Guardianship"("guardianPersonId");

-- CreateIndex
CREATE INDEX "Guardianship_wardPersonId_idx" ON "Guardianship"("wardPersonId");

-- AddForeignKey
ALTER TABLE "Guardianship" ADD CONSTRAINT "Guardianship_guardianPersonId_fkey" FOREIGN KEY ("guardianPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardianship" ADD CONSTRAINT "Guardianship_wardPersonId_fkey" FOREIGN KEY ("wardPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardianship" ADD CONSTRAINT "Guardianship_relationTypeId_fkey" FOREIGN KEY ("relationTypeId") REFERENCES "RelationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- 3. Invariants not expressible in Prisma's declarative schema
-- ---------------------------------------------------------------------------

-- A guardian cannot be their own ward.
ALTER TABLE "Guardianship"
  ADD CONSTRAINT "Guardianship_not_self_check"
  CHECK ("guardianPersonId" <> "wardPersonId");

-- A closed window is ordered — same invariant R4 gave PersonAddress.
ALTER TABLE "Guardianship"
  ADD CONSTRAINT "Guardianship_valid_window_check"
  CHECK ("endedAt" IS NULL OR "startedAt" < "endedAt");

-- At most one ACTIVE guardianship per (guardian, ward) pair. A relationship
-- that ended and later resumed is a new row, not a reopened one — the same
-- append-only shape as PersonAddress.
CREATE UNIQUE INDEX "Guardianship_active_pair_key"
  ON "Guardianship" ("guardianPersonId", "wardPersonId")
  WHERE "endedAt" IS NULL;

-- Defect 1 (lifecycle §8.4): primary-guardian exclusivity was previously
-- attempted only in application code (clear-then-set, non-transactional) and
-- could fail mid-sequence, leaving a ward with no primary guardian at all.
-- This is now the actual guarantee; the service-level clear-then-set becomes
-- defense in depth rather than the only defense.
CREATE UNIQUE INDEX "Guardianship_one_primary_per_ward_key"
  ON "Guardianship" ("wardPersonId")
  WHERE "isPrimary" = true AND "endedAt" IS NULL;

-- Defect 2 (lifecycle §8.4): isFinancialGuardian had no exclusivity at all —
-- a ward could accumulate three financial guardians, and R4's BILLING
-- address resolution explicitly could not depend on it as a result. Closed
-- here at the database level, the same way as isPrimary above.
CREATE UNIQUE INDEX "Guardianship_one_financial_per_ward_key"
  ON "Guardianship" ("wardPersonId")
  WHERE "isFinancialGuardian" = true AND "endedAt" IS NULL;

-- Organization consistency across guardianPerson / wardPerson / relationType
-- is a SERVICE invariant, not a database one: Postgres CHECK constraints
-- cannot reference other tables. GuardianshipService verifies all three
-- belong to the caller's organizationId before writing.
