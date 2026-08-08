-- Phase 1 — Identity foundation
--
-- Person, its sensitive counterpart, the match/merge audit tables, and the
-- per-organization data keys that make encryption possible.
--
-- Purely additive: no existing table is altered and no existing row is
-- touched. The plaintext `Applicant.aadhaarNo` and `Guardian.aadhaarNo`
-- columns deliberately remain for now — migrating them onto Person is I2/S1
-- work, and dropping them here would destroy data no Person yet references.
-- See docs/core/key-custody.md and the Phase 1 report.

-- CreateEnum
CREATE TYPE "GovernmentIdType" AS ENUM ('AADHAAR');

-- CreateEnum
CREATE TYPE "DataKeyStatus" AS ENUM ('PENDING_RECOVERY_CUSTODY', 'ACTIVE', 'ROTATING', 'RETIRED', 'SHREDDED');

-- CreateEnum
CREATE TYPE "MatchDecision" AS ENUM ('DISTINCT');

-- CreateTable
CREATE TABLE "OrganizationDataKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dekWrappedOperational" BYTEA NOT NULL,
    "operationalKekVersion" INTEGER NOT NULL,
    "dekWrappedRecovery" BYTEA,
    "recoveryKekVersion" INTEGER,
    "algorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "status" "DataKeyStatus" NOT NULL DEFAULT 'PENDING_RECOVERY_CUSTODY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRewrappedAt" TIMESTAMP(3),
    "shreddedAt" TIMESTAMP(3),
    "shreddedBy" TEXT,

    CONSTRAINT "OrganizationDataKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataKeyRotationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rotationType" TEXT NOT NULL,
    "fromVersion" INTEGER,
    "toVersion" INTEGER,
    "reason" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataKeyRotationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "govtIdHash" TEXT,
    "phoneHash" TEXT,
    "dob" TIMESTAMP(3) NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "mergedIntoPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonSensitive" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "idType" "GovernmentIdType" NOT NULL,
    "aadhaarEnc" BYTEA,
    "aadhaarLast4" TEXT,
    "keyVersion" INTEGER NOT NULL,
    "erasedAt" TIMESTAMP(3),
    "erasedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonSensitive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonMatchDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personAId" TEXT NOT NULL,
    "personBId" TEXT NOT NULL,
    "decision" "MatchDecision" NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonMatchDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonMergeLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "survivorPersonId" TEXT NOT NULL,
    "mergedPersonId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "repointedRefs" JSONB NOT NULL,
    "mergedBy" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonMergeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationDataKey_organizationId_key" ON "OrganizationDataKey"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationDataKey_status_idx" ON "OrganizationDataKey"("status");

-- CreateIndex
CREATE INDEX "DataKeyRotationLog_organizationId_idx" ON "DataKeyRotationLog"("organizationId");

-- CreateIndex
CREATE INDEX "Person_organizationId_phoneHash_dob_idx" ON "Person"("organizationId", "phoneHash", "dob");

-- CreateIndex
CREATE INDEX "Person_organizationId_nameNormalized_dob_idx" ON "Person"("organizationId", "nameNormalized", "dob");

-- CreateIndex
CREATE INDEX "Person_mergedIntoPersonId_idx" ON "Person"("mergedIntoPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_organizationId_govtIdHash_key" ON "Person"("organizationId", "govtIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "PersonSensitive_personId_key" ON "PersonSensitive"("personId");

-- CreateIndex
CREATE INDEX "PersonSensitive_organizationId_idx" ON "PersonSensitive"("organizationId");

-- CreateIndex
CREATE INDEX "PersonMatchDecision_organizationId_idx" ON "PersonMatchDecision"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonMatchDecision_personAId_personBId_key" ON "PersonMatchDecision"("personAId", "personBId");

-- CreateIndex
CREATE INDEX "PersonMergeLog_organizationId_idx" ON "PersonMergeLog"("organizationId");

-- CreateIndex
CREATE INDEX "PersonMergeLog_survivorPersonId_idx" ON "PersonMergeLog"("survivorPersonId");

-- CreateIndex
CREATE INDEX "PersonMergeLog_mergedPersonId_idx" ON "PersonMergeLog"("mergedPersonId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_mergedIntoPersonId_fkey" FOREIGN KEY ("mergedIntoPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSensitive" ADD CONSTRAINT "PersonSensitive_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariants Prisma cannot express (F1 §4)
-- ---------------------------------------------------------------------------

-- F1 invariant 2 — an ACTIVE data key always carries BOTH wraps.
--
-- A key with only the operational wrap is survivable in development and
-- unacceptable in production: losing ENCRYPTION_KEY would lose the tenant's
-- data with no second path to it. That state is representable, but it is called
-- PENDING_RECOVERY_CUSTODY rather than being quietly labelled ACTIVE.
ALTER TABLE "OrganizationDataKey" ADD CONSTRAINT "data_key_active_has_both_wraps_check"
  CHECK (
    "status" <> 'ACTIVE'
    OR ("dekWrappedOperational" IS NOT NULL AND "dekWrappedRecovery" IS NOT NULL)
  );

-- A recovery wrap and its KEK version travel together, or neither is present.
ALTER TABLE "OrganizationDataKey" ADD CONSTRAINT "data_key_recovery_version_check"
  CHECK (("dekWrappedRecovery" IS NULL) = ("recoveryKekVersion" IS NULL));

-- I1 invariant 2 — a plausible date of birth. The single most useful
-- discriminator between same-named people is worthless if it can be nonsense.
ALTER TABLE "Person" ADD CONSTRAINT "person_dob_plausible_check"
  CHECK ("dob" > '1900-01-01' AND "dob" <= CURRENT_DATE);

-- I1 invariant 3 — the matching key is never blank. An empty normalised name
-- would match every other empty one.
ALTER TABLE "Person" ADD CONSTRAINT "person_name_normalized_present_check"
  CHECK (length(trim("nameNormalized")) > 0);

-- I1 invariant 5 — a Person never merges into itself.
ALTER TABLE "Person" ADD CONSTRAINT "person_no_self_merge_check"
  CHECK ("mergedIntoPersonId" IS NULL OR "mergedIntoPersonId" <> "id");

-- I1 invariant 6 — a reviewed pair is stored once, in a canonical order, so one
-- comparison cannot be recorded twice under two spellings.
ALTER TABLE "PersonMatchDecision" ADD CONSTRAINT "match_decision_canonical_order_check"
  CHECK ("personAId" < "personBId");

-- A decision without a reason cannot be reviewed later, which is the only
-- thing it exists for.
ALTER TABLE "PersonMatchDecision" ADD CONSTRAINT "match_decision_reason_present_check"
  CHECK (length(trim("reason")) > 0);

ALTER TABLE "PersonMergeLog" ADD CONSTRAINT "merge_log_reason_present_check"
  CHECK (length(trim("reason")) > 0);

-- A merge log entry that names one person twice records nothing.
ALTER TABLE "PersonMergeLog" ADD CONSTRAINT "merge_log_distinct_persons_check"
  CHECK ("survivorPersonId" <> "mergedPersonId");

-- Erasure is evidence: the timestamp and the actor are recorded together, and
-- an erased row keeps neither ciphertext nor last-4.
ALTER TABLE "PersonSensitive" ADD CONSTRAINT "person_sensitive_erasure_check"
  CHECK (
    "erasedAt" IS NULL
    OR ("erasedBy" IS NOT NULL AND "aadhaarEnc" IS NULL AND "aadhaarLast4" IS NULL)
  );
