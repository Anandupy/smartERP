import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EnrollmentKind, EnrollmentStatus } from '@/generated/client';

/**
 * Command DTOs, one per operation.
 *
 * Not a shared `UpdateEnrollmentDto`. A single DTO covering every mutation is
 * how `organizationId`, `enrollmentStatus` or `previousEnrollmentId` eventually
 * become client-supplied: somebody adds a field for one caller and the global
 * validation pipe cheerfully accepts it from all of them. Server-owned values
 * appear in none of these classes, so mass assignment has nothing to assign.
 */

/** Shared by every mutating command. */
class VersionedCommandDto {
  @ApiPropertyOptional({
    description:
      'The version the client was looking at. Supplied, the write is refused with STALE_ENROLLMENT_VERSION if the placement moved on in the meantime; omitted, the row lock alone orders the writes.',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class CorrectEnrollmentDto extends VersionedCommandDto {
  @ApiPropertyOptional({
    description: 'The corrected programme. Carried over when omitted.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({
    description: 'The corrected academic unit. Carried over when omitted.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  academicUnitId?: string;

  @ApiProperty({
    description:
      'Why the original placement was wrong. Stored on both rows and required — a correction with no reason is indistinguishable from a mistake.',
    example: 'Wrong class selected at admission',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class TransferEnrollmentDto extends VersionedCommandDto {
  @ApiPropertyOptional({
    description: 'The programme moved to. Carried over when omitted.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({
    description: 'The academic unit moved to. Carried over when omitted.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  academicUnitId?: string;

  @ApiPropertyOptional({
    description:
      'Position in the new class register. Carried over when omitted, which is rarely what is wanted after a section change.',
    example: '17',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  rollNumber?: string | null;

  @ApiProperty({
    description: 'Why the student moved.',
    example: 'Section change requested by the parent',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class CancelEnrollmentDto extends VersionedCommandDto {
  @ApiProperty({
    description: 'Why the placement is being voided.',
    example: 'Duplicate placement created in error',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class AssignRollNumberDto extends VersionedCommandDto {
  @ApiProperty({
    description:
      'The class-register position, or null to clear it. Unique within the academic unit for the year, and not an identifier: it changes when the register is reshuffled.',
    example: '17',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  rollNumber!: string | null;
}

/**
 * Filters for the list endpoint.
 *
 * `branchId` and `organizationId` are absent by design: they come from the
 * execution context, so there is no filter a caller could set to read another
 * branch's class list.
 */
export class ListEnrollmentsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({
    description:
      'The class list query — the second hottest read in the system.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  academicUnitId?: string;

  @ApiPropertyOptional({ enum: EnrollmentStatus })
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  enrollmentStatus?: EnrollmentStatus;

  @ApiPropertyOptional({ enum: EnrollmentKind })
  @IsOptional()
  @IsEnum(EnrollmentKind)
  enrollmentKind?: EnrollmentKind;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
