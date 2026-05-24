import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMasterDto {
  @ApiProperty({ description: 'Unique code for the master entity' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Name of the master entity' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description of the master entity' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Display order of the master entity',
    default: 0,
  })
  @IsInt()
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
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'Name of the master entity' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Description of the master entity' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Display order of the master entity' })
  @IsInt()
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
