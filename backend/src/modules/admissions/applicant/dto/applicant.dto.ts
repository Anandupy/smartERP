import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsNumber,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicantDto {
  // Identity
  @ApiProperty({ description: 'First name of the applicant' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional({ description: 'Middle name of the applicant' })
  @IsString()
  @IsOptional()
  middleName?: string;

  @ApiProperty({ description: 'Last name of the applicant' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Date of birth of the applicant (ISO format)' })
  @IsDateString()
  dob: string;

  @ApiProperty({ description: 'Gender UUID' })
  @IsString()
  @IsNotEmpty()
  genderId: string;

  @ApiPropertyOptional({ description: 'Birth place of the applicant' })
  @IsString()
  @IsOptional()
  birthPlace?: string;

  @ApiPropertyOptional({ description: 'Photo File ID placeholder' })
  @IsString()
  @IsOptional()
  photoFileId?: string;

  // Demographic
  @ApiPropertyOptional({ description: 'Religion UUID' })
  @IsString()
  @IsOptional()
  religionId?: string;

  @ApiPropertyOptional({ description: 'Caste UUID' })
  @IsString()
  @IsOptional()
  casteId?: string;

  @ApiPropertyOptional({ description: 'Category UUID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Mother tongue (Language UUID)' })
  @IsString()
  @IsOptional()
  motherTongueId?: string;

  @ApiPropertyOptional({ description: 'Blood Group UUID' })
  @IsString()
  @IsOptional()
  bloodGroupId?: string;

  @ApiPropertyOptional({ description: 'Disability Status', default: false })
  @IsBoolean()
  @IsOptional()
  disabilityStatus?: boolean;

  @ApiPropertyOptional({ description: 'Disability Type UUID' })
  @IsString()
  @IsOptional()
  disabilityTypeId?: string;

  @ApiPropertyOptional({ description: 'Disability Notes' })
  @IsString()
  @IsOptional()
  disabilityNotes?: string;

  // Government Details
  @ApiPropertyOptional({ description: 'Aadhaar Number' })
  @IsString()
  @IsOptional()
  aadhaarNo?: string;

  @ApiPropertyOptional({ description: 'Permanent Education Number (PEN)' })
  @IsString()
  @IsOptional()
  penNo?: string;

  @ApiPropertyOptional({ description: 'APAAR ID' })
  @IsString()
  @IsOptional()
  apaarId?: string;

  // Contact Details
  @ApiProperty({ description: 'Primary contact mobile number' })
  @IsString()
  @IsNotEmpty()
  primaryMobile: string;

  @ApiPropertyOptional({ description: 'Alternate mobile number' })
  @IsString()
  @IsOptional()
  alternateMobile?: string;

  @ApiPropertyOptional({ description: 'Primary contact email' })
  @IsString()
  @IsOptional()
  primaryEmail?: string;

  // Address Details
  @ApiProperty({ description: 'Current address line 1' })
  @IsString()
  @IsNotEmpty()
  currentAddressLine1: string;

  @ApiPropertyOptional({ description: 'Current address line 2' })
  @IsString()
  @IsOptional()
  currentAddressLine2?: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ description: 'District' })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiProperty({ description: 'State' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'Country' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ description: 'Pincode' })
  @IsString()
  @IsNotEmpty()
  pincode: string;

  // Previous Education Details
  @ApiPropertyOptional({ description: 'Previous school name' })
  @IsString()
  @IsOptional()
  previousSchoolName?: string;

  @ApiPropertyOptional({ description: 'Previous school board' })
  @IsString()
  @IsOptional()
  previousBoard?: string;

  @ApiPropertyOptional({ description: 'Previous class attended' })
  @IsString()
  @IsOptional()
  previousClass?: string;

  @ApiPropertyOptional({ description: 'Previous marks percentage' })
  @IsNumber()
  @IsOptional()
  previousPercentage?: number;

  @ApiPropertyOptional({ description: 'Transfer Certificate (TC) number' })
  @IsString()
  @IsOptional()
  tcNumber?: string;

  // Admission details
  @ApiPropertyOptional({ description: 'Admission Source UUID' })
  @IsString()
  @IsOptional()
  admissionSourceId?: string;

  @ApiPropertyOptional({ description: 'Quota UUID' })
  @IsString()
  @IsOptional()
  quotaId?: string;

  @ApiPropertyOptional({ description: 'Internal staff remarks' })
  @IsString()
  @IsOptional()
  internalRemarks?: string;

  @ApiPropertyOptional({ description: 'Counsellor remarks' })
  @IsString()
  @IsOptional()
  counsellorRemarks?: string;

  @ApiPropertyOptional({ description: 'Assigned Counsellor User UUID' })
  @IsString()
  @IsOptional()
  assignedCounsellorId?: string;

  @ApiPropertyOptional({
    description: 'Is transportation service required',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  transportRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Is hostel accommodation required',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  hostelRequired?: boolean;

  // Extensibility Placeholders
  @ApiPropertyOptional({ description: 'Custom field data (JSON)' })
  @IsObject()
  @IsOptional()
  customFieldData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Checklist status (JSON)' })
  @IsObject()
  @IsOptional()
  checklistStatus?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags (JSON)' })
  @IsObject()
  @IsOptional()
  tags?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Form template version tag' })
  @IsString()
  @IsOptional()
  formTemplateVersion?: string;
}

export class UpdateApplicantDto {
  // Identity
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

  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional({ description: 'Gender UUID' })
  @IsString()
  @IsOptional()
  genderId?: string;

  @ApiPropertyOptional({ description: 'Birth place' })
  @IsString()
  @IsOptional()
  birthPlace?: string;

  @ApiPropertyOptional({ description: 'Photo File ID placeholder' })
  @IsString()
  @IsOptional()
  photoFileId?: string;

  // Demographic
  @ApiPropertyOptional({ description: 'Religion UUID' })
  @IsString()
  @IsOptional()
  religionId?: string;

  @ApiPropertyOptional({ description: 'Caste UUID' })
  @IsString()
  @IsOptional()
  casteId?: string;

  @ApiPropertyOptional({ description: 'Category UUID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Mother tongue (Language UUID)' })
  @IsString()
  @IsOptional()
  motherTongueId?: string;

  @ApiPropertyOptional({ description: 'Blood Group UUID' })
  @IsString()
  @IsOptional()
  bloodGroupId?: string;

  @ApiPropertyOptional({ description: 'Disability Status' })
  @IsBoolean()
  @IsOptional()
  disabilityStatus?: boolean;

  @ApiPropertyOptional({ description: 'Disability Type UUID' })
  @IsString()
  @IsOptional()
  disabilityTypeId?: string;

  @ApiPropertyOptional({ description: 'Disability Notes' })
  @IsString()
  @IsOptional()
  disabilityNotes?: string;

  // Government Details
  @ApiPropertyOptional({ description: 'Aadhaar Number' })
  @IsString()
  @IsOptional()
  aadhaarNo?: string;

  @ApiPropertyOptional({ description: 'Permanent Education Number (PEN)' })
  @IsString()
  @IsOptional()
  penNo?: string;

  @ApiPropertyOptional({ description: 'APAAR ID' })
  @IsString()
  @IsOptional()
  apaarId?: string;

  // Contact Details
  @ApiPropertyOptional({ description: 'Primary contact mobile number' })
  @IsString()
  @IsOptional()
  primaryMobile?: string;

  @ApiPropertyOptional({ description: 'Alternate mobile number' })
  @IsString()
  @IsOptional()
  alternateMobile?: string;

  @ApiPropertyOptional({ description: 'Primary contact email' })
  @IsString()
  @IsOptional()
  primaryEmail?: string;

  // Address Details
  @ApiPropertyOptional({ description: 'Current address line 1' })
  @IsString()
  @IsOptional()
  currentAddressLine1?: string;

  @ApiPropertyOptional({ description: 'Current address line 2' })
  @IsString()
  @IsOptional()
  currentAddressLine2?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'District' })
  @IsString()
  @IsOptional()
  district?: string;

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

  // Previous Education Details
  @ApiPropertyOptional({ description: 'Previous school name' })
  @IsString()
  @IsOptional()
  previousSchoolName?: string;

  @ApiPropertyOptional({ description: 'Previous school board' })
  @IsString()
  @IsOptional()
  previousBoard?: string;

  @ApiPropertyOptional({ description: 'Previous class attended' })
  @IsString()
  @IsOptional()
  previousClass?: string;

  @ApiPropertyOptional({ description: 'Previous marks percentage' })
  @IsNumber()
  @IsOptional()
  previousPercentage?: number;

  @ApiPropertyOptional({ description: 'Transfer Certificate (TC) number' })
  @IsString()
  @IsOptional()
  tcNumber?: string;

  // Admission details
  @ApiPropertyOptional({ description: 'Admission Source UUID' })
  @IsString()
  @IsOptional()
  admissionSourceId?: string;

  @ApiPropertyOptional({ description: 'Quota UUID' })
  @IsString()
  @IsOptional()
  quotaId?: string;

  @ApiPropertyOptional({ description: 'Internal staff remarks' })
  @IsString()
  @IsOptional()
  internalRemarks?: string;

  @ApiPropertyOptional({ description: 'Counsellor remarks' })
  @IsString()
  @IsOptional()
  counsellorRemarks?: string;

  @ApiPropertyOptional({ description: 'Assigned Counsellor User UUID' })
  @IsString()
  @IsOptional()
  assignedCounsellorId?: string;

  @ApiPropertyOptional({ description: 'Is transportation service required' })
  @IsBoolean()
  @IsOptional()
  transportRequired?: boolean;

  @ApiPropertyOptional({ description: 'Is hostel accommodation required' })
  @IsBoolean()
  @IsOptional()
  hostelRequired?: boolean;

  // Extensibility Placeholders
  @ApiPropertyOptional({ description: 'Custom field data (JSON)' })
  @IsObject()
  @IsOptional()
  customFieldData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Checklist status (JSON)' })
  @IsObject()
  @IsOptional()
  checklistStatus?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags (JSON)' })
  @IsObject()
  @IsOptional()
  tags?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Form template version tag' })
  @IsString()
  @IsOptional()
  formTemplateVersion?: string;
}

export class CheckDuplicatesDto {
  @ApiPropertyOptional({ description: 'Aadhaar Number' })
  @IsString()
  @IsOptional()
  aadhaarNo?: string;

  @ApiProperty({ description: 'Primary contact mobile number' })
  @IsString()
  @IsNotEmpty()
  primaryMobile: string;

  @ApiProperty({ description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Date of birth (ISO format)' })
  @IsDateString()
  dob: string;
}

export class QueryApplicantDto {
  @ApiPropertyOptional({
    description:
      'Search text (matches displayName, mobile, aadhaar, applicationNo, formNo)',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by admission status, e.g. DRAFT, SUBMITTED',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
  })
  @IsString()
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({ description: 'Page limit size', default: 10 })
  @IsString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    default: 'createdAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort direction: asc or desc',
    default: 'desc',
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
