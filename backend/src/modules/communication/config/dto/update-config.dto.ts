import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ProviderType } from '@/generated/client';

export class UpdateCommunicationConfigDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  smsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  whatsappEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  otpEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  trackingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  analyticsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  retryEnabled?: boolean;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsEnum(ProviderType)
  @IsOptional()
  defaultEmailProvider?: ProviderType;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsEnum(ProviderType)
  @IsOptional()
  defaultSmsProvider?: ProviderType;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsEnum(ProviderType)
  @IsOptional()
  defaultWhatsappProvider?: ProviderType;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsEnum(ProviderType)
  @IsOptional()
  defaultPushProvider?: ProviderType;
}
