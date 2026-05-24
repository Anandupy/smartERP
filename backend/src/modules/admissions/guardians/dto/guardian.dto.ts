import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsNumber,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuardianDto {
  @ApiProperty({ description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional({ description: 'Middle name' })
  @IsString()
  @IsOptional()
  middleName?: string;

  @ApiProperty({ description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Primary mobile number' })
  @IsString()
  @IsNotEmpty()
  mobilePrimary: string;

  @ApiPropertyOptional({ description: 'Secondary mobile number' })
  @IsString()
  @IsOptional()
  mobileSecondary?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Occupation' })
  @IsString()
  @IsOptional()
  occupation?: string;

  @ApiPropertyOptional({ description: 'Annual Income' })
  @IsNumber()
  @IsOptional()
  income?: number;

  @ApiPropertyOptional({ description: 'Aadhaar number' })
  @IsString()
  @IsOptional()
  aadhaarNo?: string;

  @ApiPropertyOptional({ description: 'Address line 1' })
  @IsString()
  @IsOptional()
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'Address line 2' })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Pincode' })
  @IsString()
  @IsOptional()
  pincode?: string;
}

export class UpdateGuardianDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Middle name' })
  @IsString()
  @IsOptional()
  middleName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Primary mobile number' })
  @IsString()
  @IsOptional()
  mobilePrimary?: string;

  @ApiPropertyOptional({ description: 'Secondary mobile number' })
  @IsString()
  @IsOptional()
  mobileSecondary?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Occupation' })
  @IsString()
  @IsOptional()
  occupation?: string;

  @ApiPropertyOptional({ description: 'Annual Income' })
  @IsNumber()
  @IsOptional()
  income?: number;

  @ApiPropertyOptional({ description: 'Aadhaar number' })
  @IsString()
  @IsOptional()
  aadhaarNo?: string;

  @ApiPropertyOptional({ description: 'Address line 1' })
  @IsString()
  @IsOptional()
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'Address line 2' })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Pincode' })
  @IsString()
  @IsOptional()
  pincode?: string;
}

export class MapGuardianDto {
  @ApiProperty({ description: 'Guardian UUID' })
  @IsString()
  @IsNotEmpty()
  guardianId: string;

  @ApiProperty({ description: 'Relation type UUID' })
  @IsString()
  @IsNotEmpty()
  relationTypeId: string;

  @ApiPropertyOptional({
    description: 'Is the primary guardian',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Is emergency contact', default: false })
  @IsBoolean()
  @IsOptional()
  isEmergencyContact?: boolean;

  @ApiPropertyOptional({ description: 'Is financial guardian', default: false })
  @IsBoolean()
  @IsOptional()
  isFinancialGuardian?: boolean;

  @ApiPropertyOptional({ description: 'Is allowed to pick up', default: true })
  @IsBoolean()
  @IsOptional()
  pickupAllowed?: boolean;

  @ApiPropertyOptional({ description: 'Priority order', default: 1 })
  @IsInt()
  @IsOptional()
  priority?: number;
}
