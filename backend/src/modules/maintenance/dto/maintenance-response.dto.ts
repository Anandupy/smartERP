import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceScopeType, MaintenanceSeverity } from '@/generated/client';

/**
 * A maintenance window.
 *
 * Scope narrows what the rule covers: GLOBAL ignores `scopeId`, the others
 * match it against an organization id, a branch id, a module name or a feature
 * name. The `allow*` flags decide what still gets through while it is active.
 */
export class MaintenanceRuleDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c10' })
  id!: string;

  @ApiProperty({
    enum: MaintenanceScopeType,
    example: MaintenanceScopeType.GLOBAL,
  })
  scopeType!: MaintenanceScopeType;

  @ApiProperty({
    type: String,
    description:
      'Null for GLOBAL; otherwise an organization id, branch id, module name or feature name.',
    nullable: true,
    example: null,
  })
  scopeId!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  allowLogin!: boolean;

  @ApiProperty({ example: true })
  allowReadApis!: boolean;

  @ApiProperty({ example: false })
  allowWriteApis!: boolean;

  @ApiProperty({
    description: 'Status code returned to blocked requests.',
    example: 503,
  })
  customStatus!: number;

  @ApiProperty({ type: String, nullable: true, example: null })
  customPage!: string | null;

  @ApiProperty({
    description:
      'Role names allowed through the window. Stored as a JSON array of strings.',
    type: [String],
    nullable: true,
    example: ['SUPER_ADMIN'],
  })
  bypassRoles!: string[] | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Scheduled maintenance',
  })
  title!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'We will be back shortly.',
  })
  shortMessage!: string | null;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Database migration' })
  reason!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  estimatedCompletion!: Date | null;

  @ApiProperty({ type: String, nullable: true, example: '02:00–04:00 IST' })
  maintenanceWindow!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'support@northfield.edu',
  })
  supportContact!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '#f59e0b' })
  bannerColor!: string | null;

  @ApiProperty({
    enum: MaintenanceSeverity,
    nullable: true,
    example: MaintenanceSeverity.INFO,
  })
  severity!: MaintenanceSeverity | null;

  @ApiProperty({ type: String, nullable: true })
  maintenanceIcon!: string | null;

  @ApiProperty({ type: String, nullable: true })
  announcementLink!: string | null;

  @ApiProperty({ type: String, nullable: true })
  externalStatusPageUrl!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endAt!: Date | null;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone!: string;

  @ApiProperty({ example: false })
  isRecurring!: boolean;

  @ApiProperty({
    type: Number,
    description: '0 is Sunday, 6 is Saturday.',
    nullable: true,
    example: null,
  })
  recurrenceDayOfWeek!: number | null;

  @ApiProperty({ type: String, nullable: true, example: '02:00' })
  recurrenceStartTime!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '04:00' })
  recurrenceEndTime!: string | null;

  @ApiProperty({ type: String, nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/**
 * Whether maintenance applies to the caller right now.
 *
 * When `maintenanceEnabled` is false it is the only field present — there is
 * no rule to describe. Every other field appears only when a rule matched.
 */
export class MaintenanceStatusDto {
  @ApiProperty({
    description: 'False when no rule matches the caller’s context.',
    example: false,
  })
  maintenanceEnabled!: boolean;

  @ApiPropertyOptional({
    enum: MaintenanceScopeType,
    example: MaintenanceScopeType.GLOBAL,
  })
  maintenanceScope?: MaintenanceScopeType;

  @ApiPropertyOptional({
    enum: MaintenanceScopeType,
    example: MaintenanceScopeType.GLOBAL,
  })
  scopeType?: MaintenanceScopeType;

  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  scopeId?: string | null;

  @ApiPropertyOptional({ example: 'System Maintenance' })
  title?: string;

  @ApiPropertyOptional({ example: 'The system is under maintenance.' })
  message?: string;

  @ApiPropertyOptional({ example: '' })
  description?: string;

  @ApiPropertyOptional({ example: 'Database migration' })
  reason?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  estimatedCompletion?: Date | null;

  @ApiPropertyOptional({ example: 'support@northfield.edu' })
  supportContact?: string;

  @ApiPropertyOptional({ example: '02:00–04:00 IST' })
  maintenanceWindow?: string;

  @ApiPropertyOptional({
    description: 'True when writes are blocked but reads still pass.',
    example: true,
  })
  readOnly?: boolean;

  @ApiPropertyOptional({
    description: 'HTTP methods still accepted during the window.',
    type: [String],
    example: ['GET', 'HEAD', 'OPTIONS'],
  })
  allowedOperations?: string[];
}
