import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SequencePurpose } from '@/generated/client';

export { SequencePurpose };

export class CreateNumberSequenceConfigDto {
  @ApiProperty({
    enum: SequencePurpose,
    description:
      'What the sequence issues. Scope, reset strategy and allocation mode are ' +
      'derived from this and are not caller-configurable — whether a receipt ' +
      'series may contain a gap is a statutory question, not a preference.',
    example: SequencePurpose.STUDENT_CODE,
  })
  @IsEnum(SequencePurpose)
  purpose!: SequencePurpose;

  @ApiPropertyOptional({
    description:
      'Prefix. Frozen once a NEVER-reset sequence has issued its first value.',
    example: 'STU',
  })
  @IsString()
  @IsOptional()
  prefix?: string;

  @ApiPropertyOptional({ description: 'Suffix to append' })
  @IsString()
  @IsOptional()
  suffix?: string;

  @ApiPropertyOptional({
    description: 'Expand {branchCode} in the format',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeBranchCode?: boolean;

  @ApiPropertyOptional({
    description: 'Expand {year} in the format',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeAcademicYear?: boolean;

  @ApiPropertyOptional({
    description:
      'Zero-padding width of the counter. Fixed width is what makes ' +
      'ORDER BY on the rendered code equal ORDER BY on the counter. Frozen ' +
      'once a NEVER-reset sequence has issued its first value.',
    default: 4,
    minimum: 1,
    maximum: 18,
    example: 10,
  })
  @IsInt()
  @Min(1)
  @Max(18)
  @IsOptional()
  sequencePadding?: number;

  @ApiProperty({
    description:
      'Template to render. Must contain {sequence}; available placeholders are ' +
      '{prefix} {suffix} {branchCode} {year} {sequence}.',
    example: '{prefix}{sequence}',
  })
  @IsString()
  @IsNotEmpty()
  format!: string;
}

export class UpdateNumberSequenceConfigDto {
  @ApiPropertyOptional({ example: 'STU' })
  @IsString()
  @IsOptional()
  prefix?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  suffix?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  includeBranchCode?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  includeAcademicYear?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 18 })
  @IsInt()
  @Min(1)
  @Max(18)
  @IsOptional()
  sequencePadding?: number;

  @ApiPropertyOptional({ example: '{prefix}{sequence}' })
  @IsString()
  @IsOptional()
  format?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PreviewNumberSequenceDto {
  @ApiPropertyOptional({
    description: 'Counter value to render. Nothing is consumed.',
    default: 1,
    example: 123,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sampleValue?: number;

  @ApiPropertyOptional({
    description: 'Academic year to expand {year} with.',
  })
  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}
