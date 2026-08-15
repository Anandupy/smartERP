-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('PERSON', 'APPLICANT', 'ADMISSION', 'ENROLLMENT', 'STUDENT', 'ORGANIZATION', 'BRANCH');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "hasExpiry" BOOLEAN NOT NULL DEFAULT false,
    "defaultValidityMonths" INTEGER,
    "retentionYears" INTEGER,
    "allowedMimeTypes" TEXT[],
    "maxSizeBytes" INTEGER NOT NULL DEFAULT 10485760,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "documentTypeId" TEXT NOT NULL,
    "appliesToProgramId" TEXT,
    "appliesToQuotaId" TEXT,
    "appliesToCategoryId" TEXT,
    "requiredByStage" "AdmissionApplicationStatus" NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "ownerType" "DocumentOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentVersionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "archiveReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL,
    "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
    "scanCompletedAt" TIMESTAMP(3),
    "scanDetails" TEXT,
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentType_organizationId_idx" ON "DocumentType"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentType_branchId_idx" ON "DocumentType"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_organizationId_branchId_code_key" ON "DocumentType"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_organizationId_branchId_name_key" ON "DocumentType"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "DocumentRequirement_organizationId_branchId_idx" ON "DocumentRequirement"("organizationId", "branchId");

-- CreateIndex
CREATE INDEX "DocumentRequirement_documentTypeId_idx" ON "DocumentRequirement"("documentTypeId");

-- CreateIndex
CREATE INDEX "DocumentRequirement_appliesToProgramId_idx" ON "DocumentRequirement"("appliesToProgramId");

-- CreateIndex
CREATE INDEX "DocumentRequirement_appliesToQuotaId_idx" ON "DocumentRequirement"("appliesToQuotaId");

-- CreateIndex
CREATE INDEX "DocumentRequirement_appliesToCategoryId_idx" ON "DocumentRequirement"("appliesToCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_currentVersionId_key" ON "Document"("currentVersionId");

-- CreateIndex
CREATE INDEX "Document_organizationId_ownerType_ownerId_idx" ON "Document"("organizationId", "ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "Document_documentTypeId_idx" ON "Document"("documentTypeId");

-- CreateIndex
CREATE INDEX "Document_branchId_idx" ON "Document"("branchId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_checksumSha256_idx" ON "DocumentVersion"("checksumSha256");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_appliesToProgramId_fkey" FOREIGN KEY ("appliesToProgramId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_appliesToQuotaId_fkey" FOREIGN KEY ("appliesToQuotaId") REFERENCES "Quota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_appliesToCategoryId_fkey" FOREIGN KEY ("appliesToCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- R5 hand-written invariants (not expressible in Prisma's declarative schema)
--
-- One ACTIVE document per owner+type. A second upload of the same type for
-- the same owner is a new VERSION on the existing Document, not a second
-- Document row — this is what makes the "simultaneous first upload for the
-- same requirement" race resolve to one winner at the database rather than
-- at whichever service instance happens to run first. Partial so an
-- ARCHIVED document never blocks a fresh one from starting.
CREATE UNIQUE INDEX "Document_owner_type_active_key" ON "Document" ("organizationId", "ownerType", "ownerId", "documentTypeId") WHERE "status" = 'ACTIVE';

-- A document cannot be marked ARCHIVED without both a timestamp and who did
-- it — mirrors the closed-Admission CHECK: a state change with no recorded
-- actor cannot be explained later.
ALTER TABLE "Document" ADD CONSTRAINT "Document_archive_fields_check" CHECK (
  ("status" = 'ACTIVE' AND "archivedAt" IS NULL AND "archivedBy" IS NULL)
  OR
  ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL AND "archivedBy" IS NOT NULL)
);

-- A rejected version must carry a reason; every other status must not,
-- since a stale reason from a previous rejection reused as though it
-- explained a later, different verification decision.
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_rejection_reason_check" CHECK (
  ("verificationStatus" = 'REJECTED' AND "rejectionReason" IS NOT NULL)
  OR
  ("verificationStatus" != 'REJECTED' AND "rejectionReason" IS NULL)
);

-- Version numbering starts at 1 — a zero or negative version number can
-- only come from a bug, never a legitimate upload.
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_version_number_positive_check" CHECK ("versionNumber" >= 1);
