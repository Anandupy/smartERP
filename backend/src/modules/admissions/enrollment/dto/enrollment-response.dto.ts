import { ApiProperty } from '@nestjs/swagger';
import { AcademicUnitDto } from '@/modules/academic-unit/dto/academic-unit-response.dto';
import { ProgramDto } from '@/modules/program/dto/program-response.dto';

/**
 * A placement: the program and academic unit an approved applicant joins.
 *
 * One per applicant — a second attempt is rejected rather than replacing the
 * first.
 */
export class EnrollmentDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5af0' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  organizationId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  branchId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6d' })
  academicYearId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a80' })
  programId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a90' })
  academicUnitId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ab0' })
  applicantId!: string;

  @ApiProperty({
    description: 'Reserved for the permanent student record.',
    nullable: true,
    example: null,
  })
  futureStudentId!: string | null;

  @ApiProperty({ nullable: true, example: '11A-014' })
  rollNumber!: string | null;

  @ApiProperty({
    enum: ['ACTIVE', 'PROMOTED', 'COMPLETED', 'CANCELLED'],
    example: 'ACTIVE',
  })
  enrollmentStatus!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}

/**
 * An enrollment with its program and academic unit hydrated, so a client can
 * name the placement without two more lookups.
 */
export class EnrollmentDetailDto extends EnrollmentDto {
  @ApiProperty({ type: ProgramDto })
  program!: ProgramDto;

  @ApiProperty({ type: AcademicUnitDto })
  academicUnit!: AcademicUnitDto;
}
