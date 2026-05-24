import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ResetStrategy {
  YEARLY = 'YEARLY',
  NEVER = 'NEVER',
}

export class CreateNumberSequenceConfigDto {
  @ApiProperty({
    description:
      'Purpose of the numbering sequence, e.g. ADMISSION_FORM, APPLICATION, STUDENT_CODE, RECEIPT',
  })
  @IsString()
  @IsNotEmpty()
  purpose: string;

  @ApiPropertyOptional({ description: 'Prefix to prepend' })
  @IsString()
  @IsOptional()
  prefix?: string;

  @ApiPropertyOptional({ description: 'Suffix to append' })
  @IsString()
  @IsOptional()
  suffix?: string;

  @ApiPropertyOptional({
    description: 'Include branch code in the generated number',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeBranchCode?: boolean;

  @ApiPropertyOptional({
    description: 'Include academic year in the generated number',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeAcademicYear?: boolean;

  @ApiPropertyOptional({
    description: 'Padding length for the sequence number',
    default: 4,
  })
  @IsInt()
  @IsOptional()
  sequencePadding?: number;

  @ApiProperty({
    description:
      'Format template, e.g. {prefix}-{branchCode}-{year}-{sequence}',
  })
  @IsString()
  @IsNotEmpty()
  format: string;

  @ApiPropertyOptional({
    description: 'Reset strategy for the counter',
    enum: ResetStrategy,
    default: ResetStrategy.NEVER,
  })
  @IsEnum(ResetStrategy)
  @IsOptional()
  resetStrategy?: ResetStrategy;
}
