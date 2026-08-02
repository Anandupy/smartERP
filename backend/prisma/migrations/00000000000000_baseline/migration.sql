-- CampusFlow ERP — schema baseline.
--
-- This single migration creates the complete schema. It replaces an earlier
-- history that had fallen far behind: development had been evolved with
-- `prisma db push`, so only 9 of the 43 tables were ever expressed as
-- migrations. `prisma migrate deploy` against a fresh database produced a
-- system missing audit, admissions, communication, authorization and
-- navigation entirely.
--
-- Existing databases that already carry this schema must be baselined once
-- rather than re-running it:
--
--   prisma migrate resolve --applied 00000000000000_baseline
--
-- See docs/core/migrations.md for the full procedure.

-- CreateEnum
CREATE TYPE "AcademicUnitType" AS ENUM ('SECTION', 'CLASS', 'DIVISION', 'STREAM', 'DEPARTMENT', 'YEAR', 'SEMESTER', 'BATCH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ProgramLevel" AS ENUM ('SCHOOL', 'COLLEGE', 'DEGREE');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'STAFF', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OverrideType" AS ENUM ('GRANT', 'DENY');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('AUTHENTICATION', 'ACADEMIC', 'ADMISSIONS', 'FEES', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFY', 'PHONE_VERIFY', 'MFA', 'PAYMENT', 'ADMISSION');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'FAILED', 'BOUNCED', 'RETRIED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('SMTP', 'AWS_SES', 'RESEND', 'MAILGUN', 'POSTMARK', 'TWILIO', 'MSG91', 'META_WHATSAPP', 'FIREBASE_FCM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AffiliationType" AS ENUM ('BOARD', 'UNIVERSITY', 'OTHER');

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('SCHOOL', 'JUNIOR_COLLEGE', 'DEGREE_COLLEGE', 'UNIVERSITY', 'ENGINEERING', 'MEDICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StructureMode" AS ENUM ('DEFAULT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('DEV', 'STAGING', 'PROD');

-- CreateEnum
CREATE TYPE "MaintenanceScopeType" AS ENUM ('GLOBAL', 'ORGANIZATION', 'BRANCH', 'MODULE', 'FEATURE');

-- CreateEnum
CREATE TYPE "MaintenanceSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MenuStatus" AS ENUM ('ACTIVE', 'DISABLED', 'COMING_SOON', 'BETA', 'HIDDEN', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "WorkspaceScopeType" AS ENUM ('PRODUCT', 'ORGANIZATION', 'BRANCH', 'ROLE', 'USER');

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

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "ProgramLevel",
    "medium" TEXT,
    "stream" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "admissionFormNo" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "genderId" TEXT NOT NULL,
    "birthPlace" TEXT,
    "photoFileId" TEXT,
    "religionId" TEXT,
    "casteId" TEXT,
    "categoryId" TEXT,
    "motherTongueId" TEXT,
    "bloodGroupId" TEXT,
    "disabilityStatus" BOOLEAN NOT NULL DEFAULT false,
    "disabilityTypeId" TEXT,
    "disabilityNotes" TEXT,
    "aadhaarNo" TEXT,
    "penNo" TEXT,
    "apaarId" TEXT,
    "primaryMobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "primaryEmail" TEXT,
    "currentAddressLine1" TEXT NOT NULL,
    "currentAddressLine2" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "previousSchoolName" TEXT,
    "previousBoard" TEXT,
    "previousClass" TEXT,
    "previousPercentage" DOUBLE PRECISION,
    "tcNumber" TEXT,
    "admissionSourceId" TEXT,
    "quotaId" TEXT,
    "admissionStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "internalRemarks" TEXT,
    "counsellorRemarks" TEXT,
    "assignedCounsellorId" TEXT,
    "transportRequired" BOOLEAN NOT NULL DEFAULT false,
    "hostelRequired" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "customFieldData" JSONB,
    "checklistStatus" JSONB,
    "tags" JSONB,
    "formTemplateVersion" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "academicUnitId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "futureStudentId" TEXT,
    "rollNumber" TEXT,
    "enrollmentStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "mobilePrimary" TEXT NOT NULL,
    "mobileSecondary" TEXT,
    "email" TEXT,
    "occupation" TEXT,
    "income" DOUBLE PRECISION,
    "aadhaarNo" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantGuardianMapping" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationTypeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "isFinancialGuardian" BOOLEAN NOT NULL DEFAULT false,
    "pickupAllowed" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantGuardianMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Religion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Religion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caste" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Caste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gender" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Gender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BloodGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Disability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RelationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quota" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Quota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionSource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AdmissionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequenceConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "prefix" TEXT,
    "suffix" TEXT,
    "includeBranchCode" BOOLEAN NOT NULL DEFAULT false,
    "includeAcademicYear" BOOLEAN NOT NULL DEFAULT false,
    "sequencePadding" INTEGER NOT NULL DEFAULT 4,
    "format" TEXT NOT NULL,
    "resetStrategy" TEXT NOT NULL DEFAULT 'NEVER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NumberSequenceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequenceCounter" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSequenceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowHistory" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "remarks" TEXT,
    "actionBy" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "device" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockUntil" TIMESTAMP(3),
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "type" "OverrideType" NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "otpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "retryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultEmailProvider" "ProviderType" NOT NULL DEFAULT 'SMTP',
    "defaultSmsProvider" "ProviderType" NOT NULL DEFAULT 'CUSTOM',
    "defaultWhatsappProvider" "ProviderType" NOT NULL DEFAULT 'CUSTOM',
    "defaultPushProvider" "ProviderType" NOT NULL DEFAULT 'CUSTOM',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "bodyText" TEXT,
    "variables" JSONB,
    "language" TEXT NOT NULL DEFAULT 'en',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "provider" "ProviderType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "sender" TEXT,
    "subject" TEXT,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "latencyMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "actionUrl" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "identifier" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resendAvailableAt" TIMESTAMP(3),
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "provider" "ProviderType" NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB NOT NULL,
    "settings" JSONB,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "institutionType" "InstitutionType" NOT NULL,
    "affiliationType" "AffiliationType",
    "affiliationName" TEXT,
    "logoUrl" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "structureMode" "StructureMode" NOT NULL DEFAULT 'DEFAULT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "logoUrl" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "masterExpiryDate" TIMESTAMP(3) NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT,
    "currency" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "role" TEXT,
    "organizationId" TEXT,
    "branchId" TEXT,
    "academicYearId" TEXT,
    "requestId" TEXT,
    "traceId" TEXT,
    "correlationId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "httpMethod" TEXT,
    "route" TEXT,
    "executionTime" INTEGER,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "metadata" JSONB,
    "changes" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRule" (
    "id" TEXT NOT NULL,
    "scopeType" "MaintenanceScopeType" NOT NULL,
    "scopeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowLogin" BOOLEAN NOT NULL DEFAULT false,
    "allowReadApis" BOOLEAN NOT NULL DEFAULT true,
    "allowWriteApis" BOOLEAN NOT NULL DEFAULT false,
    "customStatus" INTEGER NOT NULL DEFAULT 503,
    "customPage" TEXT,
    "bypassRoles" JSONB,
    "title" TEXT,
    "shortMessage" TEXT,
    "description" TEXT,
    "reason" TEXT,
    "estimatedCompletion" TIMESTAMP(3),
    "maintenanceWindow" TEXT,
    "supportContact" TEXT,
    "bannerColor" TEXT,
    "severity" "MaintenanceSeverity" DEFAULT 'INFO',
    "maintenanceIcon" TEXT,
    "announcementLink" TEXT,
    "externalStatusPageUrl" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceDayOfWeek" INTEGER,
    "recurrenceStartTime" TEXT,
    "recurrenceEndTime" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'INR',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en-IN',
    "supportEmail" TEXT NOT NULL,
    "supportPhone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "parentId" TEXT,
    "route" TEXT NOT NULL,
    "componentIdentifier" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "permissionMode" TEXT NOT NULL DEFAULT 'ALL',
    "displayName" TEXT NOT NULL,
    "icon" TEXT,
    "tooltip" TEXT,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "badge" TEXT,
    "searchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "helpUrl" TEXT,
    "documentationUrl" TEXT,
    "status" "MenuStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_configurations" (
    "id" TEXT NOT NULL,
    "scopeType" "WorkspaceScopeType" NOT NULL,
    "scopeId" TEXT,
    "navigationPreferences" JSONB NOT NULL DEFAULT '{}',
    "clientPreferences" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_state" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "initializedAt" TIMESTAMP(3),
    "initializedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_state_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE INDEX "AcademicYear_branchId_idx" ON "AcademicYear"("branchId");

-- CreateIndex
CREATE INDEX "Program_branchId_idx" ON "Program"("branchId");

-- CreateIndex
CREATE INDEX "Program_parentId_idx" ON "Program"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Program_branchId_name_medium_stream_key" ON "Program"("branchId", "name", "medium", "stream");

-- CreateIndex
CREATE INDEX "Applicant_organizationId_idx" ON "Applicant"("organizationId");

-- CreateIndex
CREATE INDEX "Applicant_branchId_idx" ON "Applicant"("branchId");

-- CreateIndex
CREATE INDEX "Applicant_academicYearId_idx" ON "Applicant"("academicYearId");

-- CreateIndex
CREATE INDEX "Applicant_displayName_idx" ON "Applicant"("displayName");

-- CreateIndex
CREATE INDEX "Applicant_primaryMobile_idx" ON "Applicant"("primaryMobile");

-- CreateIndex
CREATE INDEX "Applicant_aadhaarNo_idx" ON "Applicant"("aadhaarNo");

-- CreateIndex
CREATE INDEX "Applicant_applicationNo_idx" ON "Applicant"("applicationNo");

-- CreateIndex
CREATE INDEX "Applicant_admissionFormNo_idx" ON "Applicant"("admissionFormNo");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_branchId_academicYearId_admissionFormNo_key" ON "Applicant"("branchId", "academicYearId", "admissionFormNo");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_branchId_academicYearId_applicationNo_key" ON "Applicant"("branchId", "academicYearId", "applicationNo");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_applicantId_key" ON "Enrollment"("applicantId");

-- CreateIndex
CREATE INDEX "Enrollment_organizationId_idx" ON "Enrollment"("organizationId");

-- CreateIndex
CREATE INDEX "Enrollment_branchId_idx" ON "Enrollment"("branchId");

-- CreateIndex
CREATE INDEX "Enrollment_academicYearId_idx" ON "Enrollment"("academicYearId");

-- CreateIndex
CREATE INDEX "Enrollment_programId_idx" ON "Enrollment"("programId");

-- CreateIndex
CREATE INDEX "Enrollment_academicUnitId_idx" ON "Enrollment"("academicUnitId");

-- CreateIndex
CREATE INDEX "Guardian_organizationId_idx" ON "Guardian"("organizationId");

-- CreateIndex
CREATE INDEX "Guardian_branchId_idx" ON "Guardian"("branchId");

-- CreateIndex
CREATE INDEX "Guardian_mobilePrimary_idx" ON "Guardian"("mobilePrimary");

-- CreateIndex
CREATE INDEX "Guardian_aadhaarNo_idx" ON "Guardian"("aadhaarNo");

-- CreateIndex
CREATE INDEX "ApplicantGuardianMapping_applicantId_idx" ON "ApplicantGuardianMapping"("applicantId");

-- CreateIndex
CREATE INDEX "ApplicantGuardianMapping_guardianId_idx" ON "ApplicantGuardianMapping"("guardianId");

-- CreateIndex
CREATE INDEX "ApplicantGuardianMapping_relationTypeId_idx" ON "ApplicantGuardianMapping"("relationTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantGuardianMapping_applicantId_guardianId_key" ON "ApplicantGuardianMapping"("applicantId", "guardianId");

-- CreateIndex
CREATE INDEX "Religion_organizationId_idx" ON "Religion"("organizationId");

-- CreateIndex
CREATE INDEX "Religion_branchId_idx" ON "Religion"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Religion_organizationId_branchId_code_key" ON "Religion"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Religion_organizationId_branchId_name_key" ON "Religion"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "Caste_organizationId_idx" ON "Caste"("organizationId");

-- CreateIndex
CREATE INDEX "Caste_branchId_idx" ON "Caste"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Caste_organizationId_branchId_code_key" ON "Caste"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Caste_organizationId_branchId_name_key" ON "Caste"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "Category_organizationId_idx" ON "Category"("organizationId");

-- CreateIndex
CREATE INDEX "Category_branchId_idx" ON "Category"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_branchId_code_key" ON "Category"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_branchId_name_key" ON "Category"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "Gender_organizationId_idx" ON "Gender"("organizationId");

-- CreateIndex
CREATE INDEX "Gender_branchId_idx" ON "Gender"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Gender_organizationId_branchId_code_key" ON "Gender"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Gender_organizationId_branchId_name_key" ON "Gender"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "BloodGroup_organizationId_idx" ON "BloodGroup"("organizationId");

-- CreateIndex
CREATE INDEX "BloodGroup_branchId_idx" ON "BloodGroup"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BloodGroup_organizationId_branchId_code_key" ON "BloodGroup"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BloodGroup_organizationId_branchId_name_key" ON "BloodGroup"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "Language_organizationId_idx" ON "Language"("organizationId");

-- CreateIndex
CREATE INDEX "Language_branchId_idx" ON "Language"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Language_organizationId_branchId_code_key" ON "Language"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Language_organizationId_branchId_name_key" ON "Language"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "Disability_organizationId_idx" ON "Disability"("organizationId");

-- CreateIndex
CREATE INDEX "Disability_branchId_idx" ON "Disability"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Disability_organizationId_branchId_code_key" ON "Disability"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Disability_organizationId_branchId_name_key" ON "Disability"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "RelationType_organizationId_idx" ON "RelationType"("organizationId");

-- CreateIndex
CREATE INDEX "RelationType_branchId_idx" ON "RelationType"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "RelationType_organizationId_branchId_code_key" ON "RelationType"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RelationType_organizationId_branchId_name_key" ON "RelationType"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "Quota_organizationId_idx" ON "Quota"("organizationId");

-- CreateIndex
CREATE INDEX "Quota_branchId_idx" ON "Quota"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Quota_organizationId_branchId_code_key" ON "Quota"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Quota_organizationId_branchId_name_key" ON "Quota"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "AdmissionSource_organizationId_idx" ON "AdmissionSource"("organizationId");

-- CreateIndex
CREATE INDEX "AdmissionSource_branchId_idx" ON "AdmissionSource"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionSource_organizationId_branchId_code_key" ON "AdmissionSource"("organizationId", "branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionSource_organizationId_branchId_name_key" ON "AdmissionSource"("organizationId", "branchId", "name");

-- CreateIndex
CREATE INDEX "NumberSequenceConfig_organizationId_idx" ON "NumberSequenceConfig"("organizationId");

-- CreateIndex
CREATE INDEX "NumberSequenceConfig_branchId_idx" ON "NumberSequenceConfig"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequenceConfig_branchId_purpose_key" ON "NumberSequenceConfig"("branchId", "purpose");

-- CreateIndex
CREATE INDEX "NumberSequenceCounter_configId_idx" ON "NumberSequenceCounter"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequenceCounter_configId_academicYearId_key" ON "NumberSequenceCounter"("configId", "academicYearId");

-- CreateIndex
CREATE INDEX "WorkflowHistory_applicantId_idx" ON "WorkflowHistory"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionCategory_code_key" ON "PermissionCategory"("code");

-- CreateIndex
CREATE INDEX "PermissionCategory_code_idx" ON "PermissionCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Permission_name_idx" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Permission_categoryId_idx" ON "Permission"("categoryId");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_permissionId_idx" ON "UserPermissionOverride"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permissionId_key" ON "UserPermissionOverride"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "CommunicationSetting_organizationId_idx" ON "CommunicationSetting"("organizationId");

-- CreateIndex
CREATE INDEX "CommunicationSetting_branchId_idx" ON "CommunicationSetting"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationSetting_organizationId_branchId_key" ON "CommunicationSetting"("organizationId", "branchId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_organizationId_idx" ON "CommunicationTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_branchId_idx" ON "CommunicationTemplate"("branchId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_code_idx" ON "CommunicationTemplate"("code");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_channel_idx" ON "CommunicationTemplate"("channel");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_category_idx" ON "CommunicationTemplate"("category");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_status_idx" ON "CommunicationTemplate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplate_organizationId_branchId_code_channel__key" ON "CommunicationTemplate"("organizationId", "branchId", "code", "channel", "language", "version");

-- CreateIndex
CREATE INDEX "DeliveryLog_recipient_idx" ON "DeliveryLog"("recipient");

-- CreateIndex
CREATE INDEX "DeliveryLog_channel_idx" ON "DeliveryLog"("channel");

-- CreateIndex
CREATE INDEX "DeliveryLog_status_idx" ON "DeliveryLog"("status");

-- CreateIndex
CREATE INDEX "DeliveryLog_provider_idx" ON "DeliveryLog"("provider");

-- CreateIndex
CREATE INDEX "DeliveryLog_templateId_idx" ON "DeliveryLog"("templateId");

-- CreateIndex
CREATE INDEX "DeliveryLog_organizationId_idx" ON "DeliveryLog"("organizationId");

-- CreateIndex
CREATE INDEX "DeliveryLog_branchId_idx" ON "DeliveryLog"("branchId");

-- CreateIndex
CREATE INDEX "DeliveryLog_createdAt_idx" ON "DeliveryLog"("createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_idx" ON "InAppNotification"("userId");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_status_idx" ON "InAppNotification"("userId", "status");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_category_idx" ON "InAppNotification"("userId", "category");

-- CreateIndex
CREATE INDEX "InAppNotification_organizationId_idx" ON "InAppNotification"("organizationId");

-- CreateIndex
CREATE INDEX "InAppNotification_branchId_idx" ON "InAppNotification"("branchId");

-- CreateIndex
CREATE INDEX "InAppNotification_createdAt_idx" ON "InAppNotification"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

-- CreateIndex
CREATE INDEX "OtpToken_identifier_purpose_isUsed_isRevoked_idx" ON "OtpToken"("identifier", "purpose", "isUsed", "isRevoked");

-- CreateIndex
CREATE INDEX "OtpToken_expiresAt_idx" ON "OtpToken"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpToken_organizationId_idx" ON "OtpToken"("organizationId");

-- CreateIndex
CREATE INDEX "OtpToken_branchId_idx" ON "OtpToken"("branchId");

-- CreateIndex
CREATE INDEX "ProviderConfig_organizationId_idx" ON "ProviderConfig"("organizationId");

-- CreateIndex
CREATE INDEX "ProviderConfig_branchId_idx" ON "ProviderConfig"("branchId");

-- CreateIndex
CREATE INDEX "ProviderConfig_provider_idx" ON "ProviderConfig"("provider");

-- CreateIndex
CREATE INDEX "ProviderConfig_channel_idx" ON "ProviderConfig"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_organizationId_branchId_provider_channel_nam_key" ON "ProviderConfig"("organizationId", "branchId", "provider", "channel", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_registrationNumber_key" ON "Branch"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_aggregateType_aggregateId_idx" ON "AuditLog"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_idx" ON "AuditLog"("branchId");

-- CreateIndex
CREATE INDEX "AuditLog_academicYearId_idx" ON "AuditLog"("academicYearId");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceRule_scopeType_scopeId_idx" ON "MaintenanceRule"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "MaintenanceRule_isActive_idx" ON "MaintenanceRule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_productCode_key" ON "SystemSetting"("productCode");

-- CreateIndex
CREATE UNIQUE INDEX "modules_code_key" ON "modules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "menus_code_key" ON "menus"("code");

-- CreateIndex
CREATE INDEX "menus_moduleId_idx" ON "menus"("moduleId");

-- CreateIndex
CREATE INDEX "menus_parentId_idx" ON "menus"("parentId");

-- CreateIndex
CREATE INDEX "menus_status_idx" ON "menus"("status");

-- CreateIndex
CREATE INDEX "workspace_configurations_scopeType_scopeId_idx" ON "workspace_configurations"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_configurations_scopeType_scopeId_key" ON "workspace_configurations"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_state_scope_key" ON "workspace_state"("scope");

-- AddForeignKey
ALTER TABLE "AcademicUnit" ADD CONSTRAINT "AcademicUnit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicUnit" ADD CONSTRAINT "AcademicUnit_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicUnit" ADD CONSTRAINT "AcademicUnit_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicUnit" ADD CONSTRAINT "AcademicUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AcademicUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_genderId_fkey" FOREIGN KEY ("genderId") REFERENCES "Gender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_religionId_fkey" FOREIGN KEY ("religionId") REFERENCES "Religion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_casteId_fkey" FOREIGN KEY ("casteId") REFERENCES "Caste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_motherTongueId_fkey" FOREIGN KEY ("motherTongueId") REFERENCES "Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_bloodGroupId_fkey" FOREIGN KEY ("bloodGroupId") REFERENCES "BloodGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_disabilityTypeId_fkey" FOREIGN KEY ("disabilityTypeId") REFERENCES "Disability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_admissionSourceId_fkey" FOREIGN KEY ("admissionSourceId") REFERENCES "AdmissionSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "Quota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicUnitId_fkey" FOREIGN KEY ("academicUnitId") REFERENCES "AcademicUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantGuardianMapping" ADD CONSTRAINT "ApplicantGuardianMapping_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantGuardianMapping" ADD CONSTRAINT "ApplicantGuardianMapping_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantGuardianMapping" ADD CONSTRAINT "ApplicantGuardianMapping_relationTypeId_fkey" FOREIGN KEY ("relationTypeId") REFERENCES "RelationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSequenceCounter" ADD CONSTRAINT "NumberSequenceCounter_configId_fkey" FOREIGN KEY ("configId") REFERENCES "NumberSequenceConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowHistory" ADD CONSTRAINT "WorkflowHistory_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PermissionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

