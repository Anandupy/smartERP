import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MenuStatus } from '@/generated/client';
import {
  NavigationTreeNode,
  TreeBuildResult,
} from '../builders/navigation-tree.builder';

/** A top-level grouping of menus — Admissions, Academics, Settings. */
export class NavigationModuleDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c30' })
  id!: string;

  @ApiProperty({ example: 'ADMISSIONS' })
  code!: string;

  @ApiProperty({ example: 'Admissions' })
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true, example: 'user-plus' })
  icon!: string | null;

  @ApiProperty({ example: 10 })
  displayOrder!: number;

  @ApiProperty({
    description: 'System modules ship with the product.',
    example: true,
  })
  isSystem!: boolean;

  @ApiProperty({
    description: 'An inactive module contributes nothing to any user’s tree.',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/** Related-record counts Prisma attaches to a module. */
export class NavigationModuleCountsDto {
  @ApiProperty({ description: 'Menus belonging to the module.', example: 12 })
  menus!: number;
}

/** A module in the admin list, with its menu count. */
export class NavigationModuleListItemDto extends NavigationModuleDto {
  @ApiProperty({ type: NavigationModuleCountsDto })
  _count!: NavigationModuleCountsDto;
}

/**
 * One navigable destination.
 *
 * Declared before the module detail DTO so the module can reference it.
 *
 * `permissions` and `permissionMode` decide who sees it: ALL requires every
 * listed permission, ANY requires one. Menus are self-nesting through
 * `parentId`.
 */
export class NavigationMenuDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c40' })
  id!: string;

  @ApiProperty({ example: 'ADMISSIONS_APPLICANTS' })
  code!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c30' })
  moduleId!: string;

  @ApiProperty({ nullable: true, example: null })
  parentId!: string | null;

  @ApiProperty({ example: '/admissions/applicants' })
  route!: string;

  @ApiProperty({ nullable: true, example: 'ApplicantListPage' })
  componentIdentifier!: string | null;

  @ApiProperty({
    description: 'Permission keys checked before the menu is shown.',
    type: [String],
    example: ['admissions.view'],
  })
  permissions!: string[];

  @ApiProperty({
    description: 'ALL requires every permission; ANY requires one.',
    enum: ['ALL', 'ANY'],
    example: 'ALL',
  })
  permissionMode!: string;

  @ApiProperty({ example: 'Applicants' })
  displayName!: string;

  @ApiProperty({ nullable: true, example: 'users' })
  icon!: string | null;

  @ApiProperty({ nullable: true })
  tooltip!: string | null;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ example: 10 })
  displayOrder!: number;

  @ApiProperty({ nullable: true, example: null })
  badge!: string | null;

  @ApiProperty({
    description: 'Extra terms that match this menu in a command palette.',
    type: [String],
    example: ['admission', 'enquiry'],
  })
  searchKeywords!: string[];

  @ApiProperty({ nullable: true })
  helpUrl!: string | null;

  @ApiProperty({ nullable: true })
  documentationUrl!: string | null;

  @ApiProperty({ enum: MenuStatus, example: MenuStatus.ACTIVE })
  status!: MenuStatus;

  @ApiProperty({ example: true })
  isSystem!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/** The module reference carried on an admin menu list row. */
export class NavigationMenuModuleRefDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c30' })
  id!: string;

  @ApiProperty({ example: 'ADMISSIONS' })
  code!: string;

  @ApiProperty({ example: 'Admissions' })
  name!: string;
}

/** The parent reference carried on an admin menu list row. */
export class NavigationMenuParentRefDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c41' })
  id!: string;

  @ApiProperty({ example: 'ADMISSIONS' })
  code!: string;

  @ApiProperty({ example: 'Admissions' })
  displayName!: string;
}

/** A menu in the admin list, with just enough of its module and parent named. */
export class NavigationMenuListItemDto extends NavigationMenuDto {
  @ApiProperty({ type: NavigationMenuModuleRefDto })
  module!: NavigationMenuModuleRefDto;

  @ApiProperty({
    description: 'Null for a top-level menu.',
    type: NavigationMenuParentRefDto,
    nullable: true,
  })
  parent!: NavigationMenuParentRefDto | null;
}

/** A module with its menus, as `GET /admin/navigation/modules/:id` returns it. */
export class NavigationModuleDetailDto extends NavigationModuleDto {
  @ApiProperty({
    description: 'Every menu in the module, ordered by display order.',
    type: [NavigationMenuDto],
  })
  menus!: NavigationMenuDto[];
}

/** A menu with its module, parent and children fully hydrated. */
export class NavigationMenuDetailDto extends NavigationMenuDto {
  @ApiProperty({ type: NavigationModuleDto })
  module!: NavigationModuleDto;

  @ApiProperty({ type: NavigationMenuDto, nullable: true })
  parent!: NavigationMenuDto | null;

  @ApiProperty({ type: [NavigationMenuDto] })
  children!: NavigationMenuDto[];
}

/**
 * A node of a user's navigation tree.
 *
 * Only the presentation fields survive the build — `permissions`,
 * `permissionMode` and `isSystem` are consumed while filtering and are not
 * sent to the client.
 */
export class NavigationTreeNodeDto implements Omit<
  NavigationTreeNode,
  'children'
> {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c40' })
  id!: string;

  @ApiProperty({ example: 'ADMISSIONS_APPLICANTS' })
  code!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c30' })
  moduleId!: string;

  @ApiProperty({ nullable: true, example: null })
  parentId!: string | null;

  @ApiProperty({ example: '/admissions/applicants' })
  route!: string;

  @ApiProperty({ nullable: true, example: 'ApplicantListPage' })
  componentIdentifier!: string | null;

  @ApiProperty({ example: 'Applicants' })
  displayName!: string;

  @ApiProperty({ nullable: true, example: 'users' })
  icon!: string | null;

  @ApiProperty({ nullable: true })
  tooltip!: string | null;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ example: 10 })
  displayOrder!: number;

  @ApiProperty({ nullable: true, example: null })
  badge!: string | null;

  @ApiProperty({ type: [String], example: ['admission', 'enquiry'] })
  searchKeywords!: string[];

  @ApiProperty({ nullable: true })
  helpUrl!: string | null;

  @ApiProperty({ nullable: true })
  documentationUrl!: string | null;

  @ApiProperty({ enum: MenuStatus, example: MenuStatus.ACTIVE })
  status!: MenuStatus;

  @ApiPropertyOptional({
    description: 'Child menus, recursively. Empty at a leaf.',
    type: () => [NavigationTreeNodeDto],
  })
  children!: NavigationTreeNodeDto[];
}

/**
 * A user's navigation, filtered to what their role and effective permissions
 * allow, plus the two counts a client needs to lay it out.
 */
export class NavigationTreeDto implements Omit<TreeBuildResult, 'tree'> {
  @ApiProperty({ type: [NavigationTreeNodeDto] })
  tree!: NavigationTreeNodeDto[];

  @ApiProperty({
    description: 'Nodes at every depth, not just roots.',
    example: 24,
  })
  totalVisibleMenus!: number;

  @ApiProperty({ description: 'Deepest nesting level reached.', example: 3 })
  menuTreeDepth!: number;
}

/** Acknowledgement returned by the bulk and delete navigation admin actions. */
export class NavigationActionResultDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
