import { ApiProperty } from '@nestjs/swagger';
import { InstitutionType, OrganizationStatus } from '@/generated/client';
import {
  AvailableAcademicYearItem,
  AvailableBranchItem,
  AvailableOrganizationItem,
} from '../interfaces/execution-context.interface';

export class ExecutionContextDto {
  @ApiProperty({
    type: String,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b',
    nullable: true,
  })
  organizationId!: string | null;

  @ApiProperty({
    type: String,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c',
    nullable: true,
  })
  branchId!: string | null;

  @ApiProperty({
    type: String,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6d',
    nullable: true,
  })
  academicYearId!: string | null;

  @ApiProperty({ example: null, nullable: true })
  programId!: null;

  @ApiProperty({ example: null, nullable: true })
  departmentId!: null;

  @ApiProperty({ example: null, nullable: true })
  campusId!: null;
}

// --- Context discovery ----------------------------------------------------
//
// The choices a client can switch between. Returned by `GET /auth/me` and by
// the context endpoints, and carried in the `error.details` of a
// CONTEXT_SELECTION_REQUIRED so the client can prompt without a second call.

export class AvailableOrganizationDto implements AvailableOrganizationItem {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  id!: string;

  @ApiProperty({ example: 'Northfield Education Trust' })
  name!: string;

  @ApiProperty({ example: 'NET' })
  code!: string;

  @ApiProperty({ enum: OrganizationStatus, example: OrganizationStatus.ACTIVE })
  status!: string;
}

export class AvailableBranchDto implements AvailableBranchItem {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  organizationId!: string;

  @ApiProperty({ example: 'Main Campus' })
  name!: string;

  @ApiProperty({ example: 'MAIN' })
  code!: string;

  @ApiProperty({ enum: InstitutionType, example: InstitutionType.SCHOOL })
  institutionType!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class AvailableAcademicYearDto implements AvailableAcademicYearItem {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6d' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  name!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startDate!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endDate!: Date;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    description: 'The year the branch currently defaults to.',
    example: true,
  })
  isSelected!: boolean;

  @ApiProperty({
    description: 'A locked year rejects writes.',
    example: false,
  })
  isLocked!: boolean;
}
