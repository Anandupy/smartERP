import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsDateString,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Organization Name',
    example: 'Horizon Education Trust',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Unique organization code',
    example: 'horizon-trust',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Code must be lowercase and contain only alphanumeric characters and hyphens',
  })
  code!: string;

  @ApiPropertyOptional({ description: 'Organization Logo URL' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({
    description: 'Primary Contact Email',
    example: 'admin@horizon.edu',
  })
  @IsEmail()
  @IsNotEmpty()
  contactEmail!: string;

  @ApiProperty({ description: 'Primary Contact Phone', example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @ApiProperty({
    description: 'Master License Expiry Date (ISO format)',
    example: '2030-12-31',
  })
  @IsDateString()
  @IsNotEmpty()
  masterExpiryDate!: string;

  @ApiPropertyOptional({
    description: 'Address Line 1',
    example: '100 Corporate Towers',
  })
  @IsString()
  @IsOptional()
  addressLine1?: string;

  @ApiPropertyOptional({
    description: 'Address Line 2',
    example: 'Financial District',
  })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Mumbai' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'State', example: 'Maharashtra' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'India' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Pincode', example: '400001' })
  @IsString()
  @IsOptional()
  pincode?: string;

  @ApiPropertyOptional({ description: 'Timezone', example: 'Asia/Kolkata' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Currency code', example: 'INR' })
  @IsString()
  @IsOptional()
  currency?: string;
}
