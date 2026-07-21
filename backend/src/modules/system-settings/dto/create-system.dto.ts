import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Environment } from '@prisma/client';

export class CreateSystemDto {
  @ApiProperty({ description: 'Product Name', example: 'CampusFlow ERP' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({ description: 'Product Code', example: 'CF-ERP' })
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @ApiProperty({ description: 'System Version', example: '1.0.0' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({
    description: 'Deployment Environment',
    enum: Environment,
    example: Environment.DEV,
  })
  @IsEnum(Environment)
  @IsNotEmpty()
  environment: Environment;

  @ApiProperty({ description: 'Maintenance Mode Flag', default: false })
  @IsBoolean()
  @IsNotEmpty()
  maintenanceMode: boolean;

  @ApiPropertyOptional({ description: 'Maintenance Message Notice' })
  @IsString()
  @IsOptional()
  maintenanceMessage?: string;

  @ApiProperty({ description: 'Support Email Address', example: 'support@campusflow.io' })
  @IsEmail()
  @IsNotEmpty()
  supportEmail: string;

  @ApiProperty({ description: 'Support Contact Phone', example: '1800123456' })
  @IsString()
  @IsNotEmpty()
  supportPhone: string;
}
