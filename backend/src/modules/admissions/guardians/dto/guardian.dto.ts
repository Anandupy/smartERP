import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsNumber,
  IsBoolean,
  IsInt,
  IsDateString,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AADHAAR_FORMAT_MESSAGE,
  AADHAAR_PATTERN,
} from '@/infrastructure/crypto/government-id';

export class CreateGuardianDto {
  @ApiPropertyOptional({
    description:
      'Date of birth. Not stored on the Guardian record — used once, if ' +
      'supplied, to resolve this guardian against the Person identity index. ' +
      'Without it the guardian profile is created with no personId, same as ' +
      'every guardian created before this field existed.',
    example: '1985-06-15',
  })
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiProperty({ description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiPropertyOptional({ description: 'Middle name' })
  @IsString()
  @IsOptional()
  middleName?: string;

  @ApiProperty({ description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: 'Primary mobile number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[+0-9\s-]{7,15}$/, { message: 'Invalid primary mobile format' })
  mobilePrimary!: string;

  @ApiPropertyOptional({ description: 'Secondary mobile number' })
  @IsString()
  @IsOptional()
  @Matches(/^[+0-9\s-]{7,15}$/, { message: 'Invalid secondary mobile format' })
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

  @ApiPropertyOptional({
    description: 'Aadhaar number (12 digits, not starting with 0 or 1)',
  })
  @IsString()
  @IsOptional()
  @Matches(AADHAAR_PATTERN, { message: AADHAAR_FORMAT_MESSAGE })
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
  @Matches(/^[a-zA-Z0-9\s-]{3,10}$/, { message: 'Invalid pincode format' })
  pincode?: string;
}

export class UpdateGuardianDto {
  @ApiPropertyOptional({
    description:
      'Date of birth. Only used, and only meaningful, when this guardian ' +
      'has no personId yet — supplying it links a Person retroactively. ' +
      'Ignored if the guardian is already linked.',
    example: '1985-06-15',
  })
  @IsDateString()
  @IsOptional()
  dob?: string;

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
  @Matches(/^[+0-9\s-]{7,15}$/, { message: 'Invalid primary mobile format' })
  mobilePrimary?: string;

  @ApiPropertyOptional({ description: 'Secondary mobile number' })
  @IsString()
  @IsOptional()
  @Matches(/^[+0-9\s-]{7,15}$/, { message: 'Invalid secondary mobile format' })
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

  @ApiPropertyOptional({
    description: 'Aadhaar number (12 digits, not starting with 0 or 1)',
  })
  @IsString()
  @IsOptional()
  @Matches(AADHAAR_PATTERN, { message: AADHAAR_FORMAT_MESSAGE })
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
  @Matches(/^[a-zA-Z0-9\s-]{3,10}$/, { message: 'Invalid pincode format' })
  pincode?: string;
}

export class MapGuardianDto {
  @ApiProperty({ description: 'Guardian UUID' })
  @IsString()
  @IsNotEmpty()
  guardianId!: string;

  @ApiProperty({ description: 'Relation type UUID' })
  @IsString()
  @IsNotEmpty()
  relationTypeId!: string;

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
