import { ApiProperty } from '@nestjs/swagger';
import {
  AffiliationType,
  InstitutionType,
  StructureMode,
} from '@/generated/client';
import { OrganizationDto } from '@/modules/organization/dto/organization-response.dto';

/**
 * A campus within an organization — the unit almost every other record is
 * scoped to, and the value of the `x-branch-id` header.
 */
export class BranchDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  organizationId!: string;

  @ApiProperty({ example: 'Main Campus' })
  name!: string;

  @ApiProperty({
    description: 'Unique branch code, stored lower-cased.',
    example: 'main',
  })
  code!: string;

  @ApiProperty({ type: String, nullable: true, example: 'MH/EDU/2019/4471' })
  registrationNumber!: string | null;

  @ApiProperty({ enum: InstitutionType, example: InstitutionType.SCHOOL })
  institutionType!: InstitutionType;

  @ApiProperty({
    enum: AffiliationType,
    nullable: true,
    example: AffiliationType.BOARD,
  })
  affiliationType!: AffiliationType | null;

  @ApiProperty({ type: String, nullable: true, example: 'CBSE' })
  affiliationName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://cdn.example.edu/main.png',
  })
  logoUrl!: string | null;

  @ApiProperty({ example: 'main@northfield.edu' })
  contactEmail!: string;

  @ApiProperty({ example: '+912212345679' })
  contactPhone!: string;

  @ApiProperty({ example: '14 Ring Road' })
  addressLine1!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Sector 7' })
  addressLine2!: string | null;

  @ApiProperty({ example: 'Pune' })
  city!: string;

  @ApiProperty({ example: 'Maharashtra' })
  state!: string;

  @ApiProperty({ example: 'India' })
  country!: string;

  @ApiProperty({ example: '411001' })
  pincode!: string;

  @ApiProperty({
    description:
      'DEFAULT uses the standard academic hierarchy; CUSTOM lets the branch define its own unit types.',
    enum: StructureMode,
    example: StructureMode.DEFAULT,
  })
  structureMode!: StructureMode;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    description: 'Soft-delete flag. Deleted branches are excluded from lists.',
    example: false,
  })
  isDeleted!: boolean;

  @ApiProperty({ type: String, nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

/**
 * A branch with its parent organization hydrated.
 *
 * The read endpoints include the relation so a client can render a branch
 * header without a second call; the write endpoints do not.
 */
export class BranchWithOrganizationDto extends BranchDto {
  @ApiProperty({ type: OrganizationDto })
  organization!: OrganizationDto;
}
