-- Phase 0 — Foundation blockers
--
-- Implements the twelve Phase 0 items in
-- docs/planning/student-admission-enrollment-architecture.md §47.
--
-- Written by hand rather than generated, because Prisma's generated form drops
-- and recreates four columns that hold data. Every type change below is an
-- in-place `USING` cast or an add-backfill-tighten sequence.
--
-- The raw indexes and CHECK constraints at the end are invariants Prisma cannot
-- express. `prisma migrate diff` ignores partial and functional indexes, so
-- these do not register as schema drift (verified against the CI gate).

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "AdmissionApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DOCUMENT_PENDING', 'FEE_PENDING', 'WAITLISTED', 'APPROVED', 'SEAT_CONFIRMED', 'DEFERRED', 'ADMITTED', 'REJECTED', 'WITHDRAWN', 'CANCELLED');
CREATE TYPE "WorkflowEntityType" AS ENUM ('APPLICANT', 'ADMISSION', 'ENROLLMENT', 'STUDENT');
CREATE TYPE "SequenceScope" AS ENUM ('ORGANIZATION', 'BRANCH');
CREATE TYPE "AllocationMode" AS ENUM ('MONOTONIC', 'GAPLESS');
CREATE TYPE "SequencePurpose" AS ENUM ('STUDENT_CODE', 'EMPLOYEE_CODE', 'ADMISSION_NO', 'ADMISSION_FORM', 'APPLICATION', 'RECEIPT', 'INVOICE', 'TC_NUMBER', 'CERTIFICATE');
CREATE TYPE "ResetStrategy" AS ENUM ('NEVER', 'YEARLY');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- ---------------------------------------------------------------------------
-- 2. B7 — Applicant.admissionStatus becomes an enum, preserving values
--
-- Every value currently in the column is one of the thirteen names, so the cast
-- is total. Any row that is not is a value the workflow engine could never have
-- produced, and the migration must fail rather than silently coerce it.
-- ---------------------------------------------------------------------------

DO $$
DECLARE bad_count INTEGER;
BEGIN
  SELECT count(*) INTO bad_count
  FROM "Applicant"
  WHERE "admissionStatus" NOT IN (
    'DRAFT','SUBMITTED','UNDER_REVIEW','DOCUMENT_PENDING','FEE_PENDING',
    'WAITLISTED','APPROVED','SEAT_CONFIRMED','DEFERRED','ADMITTED',
    'REJECTED','WITHDRAWN','CANCELLED'
  );
  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'Cannot convert Applicant.admissionStatus: % row(s) hold a value outside AdmissionApplicationStatus. Reconcile them before migrating.',
      bad_count;
  END IF;
END $$;

ALTER TABLE "Applicant" ALTER COLUMN "admissionStatus" DROP DEFAULT;
ALTER TABLE "Applicant"
  ALTER COLUMN "admissionStatus" TYPE "AdmissionApplicationStatus"
  USING "admissionStatus"::"AdmissionApplicationStatus";
ALTER TABLE "Applicant" ALTER COLUMN "admissionStatus" SET DEFAULT 'DRAFT';

-- ---------------------------------------------------------------------------
-- 3. B5 — Numbering gains scope and allocation mode; purpose and reset become
--         enums, preserving values.
--
-- A config whose purpose is not a SequencePurpose is deleted, not coerced. Such
-- rows exist only because the column was a free string — the exact defect this
-- migration closes — and they are unreachable: allocation looks a purpose up by
-- enum value, so nothing can ever ask for one again. Deleting a config with
-- counters would destroy an issued series, so that case aborts instead.
-- ---------------------------------------------------------------------------

DO $$
DECLARE orphan_with_counters INTEGER;
BEGIN
  SELECT count(*) INTO orphan_with_counters
  FROM "NumberSequenceConfig" c
  WHERE c."purpose" NOT IN (
          'STUDENT_CODE','EMPLOYEE_CODE','ADMISSION_NO','ADMISSION_FORM',
          'APPLICATION','RECEIPT','INVOICE','TC_NUMBER','CERTIFICATE')
    AND EXISTS (SELECT 1 FROM "NumberSequenceCounter" k WHERE k."configId" = c."id");

  IF orphan_with_counters > 0 THEN
    RAISE EXCEPTION
      'Cannot convert NumberSequenceConfig.purpose: % config(s) with an unmappable purpose have already issued numbers. Reconcile them by hand before migrating.',
      orphan_with_counters;
  END IF;
END $$;

DELETE FROM "NumberSequenceConfig"
WHERE "purpose" NOT IN (
  'STUDENT_CODE','EMPLOYEE_CODE','ADMISSION_NO','ADMISSION_FORM',
  'APPLICATION','RECEIPT','INVOICE','TC_NUMBER','CERTIFICATE'
);

-- purpose: String -> SequencePurpose
ALTER TABLE "NumberSequenceConfig"
  ALTER COLUMN "purpose" TYPE "SequencePurpose"
  USING "purpose"::"SequencePurpose";

-- resetStrategy: String -> ResetStrategy
ALTER TABLE "NumberSequenceConfig" ALTER COLUMN "resetStrategy" DROP DEFAULT;
ALTER TABLE "NumberSequenceConfig"
  ALTER COLUMN "resetStrategy" TYPE "ResetStrategy"
  USING "resetStrategy"::"ResetStrategy";
ALTER TABLE "NumberSequenceConfig" ALTER COLUMN "resetStrategy" SET DEFAULT 'NEVER';

-- allocationMode: new, defaulted. Every pre-existing sequence is operational
-- (form and application numbers), for which gaps are acceptable.
ALTER TABLE "NumberSequenceConfig"
  ADD COLUMN "allocationMode" "AllocationMode" NOT NULL DEFAULT 'MONOTONIC';

-- scope: add nullable, backfill, then tighten. Every existing config carries a
-- branchId, so all of them are BRANCH-scoped.
ALTER TABLE "NumberSequenceConfig" ADD COLUMN "scope" "SequenceScope";
UPDATE "NumberSequenceConfig" SET "scope" = 'BRANCH' WHERE "scope" IS NULL;
ALTER TABLE "NumberSequenceConfig" ALTER COLUMN "scope" SET NOT NULL;

-- branchId becomes nullable so ORGANIZATION scope is expressible at all. This
-- is B1's sibling defect: `studentCode` unique per organization was previously
-- impossible to declare.
ALTER TABLE "NumberSequenceConfig" ALTER COLUMN "branchId" DROP NOT NULL;

-- The old constraint cannot express two scopes; replaced by two partial
-- indexes in section 8.
DROP INDEX "NumberSequenceConfig_branchId_purpose_key";
CREATE INDEX "NumberSequenceConfig_organizationId_purpose_idx"
  ON "NumberSequenceConfig"("organizationId", "purpose");

-- ---------------------------------------------------------------------------
-- 4. B1 — The counter's uniqueness rule
--
-- `@@unique([configId, academicYearId])` silently does not constrain rows whose
-- academicYearId is null, because Postgres treats NULLs as distinct. Those are
-- exactly the `resetStrategy = NEVER` rows that STUDENT_CODE and EMPLOYEE_CODE
-- use, so every allocation would insert a fresh counter starting at 1 and issue
-- duplicate codes indefinitely.
--
-- Replaced by a functional index over a coalesced year, which the ON CONFLICT
-- target in NumberingService matches exactly.
-- ---------------------------------------------------------------------------

DROP INDEX "NumberSequenceCounter_configId_academicYearId_key";

CREATE UNIQUE INDEX "numbering_counter_config_year_unique"
  ON "NumberSequenceCounter" (
    "configId",
    COALESCE("academicYearId", '00000000-0000-0000-0000-000000000000')
  );

-- ---------------------------------------------------------------------------
-- 5. B6 — WorkflowHistory becomes polymorphic
--
-- Existing rows migrate to the new shape rather than being left behind on the
-- old column. organizationId and branchId are carried on the row so a history
-- read can be scoped without joining the entity it describes.
-- ---------------------------------------------------------------------------

ALTER TABLE "WorkflowHistory" ADD COLUMN "entityType" "WorkflowEntityType";
ALTER TABLE "WorkflowHistory" ADD COLUMN "entityId" TEXT;
ALTER TABLE "WorkflowHistory" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "WorkflowHistory" ADD COLUMN "branchId" TEXT;

UPDATE "WorkflowHistory" w
SET "entityType"     = 'APPLICANT',
    "entityId"       = w."applicantId",
    "organizationId" = a."organizationId",
    "branchId"       = a."branchId"
FROM "Applicant" a
WHERE a."id" = w."applicantId";

-- A history row whose applicant no longer exists cannot be scoped, and a
-- history table with unscoped rows cannot be read safely. The old cascade made
-- this unreachable; the check exists because the cascade is being removed.
DO $$
DECLARE unscoped INTEGER;
BEGIN
  SELECT count(*) INTO unscoped FROM "WorkflowHistory"
  WHERE "entityId" IS NULL OR "organizationId" IS NULL OR "branchId" IS NULL;
  IF unscoped > 0 THEN
    RAISE EXCEPTION
      'Cannot migrate WorkflowHistory: % row(s) reference an applicant that no longer exists and cannot be scoped.',
      unscoped;
  END IF;
END $$;

ALTER TABLE "WorkflowHistory" ALTER COLUMN "entityType"     SET NOT NULL;
ALTER TABLE "WorkflowHistory" ALTER COLUMN "entityId"       SET NOT NULL;
ALTER TABLE "WorkflowHistory" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "WorkflowHistory" ALTER COLUMN "branchId"       SET NOT NULL;

ALTER TABLE "WorkflowHistory" DROP CONSTRAINT "WorkflowHistory_applicantId_fkey";
DROP INDEX "WorkflowHistory_applicantId_idx";
ALTER TABLE "WorkflowHistory" DROP COLUMN "applicantId";

CREATE INDEX "WorkflowHistory_entityType_entityId_timestamp_idx"
  ON "WorkflowHistory"("entityType", "entityId", "timestamp");
CREATE INDEX "WorkflowHistory_organizationId_idx" ON "WorkflowHistory"("organizationId");
CREATE INDEX "WorkflowHistory_branchId_idx"       ON "WorkflowHistory"("branchId");

-- ---------------------------------------------------------------------------
-- 6. B4 — Enrollment stops being one-per-applicant-for-life, and stops being
--         destroyed by an applicant deletion.
--
-- This is the de-risked Phase 0 shape. studentId, admissionId, the provenance
-- columns and the composite foreign key arrive in Phase 4.
-- ---------------------------------------------------------------------------

ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_applicantId_fkey";
DROP INDEX "Enrollment_applicantId_key";

ALTER TABLE "Enrollment" DROP COLUMN "futureStudentId";
ALTER TABLE "Enrollment" ALTER COLUMN "applicantId" DROP NOT NULL;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_applicantId_fkey"
  FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Enrollment_applicantId_idx" ON "Enrollment"("applicantId");

-- ---------------------------------------------------------------------------
-- 7. B8 — Transactional outbox, and audit deduplication
-- ---------------------------------------------------------------------------

CREATE TABLE "OutboxEvent" (
    "id"              TEXT NOT NULL,
    "eventId"         TEXT NOT NULL,
    "eventName"       TEXT NOT NULL,
    "aggregateType"   TEXT NOT NULL,
    "aggregateId"     TEXT NOT NULL,
    "occurredAt"      TIMESTAMP(3) NOT NULL,
    "payload"         JSONB NOT NULL,
    "metadata"        JSONB,
    "contextSnapshot" JSONB NOT NULL,
    "organizationId"  TEXT,
    "status"          "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts"        INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt"     TIMESTAMP(3),
    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");
CREATE INDEX "OutboxEvent_organizationId_idx" ON "OutboxEvent"("organizationId");

-- Outbox delivery is at-least-once. Without this, a relay retry writes a second
-- audit row indistinguishable from a genuine second event.
ALTER TABLE "AuditLog" ADD COLUMN "eventId" TEXT;
CREATE UNIQUE INDEX "AuditLog_eventId_key" ON "AuditLog"("eventId");

-- ---------------------------------------------------------------------------
-- 8. Invariants Prisma cannot express
--
-- Partial unique indexes and CHECK constraints. A rule the service alone
-- enforces is not an invariant.
-- ---------------------------------------------------------------------------

-- INV-NUM-001 / INV-NUM-002 — one config per purpose per scope
CREATE UNIQUE INDEX "numbering_config_org_purpose_unique"
  ON "NumberSequenceConfig" ("organizationId", "purpose")
  WHERE "scope" = 'ORGANIZATION' AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX "numbering_config_branch_purpose_unique"
  ON "NumberSequenceConfig" ("branchId", "purpose")
  WHERE "scope" = 'BRANCH' AND "deletedAt" IS NULL;

-- INV-NUM-003 — branchId present exactly when the scope is BRANCH
ALTER TABLE "NumberSequenceConfig" ADD CONSTRAINT "numbering_scope_branch_check"
  CHECK (("scope" = 'BRANCH') = ("branchId" IS NOT NULL));

-- INV-NUM-006 — a format without {sequence} renders every value identically,
-- and the failure surfaces as a confusing unique violation at the destination.
ALTER TABLE "NumberSequenceConfig" ADD CONSTRAINT "numbering_format_has_sequence_check"
  CHECK (position('{sequence}' in "format") > 0);

-- INV-NUM-005 — a counter never runs backwards
ALTER TABLE "NumberSequenceCounter" ADD CONSTRAINT "numbering_counter_non_negative_check"
  CHECK ("currentValue" >= 0);

-- ---------------------------------------------------------------------------
-- 9. B11 — Extensions required by the search design (§41.5)
--
-- Available on this server but not installed. Created here so a fresh database
-- reached by migrations alone is ready for the Phase 2 trigram indexes, rather
-- than failing at the migration that needs them.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
