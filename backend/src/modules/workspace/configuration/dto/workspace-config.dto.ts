import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsString,
} from 'class-validator';
import { WorkspaceScopeType } from '@/generated/client';

export class UpsertWorkspaceConfigDto {
  @ApiProperty({
    example: 'USER',
    enum: WorkspaceScopeType,
    description: 'Scope level for configuration layer',
  })
  @IsEnum(WorkspaceScopeType)
  @IsNotEmpty()
  scopeType!: WorkspaceScopeType;

  @ApiPropertyOptional({
    example: '019fa012-...',
    description: 'Target scope UUID identifier (null for PRODUCT global level)',
  })
  @IsString()
  @IsOptional()
  scopeId?: string | null;

  @ApiPropertyOptional({
    example: { sidebarCollapsed: true, themeMode: 'dark' },
    description: 'Navigation UI preferences JSON object',
  })
  @IsObject()
  @IsOptional()
  navigationPreferences?: Record<string, any>;

  @ApiPropertyOptional({
    example: { theme: 'dark', locale: 'en' },
    description: 'Client platform preferences JSON object',
  })
  @IsObject()
  @IsOptional()
  clientPreferences?: Record<string, any>;
}
