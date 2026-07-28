import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { MenuStatus } from '@/generated/client';

export class CreateMenuDto {
  @ApiProperty({
    description: 'Unique menu code',
    example: 'ADMISSIONS_APPLICANTS',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Parent Module UUID' })
  @IsUUID('7')
  @IsNotEmpty()
  moduleId: string;

  @ApiPropertyOptional({ description: 'Parent Menu UUID for nested submenus' })
  @IsOptional()
  @IsUUID('7')
  parentId?: string;

  @ApiProperty({
    description: 'Client application route path',
    example: '/admissions/applicants',
  })
  @IsString()
  @IsNotEmpty()
  route: string;

  @ApiPropertyOptional({
    description: 'Frontend component identifier',
    example: 'ApplicantListView',
  })
  @IsString()
  @IsOptional()
  componentIdentifier?: string;

  @ApiPropertyOptional({
    description: 'Required permissions array',
    example: ['admissions.view'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiPropertyOptional({
    description: 'Permission evaluation mode: ALL or ANY',
    example: 'ALL',
  })
  @IsString()
  @IsOptional()
  permissionMode?: 'ALL' | 'ANY';

  @ApiProperty({ description: 'Display name', example: 'Applicants List' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional({ description: 'Menu icon identifier' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Tooltip text' })
  @IsString()
  @IsOptional()
  tooltip?: string;

  @ApiPropertyOptional({ description: 'Menu description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Display order', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'UI Badge (e.g. NEW, 5)' })
  @IsString()
  @IsOptional()
  badge?: string;

  @ApiPropertyOptional({ description: 'Search keywords for UI global search' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  searchKeywords?: string[];

  @ApiPropertyOptional({ description: 'Help documentation URL' })
  @IsString()
  @IsOptional()
  helpUrl?: string;

  @ApiPropertyOptional({ description: 'Technical documentation URL' })
  @IsString()
  @IsOptional()
  documentationUrl?: string;

  @ApiPropertyOptional({ enum: MenuStatus, default: MenuStatus.ACTIVE })
  @IsEnum(MenuStatus)
  @IsOptional()
  status?: MenuStatus;
}

export class UpdateMenuDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Menu icon identifier' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Tooltip text' })
  @IsString()
  @IsOptional()
  tooltip?: string;

  @ApiPropertyOptional({ description: 'Menu description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'UI Badge' })
  @IsString()
  @IsOptional()
  badge?: string;

  @ApiPropertyOptional({ description: 'Search keywords' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  searchKeywords?: string[];

  @ApiPropertyOptional({ description: 'Help documentation URL' })
  @IsString()
  @IsOptional()
  helpUrl?: string;

  @ApiPropertyOptional({ description: 'Technical documentation URL' })
  @IsString()
  @IsOptional()
  documentationUrl?: string;

  @ApiPropertyOptional({ enum: MenuStatus })
  @IsEnum(MenuStatus)
  @IsOptional()
  status?: MenuStatus;

  @ApiPropertyOptional({ description: 'Client route path' })
  @IsString()
  @IsOptional()
  route?: string;

  @ApiPropertyOptional({ description: 'Required permissions array' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiPropertyOptional({ description: 'Permission evaluation mode' })
  @IsString()
  @IsOptional()
  permissionMode?: 'ALL' | 'ANY';
}
