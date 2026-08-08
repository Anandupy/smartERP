import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GovernmentIdType } from '@/generated/client';

export { GovernmentIdType };

/**
 * Candidate search input.
 *
 * A government identifier is deliberately **not** accepted here. Matching on
 * one is deterministic and belongs to `resolve()`; allowing it as a search term
 * would turn this endpoint into an oracle for "does this organization hold this
 * Aadhaar?", answerable by anyone who can call it.
 */
export class FindPersonCandidatesDto {
  @ApiProperty({ example: 'Riya' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Anil' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  middleName?: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: '2015-04-12', format: 'date' })
  @IsDateString()
  dob!: string;

  @ApiPropertyOptional({
    description: 'Contact number. Normalised to its last ten digits.',
    example: '9876543210',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;
}

export class AttachGovernmentIdDto {
  @ApiProperty({
    enum: GovernmentIdType,
    default: GovernmentIdType.AADHAAR,
    example: GovernmentIdType.AADHAAR,
  })
  @IsEnum(GovernmentIdType)
  idType!: GovernmentIdType;

  @ApiProperty({
    description:
      'The identifier. Stored encrypted and as a keyed blind index; never returned, never logged.',
    example: '987654321012',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  value!: string;
}

export class RecordMatchDecisionDto {
  @ApiProperty()
  @IsUUID()
  personAId!: string;

  @ApiProperty()
  @IsUUID()
  personBId!: string;

  @ApiProperty({
    description:
      'Why these are different people. Recorded so the same pair is not re-reviewed every year.',
    example:
      'Twins — same DOB and household mobile, confirmed with the parent.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
