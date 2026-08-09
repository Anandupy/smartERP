import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StudentStatus } from '@/generated/client';
import {
  STUDENT_SEARCH_DEFAULT_LIMIT,
  STUDENT_SEARCH_MAX_LIMIT,
} from '../student.types';

export { StudentStatus };

/**
 * There is deliberately no `CreateStudentDto`.
 *
 * A Student is born from `admit()` or the migration importer, never from a
 * request body — so no DTO exists that could be bound to a create route by
 * someone adding one later.
 */

export class SearchStudentsDto {
  @ApiPropertyOptional({
    description:
      'One free-text term. Interpreted by shape: a student code, part of a name, ' +
      'or a phone number — staff type into one box and expect it to work.',
    example: 'STU00000001',
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({
    description: 'Exact date of birth. Combined with `q` when both are given.',
    example: '2015-04-12',
    format: 'date',
  })
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional({
    enum: StudentStatus,
    isArray: true,
    description: 'Restrict to particular lifecycle statuses.',
  })
  @IsEnum(StudentStatus, { each: true })
  @IsOptional()
  status?: StudentStatus[];

  @ApiPropertyOptional({
    description:
      'Include students who are not ACTIVE. Archived students remain searchable — ' +
      'archival is a write lock, not a disappearance.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeInactive?: boolean;

  @ApiPropertyOptional({
    description:
      'Search every branch in the organization. Requires `student.view.organization`; ' +
      'without it the parameter is ignored rather than refused, because refusing would ' +
      'confirm that out-of-branch matches exist.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  organizationWide?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    default: STUDENT_SEARCH_DEFAULT_LIMIT,
    minimum: 1,
    maximum: STUDENT_SEARCH_MAX_LIMIT,
  })
  @IsInt()
  @Min(1)
  @Max(STUDENT_SEARCH_MAX_LIMIT)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class LookupStudentByCodeDto {
  @ApiPropertyOptional({
    description: 'The human-facing code. Case-insensitive.',
    example: 'STU0000000123',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;

  @ApiPropertyOptional({
    description:
      'Look beyond the current branch. Requires `student.view.organization`.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  organizationWide?: boolean;
}

/**
 * Correction of the institution's current official record.
 *
 * The absent fields are the point. `studentCode`, `personId`, `organizationId`,
 * `branchId`, `sourceApplicantId` and `status` cannot be reached from here:
 * the first five are identity, and status moves only through the lifecycle
 * operations Phase 6 introduces. A DTO that mirrored the table would eventually
 * accept one of them because somebody added a column and the DTO followed.
 */
export class CorrectStudentDemographicsDto {
  @ApiPropertyOptional({ example: 'Riya' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ nullable: true, example: 'Anil' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  middleName?: string | null;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ format: 'date', example: '2015-04-12' })
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional() @IsUUID() @IsOptional() genderId?: string;
  @ApiPropertyOptional({ nullable: true }) @IsUUID() @IsOptional() religionId?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @IsUUID() @IsOptional() casteId?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) @IsUUID() @IsOptional() categoryId?:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true })
  @IsUUID()
  @IsOptional()
  motherTongueId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsUUID()
  @IsOptional()
  bloodGroupId?: string | null;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() disabilityStatus?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @IsUUID()
  @IsOptional()
  disabilityTypeId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  disabilityNotes?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "The student's own contact, not a guardian's.",
    example: '9876543210',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  primaryMobile?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsEmail()
  @IsOptional()
  @MaxLength(160)
  primaryEmail?: string | null;

  // Institutional identifiers. Plaintext by design — issued to be shared
  // between institutions and printed on records. Aadhaar is not among them and
  // never will be: it lives in PersonSensitive.
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  apaarId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  abcId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  penNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  saralId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  udiseStudentId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'A Document reference. Student stores no file content.',
  })
  @IsUUID()
  @IsOptional()
  photoDocumentId?: string | null;
}
