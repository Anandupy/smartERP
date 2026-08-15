import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AdmissionApplicationStatus } from '@/generated/client';

export class CreateDocumentRequirementDto {
  @ApiPropertyOptional({
    description: 'Null applies to every branch in the organization.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty()
  @IsUUID()
  documentTypeId!: string;

  @ApiPropertyOptional({ description: 'Null applies to every programme.' })
  @IsOptional()
  @IsUUID()
  appliesToProgramId?: string;

  @ApiPropertyOptional({ description: 'Null applies to every quota.' })
  @IsOptional()
  @IsUUID()
  appliesToQuotaId?: string;

  @ApiPropertyOptional({ description: 'Null applies to every category.' })
  @IsOptional()
  @IsUUID()
  appliesToCategoryId?: string;

  @ApiProperty({ enum: AdmissionApplicationStatus })
  @IsEnum(AdmissionApplicationStatus)
  requiredByStage!: AdmissionApplicationStatus;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}

export class UpdateDocumentRequirementDto extends PartialType(
  CreateDocumentRequirementDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
