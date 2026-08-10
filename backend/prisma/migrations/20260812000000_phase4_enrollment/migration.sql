-- Phase 4 — Enrollment as the academic-placement spine
--
-- Rebuilds Enrollment into the model of §18. Four of the new columns are NOT
-- NULL and none of them can be derived from what the Phase 0 shape stored:
-- there is no Admission to point `admissionId` at, and no Student to point
-- `studentId` at, for a row that predates both tables.
--
-- Section 0 therefore refuses to run against a non-empty table rather than
-- guessing. Both databases were inventoried before this was written and both
-- hold zero Enrollment rows, zero Students and zero Admissions; the guard is
-- what makes that a verified fact at deploy time on every other environment
-- instead of an assumption carried over from a developer's laptop.


-- ---------------------------------------------------------------------------
-- 0. Refuse to destroy academic history
--
-- If this fires, the migration is not the problem. Each surviving row needs a
-- Student and an Admission created for it first — a data operation with its own
-- decisions, not something a schema migration may improvise. See §129.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  existing bigint;
BEGIN
  SELECT count(*) INTO existing FROM "Enrollment";

  IF existing > 0 THEN
    RAISE EXCEPTION
      'Enrollment holds % row(s). Phase 4 adds four NOT NULL columns that cannot be derived from the Phase 0 shape (admissionId, studentId, originType, and the status enum). Backfill Student and Admission for these rows and supply an expand-migrate-contract migration instead of this one.',
      existing;
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "EnrollmentKind" AS ENUM ('PRIMARY', 'SECONDARY', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'ON_BREAK', 'PROMOTED', 'DETAINED', 'COMPLETED', 'TRANSFERRED', 'DROPPED_OUT', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "EnrollmentOriginType" AS ENUM ('ADMISSION', 'PROMOTION', 'REPEAT', 'CORRECTION', 'TRANSFER', 'READMISSION', 'MIGRATION');

-- CreateEnum
CREATE TYPE "EnrollmentResultOutcome" AS ENUM ('PASS', 'FAIL', 'WITHHELD');


-- ---------------------------------------------------------------------------
-- 2. Replace the single-column foreign keys with composite ones
--
-- `programId` and `academicUnitId` had plain foreign keys that proved only that
-- the row existed somewhere in the database. That is how a Branch A
-- administrator could place a student into a Branch B class.
-- ---------------------------------------------------------------------------

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_academicUnitId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_applicantId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_programId_fkey";

-- DropIndex
DROP INDEX "Enrollment_academicUnitId_idx";

-- DropIndex
DROP INDEX "Enrollment_academicYearId_idx";

-- DropIndex
DROP INDEX "Enrollment_branchId_idx";

-- DropIndex
DROP INDEX "Enrollment_programId_idx";


-- ---------------------------------------------------------------------------
-- 3. The Phase 4 columns
--
-- `enrollmentStatus` moves from a free string to an enum. Dropped and re-added
-- rather than cast in place, which is safe only because section 0 has already
-- established the table is empty.
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "admissionId" TEXT NOT NULL,
ADD COLUMN     "changeReason" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "enrollmentKind" "EnrollmentKind" NOT NULL DEFAULT 'PRIMARY',
ADD COLUMN     "exitDate" TIMESTAMP(3),
ADD COLUMN     "exitReason" "AdmissionExitReason",
ADD COLUMN     "isRepeat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originType" "EnrollmentOriginType" NOT NULL,
ADD COLUMN     "previousEnrollmentId" TEXT,
ADD COLUMN     "resultOutcome" "EnrollmentResultOutcome",
ADD COLUMN     "studentId" TEXT NOT NULL,
ADD COLUMN     "supersededById" TEXT,
ADD COLUMN     "updatedBy" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "enrollmentStatus",
ADD COLUMN     "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING';


-- ---------------------------------------------------------------------------
-- 4. Composite-reference targets
--
-- Redundant as uniqueness rules — `id` is already unique on both tables — and
-- that is the point. They exist so a referencing row can pin the branch,
-- programme and year of what it names.
-- ---------------------------------------------------------------------------

-- CreateIndex
CREATE UNIQUE INDEX "AcademicUnit_id_branchId_programId_academicYearId_key" ON "AcademicUnit"("id", "branchId", "programId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Program_id_branchId_key" ON "Program"("id", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_supersededById_key" ON "Enrollment"("supersededById");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_id_studentId_key" ON "Enrollment"("id", "studentId");


-- ---------------------------------------------------------------------------
-- 5. Indexes, each derived from a query pattern in §41.2
-- ---------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "Enrollment_studentId_academicYearId_enrollmentStatus_idx" ON "Enrollment"("studentId", "academicYearId", "enrollmentStatus");

-- CreateIndex
CREATE INDEX "Enrollment_academicUnitId_academicYearId_enrollmentStatus_idx" ON "Enrollment"("academicUnitId", "academicYearId", "enrollmentStatus");

-- CreateIndex
CREATE INDEX "Enrollment_admissionId_academicYearId_idx" ON "Enrollment"("admissionId", "academicYearId");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_createdAt_idx" ON "Enrollment"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Enrollment_branchId_academicYearId_enrollmentStatus_idx" ON "Enrollment"("branchId", "academicYearId", "enrollmentStatus");

-- CreateIndex
CREATE INDEX "Enrollment_programId_academicYearId_idx" ON "Enrollment"("programId", "academicYearId");

-- CreateIndex
CREATE INDEX "Enrollment_previousEnrollmentId_idx" ON "Enrollment"("previousEnrollmentId");


-- ---------------------------------------------------------------------------
-- 6. Foreign keys
-- ---------------------------------------------------------------------------

-- INV-ENR-003 and INV-ENR-004 in one key: an enrolment's student is its
-- admission's student, and its branch is its admission's branch.
-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_admissionId_studentId_branchId_fkey" FOREIGN KEY ("admissionId", "studentId", "branchId") REFERENCES "Admission"("id", "studentId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- INV-ENR-010 and the §28.3 structure checks: the unit belongs to this branch,
-- this programme and this year.
-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicUnitId_branchId_programId_academicYearI_fkey" FOREIGN KEY ("academicUnitId", "branchId", "programId", "academicYearId") REFERENCES "AcademicUnit"("id", "branchId", "programId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_programId_branchId_fkey" FOREIGN KEY ("programId", "branchId") REFERENCES "Program"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RESTRICT, not SET NULL and never CASCADE: an application a whole school
-- career descends from is not deletable, and nulling the pointer would erase
-- the provenance rather than refuse the deletion.
-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_previousEnrollmentId_fkey" FOREIGN KEY ("previousEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- 7. Partial unique indexes (§40.2)
-- ---------------------------------------------------------------------------

-- INV-ENR-002 — one live PRIMARY enrolment per admission per academic year.
--
-- The SUPERSEDED and CANCELLED exclusions are load-bearing. Without them the
-- Primary-1 → Primary-2 correction is rejected, because the old row and its
-- replacement necessarily share an admission and a year — which is the whole
-- mechanism by which correction history is preserved.
CREATE UNIQUE INDEX "enrollment_one_primary_per_year"
  ON "Enrollment" ("admissionId", "academicYearId")
  WHERE "enrollmentKind" = 'PRIMARY'
    AND "deletedAt" IS NULL
    AND "enrollmentStatus" NOT IN ('SUPERSEDED', 'CANCELLED');

-- INV-ENR-007 — a roll number is a position in one class register for one year.
-- Globally it means nothing: Std 10-A and Std 10-B both have a Roll 1.
CREATE UNIQUE INDEX "enrollment_rollno_unique"
  ON "Enrollment" ("academicUnitId", "academicYearId", "rollNumber")
  WHERE "rollNumber" IS NOT NULL
    AND "deletedAt" IS NULL
    AND "enrollmentStatus" NOT IN ('SUPERSEDED', 'CANCELLED');


-- ---------------------------------------------------------------------------
-- 8. CHECK constraints (§40.3)
-- ---------------------------------------------------------------------------

-- INV-ENR-005 and INV-ENR-006 — a superseded row names its successor and says
-- why. `length(trim(...)) > 0` rather than NOT NULL, because a mandatory-reason
-- field that accepts "   " is a mandatory-keystroke field.
ALTER TABLE "Enrollment" ADD CONSTRAINT "enrollment_supersede_check"
  CHECK (
    "enrollmentStatus" <> 'SUPERSEDED'
    OR ("supersededById" IS NOT NULL
        AND "changeReason" IS NOT NULL
        AND length(trim("changeReason")) > 0)
  );

-- The converse of the supersede rule, from the replacement's side: a row that
-- exists because of an operator's correction or a mid-year move must say which
-- row it replaces and why. Promotion and repeat are ordinary progression and
-- need no explanation; admission and migration have no predecessor at all.
ALTER TABLE "Enrollment" ADD CONSTRAINT "enrollment_provenance_check"
  CHECK (
    "originType" NOT IN ('CORRECTION', 'TRANSFER')
    OR ("previousEnrollmentId" IS NOT NULL
        AND "changeReason" IS NOT NULL
        AND length(trim("changeReason")) > 0)
  );

-- A placement neither follows nor replaces itself.
ALTER TABLE "Enrollment" ADD CONSTRAINT "enrollment_no_self_chain_check"
  CHECK (
    ("previousEnrollmentId" IS NULL OR "previousEnrollmentId" <> "id")
    AND ("supersededById" IS NULL OR "supersededById" <> "id")
  );

-- An exit that predates the placement is not an exit.
ALTER TABLE "Enrollment" ADD CONSTRAINT "enrollment_exit_order_check"
  CHECK ("exitDate" IS NULL OR "exitDate" >= "createdAt");

-- The two exits Phase 4 writes carry both a date and a reason, so a cancelled
-- or abandoned placement can always answer "when, and why". The other closed
-- states are closed by a successor row that carries the meaning instead.
ALTER TABLE "Enrollment" ADD CONSTRAINT "enrollment_exit_pair_check"
  CHECK (
    "enrollmentStatus" NOT IN ('CANCELLED', 'DROPPED_OUT')
    OR ("exitDate" IS NOT NULL AND "exitReason" IS NOT NULL)
  );

-- A blank roll number is not an unassigned one, and the partial unique index
-- above would treat '' and '  ' as distinct positions.
ALTER TABLE "Enrollment" ADD CONSTRAINT "enrollment_rollno_nonblank_check"
  CHECK ("rollNumber" IS NULL OR length(trim("rollNumber")) > 0);


-- ---------------------------------------------------------------------------
-- 9. The supersede pair is established atomically, so its links defer
--
-- A correction has to close the old row and insert its replacement in one
-- transaction, and with immediately-checked constraints there is no order that
-- works:
--
--   insert first, then close  → `enrollment_one_primary_per_year` counts the
--                               original while it is still live and rejects
--                               the replacement — the very index that makes
--                               the correction necessary
--   close first, then insert  → `enrollment_supersede_check` demands a
--                               successor the moment the status becomes
--                               SUPERSEDED, and the self-referencing foreign
--                               key rejects an id that does not exist yet
--
-- Deferring the two self-references resolves it: within the transaction the
-- pair is momentarily incomplete, and at COMMIT both ends must exist. Nothing
-- outside a transaction is affected, and a dangling link still cannot be
-- committed.
--
-- Only the self-references defer. Every other foreign key stays immediate.
-- ---------------------------------------------------------------------------

ALTER TABLE "Enrollment"
  DROP CONSTRAINT "Enrollment_supersededById_fkey",
  ADD CONSTRAINT "Enrollment_supersededById_fkey"
    FOREIGN KEY ("supersededById") REFERENCES "Enrollment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "Enrollment"
  DROP CONSTRAINT "Enrollment_previousEnrollmentId_fkey",
  ADD CONSTRAINT "Enrollment_previousEnrollmentId_fkey"
    FOREIGN KEY ("previousEnrollmentId") REFERENCES "Enrollment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED;
