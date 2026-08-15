import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DocumentOwnerType } from '@/generated/client';

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentOwnerType })
  @IsEnum(DocumentOwnerType)
  ownerType!: DocumentOwnerType;

  @ApiProperty()
  @IsUUID()
  ownerId!: string;

  @ApiProperty()
  @IsUUID()
  documentTypeId!: string;
}

export class RejectDocumentDto {
  @ApiProperty({
    description:
      'Mandatory — a rejection with no recorded reason cannot be explained later.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ArchiveDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
