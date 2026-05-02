import { IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional, IsEmail, IsPhoneNumber } from 'class-validator';
import { Environment } from '@/generated/client';

export class CreateSystemDto {
  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsString()
  @IsNotEmpty()
  version: string;

  @IsEnum(Environment)
  @IsNotEmpty()
  environment: Environment;

  @IsBoolean()
  @IsNotEmpty()
  maintenanceMode: boolean;

  @IsString()
  @IsOptional()
  maintenanceMessage?: string;

  @IsEmail()
  @IsNotEmpty()
  supportEmail: string;

  @IsString()
  @IsNotEmpty()
  supportPhone: string;
}
