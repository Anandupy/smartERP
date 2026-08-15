import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDocumentTypeDto {
  @ApiProperty({ example: 'BIRTH_CERTIFICATE' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'code must be upper-snake-case, e.g. BIRTH_CERTIFICATE',
  })
  code!: string;

  @ApiProperty({ example: 'Birth Certificate' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Aadhaar, income and similar — stricter download rule.',
  })
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasExpiry?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1200)
  defaultValidityMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  retentionYears?: number;

  @ApiProperty({
    example: ['application/pdf', 'image/jpeg', 'image/png'],
    description:
      "Accepted Content-Type values. PDF/JPEG/PNG are also verified against the file's own magic bytes.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  allowedMimeTypes!: string[];

  @ApiPropertyOptional({
    default: 10_485_760,
    description: 'Bytes. Default 10 MiB.',
  })
  @IsOptional()
  @IsInt()
  @Min(1024)
  @Max(52_428_800)
  maxSizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class UpdateDocumentTypeDto extends PartialType(CreateDocumentTypeDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
