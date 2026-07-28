import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WorkspaceScopeType } from '@/generated/client';

export class UpsertWorkspaceConfigDto {
  @ApiProperty({
    enum: WorkspaceScopeType,
    example: WorkspaceScopeType.PRODUCT,
  })
  @IsEnum(WorkspaceScopeType)
  @IsNotEmpty()
  scopeType: WorkspaceScopeType;

  @ApiPropertyOptional({
    description:
      'Scope ID (e.g. Org ID, Branch ID, User ID, or Role Name). Null for PRODUCT.',
    example: null,
  })
  @IsString()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({
    description: 'Navigation UI preferences object',
    example: { sidebarCollapsed: false, denseMode: false },
  })
  @IsOptional()
  navigationPreferences?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Client preferences object',
    example: { theme: 'dark', locale: 'en' },
  })
  @IsOptional()
  clientPreferences?: Record<string, any>;
}
