import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateMasterDto {
  @ApiProperty({ description: 'Unique code for the master entity' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;

  @ApiProperty({ description: 'Name of the master entity' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @ApiPropertyOptional({ description: 'Description of the master entity' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Display order of the master entity',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether the master entity is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Metadata JSON for extensibility' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateMasterDto {
  @ApiPropertyOptional({ description: 'Unique code for the master entity' })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(32)
  code?: string;

  @ApiPropertyOptional({ description: 'Name of the master entity' })
  @Transform(trim)
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(128)
  name?: string;

  @ApiPropertyOptional({ description: 'Description of the master entity' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Display order of the master entity' })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the master entity is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Metadata JSON for extensibility' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
