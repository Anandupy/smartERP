import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceScopeType } from '@/generated/client';
import { NavigationTreeNodeDto } from '../navigation/dto/navigation-response.dto';

/** The tenant context the layout was resolved against. */
export class WorkspaceActiveContextsDto {
  @ApiProperty({
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b',
  })
  organizationId!: string | null;

  @ApiProperty({
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c',
  })
  branchId!: string | null;

  @ApiProperty({
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6d',
  })
  academicYearId!: string | null;
}

/**
 * The calling client, echoed back.
 *
 * Taken from the request context, with defaults applied — a client that sent
 * no identifying headers is reported as `campusflow-web` on `WEB`.
 */
export class WorkspaceClientDto {
  @ApiProperty({ example: 'campusflow-web' })
  clientApp!: string;

  @ApiProperty({ example: '1.0.0' })
  clientVersion!: string;

  @ApiProperty({ example: 'WEB' })
  platform!: string;
}

/**
 * Configuration after the scope layers are merged.
 *
 * PRODUCT is the base; ORGANIZATION, BRANCH, ROLE and USER are applied over it
 * in that order, so the narrowest scope that sets a key wins.
 */
export class WorkspaceResolvedConfigDto {
  @ApiProperty({
    description: 'Merged navigation preferences — collapsed groups, pins.',
    type: 'object',
    additionalProperties: true,
    example: {},
  })
  navigationPreferences!: Record<string, unknown>;

  @ApiProperty({
    description: 'Merged client preferences — theme, density, locale.',
    type: 'object',
    additionalProperties: true,
    example: {},
  })
  clientPreferences!: Record<string, unknown>;
}

/** Counts describing the navigation tree that was resolved. */
export class WorkspaceMetadataDto {
  @ApiProperty({ type: String, format: 'date-time' })
  resolvedAt!: string;

  @ApiProperty({ example: 24 })
  totalVisibleMenus!: number;

  @ApiProperty({ example: 3 })
  menuTreeDepth!: number;
}

/**
 * Everything a client needs to render the shell in one call: the resolved
 * context, the client it reported, the merged configuration and the
 * permission-filtered navigation.
 */
export class WorkspaceLayoutDto {
  @ApiProperty({ type: WorkspaceActiveContextsDto })
  activeContexts!: WorkspaceActiveContextsDto;

  @ApiProperty({ type: WorkspaceClientDto })
  client!: WorkspaceClientDto;

  @ApiProperty({ type: WorkspaceResolvedConfigDto })
  configuration!: WorkspaceResolvedConfigDto;

  @ApiProperty({
    description: 'Roots of the user’s navigation tree.',
    type: [NavigationTreeNodeDto],
  })
  navigation!: NavigationTreeNodeDto[];

  @ApiProperty({ type: WorkspaceMetadataDto })
  metadata!: WorkspaceMetadataDto;
}

/**
 * One stored configuration layer.
 *
 * A layer is addressed by scope: PRODUCT has no `scopeId`, the others carry
 * the id of the organization, branch, role or user they apply to.
 */
export class WorkspaceConfigurationDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c50' })
  id!: string;

  @ApiProperty({
    enum: WorkspaceScopeType,
    example: WorkspaceScopeType.ORGANIZATION,
  })
  scopeType!: WorkspaceScopeType;

  @ApiProperty({
    description: 'Null for the PRODUCT layer.',
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b',
  })
  scopeId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {},
  })
  navigationPreferences!: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {},
  })
  clientPreferences!: Record<string, unknown>;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  createdById!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
