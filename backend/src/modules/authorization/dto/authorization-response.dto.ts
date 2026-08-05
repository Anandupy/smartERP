import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OverrideType, RoleType } from '@/generated/client';

/** A grouping of permissions, used to lay out a permission matrix. */
export class PermissionCategoryDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a70' })
  id!: string;

  @ApiProperty({ example: 'SETTINGS' })
  code!: string;

  @ApiProperty({ example: 'Settings' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'Configuration of the workspace.' })
  description!: string | null;

  @ApiProperty({ nullable: true, example: 'settings' })
  icon!: string | null;

  @ApiProperty({ description: 'Sort order within the catalog.', example: 10 })
  displayOrder!: number;

  @ApiProperty({
    description: 'System categories cannot be edited or removed.',
    example: true,
  })
  isSystem!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/** A single permission in the catalog. */
export class PermissionDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a71' })
  id!: string;

  @ApiProperty({
    description: 'Stable key checked by @RequirePermission.',
    example: 'settings.manage',
  })
  name!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a70' })
  categoryId!: string;

  @ApiProperty({ nullable: true, example: 'Change workspace settings.' })
  description!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    description: 'System permissions cannot be edited or removed.',
    example: true,
  })
  isSystem!: boolean;

  @ApiProperty({ example: 20 })
  displayOrder!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Included when the permission is read from the catalog.',
    type: PermissionCategoryDto,
  })
  category?: PermissionCategoryDto;
}

/** The outcome of synchronizing a role's permission set. */
export class RolePermissionSyncDto {
  @ApiProperty({ enum: RoleType, example: RoleType.BRANCH_ADMIN })
  role!: RoleType;

  @ApiProperty({
    description: 'Number of permissions the role now holds.',
    example: 24,
  })
  count!: number;

  @ApiProperty({
    description: 'Permission names granted by this call.',
    type: [String],
    example: ['admissions.manage'],
  })
  addedPermissions!: string[];

  @ApiProperty({
    description: 'Permission names revoked by this call.',
    type: [String],
    example: ['settings.manage'],
  })
  removedPermissions!: string[];

  @ApiProperty({
    description: 'The role’s full permission set after the change.',
    type: [String],
    example: ['settings.view', 'admissions.view', 'admissions.manage'],
  })
  permissions!: string[];
}

/** A permission explicitly granted to or denied from one user. */
export class UserPermissionOverrideDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a72' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6a' })
  userId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a71' })
  permissionId!: string;

  @ApiProperty({
    description: 'DENY wins over any role grant.',
    enum: OverrideType,
    example: OverrideType.GRANT,
  })
  type!: OverrideType;

  @ApiProperty({ nullable: true, example: 'Temporary cover for admissions.' })
  reason!: string | null;

  @ApiProperty({ nullable: true })
  createdBy!: string | null;

  @ApiProperty({ nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: PermissionDto })
  permission?: PermissionDto;
}

/** Acknowledgement returned when an override is deleted. */
export class OverrideRemovedDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

/**
 * How a user's permissions were resolved.
 *
 * Returns the inputs alongside the result so an unexpected denial can be
 * explained without re-running the resolver: `userDenies` overrides
 * `rolePermissions`, and `isSuperAdmin` bypasses both.
 */
export class EffectivePermissionsDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6a' })
  userId!: string;

  @ApiProperty({ enum: RoleType, example: RoleType.BRANCH_ADMIN })
  role!: RoleType;

  @ApiProperty({
    description: 'Role permissions plus grants, minus denies.',
    type: [String],
    example: ['settings.view', 'admissions.view'],
  })
  effectivePermissions!: string[];

  @ApiProperty({ type: [String], example: ['settings.view'] })
  rolePermissions!: string[];

  @ApiProperty({ type: [String], example: ['admissions.view'] })
  userGrants!: string[];

  @ApiProperty({ type: [String], example: [] })
  userDenies!: string[];

  @ApiProperty({
    description: 'A super admin holds every permission implicitly.',
    example: false,
  })
  isSuperAdmin!: boolean;

  @ApiProperty({ description: 'Resolution time in ms.', example: 4 })
  resolutionDurationMs!: number;
}
