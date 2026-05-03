import { IsString, IsBoolean, IsOptional, IsEmail } from 'class-validator';

export class UpdateSystemDto {
  @IsString()
  @IsOptional()
  version?: string;

  @IsBoolean()
  @IsOptional()
  maintenanceMode?: boolean;

  @IsString()
  @IsOptional()
  maintenanceMessage?: string;

  @IsEmail()
  @IsOptional()
  supportEmail?: string;

  @IsString()
  @IsOptional()
  supportPhone?: string;

  @IsString()
  @IsOptional()
  defaultTimezone?: string;

  @IsString()
  @IsOptional()
  defaultCurrency?: string;

  @IsString()
  @IsOptional()
  defaultLanguage?: string;
}
