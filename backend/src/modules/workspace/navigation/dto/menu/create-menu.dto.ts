import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsUUID,
  IsEnum,
  IsArray,
  Min,
  Matches,
} from 'class-validator';
import { MenuStatus } from '@/generated/client';

export class CreateMenuDto {
  @ApiProperty({
    example: 'ADMISSIONS_APPLICANTS',
    description: 'Unique menu code identifier',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]+$/, {
    message:
      'code must contain only uppercase letters, numbers, and underscores',
  })
  code!: string;

  @ApiProperty({
    example: '019fa016-...',
    description: 'Parent module UUID identifier',
  })
  @IsUUID('7')
  @IsNotEmpty()
  moduleId!: string;

  @ApiPropertyOptional({
    example: '019fa017-...',
    description: 'Parent menu UUID identifier (null for root menu)',
  })
  @IsUUID('7')
  @IsOptional()
  parentId?: string | null;

  @ApiProperty({
    example: '/admissions/applicants',
    description: 'Client routing path',
  })
  @IsString()
  @IsNotEmpty()
  route!: string;

  @ApiPropertyOptional({
    example: 'ApplicantsListContainer',
    description: 'Frontend component identifier',
  })
  @IsString()
  @IsOptional()
  componentIdentifier?: string;

  @ApiProperty({
    example: 'Applicants List',
    description: 'User-friendly menu title',
  })
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @ApiPropertyOptional({
    example: 'users',
    description: 'Icon name or identifier for rendering',
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({
    example: 'View applicant records',
    description: 'Tooltip text on hover',
  })
  @IsString()
  @IsOptional()
  tooltip?: string;

  @ApiPropertyOptional({
    example: 'Manage student applications and registrations',
    description: 'Detailed description of the menu item',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: ['admissions.view'],
    description: 'Required permissions array for access',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiPropertyOptional({
    example: 'ALL',
    description: 'Permission evaluation mode (ALL or ANY)',
    default: 'ALL',
  })
  @IsString()
  @IsOptional()
  permissionMode?: 'ALL' | 'ANY';

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order sorting rank',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({
    example: 'NEW',
    description: 'Badge text to render alongside the menu title',
  })
  @IsString()
  @IsOptional()
  badge?: string;

  @ApiPropertyOptional({
    example: ['students', 'applicants', 'registration'],
    description: 'Search keywords for command palette / search indexing',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  searchKeywords?: string[];

  @ApiPropertyOptional({
    example: 'ACTIVE',
    enum: MenuStatus,
    description: 'Current status of the menu node',
    default: MenuStatus.ACTIVE,
  })
  @IsEnum(MenuStatus)
  @IsOptional()
  status?: MenuStatus;
}
