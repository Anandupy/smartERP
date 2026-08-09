-- Phase 2 — Student identity
--
-- The permanent learner identity. Purely additive: no existing table is
-- altered beyond the reverse side of the new relations, and no existing row
-- is touched.

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'GRADUATED', 'EXPELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudentCreationMode" AS ENUM ('ADMISSION', 'MIGRATION');

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "genderId" TEXT NOT NULL,
    "religionId" TEXT,
    "casteId" TEXT,
    "categoryId" TEXT,
    "motherTongueId" TEXT,
    "bloodGroupId" TEXT,
    "disabilityStatus" BOOLEAN NOT NULL DEFAULT false,
    "disabilityTypeId" TEXT,
    "disabilityNotes" TEXT,
    "primaryMobile" TEXT,
    "mobileNormalized" TEXT,
    "primaryEmail" TEXT,
    "apaarId" TEXT,
    "abcId" TEXT,
    "penNo" TEXT,
    "saralId" TEXT,
    "udiseStudentId" TEXT,
    "photoDocumentId" TEXT,
    "createdVia" "StudentCreationMode" NOT NULL,
    "sourceApplicantId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_personId_key" ON "Student"("personId");

-- CreateIndex
CREATE INDEX "Student_organizationId_branchId_status_idx" ON "Student"("organizationId", "branchId", "status");

-- CreateIndex
CREATE INDEX "Student_organizationId_mobileNormalized_idx" ON "Student"("organizationId", "mobileNormalized");

-- CreateIndex
CREATE INDEX "Student_organizationId_dob_idx" ON "Student"("organizationId", "dob");

-- CreateIndex
CREATE INDEX "Student_sourceApplicantId_idx" ON "Student"("sourceApplicantId");

-- CreateIndex
CREATE INDEX "Student_personId_idx" ON "Student"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_organizationId_studentCode_key" ON "Student"("organizationId", "studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Student_organizationId_personId_key" ON "Student"("organizationId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_id_organizationId_key" ON "Student"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_genderId_fkey" FOREIGN KEY ("genderId") REFERENCES "Gender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_religionId_fkey" FOREIGN KEY ("religionId") REFERENCES "Religion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_casteId_fkey" FOREIGN KEY ("casteId") REFERENCES "Caste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_motherTongueId_fkey" FOREIGN KEY ("motherTongueId") REFERENCES "Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_bloodGroupId_fkey" FOREIGN KEY ("bloodGroupId") REFERENCES "BloodGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_disabilityTypeId_fkey" FOREIGN KEY ("disabilityTypeId") REFERENCES "Disability"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariants Prisma cannot express (§40)
-- ---------------------------------------------------------------------------

-- INV-STU-009 — one Applicant produces at most one Student.
--
-- Partial, because a migrated student legitimately has no application behind
-- it. Without this the rule is a convention that two concurrent requests break.
CREATE UNIQUE INDEX "student_one_per_applicant"
  ON "Student" ("sourceApplicantId")
  WHERE "sourceApplicantId" IS NOT NULL;

-- MIGRATION is the only creation mode permitting a null sourceApplicantId. A
-- student marked ADMISSION with no application behind it is a record whose
-- provenance nobody can reconstruct.
ALTER TABLE "Student" ADD CONSTRAINT "student_origin_check"
  CHECK ("createdVia" = 'MIGRATION' OR "sourceApplicantId" IS NOT NULL);

-- A blank code is worse than a missing one: it looks like an identifier, sorts
-- first, and collides with the next blank.
ALTER TABLE "Student" ADD CONSTRAINT "student_code_nonblank_check"
  CHECK (length(trim("studentCode")) > 0);

-- The date of birth is the primary discriminator between same-named people and
-- is worthless if it can be nonsense.
ALTER TABLE "Student" ADD CONSTRAINT "student_dob_plausible_check"
  CHECK ("dob" > '1900-01-01' AND "dob" <= CURRENT_DATE);

-- Display name is what the trigram index searches; an empty one matches every
-- other empty one.
ALTER TABLE "Student" ADD CONSTRAINT "student_display_name_nonblank_check"
  CHECK (length(trim("displayName")) > 0);

-- ---------------------------------------------------------------------------
-- Search indexes (§41.1)
-- ---------------------------------------------------------------------------

-- Prefix and case-insensitive search on the code. Trigram rather than
-- text_pattern_ops, which Prisma cannot round-trip through introspection.
CREATE INDEX "student_code_trgm_idx"
  ON "Student" USING GIN ("studentCode" gin_trgm_ops);

-- Fuzzy name search. Requires pg_trgm, installed by the Phase 0 migration.
--
-- Scoped queries always carry organizationId, and a GIN index cannot lead with
-- it usefully, so the planner combines this with the tenant predicate via a
-- bitmap scan rather than reading it alone.
CREATE INDEX "student_display_name_trgm_idx"
  ON "Student" USING GIN ("displayName" gin_trgm_ops);
