import { ApiProperty } from '@nestjs/swagger';
import { AdmissionMasterDto } from '../../masters/dto/master-response.dto';

/**
 * A parent or guardian.
 *
 * Held once per person and shared across siblings, which is what the search
 * endpoint exists for — an operator finds the existing record rather than
 * creating a duplicate for the second child.
 */
export class GuardianDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ac0' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  organizationId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  branchId!: string;

  @ApiProperty({ example: 'Anil' })
  firstName!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  middleName!: string | null;

  @ApiProperty({ example: 'Sharma' })
  lastName!: string;

  @ApiProperty({ example: '+919876543211' })
  mobilePrimary!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  mobileSecondary!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'anil.sharma@example.com',
  })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Engineer' })
  occupation!: string | null;

  @ApiProperty({
    type: Number,
    description: 'Declared annual income.',
    nullable: true,
    example: 850000,
  })
  income!: number | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  aadhaarNo!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '14 Ring Road' })
  addressLine1!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  addressLine2!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Pune' })
  city!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Maharashtra' })
  state!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'India' })
  country!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '411001' })
  pincode!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Set when soft-deleted. Null while the record is live.',
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  deletedAt!: Date | null;
}

/**
 * The link between an applicant and a guardian.
 *
 * The guardian record is shared; this join carries the per-applicant facts —
 * which relation, who is primary, who may collect the child.
 */
export class ApplicantGuardianMappingDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ad0' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ab0' })
  applicantId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ac0' })
  guardianId!: string;

  @ApiProperty({
    description: 'References an Admissions Masters relation type.',
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5aa1',
  })
  relationTypeId!: string;

  @ApiProperty({ example: true })
  isPrimary!: boolean;

  @ApiProperty({ example: true })
  isEmergencyContact!: boolean;

  @ApiProperty({ example: true })
  isFinancialGuardian!: boolean;

  @ApiProperty({
    description: 'Whether this guardian may collect the applicant.',
    example: true,
  })
  pickupAllowed!: boolean;

  @ApiProperty({ description: 'Contact order, lowest first.', example: 1 })
  priority!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/** A mapping with the guardian and the relation type hydrated. */
export class MappedGuardianDto extends ApplicantGuardianMappingDto {
  @ApiProperty({ type: GuardianDto })
  guardian!: GuardianDto;

  @ApiProperty({ type: AdmissionMasterDto })
  relationType!: AdmissionMasterDto;
}
