import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  IsArray,
} from 'class-validator';
import {
  CommunicationChannel,
  NotificationCategory,
  TemplateStatus,
} from '@/generated/client';

export class CreateTemplateDto {
  @ApiProperty({
    description: 'Unique template code',
    example: 'PASSWORD_RESET',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description: 'Display name of template',
    example: 'Password Reset Request Email',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Description of template' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: CommunicationChannel,
    example: CommunicationChannel.EMAIL,
  })
  @IsEnum(CommunicationChannel)
  channel!: CommunicationChannel;

  @ApiProperty({
    enum: NotificationCategory,
    example: NotificationCategory.AUTHENTICATION,
  })
  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @ApiPropertyOptional({
    description: 'Subject line (for Email / Push)',
    example: 'Reset Your Password',
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML body template' })
  @IsString()
  @IsOptional()
  bodyHtml?: string;

  @ApiPropertyOptional({ description: 'Plain text body template' })
  @IsString()
  @IsOptional()
  bodyText?: string;

  @ApiPropertyOptional({
    description: 'Declared variable names',
    example: ['userName', 'resetLink', 'minutes'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];

  @ApiPropertyOptional({ description: 'Language code', default: 'en' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: 'Version number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  version?: number;

  @ApiPropertyOptional({ enum: TemplateStatus, default: TemplateStatus.DRAFT })
  @IsEnum(TemplateStatus)
  @IsOptional()
  status?: TemplateStatus;

  @ApiPropertyOptional({ description: 'Organization ID override' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Branch ID override' })
  @IsString()
  @IsOptional()
  branchId?: string;
}
