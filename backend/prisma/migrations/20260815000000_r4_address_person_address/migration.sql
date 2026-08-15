-- R4 — Address / Household refinement
--
-- Adds S2's target model: `Address` (immutable value object) and
-- `PersonAddress` (append-only link). No `Household` table — the
-- specification's §9.2 explicitly refuses one (DECIDED, S1 D5): sharing is
-- two Persons referencing one Address row, and sibling grouping is derived
-- from `Guardianship` at query time. There is no Guardianship model in this
-- schema yet either; that is a separate, already-scoped migration.
--
-- Additive only. `Guardian.addressLine1/2/city/state/country/pincode` are
-- untouched: Guardian has no `personId` (the "Guardian -> Person" migration
-- referenced in prior phase history was not actually applied to this
-- schema — verified before writing this file), so there is no Person to
-- backfill those columns onto. See the R4 report for the full discrepancy.


-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('PERMANENT', 'CURRENT', 'COMMUNICATION', 'BILLING');

-- CreateEnum
CREATE TYPE "AddressVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');


-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "pincode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "normalizedHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonAddress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "addressType" "AddressType" NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "verificationStatus" "AddressVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "proofDocumentId" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_organizationId_idx" ON "Address"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Address_organizationId_normalizedHash_key" ON "Address"("organizationId", "normalizedHash");

-- CreateIndex
CREATE INDEX "PersonAddress_personId_idx" ON "PersonAddress"("personId");

-- CreateIndex
CREATE INDEX "PersonAddress_organizationId_idx" ON "PersonAddress"("organizationId");

-- CreateIndex
CREATE INDEX "PersonAddress_addressId_idx" ON "PersonAddress"("addressId");

-- AddForeignKey
ALTER TABLE "PersonAddress" ADD CONSTRAINT "PersonAddress_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonAddress" ADD CONSTRAINT "PersonAddress_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- 3. Invariants (spec §10.6) not expressible in Prisma's declarative schema
-- ---------------------------------------------------------------------------

-- Invariant 1: one open (current) address per person per type. The service
-- layer closes the previous link before opening a new one inside a
-- transaction, but only this index makes that atomic under concurrent
-- requests — the same reasoning as every other "two inserts race" unique
-- constraint in this codebase.
CREATE UNIQUE INDEX "PersonAddress_person_type_open_key"
  ON "PersonAddress" ("personId", "addressType")
  WHERE "validTo" IS NULL;

-- Invariant 2: no two validity windows for the same person+type may overlap,
-- including among closed (historical) windows — a backdated correction could
-- otherwise create an overlap invariant 1 alone would not catch. Postgres
-- range constructors treat a NULL bound as unbounded, so an open window
-- (validTo IS NULL) is correctly treated as extending to infinity here.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "PersonAddress"
  ADD CONSTRAINT "PersonAddress_no_overlapping_windows"
  EXCLUDE USING gist (
    "personId" WITH =,
    "addressType" WITH =,
    tsrange("validFrom", "validTo") WITH &&
  );

-- Invariant 3: a closed window is ordered.
ALTER TABLE "PersonAddress"
  ADD CONSTRAINT "PersonAddress_valid_window_check"
  CHECK ("validTo" IS NULL OR "validFrom" < "validTo");

-- Invariant 6: a well-formed Indian PIN. Never blocks other countries.
ALTER TABLE "Address"
  ADD CONSTRAINT "Address_in_pincode_check"
  CHECK ("countryCode" <> 'IN' OR "pincode" ~ '^[1-9][0-9]{5}$');

-- Invariant 5 ("Address is never updated") is enforced by the service layer
-- (no update method exists) and NOT by REVOKE UPDATE on the table role: this
-- deployment connects as the Postgres superuser/table owner, which REVOKE
-- cannot restrict. Enforcing it at the database role level requires a
-- separate application role with reduced privileges, which is an
-- infrastructure change outside this migration's scope — recorded here
-- rather than silently skipped.
