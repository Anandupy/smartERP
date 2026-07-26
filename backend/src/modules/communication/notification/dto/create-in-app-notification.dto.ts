import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean, IsObject } from 'class-validator';
import { NotificationCategory, NotificationPriority } from '@/generated/client';

export class CreateInAppNotificationDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification content body' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ enum: NotificationCategory, default: NotificationCategory.SYSTEM })
  @IsEnum(NotificationCategory)
  @IsOptional()
  category?: NotificationCategory;

  @ApiPropertyOptional({ enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Action URL for deep link / redirect' })
  @IsString()
  @IsOptional()
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Custom payload metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Pin notification to top' })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'Organization ID context' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Branch ID context' })
  @IsString()
  @IsOptional()
  branchId?: string;
}
