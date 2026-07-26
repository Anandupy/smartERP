import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsArray,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MaintenanceScopeType,
  MaintenanceSeverity,
} from '../../../../prisma/generated';

export class CreateMaintenanceRuleDto {
  @ApiProperty({
    description: 'Scope level of the maintenance',
    enum: MaintenanceScopeType,
    example: 'GLOBAL',
  })
  @IsEnum(MaintenanceScopeType)
  scopeType: MaintenanceScopeType;

  @ApiPropertyOptional({
    description:
      'Target ID for the scope (null for GLOBAL; organizationId, branchId, module name, or feature name)',
    example: 'admissions',
  })
  @IsString()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({
    description: 'Whether the rule is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Allow user logins during maintenance',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowLogin?: boolean;

  @ApiPropertyOptional({
    description: 'Allow GET, HEAD, OPTIONS read APIs',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  allowReadApis?: boolean;

  @ApiPropertyOptional({
    description: 'Allow POST, PUT, PATCH, DELETE write APIs',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowWriteApis?: boolean;

  @ApiPropertyOptional({
    description: 'HTTP status to return when blocked',
    default: 503,
  })
  @IsNumber()
  @IsOptional()
  customStatus?: number;

  @ApiPropertyOptional({
    description: 'Path or URL of a custom maintenance page',
  })
  @IsString()
  @IsOptional()
  customPage?: string;

  @ApiPropertyOptional({
    description: 'Roles allowed to bypass this maintenance rule',
    type: [String],
    example: ['DEVOPS', 'SYSTEM_ADMIN'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  bypassRoles?: string[];

  @ApiPropertyOptional({
    description: 'Custom message title',
    example: 'Scheduled System Upgrade',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Short summary message',
    example: 'System is temporarily offline for upgrades.',
  })
  @IsString()
  @IsOptional()
  shortMessage?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the maintenance activity',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Reason for the maintenance',
    example: 'Database performance indexing.',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Estimated completion timestamp',
  })
  @IsDateString()
  @IsOptional()
  estimatedCompletion?: string;

  @ApiPropertyOptional({
    description: 'Text summary of the maintenance window',
    example: 'Sunday 02:00 AM - 04:00 AM IST',
  })
  @IsString()
  @IsOptional()
  maintenanceWindow?: string;

  @ApiPropertyOptional({
    description: 'Support contact detail',
    example: 'devops-team@campusflow.io',
  })
  @IsString()
  @IsOptional()
  supportContact?: string;

  @ApiPropertyOptional({
    description: 'Banner background color',
    example: '#d32f2f',
  })
  @IsString()
  @IsOptional()
  bannerColor?: string;

  @ApiPropertyOptional({
    description: 'Maintenance severity level',
    enum: MaintenanceSeverity,
    default: 'INFO',
  })
  @IsEnum(MaintenanceSeverity)
  @IsOptional()
  severity?: MaintenanceSeverity;

  @ApiPropertyOptional({
    description: 'Icon class or name for display',
  })
  @IsString()
  @IsOptional()
  maintenanceIcon?: string;

  @ApiPropertyOptional({
    description: 'Public announcement link',
  })
  @IsString()
  @IsOptional()
  announcementLink?: string;

  @ApiPropertyOptional({
    description: 'Status page URL',
  })
  @IsString()
  @IsOptional()
  externalStatusPageUrl?: string;

  @ApiPropertyOptional({
    description: 'Scheduled start timestamp',
  })
  @IsDateString()
  @IsOptional()
  startAt?: string;

  @ApiPropertyOptional({
    description: 'Scheduled end timestamp',
  })
  @IsDateString()
  @IsOptional()
  endAt?: string;

  @ApiPropertyOptional({
    description: 'Timezone for evaluating recurring windows',
    default: 'Asia/Kolkata',
  })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Enable weekly recurring window',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Day of week for recurring window (0 = Sunday, 6 = Saturday)',
    minimum: 0,
    maximum: 6,
  })
  @IsNumber()
  @Min(0)
  @Max(6)
  @IsOptional()
  recurrenceDayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Start time of day for recurring window in HH:MM format',
    example: '02:00',
  })
  @IsString()
  @IsOptional()
  recurrenceStartTime?: string;

  @ApiPropertyOptional({
    description: 'End time of day for recurring window in HH:MM format',
    example: '04:00',
  })
  @IsString()
  @IsOptional()
  recurrenceEndTime?: string;
}
