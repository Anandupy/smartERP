import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudentCreationMode, StudentStatus } from '@/generated/client';

class MasterRefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'GEN_F' }) code!: string;
  @ApiProperty({ example: 'Female' }) name!: string;
}

/**
 * A full student record for staff.
 *
 * Carries both identifiers deliberately: `id` is what a client acts with, and
 * `studentCode` is what it shows. Neither substitutes for the other.
 *
 * No government identifier appears here in any form — not the value, not a
 * masked form, not the blind index. Reaching Aadhaar is a Person operation with
 * its own permission, and it is not part of reading a student.
 */
export class StudentDetailDto {
  @ApiProperty({ example: '019f8f56-ece4-71d0-8b71-054cd7e234ea' })
  id!: string;

  @ApiProperty({
    description: 'The permanent human-facing identifier.',
    example: 'STU0000000123',
  })
  studentCode!: string;

  @ApiProperty() organizationId!: string;

  @ApiProperty({
    description:
      'Where the student currently is. A mutable pointer — the branch a spell of ' +
      'study actually happened at lives on Admission.',
  })
  branchId!: string;

  @ApiProperty({ description: 'The human behind this learner identity.' })
  personId!: string;

  @ApiProperty({ enum: StudentStatus }) status!: StudentStatus;

  @ApiProperty({ example: 'Riya Anil Sharma' }) displayName!: string;
  @ApiProperty({ example: 'Riya' }) firstName!: string;
  @ApiProperty({ type: String, nullable: true }) middleName!: string | null;
  @ApiProperty({ example: 'Sharma' }) lastName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) dob!: Date;

  @ApiProperty({ type: MasterRefDto }) gender!: MasterRefDto;
  @ApiPropertyOptional({ type: MasterRefDto, nullable: true })
  religion!: MasterRefDto | null;
  @ApiPropertyOptional({ type: MasterRefDto, nullable: true })
  caste!: MasterRefDto | null;
  @ApiPropertyOptional({ type: MasterRefDto, nullable: true })
  category!: MasterRefDto | null;
  @ApiPropertyOptional({ type: MasterRefDto, nullable: true })
  motherTongue!: MasterRefDto | null;
  @ApiPropertyOptional({ type: MasterRefDto, nullable: true })
  bloodGroup!: MasterRefDto | null;

  @ApiProperty() disabilityStatus!: boolean;
  @ApiPropertyOptional({ type: MasterRefDto, nullable: true })
  disabilityType!: MasterRefDto | null;
  @ApiProperty({ type: String, nullable: true }) disabilityNotes!:
    | string
    | null;

  @ApiProperty({ type: String, nullable: true }) primaryMobile!: string | null;
  @ApiProperty({ type: String, nullable: true }) primaryEmail!: string | null;

  @ApiProperty({ type: String, nullable: true }) apaarId!: string | null;
  @ApiProperty({ type: String, nullable: true }) abcId!: string | null;
  @ApiProperty({ type: String, nullable: true }) penNo!: string | null;
  @ApiProperty({ type: String, nullable: true }) saralId!: string | null;
  @ApiProperty({ type: String, nullable: true }) udiseStudentId!: string | null;

  @ApiProperty({ type: String, nullable: true }) photoDocumentId!:
    | string
    | null;

  @ApiProperty({ enum: StudentCreationMode }) createdVia!: StudentCreationMode;
  @ApiProperty({ type: String, nullable: true }) sourceApplicantId!:
    | string
    | null;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

/**
 * A search hit.
 *
 * Deliberately narrow. A result list is the widest-reach read in the product —
 * every staff member runs it many times a day — so it carries what is needed to
 * recognise and select a student and nothing else.
 */
export class StudentListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'STU0000000123' }) studentCode!: string;
  @ApiProperty({ example: 'Riya Anil Sharma' }) displayName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) dob!: Date;
  @ApiProperty({ enum: StudentStatus }) status!: StudentStatus;
  @ApiProperty() branchId!: string;
  @ApiProperty({ type: String, nullable: true }) primaryMobile!: string | null;
}

/**
 * What a cross-branch match reveals to a caller holding
 * `student.view.organization`.
 *
 * Enough to answer "does this code belong to a student of ours, and where?" —
 * which is the real reason to search a code you do not own, whether a sibling
 * enquiry, a transfer or a fee question — and nothing more. Contact details and
 * demographics stay with the branch that holds the record.
 */
export class StudentCrossBranchSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'STU0000000123' }) studentCode!: string;
  @ApiProperty({ example: 'Riya Anil Sharma' }) displayName!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({ enum: StudentStatus }) status!: StudentStatus;
}
