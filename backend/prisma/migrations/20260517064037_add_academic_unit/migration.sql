-- CreateEnum
CREATE TYPE "AcademicUnitType" AS ENUM ('SECTION', 'CLASS', 'DIVISION', 'STREAM', 'DEPARTMENT', 'YEAR', 'SEMESTER', 'BATCH', 'CUSTOM');

-- CreateTable
CREATE TABLE "AcademicUnit" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "unitType" "AcademicUnitType" NOT NULL,
    "level" INTEGER NOT NULL,
    "displayOrder" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicUnit_branchId_idx" ON "AcademicUnit"("branchId");

-- CreateIndex
CREATE INDEX "AcademicUnit_programId_idx" ON "AcademicUnit"("programId");

-- CreateIndex
CREATE INDEX "AcademicUnit_academicYearId_idx" ON "AcademicUnit"("academicYearId");

-- CreateIndex
CREATE INDEX "AcademicUnit_parentId_idx" ON "AcademicUnit"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicUnit_academicYearId_parentId_name_key" ON "AcademicUnit"("academicYearId", "parentId", "name");

-- AddForeignKey
ALTER TABLE "AcademicUnit" ADD CONSTRAINT "AcademicUnit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicUnit" ADD CONSTRAINT "AcademicUnit_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicUnit" ADD CONSTRAINT "AcademicUnit_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicUnit" ADD CONSTRAINT "AcademicUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AcademicUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
