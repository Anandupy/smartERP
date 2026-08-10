import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AdmissionType } from '@/generated/client';

/**
 * What admission genuinely needs, and nothing the applicant already knows.
 *
 * Absent by design: `organizationId`, `branchId`, `academicYearId`, `programId`,
 * `studentId`, `studentCode`, `personId`, `admissionId`, `enrollmentId` and the
 * applicant's status. All of those are server-owned — derived from the
 * applicant's own lineage or minted during the transaction — and a field here
 * would be a field the global validation pipe accepts from a client.
 */
export class AdmitApplicantDto {
  @ApiProperty({
    description:
      'The section the student joins. Required because nothing earlier records one: an applicant applies to a programme, and which section they land in is the decision being made now. It must belong to the application’s branch, academic year and programme.',
    format: 'uuid',
  })
  @IsUUID()
  academicUnitId!: string;

  @ApiPropertyOptional({
    enum: AdmissionType,
    default: AdmissionType.REGULAR,
    description:
      'The academic nature of the entry. REGULAR, LATERAL_ENTRY and RTE are first entries; READMISSION and BRANCH_TRANSFER begin from an existing student and are separate operations.',
  })
  @IsOptional()
  @IsEnum(AdmissionType)
  admissionType?: AdmissionType;

  @ApiPropertyOptional({
    description:
      'The joining date. Defaults to now; supplied only when recording an entry that already happened.',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  admissionDate?: Date;

  @ApiPropertyOptional({
    description: 'Recorded on the workflow history entry.',
    example: 'Seat accepted and fees settled at the counter',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/** What the caller needs to act on the result, and nothing about the person. */
export class AdmitResultDto {
  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a71' })
  studentId!: string;

  @ApiProperty({
    description:
      'Permanent and human-facing. Safe to print; never a foreign key.',
    example: 'STU0000000123',
  })
  studentCode!: string;

  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a70' })
  admissionId!: string;

  @ApiProperty({ example: 'AD-00042' })
  admissionNo!: string;

  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5af0' })
  enrollmentId!: string;

  @ApiProperty({
    description:
      'The application this student came from. It survives, as evidence.',
    example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ab0',
  })
  applicantId!: string;
}
