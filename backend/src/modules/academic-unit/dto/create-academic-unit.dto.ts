import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AcademicUnitType } from '@/generated/client';

export class CreateAcademicUnitDto {
  @ApiProperty({ description: 'Branch ID' })
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty({ description: 'Program ID' })
  @IsString()
  @IsNotEmpty()
  programId!: string;

  @ApiProperty({ description: 'Academic Year ID' })
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiPropertyOptional({ description: 'Parent Academic Unit ID' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ description: 'Name of the academic unit' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Code for the academic unit' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    enum: AcademicUnitType,
    description: 'Type of the academic unit',
  })
  @IsEnum(AcademicUnitType)
  @IsNotEmpty()
  unitType!: AcademicUnitType;

  @ApiPropertyOptional({ description: 'Display order for UI' })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Is active flag', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
