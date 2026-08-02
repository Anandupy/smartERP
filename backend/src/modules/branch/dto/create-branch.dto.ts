import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  StructureMode,
  InstitutionType,
  AffiliationType,
} from '@/generated/client';

export class CreateBranchDto {
  @ApiProperty({ description: 'Organization UUID' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({
    description: 'Branch Name',
    example: 'Horizon High School - North Campus',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unique branch code',
    example: 'hhs-north',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Code must be lowercase and contain only alphanumeric characters and hyphens',
  })
  code: string;

  @ApiPropertyOptional({ description: 'Registration Number' })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiProperty({
    description: 'Institution Type',
    enum: InstitutionType,
    example: InstitutionType.SCHOOL,
  })
  @IsEnum(InstitutionType)
  @IsNotEmpty()
  institutionType: InstitutionType;

  @ApiPropertyOptional({
    description: 'Affiliation Type',
    enum: AffiliationType,
    example: AffiliationType.BOARD,
  })
  @IsEnum(AffiliationType)
  @IsOptional()
  affiliationType?: AffiliationType;

  @ApiPropertyOptional({ description: 'Affiliation Body Name' })
  @IsString()
  @IsOptional()
  affiliationName?: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({
    description: 'Branch Contact Email',
    example: 'north.branch@horizon.edu',
  })
  @IsEmail()
  @IsNotEmpty()
  contactEmail: string;

  @ApiProperty({ description: 'Branch Contact Phone', example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @ApiProperty({ description: 'Address Line 1', example: '123 Education Lane' })
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiPropertyOptional({ description: 'Address Line 2' })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ description: 'City', example: 'Mumbai' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State', example: 'Maharashtra' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'Country', example: 'India' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ description: 'Pincode', example: '400001' })
  @IsString()
  @IsNotEmpty()
  pincode: string;

  @ApiPropertyOptional({
    description: 'Structure Mode',
    enum: StructureMode,
    example: StructureMode.DEFAULT,
  })
  @IsEnum(StructureMode)
  @IsOptional()
  structureMode?: StructureMode;
}
