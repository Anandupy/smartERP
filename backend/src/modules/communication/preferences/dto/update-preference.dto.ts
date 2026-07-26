import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { NotificationCategory } from '@/generated/client';

export class UpdateNotificationPreferenceDto {
  @ApiProperty({
    enum: NotificationCategory,
    example: NotificationCategory.FEES,
  })
  @IsEnum(NotificationCategory)
  @IsNotEmpty()
  category: NotificationCategory;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  smsEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  whatsappEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  inAppEnabled?: boolean;
}
