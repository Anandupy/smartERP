import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { OtpPurpose } from '@/generated/client';

export class GenerateOtpDto {
  @ApiProperty({
    description: 'Target recipient identifier (email, phone, or userId)',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ enum: OtpPurpose, example: OtpPurpose.PASSWORD_RESET })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;

  @ApiPropertyOptional({ description: 'OTP length', default: 6 })
  @IsInt()
  @Min(4)
  @Max(8)
  @IsOptional()
  length?: number;

  @ApiPropertyOptional({ description: 'Time-to-live in minutes', default: 10 })
  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  ttlMinutes?: number;

  @ApiPropertyOptional({
    description: 'Cooldown before resend in seconds',
    default: 60,
  })
  @IsInt()
  @Min(10)
  @Max(300)
  @IsOptional()
  resendCooldownSeconds?: number;

  @ApiPropertyOptional({ description: 'Organization ID context' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Branch ID context' })
  @IsString()
  @IsOptional()
  branchId?: string;
}
