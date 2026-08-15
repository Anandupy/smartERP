import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdmissionApplicationStatus,
  DocumentOwnerType,
  DocumentScanStatus,
  DocumentStatus,
  DocumentVerificationStatus,
} from '@/generated/client';

export class DocumentTypeDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() organizationId?: string | null;
  @ApiPropertyOptional() branchId?: string | null;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty() isSensitive!: boolean;
  @ApiProperty() hasExpiry!: boolean;
  @ApiPropertyOptional() defaultValidityMonths?: number | null;
  @ApiPropertyOptional() retentionYears?: number | null;
  @ApiProperty({ type: [String] }) allowedMimeTypes!: string[];
  @ApiProperty() maxSizeBytes!: number;
  @ApiProperty() isActive!: boolean;
}

export class DocumentRequirementDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiPropertyOptional() branchId?: string | null;
  @ApiProperty() documentTypeId!: string;
  @ApiPropertyOptional() appliesToProgramId?: string | null;
  @ApiPropertyOptional() appliesToQuotaId?: string | null;
  @ApiPropertyOptional() appliesToCategoryId?: string | null;
  @ApiProperty({ enum: AdmissionApplicationStatus })
  requiredByStage!: AdmissionApplicationStatus;
  @ApiProperty() isMandatory!: boolean;
  @ApiProperty() isActive!: boolean;
}

export class DocumentVersionDto {
  @ApiProperty() id!: string;
  @ApiProperty() documentId!: string;
  @ApiProperty() versionNumber!: number;
  @ApiProperty() originalFilename!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ enum: DocumentScanStatus }) scanStatus!: DocumentScanStatus;
  @ApiProperty({ enum: DocumentVerificationStatus })
  verificationStatus!: DocumentVerificationStatus;
  @ApiPropertyOptional() verifiedBy?: string | null;
  @ApiPropertyOptional() verifiedAt?: Date | null;
  @ApiPropertyOptional() rejectionReason?: string | null;
  @ApiProperty() uploadedAt!: Date;
  @ApiPropertyOptional() supersededAt?: Date | null;
}

export class DocumentDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiPropertyOptional() branchId?: string | null;
  @ApiProperty({ enum: DocumentOwnerType }) ownerType!: DocumentOwnerType;
  @ApiProperty() ownerId!: string;
  @ApiProperty() documentTypeId!: string;
  @ApiProperty({ enum: DocumentStatus }) status!: DocumentStatus;
  @ApiPropertyOptional() currentVersionId?: string | null;
  @ApiPropertyOptional() expiresAt?: Date | null;
  @ApiPropertyOptional({ type: DocumentVersionDto })
  currentVersion?: DocumentVersionDto | null;
}
