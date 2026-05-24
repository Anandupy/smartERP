import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import {
  StructureMode,
  InstitutionType,
  AffiliationType,
} from '@prisma/client';

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Code must be lowercase and contain only alphanumeric characters and hyphens',
  })
  code: string;

  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @IsEnum(InstitutionType)
  @IsNotEmpty()
  institutionType: InstitutionType;

  @IsEnum(AffiliationType)
  @IsOptional()
  affiliationType?: AffiliationType;

  @IsString()
  @IsOptional()
  affiliationName?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsEmail()
  @IsNotEmpty()
  contactEmail: string;

  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  pincode: string;

  @IsEnum(StructureMode)
  @IsOptional()
  structureMode?: StructureMode;
}
