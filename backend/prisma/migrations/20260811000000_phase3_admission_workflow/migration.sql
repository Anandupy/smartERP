-- Phase 3 — Admission model and the applicant workflow
--
-- Additive. No existing column is dropped and no existing row is rewritten.
--
-- Two constraints are added NOT VALID, deliberately. See section 3.

-- CreateEnum
CREATE TYPE "ProgramPreferenceStatus" AS ENUM ('PENDING', 'ALLOTTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('REGULAR', 'LATERAL_ENTRY', 'TRANSFER', 'MIGRATION', 'READMISSION', 'BRANCH_TRANSFER', 'RTE');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'TRANSFERRED_OUT');

-- CreateEnum
CREATE TYPE "AdmissionExitReason" AS ENUM ('GRADUATED', 'TRANSFER_OUT', 'BRANCH_TRANSFER', 'DROPPED_OUT', 'EXPELLED', 'DECEASED', 'CANCELLED_BEFORE_JOINING');

-- AlterTable
ALTER TABLE "Applicant" ADD COLUMN     "deferredAt" TIMESTAMP(3),
ADD COLUMN     "deferredFromApplicantId" TEXT,
ADD COLUMN     "offerExpiresAt" TIMESTAMP(3),
ADD COLUMN     "offerIssuedAt" TIMESTAMP(3),
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "programId" TEXT,
ADD COLUMN     "seatConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "admissionType" "AdmissionType" NOT NULL,
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "entryProgramId" TEXT NOT NULL,
    "entryAcademicUnitId" TEXT NOT NULL,
    "quotaId" TEXT,
    "admissionSourceId" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceApplicantId" TEXT,
    "previousAdmissionId" TEXT,
    "exitDate" TIMESTAMP(3),
    "exitReason" "AdmissionExitReason",
    "exitRemarks" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantProgramPreference" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "preferenceOrder" INTEGER NOT NULL,
    "status" "ProgramPreferenceStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantProgramPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Admission_studentId_status_idx" ON "Admission"("studentId", "status");

-- CreateIndex
CREATE INDEX "Admission_branchId_admissionDate_idx" ON "Admission"("branchId", "admissionDate");

-- CreateIndex
CREATE INDEX "Admission_organizationId_idx" ON "Admission"("organizationId");

-- CreateIndex
CREATE INDEX "Admission_sourceApplicantId_idx" ON "Admission"("sourceApplicantId");

-- CreateIndex
CREATE INDEX "Admission_previousAdmissionId_idx" ON "Admission"("previousAdmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_branchId_admissionNo_key" ON "Admission"("branchId", "admissionNo");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_id_studentId_key" ON "Admission"("id", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_id_studentId_branchId_key" ON "Admission"("id", "studentId", "branchId");

-- CreateIndex
CREATE INDEX "ApplicantProgramPreference_programId_idx" ON "ApplicantProgramPreference"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantProgramPreference_applicantId_preferenceOrder_key" ON "ApplicantProgramPreference"("applicantId", "preferenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantProgramPreference_applicantId_programId_key" ON "ApplicantProgramPreference"("applicantId", "programId");

-- CreateIndex
CREATE INDEX "Applicant_personId_idx" ON "Applicant"("personId");

-- CreateIndex
CREATE INDEX "Applicant_programId_idx" ON "Applicant"("programId");

-- CreateIndex
CREATE INDEX "Applicant_deferredFromApplicantId_idx" ON "Applicant"("deferredFromApplicantId");

-- CreateIndex
CREATE INDEX "Applicant_admissionStatus_offerExpiresAt_idx" ON "Applicant"("admissionStatus", "offerExpiresAt");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_entryProgramId_fkey" FOREIGN KEY ("entryProgramId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_entryAcademicUnitId_fkey" FOREIGN KEY ("entryAcademicUnitId") REFERENCES "AcademicUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "Quota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_admissionSourceId_fkey" FOREIGN KEY ("admissionSourceId") REFERENCES "AdmissionSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_sourceApplicantId_fkey" FOREIGN KEY ("sourceApplicantId") REFERENCES "Applicant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_previousAdmissionId_fkey" FOREIGN KEY ("previousAdmissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_deferredFromApplicantId_fkey" FOREIGN KEY ("deferredFromApplicantId") REFERENCES "Applicant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantProgramPreference" ADD CONSTRAINT "ApplicantProgramPreference_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantProgramPreference" ADD CONSTRAINT "ApplicantProgramPreference_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- 1. Admission invariants (§31, §40)
-- ---------------------------------------------------------------------------

-- INV-ADM-002 — one ACTIVE admission per student.
--
-- A student cannot be simultaneously admitted twice. This is what a branch
-- transfer has to close before it can open the next spell, and what stops a
-- readmission running in parallel with the admission it is meant to follow.
CREATE UNIQUE INDEX "admission_one_active"
  ON "Admission" ("studentId")
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

-- INV-ADM-004 — a closed admission carries both a date and a reason.
--
-- A spell that ended for no recorded reason cannot produce a Transfer
-- Certificate and cannot be counted correctly on a government return.
ALTER TABLE "Admission" ADD CONSTRAINT "admission_exit_check"
  CHECK (
    "status" NOT IN ('COMPLETED', 'CANCELLED', 'TRANSFERRED_OUT')
    OR ("exitDate" IS NOT NULL AND "exitReason" IS NOT NULL)
  );

-- The converse: an admission that is still running has not exited.
ALTER TABLE "Admission" ADD CONSTRAINT "admission_open_has_no_exit_check"
  CHECK (
    "status" IN ('COMPLETED', 'CANCELLED', 'TRANSFERRED_OUT')
    OR ("exitDate" IS NULL AND "exitReason" IS NULL)
  );

-- Exit cannot precede joining.
ALTER TABLE "Admission" ADD CONSTRAINT "admission_exit_after_entry_check"
  CHECK ("exitDate" IS NULL OR "exitDate" >= "admissionDate");

-- A spell does not continue from itself.
ALTER TABLE "Admission" ADD CONSTRAINT "admission_no_self_chain_check"
  CHECK ("previousAdmissionId" IS NULL OR "previousAdmissionId" <> "id");

ALTER TABLE "Admission" ADD CONSTRAINT "admission_no_blank_check"
  CHECK (length(trim("admissionNo")) > 0);

-- ---------------------------------------------------------------------------
-- 2. One active application per person, per branch, per year (§33)
--
-- Closes the A-2 gap: the rule was frozen long ago and nothing enforced it,
-- because before Person there was no key to enforce it on. The excluded
-- statuses are the ones that end an attempt — a rejected applicant may
-- legitimately apply again, and a deferred one is expected to.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "applicant_one_active"
  ON "Applicant" ("personId", "branchId", "academicYearId")
  WHERE "personId" IS NOT NULL
    AND "deletedAt" IS NULL
    AND "admissionStatus" NOT IN
        ('REJECTED', 'WITHDRAWN', 'CANCELLED', 'DEFERRED');

-- ---------------------------------------------------------------------------
-- 3. Applicant progression constraints — added NOT VALID, on purpose
--
-- Both rules are correct going forward and neither holds for what is already
-- stored: this database carries one applicant that reached SUBMITTED before
-- either column existed, so it has no person and no programme and there is no
-- Enrollment to derive a programme from (blueprint §50 Q9).
--
-- NOT VALID enforces the constraint on every INSERT and on every UPDATE, while
-- skipping the initial scan of existing rows. So the legacy row is grandfathered
-- and cannot be moved forward without being fixed, while nothing new can be
-- created in the state it is in.
--
-- The alternatives were worse. Making the columns permanently nullable turns a
-- temporary data problem into a permanent schema scar; back-filling would mean
-- inventing a programme choice nobody made; deleting the row is not this
-- migration's call to make.
--
-- To finish the job once the legacy applicant is resolved:
--
--   SELECT id, "admissionStatus" FROM "Applicant"
--    WHERE "admissionStatus" <> 'DRAFT'
--      AND ("personId" IS NULL OR "programId" IS NULL);
--   -- resolve each, then:
--   ALTER TABLE "Applicant" VALIDATE CONSTRAINT "applicant_person_from_submitted_check";
--   ALTER TABLE "Applicant" VALIDATE CONSTRAINT "applicant_program_from_submitted_check";
-- ---------------------------------------------------------------------------

ALTER TABLE "Applicant" ADD CONSTRAINT "applicant_person_from_submitted_check"
  CHECK ("admissionStatus" = 'DRAFT' OR "personId" IS NOT NULL) NOT VALID;

ALTER TABLE "Applicant" ADD CONSTRAINT "applicant_program_from_submitted_check"
  CHECK ("admissionStatus" = 'DRAFT' OR "programId" IS NOT NULL) NOT VALID;

-- An offer has both of its dates or neither, and does not lapse before it is made.
ALTER TABLE "Applicant" ADD CONSTRAINT "applicant_offer_window_check"
  CHECK (
    ("offerIssuedAt" IS NULL) = ("offerExpiresAt" IS NULL)
    AND ("offerExpiresAt" IS NULL OR "offerExpiresAt" > "offerIssuedAt")
  );

-- An application does not defer from itself.
ALTER TABLE "Applicant" ADD CONSTRAINT "applicant_no_self_deferral_check"
  CHECK ("deferredFromApplicantId" IS NULL OR "deferredFromApplicantId" <> "id");

-- ---------------------------------------------------------------------------
-- 4. Programme preferences
-- ---------------------------------------------------------------------------

-- Positions start at 1 and count upward. A zero or negative position sorts
-- ahead of the first choice and means nothing.
ALTER TABLE "ApplicantProgramPreference" ADD CONSTRAINT "preference_order_positive_check"
  CHECK ("preferenceOrder" >= 1);
